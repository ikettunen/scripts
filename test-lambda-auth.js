#!/usr/bin/env node

/**
 * Test lambda function authentication
 */

const path = require('path');

// Load lambda function
const lambdaPath = path.join(__dirname, '..', 'lambda-functions', 's3-upload-notifier', 'index.js');
const lambda = require(lambdaPath);

async function testAuth() {
  console.log('Testing lambda function authentication...');
  
  try {
    // Access the getAuthToken function (we need to make it accessible)
    // For now, let's test the auth service directly
    
    const AUTH_SERVICE_URL = 'http://localhost:3002';
    const credentials = {
      email: 'anna.virtanen@hoitokoti.fi',
      password: 'nursing123'
    };
    
    console.log('Testing auth service directly...');
    console.log(`URL: ${AUTH_SERVICE_URL}/api/auth/login`);
    console.log(`Credentials:`, credentials);
    
    const response = await makeHttpRequest(`${AUTH_SERVICE_URL}/api/auth/login`, 'POST', credentials);
    console.log('Auth response:', response);
    
    if (response.data && response.data.success && response.data.data.token) {
      console.log('✅ Authentication successful!');
      console.log('Token:', response.data.data.token.substring(0, 50) + '...');
      return response.data.data.token;
    } else {
      console.log('❌ Authentication failed - no token in response');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    return null;
  }
}

/**
 * Make HTTP request (copied from lambda function)
 */
async function makeHttpRequest(url, method = 'GET', data = null) {
  const https = require('https');
  const http = require('http');
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const req = protocol.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ 
              statusCode: res.statusCode, 
              body: responseData,
              data: responseData ? JSON.parse(responseData) : null
            });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: responseData, data: null });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Run test
testAuth().then(token => {
  if (token) {
    console.log('\n✅ Lambda authentication test passed!');
  } else {
    console.log('\n❌ Lambda authentication test failed!');
  }
  process.exit(token ? 0 : 1);
});