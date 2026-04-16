@echo off
echo ============================================
echo  Pharmaceutical Cold Chain Monitoring
echo  ML-Based Anomaly Detection System
echo ============================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    echo This may take a few minutes...
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to install dependencies
        echo Make sure Node.js is installed
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
    echo.
)

echo Starting server...
echo.
echo Dashboard will be available at:
echo   http://localhost:3000
echo.
echo API endpoints at:
echo   http://localhost:3000/api
echo.
echo Press Ctrl+C to stop the server
echo ============================================
echo.

npm start

pause
