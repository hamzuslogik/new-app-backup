import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { toast } from 'react-toastify';
import { FaFileExport } from 'react-icons/fa';
import api from '../../config/api';
import { exportToCSV, exportToExcel } from '../../utils/exportUtils';
import './ManagementTab.css';

const DATE_FIELDS = [
  { value: 'date_insert_time', label: 'Date insertion' },
  { value: 'date_modif_time', label: 'Date modification' },
  { value: 'date_appel_time', label: 'Date appel' },
  { value: 'date_rdv_time', label: 'Date RDV' }
];

const EXPORT_FIELDS = [
  { key: 'id', label: 'ID' },
  { key: 'hash', label: 'Hash' },
  { key: 'civ', label: 'Civilite' },
  { key: 'nom', label: 'Nom' },
  { key: 'prenom', label: 'Prenom' },
  { key: 'tel', label: 'Telephone' },
  { key: 'gsm1', label: 'GSM 1' },
  { key: 'gsm2', label: 'GSM 2' },
  { key: 'email', label: 'Email' },
  { key: 'adresse', label: 'Adresse' },
  { key: 'cp', label: 'Code postal' },
  { key: 'ville', label: 'Ville' },
  { key: 'produit', label: 'Produit' },
  { key: 'id_centre', label: 'ID centre' },
  { key: 'centre_titre', label: 'Centre' },
  { key: 'id_etat_final', label: 'ID etat final' },
  { key: 'etat_titre', label: 'Etat final' },
  { key: 'id_sous_etat', label: 'ID sous-etat' },
  { key: 'sous_etat_titre', label: 'Sous-etat' },
  { key: 'id_confirmateur', label: 'ID confirmateur 1' },
  { key: 'id_confirmateur_2', label: 'ID confirmateur 2' },
  { key: 'id_confirmateur_3', label: 'ID confirmateur 3' },
  { key: 'id_commercial', label: 'ID commercial 1' },
  { key: 'id_commercial_2', label: 'ID commercial 2' },
  { key: 'id_agent', label: 'ID agent' },
  { key: 'commentaire', label: 'Commentaire' },
  { key: 'date_insert_time', label: 'Date insertion' },
  { key: 'date_modif_time', label: 'Date modification' },
  { key: 'date_appel_time', label: 'Date appel' },
  { key: 'date_rdv_time', label: 'Date RDV' },
  { key: 'archive', label: 'Archive' },
  { key: 'ko', label: 'KO' },
  { key: 'active', label: 'Active' },
  { key: 'valider', label: 'Valider' }
];

const DEFAULT_FIELDS = [
  'hash',
  'nom',
  'prenom',
  'tel',
  'cp',
  'ville',
  'date_insert_time',
  'etat_titre',
  'sous_etat_titre'
];

const extractMultiSelectValues = (event) =>
  Array.from(event.target.selectedOptions, (option) => option.value);

/** Liste vide ou « tout sélectionné » => pas de filtre côté API (inclure tout). */
const normalizeIdsForExport = (selectedIds, allIds) => {
  const all = Array.isArray(allIds) ? allIds.map(String) : [];
  const selected = Array.isArray(selectedIds) ? selectedIds.map(String) : [];
  if (all.length === 0) return [];
  if (selected.length === 0) return [];
  if (selected.length === all.length) return [];
  return selected;
};

const FichesExtractionTab = () => {
  const today = new Date().toISOString().split('T')[0];
  const [dateField, setDateField] = useState('date_modif_time');
  const [dateStart, setDateStart] = useState(today);
  const [dateEnd, setDateEnd] = useState(today);
  const [timeStart, setTimeStart] = useState('00:00');
  const [timeEnd, setTimeEnd] = useState('23:59');
  const [selectedEtatIds, setSelectedEtatIds] = useState([]);
  const [selectedSousEtatIds, setSelectedSousEtatIds] = useState([]);
  const [selectedCentreIds, setSelectedCentreIds] = useState([]);
  const [selectedDepartements, setSelectedDepartements] = useState([]);
  const [selectedFields, setSelectedFields] = useState(DEFAULT_FIELDS);
  const [format, setFormat] = useState('excel');

  const { data: etatsData = [] } = useQuery('etats-export', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  const { data: sousEtatsData = [] } = useQuery('sous-etat-export', async () => {
    const res = await api.get('/management/sous-etat');
    return res.data.data || [];
  });

  const { data: centresData = [] } = useQuery('centres-export', async () => {
    const res = await api.get('/management/centres');
    return res.data.data || [];
  });

  const { data: departementsData = [] } = useQuery('departements-export-actifs', async () => {
    const res = await api.get('/management/departements', { params: { actif_only: 1 } });
    return res.data.data || [];
  });

  const filteredSousEtats = useMemo(() => {
    if (selectedEtatIds.length === 0) return sousEtatsData;
    const selected = new Set(selectedEtatIds.map((id) => Number(id)));
    return sousEtatsData.filter((item) => selected.has(Number(item.id_etat)));
  }, [sousEtatsData, selectedEtatIds]);

  const exportMutation = useMutation(
    async () => {
      const allEtatIds = etatsData.map((item) => String(item.id));
      const allSousEtatIds = sousEtatsData.map((item) => String(item.id));
      const allCentreIds = centresData.map((item) => String(item.id));
      const allDepartementCodes = departementsData.map((item) => String(item.departement_code));

      const etatIdsToSend = normalizeIdsForExport(selectedEtatIds, allEtatIds);
      const sousEtatIdsToSend = normalizeIdsForExport(selectedSousEtatIds, allSousEtatIds);
      const centreIdsToSend = normalizeIdsForExport(selectedCentreIds, allCentreIds);
      const departementsToSend = normalizeIdsForExport(selectedDepartements, allDepartementCodes);

      const response = await api.post('/management/fiches-export', {
        date_field: dateField,
        date_start: dateStart,
        date_end: dateEnd,
        time_start: timeStart,
        time_end: timeEnd,
        etat_ids: etatIdsToSend,
        sous_etat_ids: sousEtatIdsToSend,
        centre_ids: centreIdsToSend,
        departements: departementsToSend,
        selected_fields: selectedFields
      });
      return response.data;
    },
    {
      onSuccess: (result) => {
        const rows = result?.data || [];
        if (!Array.isArray(rows) || rows.length === 0) {
          toast.info('Aucune fiche trouvee pour ces filtres');
          return;
        }

        const columns = selectedFields.map((fieldKey) => {
          const field = EXPORT_FIELDS.find((item) => item.key === fieldKey);
          return { key: fieldKey, label: field?.label || fieldKey };
        });

        const filename = `extraction-fiches-${dateStart}-${dateEnd}`;
        if (format === 'csv') {
          exportToCSV(rows, columns, filename);
          toast.success(`Export CSV termine (${rows.length} lignes)`);
        } else {
          exportToExcel(rows, columns, filename);
          toast.success(`Export Excel termine (${rows.length} lignes)`);
        }
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de l extraction');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!dateStart || !dateEnd) {
      toast.error('Veuillez definir une periode');
      return;
    }

    if (selectedFields.length === 0) {
      toast.error('Selectionnez au moins un champ a extraire');
      return;
    }

    exportMutation.mutate();
  };

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Extraction des fiches</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-row" style={{ marginBottom: '16px' }}>
          <div className="form-group">
            <label>Champ de date</label>
            <select value={dateField} onChange={(e) => setDateField(e.target.value)}>
              {DATE_FIELDS.map((field) => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="excel">Excel (.xls)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </div>
        </div>

        <div className="form-row" style={{ marginBottom: '16px' }}>
          <div className="form-group">
            <label>Date debut</label>
            <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Date fin</label>
            <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} required />
          </div>
        </div>

        <div className="form-row" style={{ marginBottom: '16px' }}>
          <div className="form-group">
            <label>Heure debut</label>
            <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Heure fin</label>
            <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} required />
          </div>
        </div>

        <div className="form-row" style={{ marginBottom: '16px' }}>
          <div className="form-group">
            <label>Etats (multi-selection)</label>
            <select
              multiple
              size={8}
              value={selectedEtatIds}
              onChange={(e) => {
                const nextEtatIds = extractMultiSelectValues(e);
                setSelectedEtatIds(nextEtatIds);

                // Nettoyer les sous-etats devenus incompatibles avec les etats selectionnes.
                if (nextEtatIds.length === 0) return;
                const selectedEtatSet = new Set(nextEtatIds.map((id) => Number(id)));
                setSelectedSousEtatIds((prev) =>
                  prev.filter((sousEtatId) => {
                    const sousEtat = sousEtatsData.find((item) => String(item.id) === String(sousEtatId));
                    return sousEtat ? selectedEtatSet.has(Number(sousEtat.id_etat)) : false;
                  })
                );
              }}
            >
              {etatsData.map((etat) => (
                <option key={etat.id} value={String(etat.id)}>
                  {etat.id} - {etat.titre}
                </option>
              ))}
            </select>
            <small>Ctrl/Cmd + clic pour selectionner plusieurs etats. Vide = tous les etats.</small>
          </div>

          <div className="form-group">
            <label>Sous-etats (multi-selection)</label>
            <select
              multiple
              size={8}
              value={selectedSousEtatIds}
              onChange={(e) => setSelectedSousEtatIds(extractMultiSelectValues(e))}
            >
              {filteredSousEtats.map((sousEtat) => (
                <option key={sousEtat.id} value={String(sousEtat.id)}>
                  {sousEtat.titre}
                </option>
              ))}
            </select>
            <small>Filtrage selon les etats selectionnes. Vide = tous les sous-etats.</small>
          </div>
        </div>

        <div className="form-row" style={{ marginBottom: '16px' }}>
          <div className="form-group">
            <label>Centres (multi-selection)</label>
            <select
              multiple
              size={8}
              value={selectedCentreIds}
              onChange={(e) => setSelectedCentreIds(extractMultiSelectValues(e))}
            >
              {centresData.map((centre) => (
                <option key={centre.id} value={String(centre.id)}>
                  {centre.titre}
                </option>
              ))}
            </select>
            <small>Vide = tous les centres.</small>
          </div>

          <div className="form-group">
            <label>Departements / CP (actifs uniquement)</label>
            <select
              multiple
              size={8}
              value={selectedDepartements}
              onChange={(e) => setSelectedDepartements(extractMultiSelectValues(e))}
            >
              {departementsData.map((dep) => (
                <option key={dep.id || dep.departement_code} value={String(dep.departement_code)}>
                  {dep.departement_code} - {dep.departement_nom}
                </option>
              ))}
            </select>
            <small>Vide = tous les departements.</small>
          </div>
        </div>

        <div className="form-group">
          <label>Champs a extraire (multi-selection)</label>
          <select
            multiple
            size={12}
            value={selectedFields}
            onChange={(e) => setSelectedFields(extractMultiSelectValues(e))}
          >
            {EXPORT_FIELDS.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
          <small>Selectionnez les colonnes a inclure dans le fichier exporte</small>
        </div>

        <div className="form-actions">
          <button className="btn-primary" type="submit" disabled={exportMutation.isLoading}>
            <FaFileExport />
            {exportMutation.isLoading ? 'Extraction en cours...' : 'Extraire et exporter'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FichesExtractionTab;

