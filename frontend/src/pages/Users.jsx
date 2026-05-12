import React from 'react';
import UtilisateursTab from '../components/management/UtilisateursTab';
import './Users.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const Users = () => {
  useForceDesktopViewport('users-page');
  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Gestion des Utilisateurs</h1>
      </div>
      <UtilisateursTab />
    </div>
  );
};

export default Users;

