#!/usr/bin/env node

/**
 * Test the new notification routing system
 */

const axios = require('axios');

async function testNotificationRouting() {
  console.log('Testing notification routing with audio and photo types...');
  
  try {
    // Step 1: Get fresh token
    console.log('1. Getting fresh auth token...');
    const authResponse = await axios.post('http://localhost:3002/api/auth/login', {
      email: 'anna.virtanen@hoitokoti.fi',
      password: 'nursing123'
    });
    
    const token = authResponse.data.data.token;
    console.log('✅ Got token');
    
    // Step 2: Test audio notification
    console.log('2. Testing audio notification...');
    const audioNotification = {
      type: 'audio_upload',
      entityType: 'audio',
      entityId: 'audio-upload-test-123',
      title: 'Audio Recording Uploaded',
      message: 'Your audio recording has been uploaded. Please review and add notes.',
      priority: 'normal',
      recipients: ['staff-1001'],
      metadata: {
        fileType: 'audio',
        filename: 'test-audio.wav',
        requiresTranscription: true,
        actionRequired: true
      }
    };
    
    const audioResponse = await axios.post('http://localhost:3006/api/notifications', audioNotification, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Audio notification created:', audioResponse.status);
    console.log('Audio response:', audioResponse.data);
    
    // Step 3: Test photo notification
    console.log('3. Testing photo notification...');
    const photoNotification = {
      type: 'photo_upload',
      entityType: 'photo',
      entityId: 'photo-upload-test-456',
      title: 'Photo Uploaded',
      message: 'A new photo has been uploaded for review.',
      priority: 'normal',
      recipients: ['staff-1003'],
      metadata: {
        fileType: 'photo',
        filename: 'test-photo.jpg',
        requiresReview: true,
        actionRequired: false
      }
    };
    
    const photoResponse = await axios.post('http://localhost:3006/api/notifications', photoNotification, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Photo notification created:', photoResponse.status);
    console.log('Photo response:', photoResponse.data);
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return false;
  }
}

testNotificationRouting().then(success => {
  console.log(success ? '\n✅ Notification routing test passed!' : '\n❌ Notification routing test failed!');
  process.exit(success ? 0 : 1);
});