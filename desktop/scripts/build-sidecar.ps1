param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

Write-Host "Building LocalChat server sidecar..."

Push-Location $RepoRoot
npm run build -w shared
npm run build -w server
Pop-Location

$binDir = Join-Path $RepoRoot "desktop/src-tauri/bin"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$launcherSource = Join-Path $RepoRoot "desktop/sidecar/launcher.mjs"
$launcherTarget = Join-Path $binDir "localchat-server-x86_64-pc-windows-msvc.exe"

Write-Host "Creating Windows sidecar launcher at $launcherTarget"

@"
@echo off
setlocal
set SCRIPT_DIR=%~dp0
node "%SCRIPT_DIR%launcher.mjs"
"@ | Set-Content -Path $launcherTarget -Encoding ASCII

Copy-Item $launcherSource (Join-Path $binDir "launcher.mjs") -Force

Write-Host "Sidecar launcher ready."
Write-Host "For production, replace the .exe with a pkg-compiled Node binary if desired."
