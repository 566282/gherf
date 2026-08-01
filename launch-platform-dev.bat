@echo off
cd /d "%~dp0platform"
call npm.cmd run dev -- --configLoader runner --host 127.0.0.1 --port 4173
