import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaInfoCircle, FaFileExport, FaPlay, FaToggleOn, FaToggleOff, FaHistory } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import Tooltip from '../common/Tooltip';
import Pagination from '../common/Pagination';
import { exportToCSV } from '../../utils/exportToCSV';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import useLocalStorage from '../../hooks/useLocalStorage';
import './ManagementTab.css';
import { NOTIFICATION_LINK_PAGE_PRESETS } from '../../utils/notificationNavigation';

const TRIGGER_VARIABLES = {
  fiche_created: [
    '{fiche.id}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}', '{fiche.cp}',
    '{fiche.id_etat_final}', '{fiche.date_insert_time}', '{fiche.date_modif_time}', '{fiche.date_rdv_time}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  fiche_updated: [
    '{fiche.id}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}', '{fiche.cp}',
    '{fiche.id_etat_final}', '{fiche.date_modif_time}', '{fiche.date_rdv_time}',
    '{changes}', '{changes.id_etat_final}', '{changes.date_rdv_time}', '{changes.id_sous_etat}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  etat_changed: [
    '{fiche.id}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}', '{fiche.id_etat_final}',
    '{old_etat}', '{new_etat}', '{old_etat_titre}', '{new_etat_titre}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  rdv_created: [
    '{fiche.id}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}', '{fiche.date_rdv_time}',
    '{old_date_rdv_time}', '{new_date_rdv_time}', '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  rdv_validated: [
    '{fiche.id}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}', '{fiche.valider}',
    '{old_valider}', '{new_valider}', '{conf_rdv_avec}', '{conf_presence_couple}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  compte_rendu_created: [
    '{fiche.id}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}',
    '{compte_rendu.id}', '{compte_rendu.id_fiche}', '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  compte_rendu_approved: [
    '{fiche.id}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}',
    '{fiche.id_etat_final}',
    '{old_etat}', '{new_etat}', '{old_etat_titre}', '{new_etat_titre}',
    '{compte_rendu.id}', '{compte_rendu.id_fiche}', '{compte_rendu.statut}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  demande_insertion_created: [
    '{fiche.id}', '{fiche.hash}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}',
    '{demande_insertion.id}', '{demande_insertion.id_fiche_existante}', '{demande_insertion.id_agent}',
    '{demande_insertion.agent_pseudo}', '{demande_insertion.donnees_fiche}', '{demande_insertion.date_demande}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  demande_insertion_approved: [
    '{fiche.id}', '{fiche.hash}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}',
    '{fiche.id_agent}', '{fiche.id_centre}', '{fiche.id_etat_final}',
    '{demande_insertion.id}', '{demande_insertion.id_fiche_existante}', '{demande_insertion.id_nouvelle_fiche}',
    '{demande_insertion.hash_nouvelle_fiche}', '{demande_insertion.id_agent}', '{demande_insertion.agent_pseudo}',
    '{demande_insertion.id_superviseur}', '{demande_insertion.superviseur_pseudo}', '{demande_insertion.id_rp_qualif}',
    '{demande_insertion.id_traitant}', '{demande_insertion.traitant_pseudo}', '{demande_insertion.commentaire}',
    '{demande_insertion.date_traitement}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  demande_insertion_refusee: [
    '{fiche.id}', '{fiche.hash}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}',
    '{demande_insertion.id}', '{demande_insertion.id_fiche_existante}', '{demande_insertion.id_agent}',
    '{demande_insertion.agent_pseudo}', '{demande_insertion.id_superviseur}', '{demande_insertion.superviseur_pseudo}',
    '{demande_insertion.id_rp_qualif}', '{demande_insertion.id_traitant}', '{demande_insertion.traitant_pseudo}',
    '{demande_insertion.commentaire}', '{demande_insertion.date_traitement}', '{demande_insertion.statut}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  planning_created: [
    '{planning.week}', '{planning.semaine}', '{planning.dep}', '{planning.departement}',
    '{planning.date}', '{planning.hour}', '{planning.scope}', '{planning.source}', '{planning.value}',
    '{changes}', '{changes.week}', '{changes.semaine}', '{changes.dep}', '{changes.departement}',
    '{changes.date}', '{changes.hour}', '{changes.scope}', '{changes.source}', '{changes.value}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  planning_updated: [
    '{planning.week}', '{planning.semaine}', '{planning.dep}', '{planning.departement}',
    '{planning.date}', '{planning.hour}', '{planning.scope}', '{planning.source}', '{planning.value}',
    '{changes}', '{changes.week}', '{changes.semaine}', '{changes.dep}', '{changes.departement}',
    '{changes.date}', '{changes.hour}', '{changes.scope}', '{changes.source}', '{changes.value}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  decalage_created: [
    '{fiche.id}', '{fiche.date_rdv_time}',
    '{decalage.id}', '{decalage.id_fiche}', '{decalage.expediteur}', '{decalage.destination}', '{decalage.id_etat}',
    '{decalage.date_prevu}', '{decalage.date_nouvelle}', '{decalage.date_creation}',
    '{decalage.message}', '{decalage_message}',
    '{decalage.fiche_nom}', '{decalage.fiche_prenom}', '{decalage.fiche_tel}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  decalage_accepted: [
    '{fiche.id}', '{fiche.date_rdv_time}',
    '{decalage.id}', '{decalage.id_fiche}', '{decalage.old_etat}', '{decalage.new_etat}',
    '{decalage.expediteur}', '{decalage.destination}', '{decalage.date_prevu}', '{decalage.date_nouvelle}', '{decalage.modifie_le}',
    '{decalage.message}', '{decalage_message}',
    '{decalage.fiche_nom}', '{decalage.fiche_prenom}', '{decalage.fiche_tel}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  decalage_refused: [
    '{fiche.id}', '{fiche.date_rdv_time}',
    '{decalage.id}', '{decalage.id_fiche}', '{decalage.old_etat}', '{decalage.new_etat}',
    '{decalage.expediteur}', '{decalage.destination}', '{decalage.date_prevu}', '{decalage.date_nouvelle}', '{decalage.modifie_le}',
    '{decalage.message}', '{decalage_message}',
    '{decalage.fiche_nom}', '{decalage.fiche_prenom}', '{decalage.fiche_tel}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  demande_decalage_annulee: [
    '{fiche.id}', '{fiche.date_rdv_time}',
    '{decalage.id}', '{decalage.id_fiche}', '{decalage.old_etat}', '{decalage.new_etat}',
    '{decalage.expediteur}', '{decalage.destination}', '{decalage.date_prevu}', '{decalage.date_nouvelle}', '{decalage.modifie_le}',
    '{decalage.message}', '{decalage_message}',
    '{decalage.fiche_nom}', '{decalage.fiche_prenom}', '{decalage.fiche_tel}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  remarque_created: [
    '{remarque.id}', '{remarque.nature_remarque}', '{remarque.commentaire}', '{remarque.id_expediteur}', '{remarque.id_destinataire}',
    '{remarque.id_fiche}', '{remarque.date_remarque}', '{remarque.destinataire_pseudo}', '{remarque.agent_qualification_nom}',
    '{fiche.id}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}', '{fiche.id_agent}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  alerte_ko_created: [
    '{alerte_ko.id}', '{alerte_ko.id_fiche}', '{alerte_ko.id_agent}', '{alerte_ko.id_qualite}', '{alerte_ko.type_alerte}',
    '{alerte_ko.num_alerte}', '{alerte_ko.date_alerte}', '{alerte_ko.commentaire}', '{alerte_ko.nom}', '{alerte_ko.prenom}', '{alerte_ko.tel}',
    '{alerte_ko.agent_pseudo}', '{alerte_ko.agent_qualification_nom}',
    '{fiche.id}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}', '{fiche.id_agent}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  alerte_controle_qualite_created: [
    '{alerte_ko.id}', '{alerte_ko.id_fiche}', '{alerte_ko.id_agent}', '{alerte_ko.id_qualite}', '{alerte_ko.type_alerte}',
    '{alerte_ko.num_alerte}', '{alerte_ko.date_alerte}', '{alerte_ko.commentaire}', '{alerte_ko.nom}', '{alerte_ko.prenom}', '{alerte_ko.tel}',
    '{alerte_ko.agent_pseudo}', '{alerte_ko.agent_qualification_nom}',
    '{fiche.id}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}', '{fiche.id_agent}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  fiche_ko_created: [
    '{fiche.id}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}', '{fiche.id_agent}', '{fiche.agent_pseudo}', '{fiche.agent_qualification_nom}',
    '{fiche.id_etat_final}', '{fiche.id_sous_etat}', '{fiche.ko}',
    '{fiche_ko.source}', '{fiche_ko.id_sous_etat}', '{fiche_ko.sous_etat_titre}', '{fiche_ko.commentaire_ko}',
    '{user.id}', '{user.pseudo}', '{user.fonction}'
  ],
  scheduled: ['{workflow_id}', '{workflow_nom}', '{cron_expression}', '{scheduled_at}'],
  fiche_rdv_etat_check: [
    '{fiche.id}', '{fiche.nom}', '{fiche.prenom}', '{fiche.tel}',
    '{fiche.date_rdv_time}', '{fiche.id_etat_final}',
    '{workflow_id}', '{workflow_nom}', '{cron_expression}', '{scheduled_at}'
  ]
};

/** Liste d’IDs entiers pour les cases à cocher (évite mélange string/number au reload). */
function etatIdListFromConfig(value, legacyEtatId) {
  if (Array.isArray(value)) {
    return value.map((v) => parseInt(String(v), 10)).filter((n) => !Number.isNaN(n));
  }
  if (value != null && value !== '') {
    const n = parseInt(String(value), 10);
    return Number.isNaN(n) ? [] : [n];
  }
  if (legacyEtatId != null && legacyEtatId !== '') {
    const n = parseInt(String(legacyEtatId), 10);
    return Number.isNaN(n) ? [] : [n];
  }
  return [];
}

function normalizeTriggerConfigForForm(trigger) {
  const t = { ...trigger, config: { ...(trigger.config || {}) } };
  const c = t.config;
  if (t.type !== 'etat_changed' && t.type !== 'compte_rendu_approved') return t;
  if (Array.isArray(c.etat_from)) {
    c.etat_from = c.etat_from.map((x) => parseInt(String(x), 10)).filter((n) => !Number.isNaN(n));
  }
  if (Array.isArray(c.etat_to)) {
    c.etat_to = c.etat_to.map((x) => parseInt(String(x), 10)).filter((n) => !Number.isNaN(n));
  } else if (c.etat_to != null && c.etat_to !== '') {
    const n = parseInt(String(c.etat_to), 10);
    c.etat_to = Number.isNaN(n) ? [] : [n];
  }
  if (c.etat_id != null && c.etat_id !== '') {
    const n = parseInt(String(c.etat_id), 10);
    if (!Number.isNaN(n) && (!Array.isArray(c.etat_to) || c.etat_to.length === 0)) {
      c.etat_to = [n];
    }
    delete c.etat_id;
  }
  return t;
}

const DYNAMIC_RECIPIENT_OPTIONS = [
  { value: '{fiche.id_insert}', label: 'Agent qui a cree la fiche ({fiche.id_insert})' },
  { value: '{fiche.id_agent}', label: 'Agent assigne ({fiche.id_agent})' },
  { value: '{fiche.id_confirmateur}', label: 'Confirmateur principal ({fiche.id_confirmateur})' },
  { value: '{fiche.id_confirmateur_2}', label: 'Confirmateur secondaire ({fiche.id_confirmateur_2})' },
  { value: '{fiche.id_confirmateur_3}', label: 'Confirmateur tertiaire ({fiche.id_confirmateur_3})' },
  { value: '{fiche.id_qualite}', label: 'Agent qualite ({fiche.id_qualite})' },
  { value: '{fiche.id_commercial}', label: 'Commercial principal ({fiche.id_commercial})' },
  { value: '{fiche.id_commercial_2}', label: 'Commercial secondaire ({fiche.id_commercial_2})' },
  { value: '{fiche.id_superviseur_qualif_agent}', label: "Superviseur qualif de l'agent de la fiche ({fiche.id_superviseur_qualif_agent})" },
  { value: '{remarque.id_destinataire}', label: 'Destinataire de la remarque ({remarque.id_destinataire})' },
  { value: '{remarque.id_expediteur}', label: 'Expéditeur de la remarque ({remarque.id_expediteur})' },
  { value: '{alerte_ko.id_agent}', label: "Agent destinataire de l'alerte qualité / notification ({alerte_ko.id_agent})" },
  { value: '{decalage.expediteur}', label: 'Expéditeur du décalage ({decalage.expediteur})' },
  { value: '{decalage.destination}', label: 'Confirmateur (destination du décalage) ({decalage.destination})' }
];

const WorkflowsTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    actif: 1,
    priorite: 0,
    combine_triggers: 'or',
    triggers: [{ type: 'fiche_created', config: {}, conditions: [] }],
    actions: [{ type: 'notification', config: { type: 'workflow', message: '', destination: '', link_page: '', link_page_manual: '' }, conditions: [], ordre: 0, delay_seconds: 0 }]
  });
  const [searchTerm, setSearchTerm] = useLocalStorage('management_workflows_search', '');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useLocalStorage('management_workflows_itemsPerPage', 25);
  const [showExecutions, setShowExecutions] = useState(null);
  const queryClient = useQueryClient();

  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
      }
    },
    'ctrl+s': (e) => {
      if (showForm) {
        e.preventDefault();
        const form = document.querySelector('.form-content form');
        if (form) {
          form.requestSubmit();
        }
      }
    }
  }, [showForm]);

  const { data, isLoading } = useQuery(
    'workflows',
    async () => {
      const response = await api.get('/workflows');
      return response.data.data;
    }
  );

  // Récupérer les états pour les sélecteurs
  const { data: etatsData } = useQuery('etats-workflows', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  // Récupérer les fonctions pour les messages système
  const { data: fonctionsData } = useQuery('fonctions-workflows', async () => {
    const res = await api.get('/management/fonctions');
    return res.data.data || [];
  });

  // Récupérer tous les utilisateurs du système (actifs et inactifs) pour notification workflow et message système
  const { data: utilisateursData } = useQuery('utilisateurs-workflows', async () => {
    const res = await api.get('/management/utilisateurs', { params: { include_inactive: 1 } });
    return res.data.data || [];
  });

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      item.nom?.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term) ||
      item.id?.toString().includes(term)
    );
  }, [data, searchTerm]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handleExportCSV = () => {
    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'nom', label: 'Nom' },
      { key: 'actif', label: 'État' },
      { key: 'priorite', label: 'Priorité' },
      { key: 'triggers_count', label: 'Déclencheurs' },
      { key: 'actions_count', label: 'Actions' }
    ];
    exportToCSV(filteredData.map(item => ({
      ...item,
      actif: item.actif === 1 ? 'Actif' : 'Inactif'
    })), columns, 'workflows');
    toast.success('Export CSV réussi');
  };

  const createMutation = useMutation(
    async (data) => {
      const response = await api.post('/workflows', data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflows');
        toast.success('Workflow créé avec succès');
        setShowForm(false);
        setFormData({
          nom: '',
          description: '',
          actif: 1,
          priorite: 0,
          combine_triggers: 'or',
          triggers: [{ type: 'fiche_created', config: {}, conditions: [] }],
          actions: [{ type: 'notification', config: { type: 'workflow', message: '', destination: '', link_page: '', link_page_manual: '' }, conditions: [], ordre: 0, delay_seconds: 0 }]
        });
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la création');
      }
    }
  );

  const updateMutation = useMutation(
    async ({ id, data }) => {
      const response = await api.put(`/workflows/${id}`, data);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflows');
        toast.success('Workflow mis à jour avec succès');
        setShowForm(false);
        setEditingId(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
      }
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/workflows/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflows');
        toast.success('Workflow supprimé avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  );

  const toggleMutation = useMutation(
    async (id) => {
      const response = await api.patch(`/workflows/${id}/toggle`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflows');
        toast.success('Workflow modifié avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur');
      }
    }
  );

  const testMutation = useMutation(
    async (id) => {
      const response = await api.post(`/workflows/${id}/test`, { test_data: { fiche: { id: 1, nom: 'Test', prenom: 'Test' } } });
      return response.data;
    },
    {
      onSuccess: (data) => {
        toast.success(`Workflow testé: ${data.data.actions_to_execute.length} action(s) à exécuter`);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors du test');
      }
    }
  );

  const handleEdit = (workflow) => {
    setEditingId(workflow.id);
    const rawTriggers = workflow.triggers || [{ type: 'fiche_created', config: {}, conditions: [] }];
    setFormData({
      nom: workflow.nom,
      description: workflow.description || '',
      actif: workflow.actif,
      priorite: workflow.priorite || 0,
      combine_triggers: workflow.combine_triggers === 'and' ? 'and' : 'or',
      triggers: rawTriggers.map(normalizeTriggerConfigForForm),
      actions: workflow.actions || [{ type: 'notification', config: {}, conditions: [], ordre: 0, delay_seconds: 0 }]
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id, nom) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le workflow "${nom}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  const toDateTimeLocalValue = (value) => {
    if (!value || typeof value !== 'string') return '';
    // attend un datetime MySQL "YYYY-MM-DD HH:MM:SS" (ou sans secondes)
    const normalized = value.replace(' ', 'T');
    return normalized.length >= 16 ? normalized.slice(0, 16) : normalized;
  };

  const fromDateTimeLocalValue = (value) => {
    if (!value || typeof value !== 'string') return null;
    // input datetime-local => "YYYY-MM-DDTHH:MM"
    const normalized = value.replace('T', ' ');
    return normalized.length === 16 ? `${normalized}:00` : normalized;
  };

  // Fonction pour formater l'affichage des déclencheurs
  const formatTriggerDetails = (trigger, etatsData) => {
    const parts = [];
    parts.push(trigger.type.replace('_', ' '));
    
    if (trigger.type === 'etat_changed' || trigger.type === 'compte_rendu_approved') {
      const config = trigger.config || {};
      const hasEtatWorkflowCfg =
        trigger.type === 'etat_changed' ||
        config.etat_from_any || config.etat_to_any ||
        (Array.isArray(config.etat_from) && config.etat_from.length > 0) ||
        (Array.isArray(config.etat_to) && config.etat_to.length > 0) ||
        (config.etat_id != null && config.etat_id !== '') ||
        (Array.isArray(config.etat_from_titres) && config.etat_from_titres.length > 0) ||
        (Array.isArray(config.etat_to_titres) && config.etat_to_titres.length > 0) ||
        (config.etat_from != null && config.etat_from !== '' && !Array.isArray(config.etat_from)) ||
        (config.etat_to != null && config.etat_to !== '' && !Array.isArray(config.etat_to));

      if (hasEtatWorkflowCfg || trigger.type === 'etat_changed') {
        if (config.etat_from && Array.isArray(config.etat_from) && config.etat_from.length > 0) {
          const etatFrom = Array.isArray(config.etat_from) ? config.etat_from : [config.etat_from];
          const etatFromNames = etatFrom.map(id => {
            const etat = etatsData?.find(e => e.id === id);
            return etat ? `${etat.id}(${etat.titre})` : id;
          });
          parts.push(`de: ${etatFromNames.join(', ')}`);
        } else {
          parts.push('de: Tous les états');
        }
        if (config.etat_to || config.etat_id) {
          const etatTo = Array.isArray(config.etat_to) ? config.etat_to : (config.etat_to ? [config.etat_to] : (config.etat_id ? [config.etat_id] : []));
          if (etatTo.length > 0) {
            const etatToNames = etatTo.map(id => {
              const etat = etatsData?.find(e => e.id === id);
              return etat ? `${etat.id}(${etat.titre})` : id;
            });
            parts.push(`vers: ${etatToNames.join(', ')}`);
          } else {
            parts.push('vers: Tous les états');
          }
        } else {
          parts.push('vers: Tous les états');
        }
        const aft = Array.isArray(config.etat_from_titres) ? config.etat_from_titres.filter(Boolean) : [];
        const att = Array.isArray(config.etat_to_titres) ? config.etat_to_titres.filter(Boolean) : [];
        if (aft.length) parts.push(`titres de: ${aft.join(' | ')}`);
        if (att.length) parts.push(`titres vers: ${att.join(' | ')}`);
      }
    } else if (trigger.type === 'scheduled' && trigger.config?.cron) {
      parts.push(`cron: ${trigger.config.cron}`);
    } else if (trigger.type === 'fiche_rdv_etat_check') {
      const config = trigger.config || {};
      const offset = parseInt(config.rdv_offset_days || 0, 10);
      const etatIds = Array.isArray(config.etat_ids) ? config.etat_ids : [];
      parts.push(`rdv: J${offset >= 0 ? '+' : ''}${offset}`);
      parts.push(`etats: ${etatIds.length > 0 ? etatIds.join(', ') : 'Tous'}`);
    }
    
    return parts.join(' | ');
  };

  // Fonction pour formater l'affichage des actions
  const formatActionDetails = (action, fonctionsData, utilisateursData) => {
    const parts = [];
    parts.push(action.type.replace('_', ' '));
    
    const config = action.config || {};
    
    if (action.type === 'notification') {
      const hasFonctions = Array.isArray(config.destination_fonctions) && config.destination_fonctions.length > 0;
      const hasUtilisateurs = Array.isArray(config.destination_utilisateurs) && config.destination_utilisateurs.length > 0;
      if (hasFonctions || hasUtilisateurs) {
        if (hasFonctions) {
          const noms = config.destination_fonctions.map(id => fonctionsData?.find(f => f.id === id)?.titre || id);
          parts.push(`→ Fonctions: ${noms.join(', ')}`);
        }
        if (hasUtilisateurs) {
          parts.push(`→ ${config.destination_utilisateurs.length} utilisateur(s)`);
        }
      } else if (config.destination) {
        const destMap = {
          'id_insert': 'Agent créateur',
          'id_agent': 'Agent',
          'id_confirmateur': 'Confirmateur',
          'id_confirmateur_2': 'Confirmateur 2',
          'id_confirmateur_3': 'Confirmateur 3',
          'id_qualite': 'Agent qualité',
          'id_commercial': 'Commercial',
          'id_commercial_2': 'Commercial 2'
        };
        parts.push(`→ ${destMap[config.destination] || config.destination}`);
      } else {
        parts.push('→ Tous les admins');
      }
      if (config.afficher_expediteur === false) parts.push('(sans expéditeur)');
      if (config.message) {
        const msgPreview = config.message.substring(0, 30);
        parts.push(`"${msgPreview}${config.message.length > 30 ? '...' : ''}"`);
      }
    } else if (action.type === 'sms') {
      if (config.tel_field) {
        parts.push(`champ: ${config.tel_field}`);
      }
    } else if (action.type === 'update_field') {
      if (config.field) {
        parts.push(`champ: ${config.field}`);
      }
    } else if (action.type === 'change_etat') {
      if (config.etat_id) {
        parts.push(`état: ${config.etat_id}`);
      }
    } else if (action.type === 'webhook') {
      if (config.url) {
        const urlPreview = config.url.substring(0, 30);
        parts.push(`${config.method || 'POST'} ${urlPreview}${config.url.length > 30 ? '...' : ''}`);
      }
    } else if (action.type === 'system_message') {
      if (config.cibles_fonctions && Array.isArray(config.cibles_fonctions)) {
        const fonctionNames = config.cibles_fonctions.map(id => {
          const f = fonctionsData?.find(f => f.id === id);
          return f ? f.titre : id;
        });
        parts.push(`fonctions: ${fonctionNames.join(', ')}`);
      }
      if (config.cibles_utilisateurs && Array.isArray(config.cibles_utilisateurs)) {
        parts.push(`utilisateurs: ${config.cibles_utilisateurs.length}`);
      }
      if (config.type) {
        parts.push(`type: ${config.type}`);
      }
    } else if (action.type === 'execute_sql') {
      if (config.sql) {
        const preview = config.sql.substring(0, 50);
        parts.push(`"${preview}${config.sql.length > 50 ? '...' : ''}"`);
      }
    }
    
    if (action.delay_seconds > 0) {
      parts.push(`délai: ${action.delay_seconds}s`);
    }
    
    return parts.join(' | ');
  };

  const addTrigger = () => {
    setFormData({
      ...formData,
      triggers: [...formData.triggers, { type: 'fiche_created', config: {}, conditions: [] }]
    });
  };

  const removeTrigger = (index) => {
    setFormData({
      ...formData,
      triggers: formData.triggers.filter((_, i) => i !== index)
    });
  };

  const updateTrigger = (index, field, value) => {
    setFormData((prev) => {
      const newTriggers = [...prev.triggers];
      newTriggers[index] = { ...newTriggers[index], [field]: value };
      return { ...prev, triggers: newTriggers };
    });
  };

  const toggleTriggerEtatList = (triggerIndex, configKey, etatId, checked) => {
    const idNum = parseInt(String(etatId), 10);
    if (Number.isNaN(idNum)) return;
    setFormData((prev) => {
      const newTriggers = [...prev.triggers];
      const t = newTriggers[triggerIndex];
      const cfg = { ...(t.config || {}) };
      if (configKey === 'etat_from') {
        const list = etatIdListFromConfig(cfg.etat_from, undefined);
        const next = checked ? (list.includes(idNum) ? list : [...list, idNum]) : list.filter((x) => x !== idNum);
        cfg.etat_from = next;
        cfg.etat_from_any = false;
      } else {
        const list = etatIdListFromConfig(cfg.etat_to, cfg.etat_id);
        const next = checked ? (list.includes(idNum) ? list : [...list, idNum]) : list.filter((x) => x !== idNum);
        cfg.etat_to = next;
        cfg.etat_to_any = false;
        delete cfg.etat_id;
      }
      newTriggers[triggerIndex] = { ...t, config: cfg };
      return { ...prev, triggers: newTriggers };
    });
  };

  const addAction = () => {
    setFormData({
      ...formData,
      actions: [...formData.actions, { type: 'notification', config: {}, conditions: [], ordre: formData.actions.length, delay_seconds: 0 }]
    });
  };

  const removeAction = (index) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index)
    });
  };

  const updateAction = (index, field, value) => {
    setFormData((prev) => {
      const newActions = [...prev.actions];
      if (field === 'config' && typeof value === 'object') {
        newActions[index] = {
          ...newActions[index],
          config: { ...(newActions[index].config || {}), ...value }
        };
      } else {
        newActions[index] = { ...newActions[index], [field]: value };
      }
      return { ...prev, actions: newActions };
    });
  };

  if (isLoading) return <LoadingSpinner text="Chargement des workflows..." />;

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Gestion des Workflows</h2>
        <div className="tab-header-actions">
          <button className="btn-secondary" onClick={handleExportCSV} title="Exporter en CSV">
            <FaFileExport /> Exporter CSV
          </button>
          <button className="btn-primary" onClick={() => { 
            setShowForm(true); 
            setEditingId(null); 
            setFormData({
              nom: '',
              description: '',
              actif: 1,
              priorite: 0,
              combine_triggers: 'or',
              triggers: [{ type: 'fiche_created', config: {}, conditions: [] }],
              actions: [{ type: 'notification', config: { type: 'workflow', message: '', destination: '', link_page: '', link_page_manual: '' }, conditions: [], ordre: 0, delay_seconds: 0 }]
            });
          }}>
            <FaPlus /> Créer un workflow
          </button>
        </div>
      </div>

      <div className="search-bar">
        <div className="search-input-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par nom, description ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        {searchTerm && (
          <span className="search-results-count">
            {filteredData.length} résultat(s) trouvé(s)
          </span>
        )}
      </div>

      {showForm && (
        <div className="form-modal">
          <div className="form-content" style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3>{editingId ? 'Modifier' : 'Créer'} un workflow</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nom *</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  placeholder="Ex: Rappel RDV 24h avant"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="2"
                  placeholder="Description du workflow..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Actif</label>
                  <select
                    value={formData.actif}
                    onChange={(e) => setFormData({ ...formData, actif: parseInt(e.target.value) })}
                  >
                    <option value={1}>Oui</option>
                    <option value={0}>Non</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Priorité</label>
                  <input
                    type="number"
                    value={formData.priorite}
                    onChange={(e) => setFormData({ ...formData, priorite: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Combinaison des déclencheurs (même type d&apos;événement)</label>
                <select
                  value={formData.combine_triggers}
                  onChange={(e) => setFormData({ ...formData, combine_triggers: e.target.value })}
                >
                  <option value="or">OU — au moins une ligne de déclencheur doit correspondre</option>
                  <option value="and">ET — toutes les lignes de déclencheur doivent correspondre</option>
                </select>
                <p style={{ fontSize: '12px', color: '#555', marginTop: '6px', marginBottom: 0 }}>
                  S&apos;applique lorsque plusieurs blocs « Déclencheur » partagent le même type (ex. plusieurs « État changé »).
                  Les types d&apos;événements différents restent indépendants (chaque événement déclenche séparément).
                  Les conditions avancées à l&apos;intérieur d&apos;un bloc restent en ET entre elles.
                </p>
              </div>

              <div className="form-section">
                <h4>Déclencheurs</h4>
                {formData.triggers.map((trigger, index) => (
                  <div key={index} style={{ border: '1px solid #ddd', padding: '16px', marginBottom: '16px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <strong>Déclencheur {index + 1}</strong>
                      {formData.triggers.length > 1 && (
                        <button type="button" className="btn-danger" onClick={() => removeTrigger(index)}>
                          <FaTrash /> Supprimer
                        </button>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Type d'événement *</label>
                      <select
                        value={trigger.type}
                        onChange={(e) => updateTrigger(index, 'type', e.target.value)}
                        required
                      >
                        <option value="fiche_created">Fiche créée</option>
                        <option value="fiche_updated">Fiche modifiée</option>
                        <option value="etat_changed">État changé</option>
                        <option value="rdv_created">RDV créé</option>
                        <option value="rdv_validated">RDV validé</option>
                        <option value="compte_rendu_created">Compte rendu créé</option>
                        <option value="compte_rendu_approved">Compte rendu approuvé</option>
                        <option value="demande_insertion_created">Demande d'insertion créée</option>
                        <option value="demande_insertion_approved">Demande d'insertion approuvée</option>
                        <option value="demande_insertion_refusee">Demande d'insertion refusée</option>
                        <option value="planning_created">Planning créé</option>
                        <option value="planning_updated">Planning modifié</option>
                        <option value="decalage_created">Décalage créé</option>
                        <option value="decalage_accepted">Décalage accepté</option>
                        <option value="decalage_refused">Décalage refusé</option>
                        <option value="demande_decalage_annulee">Demande de décalage annulée</option>
                        <option value="remarque_created">Remarque créée</option>
                        <option value="alerte_ko_created">Alerte qualité (sans KO fiche ; aussi depuis Contrôle Qualité)</option>
                        <option value="alerte_controle_qualite_created">Alerte qualité — uniquement depuis Contrôle Qualité</option>
                        <option value="fiche_ko_created">Fiche mise en KO (ko = 1, validation qualité ou bascule KO)</option>
                        <option value="scheduled">Programmé (cron)</option>
                        <option value="fiche_rdv_etat_check">Filtre fiche (date RDV + état)</option>
                      </select>
                    </div>
                    <div style={{ padding: '10px', background: '#fff3cd', borderRadius: '6px', fontSize: '12px', marginBottom: '10px' }}>
                      <strong>Variables disponibles pour ce déclencheur :</strong>
                      <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {(TRIGGER_VARIABLES[trigger.type] || ['{user.id}']).map((v) => (
                          <code key={`${trigger.type}-${v}`} style={{ background: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                            {v}
                          </code>
                        ))}
                      </div>
                    </div>
                    {(trigger.type === 'etat_changed' || trigger.type === 'compte_rendu_approved') && (
                      <>
                        {trigger.type === 'compte_rendu_approved' && (
                          <div style={{ padding: '8px', background: '#e8f5e9', borderRadius: '4px', fontSize: '12px', marginBottom: '10px' }}>
                            Filtre sur la transition d&apos;état au moment de l&apos;approbation du compte rendu (IDs et/ou titres en base).
                          </div>
                        )}
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={(() => {
                                const cfg = trigger.config || {};
                                if (cfg.etat_from_any !== undefined) return !!cfg.etat_from_any;
                                // Compat: ancien comportement = null/undefined => tous
                                return cfg.etat_from === null || cfg.etat_from === undefined;
                              })()}
                              onChange={(e) => {
                                const newConfig = { ...trigger.config };
                                if (e.target.checked) {
                                  newConfig.etat_from_any = true;
                                  newConfig.etat_from = null;
                                } else {
                                  newConfig.etat_from_any = false;
                                  // mode sélection spécifique (liste vide au départ)
                                  newConfig.etat_from = [];
                                }
                                updateTrigger(index, 'config', newConfig);
                              }}
                              style={{ marginRight: '8px' }}
                            />
                            Depuis n'importe quel état (tous les états)
                          </label>
                          {(() => {
                            const cfg = trigger.config || {};
                            const fromAny = cfg.etat_from_any !== undefined ? !!cfg.etat_from_any : (cfg.etat_from === null || cfg.etat_from === undefined);
                            return fromAny;
                          })() ? (
                            <div style={{ padding: '8px', background: '#e8f5e9', borderRadius: '4px', fontSize: '12px', marginTop: '8px' }}>
                              ✓ Le workflow se déclenchera depuis n'importe quel état
                            </div>
                          ) : (
                            <>
                              <div
                                role="group"
                                aria-label="États source"
                                style={{
                                  marginTop: '8px',
                                  maxHeight: '220px',
                                  overflowY: 'auto',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px',
                                  padding: '8px',
                                  background: '#fafafa'
                                }}
                              >
                                {(etatsData || []).map((e) => {
                                  const idNum = parseInt(String(e.id), 10);
                                  const selected = etatIdListFromConfig(trigger.config?.etat_from, undefined);
                                  const isChecked = selected.includes(idNum);
                                  return (
                                    <label
                                      key={e.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '8px',
                                        cursor: 'pointer',
                                        marginBottom: '6px',
                                        fontSize: '13px',
                                        lineHeight: 1.35
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(ev) => toggleTriggerEtatList(index, 'etat_from', e.id, ev.target.checked)}
                                      />
                                      <span>
                                        <strong>{idNum}</strong>
                                        {' — '}
                                        {e.titre}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                              <small>Cochez un ou plusieurs états sources (ID affiché explicitement pour éviter toute confusion entre libellés proches).</small>
                            </>
                          )}
                        </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={(() => {
                                const cfg = trigger.config || {};
                                if (cfg.etat_to_any !== undefined) return !!cfg.etat_to_any;
                                // Compat: ancien comportement = null/undefined => tous
                                const hasTo = cfg.etat_to !== null && cfg.etat_to !== undefined;
                                const hasId = cfg.etat_id !== null && cfg.etat_id !== undefined;
                                return !hasTo && !hasId;
                              })()}
                              onChange={(e) => {
                                const newConfig = { ...trigger.config };
                                if (e.target.checked) {
                                  newConfig.etat_to_any = true;
                                  newConfig.etat_to = null;
                                  delete newConfig.etat_id;
                                } else {
                                  newConfig.etat_to_any = false;
                                  newConfig.etat_to = [];
                                  delete newConfig.etat_id;
                                }
                                updateTrigger(index, 'config', newConfig);
                              }}
                              style={{ marginRight: '8px' }}
                            />
                            Vers n'importe quel état (tous les états)
                          </label>
                          {(() => {
                            const cfg = trigger.config || {};
                            const toAny = cfg.etat_to_any !== undefined
                              ? !!cfg.etat_to_any
                              : ((cfg.etat_to === null || cfg.etat_to === undefined) && (cfg.etat_id === null || cfg.etat_id === undefined));
                            return toAny;
                          })() ? (
                            <div style={{ padding: '8px', background: '#e8f5e9', borderRadius: '4px', fontSize: '12px', marginTop: '8px' }}>
                              ✓ Le workflow se déclenchera vers n'importe quel état
                            </div>
                          ) : (
                            <>
                              <div
                                role="group"
                                aria-label="États cible"
                                style={{
                                  marginTop: '8px',
                                  maxHeight: '220px',
                                  overflowY: 'auto',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px',
                                  padding: '8px',
                                  background: '#fafafa'
                                }}
                              >
                                {(etatsData || []).map((e) => {
                                  const idNum = parseInt(String(e.id), 10);
                                  const selected = etatIdListFromConfig(trigger.config?.etat_to, trigger.config?.etat_id);
                                  const isChecked = selected.includes(idNum);
                                  return (
                                    <label
                                      key={e.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '8px',
                                        cursor: 'pointer',
                                        marginBottom: '6px',
                                        fontSize: '13px',
                                        lineHeight: 1.35
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(ev) => toggleTriggerEtatList(index, 'etat_to', e.id, ev.target.checked)}
                                      />
                                      <span>
                                        <strong>{idNum}</strong>
                                        {' — '}
                                        {e.titre}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                              <small>Cochez un ou plusieurs états cibles (ex. 8 — ANNULER ET A REPROGRAMMER, distinct de 5 — ANNULER).</small>
                            </>
                          )}
                        </div>
                        <div style={{ padding: '8px', background: '#e3f2fd', borderRadius: '4px', fontSize: '12px' }}>
                          <strong>Configuration actuelle :</strong><br />
                          {(() => {
                            const cfg = trigger.config || {};
                            const fromAny = cfg.etat_from_any !== undefined ? !!cfg.etat_from_any : (cfg.etat_from === null || cfg.etat_from === undefined);
                            const toAny = cfg.etat_to_any !== undefined ? !!cfg.etat_to_any : ((cfg.etat_to === null || cfg.etat_to === undefined) && (cfg.etat_id === null || cfg.etat_id === undefined));
                            const fromLabel = fromAny
                              ? 'Tous les états'
                              : (Array.isArray(cfg.etat_from) && cfg.etat_from.length > 0)
                                ? cfg.etat_from.map(id => {
                                    const etat = etatsData?.find(e => e.id === id);
                                    return etat ? `${etat.id}(${etat.titre})` : id;
                                  }).join(', ')
                                : '(aucun état sélectionné)';
                            const toIds = Array.isArray(cfg.etat_to) ? cfg.etat_to : (cfg.etat_to ? [cfg.etat_to] : (cfg.etat_id ? [cfg.etat_id] : []));
                            const toLabel = toAny
                              ? 'Tous les états'
                              : (toIds.length > 0)
                                ? toIds.map(id => {
                                    const etat = etatsData?.find(e => e.id === id);
                                    return etat ? `${etat.id}(${etat.titre})` : id;
                                  }).join(', ')
                                : '(aucun état sélectionné)';
                            return (
                              <>
                                État source : {fromLabel}<br />
                                État cible : {toLabel}
                              </>
                            );
                          })()}
                        </div>
                        <div className="form-group">
                          <label>Titres état source (optionnel, une ligne = un motif)</label>
                          <textarea
                            rows={2}
                            placeholder="Ex.: ANNULER ou CLIENT HONORE (une ligne par variante)"
                            value={Array.isArray(trigger.config?.etat_from_titres) ? trigger.config.etat_from_titres.join('\n') : (typeof trigger.config?.etat_from_titres === 'string' ? trigger.config.etat_from_titres : '')}
                            onChange={(e) => {
                              const lines = e.target.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
                              updateTrigger(index, 'config', {
                                ...trigger.config,
                                etat_from_titres: lines.length > 0 ? lines : undefined
                              });
                            }}
                          />
                          <small>Comparé au titre réel de l&apos;état source (sans tenir compte de la casse ni des accents). Avec des IDs sélectionnés : les deux conditions s&apos;appliquent (ET).</small>
                        </div>
                        <div className="form-group">
                          <label>Titres état cible (optionnel, une ligne = un motif)</label>
                          <textarea
                            rows={2}
                            placeholder="Ex. ANNULER ET A REPROGRAMMER"
                            value={Array.isArray(trigger.config?.etat_to_titres) ? trigger.config.etat_to_titres.join('\n') : (typeof trigger.config?.etat_to_titres === 'string' ? trigger.config.etat_to_titres : '')}
                            onChange={(e) => {
                              const lines = e.target.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
                              updateTrigger(index, 'config', {
                                ...trigger.config,
                                etat_to_titres: lines.length > 0 ? lines : undefined
                              });
                            }}
                          />
                          <small>Comparé au titre réel du nouvel état. Utile pour distinguer des états proches (ex. Annuler vs Annuler à reprogrammer).</small>
                        </div>
                      </>
                    )}
                    {trigger.type === 'scheduled' && (
                      <div className="form-group">
                        <label>Expression Cron</label>
                        <input
                          type="text"
                          placeholder="0 * * * * (toutes les heures)"
                          value={trigger.config?.cron || ''}
                          onChange={(e) => updateTrigger(index, 'config', { ...trigger.config, cron: e.target.value })}
                        />
                      </div>
                    )}
                    {trigger.type === 'fiche_rdv_etat_check' && (
                      <>
                        <div className="form-group">
                          <label>Décalage date RDV (jours)</label>
                          <input
                            type="number"
                            value={trigger.config?.rdv_offset_days ?? 0}
                            onChange={(e) => updateTrigger(index, 'config', { ...trigger.config, rdv_offset_days: parseInt(e.target.value, 10) || 0 })}
                          />
                          <small>0 = aujourd&apos;hui, 1 = demain, -1 = hier. Si négatif (ex: -2), inclut J-2 et avant.</small>
                        </div>
                        <div className="form-group">
                          <label>États fiche ciblés (optionnel)</label>
                          <select
                            multiple
                            value={Array.isArray(trigger.config?.etat_ids) ? trigger.config.etat_ids.map(String) : []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value, 10));
                              updateTrigger(index, 'config', { ...trigger.config, etat_ids: selected.length > 0 ? selected : [] });
                            }}
                            size={6}
                          >
                            {etatsData?.map(etat => (
                              <option key={etat.id} value={etat.id}>{etat.id} - {etat.titre}</option>
                            ))}
                          </select>
                          <small>Si vide: tous les états.</small>
                        </div>
                        <div style={{ padding: '8px', background: '#e8f5e9', borderRadius: '4px', fontSize: '12px' }}>
                          A utiliser avec un déclencheur <strong>Programmé (cron)</strong> dans le même workflow.
                        </div>
                      </>
                    )}
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={addTrigger}>
                  <FaPlus /> Ajouter un déclencheur
                </button>
              </div>

              <div className="form-section">
                <h4>Actions</h4>
                {formData.actions.map((action, index) => (
                  <div key={index} style={{ border: '1px solid #ddd', padding: '16px', marginBottom: '16px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <strong>Action {index + 1}</strong>
                      <button type="button" className="btn-danger" onClick={() => removeAction(index)}>
                        <FaTrash /> Supprimer
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div className="form-group">
                        <label>Type d'action *</label>
                        <select
                          value={action.type}
                          onChange={(e) => updateAction(index, 'type', e.target.value)}
                          required
                        >
                          <option value="notification">Notification interne</option>
                          <option value="sms">SMS</option>
                          <option value="email">Email</option>
                          <option value="update_field">Mettre à jour un champ</option>
                          <option value="change_etat">Changer l'état</option>
                          <option value="webhook">Webhook HTTP</option>
                          <option value="system_message">Message système</option>
                          <option value="execute_sql">Exécuter requête SQL</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Délai (secondes)</label>
                        <input
                          type="number"
                          value={action.delay_seconds || 0}
                          onChange={(e) => updateAction(index, 'delay_seconds', parseInt(e.target.value) || 0)}
                          min="0"
                        />
                      </div>
                    </div>

                    {action.type === 'notification' && (
                      <>
                        <div className="form-group">
                          <label>Type de notification</label>
                          <input
                            type="text"
                            value={action.config?.type || 'workflow'}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, type: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Message *</label>
                          <textarea
                            value={action.config?.message || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, message: e.target.value })}
                            rows="2"
                            placeholder="Message de notification. Variables: {fiche.nom}, {fiche.prenom}, {fiche.id}"
                            required
                          />
                        </div>

                        <div className="form-group" style={{ marginTop: '16px', padding: '10px', background: '#f5f5f5', borderRadius: '6px' }}>
                          <strong>Destinataires</strong>
                          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#555' }}>
                            Choisir <strong>un utilisateur</strong>, <strong>plusieurs utilisateurs</strong> et/ou <strong>une ou plusieurs fonctions</strong>. Si au moins un destinataire est choisi ci-dessous, il remplace l’option « Rôle sur la fiche ».
                          </p>
                        </div>

                        <div className="form-group">
                          <label>Un ou plusieurs utilisateurs</label>
                          <select
                            multiple
                            value={Array.isArray(action.config?.destination_utilisateurs) ? action.config.destination_utilisateurs.map(String) : []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, (opt) => {
                                const value = opt.value;
                                if (value.startsWith('{') && value.endsWith('}')) return value;
                                return parseInt(value, 10);
                              });
                              updateAction(index, 'config', { ...action.config, destination_utilisateurs: selected.length > 0 ? selected : null });
                            }}
                            size={9}
                          >
                            <optgroup label="Destinataires dynamiques (basés sur la fiche)">
                              {DYNAMIC_RECIPIENT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Utilisateurs spécifiques">
                              {utilisateursData?.map(u => (
                                <option key={u.id} value={u.id}>{u.pseudo || u.login} — {u.nom} {u.prenom}</option>
                              ))}
                            </optgroup>
                          </select>
                          <small>Un ou plusieurs utilisateurs fixes et/ou destinataires dynamiques. Ctrl/Cmd pour multi-sélection.</small>
                        </div>
                        <div className="form-group">
                          <label>Une ou plusieurs fonctions</label>
                          <select
                            multiple
                            value={Array.isArray(action.config?.destination_fonctions) ? action.config.destination_fonctions.map(String) : []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, opt => parseInt(opt.value));
                              updateAction(index, 'config', { ...action.config, destination_fonctions: selected.length > 0 ? selected : null });
                            }}
                            size={5}
                          >
                            {fonctionsData?.map(f => (
                              <option key={f.id} value={f.id}>{f.id} — {f.titre}</option>
                            ))}
                          </select>
                          <small>Envoi à tous les utilisateurs ayant cette fonction. Ctrl/Cmd pour multi-sélection.</small>
                        </div>

                        <div className="form-group">
                          <label>Sinon : rôle sur la fiche ou tous les admins</label>
                          <select
                            value={action.config?.destination || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, destination: e.target.value })}
                          >
                            <option value="">Tous les admins</option>
                            <option value="id_insert">Agent qui a créé la fiche ({'{fiche.id_insert}'})</option>
                            <option value="id_agent">Agent assigné à la fiche ({'{fiche.id_agent}'})</option>
                            <option value="id_confirmateur">Confirmateur principal ({'{fiche.id_confirmateur}'})</option>
                            <option value="id_confirmateur_2">Confirmateur secondaire ({'{fiche.id_confirmateur_2}'})</option>
                            <option value="id_confirmateur_3">Confirmateur tertiaire ({'{fiche.id_confirmateur_3}'})</option>
                            <option value="id_qualite">Agent qualité qui a audité ({'{fiche.id_qualite}'})</option>
                            <option value="id_commercial">Commercial principal ({'{fiche.id_commercial}'})</option>
                            <option value="id_commercial_2">Commercial secondaire ({'{fiche.id_commercial_2}'})</option>
                            <option value="id_superviseur_qualif_agent">Superviseur qualif de l&apos;agent de la fiche ({'{fiche.id_superviseur_qualif_agent}'})</option>
                            <option value="remarque_destinataire">Destinataire de la remarque (déclencheur remarque)</option>
                            <option value="remarque_expediteur">Expéditeur de la remarque (déclencheur remarque)</option>
                            <option value="alerte_ko_agent">Agent destinataire de l&apos;alerte qualité (notification, pas KO fiche)</option>
                            <option value="decalage_expediteur">Expéditeur du décalage (ex. commercial)</option>
                            <option value="decalage_destination">Confirmateur du décalage (destination)</option>
                          </select>
                          <small>Utilisé uniquement si aucun utilisateur ni fonction n’est sélectionné ci-dessus.</small>
                        </div>
                        <div className="form-group">
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="checkbox"
                              checked={action.config?.afficher_expediteur !== false}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, afficher_expediteur: e.target.checked })}
                            />
                            Afficher l&apos;expéditeur
                          </label>
                          <small>Si décoché, le nom de l&apos;expéditeur ne sera pas affiché dans la notification.</small>
                        </div>
                        <div className="form-group">
                          <label>Clic sur la notification — page de destination</label>
                          <select
                            value={action.config?.link_page || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, link_page: e.target.value })}
                          >
                            {NOTIFICATION_LINK_PAGE_PRESETS.map((opt) => (
                              <option key={opt.value === '' ? '_default' : opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <small>Par défaut : ouverture de la fiche liée. Sinon : page interne (ex. compte-rendu → /compte-rendu).</small>
                        </div>
                        <div className="form-group">
                          <label>Ou chemin / slug personnalisé (prioritaire)</label>
                          <input
                            type="text"
                            value={action.config?.link_page_manual || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, link_page_manual: e.target.value })}
                            placeholder="ex. compte-rendu-pending ou /statistiques"
                          />
                          <small>Si ce champ est rempli, il remplace le menu ci-dessus.</small>
                        </div>
                      </>
                    )}

                    {action.type === 'sms' && (
                      <>
                        <div className="form-group">
                          <label>Message *</label>
                          <textarea
                            value={action.config?.message || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, message: e.target.value })}
                            rows="2"
                            placeholder="Message SMS. Variables: {fiche.nom}, {fiche.prenom}, {fiche.tel}"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Champ téléphone</label>
                          <select
                            value={action.config?.tel_field || 'tel'}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, tel_field: e.target.value })}
                          >
                            <option value="tel">tel</option>
                            <option value="gsm1">gsm1</option>
                            <option value="gsm2">gsm2</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ marginTop: '16px', padding: '10px', background: '#f5f5f5', borderRadius: '6px' }}>
                          <strong>Destinataires dynamiques (comme message système)</strong>
                          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#555' }}>
                            Préparation UI pour ciblage avancé. Aujourd&apos;hui, l&apos;envoi SMS workflow utilise principalement le téléphone de la fiche via "Champ téléphone".
                          </p>
                        </div>
                        <div className="form-group">
                          <label>Utilisateurs ciblés (optionnel)</label>
                          <select
                            multiple
                            value={Array.isArray(action.config?.cibles_utilisateurs) ? action.config.cibles_utilisateurs.map(String) : []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, (opt) => {
                                const value = opt.value;
                                if (value.startsWith('{') && value.endsWith('}')) return value;
                                return parseInt(value, 10);
                              });
                              updateAction(index, 'config', { ...action.config, cibles_utilisateurs: selected.length > 0 ? selected : null });
                            }}
                            size={8}
                          >
                            <optgroup label="Destinataires dynamiques (basés sur la fiche)">
                              {DYNAMIC_RECIPIENT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Utilisateurs spécifiques">
                              {utilisateursData?.map(u => (
                                <option key={u.id} value={u.id}>{u.pseudo || u.login} — {u.nom} {u.prenom}</option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Fonctions ciblées (optionnel)</label>
                          <select
                            multiple
                            value={Array.isArray(action.config?.cibles_fonctions) ? action.config.cibles_fonctions.map(String) : []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, opt => parseInt(opt.value, 10));
                              updateAction(index, 'config', { ...action.config, cibles_fonctions: selected.length > 0 ? selected : null });
                            }}
                            size={5}
                          >
                            {fonctionsData?.map(f => (
                              <option key={f.id} value={f.id}>{f.id} — {f.titre}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {action.type === 'email' && (
                      <>
                        <div className="form-group">
                          <label>Sujet *</label>
                          <input
                            type="text"
                            value={action.config?.subject || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, subject: e.target.value })}
                            placeholder="Sujet email"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Message *</label>
                          <textarea
                            value={action.config?.message || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, message: e.target.value })}
                            rows="3"
                            placeholder="Corps du message email"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Utilisateurs ciblés</label>
                          <select
                            multiple
                            value={Array.isArray(action.config?.cibles_utilisateurs) ? action.config.cibles_utilisateurs.map(String) : []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, (opt) => {
                                const value = opt.value;
                                if (value.startsWith('{') && value.endsWith('}')) return value;
                                return parseInt(value, 10);
                              });
                              updateAction(index, 'config', { ...action.config, cibles_utilisateurs: selected.length > 0 ? selected : null });
                            }}
                            size={8}
                          >
                            <optgroup label="Destinataires dynamiques (basés sur la fiche)">
                              {DYNAMIC_RECIPIENT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Utilisateurs spécifiques">
                              {utilisateursData?.map(u => (
                                <option key={u.id} value={u.id}>{u.pseudo || u.login} — {u.nom} {u.prenom}</option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Fonctions ciblées</label>
                          <select
                            multiple
                            value={Array.isArray(action.config?.cibles_fonctions) ? action.config.cibles_fonctions.map(String) : []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, opt => parseInt(opt.value, 10));
                              updateAction(index, 'config', { ...action.config, cibles_fonctions: selected.length > 0 ? selected : null });
                            }}
                            size={5}
                          >
                            {fonctionsData?.map(f => (
                              <option key={f.id} value={f.id}>{f.id} — {f.titre}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {action.type === 'update_field' && (
                      <>
                        <div className="form-group">
                          <label>Champ à mettre à jour *</label>
                          <input
                            type="text"
                            value={action.config?.field || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, field: e.target.value })}
                            placeholder="Ex: id_confirmateur, id_agent"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Valeur *</label>
                          <input
                            type="text"
                            value={action.config?.value || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, value: e.target.value })}
                            placeholder="Valeur ou variable: {user.id}, {fiche.id_confirmateur}"
                            required
                          />
                        </div>
                      </>
                    )}

                    {action.type === 'change_etat' && (
                      <div className="form-group">
                        <label>ID de l'état *</label>
                        <input
                          type="number"
                          value={action.config?.etat_id || ''}
                          onChange={(e) => updateAction(index, 'config', { ...action.config, etat_id: e.target.value ? parseInt(e.target.value) : null })}
                          required
                        />
                      </div>
                    )}

                    {action.type === 'webhook' && (
                      <>
                        <div className="form-group">
                          <label>URL *</label>
                          <input
                            type="url"
                            value={action.config?.url || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, url: e.target.value })}
                            placeholder="https://example.com/webhook"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Méthode HTTP</label>
                          <select
                            value={action.config?.method || 'POST'}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, method: e.target.value })}
                          >
                            <option value="POST">POST</option>
                            <option value="GET">GET</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                          </select>
                        </div>
                      </>
                    )}

                    {action.type === 'system_message' && (
                      <>
                        <div className="form-group">
                          <label>Titre (optionnel)</label>
                          <input
                            type="text"
                            value={action.config?.titre || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, titre: e.target.value })}
                            placeholder="Titre du message système"
                          />
                        </div>
                        <div className="form-group">
                          <label>Message *</label>
                          <textarea
                            value={action.config?.message || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, message: e.target.value })}
                            rows="3"
                            placeholder="Message système. Variables: {fiche.nom}, {fiche.prenom}, {user.pseudo}"
                            required
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group">
                            <label>Type</label>
                            <select
                              value={action.config?.type || 'info'}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, type: e.target.value })}
                            >
                              <option value="info">Information</option>
                              <option value="success">Succès</option>
                              <option value="warning">Avertissement</option>
                              <option value="error">Erreur</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Priorité</label>
                            <select
                              value={action.config?.priorite || 1}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, priorite: parseInt(e.target.value) })}
                            >
                              <option value={1}>Normal</option>
                              <option value={2}>Important</option>
                              <option value={3}>Urgent</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group">
                            <label>Date début (optionnel)</label>
                            <input
                              type="datetime-local"
                              value={toDateTimeLocalValue(action.config?.date_debut)}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, date_debut: fromDateTimeLocalValue(e.target.value) })}
                            />
                            <small>Si vide: affichage immédiat.</small>
                          </div>
                          <div className="form-group">
                            <label>Date fin (optionnel)</label>
                            <input
                              type="datetime-local"
                              value={toDateTimeLocalValue(action.config?.date_fin)}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, date_fin: fromDateTimeLocalValue(e.target.value) })}
                            />
                            <small>Si vide: pas de date de fin.</small>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group">
                            <label>
                              <input
                                type="checkbox"
                                checked={(action.config?.actif ?? 1) === 1}
                                onChange={(e) => updateAction(index, 'config', { ...action.config, actif: e.target.checked ? 1 : 0 })}
                                style={{ marginRight: '8px' }}
                              />
                              Actif
                            </label>
                            <small>Si désactivé, le message ne s'affichera pas.</small>
                          </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={(action.config?.afficher_une_seule_fois ?? 0) === 1}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, afficher_une_seule_fois: e.target.checked ? 1 : 0 })}
                              style={{ marginRight: '8px' }}
                            />
                            Afficher une seule fois
                          </label>
                          <small>Si coché, le message disparaît après lecture.</small>
                        </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={action.config?.afficher_expediteur !== false}
                              onChange={(e) => updateAction(index, 'config', { ...action.config, afficher_expediteur: e.target.checked })}
                              style={{ marginRight: '8px' }}
                            />
                            Afficher l&apos;expéditeur
                          </label>
                          <small>Si décoché, le nom du créateur du message ne sera pas affiché.</small>
                        </div>
                        </div>

                        <div className="form-group">
                          <label>Fonctions ciblées</label>
                          <select
                            multiple
                            value={Array.isArray(action.config?.cibles_fonctions) ? action.config.cibles_fonctions.map(String) : []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                              updateAction(index, 'config', { ...action.config, cibles_fonctions: selected.length > 0 ? selected : null });
                            }}
                            size={5}
                          >
                            {fonctionsData?.map(f => (
                              <option key={f.id} value={f.id}>{f.id} - {f.titre}</option>
                            ))}
                          </select>
                          <small>Maintenez Ctrl (Cmd sur Mac) pour sélectionner plusieurs fonctions. Au moins une fonction ou un utilisateur doit être sélectionné.</small>
                        </div>
                        <div className="form-group">
                          <label>Utilisateurs ciblés</label>
                          <select
                            multiple
                            value={Array.isArray(action.config?.cibles_utilisateurs) ? action.config.cibles_utilisateurs.map(String) : []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, option => {
                                const value = option.value;
                                // Si c'est une variable (commence par {), garder comme chaîne
                                if (value.startsWith('{')) {
                                  return value;
                                }
                                // Sinon, convertir en nombre
                                return parseInt(value);
                              });
                              updateAction(index, 'config', { ...action.config, cibles_utilisateurs: selected.length > 0 ? selected : null });
                            }}
                            size={8}
                          >
                            <optgroup label="Destinataires dynamiques (basés sur la fiche)">
                              <option value="{fiche.id_insert}">Agent qui a créé la fiche ({'{fiche.id_insert}'})</option>
                              <option value="{fiche.id_agent}">Agent assigné ({'{fiche.id_agent}'})</option>
                              <option value="{fiche.id_confirmateur}">Confirmateur principal ({'{fiche.id_confirmateur}'})</option>
                              <option value="{fiche.id_confirmateur_2}">Confirmateur secondaire ({'{fiche.id_confirmateur_2}'})</option>
                              <option value="{fiche.id_confirmateur_3}">Confirmateur tertiaire ({'{fiche.id_confirmateur_3}'})</option>
                              <option value="{fiche.id_qualite}">Agent qualité ({'{fiche.id_qualite}'})</option>
                              <option value="{fiche.id_commercial}">Commercial principal ({'{fiche.id_commercial}'})</option>
                              <option value="{fiche.id_commercial_2}">Commercial secondaire ({'{fiche.id_commercial_2}'})</option>
                              <option value="{fiche.id_superviseur_qualif_agent}">Superviseur qualif de l&apos;agent de la fiche ({'{fiche.id_superviseur_qualif_agent}'})</option>
                              <option value="{remarque.id_destinataire}">Destinataire de la remarque ({'{remarque.id_destinataire}'})</option>
                              <option value="{remarque.id_expediteur}">Expéditeur de la remarque ({'{remarque.id_expediteur}'})</option>
                              <option value="{alerte_ko.id_agent}">Agent destinataire alerte qualité ({'{alerte_ko.id_agent}'})</option>
                              <option value="{decalage.expediteur}">Expéditeur du décalage ({'{decalage.expediteur}'})</option>
                              <option value="{decalage.destination}">Confirmateur du décalage ({'{decalage.destination}'})</option>
                            </optgroup>
                            <optgroup label="Utilisateurs spécifiques">
                              {utilisateursData?.map(u => (
                                <option key={u.id} value={u.id}>{u.nom} {u.prenom} ({u.login})</option>
                              ))}
                            </optgroup>
                          </select>
                          <small>Maintenez Ctrl (Cmd sur Mac) pour sélectionner plusieurs utilisateurs. Les destinataires dynamiques seront résolus selon la fiche concernée. Au moins une fonction ou un utilisateur doit être sélectionné.</small>
                        </div>
                        {(action.config?.cibles_fonctions || action.config?.cibles_utilisateurs) && (
                          <div style={{ padding: '8px', background: '#e8f5e9', borderRadius: '4px', fontSize: '12px' }}>
                            <strong>Destinataires :</strong><br />
                            {action.config?.cibles_fonctions && (
                              <>Fonctions : {Array.isArray(action.config.cibles_fonctions) ? action.config.cibles_fonctions.length : 1} sélectionnée(s)<br /></>
                            )}
                            {action.config?.cibles_utilisateurs && (
                              <>Utilisateurs : {Array.isArray(action.config.cibles_utilisateurs) ? action.config.cibles_utilisateurs.length : 1} sélectionné(s)</>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {action.type === 'execute_sql' && (
                      <>
                        <div className="form-group">
                          <label>Requête SQL *</label>
                          <textarea
                            value={action.config?.sql || ''}
                            onChange={(e) => updateAction(index, 'config', { ...action.config, sql: e.target.value })}
                            rows="6"
                            placeholder="Ex: UPDATE fiches SET id_confirmateur = {fiche.id_confirmateur} WHERE id = {fiche.id}"
                            required
                            style={{ fontFamily: 'monospace', fontSize: '12px' }}
                          />
                        </div>
                        <div style={{ padding: '10px', background: '#e3f2fd', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>
                          <strong>Variables disponibles (utiliser entre accolades) :</strong>
                          <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                            <li><code>{'{fiche.id}'}</code> — ID de la fiche</li>
                            <li><code>{'{fiche.id_confirmateur}'}</code> — Confirmateur principal</li>
                            <li><code>{'{fiche.id_confirmateur_2}'}</code> — Confirmateur 2</li>
                            <li><code>{'{fiche.id_confirmateur_3}'}</code> — Confirmateur 3</li>
                            <li><code>{'{fiche.id_agent}'}</code> — Agent assigné</li>
                            <li><code>{'{fiche.id_qualite}'}</code> — Agent qualité</li>
                            <li><code>{'{fiche.id_commercial}'}</code> — Commercial principal</li>
                            <li><code>{'{fiche.id_commercial_2}'}</code> — Commercial 2</li>
                            <li><code>{'{fiche.id_insert}'}</code> — Agent créateur</li>
                            <li><code>{'{fiche.id_etat_final}'}</code> — État actuel</li>
                            <li><code>{'{user.id}'}</code> — ID de l&apos;utilisateur qui a déclenché</li>
                            <li style={{ listStyle: 'none', marginTop: '6px' }}><strong>Date / DateTime :</strong></li>
                            <li><code>{'{NOW}'}</code> ou <code>{'{CURRENT_DATE}'}</code> — Date du jour (YYYY-MM-DD)</li>
                            <li><code>{'{NOW_DATETIME}'}</code> ou <code>{'{CURRENT_DATETIME}'}</code> — Date et heure actuelles (YYYY-MM-DD HH:MM:SS)</li>
                            <li><code>{'{fiche.date_rdv_time}'}</code> — Date/heure RDV</li>
                            <li><code>{'{fiche.date_insert_time}'}</code> — Date/heure création</li>
                            <li><code>{'{fiche.date_modif_time}'}</code> — Date/heure dernière modification</li>
                          </ul>
                          <p style={{ margin: '8px 0 0 0', color: '#666' }}>
                            Les variables sont remplacées de façon sécurisée (paramètres préparés). Requêtes SELECT, INSERT, UPDATE, DELETE supportées.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={addAction}>
                  <FaPlus /> Ajouter une action
                </button>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={createMutation.isLoading || updateMutation.isLoading}>
                  {editingId ? 'Modifier' : 'Créer'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Description</th>
              <th>Déclencheurs</th>
              <th>Actions</th>
              <th>Priorité</th>
              <th>État</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                  Aucun workflow trouvé
                </td>
              </tr>
            ) : (
              paginatedData.map((workflow) => (
                <tr key={workflow.id}>
                  <td>{workflow.id}</td>
                  <td><strong>{workflow.nom}</strong></td>
                  <td>{workflow.description || '-'}</td>
                  <td>
                    <div style={{ fontSize: '12px' }}>
                      {workflow.triggers?.map((t, idx) => (
                        <div key={idx} style={{ marginBottom: '4px', padding: '4px', background: '#f5f5f5', borderRadius: '3px' }}>
                          <strong>{t.type.replace('_', ' ')}</strong>
                          {(t.type === 'etat_changed' || t.type === 'compte_rendu_approved') && (t.config?.etat_from || t.config?.etat_to || t.config?.etat_id || t.config?.etat_from_any || t.config?.etat_to_any || (Array.isArray(t.config?.etat_from_titres) && t.config.etat_from_titres.length > 0) || (Array.isArray(t.config?.etat_to_titres) && t.config.etat_to_titres.length > 0)) && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              {t.config?.etat_from_any ? (
                                <>De: tous </>
                              ) : t.config?.etat_from && (
                                <>De: {Array.isArray(t.config.etat_from)
                                  ? t.config.etat_from.map((id) => {
                                      const etat = etatsData?.find((e) => e.id === id);
                                      return etat ? `${etat.id}(${etat.titre})` : id;
                                    }).join(', ')
                                  : t.config.etat_from}{' '}
                                </>
                              )}
                              {t.config?.etat_to_any ? (
                                <>Vers: tous</>
                              ) : (t.config?.etat_to || t.config?.etat_id) && (
                                <>Vers: {Array.isArray(t.config?.etat_to)
                                  ? t.config.etat_to.map((id) => {
                                      const etat = etatsData?.find((e) => e.id === id);
                                      return etat ? `${etat.id}(${etat.titre})` : id;
                                    }).join(', ')
                                  : (t.config?.etat_to || t.config?.etat_id)}</>
                              )}
                              {Array.isArray(t.config?.etat_from_titres) && t.config.etat_from_titres.length > 0 && (
                                <div style={{ marginTop: '2px' }}>Titres de: {t.config.etat_from_titres.join(' | ')}</div>
                              )}
                              {Array.isArray(t.config?.etat_to_titres) && t.config.etat_to_titres.length > 0 && (
                                <div style={{ marginTop: '2px' }}>Titres vers: {t.config.etat_to_titres.join(' | ')}</div>
                              )}
                            </div>
                          )}
                          {t.type === 'scheduled' && t.config?.cron && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              Cron: {t.config.cron}
                            </div>
                          )}
                        </div>
                      ))}
                      {(!workflow.triggers || workflow.triggers.length === 0) && <span style={{ color: '#999' }}>-</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '12px' }}>
                      {workflow.actions?.map((a, idx) => (
                        <div key={idx} style={{ marginBottom: '4px', padding: '4px', background: '#e8f5e9', borderRadius: '3px' }}>
                          <strong>{a.type.replace('_', ' ')}</strong>
                          {a.type === 'notification' && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              {a.config?.destination ? `→ ${a.config.destination}` : '→ Tous les admins'}
                            </div>
                          )}
                          {a.type === 'system_message' && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              {a.config?.type && `Type: ${a.config.type} `}
                              {a.config?.cibles_fonctions && Array.isArray(a.config.cibles_fonctions) && (
                                <>Fonctions: {a.config.cibles_fonctions.length} </>
                              )}
                              {a.config?.cibles_utilisateurs && Array.isArray(a.config.cibles_utilisateurs) && (
                                <>Utilisateurs: {a.config.cibles_utilisateurs.length}</>
                              )}
                            </div>
                          )}
                          {a.type === 'execute_sql' && a.config?.sql && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              {a.config.sql.substring(0, 40)}{a.config.sql.length > 40 ? '...' : ''}
                            </div>
                          )}
                          {a.delay_seconds > 0 && (
                            <div style={{ fontSize: '11px', color: '#ff9800', marginTop: '2px' }}>
                              Délai: {a.delay_seconds}s
                            </div>
                          )}
                        </div>
                      ))}
                      {(!workflow.actions || workflow.actions.length === 0) && <span style={{ color: '#999' }}>-</span>}
                    </div>
                  </td>
                  <td>{workflow.priorite}</td>
                  <td>
                    <button
                      className="btn-icon"
                      onClick={() => toggleMutation.mutate(workflow.id)}
                      title={workflow.actif === 1 ? 'Désactiver' : 'Activer'}
                    >
                      {workflow.actif === 1 ? <FaToggleOn style={{ color: '#4CAF50' }} /> : <FaToggleOff style={{ color: '#999' }} />}
                    </button>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        onClick={() => testMutation.mutate(workflow.id)}
                        title="Tester le workflow"
                      >
                        <FaPlay />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => setShowExecutions(showExecutions === workflow.id ? null : workflow.id)}
                        title="Voir l'historique"
                      >
                        <FaHistory />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleEdit(workflow)}
                        title="Modifier"
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(workflow.id, workflow.nom)}
                        title="Supprimer"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showExecutions && (
        <ExecutionsModal workflowId={showExecutions} onClose={() => setShowExecutions(null)} />
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
          totalItems={filteredData.length}
        />
      )}
    </div>
  );
};

