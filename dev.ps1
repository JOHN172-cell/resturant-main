$port = 4173
$url = "http://localhost:$port/"
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

if (-not $listener) {
  Write-Host "Starting server on port $port..."
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "node"
  $psi.Arguments = "server.js"
  $psi.WorkingDirectory = $PSScriptRoot
  $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Minimized
  $psi.CreateNoWindow = $false
  $proc = [System.Diagnostics.Process]::Start($psi)
  Write-Host "Server PID: $($proc.Id)"
  Start-Sleep -Milliseconds 1500
}

Start-Process $url
Write-Host "Taste Africa is running at $url"
Write-Host "Press Ctrl+C or close this window to stop the server."
Wait-Process -Id (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess) -ErrorAction SilentlyContinue
