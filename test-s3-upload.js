#!/usr/bin/env node

/**
 * Quick S3 Upload Test
 * Tests if the S3 configuration is working after restart
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  services: {
    authService: 'http://localhost:3002',
    s3BucketService: 'http://localhost:3009'
  },
  auth: {
    email: 'maria.nieminen@hoitokoti.fi',
    password: 'nursing123'
  }
};

async function testS3Upload() {
  console.log('🧪 Quick S3 Upload Test');
  console.log('='.repeat(40));
  
  try {
    // 1. Authenticate
    console.log('1. Authenticating...');
    const authResponse = await axios.post(`${CONFIG.services.authService}/api/auth/login`, CONFIG.auth);
    const authToken = authResponse.data.data.token;
    console.log('✅ Authenticated');
    
    // 2. Get presigned URL
    console.log('2. Getting presigned URL...');
    const presignedResponse = await axios.post(
      `${CONFIG.services.s3BucketService}/api/uploads/presigned-url`,
      {
        fileName: 'quick-test.wav',
        contentType: 'audio/wav',
        visitId: 'test-visit-quick',
        patientId: 'test-patient-quick',
        staffId: 'staff-1001',
        recordingType: 'visit_note',
        tags: ['quick-test']
      },
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );
    
    const { uploadUrl, s3Key } = presignedResponse.data.data;
    console.log('✅ Presigned URL generated');
    console.log(`   S3 Key: ${s3Key}`);
    console.log(`   Upload URL: ${uploadUrl.substring(0, 100)}...`);
    
    // 3. Test upload
    console.log('3. Testing upload...');
    const testData = Buffer.from('test audio data');
    
    const uploadResponse = await axios.put(uploadUrl, testData, {
      headers: { 'Content-Type': 'audio/wav' },
      timeout: 10000
    });
    
    console.log(`✅ Upload successful! Status: ${uploadResponse.status}`);
    
    // 4. Confirm upload
    console.log('4. Confirming upload...');
    const confirmResponse = await axios.post(
      `${CONFIG.services.s3BucketService}/api/uploads/confirm`,
      {
        s3Key,
        fileSize: testData.length,
        uploadedBy: 'staff-1001'
      },
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );
    
    console.log('✅ Upload confirmed');
    console.log(`   Data ID: ${confirmResponse.data.data.dataId}`);
    
    console.log('\n🎉 S3 Upload Test PASSED!');
    console.log('The S3 configuration is working correctly.');
    
  } catch (error) {
    console.log('\n❌ S3 Upload Test FAILED!');
    console.log(`Error: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

testS3Upload();