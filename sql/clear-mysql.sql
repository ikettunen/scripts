-- Clear MySQL FHIR Database
-- This script clears all tables in the correct order to handle foreign key constraints

SET FOREIGN_KEY_CHECKS = 0;

-- Clear visit-related tables
TRUNCATE TABLE vital_signs;
TRUNCATE TABLE visits;

-- Clear patient-related tables
TRUNCATE TABLE patient_allergies;
TRUNCATE TABLE emergency_contacts;
TRUNCATE TABLE medications;
TRUNCATE TABLE medical_conditions;
TRUNCATE TABLE patient_identifiers;
TRUNCATE TABLE patients;

-- Clear staff tables
TRUNCATE TABLE staff;

-- Clear FHIR tables
TRUNCATE TABLE fhir_resources;
TRUNCATE TABLE fhir_audit_log;

SET FOREIGN_KEY_CHECKS = 1;

-- Confirmation
SELECT 'MySQL tables cleared successfully' AS status;
