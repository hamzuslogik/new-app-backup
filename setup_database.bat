@echo off
REM Script pour créer la base de données et l'utilisateur administrateur (Windows)

echo ==========================================
echo Configuration de la base de données CRM
echo ==========================================
echo.

REM Demander les informations de connexion MySQL
set /p DB_HOST="Host MySQL [151.80.58.72]: "
if "%DB_HOST%"=="" set DB_HOST=151.80.58.72

set /p DB_USER="User MySQL [hamzus]: "
if "%DB_USER%"=="" set DB_USER=hamzus

set /p DB_PASS="Password MySQL: "

set /p DB_NAME="Database name [crm]: "
if "%DB_NAME%"=="" set DB_NAME=crm

echo.
echo Création de la base de données et des tables...
mysql -h %DB_HOST% -u %DB_USER% -p%DB_PASS% < database_schema.sql

if %errorlevel% equ 0 (
    echo [OK] Base de données créée avec succès
) else (
    echo [ERREUR] Erreur lors de la création de la base de données
    pause
    exit /b 1
)

echo.
echo Création de l'utilisateur administrateur...
mysql -h %DB_HOST% -u %DB_USER% -p%DB_PASS% %DB_NAME% < insert_admin_user.sql

if %errorlevel% equ 0 (
    echo [OK] Utilisateur administrateur créé avec succès
    echo.
    echo Identifiants par défaut :
    echo   Login: admin
    echo   Mot de passe: admin123
    echo.
    echo ⚠️  IMPORTANT: Changez le mot de passe après la première connexion !
) else (
    echo [ERREUR] Erreur lors de la création de l'utilisateur
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Configuration terminée !
echo ==========================================
pause

