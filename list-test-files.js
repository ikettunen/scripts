#!/usr/bin/env node

/**
 * LIST TEST FILES SCRIPT
 * 
 * This script lists all test files created by Step 10 and other test scripts.
 * Useful for verifying what files exist before cleanup.
 * 
 * Usage:
 *   node scripts/list-test-files.js                    # List all test files
 *   node scripts/list-test-files.js step10-test-123   # List specific session
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
// LIST FUNCTIONS
// ============================================================================

async function listTestFiles(authToken, sessionId = null) {
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
      
    } catch (photoError) {
      logWarning('Photo data search failed - photo-data endpoint may not be implemented');
    }
    
    return testFiles;
    
  } catch (error) {
    logError(`Failed to find test files: ${error.message}`);
    throw error;
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const sessionId = process.argv[2]; // Optional session ID from command line
  
  console.log('='.repeat(80));
  log('📋 TEST FILES LISTING', 'cyan');
  console.log('='.repeat(80));
  
  if (sessionId) {
    log(`Listing files for session: ${sessionId}`, 'blue');
  } else {
    log('Listing all test files', 'blue');
  }
  
  try {
    // Authenticate
    logProgress('Authenticating...');
    const authToken = await authenticate();
    logSuccess('Authentication successful');
    
    // Find test files
    logProgress('Finding test files...');
    const testFiles = await listTestFiles(authToken, sessionId);
    
    const totalFiles = testFiles.soundData.length + testFiles.photoData.length;
    
    if (totalFiles === 0) {
      logInfo('No test files found');
      return;
    }
    
    console.log('\n' + '='.repeat(80));
    logSuccess(`FOUND ${totalFiles} TEST FILES`);
    console.log('='.repeat(80));
    
    // List sound files
    if (testFiles.soundData.length > 0) {
      log(`\n🎵 AUDIO FILES (${testFiles.soundData.length})`, 'cyan');
      console.log('-'.repeat(80));
      
      testFiles.soundData.forEach((file, index) => {
        log(`${index + 1}. ${file.fileName}`, 'bright');
        logProgress(`   ID: ${file._id}`);
        logProgress(`   Size: ${formatFileSize(file.fileSize || 0)}`);
        logProgress(`   Duration: ${file.duration || 'N/A'} seconds`);
        logProgress(`   Type: ${file.recordingType || 'N/A'}`);
        logProgress(`   Visit: ${file.visitId}`);
        logProgress(`   Patient: ${file.patientId}`);
        logProgress(`   Uploaded: ${formatDate(file.uploadedAt)}`);
        logProgress(`   Status: ${file.processingStatus}`);
        logProgress(`   Tags: ${file.tags ? file.tags.join(', ') : 'None'}`);
        logProgress(`   S3 Key: ${file.s3Key}`);
        console.log();
      });
    }
    
    // List photo files
    if (testFiles.photoData.length > 0) {
      log(`\n📷 PHOTO FILES (${testFiles.photoData.length})`, 'cyan');
      console.log('-'.repeat(80));
      
      testFiles.photoData.forEach((file, index) => {
        log(`${index + 1}. ${file.fileName}`, 'bright');
        logProgress(`   ID: ${file._id}`);
        logProgress(`   Size: ${formatFileSize(file.fileSize || 0)}`);
        logProgress(`   Dimensions: ${file.dimensions ? `${file.dimensions.width}x${file.dimensions.height}` : 'N/A'}`);
        logProgress(`   Type: ${file.photoType || 'N/A'}`);
        logProgress(`   Visit: ${file.visitId}`);
        logProgress(`   Patient: ${file.patientId}`);
        logProgress(`   Uploaded: ${formatDate(file.uploadedAt)}`);
        logProgress(`   Status: ${file.processingStatus}`);
        logProgress(`   Tags: ${file.tags ? file.tags.join(', ') : 'None'}`);
        logProgress(`   S3 Key: ${file.s3Key}`);
        console.log();
      });
    }
    
    // Summary
    console.log('='.repeat(80));
    logInfo('SUMMARY');
    console.log('='.repeat(80));
    logInfo(`Total test files: ${totalFiles}`);
    logInfo(`Audio files: ${testFiles.soundData.length}`);
    logInfo(`Photo files: ${testFiles.photoData.length}`);
    
    if (sessionId) {
      logInfo(`Session filter: ${sessionId}`);
    }
    
    logInfo('\n🧹 To clean up these files:');
    if (sessionId) {
      logInfo(`   node scripts/cleanup-test-files.js ${sessionId}`);
    } else {
      logInfo('   node scripts/cleanup-test-files.js');
    }
    
  } catch (error) {
    logError(`Listing failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };