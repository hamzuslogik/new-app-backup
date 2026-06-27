import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { FaInfoCircle, FaShieldAlt, FaCopy, FaExternalLinkAlt } from 'react-icons/fa';
import Tooltip from '../common/Tooltip';
import { buildFicheModalExampleUrl } from '../../utils/ficheModalUrlHelp';
import './ManagementTab.css';

const SESSION_PRESETS = ['30m', '1h', '2h', '4h', '8h', '12h', '24h', '7d'];

const EXAMPLE_FICHE_ID = '0666441656';

function copyText(text, label = 'Lien') {
  if (!text) return;
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copié`),
    () => toast.error('Copie impossible')
  );
}

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
  const [loginIpWhitelistText, setLoginIpWhitelistText] = useState('');

  useEffect(() => {
    if (securityData) {
      setSecForm({
        failedLoginMaxBeforeIpBlock: securityData.failedLoginMaxBeforeIpBlock ?? 0,
        failedLoginWindowMinutes: securityData.failedLoginWindowMinutes ?? 60,
        sessionLifetime: securityData.sessionLifetime || '24h'
      });
      const wl = securityData.loginIpWhitelistRules;
      setLoginIpWhitelistText(Array.isArray(wl) && wl.length ? wl.join('\n') : '');
    }
  }, [securityData]);

  const saveLoginWhitelistMutation = useMutation(
    async () => {
      const rules = loginIpWhitelistText
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api.put('/management/global-settings/login-ip-whitelist', { rules });
      return res.data;
    },
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries('global-settings-security');
        toast.success(res?.message || 'Liste blanche enregistrée');
        const wl = res?.data?.loginIpWhitelistRules;
        if (Array.isArray(wl)) {
          setLoginIpWhitelistText(wl.length ? wl.join('\n') : '');
        }
      },
      onError: (err) => {
        toast.error(
          err.response?.data?.message ||
            err.message ||
            'Erreur lors de l’enregistrement de la liste blanche',
          { autoClose: 6000 }
        );
      }
    }
  );

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

  const { data: modalHelp, isLoading: modalHelpLoading } = useQuery(
    'global-settings-fiche-modal-help',
    async () => {
      const res = await api.get('/management/global-settings/fiche-modal-help');
      return res.data?.data;
    }
  );

  const appOrigin = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : ''),
    []
  );

  const exampleUrls = useMemo(
    () => ({
      page: buildFicheModalExampleUrl(appOrigin, EXAMPLE_FICHE_ID, 'page'),
      auto: buildFicheModalExampleUrl(appOrigin, EXAMPLE_FICHE_ID, 'overlay_auto'),
      locked: buildFicheModalExampleUrl(appOrigin, EXAMPLE_FICHE_ID, 'overlay_locked')
    }),
    [appOrigin]
  );

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

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Liste blanche IP (anti-brute-force connexion)
                  <Tooltip text="Une adresse IPv4 ou une plage CIDR par ligne (ex. 203.0.113.10 ou 10.0.0.0/24). Ces origines ne recevront pas HTTP 429 pour trop de mots de passe incorrects.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>
                <textarea
                  className="search-input"
                  rows={6}
                  style={{ width: '100%', maxWidth: '100%', fontFamily: 'monospace', fontSize: 13 }}
                  placeholder={'203.0.113.10\n10.0.0.0/24'}
                  value={loginIpWhitelistText}
                  onChange={(e) => setLoginIpWhitelistText(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: 8 }}
                  disabled={saveLoginWhitelistMutation.isLoading}
                  onClick={() => saveLoginWhitelistMutation.mutate()}
                >
                  {saveLoginWhitelistMutation.isLoading ? 'Enregistrement…' : 'Enregistrer la liste blanche'}
                </button>
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

      <section style={{ marginTop: 32 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', marginBottom: 12 }}>
          <FaExternalLinkAlt /> Modal détail fiche — URLs et fermeture par fonction
        </h3>
        <p style={{ color: '#555', fontSize: 14, marginBottom: 12, maxWidth: 900 }}>
          Les URLs ci-dessous s&apos;appliquent à toutes les fonctions ayant la permission{' '}
          <code>fiches_detail</code>. L&apos;utilisateur doit être connecté. Remplacez{' '}
          <code>{'{identifiant}'}</code> par le hash de la fiche
          {modalHelp?.phoneUrlSearchEnabled !== false
            ? ' ou par un numéro de téléphone (tel, gsm1, gsm2) si la recherche par téléphone est activée.'
            : ' (recherche par téléphone désactivée).'}
        </p>

        {modalHelp?.urlSyntaxNote && (
          <div
            style={{
              padding: '10px 14px',
              marginBottom: 16,
              maxWidth: 900,
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: 8,
              fontSize: 13,
              color: '#664d03'
            }}
          >
            <strong>Syntaxe URL :</strong> {modalHelp.urlSyntaxNote}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: 24,
            maxWidth: 900
          }}
        >
          {[
            {
              key: 'auto',
              title: 'Modal standard (depuis l’app ou lien externe)',
              url: exampleUrls.auto,
              query: '?overlay=auto'
            },
            {
              key: 'locked',
              title: 'Modal verrouillé — Vicidial / intégration (sans clic fond ni Échap)',
              url: exampleUrls.locked,
              query: '?overlay=1&close=0'
            },
            {
              key: 'page',
              title: 'Page plein écran (sans modal)',
              url: exampleUrls.page,
              query: '(aucun paramètre overlay)'
            }
          ].map((item) => (
            <div
              key={item.key}
              style={{
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 8,
                background: '#fafafa'
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{item.title}</div>
              <code style={{ display: 'block', fontSize: 12, wordBreak: 'break-all', marginBottom: 8 }}>
                /fiches/{'{identifiant}'}{item.query.startsWith('?') ? item.query : ''}
              </code>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <code style={{ fontSize: 11, color: '#555', flex: '1 1 200px', wordBreak: 'break-all' }}>
                  {item.url}
                </code>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => copyText(item.url, 'URL')}
                >
                  <FaCopy /> Copier
                </button>
              </div>
            </div>
          ))}
        </div>

        {modalHelpLoading ? (
          <p style={{ color: '#666' }}>Chargement du tableau par fonction…</p>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <table className="data-table" style={{ minWidth: 720, fontSize: 13 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fonction</th>
                  <th>Accès modal</th>
                  <th>Fermeture — modal standard (?overlay=auto)</th>
                  <th>Fermeture — modal verrouillé (?overlay=1&amp;close=0)</th>
                  <th>Page accueil</th>
                </tr>
              </thead>
              <tbody>
                {(modalHelp?.fonctions || []).map((f) => (
                  <tr key={f.id} style={f.active ? undefined : { opacity: 0.55 }}>
                    <td>{f.id}</td>
                    <td>{f.titre}</td>
                    <td>
                      {f.canOpenFicheModal ? (
                        <span style={{ color: '#15803d', fontWeight: 600 }}>Oui</span>
                      ) : (
                        <span style={{ color: '#b91c1c', fontWeight: 600 }}>Non (pas fiches_detail)</span>
                      )}
                    </td>
                    <td>{f.closeRules?.standard?.summary || '—'}</td>
                    <td>{f.closeRules?.locked?.summary || '—'}</td>
                    <td>
                      <code style={{ fontSize: 11 }}>{f.page_accueil}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ color: '#666', fontSize: 12, marginTop: 12, maxWidth: 900 }}>
          Depuis l&apos;application (dashboard, planning commercial, etc.), un clic sur une fiche ouvre le modal
          avec <code>overlay=auto</code> sans modifier l&apos;URL. Le planning commercial peut autoriser la fermeture
          au clic sur le fond pour les commerciaux (<code>allowBackdropClose</code>). À la fermeture d&apos;une URL
          directe <code>/fiches/…?overlay=…</code>, redirection vers la page d&apos;accueil de la fonction.
        </p>
      </section>
    </div>
  );
};

export default GlobalSettingsTab;
