#!/usr/bin/env node

/**
 * Fix Care Plan Staff IDs
 * 
 * This script fixes the staff ID format mismatch in care plans:
 * - Changes D0001 (Dr. Korhonen) to staff-1003 (Jukka Mäkinen)
 * - Changes S0001 (Anna Virtanen) to staff-1001 (Anna Virtanen)
 * - Ensures care plans use the same staff ID format as Oracle HR
 */

const mongoose = require('mongoose');

// MongoDB connection - use local first, then Atlas if specified
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nursing_home_visits';

// Staff ID mappings (old -> new)
const STAFF_ID_MAPPINGS = {
  'D0001': { userId: 'staff-1003', userName: 'Jukka Mäkinen', role: 'Doctor' },
  'S0001': { userId: 'staff-1001', userName: 'Anna Virtanen', role: 'Primary Nurse' }
};

// Logging utilities
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    logSuccess('Connected to MongoDB');
  } catch (error) {
    logError(`Failed to connect to MongoDB: ${error.message}`);
    throw error;
  }
}

async function fixCareplanStaffIds() {
  log('\n🔧 FIXING CARE PLAN STAFF IDS', 'cyan');
  log('================================================================================', 'cyan');
  
  try {
    await connectToMongoDB();
    
    // Get the care plans collection
    const db = mongoose.connection.db;
    const carePlansCollection = db.collection('care_plans');
    
    // List all collections first
    const collections = await db.listCollections().toArray();
    logInfo('Available collections:');
    collections.forEach(col => logInfo(`  - ${col.name}`));
    
    // Find all care plans
    const carePlans = await carePlansCollection.find({}).toArray();
    logInfo(`Found ${carePlans.length} care plans to check`);
    
    let updatedCount = 0;
    
    for (const carePlan of carePlans) {
      let needsUpdate = false;
      const updates = {};
      
      logInfo(`\nChecking care plan for patient: ${carePlan.patientName} (${carePlan.patientId})`);
      
      // Check and update care team members
      if (carePlan.careTeam && Array.isArray(carePlan.careTeam)) {
        const updatedCareTeam = carePlan.careTeam.map((member, index) => {
          if (STAFF_ID_MAPPINGS[member.userId]) {
            const mapping = STAFF_ID_MAPPINGS[member.userId];
            logWarning(`  Updating care team member: ${member.userId} (${member.userName}) -> ${mapping.userId} (${mapping.userName})`);
            needsUpdate = true;
            return {
              ...member,
              userId: mapping.userId,
              userName: mapping.userName,
              role: mapping.role
            };
          }
          return member;
        });
        
        if (needsUpdate) {
          updates.careTeam = updatedCareTeam;
        }
      }
      
      // Check and update createdBy if needed
      if (carePlan.createdBy && STAFF_ID_MAPPINGS[carePlan.createdBy.userId]) {
        const mapping = STAFF_ID_MAPPINGS[carePlan.createdBy.userId];
        logWarning(`  Updating createdBy: ${carePlan.createdBy.userId} -> ${mapping.userId}`);
        needsUpdate = true;
        updates.createdBy = {
          userId: mapping.userId,
          userName: mapping.userName
        };
      }
      
      // Apply updates if needed
      if (needsUpdate) {
        await carePlansCollection.updateOne(
          { _id: carePlan._id },
          { $set: updates }
        );
        updatedCount++;
        logSuccess(`  ✓ Updated care plan for ${carePlan.patientName}`);
      } else {
        logInfo(`  ✓ No updates needed for ${carePlan.patientName}`);
      }
    }
    
    logSuccess(`\n🎉 Care plan staff ID fix completed!`);
    logInfo(`Updated ${updatedCount} out of ${carePlans.length} care plans`);
    
    // Verify the changes
    log('\n📋 VERIFICATION', 'cyan');
    log('================================================================================', 'cyan');
    
    const updatedCarePlans = await carePlansCollection.find({}).toArray();
    
    for (const carePlan of updatedCarePlans) {
      logInfo(`\nCare plan for ${carePlan.patientName}:`);
      if (carePlan.careTeam) {
        carePlan.careTeam.forEach(member => {
          logInfo(`  - ${member.role}: ${member.userName} (${member.userId})`);
        });
      }
    }
    
  } catch (error) {
    logError(`Failed to fix care plan staff IDs: ${error.message}`);
    throw error;
  } finally {
    await mongoose.disconnect();
    logInfo('Disconnected from MongoDB');
  }
}

async function main() {
  const startTime = Date.now();
  
  try {
    await fixCareplanStaffIds();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logSuccess(`\n✨ STAFF ID FIX COMPLETED SUCCESSFULLY! ✨`);
    logInfo(`Total time: ${duration} seconds`);
    
    logInfo('\n💡 Next steps:');
    logInfo('   1. Test photo upload notifications - should now go to Jukka Mäkinen (staff-1003)');
    logInfo('   2. Test audio upload notifications - should still go to Anna Virtanen (staff-1001)');
    logInfo('   3. Run: node scripts/step-10-upload-workflow.js');
    
    process.exit(0);
    
  } catch (error) {
    logError('\n💥 STAFF ID FIX FAILED!');
    logError(`Error: ${error.message}`);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n\n⚠️  Script interrupted by user', 'yellow');
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };