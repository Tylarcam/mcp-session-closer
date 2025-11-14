# PowerShell script to package Docker image for MCP Session Closer

param(
    [string]$Version = "latest",
    [string]$Registry = ""
)

$ErrorActionPreference = "Stop"

$ImageName = "mcp-session-closer"

Write-Host "🐳 Building Docker image for MCP Session Closer..." -ForegroundColor Cyan
Write-Host "Version: $Version" -ForegroundColor Yellow

# Build the image
docker build -t "${ImageName}:${Version}" .

# Tag as latest if not already
if ($Version -ne "latest") {
    docker tag "${ImageName}:${Version}" "${ImageName}:latest"
}

# If registry is specified, tag and prepare for push
if ($Registry) {
    $FullImageName = "${Registry}/${ImageName}:${Version}"
    docker tag "${ImageName}:${Version}" $FullImageName
    Write-Host "✅ Tagged as $FullImageName" -ForegroundColor Green
    Write-Host "📤 Push with: docker push $FullImageName" -ForegroundColor Yellow
}

Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Image: ${ImageName}:${Version}" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Test: docker run -it --rm ${ImageName}:${Version}"
Write-Host "   2. Enable: docker mcp server enable ${ImageName}"
Write-Host "   3. Connect: docker mcp client connect cursor"
Write-Host "   4. Run: docker mcp gateway run"

