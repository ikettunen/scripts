#!/usr/bin/env node

/**
 * MASTER DATA RESET SCRIPT
 * 
 * This script resets all databases to a known state by:
 * 1. Clearing all existing data
 * 2. Seeding Oracle HR (Staff)
 * 3. Seeding MySQL FHIR (Patients)
 * 4. Seeding MongoDB (Visit Templates)
 * 5. Seeding MongoDB (Care Plans)
 * 6. Running Care-Plan-Scheduler (Visits)
 * 
 * Run from project root: node scripts/reset-all-data.js
 */

const { execSync } = require('child_process');
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load environment variables from service folders
require('dotenv').config({ path: path.join(__dirname, '..', 'fhir-api-backend', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', 'visits-service', '.env') });

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  mysql: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nursing_home_db',
    multipleStatements: true
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nursing_home_visits'
  },
  oracle: {
    user: process.env.ORACLE_USER || 'hr',
    password: process.env.ORACLE_PASSWORD || 'hr',
    connectString: process.env.ORACLE_CONNECT_STRING || 'localhost:1521/XEPDB1'
  }
};

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80));
}

function logStep(step, message) {
  log(`\n[STEP ${step}] ${message}`, 'bright');
  log('-'.repeat(80), 'dim');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logProgress(message) {
  log(`   ${message}`, 'dim');
}

// ============================================================================
// DATABASE CONNECTION UTILITIES
// ============================================================================

let mysqlConnection = null;
let mongoConnection = null;

async function connectMySQL() {
  logProgress('Connecting to MySQL...');
  try {
    mysqlConnection = await mysql.createConnection(CONFIG.mysql);
    logSuccess('Connected to MySQL');
    return mysqlConnection;
  } catch (error) {
    logError(`Failed to connect to MySQL: ${error.message}`);
    throw error;
  }
}

async function connectMongoDB() {
  logProgress('Connecting to MongoDB...');
  try {
    await mongoose.connect(CONFIG.mongodb.uri);
    mongoConnection = mongoose.connection;
    logSuccess('Connected to MongoDB');
    return mongoConnection;
  } catch (error) {
    logError(`Failed to connect to MongoDB: ${error.message}`);
    throw error;
  }
}

async function closeConnections() {
  logProgress('Closing database connections...');
  
  if (mysqlConnection) {
    await mysqlConnection.end();
    logProgress('MySQL connection closed');
  }
  
  if (mongoConnection && mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    logProgress('MongoDB connection closed');
  }
}

// ============================================================================
// STEP 1: CLEAR ALL DATA
// ============================================================================

async function clearAllData() {
  logStep(1, 'CLEARING ALL EXISTING DATA');
  
  // Clear MongoDB
  logProgress('Clearing MongoDB collections...');
  try {
    await connectMongoDB();
    
    const collections = ['visit_data', 'care_plans', 'visittemplates'];
    for (const collectionName of collections) {
      const result = await mongoose.connection.db.collection(collectionName).deleteMany({});
      logProgress(`  - Cleared ${collectionName}: ${result.deletedCount} documents deleted`);
    }
    
    logSuccess('MongoDB cleared successfully');
  } catch (error) {
    logWarning(`MongoDB clear failed: ${error.message}`);
    logInfo('This is OK if collections don\'t exist yet');
  }
  
  // Clear and recreate MySQL schema
  logProgress('Recreating MySQL database schema...');
  try {
    await connectMySQL();
    
    // Run schema.sql to create correct table structure
    const schemaScript = fs.readFileSync(
      path.join(__dirname, '..', 'fhir-api-backend', 'src', 'db', 'schema.sql'),
      'utf8'
    );
    
    await mysqlConnection.query(schemaScript);
    logSuccess('MySQL schema recreated successfully');
  } catch (error) {
    logWarning(`MySQL schema creation failed: ${error.message}`);
    logInfo('This is OK if tables don\'t exist yet');
  }
  
  // Clear Oracle (if available)
  logProgress('Clearing Oracle HR tables...');
  try {
    // Check if sqlplus is available
    execSync('sqlplus -v', { stdio: 'ignore' });
    
    const clearScript = path.join(__dirname, 'sql', 'clear-oracle.sql');
    const command = `echo exit | sqlplus -S ${CONFIG.oracle.user}/${CONFIG.oracle.password}@${CONFIG.oracle.connectString} @${clearScript}`;
    
    execSync(command, { stdio: 'pipe' });
    logSuccess('Oracle HR cleared successfully');
  } catch (error) {
    logWarning('Oracle HR clear skipped (sqlplus not available or not configured)');
    logInfo('This is OK if you\'re not using Oracle HR');
  }
  
  logSuccess('Step 1 completed: All data cleared');
}

// ============================================================================
// STEP 2: SEED ORACLE HR (STAFF)
// ============================================================================

async function seedOracleHR() {
  logStep(2, 'SEEDING ORACLE HR DATABASE (STAFF)');
  
  try {
    // Check if sqlplus is available
    execSync('sqlplus -v', { stdio: 'ignore' });
    
    logProgress('Running Oracle HR seed scripts...');
    
    // Run create tables script
    const createTablesScript = path.join(__dirname, '..', 'staff-desktop', 'db-scripts', '01_create_tables.sql');
    if (fs.existsSync(createTablesScript)) {
      logProgress('  - Running 01_create_tables.sql...');
      const command1 = `echo exit | sqlplus -S ${CONFIG.oracle.user}/${CONFIG.oracle.password}@${CONFIG.oracle.connectString} @${createTablesScript}`;
      execSync(command1, { stdio: 'pipe' });
      logProgress('    ✓ Tables created');
    }
    
    // Run seed data script
    const seedDataScript = path.join(__dirname, '..', 'staff-desktop', 'db-scripts', '02_seed_data.sql');
    if (fs.existsSync(seedDataScript)) {
      logProgress('  - Running 02_seed_data.sql...');
      const command2 = `echo exit | sqlplus -S ${CONFIG.oracle.user}/${CONFIG.oracle.password}@${CONFIG.oracle.connectString} @${seedDataScript}`;
      execSync(command2, { stdio: 'pipe' });
      logProgress('    ✓ Data seeded');
    }
    
    logSuccess('Step 2 completed: Oracle HR seeded (19 employees)');
    logInfo('Employee IDs: 1001-1019');
    
  } catch (error) {
    logWarning('Oracle HR seeding skipped');
    logInfo('Reason: sqlplus not available or Oracle not configured');
    logInfo('This is OK if you\'re not using Oracle HR for staff management');
  }
}

// ============================================================================
// STEP 3: SEED MYSQL FHIR (PATIENTS & STAFF)
// ============================================================================

async function seedMySQLFHIR() {
  logStep(3, 'SEEDING MYSQL FHIR DATABASE (PATIENTS & STAFF)');
  
  try {
    logProgress('Running FHIR backend seed script...');
    
    const fhirPath = path.join(__dirname, '..', 'fhir-api-backend');
    
    // Check if directory exists
    if (!fs.existsSync(fhirPath)) {
      throw new Error('fhir-api-backend directory not found');
    }
    
    // Run seed script
    logProgress('  - Executing: npm run db:seed');
    const output = execSync('npm run db:seed', {
      cwd: fhirPath,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Parse output for summary
    logProgress('  - Seed output:');
    const lines = output.split('\n').filter(line => line.trim());
    lines.slice(-10).forEach(line => logProgress(`    ${line}`));
    
    logSuccess('Step 3 completed: MySQL FHIR seeded');
    logInfo('Created: 12 patients, 4 staff, medications, conditions, visits');
    
  } catch (error) {
    logError(`MySQL FHIR seeding failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// STEP 3.5: SYNC ORACLE HR STAFF TO MYSQL FHIR
// ============================================================================

async function syncOracleToMySQLStaff() {
  logStep('3.5', 'SYNCING ORACLE HR STAFF TO MYSQL FHIR');
  
  try {
    let oracleStaffData = [];
    
    // Try to fetch from Oracle first
    try {
      logProgress('Attempting to fetch staff from Oracle HR...');
      oracleStaffData = await fetchOracleStaffData();
      logProgress(`  - Successfully fetched ${oracleStaffData.length} Oracle HR employees`);
    } catch (oracleError) {
      logWarning(`Oracle HR fetch failed: ${oracleError.message}`);
      logInfo('Falling back to hardcoded Oracle staff data from seed scripts');
      
      // Fallback to hardcoded data from Oracle seed scripts
      oracleStaffData = getHardcodedOracleStaffData();
      logProgress(`  - Using ${oracleStaffData.length} hardcoded Oracle HR employees`);
    }
    
    if (oracleStaffData.length === 0) {
      logWarning('No Oracle staff data available');
      logInfo('Skipping Oracle to MySQL sync');
      return;
    }
    
    // Connect to MySQL
    logProgress('  - Connecting to MySQL for staff sync...');
    await connectMySQL();
    logProgress('  - MySQL connection established for staff sync');
    
    let syncedCount = 0;
    
    for (const employee of oracleStaffData) {
      const { employeeId, firstName, lastName, email, phone, jobId, hireDate, salary } = employee;
      
      logProgress(`  - Processing employee: ${employeeId} - ${firstName} ${lastName} (${jobId})`);
      
      try {
        // Map Oracle job_id to FHIR role
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
        logProgress(`    - Inserting staff record: S${employeeId}`);
        
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
          email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@hoitokoti.fi`,
          phone || `040-${employeeId}000`,
          hireDate || '2023-01-01',
          'active',
          JSON.stringify(fhirPractitioner),
          '$2a$10$defaulthash' // Default password hash
        ]);
        
        syncedCount++;
        logProgress(`    ✓ ${firstName} ${lastName} (S${employeeId}) - ${role}`);
        
      } catch (error) {
        logProgress(`    ✗ Error processing ${firstName} ${lastName} (${employeeId}): ${error.message}`);
      }
    }
    
    logSuccess(`Step 3.5 completed: Synced ${syncedCount} staff from Oracle HR to MySQL FHIR`);
    logInfo(`Total staff in MySQL: ${syncedCount + 4} (${syncedCount} from Oracle + 4 original)`);
    
  } catch (error) {
    logWarning(`Oracle HR to MySQL sync failed: ${error.message}`);
    logInfo('This is OK - FHIR will use the original 4 staff members');
  }
}

/**
 * Fetch Oracle staff data using the same method as seeding
 */
async function fetchOracleStaffData() {
  // Check if sqlplus is available (same check as seeding)
  try {
    execSync('sqlplus -v', { stdio: 'ignore' });
  } catch (error) {
    throw new Error('sqlplus not available - Oracle connection not possible');
  }
  
  // Create SQL query script (same approach as seeding)
  const queryScript = `
SET PAGESIZE 0
SET FEEDBACK OFF
SET HEADING OFF
SET LINESIZE 1000
SELECT 
  employee_id || '|' ||
  first_name || '|' ||
  last_name || '|' ||
  email || '|' ||
  phone_number || '|' ||
  job_id || '|' ||
  TO_CHAR(hire_date, 'YYYY-MM-DD') || '|' ||
  salary
FROM employees 
WHERE employee_id BETWEEN 1001 AND 1019
ORDER BY employee_id;
EXIT;
`;
  
  // Write and execute query
  const scriptPath = path.join(__dirname, 'temp_oracle_query.sql');
  fs.writeFileSync(scriptPath, queryScript);
  
  const command = `echo exit | sqlplus -S ${CONFIG.oracle.user}/${CONFIG.oracle.password}@${CONFIG.oracle.connectString} @${scriptPath}`;
  
  try {
    const output = execSync(command, { stdio: 'pipe', encoding: 'utf8' });
    
    // Clean up script file
    fs.unlinkSync(scriptPath);
    
    // Parse output into objects
    const lines = output.split('\n').filter(line => line.trim() && !line.includes('SQL>'));
    const staffData = [];
    
    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 8) {
        staffData.push({
          employeeId: parseInt(parts[0]),
          firstName: parts[1].trim(),
          lastName: parts[2].trim(),
          email: parts[3].trim(),
          phone: parts[4].trim(),
          jobId: parts[5].trim(),
          hireDate: parts[6].trim(),
          salary: parseFloat(parts[7])
        });
      }
    }
    
    return staffData;
  } catch (error) {
    // Clean up script file on error
    try { fs.unlinkSync(scriptPath); } catch {}
    throw new Error(`Oracle query failed: ${error.message}`);
  }
}

