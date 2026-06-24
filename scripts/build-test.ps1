# Build & push test images (Windows PowerShell)
# Usage: cd project-root && .\scripts\build-test.ps1 -DockerUser trungdocker123 -ServerIp 34.158.54.48

param(
    [Parameter(Mandatory=$true)]
    [string]$DockerUser,
    [string]$ServerIp = "34.158.54.48"
)

$ErrorActionPreference = "Stop"
$ApiUrl = "http://${ServerIp}:8080"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== Building test images ==="
Write-Host "Project root: $ProjectRoot"
Write-Host "API_URL: $ApiUrl"
Write-Host ""

Write-Host "1. Building moxic-api..."
docker build -f "$ProjectRoot\Dockerfile.api" -t ${DockerUser}/moxic-api:test "$ProjectRoot"

Write-Host "2. Building moxic-web (with VITE_API_URL)..."
docker build -f "$ProjectRoot\Dockerfile.web" --build-arg VITE_API_URL=$ApiUrl -t ${DockerUser}/moxic-web:test "$ProjectRoot"

Write-Host "3. Building moxic-admin (with VITE_API_URL)..."
docker build -f "$ProjectRoot\Dockerfile.admin" --build-arg VITE_API_URL=$ApiUrl -t ${DockerUser}/moxic-admin:test "$ProjectRoot"

Write-Host "4. Pushing images..."
docker push ${DockerUser}/moxic-api:test
docker push ${DockerUser}/moxic-web:test
docker push ${DockerUser}/moxic-admin:test

Write-Host "=== Done ==="
Write-Host ""
Write-Host "On server, run:"
Write-Host "  export DOCKER_USER=${DockerUser}"
Write-Host '  echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USER" --password-stdin'
Write-Host "  docker compose -f docker-compose.test.yml pull"
Write-Host "  docker compose -f docker-compose.test.yml up -d"
