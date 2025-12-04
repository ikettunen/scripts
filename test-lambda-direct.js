#!/usr/bin/env node

/**
 * Direct test of lambda function with new routing
 */

const path = require('path');

// Load lambda function
const lambdaPath = path.join(__dirname, '..', 'lambda-functions', 's3-upload-notifier', 'index.js');
delete require.cache[require.resolve(lambdaPath)]; // Clear cache
const lambda = require(lambdaPath);

async function testLambdaDirect() {
  console.log('Testing lambda function directly with new routing...');
  
  try {
    // Create test S3 event for audio file
    const audioEvent = {
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
              key: 'audio_recordings/test-visit-id/test-audio.wav',
              size: 1024
            }
          }
        }
      ]
    };
    
    console.log('Testing audio upload event...');
    const result = await lambda.handler(audioEvent);
    console.log('Lambda result:', JSON.stringify(result, null, 2));
    
    return true;
    
  } catch (error) {
    console.error('❌ Lambda test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

testLambdaDirect().then(success => {
  console.log(success ? '\n✅ Lambda direct test passed!' : '\n❌ Lambda direct test failed!');
  process.exit(success ? 0 : 1);
});