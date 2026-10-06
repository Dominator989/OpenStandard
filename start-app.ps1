$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

function Write-Step($message) {
    Write-Host "[AccessLens] $message" -ForegroundColor Cyan
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js 20 or newer is required. Install it from https://nodejs.org/ and run this script again."
}

$nodeVersion = (node --version).TrimStart("v")
$nodeMajor = [int]($nodeVersion.Split(".")[0])
if ($nodeMajor -lt 20) {
    throw "Node.js 20 or newer is required. Found Node.js $nodeVersion."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found. Reinstall Node.js 20 or newer and run this script again."
}

if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
    Write-Step "Installing dependencies..."
    npm install
}

$playwrightCache = Join-Path $env:USERPROFILE "AppData\Local\ms-playwright"
$chromiumInstalled = Test-Path $playwrightCache
if (-not $chromiumInstalled) {
    Write-Step "Installing the Chromium browser used for scans..."
    npx playwright install chromium
}

Write-Step "Starting the development server..."
Write-Host "[AccessLens] Open http://localhost:3100 in your browser." -ForegroundColor Green
npm run dev
