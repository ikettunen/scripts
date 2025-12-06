# Quick Start Guide - Scripts Deployment

## 🏠 Local Testing (Do This First!)

```bash
# 1. Go to scripts folder
cd scripts

# 2. Check .env exists (should be there already)
ls -la .env

# 3. Update your local MySQL password if needed
# Edit DB_PASSWORD in .env

# 4. Run the script
node reset-all-data.js

# 5. Answer the prompts:
#    - Run care-plan-scheduler? (y/N)
#    - Run Step 10 upload test? (y/N)
```

**Expected Result:** Script completes all 10 steps successfully ✅

---

## ☁️ Cloud Deployment (After Local Works!)

### Step 1: Update Production Config

```bash
# Edit .env.production with EC2 MySQL password
nano scripts/.env.production

# Change this line:
DB_PASSWORD=your_mysql_password_here
# To your actual EC2 MySQL password
```

### Step 2: Commit and Push

```bash
git add scripts/.env.production
git add scripts/.github/workflows/deploy-ec2.yml
git add scripts/.gitignore
git add scripts/reset-all-data.js
git add scripts/README.md
git add scripts/DEPLOYMENT-SETUP.md
git add scripts/QUICK-START.md

git commit -m "Configure scripts for cloud deployment with .env files"
git push origin main
```

### Step 3: GitHub Actions Will Deploy

- Watch: https://github.com/your-repo/actions
- Workflow: "Deploy Scripts to EC2"
- It will copy files to `~/scripts/` on EC2
- It will run: `cp .env.production .env`

### Step 4: Run on EC2

```bash
# SSH to EC2
ssh -i your-key.pem ec2-user@51.20.164.143

# Navigate to scripts
cd ~/scripts

# Verify .env was created
cat .env | grep NODE_ENV
# Should show: NODE_ENV=production

# Run the script
node reset-all-data.js
```

---

## 📝 What Changed?

| File | Change |
|------|--------|
| `scripts/.env` | New - Local development config |
| `scripts/.env.production` | New - Cloud production config |
| `scripts/.gitignore` | New - Ignore local .env |
| `scripts/reset-all-data.js` | Updated - Load from scripts/.env |
| `scripts/.github/workflows/deploy-ec2.yml` | New - Auto deployment |

---

## 🔑 Key Points

1. **Local:** Uses `scripts/.env` (gitignored)
2. **Cloud:** Uses `scripts/.env.production` (committed)
3. **Deployment:** Copies `.env.production` → `.env` on EC2
4. **No more hardcoded localhost!** Everything from .env

---

## ⚠️ Important

**Before pushing to GitHub:**
- ✅ Test locally first
- ✅ Update DB_PASSWORD in .env.production
- ✅ Don't commit .env (only .env.production)
- ✅ Make sure self-hosted runner is set up on EC2

---

## 🎯 One-Liner Commands

**Local test:**
```bash
cd scripts && node reset-all-data.js
```

**Deploy to cloud:**
```bash
git add scripts/ && git commit -m "Deploy scripts" && git push
```

**Run on EC2:**
```bash
ssh ec2 "cd ~/scripts && node reset-all-data.js"
```

---

## 📞 Need Help?

See `DEPLOYMENT-SETUP.md` for detailed instructions and troubleshooting.
