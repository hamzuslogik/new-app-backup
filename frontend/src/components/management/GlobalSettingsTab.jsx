import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { FaInfoCircle, FaShieldAlt } from 'react-icons/fa';
import Tooltip from '../common/Tooltip';
import './ManagementTab.css';

const SESSION_PRESETS = ['30m', '1h', '2h', '4h', '8h', '12h', '24h', '7d'];

const GlobalSettingsTab = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    'global-setting-phone-url-search-enabled',
    async () => {
      const res = await api.get('/management/global-settings/phone-url-search-enabled');
      return !!res.data?.data?.enabled;
    }
  );

  const updatePhoneMutation = useMutation(
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

  const { data: securityData, isLoading: securityLoading } = useQuery(
    'global-settings-security',
    async () => {
      const res = await api.get('/management/global-settings/security');
      return res.data?.data;
    }
  );

  const [secForm, setSecForm] = useState({
    failedLoginMaxBeforeIpBlock: 0,
    failedLoginWindowMinutes: 60,
    sessionLifetime: '24h'
  });

  useEffect(() => {
    if (securityData) {
      setSecForm({
        failedLoginMaxBeforeIpBlock: securityData.failedLoginMaxBeforeIpBlock ?? 0,
        failedLoginWindowMinutes: securityData.failedLoginWindowMinutes ?? 60,
        sessionLifetime: securityData.sessionLifetime || '24h'
      });
    }
  }, [securityData]);

  const saveSecurityMutation = useMutation(
    async () => {
      const res = await api.put('/management/global-settings/security', {
        failedLoginMaxBeforeIpBlock: Number(secForm.failedLoginMaxBeforeIpBlock),
        failedLoginWindowMinutes: Number(secForm.failedLoginWindowMinutes),
        sessionLifetime: String(secForm.sessionLifetime).trim()
      });
      return res.data;
    },
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries('global-settings-security');
        toast.success(res?.message || 'Paramètres de sécurité enregistrés');
        if (res?.data) {
          setSecForm({
            failedLoginMaxBeforeIpBlock: res.data.failedLoginMaxBeforeIpBlock,
            failedLoginWindowMinutes: res.data.failedLoginWindowMinutes,
            sessionLifetime: res.data.sessionLifetime
          });
        }
      },
      onError: (err) => {
        const msg =
          err.response?.data?.message ||
          err.message ||
          'Erreur lors de l’enregistrement des paramètres de sécurité';
        toast.error(msg, { autoClose: 6000 });
      }
    }
  );

  const enabled = !!data;

  return (
    <div className="management-tab">
      <h2>Paramètres globaux</h2>

      <section style={{ marginBottom: 28 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', marginBottom: 12 }}>
            <FaShieldAlt /> Sécurité — connexion
          </h3>
          <p style={{ color: '#555', fontSize: 14, marginBottom: 16, maxWidth: 720 }}>
            Limite les tentatives de connexion échouées par adresse IP (mot de passe incorrect, login
            inconnu, compte désactivé). La durée de session s’applique aux nouveaux jetons JWT émis à la
            connexion (et à la génération de token depuis la gestion).
          </p>

          {securityLoading ? (
            <p style={{ color: '#666' }}>Chargement…</p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                padding: 16,
                border: '1px solid #ddd',
                borderRadius: 8,
                maxWidth: 720
              }}
            >
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Tentatives échouées max avant blocage de l’IP
                  <Tooltip text="Nombre d’échecs dans la fenêtre ci‑dessous : au‑delà, les nouvelles connexions depuis cette IP sont refusées (HTTP 429). 0 = désactivé.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  className="search-input"
                  style={{ maxWidth: 200 }}
                  value={secForm.failedLoginMaxBeforeIpBlock}
                  onChange={(e) =>
                    setSecForm({ ...secForm, failedLoginMaxBeforeIpBlock: e.target.value })
                  }
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Fenêtre de comptage (minutes)
                  <Tooltip text="Les échecs sont comptés sur les dernières N minutes (glissant). Ex. 60 = dernière heure.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <input
                  type="number"
                  min={1}
                  max={10080}
                  className="search-input"
                  style={{ maxWidth: 200 }}
                  value={secForm.failedLoginWindowMinutes}
                  onChange={(e) =>
                    setSecForm({ ...secForm, failedLoginWindowMinutes: e.target.value })
                  }
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Durée de vie de la session (JWT)
                  <Tooltip text="Exemples valides : 30m, 8h, 24h, 7d (voir jsonwebtoken expiresIn). S’applique aux prochaines connexions.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="search-input"
                    style={{ maxWidth: 160 }}
                    placeholder="ex. 8h"
                    value={secForm.sessionLifetime}
                    onChange={(e) => setSecForm({ ...secForm, sessionLifetime: e.target.value })}
                  />
                  <select
                    className="search-input"
                    style={{ maxWidth: 140 }}
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) setSecForm({ ...secForm, sessionLifetime: v });
                    }}
                  >
                    <option value="">Préréglages…</option>
                    {SESSION_PRESETS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                {securityData?.envJwtExpireFallback && (
                  <small style={{ display: 'block', marginTop: 6, color: '#666' }}>
                    Variable d’environnement JWT_EXPIRE (secours si non défini en base) :{' '}
                    <code>{securityData.envJwtExpireFallback}</code>
                  </small>
                )}
              </div>

              <div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={saveSecurityMutation.isLoading}
                  onClick={() => saveSecurityMutation.mutate()}
                >
                  {saveSecurityMutation.isLoading ? 'Enregistrement…' : 'Enregistrer la sécurité'}
                </button>
              </div>
            </div>
          )}
      </section>

      <section>
        <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Fiches / URL</h3>
        <p style={{ marginBottom: 16 }}>
          Active ou désactive la résolution automatique d&apos;une fiche par numéro dans l&apos;URL{' '}
          <code>/fiches/&lt;telephone&gt;</code> (recherche sur tel, gsm1, gsm2).
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            border: '1px solid #ddd',
            borderRadius: 8,
            maxWidth: 720
          }}
        >
          <input
            id="phone-url-search-enabled"
            type="checkbox"
            checked={enabled}
            disabled={isLoading || updatePhoneMutation.isLoading}
            onChange={(e) => updatePhoneMutation.mutate(e.target.checked)}
          />
          <label htmlFor="phone-url-search-enabled" style={{ margin: 0 }}>
            Autoriser la recherche par téléphone dans l&apos;URL
          </label>
          <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
            {enabled ? 'Activé' : 'Désactivé'}
          </span>
        </div>
      </section>
    </div>
  );
};

export default GlobalSettingsTab;
