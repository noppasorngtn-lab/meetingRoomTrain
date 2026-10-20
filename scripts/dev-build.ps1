# Build one app (by its stack name) or every app.
#   powershell -File scripts/dev-build.ps1 -App api
param([string]$App = '')
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$apps = @{ 'api' = 'apps/api'; 'frontend-web' = 'apps/web' }

if ($App -eq '') {
  npm run build --workspaces --if-present
  exit $LASTEXITCODE
}
if (-not $apps.ContainsKey($App)) {
  Write-Error "unknown app '$App' - expected one of: $($apps.Keys -join ', ')"
  exit 2
}
npm run build -w $apps[$App]
exit $LASTEXITCODE
