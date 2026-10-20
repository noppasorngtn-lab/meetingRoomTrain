# Install every workspace's dependencies from the repo root.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
npm install
exit $LASTEXITCODE
