import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import api from '../../config/api';
import { FaCheck, FaTimes, FaUser, FaShieldAlt, FaSearch } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingSpinner from '../common/LoadingSpinner';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';
import './PermissionTester.css';

const PermissionTester = ({ onClose }) => {
  // Bloquer le scroll du body quand le modal est ouvert
  useModalScrollLock(true);
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedPermission, setSelectedPermission] = useState('');
  const [testResult, setTestResult] = useState(null);

  const { data: users } = useQuery('users-for-test', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.etat === 1) || [];
  });

  const { data: permissions } = useQuery('permissions-for-test', async () => {
    const res = await api.get('/permissions');
    return res.data.data || [];
  });

  const testMutation = useMutation(
    async ({ userId, permissionCode }) => {
      // Utiliser l'API de vérification avec l'ID utilisateur en paramètre
      const res = await api.get(`/permissions/check/${permissionCode}`, {
        params: { user_id: userId }
      });
      return res.data;
    },
    {
      onSuccess: (data) => {
        setTestResult(data);
      },
      onError: (error) => {
        toast.error('Erreur lors du test');
        setTestResult({ hasPermission: false, error: error.message });
      }
    }
  );

  const handleTest = () => {
    if (!selectedUser || !selectedPermission) {
      toast.error('Veuillez sélectionner un utilisateur et une permission');
      return;
    }

    const permission = permissions.find(p => p.id === parseInt(selectedPermission));
    if (!permission) {
      toast.error('Permission non trouvée');
      return;
    }

    testMutation.mutate({
      userId: parseInt(selectedUser),
      permissionCode: permission.code
    });
  };

  const selectedPermissionData = permissions?.find(p => p.id === parseInt(selectedPermission));
  const selectedUserData = users?.find(u => u.id === parseInt(selectedUser));

  return (
    <div className="permission-tester-modal">
      <div className="tester-modal-content">
        <div className="tester-modal-header">
          <h2><FaShieldAlt /> Testeur de Permissions</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="tester-content">
          <div className="tester-form">
            <div className="form-group">
              <label>
                <FaUser /> Utilisateur à tester
              </label>
              <select
                value={selectedUser || ''}
                onChange={(e) => {
                  setSelectedUser(e.target.value ? parseInt(e.target.value) : null);
                  setTestResult(null);
                }}
                className="form-select"
              >
                <option value="">-- Sélectionner un utilisateur --</option>
                {users?.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.pseudo} ({user.fonction_titre || 'N/A'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                <FaShieldAlt /> Permission à tester
              </label>
              <select
                value={selectedPermission}
                onChange={(e) => {
                  setSelectedPermission(e.target.value);
                  setTestResult(null);
                }}
                className="form-select"
              >
                <option value="">-- Sélectionner une permission --</option>
                {permissions?.map(perm => (
                  <option key={perm.id} value={perm.id}>
                    {perm.nom} ({perm.code})
                  </option>
                ))}
              </select>
            </div>

            {selectedPermissionData && (
              <div className="permission-info">
                <h4>Informations sur la permission</h4>
                <p><strong>Nom:</strong> {selectedPermissionData.nom}</p>
                <p><strong>Code:</strong> {selectedPermissionData.code}</p>
                <p><strong>Catégorie:</strong> {selectedPermissionData.categorie}</p>
                {selectedPermissionData.description && (
                  <p><strong>Description:</strong> {selectedPermissionData.description}</p>
                )}
              </div>
            )}

            <button
              className="btn-test"
              onClick={handleTest}
              disabled={!selectedUser || !selectedPermission || testMutation.isLoading}
            >
              {testMutation.isLoading ? 'Test en cours...' : 'Tester la permission'}
            </button>
          </div>

          {testResult && (
            <div className="test-result">
              <h3>Résultat du test</h3>
              <div className={`result-card ${testResult.hasPermission ? 'success' : 'error'}`}>
                <div className="result-icon">
                  {testResult.hasPermission ? <FaCheck /> : <FaTimes />}
                </div>
                <div className="result-content">
                  <h4>
                    {testResult.hasPermission 
                      ? 'Permission accordée' 
                      : 'Permission refusée'}
                  </h4>
                  {selectedUserData && (
                    <p>
                      <strong>Utilisateur:</strong> {selectedUserData.pseudo} 
                      ({selectedUserData.fonction_titre || 'N/A'})
                    </p>
                  )}
                  {selectedPermissionData && (
                    <p>
                      <strong>Permission:</strong> {selectedPermissionData.nom} 
                      ({selectedPermissionData.code})
                    </p>
                  )}
                  {testResult.reason && (
                    <p className="result-reason">
                      <strong>Raison:</strong> {testResult.reason}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PermissionTester;

