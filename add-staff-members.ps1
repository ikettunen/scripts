# PowerShell script to add staff members to staff-service
# Run this script: .\scripts\add-staff-members.ps1

$STAFF_SERVICE_URL = "http://localhost:6001/api/staff"

Write-Host "Adding staff members to staff-service..." -ForegroundColor Green
Write-Host ""

# Array of staff members to add
$staffMembers = @(
    @{
        name = "Dr. John Smith"
        role = "Doctor"
        email = "dr.smith@nursinghome.com"
        phone = "+1-555-0101"
        specialization = "General Medicine"
        licenseNumber = "MD-12345"
        department = "Medical"
    },
    @{
        name = "Dr. Sarah Johnson"
        role = "Doctor"
        email = "dr.johnson@nursinghome.com"
        phone = "+1-555-0102"
        specialization = "Geriatrics"
        licenseNumber = "MD-12346"
        department = "Medical"
    },
    @{
        name = "Dr. Michael Williams"
        role = "Doctor"
        email = "dr.williams@nursinghome.com"
        phone = "+1-555-0103"
        specialization = "Cardiology"
        licenseNumber = "MD-12347"
        department = "Medical"
    },
    @{
        name = "Emily Brown"
        role = "Nurse"
        email = "nurse.brown@nursinghome.com"
        phone = "+1-555-0201"
        specialization = "General Nursing"
        licenseNumber = "RN-54321"
        department = "Nursing"
    },
    @{
        name = "James Davis"
        role = "Nurse"
        email = "nurse.davis@nursinghome.com"
        phone = "+1-555-0202"
        specialization = "Critical Care"
        licenseNumber = "RN-54322"
        department = "Nursing"
    },
    @{
        name = "Lisa Miller"
        role = "Nurse"
        email = "nurse.miller@nursinghome.com"
        phone = "+1-555-0203"
        specialization = "Geriatric Nursing"
        licenseNumber = "LPN-54323"
        department = "Nursing"
    },
    @{
        name = "David Wilson"
        role = "Physiotherapist"
        email = "pt.wilson@nursinghome.com"
        phone = "+1-555-0301"
        specialization = "Orthopedic PT"
        licenseNumber = "DPT-98765"
        department = "Rehabilitation"
    },
    @{
        name = "Jennifer Moore"
        role = "Physiotherapist"
        email = "pt.moore@nursinghome.com"
        phone = "+1-555-0302"
        specialization = "Geriatric PT"
        licenseNumber = "PT-98766"
        department = "Rehabilitation"
    },
    @{
        name = "Robert Taylor"
        role = "Care Assistant"
        email = "ca.taylor@nursinghome.com"
        phone = "+1-555-0401"
        specialization = "Personal Care"
        licenseNumber = "CNA-11111"
        department = "Care"
    },
    @{
        name = "Maria Anderson"
        role = "Care Assistant"
        email = "ca.anderson@nursinghome.com"
        phone = "+1-555-0402"
        specialization = "Home Health"
        licenseNumber = "HHA-11112"
        department = "Care"
    },
    @{
        name = "Christopher Thomas"
        role = "Care Assistant"
        email = "ca.thomas@nursinghome.com"
        phone = "+1-555-0403"
        specialization = "Personal Care"
        licenseNumber = "CNA-11113"
        department = "Care"
    }
)

$addedStaff = @()
$failedStaff = @()

foreach ($staff in $staffMembers) {
    Write-Host "Adding: $($staff.name) ($($staff.role))..." -NoNewline
    
    $body = $staff | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri $STAFF_SERVICE_URL -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
        
        $staffId = $response.staffId
        Write-Host " Added (ID: $staffId)" -ForegroundColor Green
        
        $addedStaff += @{
            name = $staff.name
            email = $staff.email
            role = $staff.role
            staffId = $staffId
        }
    }
    catch {
        Write-Host " Failed" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        $failedStaff += $staff.name
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Successfully added: $($addedStaff.Count)" -ForegroundColor Green
Write-Host "Failed: $($failedStaff.Count)" -ForegroundColor $(if ($failedStaff.Count -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($addedStaff.Count -gt 0) {
    Write-Host "Added Staff Members:" -ForegroundColor Green
    Write-Host ""
    
    # Group by role
    $doctors = $addedStaff | Where-Object { $_.role -eq "Doctor" }
    $nurses = $addedStaff | Where-Object { $_.role -eq "Nurse" }
    $pts = $addedStaff | Where-Object { $_.role -eq "Physiotherapist" }
    $cas = $addedStaff | Where-Object { $_.role -eq "Care Assistant" }
    
    if ($doctors.Count -gt 0) {
        Write-Host "Doctors:" -ForegroundColor Yellow
        foreach ($doc in $doctors) {
            Write-Host "  - $($doc.name) (ID: $($doc.staffId)) - $($doc.email)"
        }
        Write-Host ""
    }
    
    if ($nurses.Count -gt 0) {
        Write-Host "Nurses:" -ForegroundColor Yellow
        foreach ($nurse in $nurses) {
            Write-Host "  - $($nurse.name) (ID: $($nurse.staffId)) - $($nurse.email)"
        }
        Write-Host ""
    }
    
    if ($pts.Count -gt 0) {
        Write-Host "Physiotherapists:" -ForegroundColor Yellow
        foreach ($pt in $pts) {
            Write-Host "  - $($pt.name) (ID: $($pt.staffId)) - $($pt.email)"
        }
        Write-Host ""
    }
    
    if ($cas.Count -gt 0) {
        Write-Host "Care Assistants:" -ForegroundColor Yellow
        foreach ($ca in $cas) {
            Write-Host "  - $($ca.name) (ID: $($ca.staffId)) - $($ca.email)"
        }
        Write-Host ""
    }
    
    # Save to file for auth-service update
    $outputFile = "scripts/staff-ids.json"
    $addedStaff | ConvertTo-Json | Out-File -FilePath $outputFile -Encoding UTF8
    Write-Host "Staff IDs saved to: $outputFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next step: Update auth-service/src/server.js with these staff IDs" -ForegroundColor Cyan
}

if ($failedStaff.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed to add:" -ForegroundColor Red
    foreach ($name in $failedStaff) {
        Write-Host "  - $name" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
