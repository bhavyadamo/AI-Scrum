# PowerShell-friendly script to run the application
$ErrorActionPreference = "Stop"

function Start-Backend {
    Write-Host "Building backend..." -ForegroundColor Cyan
    Set-Location -Path "$PSScriptRoot\backend"
    dotnet build
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Starting backend server..." -ForegroundColor Green
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location -Path '$PSScriptRoot\backend'; dotnet run"
    } else {
        Write-Host "Backend build failed with exit code $LASTEXITCODE" -ForegroundColor Red
        return $false
    }
    return $true
}

function Start-Frontend {
    Write-Host "Starting frontend server..." -ForegroundColor Green
    Set-Location -Path "$PSScriptRoot\frontend"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location -Path '$PSScriptRoot\frontend'; ng serve"
    return $true
}

# Main execution
Write-Host "Starting AI-Scrum application..." -ForegroundColor Yellow

$backendSuccess = Start-Backend
if ($backendSuccess) {
    $frontendSuccess = Start-Frontend
    
    if ($frontendSuccess) {
        Write-Host "`nApplication started successfully!" -ForegroundColor Green
        Write-Host "Frontend will be available at: http://localhost:4200" -ForegroundColor Yellow
        Write-Host "Backend API will be available at: http://localhost:5000" -ForegroundColor Yellow
    } else {
        Write-Host "Failed to start frontend" -ForegroundColor Red
    }
} else {
    Write-Host "Failed to start backend" -ForegroundColor Red
}

# Return to the root directory
Set-Location -Path $PSScriptRoot 