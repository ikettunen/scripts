#!/usr/bin/env node

/**
 * TEST FILE CLEANUP SCRIPT
 * 
 * This script cleans up test files created by Step 10 and other test scripts.
 * It identifies test files by tags and filename patterns.
 * 
 * Usage:
 *   node scripts/cleanup-test-files.js                    # Clean all test files
 *   node scripts/cleanup-test-files.js step10-test-123   # Clean specific session
 */

const axios = require('axios');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  services: {
    authService: process.env.AUTH_SERVICE_URL || 'http://localhost:3002',
    s3BucketService: process.env.S3_BUCKET_SERVICE_URL || 'http://localhost:3009'
  },
  auth: {
    email: 'maria.nieminen@hoitokoti.fi',
    password: 'nursing123'
  }
};

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

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

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logProgress(message) {
  log(`   ${message}`, 'reset');
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function authenticate() {
  try {
    const response = await axios.post(`${CONFIG.services.authService}/api/auth/login`, CONFIG.auth, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.data.success || !response.data.data.token) {
      throw new Error('Authentication failed: No token received');
    }
    
    return response.data.data.token;
  } catch (error) {
    logError(`Authentication failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

async function findTestFiles(authToken, sessionId = null) {
  const testFiles = {
    soundData: [],
    photoData: []
  };
  
  try {
    // Find sound data test files
    logProgress('Searching for test sound files...');
    const soundDataResponse = await axios.get(`${CONFIG.services.s3BucketService}/api/sound-data`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      params: { 
        limit: 100,
        sortBy: 'uploadedAt',
        sortOrder: 'desc'
      },
      timeout: 10000
    });
    
    const soundRecords = soundDataResponse.data.data.records || [];
    
    // Filter test files
    testFiles.soundData = soundRecords.filter(record => {
      // Check for test tags
      const hasTestTags = record.tags && (
        record.tags.includes('test') || 
        record.tags.includes('step10') || 
        record.tags.includes('automated-test')
      );
      
      // Check for test filename patterns
      const hasTestFilename = record.fileName && (
        record.fileName.includes('step10-test-') ||
        record.fileName.includes('test-recording') ||
        record.fileName.includes('test-audio')
      );
      
      // Check for specific session ID
      const matchesSession = !sessionId || (record.tags && record.tags.includes(sessionId));
      
      return (hasTestTags || hasTestFilename) && matchesSession;
    });
    
    logProgress(`Found ${testFiles.soundData.length} test sound files`);
    
    // Find photo data test files
    try {
      logProgress('Searching for test photo files...');
      const photoDataResponse = await axios.get(`${CONFIG.services.s3BucketService}/api/photo-data`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
        params: { 
          limit: 100,
          sortBy: 'uploadedAt',
          sortOrder: 'desc'
        },
        timeout: 10000
      });
      
      const photoRecords = photoDataResponse.data.data.records || [];
      
      // Filter test files
      testFiles.photoData = photoRecords.filter(record => {
        // Check for test tags
        const hasTestTags = record.tags && (
          record.tags.includes('test') || 
          record.tags.includes('step10') || 
          record.tags.includes('automated-test')
        );
        
        // Check for test filename patterns
        const hasTestFilename = record.fileName && (
          record.fileName.includes('step10-test-') ||
          record.fileName.includes('test-photo') ||
          record.fileName.includes('test-image')
        );
        
        // Check for specific session ID
        const matchesSession = !sessionId || (record.tags && record.tags.includes(sessionId));
        
        return (hasTestTags || hasTestFilename) && matchesSession;
      });
      
      logProgress(`Found ${testFiles.photoData.length} test photo files`);
      
    } catch (photoError) {
      logWarning('Photo data search failed - photo-data endpoint may not be implemented');
    }
    
    return testFiles;
    
  } catch (error) {
    logError(`Failed to find test files: ${error.message}`);
    throw error;
  }
}

async function deleteTestFiles(authToken, testFiles) {
  const results = {
    soundDataDeleted: 0,
    photoDataDeleted: 0,
    errors: []
  };
  
  // Delete sound data files
  for (const record of testFiles.soundData) {
    try {
      logProgress(`Deleting sound file: ${record.fileName} (${record._id})`);
      await axios.delete(`${CONFIG.services.s3BucketService}/api/sound-data/${record._id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
        timeout: 10000
      });
      results.soundDataDeleted++;
    } catch (deleteError) {
      logProgress(`Failed to delete sound file ${record._id}: ${deleteError.message}`);
      results.errors.push({
        type: 'sound_data',
        id: record._id,
        fileName: record.fileName,
        error: deleteError.message
      });
    }
  }
  
  // Delete photo data files
  for (const record of testFiles.photoData) {
    try {
      logProgress(`Deleting photo file: ${record.fileName} (${record._id})`);
      await axios.delete(`${CONFIG.services.s3BucketService}/api/photo-data/${record._id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
        timeout: 10000
      });
      results.photoDataDeleted++;
    } catch (deleteError) {
      logProgress(`Failed to delete photo file ${record._id}: ${deleteError.message}`);
      results.errors.push({
        type: 'photo_data',
        id: record._id,
        fileName: record.fileName,
        error: deleteError.message
      });
    }
  }
  
  return results;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const sessionId = process.argv[2]; // Optional session ID from command line
  
  console.log('='.repeat(80));
  log('🧹 TEST FILE CLEANUP SCRIPT', 'cyan');
  console.log('='.repeat(80));
  
  if (sessionId) {
    log(`Cleaning up specific session: ${sessionId}`, 'blue');
  } else {
    log('Cleaning up all test files', 'blue');
  }
  
  try {
    // Authenticate
    logProgress('Authenticating...');
    const authToken = await authenticate();
    logSuccess('Authentication successful');
    
    // Find test files
    logProgress('Finding test files...');
    const testFiles = await findTestFiles(authToken, sessionId);
    
    const totalFiles = testFiles.soundData.length + testFiles.photoData.length;
    
    if (totalFiles === 0) {
      logInfo('No test files found to clean up');
      return;
    }
    
    logInfo(`Found ${totalFiles} test files to delete:`);
    logInfo(`  - Sound files: ${testFiles.soundData.length}`);
    logInfo(`  - Photo files: ${testFiles.photoData.length}`);
    
    // List files to be deleted
    if (testFiles.soundData.length > 0) {
      logInfo('\nSound files to delete:');
      testFiles.soundData.forEach((file, index) => {
        logProgress(`  ${index + 1}. ${file.fileName} (${file.uploadedAt})`);
      });
    }
    
    if (testFiles.photoData.length > 0) {
      logInfo('\nPhoto files to delete:');
      testFiles.photoData.forEach((file, index) => {
        logProgress(`  ${index + 1}. ${file.fileName} (${file.uploadedAt})`);
      });
    }
    
    // Confirm deletion
    console.log('\n' + '-'.repeat(60));
    logWarning('This will permanently delete the files listed above!');
    
    // In a real scenario, you might want to add a confirmation prompt
    // For automated testing, we'll proceed directly
    
    // Delete files
    logProgress('\nDeleting test files...');
    const results = await deleteTestFiles(authToken, testFiles);
    
    // Summary
    console.log('\n' + '='.repeat(80));
    logSuccess('CLEANUP COMPLETED');
    console.log('='.repeat(80));
    
    logInfo(`Files deleted: ${results.soundDataDeleted + results.photoDataDeleted}`);
    logInfo(`  - Sound files: ${results.soundDataDeleted}`);
    logInfo(`  - Photo files: ${results.photoDataDeleted}`);
    
    if (results.errors.length > 0) {
      logWarning(`Errors: ${results.errors.length}`);
      results.errors.forEach((error, index) => {
        logProgress(`  ${index + 1}. ${error.fileName}: ${error.error}`);
      });
    }
    
  } catch (error) {
    logError(`Cleanup failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };