@echo off
echo 🚀 Starting deployment to PRODUCTION environment...
echo 📍 Target: dcci-ministries
echo 🔧 Build Configuration: production

echo.
echo ⚠️  WARNING: You are about to deploy to PRODUCTION!
echo This will update the live website at https://dcci-ministries.web.app
echo.
set /p confirm="Are you sure you want to continue? (y/N): "
if /i not "%confirm%"=="y" (
    echo Deployment cancelled.
    pause
    exit /b 0
)

echo.
echo 🏗️  Building for production configuration...
echo 📦 Building Angular app...
call ng build --configuration production
if %errorlevel% neq 0 (
    echo ❌ Angular build failed!
    pause
    exit /b 1
)

echo.
echo 📦 Building Astro public site...
cd public-site
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Astro build failed!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo 📦 Merging Astro output with Angular build...
if not exist "dist\public-site" (
    echo ⚠️  Astro output not found, skipping merge
) else if not exist "dist\app" (
    echo ⚠️  Angular output not found, skipping merge
) else (
    robocopy "dist\public-site" "dist\app" /E /XD /XF index.html /NFL /NDL /NJH /NJS >nul 2>&1
    echo ✅ Astro files merged successfully
)

echo.
echo 🔄 Switching to Firebase project: dcci-ministries
call firebase use dcci-ministries
if %errorlevel% neq 0 (
    echo ❌ Firebase project switch failed!
    pause
    exit /b 1
)

echo.
echo 🚀 Deploying to Firebase...
call firebase deploy --only hosting
if %errorlevel% neq 0 (
    echo ❌ Deployment failed!
    pause
    exit /b 1
)

echo.
echo 🎉 Deployment to PRODUCTION completed successfully!
echo 🌐 Your app is now live at: https://dcci-ministries.web.app
echo.
pause
