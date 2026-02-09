# PowerShell build script for Docker image

param(
    [string]$Tag = "latest"
)

$ImageName = "mcp-session-closer"
$FullImageName = "${ImageName}:${Tag}"

Write-Host "Building Docker image: $FullImageName" -ForegroundColor Cyan

# Build the image
docker build -t $FullImageName .

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Build complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To run the container:" -ForegroundColor Yellow
    Write-Host "  docker run -it -v C:\path\to\workspace:/workspace:rw $FullImageName"
    Write-Host ""
    Write-Host "Or use docker-compose:" -ForegroundColor Yellow
    Write-Host "  docker-compose up"
} else {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

