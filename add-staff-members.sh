#!/bin/bash

# Script to add staff members to staff-service
# Staff service should be running on port 6001

STAFF_SERVICE_URL="http://localhost:6001/api/staff"

echo "Adding staff members to staff-service..."
echo ""

# Doctors
echo "Adding Doctors..."

curl -X POST $STAFF_SERVICE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "email": "dr.smith@nursinghome.com",
    "phone": "+1-555-0101",
    "role": "Doctor",
    "department": "General Medicine",
    "specialization": "MD",
    "licenseNumber": "MD-12345",
    "hireDate": "2020-01-15",
    "status": "active"
  }'
echo ""

curl -X POST $STAFF_SERVICE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Sarah",
    "lastName": "Johnson",
    "email": "dr.johnson@nursinghome.com",
    "phone": "+1-555-0102",
    "role": "Doctor",
    "department": "Geriatrics",
    "specialization": "DO",
    "licenseNumber": "DO-23456",
    "hireDate": "2019-03-20",
    "status": "active"
  }'
echo ""

curl -X POST $STAFF_SERVICE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Michael",
    "lastName": "Williams",
    "email": "dr.williams@nursinghome.com",
    "phone": "+1-555-0103",
    "role": "Doctor",
    "department": "Cardiology",
    "specialization": "MD",
    "licenseNumber": "MD-34567",
    "hireDate": "2021-06-10",
    "status": "active"
  }'
echo ""

# Nurses
echo "Adding Nurses..."

curl -X POST $STAFF_SERVICE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Emily",
    "lastName": "Brown",
    "email": "nurse.brown@nursinghome.com",
    "phone": "+1-555-0201",
    "role": "Nurse",
    "department": "General Care",
    "specialization": "RN",
    "licenseNumber": "RN-45678",
    "hireDate": "2020-08-15",
    "status": "active"
  }'
echo ""

curl -X POST $STAFF_SERVICE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "James",
    "lastName": "Davis",
    "email": "nurse.davis@nursinghome.com",
    "phone": "+1-555-0202",
    "role": "Nurse",
    "department": "Night Shift",
    "specialization": "RN",
    "licenseNumber": "RN-56789",
    "hireDate": "2019-11-01",
    "status": "active"
  }'
echo ""

curl -X POST $STAFF_SERVICE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Lisa",
    "lastName": "Miller",
    "email": "nurse.miller@nursinghome.com",
    "phone": "+1-555-0203",
    "role": "Nurse",
    "department": "General Care",
    "specialization": "LPN",
    "licenseNumber": "LPN-67890",
    "hireDate": "2021-02-14",
    "status": "active"
  }'
echo ""

# Physiotherapists
echo "Adding Physiotherapists..."

curl -X POST $STAFF_SERVICE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "David",
    "lastName": "Wilson",
    "email": "pt.wilson@nursinghome.com",
    "phone": "+1-555-0301",
    "role": "Physiotherapist",
    "department": "Rehabilitation",
    "specialization": "DPT",
    "licenseNumber": "PT-78901",
    "hireDate": "2020-05-20",
    "status": "active"
  }'
echo ""

curl -X POST $STAFF_SERVICE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jennifer",
    "lastName": "Moore",
    "email": "pt.moore@nursinghome.com",
    "phone": "+1-555-0302",
    "role": "Physiotherapist",
    "department": "Rehabilitation",
    "specialization": "PT",
    "licenseNumber": "PT-89012",
    "hireDate": "2021-09-01",
    "status": "active"
  }'
echo ""

# Care Assistants
echo "Adding Care Assistants..."

curl -X POST $STAFF_SERVICE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Robert",
    "lastName": "Taylor",
    "email": "ca.taylor@nursinghome.com",
    "phone": "+1-555-0401",
    "role": "Care Assistant",
    "department": "General Care",
    "specialization": "CNA",
    "licenseNumber": "CNA-90123",
    "hireDate": "2021-01-10",
    "status": "active"
  }'
echo ""

curl -X POST $STAFF_SERVICE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Maria",
    "lastName": "Anderson",
    "email": "ca.anderson@nursinghome.com",
    "phone": "+1-555-0402",
    "role": "Care Assistant",
    "department": "General Care",
    "specialization": "HHA",
    "licenseNumber": "HHA-01234",
    "hireDate": "2020-07-15",
    "status": "active"
  }'
echo ""

curl -X POST $STAFF_SERVICE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Christopher",
    "lastName": "Thomas",
    "email": "ca.thomas@nursinghome.com",
    "phone": "+1-555-0403",
    "role": "Care Assistant",
    "department": "Night Shift",
    "specialization": "CNA",
    "licenseNumber": "CNA-12345",
    "hireDate": "2021-04-01",
    "status": "active"
  }'
echo ""

echo ""
echo "All staff members added!"
echo ""
echo "To view all staff members:"
echo "curl http://localhost:6001/api/staff"
