const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config();

// Importer les routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const ficheRoutes = require('./routes/fiche.routes');
const planningRoutes = require('./routes/planning.routes');
const statistiqueRoutes = require('./routes/statistique.routes');
const messageRoutes = require('./routes/message.routes');
const decalageRoutes = require('./routes/decalage.routes');
const managementRoutes = require('./routes/management.routes');
const affectationRoutes = require('./routes/affectation.routes');
const suiviRoutes = require('./routes/suivi.routes');
const compteRenduRoutes = require('./routes/compte-rendu.routes');
const phase3Routes = require('./routes/phase3.routes');
const permissionsRoutes = require('./routes/permissions.routes');
const importRoutes = require('./routes/import.routes');
const testImportRoutes = require('./routes/test-import.routes');
const notificationRoutes = require('./routes/notification.routes');
const healthRoutes = require('./routes/health.routes');

// Créer l'application Express
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/fiches', ficheRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/statistiques', statistiqueRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/decalages', decalageRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/affectations', affectationRoutes);
app.use('/api/suivi', suiviRoutes);
app.use('/api/compte-rendu', compteRenduRoutes);
app.use('/api/phase3', phase3Routes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/import', testImportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/health', healthRoutes);

// Route de test (déplacée vers health.routes.js)

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route non trouvée' 
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur serveur interne',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📡 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API disponible sur: http://localhost:${PORT}/api`);
});

module.exports = app;

