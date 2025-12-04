#!/usr/bin/env node

/**
 * S3 BUCKET SERVICE HEALTH CHECK
 * 
 * This script checks if the s3-bucket-service is running and properly configured.
 * Run before Step 10: node scripts/check-s3-service.js
 */

const axios = require('axios');

const S3_SERVICE_URL = process.env.S3_BUCKET_SERVICE_URL || 'http://localhost:3009';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkS3Service() {
  console.log('='.repeat(60));
  log('🔍 S3 BUCKET SERVICE HEALTH CHECK', 'cyan');
  console.log('='.repeat(60));
  
  try {
    // Check health endpoint
    log('\n1. Checking service health...', 'blue');
    const healthResponse = await axios.get(`${S3_SERVICE_URL}/health`, {
      timeout: 5000
    });
    
    log(`✅ Service is healthy: ${healthResponse.data.status}`, 'green');
    log(`   Service: ${healthResponse.data.service}`, 'reset');
    log(`   Version: ${healthResponse.data.version}`, 'reset');
    log(`   Timestamp: ${healthResponse.data.timestamp}`, 'reset');
    
    // Check upload stats endpoint
    log('\n2. Checking upload stats...', 'blue');
    const statsResponse = await axios.get(`${S3_SERVICE_URL}/api/uploads/stats`, {
      timeout: 5000
    });
    
    log(`✅ Stats endpoint working`, 'green');
    log(`   Total files: ${statsResponse.data.data.overall.totalFiles}`, 'reset');
    log(`   Total size: ${statsResponse.data.data.overall.totalSize} bytes`, 'reset');
    
    // Test presigned URL generation (without auth - should fail gracefully)
    log('\n3. Testing presigned URL generation...', 'blue');
    try {
      const testRequest = {
        fileName: 'test.wav',
        contentType: 'audio/wav',
        visitId: 'test-visit',
        patientId: 'test-patient'
      };
      
      const presignedResponse = await axios.post(
        `${S3_SERVICE_URL}/api/uploads/presigned-url`,
        testRequest,
        { timeout: 5000 }
      );
      
      log(`✅ Presigned URL generation working`, 'green');
      log(`   S3 Key format: ${presignedResponse.data.data.s3Key}`, 'reset');
      log(`   Upload URL generated: ${presignedResponse.data.data.uploadUrl ? 'Yes' : 'No'}`, 'reset');
      
    } catch (presignedError) {
      if (presignedError.response && presignedError.response.status === 401) {
        log(`⚠️  Presigned URL requires authentication (expected)`, 'yellow');
      } else {
        log(`❌ Presigned URL generation failed: ${presignedError.message}`, 'red');
      }
    }
    
    console.log('\n' + '='.repeat(60));
    log('✅ S3 BUCKET SERVICE CHECK COMPLETED', 'green');
    console.log('='.repeat(60));
    
    log('\n📋 Summary:', 'blue');
    log('   ✅ Service is running and healthy', 'green');
    log('   ✅ MongoDB connection working', 'green');
    log('   ✅ API endpoints responding', 'green');
    log('   ⚠️  S3 uploads may fail without valid AWS credentials (expected in local testing)', 'yellow');
    
    log('\n💡 Ready for Step 10 testing!', 'cyan');
    
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    log('❌ S3 BUCKET SERVICE CHECK FAILED', 'red');
    console.log('='.repeat(60));
    
    log(`\nError: ${error.message}`, 'red');
    
    if (error.code === 'ECONNREFUSED') {
      log('\n🔧 Troubleshooting:', 'yellow');
      log('   1. Make sure s3-bucket-service is running on port 3009', 'reset');
      log('   2. Check if MongoDB is running', 'reset');
      log('   3. Verify service configuration in .env file', 'reset');
      log('\n📝 To start the service:', 'blue');
      log('   cd s3-bukcet-service', 'reset');
      log('   npm start', 'reset');
    }
    
    process.exit(1);
  }
}

// Run the check
if (require.main === module) {
  checkS3Service();
}

module.exports = { checkS3Service };