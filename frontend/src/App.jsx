import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Fiches from './pages/Fiches';
import FicheDetail from './pages/FicheDetail';
import FicheDetailRoute from './components/FicheDetailRoute';
import Planning from './pages/Planning';
import PlanningCommercial from './pages/PlanningCommercial';
import PlanningDep from './pages/PlanningDep';
import PlanningHebdomadaire from './pages/PlanningHebdomadaire';
import AffectationDep from './pages/AffectationDep';
import Statistiques from './pages/Statistiques';
import StatistiquesRDV from './pages/StatistiquesRDV';
import StatistiquesFiches from './pages/StatistiquesFiches';
import Affectation from './pages/Affectation';
import SuiviTelepro from './pages/SuiviTelepro';
import SuiviAgentsQualif from './pages/SuiviAgentsQualif';
import SuiviAgents from './pages/SuiviAgents';
import ProductionQualif from './pages/ProductionQualif';
import ControleQualite from './pages/ControleQualite';
import CompteRendu from './pages/CompteRendu';
import CompteRenduPending from './pages/CompteRenduPending';
import Phase3 from './pages/Phase3';
import Permissions from './pages/Permissions';
import ImportMasse from './pages/ImportMasse';
import Messages from './pages/Messages';
import Users from './pages/Users';
import Management from './pages/Management';
import Decalages from './pages/Decalages';
import Validation from './pages/Validation';
import DemandesInsertion from './pages/DemandesInsertion';
import Notifications from './pages/Notifications';
import Layout from './components/Layout';
import HomeRedirect from './components/HomeRedirect';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<HomeRedirect />} />
          <Route path="dashboard" element={<ProtectedRoute permission="dashboard_view"><Dashboard /></ProtectedRoute>} />
          <Route path="fiches" element={<ProtectedRoute permission="fiches_view"><Fiches /></ProtectedRoute>} />
          <Route path="fiches/:id" element={<ProtectedRoute permission="fiches_detail"><FicheDetailRoute /></ProtectedRoute>} />
          <Route path="planning" element={<ProtectedRoute permission="planning_view"><Planning /></ProtectedRoute>} />
          <Route path="planning-dep" element={<ProtectedRoute permission="planning_view"><PlanningDep /></ProtectedRoute>} />
          <Route path="planning-commercial" element={<ProtectedRoute permission="planning_commercial_view"><PlanningCommercial /></ProtectedRoute>} />
          <Route path="planning-hebdomadaire" element={<ProtectedRoute permission="planning_view"><PlanningHebdomadaire /></ProtectedRoute>} />
          <Route path="affectation-dep" element={<ProtectedRoute permission="affectation_view"><AffectationDep /></ProtectedRoute>} />
          <Route path="statistiques" element={<ProtectedRoute permission="statistiques_view"><Statistiques /></ProtectedRoute>} />
          <Route path="statistiques-rdv" element={<ProtectedRoute permission="statistiques_rdv_view"><StatistiquesRDV /></ProtectedRoute>} />
          <Route path="statistiques-fiches" element={<StatistiquesFiches />} />
          <Route path="affectation" element={<ProtectedRoute permission="affectation_view"><Affectation /></ProtectedRoute>} />
          <Route path="suivi-telepro" element={<ProtectedRoute permission="suivi_telepro_view"><SuiviTelepro /></ProtectedRoute>} />
          <Route path="suivi-agents-qualif" element={<ProtectedRoute permission="suivi_agents_view"><SuiviAgentsQualif /></ProtectedRoute>} />
          <Route path="suivi-agents" element={<ProtectedRoute permission="suivi_agents_view"><SuiviAgents /></ProtectedRoute>} />
          <Route path="production-qualif" element={<ProtectedRoute permission="production_qualif_view"><ProductionQualif /></ProtectedRoute>} />
          <Route path="controle-qualite" element={<ProtectedRoute permission="controle_qualite_view"><ControleQualite /></ProtectedRoute>} />
          <Route path="compte-rendu" element={<ProtectedRoute permission="compte_rendu_view"><CompteRendu /></ProtectedRoute>} />
          <Route path="compte-rendu-pending" element={<ProtectedRoute permission={null} customCheck={(item, user) => [1, 2, 5, 7].includes(user?.fonction)}><CompteRenduPending /></ProtectedRoute>} />
          <Route path="phase3" element={<ProtectedRoute permission="phase3_view"><Phase3 /></ProtectedRoute>} />
          <Route path="permissions" element={<ProtectedRoute permission="config_permissions" excludeFunctions={[8]}><Permissions /></ProtectedRoute>} />
          <Route path="import-masse" element={<ProtectedRoute permission="import_masse_view" excludeFunctions={[8]}><ImportMasse /></ProtectedRoute>} />
          <Route path="messages" element={<ProtectedRoute permission="messages_view"><Messages /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute permission="users_view"><Users /></ProtectedRoute>} />
          <Route path="management" element={<ProtectedRoute permission="management_view" excludeFunctions={[8]}><Management /></ProtectedRoute>} />
          <Route path="decalages" element={<ProtectedRoute permission="decalage_view"><Decalages /></ProtectedRoute>} />
          <Route path="validation" element={<ProtectedRoute permission="validation_view"><Validation /></ProtectedRoute>} />
          <Route path="demandes-insertion" element={<ProtectedRoute permission={null} customCheck={(item, user) => [1, 2, 7, 11].includes(user?.fonction)}><DemandesInsertion /></ProtectedRoute>} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;

