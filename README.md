# Data Reset Scripts

## Overview
Scripts for resetting all databases to a known state for testing and development.

---

## 🔧 Environment Configuration

### Local Development

1. **Copy and configure .env file:**
   ```bash
   cd scripts
   cp .env.production .env
   # Edit .env with your local database credentials
   ```

2. **Update database settings in .env:**
   ```bash
   DB_HOST=localhost
   DB_PASSWORD=your_local_password
   MONGODB_URI=mongodb://localhost:27017/nursing_home_visits
   NODE_ENV=development
   ```

### Cloud Deployment (EC2)

Scripts are automatically deployed via GitHub Actions:
- Workflow: `.github/workflows/deploy-ec2.yml`
- Triggers on push to main branch
- Copies `.env.production` to `.env` on EC2
- Deployed to: `~/scripts/` on EC2 instance

**Manual deployment on EC2:**
```bash
cd ~/scripts
# Edit .env.production with production credentials
cp .env.production .env
```

---

## Quick Start

### From Project Root (Local):
```bash
# Install dependencies (first time only)
npm install

# Run the reset script
cd scripts
node reset-all-data.js
```

### On EC2 (Cloud):
```bash
cd ~/scripts
node reset-all-data.js
```

---

## What It Does

The reset script performs the following steps in order:

1. **Clear All Data** - Removes existing data from all databases
2. **Seed Oracle HR** - Creates 19 staff members (employees 1001-1019)
3. **Seed MySQL FHIR** - Creates 12 patients with conditions, medications, allergies
4. **Seed MongoDB Visit Templates** - Creates 15 visit templates with tasks
5. **Fetch IDs** - Gets patient and template IDs for care plans
6. **Seed Care Plans** - Creates care plans for patients (if script exists)
7. **Run Scheduler** - Generates visits from care plans (if scheduler exists)
8. **Verify Data** - Checks all databases and prints summary

---

## Prerequisites

### Required:
- **Node.js** (v14 or higher)
- **MySQL** running on localhost:3306
- **MongoDB** running on localhost:27017

### Optional:
- **Oracle Database** (for HR staff management)
  - If not available, Oracle steps will be skipped gracefully

### Environment Variables:
Create a `.env` file in the project root:

```env
# MySQL Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=nursing_home_db

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/nursing_home_visits

# Oracle Configuration (optional)
ORACLE_USER=hr
ORACLE_PASSWORD=hr
ORACLE_CONNECT_STRING=localhost:1521/XEPDB1
```

---

## Output

The script provides detailed logging with:
- ✅ Success messages (green)
- ❌ Error messages (red)
- ⚠️  Warning messages (yellow)
- ℹ️  Info messages (blue)
- Progress indicators (dim)

### Example Output:
```
================================================================================
🚀 MASTER DATA RESET SCRIPT
================================================================================

[STEP 1] CLEARING ALL EXISTING DATA
--------------------------------------------------------------------------------
   Connecting to MongoDB...
✅ Connected to MongoDB
   Clearing MongoDB collections...
     - Cleared visit_data: 0 documents deleted
     - Cleared care_plans: 3 documents deleted
     - Cleared visit_templates: 15 documents deleted
✅ MongoDB cleared successfully
...
```

---

## Data Created

### Oracle HR (if available):
- **9 job types**: NURSE, DOCTOR, HEAD_NURSE, etc.
- **19 employees**: IDs 1001-1019

### MySQL FHIR:
- **12 patients**: Rooms 101-112
- **4 staff**: S1003, S1004, S1006, S1009
- **Medical conditions**: 1-3 per patient
- **Medications**: 1-3 per patient
- **Allergies**: 0-2 per patient
- **Emergency contacts**: 1 per patient
- **Visits**: 10-15 per patient

### MongoDB:
- **15 visit templates**: With tasks for daily schedule
- **Care plans**: For patients (if seed script exists)
- **Visits**: Generated from care plans (if scheduler exists)

---

## Troubleshooting

### "ECONNREFUSED" Error
**Problem**: Cannot connect to database
**Solution**: 
- Check if MySQL is running: `mysql -u root -p`
- Check if MongoDB is running: `mongosh`
- Verify connection details in `.env`

### "Access Denied" Error
**Problem**: Database authentication failed
**Solution**:
- Check username and password in `.env`
- Verify database user has proper permissions

### "Table doesn't exist" Error
**Problem**: Database tables not created
**Solution**:
- Run migrations first: `cd fhir-api-backend && npm run db:migrate`
- The script will skip clearing if tables don't exist

### Oracle Steps Skipped
**Problem**: sqlplus not found
**Solution**:
- This is OK if you're not using Oracle HR
- Install Oracle Instant Client if you need Oracle support

---

## Files

```
scripts/
├── reset-all-data.js          # Main reset script
├── sql/
│   ├── clear-mysql.sql        # MySQL clear script
│   └── clear-oracle.sql       # Oracle clear script
└── README.md                  # This file
```

---

## Safety Features

- **Graceful failures**: If a step fails, the script continues with warnings
- **Connection cleanup**: Closes all database connections on exit
- **Ctrl+C handling**: Gracefully handles interruption
- **Detailed logging**: Shows exactly what's happening at each step
- **Verification**: Checks data after seeding

---

## Integration with Admin Page

The reset script uses the same seed functions as the admin page buttons:
- `fhir-api-backend/src/db/seed.js` - MySQL FHIR seeding
- `visits-service/src/db/seedVisitTemplates.js` - Visit templates
- `visits-service/scripts/seed-care-plans.js` - Care plans

This ensures consistency between manual seeding and automated resets.

---

## Development

### Running Individual Steps:
You can modify the script to run only specific steps by commenting out others in the `main()` function.

### Adding New Steps:
1. Create a new async function for your step
2. Add it to the `main()` function
3. Use the logging utilities for consistent output

### Logging Utilities:
```javascript
logSection('Title');           // Section header
logStep(1, 'Step name');       // Step header
logSuccess('Message');         // Green checkmark
logError('Message');           // Red X
logWarning('Message');         // Yellow warning
logInfo('Message');            // Blue info
logProgress('Message');        // Dim progress text
```

---

## Notes

- **Idempotent**: Can be run multiple times safely
- **Fast**: Typically completes in 10-30 seconds
- **Comprehensive**: Resets all databases in one command
- **Safe**: Clears data before seeding to avoid duplicates
- **Flexible**: Gracefully handles missing components

---

## Support

If you encounter issues:
1. Check the error message and troubleshooting section
2. Verify all prerequisites are met
3. Check `.env` configuration
4. Review the detailed logs for specific errors
5. Try running individual seed scripts manually to isolate the problem
