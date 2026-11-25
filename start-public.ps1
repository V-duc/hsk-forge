$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "[1/3] Building frontend bundle..." -ForegroundColor Cyan
pnpm build

Write-Host "[2/3] Starting Multi-User SQLite Server on port 8787..." -ForegroundColor Green
$srv = Start-Process -FilePath "node" -ArgumentList "server/index.mjs" -PassThru -NoNewWindow

Start-Sleep -Seconds 1

Write-Host "[3/3] Opening Public HTTPS Tunnel (Cloudflare)..." -ForegroundColor Magenta
try {
  & "D:\Tools\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8787
} finally {
  if ($srv -and -not $srv.HasExited) {
    Stop-Process -Id $srv.Id -Force
  }
}
