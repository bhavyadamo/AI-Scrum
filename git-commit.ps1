# PowerShell script to handle Git commit process
$ErrorActionPreference = "Stop"

# Define commit message
$commitMessage = "Task Distribution - Fixed team workload and iteration path issues"

Write-Host "Adding all changed files..." -ForegroundColor Cyan
git add .

# Check if add was successful
if ($LASTEXITCODE -eq 0) {
    Write-Host "Files staged successfully!" -ForegroundColor Green
    
    # Commit with proper syntax (space after -m)
    Write-Host "Committing changes with message: '$commitMessage'" -ForegroundColor Cyan
    git commit -m "$commitMessage"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Changes committed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to commit changes. Error code: $LASTEXITCODE" -ForegroundColor Red
    }
} else {
    Write-Host "Failed to stage files. Error code: $LASTEXITCODE" -ForegroundColor Red
} 