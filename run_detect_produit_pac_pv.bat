@echo off
REM ============================================================
REM Execute le script de detection PAC/PV (produit NULL)
REM Sans copier-coller : evite la troncature des lignes en console
REM ============================================================

set MYSQL_USER=root
set MYSQL_DB=crm
set SCRIPT=detect_produit_pac_pv_null.sql

cd /d "%~dp0"
if not exist "%SCRIPT%" (
  echo Fichier introuvable : %SCRIPT%
  pause
  exit /b 1
)

echo Execution de %SCRIPT% sur la base %MYSQL_DB%...
echo.
mysql -u %MYSQL_USER% -p %MYSQL_DB% < "%SCRIPT%"
if errorlevel 1 (
  echo.
  echo Erreur lors de l'execution.
) else (
  echo.
  echo Termine.
)
pause
