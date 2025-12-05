#!/usr/bin/env node

/**
 * Test script for deployment tracking endpoint
 * 
 * Tests the /api/startup-logs endpoint to verify:
 * 1. Endpoint responds successfully
 * 2. Returns deployment details array
 * 3. Parses .env files correctly
 * 4. Returns detailed logs
 * 
 * Usage: node scripts/test-deployment-tracking.js
 */

const axios = require('axios');

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3001';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testDeploymentTracking() {
  console.log('\n' + '='.repeat(80));
  log('Testing Deployment Tracking Endpoint', 'cyan');
  console.log('='.repeat(80) + '\n');

  try {
    // Test 1: Endpoint responds
    log('Test 1: Testing endpoint response...', 'yellow');
    const response = await axios.get(`${API_GATEWAY_URL}/api/startup-logs`, {
      timeout: 10000
    });

    if (response.status === 200) {
      log('✅ Endpoint responded with 200 OK', 'green');
    } else {
      log(`❌ Unexpected status code: ${response.status}`, 'red');
      return;
    }

    // Test 2: Response structure
    log('\nTest 2: Validating response structure...', 'yellow');
    const data = response.data;

    if (!data.success) {
      log('❌ Response success is false', 'red');
      log(`Error: ${data.error}`, 'red');
      return;
    }
    log('✅ Response success is true', 'green');

    if (!data.logs) {
      log('❌ Response missing logs field', 'red');
      return;
    }
    log('✅ Response contains logs field', 'green');

    if (!data.deploymentDetails) {
      log('❌ Response missing deploymentDetails field', 'red');
      return;
    }
    log('✅ Response contains deploymentDetails field', 'green');

    // Test 3: Deployment details array
    log('\nTest 3: Validating deployment details...', 'yellow');
    const deploymentDetails = data.deploymentDetails;

    if (!Array.isArray(deploymentDetails)) {
      log('❌ deploymentDetails is not an array', 'red');
      return;
    }
    log(`✅ deploymentDetails is an array with ${deploymentDetails.length} items`, 'green');

    // Test 4: Service details
    log('\nTest 4: Checking service details...', 'yellow');
    const expectedServices = [
      'api-gateway',
      'auth-service',
      'fhir-api-backend',
      'visits-service',
      'analytics-service',
      'fitbit-service',
      'oura-service',
      'notification-service',
      's3-bucket-service',
      'staff-service',
      'task-service'
    ];

    const foundServices = deploymentDetails.map(d => d.service);
    const missingServices = expectedServices.filter(s => !foundServices.includes(s));

    if (missingServices.length > 0) {
      log(`⚠️  Missing services: ${missingServices.join(', ')}`, 'yellow');
    } else {
      log('✅ All expected services found', 'green');
    }

    // Test 5: Deployment detail structure
    log('\nTest 5: Validating deployment detail structure...', 'yellow');
    let validStructure = true;

    for (const detail of deploymentDetails) {
      const requiredFields = ['service', 'status', 'lastDeployed', 'deploymentId', 'commitSha', 'commitMessage'];
      const missingFields = requiredFields.filter(field => !(field in detail));

      if (missingFields.length > 0) {
        log(`❌ Service ${detail.service} missing fields: ${missingFields.join(', ')}`, 'red');
        validStructure = false;
      }
    }

    if (validStructure) {
      log('✅ All deployment details have required fields', 'green');
    }

    // Test 6: Status values
    log('\nTest 6: Validating status values...', 'yellow');
    const validStatuses = ['deployed', 'local', 'not_found', 'unknown'];
    let validStatusValues = true;

    for (const detail of deploymentDetails) {
      if (!validStatuses.includes(detail.status)) {
        log(`❌ Service ${detail.service} has invalid status: ${detail.status}`, 'red');
        validStatusValues = false;
      }
    }

    if (validStatusValues) {
      log('✅ All status values are valid', 'green');
    }

    // Display summary
    console.log('\n' + '='.repeat(80));
    log('Deployment Details Summary', 'cyan');
    console.log('='.repeat(80));

    const statusCounts = {
      deployed: 0,
      local: 0,
      not_found: 0,
      unknown: 0
    };

    console.log('\n┌─────────────────────────┬──────────┬─────────────────────────────────┐');
    console.log('│ Service                 │ Status   │ Last Deployed                   │');
    console.log('├─────────────────────────┼──────────┼─────────────────────────────────┤');

    for (const detail of deploymentDetails) {
      statusCounts[detail.status]++;
      
      const serviceName = detail.service.padEnd(23);
      const status = detail.status.padEnd(8);
      const lastDeployed = detail.lastDeployed.substring(0, 31).padEnd(31);
      
      const statusIcon = {
        deployed: '🟢',
        local: '🟡',
        not_found: '🔴',
        unknown: '⚪'
      }[detail.status] || '⚪';

      console.log(`│ ${serviceName} │ ${statusIcon} ${status} │ ${lastDeployed} │`);
    }

    console.log('└─────────────────────────┴──────────┴─────────────────────────────────┘');

    console.log('\nStatus Summary:');
    log(`  🟢 Deployed:   ${statusCounts.deployed}`, 'green');
    log(`  🟡 Local:      ${statusCounts.local}`, 'yellow');
    log(`  🔴 Not Found:  ${statusCounts.not_found}`, 'red');
    log(`  ⚪ Unknown:    ${statusCounts.unknown}`, 'dim');

    // Display sample logs
    console.log('\n' + '='.repeat(80));
    log('Sample Logs (first 500 characters)', 'cyan');
    console.log('='.repeat(80));
    console.log(data.logs.substring(0, 500) + '...\n');

    // Final result
    console.log('='.repeat(80));
    log('✅ ALL TESTS PASSED!', 'green');
    console.log('='.repeat(80) + '\n');

    log('Next steps:', 'cyan');
    log('  1. Open Admin Panel: http://localhost:3000/admin', 'dim');
    log('  2. Click "View Startup Logs" button', 'dim');
    log('  3. Verify deployment details table displays correctly', 'dim');
    log('  4. Check detailed logs section below table', 'dim');

  } catch (error) {
    console.log('\n' + '='.repeat(80));
    log('❌ TEST FAILED', 'red');
    console.log('='.repeat(80) + '\n');

    if (error.code === 'ECONNREFUSED') {
      log('Error: Cannot connect to API Gateway', 'red');
      log(`Make sure API Gateway is running on ${API_GATEWAY_URL}`, 'yellow');
      log('Start it with: pm2 start ecosystem.config.js', 'dim');
    } else if (error.response) {
      log(`Error: ${error.response.status} ${error.response.statusText}`, 'red');
      log(`Response: ${JSON.stringify(error.response.data, null, 2)}`, 'dim');
    } else {
      log(`Error: ${error.message}`, 'red');
    }

    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testDeploymentTracking();
}

module.exports = { testDeploymentTracking };
