param()

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$platformDir = Join-Path $rootDir 'platform'
$examplePath = Join-Path $platformDir '.env.example'
$localPath = Join-Path $platformDir '.env.local'

Write-Host 'Platform local environment setup'
Write-Host 'Enter the Supabase credentials for your local mirror of the live site.'
Write-Host ''

$supabaseUrl = Read-Host 'VITE_SUPABASE_URL'
if ([string]::IsNullOrWhiteSpace($supabaseUrl)) {
  Write-Host 'VITE_SUPABASE_URL is required. No file was written.'
  exit 1
}

$supabaseAnonKey = Read-Host 'VITE_SUPABASE_ANON_KEY'
if ([string]::IsNullOrWhiteSpace($supabaseAnonKey)) {
  Write-Host 'VITE_SUPABASE_ANON_KEY is required. No file was written.'
  exit 1
}

$content = Get-Content -Raw $examplePath
$content = $content -replace '^VITE_SUPABASE_URL=.*$', "VITE_SUPABASE_URL=$supabaseUrl"
$content = $content -replace '^VITE_SUPABASE_ANON_KEY=.*$', "VITE_SUPABASE_ANON_KEY=$supabaseAnonKey"

Set-Content -Path $localPath -Value $content

Write-Host ''
Write-Host "Wrote $localPath"
Write-Host 'You can now relaunch the desktop shortcut.'