// Composant modal pour l'historique d'exécution
const ExecutionsModal = ({ workflowId, onClose }) => {
  const { data, isLoading } = useQuery(
    ['workflow-executions', workflowId],
    async () => {
      const response = await api.get(`/workflows/${workflowId}/executions`);
      return response.data.data;
    },
    { enabled: !!workflowId }
  );

  if (!workflowId) return null;

  return (
    <div className="form-modal" onClick={onClose}>
      <div className="form-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <h3>Historique d'exécution</h3>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Fiche</th>
                  <th>Utilisateur</th>
                  <th>Erreur</th>
                </tr>
              </thead>
              <tbody>
                {data && data.length > 0 ? (
                  data.map((exec) => (
                    <tr key={exec.id}>
                      <td>{exec.id}</td>
                      <td>{exec.started_at ? new Date(exec.started_at).toLocaleString('fr-FR') : '-'}</td>
                      <td>
                        <span className={`badge badge-${exec.status}`}>
                          {exec.status}
                        </span>
                      </td>
                      <td>{exec.fiche_nom && exec.fiche_prenom ? `${exec.fiche_nom} ${exec.fiche_prenom}` : exec.id_fiche || '-'}</td>
                      <td>{exec.user_pseudo || '-'}</td>
                      <td>{exec.error_message || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center' }}>Aucune exécution</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowsTab;

