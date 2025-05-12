# PowerShell script to run the Azure DevOps fetcher

# Check if node_modules exists
if (-not (Test-Path -Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
}

# Create src directory if it doesn't exist
if (-not (Test-Path -Path "src")) {
    Write-Host "Creating src directory..."
    New-Item -ItemType Directory -Path "src"
}

# Compile TypeScript files
Write-Host "Compiling TypeScript files..."
npm run build

# Run the script
Write-Host "Running Azure DevOps fetcher..."
node dist/test-fetch.js 