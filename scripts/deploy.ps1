<#
.SYNOPSIS
  Build & push Moxic images từ Windows lên Docker Hub.
.DESCRIPTION
  Script đọc .env.production, build 3 images (api, web, admin),
  push tag :latest lên Docker Hub.

.PARAMETER DockerUser
  Tên Docker Hub user (VD: trungdocker123).
.PARAMETER ImageTag
  Tag cho images (mặc định: latest).
.PARAMETER NoPush
  Nếu có, chỉ build không push.
.PARAMETER VersionTag
  Tag thêm version (VD: 20260625.1) để rollback sau.

.EXAMPLE
  .\scripts\deploy.ps1 -DockerUser trungdocker123
  .\scripts\deploy.ps1 -DockerUser trungdocker123 -ImageTag test -NoPush
  .\scripts\deploy.ps1 -DockerUser trungdocker123 -VersionTag 20260625.1
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$DockerUser,

    [string]$ImageTag = "latest",

    [switch]$NoPush,

    [string]$VersionTag = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ApiUrl = "https://api.moxic.co"

Write-Host "=== Moxic Build & Push ===" -ForegroundColor Cyan
Write-Host "User:     $DockerUser"
Write-Host "Tag:      $ImageTag"
if ($VersionTag) { Write-Host "Version:  $VersionTag" }
Write-Host "API URL:  $ApiUrl"
Write-Host ""

# 1. Build API
Write-Host "[1/3] Building moxic-api..." -ForegroundColor Yellow
docker build -f "$ProjectRoot\Dockerfile.api" `
    -t "${DockerUser}/moxic-api:${ImageTag}" `
    "$ProjectRoot"

# Tag thêm version nếu có
if ($VersionTag) {
    docker tag "${DockerUser}/moxic-api:${ImageTag}" "${DockerUser}/moxic-api:${VersionTag}"
}

# 2. Build Web (Storefront) với VITE_API_URL
Write-Host "[2/3] Building moxic-web (VITE_API_URL=${ApiUrl})..." -ForegroundColor Yellow
docker build -f "$ProjectRoot\Dockerfile.web" `
    --build-arg "VITE_API_URL=${ApiUrl}/api" `
    -t "${DockerUser}/moxic-web:${ImageTag}" `
    "$ProjectRoot"

if ($VersionTag) {
    docker tag "${DockerUser}/moxic-web:${ImageTag}" "${DockerUser}/moxic-web:${VersionTag}"
}

# 3. Build Admin với VITE_API_URL
Write-Host "[3/3] Building moxic-admin (VITE_API_URL=${ApiUrl})..." -ForegroundColor Yellow
docker build -f "$ProjectRoot\Dockerfile.admin" `
    --build-arg "VITE_API_URL=${ApiUrl}" `
    -t "${DockerUser}/moxic-admin:${ImageTag}" `
    "$ProjectRoot"

if ($VersionTag) {
    docker tag "${DockerUser}/moxic-admin:${ImageTag}" "${DockerUser}/moxic-admin:${VersionTag}"
}

# 4. Push
if (-not $NoPush) {
    Write-Host "`n=== Pushing images ===" -ForegroundColor Cyan
    docker push "${DockerUser}/moxic-api:${ImageTag}"
    docker push "${DockerUser}/moxic-web:${ImageTag}"
    docker push "${DockerUser}/moxic-admin:${ImageTag}"

    if ($VersionTag) {
        docker push "${DockerUser}/moxic-api:${VersionTag}"
        docker push "${DockerUser}/moxic-web:${VersionTag}"
        docker push "${DockerUser}/moxic-admin:${VersionTag}"
    }

    Write-Host "`n=== Push done ===" -ForegroundColor Green
} else {
    Write-Host "`n=== Build done (--NoPush, skipping push) ===" -ForegroundColor Green
}

# 5. In lệnh deploy
Write-Host "`n=== Deploy commands (run on server) ===" -ForegroundColor Cyan
Write-Host "ssh root@34.158.54.48"
Write-Host "cd /opt/moxic"
Write-Host 'echo "$DOCKER_PASSWORD" | docker login -u "'${DockerUser}'" --password-stdin'
Write-Host "docker compose pull"
Write-Host "docker compose up -d --force-recreate"
Write-Host "docker image prune -f"
Write-Host ""

if ($VersionTag) {
    Write-Host "Rollback images available: ${DockerUser}/moxic-*:${VersionTag}" -ForegroundColor Gray
}
