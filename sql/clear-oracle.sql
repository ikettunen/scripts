-- Clear Oracle HR Database
-- This script clears all HR tables

-- Clear employees first (has foreign key to jobs)
DELETE FROM employees;

-- Clear jobs
DELETE FROM jobs;

-- Commit changes
COMMIT;

-- Confirmation
SELECT 'Oracle HR tables cleared successfully' AS status FROM dual;

EXIT;
