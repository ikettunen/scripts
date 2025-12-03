
SET PAGESIZE 0
SET FEEDBACK OFF
SET HEADING OFF
SET LINESIZE 1000
SPOOL oracle_staff_export.csv
SELECT 
  employee_id || ',' ||
  first_name || ',' ||
  last_name || ',' ||
  email || ',' ||
  phone_number || ',' ||
  job_id || ',' ||
  hire_date || ',' ||
  salary
FROM employees 
WHERE employee_id BETWEEN 1001 AND 1019
ORDER BY employee_id;
SPOOL OFF
EXIT;
