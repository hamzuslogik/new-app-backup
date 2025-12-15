import React, { useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaUpload, FaFileExcel, FaFileCsv, FaCheck, FaTimes, FaDownload, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './ImportMasse.css';

const ImportMasse = () => {
  const { user, hasPermission } = useAuth();
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [fileColumns, setFileColumns] = useState([]);
  const [dbFields, setDbFields] = useState([]);
  const [tempFile, setTempFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCentre, setSelectedCentre] = useState(user?.centre || '');
  const [selectedProduit, setSelectedProduit] = useState('');

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

  // Mutation pour traiter l'import
  const importMutation = useMutation(
    async (data) => {
      const res = await api.post('/import/process', data);
      return res.data;
    },
    {
      onSuccess: (data) => {
        if (data.success) {
          setImportResult(data.data);
          setIsProcessing(false);
          toast.success(`Import terminé: ${data.data.inserted} fiches insérées`);
        }
      },
      onError: (error) => {
        setIsProcessing(false);
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

    setIsProcessing(true);
    importMutation.mutate({
      mapping,
      tempFile,
      skipDuplicates: false,
      id_centre: selectedCentre,
      produit: selectedProduit
    });
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
    setSelectedCentre(user?.centre || '');
    setSelectedProduit('');
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

  return (
    <div className="import-masse-page">
      <div className="import-header">
        <h1><FaUpload /> Import en Masse</h1>
        <p className="subtitle">Importez des fiches depuis un fichier CSV ou Excel</p>
      </div>

      {!previewData && (
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
                    // Les admins (fonction 1, 7) peuvent voir tous les centres
                    if (user?.fonction === 1 || user?.fonction === 7) return true;
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
              disabled={isProcessing || !(mapping.tel || mapping.gsm1 || mapping.gsm2) || !selectedCentre || !selectedProduit}
            >
              {isProcessing ? (
                <>
                  <FaSpinner className="spinner" /> Traitement en cours...
                </>
              ) : (
                <>
                  <FaUpload /> Importer les fiches
                </>
              )}
            </button>
            <button
              className="btn-reset"
              onClick={handleReset}
              disabled={isProcessing}
            >
              <FaTimes /> Annuler
            </button>
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

