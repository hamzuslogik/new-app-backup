const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config();

// Importer les routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const userActivityRoutes = require('./routes/userActivity.routes');
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
const signatureRoutes = require('./routes/signature.routes');
const iaAssistanceRoutes = require('./routes/ia-assistance.routes');
const workflowRoutes = require('./routes/workflow.routes');
const statistiqueV2Routes = require('./routes/statistique-v2.routes');
const systemMessagesRoutes = require('./routes/systemMessages.routes');
const alertesRoutes = require('./routes/alertes.routes');
const remarquesRoutes = require('./routes/remarques.routes');
const planningAlertsRoutes = require('./routes/planning-alerts.routes');
const codesSecoursRoutes = require('./routes/codes-secours.routes');
const { ensureGlobalSettingsTable } = require('./utils/globalSettingsHelper');

// Créer l'application Express
const app = express();

// Derrière un reverse proxy (nginx) : req.ip et X-Forwarded-For corrects pour les restrictions IP
if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

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
app.use('/api/user-activity', userActivityRoutes);
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
app.use('/api/signature', signatureRoutes);
app.use('/api/ia-assistance', iaAssistanceRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/statistiques-v2', statistiqueV2Routes);
app.use('/api/system-messages', systemMessagesRoutes);
app.use('/api/alertes', alertesRoutes);
app.use('/api/remarques', remarquesRoutes);
app.use('/api/planning-alerts', planningAlertsRoutes);
app.use('/api/codes-secours', codesSecoursRoutes);

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
  ensureGlobalSettingsTable().catch((err) =>
    console.error('Initialisation global_settings:', err.message)
  );
});

// Démarrer le planificateur de workflows (scheduled)
if (process.env.ENABLE_WORKFLOW_SCHEDULER !== 'false') {
  const { startScheduler } = require('./services/workflow/workflow-scheduler');
  startScheduler();
  console.log('⏰ Planificateur de workflows démarré');
}

module.exports = app;

