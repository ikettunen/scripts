#!/usr/bin/env node

/**
 * Export Care Plans from Local MongoDB
 * 
 * This script exports care plans and visit templates from local MongoDB
 * and creates a JSON file that can be imported to cloud MongoDB.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Local MongoDB connection
const LOCAL_MONGODB_URI = 'mongodb://localhost:27017/nursing_home_visits';

async function exportCarePlans() {
  console.log('🚀 Exporting care plans from local MongoDB...');
  
  try {
    // Connect to local MongoDB
    await mongoose.connect(LOCAL_MONGODB_URI);
    console.log('✅ Connected to local MongoDB');
    
    // Get care plans collection
    const carePlansCollection = mongoose.connection.db.collection('care_plans');
    const visitTemplatesCollection = mongoose.connection.db.collection('visittemplates');
    
    // Export care plans
    const carePlans = await carePlansCollection.find({}).toArray();
    console.log(`📋 Found ${carePlans.length} care plans`);
    
    // Export visit templates
    const visitTemplates = await visitTemplatesCollection.find({}).toArray();
    console.log(`📝 Found ${visitTemplates.length} visit templates`);
    
    // Create export data
    const exportData = {
      timestamp: new Date().toISOString(),
      source: 'local_mongodb',
      carePlans: carePlans,
      visitTemplates: visitTemplates
    };
    
    // Write to file
    const exportPath = path.join(__dirname, 'care_plans_export.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    
    console.log(`✅ Exported to: ${exportPath}`);
    console.log(`📊 Data summary:`);
    console.log(`   - Care Plans: ${carePlans.length}`);
    console.log(`   - Visit Templates: ${visitTemplates.length}`);
    
    // Close connection
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    process.exit(1);
  }
}

// Run export
exportCarePlans();