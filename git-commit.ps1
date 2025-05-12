# PowerShell script for Git operations
param(
    [Parameter(Mandatory=$true)]
    [string]$CommitMessage
)

# Display status
Write-Host "Current Git Status:" -ForegroundColor Cyan
git status

# Add all changes
Write-Host "`nAdding all changes..." -ForegroundColor Yellow
git add .

# Commit changes
Write-Host "`nCommitting changes with message: $CommitMessage" -ForegroundColor Green
git commit -m $CommitMessage

# Show status after commit
Write-Host "`nStatus after commit:" -ForegroundColor Cyan
git status

# Push option (commented out by default)
# Write-Host "`nPushing changes to remote..." -ForegroundColor Magenta
# git push 