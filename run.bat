@echo off
title J-Stage Karaoke Launcher
cd /d "%~dp0"

echo ===================================================
echo           J-STAGE KARAOKE LAUNCHER
echo ===================================================
echo.

:: Cek apakah folder node_modules sudah ada
if not exist "node_modules\" (
    echo [INFO] Direktori node_modules belum ditemukan.
    echo [INFO] Menjalankan npm install terlebih dahulu...
    echo.
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install gagal. Periksa instalasi Node.js atau koneksi internet.
        pause
        exit /b 1
    )
    echo.
)

echo [1/3] Menjalankan Server Backend (Port 3001)...
start "J-Stage - Backend Server" cmd /k "title J-Stage - Backend Server && npm run server"

echo [2/3] Menjalankan Frontend Vite (Port 5173)...
start "J-Stage - Frontend Server" cmd /k "title J-Stage - Frontend Server && npm run dev"

echo [3/3] Menunggu server siap...
timeout /t 3 /nobreak >nul

echo.
echo ===================================================
echo  Aplikasi berhasil dijalankan!
echo  - Backend  : http://localhost:3001
echo  - Frontend : http://localhost:5173
echo ===================================================
echo.
echo Membuka Layar Operator di browser default...
start "" "http://localhost:5173/?view=operator"

echo.
echo Tips:
echo - Layar Operator : http://localhost:5173/?view=operator
echo - Layar Panggung : http://localhost:5173/?view=stage
echo - Jendela server backend dan frontend tetap berjalan.
echo   Tutup jendela tersebut jika ingin mematikan aplikasi.
echo.
pause
