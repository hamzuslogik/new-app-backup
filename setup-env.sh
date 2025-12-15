#!/bin/bash

# Script pour créer les fichiers .env à partir des exemples

echo "=========================================="
echo "Configuration des fichiers .env"
echo "=========================================="

# Backend
echo ""
echo "Création du fichier .env pour le backend..."
if [ -f "backend/env.config.example" ]; then
    cp backend/env.config.example backend/.env
    echo "✅ Fichier backend/.env créé avec succès"
else
    echo "❌ Erreur: backend/env.config.example introuvable"
fi

# Frontend
echo ""
echo "Création du fichier .env pour le frontend..."
if [ -f "frontend/env.config.example" ]; then
    cp frontend/env.config.example frontend/.env
    echo "✅ Fichier frontend/.env créé avec succès"
else
    echo "❌ Erreur: frontend/env.config.example introuvable"
fi

echo ""
echo "=========================================="
echo "Configuration terminée !"
echo "=========================================="
echo ""
echo "Vous pouvez maintenant modifier les fichiers .env si nécessaire :"
echo "  - backend/.env"
echo "  - frontend/.env"
echo ""

