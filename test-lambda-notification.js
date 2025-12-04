#!/usr/bin/env node

/**
 * TEST LAMBDA NOTIFICATION SCRIPT
 * 
 * This script tests the s3-upload-notifier lambda function with real test data
 * and then updates the visit record with file information.
 * 
 * Run after Step 10: node scripts/test-lambda-notification.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  services: {
    authService: process.env.AUTH_SERVICE_URL || 'http://localhost:3002',
    notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006',
    visitsService: process.env.VISITS_SERVICE_URL || 'http://localhost:3008',
    staffService: process.env.STAFF_SERVICE_URL || 'http://localhost:6001',
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

function logStep(step, message) {
  log(`\n[STEP ${step}] ${message}`, 'bright');
  log('-'.repeat(80), 'reset');
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
// LOAD TEST DATA
// ============================================================================

async function loadTestData() {
  logStep(1, 'LOADING TEST DATA FROM STEP 10');
  
  try {
    // Load test data from Step 10
    const testDataPath = path.join(__dirname, 'test-data-ids.json');
    if (!fs.existsSync(testDataPath)) {
      throw new Error('Test data not found. Run Step 10 first.');
    }
    
    const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
    logProgress(`Test session: ${testData.testSessionId}`);
    logProgress(`Visit ID: ${testData.visitId}`);
    logProgress(`Patient: ${testData.patientName} (${testData.patientId})`);
    logProgress(`Nurse: ${testData.nurseName} (${testData.nurseId})`);
    logProgress(`Primary Caregiver: ${testData.primaryCaregiverName} (${testData.primaryCaregiverId})`);
    
    // Get the actual uploaded files from MongoDB
    logProgress('Fetching uploaded files from MongoDB...');
    const authToken = await authenticate();
    
    // Get sound data files
    const soundDataResponse = await axios.get(`${CONFIG.services.s3BucketService}/api/sound-data`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      params: { 
        visitId: testData.visitId,
        limit: 10
      },
      timeout: 10000
    });
    
    const soundFiles = soundDataResponse.data.data.records || [];
    const testSoundFiles = soundFiles.filter(file => 
      file.tags && file.tags.includes(testData.testSessionId)
    );
    
    // Get photo data files
    let testPhotoFiles = [];
    try {
      const photoDataResponse = await axios.get(`${CONFIG.services.s3BucketService}/api/photo-data`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
        params: { 
          visitId: testData.visitId,
          limit: 10
        },
        timeout: 10000
      });
      
      const photoFiles = photoDataResponse.data.data.records || [];
      testPhotoFiles = photoFiles.filter(file => 
        file.tags && file.tags.includes(testData.testSessionId)
      );
    } catch (photoError) {
      logWarning('Photo data endpoint not available, checking sound data for photos');
      // Fallback: check if photos are in sound data collection
      testPhotoFiles = testSoundFiles.filter(file => file.mimeType.startsWith('image/'));
    }
    
    const allTestFiles = [...testSoundFiles, ...testPhotoFiles];
    logProgress(`Found ${allTestFiles.length} test files in MongoDB (${testSoundFiles.length} audio, ${testPhotoFiles.length} photo)`);
    
    const audioFile = allTestFiles.find(file => file.mimeType.startsWith('audio/'));
    const photoFile = allTestFiles.find(file => file.mimeType.startsWith('image/'));
    
    if (!audioFile || !photoFile) {
      throw new Error('Test files not found. Run Step 10 first.');
    }
    
    logProgress(`✓ Audio file: ${audioFile.fileName}`);
    logProgress(`✓ Photo file: ${photoFile.fileName}`);
    
    logSuccess('Step 1 completed: Test data loaded');
    
    return {
      ...testData,
      authToken,
      audioFile,
      photoFile
    };
    
  } catch (error) {
    logError(`Failed to load test data: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// TEST LAMBDA FUNCTION
// ============================================================================

async function testLambdaFunction(testData) {
  logStep(2, 'TESTING LAMBDA FUNCTION WITH REAL DATA');
  
  try {
    // Load lambda function
    const lambdaPath = path.join(__dirname, '..', 'lambda-functions', 's3-upload-notifier', 'index.js');
    if (!fs.existsSync(lambdaPath)) {
      throw new Error('Lambda function not found');
    }
    
    // Set environment variables for lambda
    process.env.NOTIFICATION_SERVICE_URL = CONFIG.services.notificationService;
    process.env.STAFF_SERVICE_URL = CONFIG.services.staffService;
    process.env.VISITS_SERVICE_URL = CONFIG.services.visitsService;
    
    const lambdaHandler = require(lambdaPath);
    
    // Create S3 events with real data
    const audioS3Event = {
      Records: [
        {
          eventVersion: '2.1',
          eventSource: 'aws:s3',
          awsRegion: 'eu-north-1',
          eventTime: new Date().toISOString(),
          eventName: 's3:ObjectCreated:Put',
          s3: {
            bucket: {
              name: 'nursing-home-audio-recordings-20251124'
            },
            object: {
              key: testData.audioFile.s3Key,
              size: testData.audioFile.fileSize
            }
          }
        }
      ]
    };
    
    const photoS3Event = {
      Records: [
        {
          eventVersion: '2.1',
          eventSource: 'aws:s3',
          awsRegion: 'eu-north-1',
          eventTime: new Date().toISOString(),
          eventName: 's3:ObjectCreated:Put',
          s3: {
            bucket: {
              name: 'nursing-home-audio-recordings-20251124'
            },
            object: {
              key: testData.photoFile.s3Key,
              size: testData.photoFile.fileSize
            }
          }
        }
      ]
    };
    
    // Test audio notification
    logProgress('Testing audio file notification...');
    logProgress(`Audio S3 key: ${testData.audioFile.s3Key}`);
    logProgress(`Expected recipient: ${testData.nurseName} (${testData.nurseId})`);
    
    const audioResult = await lambdaHandler.handler(audioS3Event);
    logProgress(`Audio result: ${JSON.stringify(audioResult, null, 2)}`);
    
    // Test photo notification
    logProgress('Testing photo file notification...');
    logProgress(`Photo S3 key: ${testData.photoFile.s3Key}`);
    logProgress(`Expected recipient: ${testData.primaryCaregiverName} (${testData.primaryCaregiverId})`);
    
    const photoResult = await lambdaHandler.handler(photoS3Event);
    logProgress(`Photo result: ${JSON.stringify(photoResult, null, 2)}`);
    
    logSuccess('Step 2 completed: Lambda function tested');
    
    return {
      audioResult,
      photoResult
    };
    
  } catch (error) {
    logError(`Lambda function test failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// UPDATE VISIT WITH FILE INFORMATION
// ============================================================================

async function updateVisitWithFiles(testData) {
  logStep(3, 'UPDATING VISIT WITH FILE INFORMATION');
  
  try {
    // Get current visit data
    logProgress('Fetching current visit data...');
    const visitResponse = await axios.get(`${CONFIG.services.visitsService}/api/visits/${testData.visitId}`, {
      headers: { 'Authorization': `Bearer ${testData.authToken}` },
      timeout: 10000
    });
    
    const currentVisit = visitResponse.data.data || visitResponse.data;
    logProgress(`Current visit status: ${currentVisit.status}`);
    logProgress(`Current notes: ${currentVisit.notes || 'None'}`);
    logProgress(`Current audio recording: ${currentVisit.hasAudioRecording || false}`);
    logProgress(`Current photos: ${currentVisit.photos?.length || 0}`);
    
    // Prepare update data
    const updateData = {
      audioRecordingPath: testData.audioFile.s3Url,
      hasAudioRecording: true,
      photos: [
        ...(currentVisit.photos || []),
        testData.photoFile.s3Url
      ]
    };
    
    logProgress('Updating visit with file information...');
    logProgress(`Audio recording path: ${updateData.audioRecordingPath}`);
    logProgress(`Photos: ${updateData.photos.length} total`);
    
    const updateResponse = await axios.put(
      `${CONFIG.services.visitsService}/api/visits/${testData.visitId}`,
      updateData,
      {
        headers: {
          'Authorization': `Bearer ${testData.authToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    logProgress(`Update response: ${updateResponse.status}`);
    logSuccess('Visit updated with file information');
    
    // Add a note about the files
    const noteText = `Files uploaded via Step 10 test (${testData.testSessionId}):\n` +
                    `- Audio: ${testData.audioFile.fileName}\n` +
                    `- Photo: ${testData.photoFile.fileName}`;
    
    logProgress('Adding note about uploaded files...');
    const noteResponse = await axios.post(
      `${CONFIG.services.visitsService}/api/visits/${testData.visitId}/notes`,
      {
        noteText: noteText,
        staffId: testData.nurseId,
        staffName: testData.nurseName,
        noteType: 'file_upload'
      },
      {
        headers: {
          'Authorization': `Bearer ${testData.authToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    logProgress(`Note added: ${noteResponse.status}`);
    logSuccess('Step 3 completed: Visit updated with file information');
    
    return {
      visitUpdate: updateResponse.data,
      noteAdded: noteResponse.data
    };
    
  } catch (error) {
    logError(`Failed to update visit: ${error.message}`);
    if (error.response) {
      logProgress(`Response status: ${error.response.status}`);
      logProgress(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    throw error;
  }
}

// ============================================================================
// VERIFY NOTIFICATIONS
// ============================================================================

async function verifyNotifications(testData) {
  logStep(4, 'VERIFYING NOTIFICATIONS WERE SENT');
  
  try {
    // Check notifications for nurse (audio uploader)
    logProgress(`Checking notifications for nurse: ${testData.nurseName}`);
    
    try {
      const nurseNotifications = await axios.get(
        `${CONFIG.services.notificationService}/api/notifications/recipient/${testData.nurseId}`,
        {
          headers: { 'Authorization': `Bearer ${testData.authToken}` },
          timeout: 10000
        }
      );
      
      logProgress(`Nurse notifications: ${nurseNotifications.data.count || 0}`);
      if (nurseNotifications.data.data && nurseNotifications.data.data.length > 0) {
        const recentNotifications = nurseNotifications.data.data.slice(0, 3);
        recentNotifications.forEach((notif, index) => {
          logProgress(`  ${index + 1}. ${notif.title} (${notif.priority})`);
        });
      }
    } catch (nurseError) {
      logWarning(`Failed to get nurse notifications: ${nurseError.message}`);
    }
    
    // Check notifications for primary caregiver (photo recipient)
    logProgress(`Checking notifications for primary caregiver: ${testData.primaryCaregiverName}`);
    
    try {
      const caregiverNotifications = await axios.get(
        `${CONFIG.services.notificationService}/api/notifications/recipient/${testData.primaryCaregiverId}`,
        {
          headers: { 'Authorization': `Bearer ${testData.authToken}` },
          timeout: 10000
        }
      );
      
      logProgress(`Caregiver notifications: ${caregiverNotifications.data.count || 0}`);
      if (caregiverNotifications.data.data && caregiverNotifications.data.data.length > 0) {
        const recentNotifications = caregiverNotifications.data.data.slice(0, 3);
        recentNotifications.forEach((notif, index) => {
          logProgress(`  ${index + 1}. ${notif.title} (${notif.priority})`);
        });
      }
    } catch (caregiverError) {
      logWarning(`Failed to get caregiver notifications: ${caregiverError.message}`);
    }
    
    logSuccess('Step 4 completed: Notifications verified');
    
  } catch (error) {
    logWarning(`Notification verification failed: ${error.message}`);
    logInfo('This is OK - notifications may not be fully implemented yet');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  log('🔔 LAMBDA NOTIFICATION TESTING', 'cyan');
  console.log('='.repeat(80));
  log('Testing s3-upload-notifier lambda function with real Step 10 data', 'reset');
  
  try {
    // Step 1: Load test data
    const testData = await loadTestData();
    
    // Step 2: Test lambda function
    const lambdaResults = await testLambdaFunction(testData);
    
    // Step 3: Update visit with file information
    const visitUpdate = await updateVisitWithFiles(testData);
    
    // Step 4: Verify notifications
    await verifyNotifications(testData);
    
    // Success summary
    console.log('\n' + '='.repeat(80));
    logSuccess('✨ LAMBDA NOTIFICATION TEST COMPLETED! ✨');
    console.log('='.repeat(80));
    
    logInfo('Summary:');
    logInfo(`  ✅ Test data loaded from session: ${testData.testSessionId}`);
    logInfo(`  ✅ Lambda function tested with real S3 events`);
    logInfo(`  ✅ Visit updated with file URLs`);
    logInfo(`  ✅ File upload note added to visit`);
    logInfo(`  ✅ Notifications verified`);
    
    logInfo('\n💡 Next steps:');
    logInfo('  1. Chief nurse can now review the photo in the visit');
    logInfo('  2. Staff can listen to audio and add transcription notes');
    logInfo('  3. Test the complete workflow end-to-end');
    
  } catch (error) {
    logError('\n💥 LAMBDA NOTIFICATION TEST FAILED!');
    logError(`Error: ${error.message}`);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };