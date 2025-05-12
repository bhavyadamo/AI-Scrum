# Comprehensive rebuild and start script for AI-Scrum project
# Compatible with Windows PowerShell

Write-Host "AI-Scrum Project - Rebuild and Start Script" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Kill any running processes
Write-Host "`nStopping any running processes..." -ForegroundColor Yellow
$backendProcesses = Get-Process -Name "AI-Scrum" -ErrorAction SilentlyContinue
if ($backendProcesses) {
    $backendProcesses | ForEach-Object { 
        try {
            $_ | Stop-Process -Force
            Write-Host "Stopped backend process with ID: $($_.Id)" -ForegroundColor Cyan
        } catch {
            Write-Warning "Could not stop process with ID: $($_.Id)"
        }
    }
}

$ngProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "ng" }
if ($ngProcesses) {
    $ngProcesses | ForEach-Object { 
        try {
            $_ | Stop-Process -Force
            Write-Host "Stopped Angular process with ID: $($_.Id)" -ForegroundColor Cyan
        } catch {
            Write-Warning "Could not stop process with ID: $($_.Id)"
        }
    }
}

# Small delay to ensure processes are fully terminated
Start-Sleep -Seconds 2

# Clean and build backend
Write-Host "`nCleaning and building backend..." -ForegroundColor Green
Set-Location -Path "$PSScriptRoot\backend"
dotnet clean
if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend clean failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

dotnet build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend build failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

# Return to root directory
Set-Location -Path $PSScriptRoot

# Install frontend dependencies and build
Write-Host "`nInstalling frontend dependencies and building..." -ForegroundColor Green
Set-Location -Path "$PSScriptRoot\frontend"
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend npm install failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

# Return to root directory
Set-Location -Path $PSScriptRoot

# Start backend and frontend in separate windows
Write-Host "`nStarting backend and frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$PSScriptRoot\start-backend.ps1'"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$PSScriptRoot\start-frontend.ps1'"

# Display success message
Write-Host "`nBuild and startup complete! Applications are starting in separate windows." -ForegroundColor Cyan
Write-Host "Frontend will be available at: http://localhost:4200" -ForegroundColor Yellow
Write-Host "Backend API will be available at: http://localhost:5000" -ForegroundColor Yellow 