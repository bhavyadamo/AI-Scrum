@echo off
echo Starting both backend and frontend...

echo Starting Backend in a new window...
start cmd /k "cd backend && dotnet run"

echo Starting Frontend in a new window...
start cmd /k "cd frontend && ng serve"

echo.
echo Both applications are starting in separate windows.
echo Frontend will be available at: http://localhost:4200
echo Backend API will be available at: http://localhost:5000
echo. 