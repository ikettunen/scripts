#!/usr/bin/env node

/**
 * Simple notification service test
 */

const axios = require('axios');

async function testNotification() {
  console.log('Testing notification service with fresh token...');
  
  try {
    // Step 1: Get fresh token
    console.log('1. Getting fresh auth token...');
    const authResponse = await axios.post('http://localhost:3002/api/auth/login', {
      email: 'anna.virtanen@hoitokoti.fi',
      password: 'nursing123'
    });
    
    const token = authResponse.data.data.token;
    console.log('✅ Got token:', token.substring(0, 50) + '...');
    
    // Step 2: Test notification service
    console.log('2. Testing notification service...');
    const notification = {
      type: 'task',
      entityType: 'task',
      entityId: 'test-file-upload',
      title: 'Test Notification',
      message: 'This is a test notification',
      priority: 'normal',
      recipients: ['staff-1001'],
      metadata: {
        fileType: 'audio',
        filename: 'test.wav',
        visitId: 'test-visit-id',
        fileId: 'test-file-id'
      }
    };
    
    const notificationResponse = await axios.post('http://localhost:3006/api/notifications', notification, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Notification created:', notificationResponse.status);
    console.log('Response:', notificationResponse.data);
    
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

testNotification().then(success => {
  process.exit(success ? 0 : 1);
});