#!/usr/bin/env node

/**
 * STAFF SYNC FIX SCRIPT
 * 
 * This script fixes the staff synchronization issue by directly creating
 * staff records in MySQL FHIR database using the known Oracle HR data structure.
 * 
 * Run from project root: node scripts/fix-staff-sync.js
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', 'fhir-api-backend', '.env') });

// Configuration
const CONFIG = {
  mysql: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nursing_home_db',
    multipleStatements: true
  }
};

// Oracle HR staff data (from 02_seed_data.sql)
const ORACLE_STAFF_DATA = [
  { employeeId: 1001, firstName: 'Anna', lastName: 'Virtanen', email: 'anna.virtanen@hoitokoti.fi', phone: '040-1234567', hireDate: '2020-01-15', jobId: 'NURSE', salary: 3800 },
  { employeeId: 1002, firstName: 'Liisa', lastName: 'Korhonen', email: 'liisa.korhonen@hoitokoti.fi', phone: '040-2345678', hireDate: '2019-03-20', jobId: 'PRAC_NURSE', salary: 3000 },
  { employeeId: 1003, firstName: 'Jukka', lastName: 'Mäkinen', email: 'jukka.makinen@hoitokoti.fi', phone: '040-3456789', hireDate: '2021-06-10', jobId: 'DOCTOR', salary: 7500 },
  { employeeId: 1004, firstName: 'Maria', lastName: 'Nieminen', email: 'maria.nieminen@hoitokoti.fi', phone: '040-4567890', hireDate: '2018-11-05', jobId: 'HEAD_NURSE', salary: 4500 },
  { employeeId: 1005, firstName: 'Pekka', lastName: 'Laine', email: 'pekka.laine@hoitokoti.fi', phone: '040-5678901', hireDate: '2017-02-14', jobId: 'PHYSIO', salary: 4000 },
  { employeeId: 1006, firstName: 'Sari', lastName: 'Koskinen', email: 'sari.koskinen@hoitokoti.fi', phone: '040-6789012', hireDate: '2022-04-01', jobId: 'NURSE', salary: 3600 },
  { employeeId: 1007, firstName: 'Mikko', lastName: 'Heikkinen', email: 'mikko.heikkinen@hoitokoti.fi', phone: '040-7890123', hireDate: '2020-08-22', jobId: 'PRAC_NURSE', salary: 2800 },
  { employeeId: 1008, firstName: 'Kaisa', lastName: 'Järvinen', email: 'kaisa.jarvinen@hoitokoti.fi', phone: '040-8901234', hireDate: '2019-12-10', jobId: 'PSYCHO', salary: 4200 },
  { employeeId: 1009, firstName: 'Timo', lastName: 'Lehtonen', email: 'timo.lehtonen@hoitokoti.fi', phone: '040-9012345', hireDate: '2015-05-18', jobId: 'DOCTOR', salary: 8500 },
  { employeeId: 1010, firstName: 'Hanna', lastName: 'Salo', email: 'hanna.salo@hoitokoti.fi', phone: '040-0123456', hireDate: '2021-09-30', jobId: 'SOCIAL_WRK', salary: 3800 },
  { employeeId: 1011, firstName: 'Juha', lastName: 'Rantanen', email: 'juha.rantanen@hoitokoti.fi', phone: '040-1122334', hireDate: '2020-07-12', jobId: 'PHARMACIST', salary: 4200 },
  { employeeId: 1012, firstName: 'Maija', lastName: 'Tuominen', email: 'maija.tuominen@hoitokoti.fi', phone: '040-2233445', hireDate: '2018-03-25', jobId: 'RADIOLOG', salary: 3900 },
  { employeeId: 1013, firstName: 'Eero', lastName: 'Laaksonen', email: 'eero.laaksonen@hoitokoti.fi', phone: '040-3344556', hireDate: '2022-01-10', jobId: 'NURSE', salary: 3500 },
  { employeeId: 1014, firstName: 'Pirjo', lastName: 'Mäkelä', email: 'pirjo.makela@hoitokoti.fi', phone: '040-4455667', hireDate: '2019-07-22', jobId: 'PRAC_NURSE', salary: 3100 },
  { employeeId: 1015, firstName: 'Laura', lastName: 'Virtamo', email: 'laura.virtamo@hoitokoti.fi', phone: '040-5566778', hireDate: '2023-02-15', jobId: 'NURSE', salary: 3700 },
  { employeeId: 1016, firstName: 'Mika', lastName: 'Saarinen', email: 'mika.saarinen@hoitokoti.fi', phone: '040-6677889', hireDate: '2023-03-20', jobId: 'NURSE', salary: 3650 },
  { employeeId: 1017, firstName: 'Tiina', lastName: 'Aho', email: 'tiina.aho@hoitokoti.fi', phone: '040-7788990', hireDate: '2023-04-10', jobId: 'NURSE', salary: 3600 },
  { employeeId: 1018, firstName: 'Kari', lastName: 'Mäenpää', email: 'kari.maenpaa@hoitokoti.fi', phone: '040-8899001', hireDate: '2022-11-01', jobId: 'JANITOR', salary: 2900 },
  { employeeId: 1019, firstName: 'Tuula', lastName: 'Virtanen', email: 'tuula.virtanen@hoitokoti.fi', phone: '040-9900112', hireDate: '2021-08-15', jobId: 'COOK', salary: 3000 }
];

// Colors for console output
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

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logProgress(message) {
  log(`   ${message}`, 'reset');
}

async function main() {
  console.log('\n' + '='.repeat(80));
  log('🔧 STAFF SYNC FIX SCRIPT', 'cyan');
  console.log('='.repeat(80));
  log('This script fixes staff synchronization by directly creating MySQL records', 'reset');
  console.log('='.repeat(80));

  let mysqlConnection = null;

  try {
    // Connect to MySQL
    logProgress('Connecting to MySQL...');
    mysqlConnection = await mysql.createConnection(CONFIG.mysql);
    logSuccess('Connected to MySQL');

    // Job ID to role mapping
    const roleMapping = {
      'NURSE': 'Nurse',
      'PRAC_NURSE': 'Practical Nurse', 
      'DOCTOR': 'Doctor',
      'HEAD_NURSE': 'Head Nurse',
      'PHYSIO': 'Physiotherapist',
      'PSYCHO': 'Psychologist',
      'SOCIAL_WRK': 'Social Worker',
      'PHARMACIST': 'Pharmacist',
      'RADIOLOG': 'Radiographer',
      'JANITOR': 'Janitor',
      'COOK': 'Cook/Cleaner'
    };

    let syncedCount = 0;
    let errorCount = 0;

    logProgress(`Processing ${ORACLE_STAFF_DATA.length} Oracle HR staff records...`);

    for (const employee of ORACLE_STAFF_DATA) {
      const { employeeId, firstName, lastName, email, phone, hireDate, jobId, salary } = employee;
      
      logProgress(`Processing: ${employeeId} - ${firstName} ${lastName} (${jobId})`);

      try {
        const role = roleMapping[jobId] || 'Staff';
        const department = ['DOCTOR'].includes(jobId) ? 'Medical' : 
                          ['NURSE', 'PRAC_NURSE', 'HEAD_NURSE'].includes(jobId) ? 'Nursing' :
                          ['PHYSIO', 'PSYCHO', 'SOCIAL_WRK'].includes(jobId) ? 'Therapy' :
                          'Support';

        // Create FHIR Practitioner resource
        const fhirPractitioner = {
          resourceType: 'Practitioner',
          id: `S${employeeId}`,
          identifier: [
            { system: 'http://hoitokoti.fi/employee-id', value: employeeId.toString() },
            { system: 'http://valvira.fi/license', value: `VL${employeeId}` }
          ],
          active: true,
          name: [{ use: 'official', family: lastName, given: [firstName] }],
          telecom: [
            { system: 'phone', value: phone || '', use: 'work' },
            { system: 'email', value: email || '', use: 'work' }
          ],
          qualification: [
            {
              identifier: [{ value: `${jobId}${employeeId}` }],
              code: {
                coding: [{ system: 'http://hoitokoti.fi/job-codes', code: jobId, display: role }],
                text: role
              },
              issuer: { display: 'Sunrise Care Home' }
            }
          ]
        };

        // Insert or update staff record in MySQL
        await mysqlConnection.execute(`
          INSERT INTO staff (
            id, employee_id, first_name, last_name, role, department, 
            email, phone, hire_date, status, fhir_practitioner, password_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            role = VALUES(role),
            department = VALUES(department),
            email = VALUES(email),
            phone = VALUES(phone),
            fhir_practitioner = VALUES(fhir_practitioner)
        `, [
          `S${employeeId}`,
          employeeId,
          firstName,
          lastName,
          role,
          department,
          email,
          phone,
          hireDate,
          'active',
          JSON.stringify(fhirPractitioner),
          '$2a$10$defaulthash' // Default password hash
        ]);

        syncedCount++;
        logProgress(`  ✓ ${firstName} ${lastName} (S${employeeId}) - ${role}`);

      } catch (error) {
        errorCount++;
        logProgress(`  ✗ Failed: ${error.message}`);
      }
    }

    // Verify results
    logProgress('\nVerifying staff records...');
    const [staffRows] = await mysqlConnection.execute('SELECT COUNT(*) as count FROM staff');
    const totalStaff = staffRows[0].count;

    logSuccess(`Staff sync fix completed!`);
    logInfo(`Oracle staff synced: ${syncedCount}`);
    logInfo(`Errors: ${errorCount}`);
    logInfo(`Total staff in MySQL: ${totalStaff}`);

    // Show some sample staff records
    const [sampleRows] = await mysqlConnection.execute(`
      SELECT id, first_name, last_name, role, department 
      FROM staff 
      WHERE id LIKE 'S%' 
      ORDER BY id 
      LIMIT 5
    `);

    if (sampleRows.length > 0) {
      logInfo('\nSample staff records:');
      sampleRows.forEach(staff => {
        logProgress(`  ${staff.id}: ${staff.first_name} ${staff.last_name} - ${staff.role} (${staff.department})`);
      });
    }

  } catch (error) {
    logError(`Staff sync fix failed: ${error.message}`);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    if (mysqlConnection) {
      await mysqlConnection.end();
      logProgress('MySQL connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };