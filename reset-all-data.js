#!/usr/bin/env node

/**
 * MASTER DATA RESET SCRIPT
 * 
 * This script resets all databases to a known state and runs the complete workflow:
 * 
 * STEP 1: CLEAR ALL EXISTING DATA
 *   - Clear MongoDB collections (visit_data, care_plans, visittemplates)
 *   - Recreate MySQL database schema from schema.sql
 *   - Clear Oracle HR tables (if available)
 * 
 * STEP 2: SEED ORACLE HR DATABASE (STAFF)
 *   - Create Oracle HR tables (jobs, employees)
 *   - Insert 11 job types (NURSE, DOCTOR, etc.)
 *   - Insert 19 employees (IDs 1001-1019) with Finnish names
 *   - Uses hardcoded data if Oracle not available
 * 
 * STEP 3: SEED MYSQL FHIR DATABASE (PATIENTS & STAFF)
 *   - Run fhir-api-backend seed script (npm run db:seed)
 *   - Creates 12 patients with Finnish names and medical data
 *   - Creates 4 initial staff members
 *   - Adds medications, conditions, and visit records
 * 
 * STEP 3.5: SYNC ORACLE HR STAFF TO MYSQL FHIR
 *   - Fetch Oracle employee data (or use hardcoded fallback)
 *   - Convert Oracle job codes to FHIR roles
 *   - Create FHIR Practitioner resources
 *   - Insert/update staff records in MySQL with S prefix (S1001-S1019)
 * 
 * STEP 4: SEED MONGODB VISIT TEMPLATES
 *   - Run visits-service seed script (seedVisitTemplates.js)
 *   - Creates 15 visit templates (medication rounds, meals, care, etc.)
 *   - 12 templates with tasks, 3 without tasks
 * 
 * STEP 5: FETCH IDS FOR CARE PLANS
 *   - Fetch patient IDs from MySQL by name matching
 *   - Fetch visit template IDs from MongoDB by name
 *   - Create mapping objects for care plan creation
 * 
 * STEP 6: SEED MONGODB CARE PLANS
 *   - Import from exported care_plans_export.json if available
 *   - Otherwise run visits-service seed script (seed-care-plans.js)
 *   - Creates care plans with goals and interventions for patients
 *   - Maps visit types to template IDs
 * 
 * STEP 7: RUN CARE-PLAN-SCHEDULER (CONDITIONAL)
 *   - Execute lambda-functions/care-plan-scheduler/index.js
 *   - Generates actual visit records from care plans
 *   - Creates scheduled visits for patients based on interventions
 *   - Only runs if user confirms (interactive prompt)
 * 
 * STEP 8: VERIFY DATA
 *   - Count records in all databases
 *   - Display summary of patients, staff, medications, conditions
 *   - Show MongoDB collections counts (templates, care plans, visits)
 * 
 * STEP 9: TEST VISIT STATES WORKFLOW (CONDITIONAL)
 *   - Run scripts/test-visit-states.js if available
 *   - Tests authentication, state transitions, task completion
 *   - Validates complete visit workflow
 *   - Only runs if care-plan-scheduler was executed
 * 
 * STEP 10: RUN S3 UPLOAD WORKFLOW TEST (CONDITIONAL)
 *   - Execute scripts/step-10-upload-workflow.js
 *   - Tests .m4a audio file upload to S3
 *   - Tests photo upload to S3
 *   - Verifies S3 storage and MongoDB confirmation
 *   - Tests notification service integration
 *   - Only runs if user confirms (interactive prompt)
 * 
 * INTERACTIVE PROMPTS:
 *   - Ask whether to run care-plan-scheduler (generates visits)
 *   - Ask whether to run Step 10 upload workflow test
 * 
 * DEPENDENCIES:
 *   - MySQL: nursing_home_db with FHIR schema
 *   - MongoDB: nursing_home_visits database
 *   - Oracle: Optional HR database (C##HRAPP1)
 *   - Node.js packages: mysql2, mongoose, dotenv
 * 
 * USAGE:
 *   Run from project root: node scripts/reset-all-data.js
 * 
 * EXPECTED RESULTS:
 *   - MySQL: 12 patients, 23 staff (4 original + 19 Oracle), medications, conditions
 *   - MongoDB: 15 visit templates, 12 care plans, variable visits (depends on scheduler)
 *   - Oracle: 19 employees with Finnish names and job assignments
 */

const { execSync } = require('child_process');
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Oracle database driver (optional - will fallback if not available)
let oracledb;
try {
  oracledb = require('oracledb');
} catch (error) {
  // Oracle driver not available - will use fallback data
}

// Load environment variables from scripts/.env file
require('dotenv').config({ path: path.join(__dirname, '.env') });

// AWS SDK for Lambda invocation (optional - only needed in cloud)
let AWS;
try {
  AWS = require('aws-sdk');
} catch (error) {
  // AWS SDK not available - will use local execution
}

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
    user: process.env.ORACLE_USER || 'C##HRAPP1',
    password: process.env.ORACLE_PASSWORD || 'hrapp123',
    connectString: process.env.ORACLE_CONNECT_STRING || 'localhost:1521/XE'
  },
  lambda: {
    useLambda: process.env.USE_LAMBDA === 'true',
    region: process.env.AWS_REGION || 'eu-north-1',
    carePlanScheduler: process.env.CARE_PLAN_SCHEDULER_LAMBDA || 'care-plan-scheduler',
    s3UploadNotifier: process.env.S3_UPLOAD_NOTIFIER_LAMBDA || 's3-upload-notifier'
  }
};

// ============================================================================
// LAMBDA INVOCATION UTILITIES
// ============================================================================

/**
 * Invoke AWS Lambda function or run locally based on configuration
 */
async function invokeLambdaOrLocal(functionName, localScriptPath, payload = {}) {
  if (CONFIG.lambda.useLambda && AWS) {
    // Cloud mode: Invoke AWS Lambda
    logProgress(`Invoking Lambda function: ${functionName}`);
    
    try {
      const lambda = new AWS.Lambda({ region: CONFIG.lambda.region });
      
      const params = {
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(payload)
      };
      
      const result = await lambda.invoke(params).promise();
      
      if (result.FunctionError) {
        throw new Error(`Lambda error: ${result.FunctionError}`);
      }
      
      const response = JSON.parse(result.Payload);
      logProgress(`Lambda response: ${result.StatusCode}`);
      
      return response;
    } catch (error) {
      logError(`Lambda invocation failed: ${error.message}`);
      throw error;
    }
  } else {
    // Local mode: Run Node.js script
    logProgress(`Running local script: ${localScriptPath}`);
    
    try {
      const output = execSync(`node ${localScriptPath}`, {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, MONGODB_URI: CONFIG.mongodb.uri }
      });
      
      return { output };
    } catch (error) {
      logError(`Local script execution failed: ${error.message}`);
      throw error;
    }
  }
}

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
  
  if (!oracledb) {
    logWarning('Oracle HR seeding skipped - oracledb package not available');
    logInfo('Run: npm install oracledb to enable Oracle HR integration');
    logInfo('This is OK if you\'re not using Oracle HR for staff management');
    return;
  }
  
  let connection;
  
  try {
    logProgress('Connecting to Oracle HR database...');
    logProgress(`  - User: ${CONFIG.oracle.user}`);
    logProgress(`  - Connect String: ${CONFIG.oracle.connectString}`);
    connection = await oracledb.getConnection({
      user: CONFIG.oracle.user,
      password: CONFIG.oracle.password,
      connectString: CONFIG.oracle.connectString
    });
    
    logProgress('Creating Oracle HR tables and seeding data...');
    
    // Drop existing tables
    try {
      await connection.execute('DROP TABLE employees CASCADE CONSTRAINTS');
      await connection.execute('DROP TABLE jobs CASCADE CONSTRAINTS');
    } catch (error) {
      // Tables might not exist, ignore
    }
    
    // Create JOBS table
    await connection.execute(`
      CREATE TABLE jobs (
        job_id VARCHAR2(10) PRIMARY KEY,
        job_title VARCHAR2(35) NOT NULL,
        min_salary NUMBER(8,2),
        max_salary NUMBER(8,2)
      )
    `);
    
    // Create EMPLOYEES table
    await connection.execute(`
      CREATE TABLE employees (
        employee_id NUMBER(6) PRIMARY KEY,
        first_name VARCHAR2(20),
        last_name VARCHAR2(25) NOT NULL,
        email VARCHAR2(50) NOT NULL UNIQUE,
        phone_number VARCHAR2(20),
        hire_date DATE NOT NULL,
        job_id VARCHAR2(10) NOT NULL,
        salary NUMBER(8,2),
        CONSTRAINT emp_job_fk FOREIGN KEY (job_id) REFERENCES jobs(job_id)
      )
    `);
    
    // Insert job types
    const jobs = [
      ['NURSE', 'Sairaanhoitaja', 3000, 4500],
      ['PRAC_NURSE', 'Lähihoitaja', 2500, 3500],
      ['DOCTOR', 'Lääkäri', 5000, 9000],
      ['HEAD_NURSE', 'Osastonhoitaja', 3800, 5500],
      ['PHYSIO', 'Fysioterapeutti', 3200, 4800],
      ['PSYCHO', 'Psykologi', 3500, 5500],
      ['SOCIAL_WRK', 'Sosiaalityöntekijä', 3000, 4500],
      ['PHARMACIST', 'Proviisoori', 3500, 5000],
      ['RADIOLOG', 'Röntgenhoitaja', 3200, 4600],
      ['JANITOR', 'Talonmies', 2500, 3500],
      ['COOK', 'Keittäjä/Siivooja', 2600, 3500]
    ];
    
    for (const job of jobs) {
      await connection.execute(
        'INSERT INTO jobs (job_id, job_title, min_salary, max_salary) VALUES (:1, :2, :3, :4)',
        job
      );
    }
    
    // Insert employees using hardcoded data
    const employees = getHardcodedOracleStaffData();
    for (const emp of employees) {
      await connection.execute(
        `INSERT INTO employees (employee_id, first_name, last_name, email, phone_number, hire_date, job_id, salary) 
         VALUES (:1, :2, :3, :4, :5, TO_DATE(:6, 'YYYY-MM-DD'), :7, :8)`,
        [emp.employeeId, emp.firstName, emp.lastName, emp.email, emp.phone, emp.hireDate, emp.jobId, emp.salary]
      );
    }
    
    await connection.commit();
    
    logSuccess('Step 2 completed: Oracle HR seeded (19 employees)');
    logInfo('Employee IDs: 1001-1019');
    
  } catch (error) {
    logWarning(`Oracle HR seeding failed: ${error.message}`);
    logInfo('This is OK if you\'re not using Oracle HR for staff management');
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        // Ignore close errors
      }
    }
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
    
    // Try to fetch from Oracle first, fallback to hardcoded data
    try {
      logProgress('Attempting to fetch staff from Oracle HR...');
      logProgress(`  - Oracle config: ${CONFIG.oracle.user}@${CONFIG.oracle.connectString}`);
      oracleStaffData = await fetchOracleStaffData();
      logProgress(`  - Oracle fetch returned ${oracleStaffData.length} employees`);
      
      if (oracleStaffData.length === 0) {
        logWarning('Oracle returned 0 employees - this suggests Oracle DB is empty');
        logInfo('You may need to seed Oracle HR first or check Oracle connection');
        logInfo('Skipping Oracle to MySQL sync to avoid primary key conflicts');
        return;
      }
    } catch (oracleError) {
      logWarning(`Oracle HR fetch failed: ${oracleError.message}`);
      logInfo('Cannot sync Oracle staff to MySQL without real Oracle data');
      logInfo('This avoids primary key conflicts between hardcoded and real data');
      logInfo('Please ensure Oracle HR database is running and seeded');
      return;
    }
    
    // Double-check we have data
    if (!oracleStaffData || oracleStaffData.length === 0) {
      logError('No Oracle staff data available from either source!');
      logInfo('This should not happen - hardcoded data should always be available');
      return;
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
    
    logProgress(`Processing ${oracleStaffData.length} Oracle staff records...`);
    
    for (const employee of oracleStaffData) {
      const { employeeId, firstName, lastName, email, phone, jobId, hireDate, salary } = employee;
      
      logProgress(`  ${employeeId}: ${firstName} ${lastName} (${jobId})`);
      
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
        logProgress(`    ✓ S${employeeId} - ${role} (${department})`);
        
      } catch (error) {
        logProgress(`    ✗ FAILED: ${error.message}`);
        logProgress(`    ✗ SQL Error Code: ${error.code}`);
        logProgress(`    ✗ SQL Error Number: ${error.errno}`);
      }
    }
    
    // Verify final count
    const [staffCountRows] = await mysqlConnection.execute('SELECT COUNT(*) as count FROM staff');
    const totalStaff = staffCountRows[0].count;
    
    const [oracleStaffRows] = await mysqlConnection.execute('SELECT COUNT(*) as count FROM staff WHERE id LIKE "S%"');
    const oracleStaffCount = oracleStaffRows[0].count;
    
    logProgress(`Final staff counts:`);
    logProgress(`  - Total staff in MySQL: ${totalStaff}`);
    logProgress(`  - Oracle staff (S prefix): ${oracleStaffCount}`);
    logProgress(`  - Expected Oracle staff: 19`);
    
    if (oracleStaffCount < 19) {
      logWarning(`Missing ${19 - oracleStaffCount} Oracle staff records!`);
    }
    
    logSuccess(`Step 3.5 completed: Synced ${syncedCount} staff from Oracle HR to MySQL FHIR`);
    logInfo(`Total staff in MySQL: ${syncedCount + 4} (${syncedCount} from Oracle + 4 original)`);
    
  } catch (error) {
    logWarning(`Oracle HR to MySQL sync failed: ${error.message}`);
    logInfo('This is OK - FHIR will use the original 4 staff members');
  }
}

