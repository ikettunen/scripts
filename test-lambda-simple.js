#!/usr/bin/env node

/**
 * SIMPLE LAMBDA TEST
 * Tests just the lambda function with one file
 */

const path = require('path');

async function testLambda() {
  console.log('🧪 Testing Lambda Function');
  
  try {
    // Set environment variables
    process.env.NOTIFICATION_SERVICE_URL = 'http://localhost:3006/api/notifications';
    process.env.STAFF_SERVICE_URL = 'http://localhost:6001/api/staff';
    process.env.VISITS_SERVICE_URL = 'http://localhost:3008/api/visits';
    process.env.S3_BUCKET_SERVICE_URL = 'http://localhost:3009';
    
    // Load lambda function
    const lambdaHandler = require('../lambda-functions/s3-upload-notifier/index.js');
    
    // Create test S3 event
    const testEvent = {
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
              key: 'audio_recordings/a0bae7b8-bf7a-468b-9482-c69348731f34/1764772348541_cb30492a-7abe-406b-989c-e554d097bc99.wav',
              size: 40
            }
          }
        }
      ]
    };
    
    console.log('Testing audio file event...');
    const result = await lambdaHandler.handler(testEvent);
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testLambda();