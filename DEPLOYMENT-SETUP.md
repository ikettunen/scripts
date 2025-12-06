# Scripts Deployment Setup

**Date:** December 6, 2024  
**Status:** ✅ Ready for Testing

---

## 🎯 What Was Changed

### 1. Environment Configuration Files

**Created:**
- `scripts/.env` - Local development configuration
- `scripts/.env.production` - Cloud/EC2 production configuration
- `scripts/.gitignore` - Ignore local .env, keep .env.production

**Purpose:**
- Separate local and cloud database configurations
- No more hardcoded localhost values
- Easy to test locally before deploying to cloud

---

### 2. Updated reset-all-data.js

**Changed:**
```javascript
// OLD: Load from service folders
require('dotenv').config({ path: path.join(__dirname, '..', 'fhir-api-backend', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', 'visits-service', '.env') });

// NEW: Load from scripts/.env
require('dotenv').config({ path: path.join(__dirname, '.env') });
```

**Benefits:**
- Single source of truth for database configuration
- Works in both local and cloud environments
- No need to modify multiple .env files

---

### 3. GitHub Actions Workflow

**Created:** `scripts/.github/workflows/deploy-ec2.yml`

**What it does:**
1. Triggers on push to main branch (when scripts/** files change)
2. Runs on self-hosted EC2 runner
3. Copies scripts to `~/scripts/` on EC2
4. Runs `cp .env.production .env` to use production config
5. Adds deployment timestamp to .env

**Deployment command:**
```bash
cp .env.production .env
```

---

## 🧪 Testing Instructions

### Step 1: Test Locally

1. **Configure local environment:**
   ```bash
   cd scripts
   # Edit .env with your local database credentials
   nano .env
   ```

2. **Update credentials in .env:**
   ```bash
   DB_HOST=localhost
   DB_PASSWORD=your_local_mysql_password
   MONGODB_URI=mongodb://localhost:27017/nursing_home_visits
   NODE_ENV=development
   CLOUD_DEPLOYMENT=false
   ```

3. **Run the script:**
   ```bash
   node reset-all-data.js
   ```

4. **Verify it works:**
   - Check MySQL: `SELECT COUNT(*) FROM patients;`
   - Check MongoDB: `db.visit_data.count()`
   - Look for success messages in output

---

### Step 2: Prepare for Cloud Deployment

1. **Update .env.production with EC2 credentials:**
   ```bash
   cd scripts
   nano .env.production
   ```

2. **Set production values:**
   ```bash
   DB_HOST=localhost  # MySQL on EC2 localhost
   DB_PASSWORD=your_ec2_mysql_password
   MONGODB_URI=mongodb://localhost:27017/nursing_home_visits
   NODE_ENV=production
   CLOUD_DEPLOYMENT=true
   ```

3. **Commit and push:**
   ```bash
   git add scripts/.env.production
   git add scripts/.github/workflows/deploy-ec2.yml
   git add scripts/.gitignore
   git add scripts/reset-all-data.js
   git commit -m "Add environment configuration for scripts deployment"
   git push origin main
   ```

---

### Step 3: Deploy to EC2

**Option A: Automatic (via GitHub Actions)**
1. Push to main branch
2. GitHub Actions will deploy automatically
3. Check workflow status in GitHub Actions tab

**Option B: Manual**
1. SSH to EC2: `ssh -i your-key.pem ec2-user@51.20.164.143`
2. Navigate: `cd ~/scripts`
3. Copy config: `cp .env.production .env`
4. Edit if needed: `nano .env`
5. Run script: `node reset-all-data.js`

---

### Step 4: Verify on EC2

```bash
# SSH to EC2
ssh -i your-key.pem ec2-user@51.20.164.143

# Check deployment
cd ~/scripts
ls -la .env .env.production

# Verify environment
cat .env | grep NODE_ENV
cat .env | grep CLOUD_DEPLOYMENT

# Run the script
node reset-all-data.js
```

---

## 📋 Environment Variables Reference

### Database Configuration

| Variable | Local Example | Cloud Example | Description |
|----------|---------------|---------------|-------------|
| `DB_HOST` | `localhost` | `localhost` | MySQL host (localhost on EC2) |
| `DB_PORT` | `3306` | `3306` | MySQL port |
| `DB_USER` | `root` | `root` | MySQL username |
| `DB_PASSWORD` | `your_password` | `ec2_password` | MySQL password |
| `DB_NAME` | `nursing_home_db` | `nursing_home_db` | Database name |
| `MONGODB_URI` | `mongodb://localhost:27017/...` | `mongodb://localhost:27017/...` | MongoDB connection string |
| `NODE_ENV` | `development` | `production` | Environment mode |
| `CLOUD_DEPLOYMENT` | `false` | `true` | Cloud deployment flag |

### Oracle Configuration (Optional)

| Variable | Example | Description |
|----------|---------|-------------|
| `ORACLE_USER` | `C##HRAPP1` | Oracle username |
| `ORACLE_PASSWORD` | `hrapp123` | Oracle password |
| `ORACLE_CONNECT_STRING` | `localhost:1521/XE` | Oracle connection string |

---

## 🔒 Security Notes

1. **Never commit .env to git** - It's in .gitignore
2. **Keep .env.production generic** - Use placeholders for sensitive data
3. **Update passwords on EC2** - Edit .env after deployment
4. **Rotate credentials regularly** - Update both local and cloud

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to MySQL"

**Solution:**
```bash
# Check MySQL is running
sudo systemctl status mysql

# Check credentials in .env
cat .env | grep DB_

# Test connection
mysql -u root -p -e "SHOW DATABASES;"
```

### Issue: "Cannot connect to MongoDB"

**Solution:**
```bash
# Check MongoDB is running
sudo systemctl status mongod

# Check connection string
cat .env | grep MONGODB_URI

# Test connection
mongosh "mongodb://localhost:27017/nursing_home_visits"
```

### Issue: "Script uses wrong environment"

**Solution:**
```bash
# Verify .env exists
ls -la .env

# Check NODE_ENV
cat .env | grep NODE_ENV

# Re-copy from production
cp .env.production .env
```

---

## 📁 File Structure

```
scripts/
├── .env                          # Local config (gitignored)
├── .env.production               # Cloud config (committed)
├── .gitignore                    # Ignore .env
├── .github/
│   └── workflows/
│       └── deploy-ec2.yml        # Deployment workflow
├── reset-all-data.js             # Main script (updated)
├── README.md                     # Updated documentation
└── DEPLOYMENT-SETUP.md           # This file
```

---

## ✅ Checklist

Before deploying to cloud:

- [ ] Local testing completed successfully
- [ ] .env.production updated with correct credentials
- [ ] .gitignore prevents .env from being committed
- [ ] GitHub Actions workflow file created
- [ ] Self-hosted runner configured on EC2
- [ ] MySQL password updated in .env.production
- [ ] MongoDB connection string verified
- [ ] Committed and pushed to main branch

---

## 🚀 Next Steps

1. **Test locally** - Verify script works with .env
2. **Update .env.production** - Set correct EC2 credentials
3. **Push to GitHub** - Trigger automatic deployment
4. **Verify on EC2** - SSH and run the script
5. **Document results** - Update this file with any issues

---

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify environment variables in .env
3. Check service logs on EC2
4. Review GitHub Actions workflow logs

