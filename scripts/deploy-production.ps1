# Production Deployment Script
Write-Host "🚀 Starting deployment to PRODUCTION environment..." -ForegroundColor Cyan
Write-Host "📍 Target: dcci-ministries" -ForegroundColor Yellow
Write-Host "🔧 Build Configuration: production" -ForegroundColor Yellow

Write-Host "`n⚠️  WARNING: You are about to deploy to PRODUCTION!" -ForegroundColor Red
Write-Host "This will update the live website at https://dcci-ministries.web.app" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Are you sure you want to continue? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    Read-Host "Press Enter to continue"
    exit 0
}

Write-Host "`n🏗️  Building for production configuration..." -ForegroundColor Green
Write-Host "📦 Building Angular app..." -ForegroundColor Cyan
try {
    ng build --configuration production
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Angular build failed!" -ForegroundColor Red
        Read-Host "Press Enter to continue"
        exit 1
    }
} catch {
    Write-Host "❌ Angular build failed: $_" -ForegroundColor Red
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "`n📦 Building Astro public site..." -ForegroundColor Cyan
try {
    Push-Location "public-site"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Astro build failed!" -ForegroundColor Red
        Pop-Location
        Read-Host "Press Enter to continue"
        exit 1
    }
    Pop-Location
} catch {
    Write-Host "❌ Astro build failed: $_" -ForegroundColor Red
    Pop-Location
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "`n📦 Merging Astro output with Angular build..." -ForegroundColor Cyan
if (-not (Test-Path "dist\public-site")) {
    Write-Host "⚠️  Astro output not found, skipping merge" -ForegroundColor Yellow
} elseif (-not (Test-Path "dist\app")) {
    Write-Host "⚠️  Angular output not found, skipping merge" -ForegroundColor Yellow
} else {
    try {
        Copy-Item -Path "dist\public-site\*" -Destination "dist\app\" -Recurse -Force -Exclude "index.html"
        Write-Host "✅ Astro files merged successfully" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Error merging Astro files: $_" -ForegroundColor Yellow
    }
}

Write-Host "`n🔄 Switching to Firebase project: dcci-ministries" -ForegroundColor Green
try {
    firebase use dcci-ministries
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Firebase project switch failed!" -ForegroundColor Red
        Read-Host "Press Enter to continue"
        exit 1
    }
} catch {
    Write-Host "❌ Firebase project switch failed: $_" -ForegroundColor Red
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "`n🚀 Deploying to Firebase..." -ForegroundColor Green
try {
    firebase deploy --only hosting
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Deployment failed!" -ForegroundColor Red
        Read-Host "Press Enter to continue"
        exit 1
    }
} catch {
    Write-Host "❌ Deployment failed: $_" -ForegroundColor Red
    Read-Host "Press Enter to continue"
    exit 1
}

Write-Host "`n🎉 Deployment to PRODUCTION completed successfully!" -ForegroundColor Green
Write-Host "🌐 Your app is now live at: https://dcci-ministries.web.app" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to continue"
