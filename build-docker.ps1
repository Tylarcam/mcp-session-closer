# PowerShell build script for Docker MCP Session Closer

Write-Host "🐳 Building Docker MCP Session Closer..." -ForegroundColor Cyan

# Build the Docker image
docker build -t session-closer-mcp:latest .

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Enable in Docker MCP: docker mcp server enable session-closer-mcp:latest"
    Write-Host "2. Connect Cursor: docker mcp client connect cursor"
    Write-Host "3. Run gateway: docker mcp gateway run"
} else {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

