# PowerShell script to start the frontend Angular application
Write-Host "Starting AI-Scrum Frontend..." -ForegroundColor Green

# Try to stop any running Angular processes
$ngProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "ng" }
if ($ngProcesses) {
    Write-Host "Stopping existing Angular process(es)..." -ForegroundColor Yellow
    $ngProcesses | ForEach-Object { 
        try {
            $_ | Stop-Process -Force
            Write-Host "Stopped process with ID: $($_.Id)" -ForegroundColor Cyan
        } catch {
            Write-Warning "Could not stop process with ID: $($_.Id)"
        }
    }
    # Small delay to ensure processes are fully terminated
    Start-Sleep -Seconds 2
}

# Change to the frontend directory
Set-Location -Path "$PSScriptRoot\frontend"

# Start the Angular application
Write-Host "Starting Angular application..." -ForegroundColor Green
ng serve

# Note: Script will wait here until the frontend is stopped 