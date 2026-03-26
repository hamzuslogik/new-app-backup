import React from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import api from '../../config/api';
import './ManagementTab.css';

const GlobalSettingsTab = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    'global-setting-phone-url-search-enabled',
    async () => {
      const res = await api.get('/management/global-settings/phone-url-search-enabled');
      return !!res.data?.data?.enabled;
    }
  );

  const updateMutation = useMutation(
    async (enabled) => {
      const res = await api.put('/management/global-settings/phone-url-search-enabled', { enabled });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('global-setting-phone-url-search-enabled');
      }
    }
  );

  const enabled = !!data;

  return (
    <div className="management-tab">
      <h2>Parametres globaux</h2>
      <p style={{ marginBottom: 16 }}>
        Active ou desactive la resolution automatique d'une fiche par numero dans l'URL
        <code> /fiches/&lt;telephone&gt; </code>
        (recherche sur tel, gsm1, gsm2).
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid #ddd', borderRadius: 8, maxWidth: 720 }}>
        <input
          id="phone-url-search-enabled"
          type="checkbox"
          checked={enabled}
          disabled={isLoading || updateMutation.isLoading}
          onChange={(e) => updateMutation.mutate(e.target.checked)}
        />
        <label htmlFor="phone-url-search-enabled" style={{ margin: 0 }}>
          Autoriser la recherche par telephone dans l'URL
        </label>
        <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
          {enabled ? 'Active' : 'Desactive'}
        </span>
      </div>
    </div>
  );
};

export default GlobalSettingsTab;

