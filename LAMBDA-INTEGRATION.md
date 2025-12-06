# Lambda Integration for reset-all-data.js

**Date:** December 6, 2024  
**Status:** ✅ Implemented - Ready for Testing

---

## 🎯 What Changed

The `reset-all-data.js` script now supports **dual execution modes**:

### Local Mode (Development)
- Runs Lambda functions as Node.js scripts
- No AWS credentials needed
- Fast iteration and debugging
- Uses: `USE_LAMBDA=false`

### Cloud Mode (Production)
- Invokes real AWS Lambda functions
- Requires AWS credentials on EC2
- Production-ready execution
- Uses: `USE_LAMBDA=true`

---

## 🔧 Configuration

### Environment Variables

**Added to `scripts/.env` (Local):**
```bash
USE_LAMBDA=false
AWS_REGION=eu-north-1
CARE_PLAN_SCHEDULER_LAMBDA=care-plan-scheduler
S3_UPLOAD_NOTIFIER_LAMBDA=s3-upload-notifier
```

**Added to `scripts/.env.production` (Cloud):**
```bash
USE_LAMBDA=true
AWS_REGION=eu-north-1
CARE_PLAN_SCHEDULER_LAMBDA=care-plan-scheduler
S3_UPLOAD_NOTIFIER_LAMBDA=s3-upload-notifier
```

---

## 🚀 How It Works

### Step 7: Care-Plan-Scheduler

**Local Mode:**
```javascript
// Runs: node lambda-functions/care-plan-scheduler/index.js
execSync(`node ${schedulerPath}`)
```

**Cloud Mode:**
```javascript
// Invokes: AWS Lambda function "care-plan-scheduler"
const lambda = new AWS.Lambda({ region: 'eu-north-1' });
await lambda.invoke({
  FunctionName: 'care-plan-scheduler',
  InvocationType: 'RequestResponse'
}).promise();
```

### Automatic Detection

The script automatically detects the mode based on `USE_LAMBDA` environment variable:

```javascript
if (CONFIG.lambda.useLambda && AWS) {
  // Cloud mode: Invoke Lambda
  logInfo('🚀 Cloud mode: Invoking AWS Lambda function');
} else {
  // Local mode: Run script
  logInfo('💻 Local mode: Running Node.js script');
}
```

---

## 📋 Testing

### Test Local Mode (Current)

```bash
cd scripts
# .env has USE_LAMBDA=false
node reset-all-data.js
```

**Expected Output:**
```
[STEP 7] RUNNING CARE-PLAN-SCHEDULER
💻 Local mode: Running Node.js script
Script: lambda-functions/care-plan-scheduler/index.js
✅ Step 7 completed: Visits generated from care plans
```

### Test Cloud Mode (After Deployment)

```bash
# On EC2
cd ~/scripts
# .env has USE_LAMBDA=true (from .env.production)
node reset-all-data.js
```

**Expected Output:**
```
[STEP 7] RUNNING CARE-PLAN-SCHEDULER
🚀 Cloud mode: Invoking AWS Lambda function
Function: care-plan-scheduler
Region: eu-north-1
Lambda response:
  Status: 200
  Care Plans Processed: 3
  Visits Created: 127
✅ Step 7 completed: Visits generated from care plans
```

---

## 🔑 AWS Credentials

### Local Development
- No AWS credentials needed
- Runs scripts locally

### EC2 Production
AWS credentials are automatically available via:

1. **IAM Role** (Recommended)
   - Attach IAM role to EC2 instance
   - Role has `lambda:InvokeFunction` permission
   - No credentials in code

2. **AWS CLI Configuration**
   ```bash
   aws configure
   # Enter access key, secret key, region
   ```

3. **Environment Variables**
   ```bash
   export AWS_ACCESS_KEY_ID=your_key
   export AWS_SECRET_ACCESS_KEY=your_secret
   export AWS_REGION=eu-north-1
   ```

---

## 📦 Dependencies

### Added to package.json

```json
{
  "optionalDependencies": {
    "oracledb": "^6.0.0",
    "aws-sdk": "^2.1000.0"
  }
}
```

