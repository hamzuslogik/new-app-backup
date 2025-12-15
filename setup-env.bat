@echo off
REM Script pour créer les fichiers .env à partir des exemples (Windows)

echo ==========================================
echo Configuration des fichiers .env
echo ==========================================
echo.

REM Backend
echo Création du fichier .env pour le backend...
if exist "backend\env.config.example" (
    copy "backend\env.config.example" "backend\.env" >nul
    echo [OK] Fichier backend\.env créé avec succès
) else (
    echo [ERREUR] backend\env.config.example introuvable
)

REM Frontend
echo.
echo Création du fichier .env pour le frontend...
if exist "frontend\env.config.example" (
    copy "frontend\env.config.example" "frontend\.env" >nul
    echo [OK] Fichier frontend\.env créé avec succès
) else (
    echo [ERREUR] frontend\env.config.example introuvable
)

echo.
echo ==========================================
echo Configuration terminée !
echo ==========================================
echo.
echo Vous pouvez maintenant modifier les fichiers .env si nécessaire :
echo   - backend\.env
echo   - frontend\.env
echo.
pause

