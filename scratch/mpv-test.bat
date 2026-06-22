@echo off
REM Launches the WinForms mpv embedding test (no install needed).
powershell -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0mpv-winforms-test.ps1"
