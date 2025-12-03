@echo off
REM Sync .env.production files to EC2

set EC2_HOST=ubuntu@51.20.164.143
set KEY_FILE=test-health-vpc-key.pem
set REMOTE_PATH=/home/ubuntu/Kouluprojekti

echo Syncing .env.production files to EC2...
echo.

REM List of services
set services=api-gateway auth-service visits-service fhir-api-backend analytics-service fitbit-service s3-bukcet-service oura-service notification-service

for %%s in (%services%) do (
  if exist "%%s\.env.production" (
    echo Copying %%s\.env.production...
    scp -i %KEY_FILE% "%%s\.env.production" "%EC2_HOST%:%REMOTE_PATH%/%%s/"
  ) else (
    echo Warning: %%s\.env.production not found
  )
)

echo.
echo Done! Now SSH to EC2 and restart services:
echo   ssh -i %KEY_FILE% %EC2_HOST%
echo   pm2 restart all