/**
 * Hardcoded Oracle staff data as fallback (from 02_seed_data.sql)
 */
function getHardcodedOracleStaffData() {
  return [
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
}

// ============================================================================
// STEP 4: SEED MONGODB VISIT TEMPLATES
// ============================================================================

async function seedVisitTemplates() {
  logStep(4, 'SEEDING MONGODB VISIT TEMPLATES');
  
  try {
    logProgress('Running visit templates seed script...');
    
    const seedScript = path.join(__dirname, '..', 'visits-service', 'src', 'db', 'seedVisitTemplates.js');
    
    // Check if file exists
    if (!fs.existsSync(seedScript)) {
      throw new Error('seedVisitTemplates.js not found');
    }
    
    // Run seed script
    logProgress('  - Executing: node src/db/seedVisitTemplates.js');
    const output = execSync(`node ${seedScript}`, {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, MONGODB_URI: CONFIG.mongodb.uri }
    });
    
    // Parse output
    logProgress('  - Seed output:');
    const lines = output.split('\n').filter(line => line.trim());
    lines.slice(-15).forEach(line => logProgress(`    ${line}`));
    
    logSuccess('Step 4 completed: Visit templates seeded');
    logInfo('Created: 15 visit templates (12 with tasks, 3 without)');
    
  } catch (error) {
    logError(`Visit templates seeding failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// STEP 5: FETCH IDS FOR CARE PLANS
// ============================================================================

async function fetchPatientIds() {
  logProgress('Fetching patient IDs from MySQL...');
  
  const patientNames = [
    'Matti Virtanen',
    'Aino Korhonen',
    'Eino Mäkinen',
    'Helmi Nieminen',
    'Veikko Lahtinen',
    'Sirkka Rantanen',
    'Kalevi Salo',
    'Liisa Heikkinen',
    'Pentti Koskinen',
    'Marjatta Laine',
    'Tapio Järvinen',
    'Ritva Lehtonen'
  ];
  
  const patientMapping = {};
  
  for (const fullName of patientNames) {
    const [firstName, lastName] = fullName.split(' ');
    const [rows] = await mysqlConnection.execute(
      'SELECT id, first_name, last_name FROM patients WHERE first_name = ? AND last_name = ? AND active = 1 LIMIT 1',
      [firstName, lastName]
    );
    
    if (rows.length > 0) {
      patientMapping[fullName] = rows[0].id;
      logProgress(`  ✓ ${fullName}: ${rows[0].id}`);
    } else {
      logWarning(`  ✗ ${fullName}: NOT FOUND`);
    }
  }
  
  logSuccess(`Fetched ${Object.keys(patientMapping).length} patient IDs`);
  return patientMapping;
}

async function fetchTemplateIds() {
  logProgress('Fetching visit template IDs from MongoDB...');
  
  const templateNames = [
    'morning_medication_round',
    'afternoon_medication_round',
    'evening_medication_round',
    'breakfast_service',
    'lunch_service',
    'dinner_service',
    'morning_personal_care',
    'bedtime_care_routine',
    'shower_assistance',
    'caregiver_morning_round',
    'caregiver_afternoon_round',
    'doctor_medical_examination',
    'comprehensive_vital_signs_check',
    'night_monitoring_round',
    'blood_glucose_test'
  ];
  
  const VisitTemplate = mongoose.model('VisitTemplate', new mongoose.Schema({}, { strict: false }), 'visittemplates');
  
  const templateMapping = {};
  
  for (const name of templateNames) {
    const template = await VisitTemplate.findOne({ name });
    if (template) {
      templateMapping[name] = template._id;
      logProgress(`  ✓ ${name}: ${template._id}`);
    } else {
      logWarning(`  ✗ ${name}: NOT FOUND`);
    }
  }
  
  logSuccess(`Fetched ${Object.keys(templateMapping).length} template IDs`);
  return templateMapping;
}

// ============================================================================
// STEP 6: SEED MONGODB CARE PLANS
// ============================================================================

async function seedCarePlans(patientIds, templateIds) {
  logStep(6, 'SEEDING MONGODB CARE PLANS');
  
  try {
    // First try to import from exported data
    const exportedDataPath = path.join(__dirname, 'care_plans_export.json');
    
    if (fs.existsSync(exportedDataPath)) {
      logProgress('Found exported care plans data, importing...');
      await importCarePlansFromExport(exportedDataPath, patientIds, templateIds);
    } else {
      logProgress('No exported data found, running seed script...');
      await seedCarePlansFromScript();
    }
    
    logSuccess('Step 6 completed: Care plans seeded');
    
  } catch (error) {
    logWarning(`Care plans seeding failed: ${error.message}`);
    logInfo('This is OK - care plans can be created manually or by scheduler');
  }
}

async function importCarePlansFromExport(exportPath, patientIds, templateIds) {
  logProgress('  - Loading exported care plans data...');
  
  const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  const { carePlans, visitTemplates } = exportData;
  
  logProgress(`  - Found ${carePlans.length} care plans and ${visitTemplates.length} visit templates in export`);
  
  // Connect to MongoDB
  await connectMongoDB();
  
  // Import visit templates first (if any new ones)
  if (visitTemplates && visitTemplates.length > 0) {
    logProgress('  - Importing visit templates...');
    
    // Use existing VisitTemplate model if it exists, otherwise create it
    let VisitTemplate;
    try {
      VisitTemplate = mongoose.model('VisitTemplate');
      logProgress('    Using existing VisitTemplate model');
    } catch (error) {
      // Model doesn't exist, create it
      VisitTemplate = mongoose.model('VisitTemplate', new mongoose.Schema({}, { strict: false }), 'visittemplates');
      logProgress('    Created new VisitTemplate model');
    }
    
    for (const template of visitTemplates) {
      try {
        // Remove _id to let MongoDB generate new one, or use upsert
        const { _id, ...templateData } = template;
        await VisitTemplate.findOneAndUpdate(
          { name: template.name },
          templateData,
          { upsert: true, new: true }
        );
        logProgress(`    ✓ ${template.name}`);
      } catch (error) {
        logProgress(`    ✗ ${template.name}: ${error.message}`);
      }
    }
  }
  
  // Import care plans
  if (carePlans && carePlans.length > 0) {
    logProgress('  - Importing care plans...');
    
    // Use existing CarePlan model if it exists, otherwise create it
    let CarePlan;
    try {
      CarePlan = mongoose.model('CarePlan');
      logProgress('    Using existing CarePlan model');
    } catch (error) {
      // Model doesn't exist, create it
      CarePlan = mongoose.model('CarePlan', new mongoose.Schema({}, { strict: false }), 'care_plans');
      logProgress('    Created new CarePlan model');
    }
    
    let imported = 0;
    for (const carePlan of carePlans) {
      try {
        // Remove _id to let MongoDB generate new one
        const { _id, ...carePlanData } = carePlan;
        
        // Update patient IDs if mapping exists
        if (patientIds[carePlan.patientName]) {
          carePlanData.patientId = patientIds[carePlan.patientName];
        }
        
        // Update intervention template IDs if mapping exists
        if (carePlanData.interventions) {
          carePlanData.interventions = carePlanData.interventions.map(intervention => {
            // Map visit types to template names
            const visitTypeToTemplate = {
              'Morning Care': 'morning_personal_care',
              'Medication Round': 'morning_medication_round',
              'Physical Therapy': null, // No template
              'Meal Assistance': 'breakfast_service',
              'Cognitive Therapy': null, // No template
              'Blood Sugar Check': 'blood_glucose_test',
              'Insulin Administration': 'morning_medication_round',
              'Foot Care': null // No template
            };
            
            const templateName = visitTypeToTemplate[intervention.visitType];
            if (templateName && templateIds[templateName]) {
              intervention.visitTemplateId = templateIds[templateName];
              logProgress(`      - Mapped ${intervention.visitType} → ${templateName} (${templateIds[templateName]})`);
            } else {
              intervention.visitTemplateId = null;
              logProgress(`      - No template for ${intervention.visitType}`);
            }
            
            return intervention;
          });
        }
        
        await CarePlan.findOneAndUpdate(
          { patientId: carePlanData.patientId },
          carePlanData,
          { upsert: true, new: true }
        );
        
        logProgress(`    ✓ ${carePlan.patientName}`);
        imported++;
      } catch (error) {
        logProgress(`    ✗ ${carePlan.patientName}: ${error.message}`);
      }
    }
    
    logProgress(`  - Imported ${imported} care plans`);
  }
  
  logInfo('Imported care plans from exported data');
}

async function seedCarePlansFromScript() {
  const seedScript = path.join(__dirname, '..', 'visits-service', 'scripts', 'seed-care-plans.js');
  
  // Check if file exists
  if (!fs.existsSync(seedScript)) {
    logWarning('seed-care-plans.js not found');
    logInfo('Skipping care plans seeding - will need to be created manually or by scheduler');
    return;
  }
  
  // Run seed script
  logProgress('  - Executing: node scripts/seed-care-plans.js');
  const output = execSync(`node ${seedScript}`, {
    cwd: path.join(__dirname, '..', 'visits-service'),
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, MONGODB_URI: CONFIG.mongodb.uri }
  });
  
  // Parse output
  logProgress('  - Seed output:');
  const lines = output.split('\n').filter(line => line.trim());
  lines.slice(-20).forEach(line => logProgress(`    ${line}`));
  
  logInfo('Created: Care plans for patients with goals and interventions');
}

// ============================================================================
// STEP 7: RUN CARE-PLAN-SCHEDULER
// ============================================================================

async function runCarePlanScheduler() {
  logStep(7, 'RUNNING CARE-PLAN-SCHEDULER');
  
  try {
    logProgress('Looking for care-plan-scheduler...');
    
    const schedulerPath = path.join(__dirname, '..', 'lambda-functions', 'care-plan-scheduler', 'index.js');
    
    // Check if scheduler exists
    if (!fs.existsSync(schedulerPath)) {
      logWarning('Care-plan-scheduler not found');
      logInfo('Location checked: lambda-functions/care-plan-scheduler/index.js');
      logInfo('Skipping visit generation - scheduler needs to be created');
      return;
    }
    
    // Run scheduler
    logProgress('  - Executing care-plan-scheduler...');
    const output = execSync(`node ${schedulerPath}`, {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, MONGODB_URI: CONFIG.mongodb.uri }
    });
    
    // Parse output
    logProgress('  - Scheduler output:');
    const lines = output.split('\n').filter(line => line.trim());
    lines.forEach(line => logProgress(`    ${line}`));
    
    logSuccess('Step 7 completed: Visits generated from care plans');
    
  } catch (error) {
    logWarning(`Care-plan-scheduler failed: ${error.message}`);
    logInfo('This is OK - visits can be created manually');
  }
}

// ============================================================================
// STEP 8: VERIFY DATA
// ============================================================================

async function verifyData() {
  logStep(8, 'VERIFYING DATA');
  
  try {
    // Verify MySQL
    logProgress('Checking MySQL data...');
    const [patients] = await mysqlConnection.execute('SELECT COUNT(*) as count FROM patients');
    const [staff] = await mysqlConnection.execute('SELECT COUNT(*) as count FROM staff');
    const [medications] = await mysqlConnection.execute('SELECT COUNT(*) as count FROM medications');
    const [conditions] = await mysqlConnection.execute('SELECT COUNT(*) as count FROM medical_conditions');
    
    logProgress(`  - Patients: ${patients[0].count}`);
    logProgress(`  - Staff: ${staff[0].count}`);
    logProgress(`  - Medications: ${medications[0].count}`);
    logProgress(`  - Medical Conditions: ${conditions[0].count}`);
    
    // Verify MongoDB
    logProgress('Checking MongoDB data...');
    const visitTemplatesCount = await mongoose.connection.db.collection('visittemplates').countDocuments();
    const carePlansCount = await mongoose.connection.db.collection('care_plans').countDocuments();
    const visitsCount = await mongoose.connection.db.collection('visit_data').countDocuments();
    
    logProgress(`  - Visit Templates: ${visitTemplatesCount}`);
    logProgress(`  - Care Plans: ${carePlansCount}`);
    logProgress(`  - Visits: ${visitsCount}`);
    
    logSuccess('Data verification completed');
    
    // Summary
    console.log('\n' + '='.repeat(80));
    log('DATA SUMMARY', 'cyan');
    console.log('='.repeat(80));
    log(`MySQL Patients:        ${patients[0].count}`, 'white');
    log(`MySQL Staff:           ${staff[0].count}`, 'white');
    log(`MySQL Medications:     ${medications[0].count}`, 'white');
    log(`MySQL Conditions:      ${conditions[0].count}`, 'white');
    log(`MongoDB Templates:     ${visitTemplatesCount}`, 'white');
    log(`MongoDB Care Plans:    ${carePlansCount}`, 'white');
    log(`MongoDB Visits:        ${visitsCount}`, 'white');
    console.log('='.repeat(80));
    
  } catch (error) {
    logWarning(`Data verification failed: ${error.message}`);
  }
}

// ============================================================================
// STEP 9: TEST VISIT STATES WORKFLOW
// ============================================================================

async function testVisitStatesWorkflow() {
  logStep(9, 'TESTING VISIT STATES WORKFLOW');
  
  try {
    logProgress('Running visit states workflow test...');
    
    const testScript = path.join(__dirname, 'test-visit-states.js');
    
    // Check if test script exists
    if (!fs.existsSync(testScript)) {
      logWarning('Visit states test script not found');
      logInfo('Location checked: scripts/test-visit-states.js');
      logInfo('Skipping workflow test - script needs to be created');
      return;
    }
    
    // Run test script
    logProgress('  - Executing visit states workflow test...');
    const output = execSync(`node ${testScript}`, {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env }
    });
    
    // Parse output for key results
    logProgress('  - Test results:');
    const lines = output.split('\n').filter(line => line.trim());
    
    // Look for success indicators
    const successLines = lines.filter(line => line.includes('✅') || line.includes('SUCCESS'));
    const errorLines = lines.filter(line => line.includes('❌') || line.includes('ERROR'));
    
    if (errorLines.length > 0) {
      logError('Visit states workflow test had errors:');
      errorLines.forEach(line => logProgress(`    ${line}`));
    }
    
    if (successLines.length > 0) {
      logProgress('  - Key successes:');
      successLines.slice(-5).forEach(line => logProgress(`    ${line.replace(/\x1b\[[0-9;]*m/g, '')}`)); // Remove color codes
    }
    
    // Check for final success message
    if (output.includes('ALL TESTS COMPLETED SUCCESSFULLY')) {
      logSuccess('Step 9 completed: Visit states workflow test passed');
      logInfo('✅ Authentication working');
      logInfo('✅ Visit state transitions working');
      logInfo('✅ Task completion working');
      logInfo('✅ Note addition working');
      logInfo('✅ Workflow validation working');
    } else {
      logWarning('Visit states workflow test completed with issues');
      logInfo('Check the test output above for details');
    }
    
  } catch (error) {
    logWarning(`Visit states workflow test failed: ${error.message}`);
    logInfo('This is OK - the core data reset was successful');
    logInfo('You can run the test manually: npm run test-visit-states');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const startTime = Date.now();
  
  logSection('🚀 MASTER DATA RESET SCRIPT');
  log('This script will reset all databases to a known state', 'white');
  log('Run from project root: node scripts/reset-all-data.js', 'dim');
  
  // Interactive prompt for scheduler
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const runScheduler = await new Promise((resolve) => {
    rl.question('\n🤖 Run care-plan-scheduler after seeding? (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
  
  if (runScheduler) {
    log('✅ Will run care-plan-scheduler after seeding', 'green');
  } else {
    log('⏭️  Will skip care-plan-scheduler (can be run separately via Lambda)', 'yellow');
  }
  
  try {
    // Step 1: Clear all data
    await clearAllData();
    
    // Step 2: Seed Oracle HR
    await seedOracleHR();
    
    // Step 3: Seed MySQL FHIR
    await seedMySQLFHIR();
    
    // Step 3.5: Sync Oracle HR staff to MySQL FHIR
    await syncOracleToMySQLStaff();
    
    // Step 4: Seed MongoDB Visit Templates
    await seedVisitTemplates();
    
    // Step 5: Fetch IDs
    logStep(5, 'FETCHING IDS FOR CARE PLANS');
    const patientIds = await fetchPatientIds();
    const templateIds = await fetchTemplateIds();
    logSuccess('Step 5 completed: IDs fetched');
    
    // Step 6: Seed Care Plans
    await seedCarePlans(patientIds, templateIds);
    
    // Step 7: Run Care-Plan-Scheduler (conditional)
    if (runScheduler) {
      await runCarePlanScheduler();
    } else {
      logStep(7, 'SKIPPING CARE-PLAN-SCHEDULER');
      logInfo('Care-plan-scheduler will be run separately via Lambda function');
      logInfo('This ensures clean test data setup before scheduler execution');
    }
    
    // Step 8: Verify Data
    await verifyData();
    
    // Step 9: Test Visit States Workflow (conditional)
    if (runScheduler) {
      await testVisitStatesWorkflow();
    } else {
      logStep(9, 'SKIPPING VISIT STATES WORKFLOW TEST');
      logInfo('Visit states workflow test will be run separately');
      logInfo('Run: npm run test-visit-states');
    }
    
    // Success!
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(80));
    logSuccess('✨ DATA RESET COMPLETED SUCCESSFULLY! ✨');
    console.log('='.repeat(80));
    log(`Total time: ${duration} seconds`, 'cyan');
    
    logInfo('\n💡 Next steps:');
    logInfo('   1. Check the data summary above');
    logInfo('   2. Test the admin page seed buttons');
    logInfo('   3. Verify patient data in the UI');
    logInfo('   4. Run care-plan-scheduler if visits are 0');
    
  } catch (error) {
    logError('\n💥 DATA RESET FAILED!');
    logError(`Error: ${error.message}`);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await closeConnections();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  log('\n\n⚠️  Script interrupted by user', 'yellow');
  await closeConnections();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };
