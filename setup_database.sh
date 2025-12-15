#!/bin/bash

# Script pour créer la base de données et l'utilisateur administrateur

echo "=========================================="
echo "Configuration de la base de données CRM"
echo "=========================================="
echo ""

# Demander les informations de connexion MySQL
read -p "Host MySQL [151.80.58.72]: " DB_HOST
DB_HOST=${DB_HOST:-151.80.58.72}

read -p "User MySQL [hamzus]: " DB_USER
DB_USER=${DB_USER:-hamzus}

read -sp "Password MySQL: " DB_PASS
echo ""

read -p "Database name [crm]: " DB_NAME
DB_NAME=${DB_NAME:-crm}

echo ""
echo "Création de la base de données et des tables..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" < database_schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Base de données créée avec succès"
else
    echo "❌ Erreur lors de la création de la base de données"
    exit 1
fi

echo ""
echo "Création de l'utilisateur administrateur..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < insert_admin_user.sql

if [ $? -eq 0 ]; then
    echo "✅ Utilisateur administrateur créé avec succès"
    echo ""
    echo "Identifiants par défaut :"
    echo "  Login: admin"
    echo "  Mot de passe: admin123"
    echo ""
    echo "⚠️  IMPORTANT: Changez le mot de passe après la première connexion !"
else
    echo "❌ Erreur lors de la création de l'utilisateur"
    exit 1
fi

echo ""
echo "=========================================="
echo "Configuration terminée !"
echo "=========================================="