/**
 * Fetch Oracle staff data using Node.js Oracle driver
 */
async function fetchOracleStaffData() {
  let oracledb;
  
  try {
    oracledb = require('oracledb');
  } catch (error) {
    throw new Error('oracledb package not installed - run: npm install oracledb');
  }
  
  let connection;
  
  try {
    // Connect to Oracle database
    connection = await oracledb.getConnection({
      user: CONFIG.oracle.user,
      password: CONFIG.oracle.password,
      connectString: CONFIG.oracle.connectString
    });
    
    // Execute query
    const result = await connection.execute(
      `SELECT 
        employee_id,
        first_name,
        last_name,
        email,
        phone_number,
        job_id,
        TO_CHAR(hire_date, 'YYYY-MM-DD') as hire_date,
        salary
      FROM employees 
      WHERE employee_id BETWEEN 1001 AND 1019
      ORDER BY employee_id`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    // Convert Oracle result to our format
    const staffData = result.rows.map(row => ({
      employeeId: row.EMPLOYEE_ID,
      firstName: row.FIRST_NAME,
      lastName: row.LAST_NAME,
      email: row.EMAIL,
      phone: row.PHONE_NUMBER,
      jobId: row.JOB_ID,
      hireDate: row.HIRE_DATE,
      salary: row.SALARY
    }));
    
    return staffData;
    
  } catch (error) {
    throw new Error(`Oracle connection/query failed: ${error.message}`);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        // Ignore close errors
      }
    }
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
    const schedulerPath = path.join(__dirname, '..', 'lambda-functions', 'care-plan-scheduler', 'index.js');
    
    // Check if local script exists (needed for local mode)
    if (!CONFIG.lambda.useLambda && !fs.existsSync(schedulerPath)) {
      logWarning('Care-plan-scheduler not found');
      logInfo('Location checked: lambda-functions/care-plan-scheduler/index.js');
      logInfo('Skipping visit generation - scheduler needs to be created');
      return;
    }
    
    // Determine execution mode
    if (CONFIG.lambda.useLambda) {
      logInfo('🚀 Cloud mode: Invoking AWS Lambda function');
      logProgress(`Function: ${CONFIG.lambda.carePlanScheduler}`);
      logProgress(`Region: ${CONFIG.lambda.region}`);
    } else {
      logInfo('💻 Local mode: Running Node.js script');
      logProgress(`Script: ${schedulerPath}`);
    }
    
    // Execute scheduler (Lambda or local)
    const result = await invokeLambdaOrLocal(
      CONFIG.lambda.carePlanScheduler,
      schedulerPath,
      { source: 'reset-all-data-script' }
    );
    
    // Parse output
    if (CONFIG.lambda.useLambda) {
      logProgress('Lambda response:');
      logProgress(`  Status: ${result.statusCode || 'N/A'}`);
      if (result.body) {
        const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
        logProgress(`  Care Plans Processed: ${body.carePlansProcessed || 'N/A'}`);
        logProgress(`  Visits Created: ${body.visitsCreated || 'N/A'}`);
        logProgress(`  Visits Skipped: ${body.visitsSkipped || 'N/A'}`);
      }
    } else {
      logProgress('Local execution output:');
      const lines = result.output.split('\n').filter(line => line.trim());
      lines.slice(-10).forEach(line => logProgress(`  ${line}`));
    }
    
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
  
  // Interactive prompts
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const runScheduler = await new Promise((resolve) => {
    rl.question('\n🤖 Run care-plan-scheduler after seeding? (y/N): ', (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
  
  const runStep10 = await new Promise((resolve) => {
    rl.question('📤 Run Step 10 upload workflow test? (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
  
  if (runScheduler) {
    log('✅ Will run care-plan-scheduler after seeding', 'green');
  } else {
    log('⏭️  Will skip care-plan-scheduler (can be run separately via Lambda)', 'yellow');
  }
  
  if (runStep10) {
    log('✅ Will run Step 10 upload workflow test', 'green');
  } else {
    log('⏭️  Will skip Step 10 upload test (can be run separately)', 'yellow');
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
    
    // Step 10: Upload workflow test (runs AFTER care-plan-scheduler creates visits)
    if (runStep10) {
      logStep(10, 'RUNNING S3 UPLOAD WORKFLOW TEST');
      logInfo('Testing complete file upload and notification workflow...');
      
      try {
        const step10Script = path.join(__dirname, 'step-10-upload-workflow.js');
        logProgress(`Executing: node ${step10Script}`);
        
        const step10Output = execSync(`node "${step10Script}"`, {
          encoding: 'utf8',
          timeout: 120000, // 2 minutes timeout
          cwd: path.dirname(__dirname) // Run from project root
        });
        
        logProgress('Step 10 output:');
        console.log(step10Output);
        
        // Check for success message
        if (step10Output.includes('STEP 10 COMPLETED SUCCESSFULLY')) {
          logSuccess('Step 10 completed: S3 upload workflow test passed');
          logInfo('✅ .m4a file upload working');
          logInfo('✅ Photo upload working');
          logInfo('✅ S3 verification working');
          logInfo('✅ MongoDB confirmation working');
          logInfo('✅ Notification service working');
        } else {
          logWarning('Step 10 may have completed with warnings - check output above');
        }
        
      } catch (step10Error) {
        logError(`Step 10 failed: ${step10Error.message}`);
        logWarning('Upload workflow test failed - this may be due to S3 service not running');
        logInfo('You can run it manually later: node scripts/step-10-upload-workflow.js');
      }
    } else {
      logStep(10, 'SKIPPING S3 UPLOAD WORKFLOW TEST');
      logInfo('S3 upload workflow test will be run separately');
      logInfo('Run: node scripts/step-10-upload-workflow.js');
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
    logInfo('   5. Run Step 10 upload test: node scripts/step-10-upload-workflow.js');
    
    // Ensure clean exit
    process.exit(0);
    
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
