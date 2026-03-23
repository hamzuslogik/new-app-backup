import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { toast } from 'react-toastify';
import { FaFileUpload, FaFileExport, FaSearch } from 'react-icons/fa';
import api from '../../config/api';
import { exportToCSV, exportToExcel } from '../../utils/exportUtils';
import './ManagementTab.css';

const exportColumns = [
  { key: 'tel_input', label: 'Telephone fichier' },
  { key: 'tel_normalized', label: 'Telephone normalise' },
  { key: 'hash', label: 'Hash' },
  { key: 'tel_db', label: 'Telephone BDD' },
  { key: 'trouve', label: 'Trouve' }
];

const FichesHashFromTelTab = () => {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);

  const runMutation = useMutation(
    async () => {
      if (!file) throw new Error('Veuillez selectionner un fichier');
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/management/fiches-hash-from-phones', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    },
    {
      onSuccess: (result) => {
        const data = result?.data || [];
        setRows(data);
        setMeta(result?.meta || null);
        toast.success(`Traitement termine: ${result?.meta?.total_found || 0} correspondance(s)`);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || error.message || 'Erreur traitement fichier');
      }
    }
  );

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Hash depuis fichier telephones</h2>
      </div>

      <div className="form-group">
        <label>Fichier telephones (txt, csv, xls, xlsx)</label>
        <input
          type="file"
          accept=".txt,.csv,.xls,.xlsx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>

      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn-primary" onClick={() => runMutation.mutate()} disabled={runMutation.isLoading}>
          <FaFileUpload />
          {runMutation.isLoading ? 'Traitement...' : 'Traiter le fichier'}
        </button>
        <button
          className="btn-secondary"
          onClick={() => exportToCSV(rows, exportColumns, 'hash-from-telephones')}
          disabled={!rows.length}
        >
          <FaFileExport /> Export CSV
        </button>
        <button
          className="btn-secondary"
          onClick={() => exportToExcel(rows, exportColumns, 'hash-from-telephones')}
          disabled={!rows.length}
        >
          <FaFileExport /> Export Excel
        </button>
      </div>

      {meta && (
        <div style={{ marginTop: 16 }}>
          <strong>Resume:</strong>{' '}
          {meta.total_input || 0} lignes lues, {meta.total_valid || 0} numeros valides, {meta.total_found || 0} trouves
        </div>
      )}

      <div className="table-container" style={{ marginTop: 16 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Telephone fichier</th>
              <th>Telephone normalise</th>
              <th>Hash</th>
              <th>Telephone BDD</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center">
                  <FaSearch style={{ marginRight: 8 }} />
                  Aucun resultat pour le moment
                </td>
              </tr>
            ) : (
              rows.slice(0, 2000).map((row, idx) => (
                <tr key={`${row.tel_input}-${idx}`}>
                  <td>{row.tel_input}</td>
                  <td>{row.tel_normalized}</td>
                  <td>{row.hash}</td>
                  <td>{row.tel_db}</td>
                  <td>{row.trouve ? 'Trouve' : 'Non trouve'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 2000 && (
        <small>Affichage limite aux 2000 premieres lignes. Utilisez l export pour tout recuperer.</small>
      )}
    </div>
  );
};

export default FichesHashFromTelTab;