**Why optional?**
- Local development doesn't need aws-sdk
- Script gracefully falls back to local execution if aws-sdk not available

---

## 🎓 Code Structure

### New Helper Function

```javascript
async function invokeLambdaOrLocal(functionName, localScriptPath, payload = {}) {
  if (CONFIG.lambda.useLambda && AWS) {
    // Cloud mode: Invoke AWS Lambda
    const lambda = new AWS.Lambda({ region: CONFIG.lambda.region });
    const result = await lambda.invoke({
      FunctionName: functionName,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(payload)
    }).promise();
    return JSON.parse(result.Payload);
  } else {
    // Local mode: Run Node.js script
    const output = execSync(`node ${localScriptPath}`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return { output };
  }
}
```

### Usage in Step 7

```javascript
const result = await invokeLambdaOrLocal(
  CONFIG.lambda.carePlanScheduler,           // Lambda function name
  schedulerPath,                              // Local script path
  { source: 'reset-all-data-script' }        // Payload
);
```

---

## 🔒 Security

### IAM Policy for EC2 Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": [
        "arn:aws:lambda:eu-north-1:*:function:care-plan-scheduler",
        "arn:aws:lambda:eu-north-1:*:function:s3-upload-notifier"
      ]
    }
  ]
}
```

### Best Practices

1. ✅ Use IAM roles (not access keys)
2. ✅ Least privilege permissions
3. ✅ Region-specific resources
4. ✅ Graceful fallback to local execution

---

## 🐛 Troubleshooting

### Issue: "Lambda invocation failed"

**Check:**
```bash
# Verify Lambda function exists
aws lambda get-function --function-name care-plan-scheduler

# Test invocation
aws lambda invoke --function-name care-plan-scheduler output.json
cat output.json
```

### Issue: "AWS SDK not available"

**Solution:**
```bash
cd ~/scripts
npm install aws-sdk
```

### Issue: "Access denied"

**Check IAM permissions:**
```bash
# Verify EC2 instance role
aws sts get-caller-identity

# Check Lambda permissions
aws lambda get-policy --function-name care-plan-scheduler
```

---

## 📊 Comparison

| Feature | Local Mode | Cloud Mode |
|---------|-----------|------------|
| **Execution** | Node.js script | AWS Lambda |
| **Speed** | Fast | Network latency |
| **Cost** | Free | Lambda pricing |
| **Debugging** | Easy | CloudWatch logs |
| **Scalability** | Limited | Auto-scaling |
| **AWS Credentials** | Not needed | Required |
| **Use Case** | Development | Production |

---

## ✅ Benefits

### For Development
- ✅ Fast iteration
- ✅ Easy debugging
- ✅ No AWS costs
- ✅ Works offline

### For Production
- ✅ Serverless execution
- ✅ Auto-scaling
- ✅ Managed infrastructure
- ✅ CloudWatch monitoring

---

## 🚀 Deployment Checklist

### Before Deploying to EC2

- [x] Local testing with `USE_LAMBDA=false`
- [ ] Update `.env.production` with `USE_LAMBDA=true`
- [ ] Verify Lambda functions are deployed in AWS
- [ ] Configure EC2 IAM role with Lambda invoke permissions
- [ ] Test Lambda invocation from EC2

### After Deployment

- [ ] SSH to EC2 and run script
- [ ] Verify Lambda functions are invoked (not local scripts)
- [ ] Check CloudWatch logs for Lambda execution
- [ ] Verify visits are created correctly

---

## 📝 Next Steps

1. **Test locally** - Verify current behavior unchanged
2. **Deploy Lambda functions** - Ensure they exist in AWS
3. **Configure IAM role** - Add Lambda invoke permissions to EC2
4. **Deploy scripts** - Push to GitHub, let Actions deploy
5. **Test on EC2** - Verify Lambda invocation works

---

## 🎯 Future Enhancements

Potential improvements:
- Add retry logic for Lambda invocations
- Support async Lambda invocations
- Add Lambda execution time tracking
- Support multiple Lambda regions
- Add Lambda version/alias support

---

**Status:** ✅ Ready for local testing  
**Next:** Deploy to EC2 and test Lambda invocation

