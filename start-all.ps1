# Script to start both backend and frontend in separate windows
Write-Host "Starting Backend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; dotnet run"

Write-Host "Starting Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; ng serve"

Write-Host "Both applications are starting in separate windows." -ForegroundColor Cyan
Write-Host "Frontend will be available at: http://localhost:4200" -ForegroundColor Yellow
Write-Host "Backend API will be available at: http://localhost:5000" -ForegroundColor Yellow 