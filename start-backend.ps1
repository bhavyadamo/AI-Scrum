# PowerShell script to start the backend
Write-Host "Starting AI-Scrum Backend..." -ForegroundColor Green

# First, try to stop any running instances
$processes = Get-Process -Name "AI-Scrum" -ErrorAction SilentlyContinue
if ($processes) {
    Write-Host "Stopping existing AI-Scrum process(es)..." -ForegroundColor Yellow
    $processes | ForEach-Object { 
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

# Change to the backend directory
Set-Location -Path "$PSScriptRoot\backend"

# Start the backend
Write-Host "Starting backend API..." -ForegroundColor Green
dotnet run

# Note: Script will wait here until the backend is stopped 