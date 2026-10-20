# Run unit tests. -Filter matches test names, and every suite names its unit id
# (e.g. "FE-mrr-017"), so -Filter FE-mrr-017 runs exactly that unit's tests.
#   powershell -File scripts/dev-test.ps1 -Filter FE-mrr-017
param([string]$Filter = '', [string]$App = '')
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$apps = @{ 'api' = 'apps/api'; 'frontend-web' = 'apps/web' }
$extra = @()
if ($Filter -ne '') { $extra = @('--', '-t', $Filter) }

if ($App -eq '') {
  npm test --workspaces --if-present @extra
  exit $LASTEXITCODE
}
if (-not $apps.ContainsKey($App)) {
  Write-Error "unknown app '$App' - expected one of: $($apps.Keys -join ', ')"
  exit 2
}
npm test -w $apps[$App] @extra
exit $LASTEXITCODE
