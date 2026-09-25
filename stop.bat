@echo off
title Stop J-Stage Karaoke
echo Menghentikan proses server karaoke pada port 3001 dan 5173...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo Mematikan proses backend (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo Mematikan proses frontend (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo Server telah dihentikan!
timeout /t 2 >nul
exit
