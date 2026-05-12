import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaUpload, FaFileExcel, FaFileCsv, FaCheck, FaTimes, FaDownload, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from 'axios';
import './ImportMasse.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const SESSION_STORAGE_JOB_KEY = 'import_masse_job_id';
const SESSION_STORAGE_RESULT_KEY = 'import_masse_last_result';

function getStoredImportResult() {
  try {
    const s = sessionStorage.getItem(SESSION_STORAGE_RESULT_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

// Construit l'objet "résultat" attendu par l'UI à partir de la réponse progression
function progressToResult(data) {
  if (!data) return null;
  return {
    inserted: data.inserted ?? 0,
    duplicates: data.duplicates ?? 0,
    errors: data.errors ?? (data.errorsList?.length ?? 0),
    total: data.total ?? 0,
    duplicatesList: data.duplicatesList ?? [],
    errorsList: data.errorsList ?? [],
    notInserted: data.notInserted ?? { total: 0, list: [] },
    cancelled: data.cancelled ?? false
  };
}

const ImportMasse = () => {
  useForceDesktopViewport('import-masse-page');
  const { user, hasPermission } = useAuth();
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [fileColumns, setFileColumns] = useState([]);
  const [dbFields, setDbFields] = useState([]);
  const [tempFile, setTempFile] = useState(null);
  const [importResult, setImportResult] = useState(() => getStoredImportResult());
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCentre, setSelectedCentre] = useState(user?.centre || '');
  const [selectedProduit, setSelectedProduit] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [activeJobId, setActiveJobId] = useState(() => sessionStorage.getItem(SESSION_STORAGE_JOB_KEY) || null);
  const abortControllerRef = useRef(null);

  // Récupérer la liste des centres
  const { data: centresData } = useQuery('centres', async () => {
    const res = await api.get('/management/centres');
    return res.data.data || [];
  });

  // Récupérer la liste des produits
  const { data: produitsData } = useQuery('produits', async () => {
    const res = await api.get('/management/produits');
    return res.data.data || [];
  });

  // Récupérer la liste des utilisateurs (pour le choix de l'agent assigné aux fiches importées)
  const { data: usersData } = useQuery('users', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data || [];
  });
  // Afficher uniquement les utilisateurs de fonction backoffice (fonction 11)
  const agentsList = (usersData || []).filter(u => u.etat > 0 && Number(u.fonction) === 11);

  // Polling de la progression d'un import en cours (persisté via sessionStorage)
  const { data: progressResponse, isError: progressError, error: progressErr } = useQuery(
    ['importProgress', activeJobId],
    async () => {
      const res = await api.get(`/import/progress/${activeJobId}`);
      return res.data;
    },
    {
      enabled: !!activeJobId,
      refetchInterval: 1500,
      retry: false,
      refetchOnWindowFocus: true
    }
  );

  const progressData = progressResponse?.data;

  // Si le job n'existe plus (ex. serveur redémarré), nettoyer
  useEffect(() => {
    if (!activeJobId || !progressError) return;
    const status = progressErr?.response?.status;
    if (status === 404 || status === 403) {
      sessionStorage.removeItem(SESSION_STORAGE_JOB_KEY);
      setActiveJobId(null);
      toast.warn('Import introuvable ou terminé (session expirée).');
    }
  }, [activeJobId, progressError, progressErr]);

  // Quand le job est terminé (completed / cancelled / failed), afficher le résultat, le persister et nettoyer
  useEffect(() => {
    if (!activeJobId || !progressData) return;
    const status = progressData.status;
    if (status !== 'completed' && status !== 'cancelled' && status !== 'failed') return;

    const result = progressToResult(progressData);
    setImportResult(result);
    try {
      sessionStorage.setItem(SESSION_STORAGE_RESULT_KEY, JSON.stringify(result));
    } catch (e) {
      console.warn('Impossible de sauvegarder le résultat d\'import', e);
    }
    sessionStorage.removeItem(SESSION_STORAGE_JOB_KEY);
    setActiveJobId(null);
    setIsProcessing(false);

    if (status === 'cancelled') {
      toast.info(`Import annulé. ${progressData.inserted ?? 0} fiche(s) insérée(s) avant annulation.`);
    } else if (status === 'completed') {
      toast.success(`Import terminé: ${progressData.inserted ?? 0} fiches insérées`);
    } else if (status === 'failed') {
      toast.error(progressData.error || 'Erreur lors de l\'import');
    }
  }, [activeJobId, progressData]);

  // Mutation pour prévisualiser le fichier
  const previewMutation = useMutation(
    async (formData) => {
      const res = await api.post('/import/preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data;
    },
    {
      onSuccess: (data) => {
        if (data.success) {
          setPreviewData(data.data);
          setFileColumns(data.data.fileColumns);
          setDbFields(data.fields);
          setTempFile(data.data.tempFile);
          
          // Initialiser le mapping avec des suggestions automatiques
          const autoMapping = {};
          data.data.fileColumns.forEach(fileCol => {
            const fileColLower = fileCol.toLowerCase().trim();
            // Chercher une correspondance approximative
            const matchedField = data.fields.find(field => {
              const fieldLower = field.name.toLowerCase();
              return fieldLower === fileColLower || 
                     fieldLower.includes(fileColLower) || 
                     fileColLower.includes(fieldLower);
            });
            if (matchedField) {
              autoMapping[matchedField.name] = fileCol;
            }
          });
          setMapping(autoMapping);
          
          toast.success(`Fichier chargé: ${data.data.totalRows} lignes détectées`);
        }
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors du chargement du fichier');
      }
    }
  );

  // Mutation pour traiter l'import (retourne immédiatement un jobId, progression via polling)
  const importMutation = useMutation(
    async (data) => {
      abortControllerRef.current = new AbortController();
      const res = await api.post('/import/process', data, {
        signal: abortControllerRef.current.signal
      });
      return res.data;
    },
    {
      onSuccess: (data) => {
        if (data.success && data.jobId) {
          sessionStorage.setItem(SESSION_STORAGE_JOB_KEY, data.jobId);
          setActiveJobId(data.jobId);
          setIsProcessing(false);
          toast.info('Import démarré. Vous pouvez quitter la page ; la progression sera conservée.');
        }
      },
      onError: (error) => {
        setIsProcessing(false);
        if (axios.isCancel(error)) {
          toast.info('Import annulé');
          return;
        }
        const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Erreur lors de l\'import';
        toast.error(errorMessage);
        console.error('Erreur import:', error.response?.data || error);
      }
    }
  );

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewData(null);
      setImportResult(null);
      setMapping({});
    }
  };

  const handleUpload = () => {
    if (!file) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    previewMutation.mutate(formData);
  };

  const handleMappingChange = (dbField, fileColumn) => {
    setMapping(prev => ({
      ...prev,
      [dbField]: fileColumn || null
    }));
  };

  const handleImport = () => {
    // Vérifier qu'au moins un numéro de téléphone est mappé (tel, gsm1 ou gsm2)
    const hasPhoneMapping = mapping.tel || mapping.gsm1 || mapping.gsm2;
    if (!hasPhoneMapping) {
      toast.error('Au moins un champ de téléphone (tel, gsm1 ou gsm2) doit être mappé (obligatoire)');
      return;
    }

    // Vérifier qu'un centre est sélectionné
    if (!selectedCentre) {
      toast.error('Veuillez sélectionner un centre');
      return;
    }

    // Vérifier qu'un produit est sélectionné
    if (!selectedProduit) {
      toast.error('Veuillez sélectionner un produit');
      return;
    }

    // Vérifier qu'un agent est sélectionné
    if (!selectedAgent) {
      toast.error('Veuillez sélectionner un agent');
      return;
    }

    setIsProcessing(true);
    setImportResult(null);
    importMutation.mutate({
      mapping,
      tempFile,
      skipDuplicates: false,
      id_centre: selectedCentre,
      produit: selectedProduit,
      id_agent: selectedAgent
    });
  };

  const handleCancelImport = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (activeJobId) {
      try {
        await api.post(`/import/cancel/${activeJobId}`);
        toast.info('Annulation demandée…');
      } catch (err) {
        toast.error(err.response?.data?.message || 'Erreur lors de l\'annulation');
      }
    }
    setIsProcessing(false);
  };

  const handleReset = () => {
    setFile(null);
    setPreviewData(null);
    setMapping({});
    setFileColumns([]);
    setDbFields([]);
    setTempFile(null);
    setImportResult(null);
    setIsProcessing(false);
    setActiveJobId(null);
    sessionStorage.removeItem(SESSION_STORAGE_JOB_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_RESULT_KEY);
    setSelectedCentre(user?.centre || '');
    setSelectedProduit('');
    setSelectedAgent('');
  };

  if (!hasPermission('fiches_create')) {
    return (
      <div className="import-masse-page">
        <div className="error-message">
          <h2>Accès refusé</h2>
          <p>Vous n'avez pas la permission de créer des fiches.</p>
        </div>
      </div>
    );
  }

  const isJobRunning = progressData?.status === 'running';

  return (
    <div className="import-masse-page">
      <div className="import-header">
        <h1><FaUpload /> Import en Masse</h1>
        <p className="subtitle">Importez des fiches depuis un fichier CSV ou Excel</p>
      </div>

      {/* Progression de l'import (visible même après avoir quitté la page) */}
      {activeJobId && (
        <div className="import-progress-section">
          <h2>Progression de l'import</h2>
          {!progressData ? (
            <div className="progress-loading">
              <FaSpinner className="spinner" /> Chargement de la progression…
            </div>
          ) : (
            <>
              <div className="progress-stats">
                <span className="progress-stat">
                  Traité: <strong>{progressData.processed ?? 0}</strong> / {progressData.total ?? 0}
                </span>
                <span className="progress-stat">
                  Insérées: <strong>{progressData.inserted ?? 0}</strong>
                </span>
                <span className="progress-stat">
                  Erreurs: <strong>{progressData.errors ?? 0}</strong>
                </span>
                <span className="progress-stat progress-status">
                  Statut: {isJobRunning ? 'En cours…' : progressData.status === 'cancelled' ? 'Annulé' : progressData.status === 'completed' ? 'Terminé' : progressData.status === 'failed' ? 'Échec' : progressData.status}
                </span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progressData.total ? Math.min(100, (100 * (progressData.processed ?? 0)) / progressData.total) : 0}%` }}
                />
              </div>
              {isJobRunning && (
                <div className="progress-actions">
                  <button type="button" className="btn-cancel-import" onClick={handleCancelImport}>
                    <FaTimes /> Annuler l'import
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!previewData && !activeJobId && (
        <div className="upload-section">
          <div className="upload-box">
            <FaUpload className="upload-icon" />
            <h3>Sélectionner un fichier</h3>
            <p>Formats supportés: CSV, XLSX, XLS, JSON, JSONL</p>
            <input
              type="file"
              id="file-input"
              accept=".csv,.xlsx,.xls,.json,.jsonl"
              onChange={handleFileChange}
              className="file-input"
            />
            <label htmlFor="file-input" className="file-label">
              {file ? file.name : 'Choisir un fichier'}
            </label>
            {file && (
              <button
                className="btn-upload"
                onClick={handleUpload}
                disabled={previewMutation.isLoading}
              >
                {previewMutation.isLoading ? (
                  <>
                    <FaSpinner className="spinner" /> Chargement...
                  </>
                ) : (
                  <>
                    <FaUpload /> Charger et prévisualiser
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {previewData && !importResult && (
        <div className="mapping-section">
          <div className="mapping-header">
            <h2>Mapping des colonnes</h2>
            <p>Associez chaque colonne du fichier aux champs de la base de données</p>
            <div className="mapping-info">
              <span className="info-item">
                <FaFileCsv /> {previewData.totalRows} lignes détectées
              </span>
              <span className="info-item">
                {fileColumns.length} colonnes dans le fichier
              </span>
            </div>
          </div>

          {/* Sélection du centre et du produit */}
          <div className="selection-group">
            <div className="centre-selection">
              <label htmlFor="centre-select">
                <strong>Centre *</strong>
              </label>
              <select
                id="centre-select"
                value={selectedCentre}
                onChange={(e) => setSelectedCentre(e.target.value)}
                className="centre-select"
                required
              >
                <option value="">-- Sélectionner un centre --</option>
                {centresData
                  ?.filter(c => {
                    // Filtrer par état actif
                    if (c.etat <= 0) return false;
                    // Admin (1, 2, 7), backoffice (11), RP confirmation (13) : voir tous les centres
                    if ([1, 2, 7, 11, 13].includes(Number(user?.fonction))) return true;
                    // Les autres utilisateurs ne peuvent voir que leur propre centre
                    return c.id === user?.centre;
                  })
                  .map(centre => (
                    <option key={centre.id} value={centre.id}>
                      {centre.titre}
                    </option>
                  ))}
              </select>
              <p className="selection-help">Toutes les fiches importées seront associées à ce centre</p>
            </div>

            <div className="produit-selection">
              <label htmlFor="produit-select">
                <strong>Produit *</strong>
              </label>
              <select
                id="produit-select"
                value={selectedProduit}
                onChange={(e) => setSelectedProduit(e.target.value)}
                className="produit-select"
                required
              >
                <option value="">-- Sélectionner un produit --</option>
                {produitsData?.map(produit => (
                  <option key={produit.id} value={produit.id}>
                    {produit.nom}
                  </option>
                ))}
              </select>
              <p className="selection-help">Toutes les fiches importées seront associées à ce produit</p>
            </div>

            <div className="agent-selection">
              <label htmlFor="agent-select">
                <strong>Agent *</strong>
              </label>
              <select
                id="agent-select"
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="agent-select"
                required
              >
                <option value="">-- Sélectionner un agent --</option>
                {agentsList.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.pseudo || agent.nom || agent.login || `ID ${agent.id}`}
                  </option>
                ))}
              </select>
              <p className="selection-help">Toutes les fiches importées seront assignées à cet agent (liste des utilisateurs backoffice)</p>
            </div>
          </div>

          <div className="mapping-table-container">
            <table className="mapping-table">
              <thead>
                <tr>
                  <th>Champ Base de Données</th>
                  <th>Type</th>
                  <th>Colonne du Fichier</th>
                  <th>Obligatoire</th>
                </tr>
              </thead>
              <tbody>
                {dbFields.map(field => (
                  <tr key={field.name} className={!field.nullable && !mapping[field.name] ? 'required-missing' : ''}>
                    <td>
                      <strong>{field.name}</strong>
                    </td>
                    <td>
                      <span className="field-type">{field.type}</span>
                    </td>
                    <td>
                      <select
                        value={mapping[field.name] || ''}
                        onChange={(e) => handleMappingChange(field.name, e.target.value)}
                        className="mapping-select"
                      >
                        <option value="">-- Aucune correspondance --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {!field.nullable && (
                        <span className="required-badge">Obligatoire</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="preview-section">
            <h3>Aperçu des données (10 premières lignes)</h3>
            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    {fileColumns.map(col => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.previewData.slice(0, 10).map((row, idx) => (
                    <tr key={idx}>
                      {fileColumns.map(col => (
                        <td key={col}>{row[col] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mapping-actions">
            <button
              className="btn-import"
              onClick={handleImport}
              disabled={isProcessing || !!activeJobId || !(mapping.tel || mapping.gsm1 || mapping.gsm2) || !selectedCentre || !selectedProduit || !selectedAgent}
            >
              {isProcessing ? (
                <>
                  <FaSpinner className="spinner" /> Démarrage...
                </>
              ) : activeJobId ? (
                <>
                  <FaSpinner className="spinner" /> Import en cours (voir ci-dessus)
                </>
              ) : (
                <>
                  <FaUpload /> Importer les fiches
                </>
              )}
            </button>
            {isProcessing || activeJobId ? (
              <button
                type="button"
                className="btn-cancel-import"
                onClick={handleCancelImport}
              >
                <FaTimes /> Annuler l'import
              </button>
            ) : (
              <button
                className="btn-reset"
                onClick={handleReset}
              >
                <FaTimes /> Réinitialiser
              </button>
            )}
          </div>
        </div>
      )}

      {importResult && (
        <div className="result-section">
          <div className="result-header">
            <h2>Résultats de l'import</h2>
          </div>

          <div className="result-stats">
            <div className="stat-card success">
              <div className="stat-value">{importResult.inserted}</div>
              <div className="stat-label">Fiches insérées</div>
            </div>
            <div className="stat-card warning">
              <div className="stat-value">{importResult.duplicates}</div>
              <div className="stat-label">Doublons détectés</div>
            </div>
            <div className="stat-card error">
              <div className="stat-value">{importResult.errors}</div>
              <div className="stat-label">Erreurs</div>
            </div>
            <div className="stat-card info">
              <div className="stat-value">{importResult.total}</div>
              <div className="stat-label">Total traité</div>
            </div>
          </div>

          {importResult.duplicatesList && importResult.duplicatesList.length > 0 && (
            <div className="duplicates-section">
              <h3>Contacts refusés (doublons)</h3>
              <div className="duplicates-table-container">
                <table className="duplicates-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Prénom</th>
                      <th>Téléphone</th>
                      <th>GSM1</th>
                      <th>GSM2</th>
                      <th>Raison</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.duplicatesList.map((dup, idx) => (
                      <tr key={idx}>
                        <td>{dup.nom || 'N/A'}</td>
                        <td>{dup.prenom || 'N/A'}</td>
                        <td>{dup.tel || 'N/A'}</td>
                        <td>{dup.gsm1 || 'N/A'}</td>
                        <td>{dup.gsm2 || 'N/A'}</td>
                        <td className="reason-cell">{dup.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importResult.errorsList && importResult.errorsList.length > 0 && (
            <div className="errors-section">
              <h3>Erreurs lors de l'insertion</h3>
              <div className="errors-table-container">
                <table className="errors-table">
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Erreur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.errorsList.map((error, idx) => (
                      <tr key={idx}>
                        <td>
                          {error.contact.nom || 'N/A'} {error.contact.prenom || 'N/A'} - 
                          Tel: {error.contact.tel || 'N/A'}
                        </td>
                        <td className="error-cell">{error.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importResult.notInserted && importResult.notInserted.list && importResult.notInserted.list.length > 0 && (
            <div className="not-inserted-section">
              <div className="section-header">
                <h3>Contacts non insérés ({importResult.notInserted.total})</h3>
                {importResult.downloadFile && (
                  <a
                    href={`${api.defaults.baseURL}${importResult.downloadFile}`}
                    download
                    className="btn-download"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FaDownload /> Télécharger le fichier CSV
                  </a>
                )}
              </div>
              <div className="not-inserted-table-container">
                <table className="not-inserted-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Prénom</th>
                      <th>Téléphone</th>
                      <th>Code Postal</th>
                      <th>Ville</th>
                      <th>Raison</th>
                      <th>Fiche Existante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.notInserted.list.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.nom || 'N/A'}</td>
                        <td>{item.prenom || 'N/A'}</td>
                        <td>{item.tel || 'N/A'}</td>
                        <td>{item.cp || 'N/A'}</td>
                        <td>{item.ville || 'N/A'}</td>
                        <td className="reason-cell">{item.raison || 'N/A'}</td>
                        <td>
                          {item.ficheExistante ? (
                            <div className="existing-fiche-info">
                              <div><strong>ID:</strong> {item.ficheExistante.id || 'N/A'}</div>
                              <div><strong>Nom:</strong> {item.ficheExistante.nom || 'N/A'} {item.ficheExistante.prenom || ''}</div>
                              <div><strong>Tél:</strong> {item.ficheExistante.tel || 'N/A'}</div>
                              <div><strong>État:</strong> {item.ficheExistante.etat_titre || 'N/A'}</div>
                            </div>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="result-actions">
            <button
              className="btn-reset"
              onClick={handleReset}
            >
              <FaUpload /> Nouvel import
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportMasse;

