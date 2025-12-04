#!/usr/bin/env node

/**
 * SIMPLE STAFF SYNC TEST
 * 
 * This script tests just the staff synchronization to isolate the issue.
 * Run from project root: node scripts/test-staff-sync.js
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', 'fhir-api-backend', '.env') });

const CONFIG = {
  mysql: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nursing_home_db'
  }
};

// All 19 Oracle staff data (from 02_seed_data.sql)
const TEST_STAFF = [
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

async function testStaffSync() {
  console.log('🧪 Testing Staff Sync...');
  
  let connection = null;
  
  try {
    // Connect to MySQL
    console.log('Connecting to MySQL...');
    connection = await mysql.createConnection(CONFIG.mysql);
    console.log('✅ Connected');
    
    // Check current staff count
    const [beforeRows] = await connection.execute('SELECT COUNT(*) as count FROM staff');
    console.log(`Staff before sync: ${beforeRows[0].count}`);
    
    // Sync test staff
    let syncedCount = 0;
    
    for (const employee of TEST_STAFF) {
      const { employeeId, firstName, lastName, email, phone, hireDate, jobId } = employee;
      
      console.log(`Processing: ${employeeId} - ${firstName} ${lastName}`);
      
      try {
        // Role mapping
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
        
        const role = roleMapping[jobId] || 'Staff';
        const department = ['DOCTOR'].includes(jobId) ? 'Medical' : 
                          ['NURSE', 'PRAC_NURSE', 'HEAD_NURSE'].includes(jobId) ? 'Nursing' :
                          ['PHYSIO', 'PSYCHO', 'SOCIAL_WRK'].includes(jobId) ? 'Therapy' :
                          'Support';
        
        // Insert staff record
        await connection.execute(`
          INSERT INTO staff (
            id, employee_id, first_name, last_name, role, department, 
            email, phone, hire_date, status, password_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            role = VALUES(role)
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
          '$2a$10$defaulthash'
        ]);
        
        syncedCount++;
        console.log(`  ✅ S${employeeId} - ${firstName} ${lastName}`);
        
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    }
    
    // Check final staff count
    const [afterRows] = await connection.execute('SELECT COUNT(*) as count FROM staff');
    console.log(`Staff after sync: ${afterRows[0].count}`);
    
    // Show staff with S prefix
    const [staffRows] = await connection.execute(`
      SELECT id, first_name, last_name, role 
      FROM staff 
      WHERE id LIKE 'S%' 
      ORDER BY id
    `);
    
    console.log('\nStaff with S prefix:');
    staffRows.forEach(staff => {
      console.log(`  ${staff.id}: ${staff.first_name} ${staff.last_name} - ${staff.role}`);
    });
    
    console.log(`\n✅ Test completed: ${syncedCount} staff synced`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testStaffSync();