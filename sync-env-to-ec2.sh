#!/bin/bash
# Sync .env.production files to EC2

EC2_HOST="ubuntu@51.20.164.143"
KEY_FILE="test-health-vpc-key.pem"
REMOTE_PATH="/home/ubuntu/Kouluprojekti"

echo "Syncing .env.production files to EC2..."

# List of services
services=(
  "api-gateway"
  "auth-service"
  "visits-service"
  "fhir-api-backend"
  "analytics-service"
  "fitbit-service"
  "s3-bukcet-service"
  "oura-service"
  "notification-service"
)

for service in "${services[@]}"; do
  if [ -f "$service/.env.production" ]; then
    echo "Copying $service/.env.production..."
    scp -i "$KEY_FILE" "$service/.env.production" "$EC2_HOST:$REMOTE_PATH/$service/"
  else
    echo "⚠️  $service/.env.production not found"
  fi
done

echo ""
echo "✓ Done! Now SSH to EC2 and restart services:"
echo "  ssh -i $KEY_FILE $EC2_HOST"
echo "  pm2 restart all"
