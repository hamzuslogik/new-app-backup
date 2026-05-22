import React, { useMemo, useState } from 'react';
import { useMutation } from 'react-query';
import { toast } from 'react-toastify';
import { FaFileUpload, FaCheck, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa';
import api from '../../config/api';
import './ManagementTab.css';

const statusClass = (status) => {
  if (status === 'pret') return 'ko-import-status-ok';
  if (status === 'avertissement') return 'ko-import-status-warn';
  return 'ko-import-status-err';
};

const formatDt = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('fr-FR');
};

const FichesKoImportTab = () => {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [applyIncludeWarnings, setApplyIncludeWarnings] = useState(true);

  const previewMutation = useMutation(
    async () => {
      if (!file) throw new Error('Veuillez sélectionner un fichier Excel');
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/management/fiches-ko-import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    {
      onSuccess: (result) => {
        setRows(result?.data || []);
        setMeta(result?.meta || null);
        toast.success(`${result?.meta?.total || 0} ligne(s) analysée(s)`);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || error.message || 'Erreur lecture fichier');
      },
    }
  );

  const applyMutation = useMutation(
    async (linesToApply) => {
      const res = await api.post('/management/fiches-ko-import/apply', { rows: linesToApply });
      return res.data;
    },
    {
      onSuccess: (result) => {
        toast.success(result?.message || 'Import terminé');
        if (file) previewMutation.mutate();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || error.message || 'Erreur application');
      },
    }
  );

  const applicableRows = useMemo(() => {
    return rows.filter((r) => {
      if (r.status === 'pret') return true;
      if (r.status === 'avertissement' && applyIncludeWarnings) return true;
      return false;
    });
  }, [rows, applyIncludeWarnings]);

  const handleApply = () => {
    if (!applicableRows.length) {
      toast.warn('Aucune ligne prête à appliquer');
      return;
    }
    const msg = `Appliquer ${applicableRows.length} fiche(s) ?\n\n• id_agent mis à jour (pseudo → id)\n• ko = 1\n• date_appel_time si fournie dans l'Excel`;
    if (!window.confirm(msg)) return;
    applyMutation.mutate(applicableRows);
  };

  return (
    <div className="management-tab fiches-ko-import-tab">
      <div className="tab-header">
        <h2>Import fiches KO (Excel)</h2>
      </div>

      <p className="ko-import-help">
        Format attendu (1ère ligne = en-têtes) : <strong>Telephone</strong> (sans 0 initial),{' '}
        <strong>Agent</strong> (pseudo qualification), <strong>date_appel</strong> (YYYY-MM-DD),{' '}
        <strong>Etat</strong> (doit contenir « KO »). Seules les lignes avec Etat = KO sont traitées.
        Le 0 est ajouté au numéro pour la recherche ; la fiche est ciblée par téléphone + date d&apos;appel.
      </p>

      <div className="form-group">
        <label>Fichier (.xlsx, .xls, .csv)</label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setRows([]);
            setMeta(null);
          }}
        />
      </div>

      <div className="form-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => previewMutation.mutate()}
          disabled={!file || previewMutation.isLoading}
        >
          <FaFileUpload />
          {previewMutation.isLoading ? 'Analyse...' : 'Analyser le fichier'}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleApply}
          disabled={!applicableRows.length || applyMutation.isLoading}
        >
          <FaCheck />
          {applyMutation.isLoading
            ? 'Application...'
            : `Appliquer (${applicableRows.length})`}
        </button>
      </div>

      {meta && (
        <div className="ko-import-summary">
          <span>Total : {meta.total}</span>
          <span className="ko-import-status-ok">Prêt : {meta.pret}</span>
          <span className="ko-import-status-warn">Avertissement : {meta.avertissement}</span>
          <span className="ko-import-status-err">Erreur : {meta.erreur}</span>
          <label className="ko-import-warn-toggle">
            <input
              type="checkbox"
              checked={applyIncludeWarnings}
              onChange={(e) => setApplyIncludeWarnings(e.target.checked)}
            />
            Inclure les lignes en avertissement (ex. date différente)
          </label>
        </div>
      )}

      <div className="table-container" style={{ marginTop: 16 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Ligne</th>
              <th>Id fiche</th>
              <th>Tél. Excel</th>
              <th>Agent (pseudo)</th>
              <th>Id agent cible</th>
              <th>Id agent actuel</th>
              <th>Etat</th>
              <th>Date appel Excel</th>
              <th>Date appel BDD</th>
              <th>KO actuel</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="10" className="text-center">
                  Chargez un fichier puis cliquez sur Analyser
                </td>
              </tr>
            ) : (
              rows.slice(0, 500).map((row) => (
                <tr key={`${row.line}-${row.id_fiche || row.tel_excel}`}>
                  <td>{row.line}</td>
                  <td>{row.id_fiche ?? row.id_fiche_excel ?? '-'}</td>
                  <td>{row.tel_excel || '-'}</td>
                  <td>{row.agent_pseudo || '-'}</td>
                  <td>{row.id_agent_resolu ?? '-'}</td>
                  <td>{row.id_agent_actuel ?? '-'}</td>
                  <td>{row.etat_excel || 'KO'}</td>
                  <td>{formatDt(row.date_appel_excel)}</td>
                  <td>{formatDt(row.date_appel_time_db)}</td>
                  <td>{row.ko_actuel === 1 ? '1' : '0'}</td>
                  <td className={statusClass(row.status)}>
                    {row.status === 'pret' && <FaCheck title="Prêt" />}
                    {row.status === 'avertissement' && <FaExclamationTriangle title="Avertissement" />}
                    {row.status === 'erreur' && <FaTimesCircle title="Erreur" />}
                    <span>{row.status_label}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 500 && (
        <small>Affichage limité aux 500 premières lignes. Exportez depuis Excel si besoin.</small>
      )}
    </div>
  );
};

export default FichesKoImportTab;
