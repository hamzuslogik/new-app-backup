import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { FaEdit, FaCheck, FaTimes, FaCalendar, FaUser, FaUserPlus, FaPhone, FaMapMarkerAlt, FaHome, FaBriefcase, FaFileAlt, FaHistory, FaArrowLeft, FaChevronLeft, FaChevronRight, FaChevronDown, FaChevronUp, FaReplyAll, FaSms, FaListAlt, FaInfoCircle, FaFilePdf } from 'react-icons/fa';
import jsPDF from 'jspdf';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useRouteParams } from '../contexts/RouteParamsContext';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { getEtatsGroupedByPhase } from '../utils/etatsByPhase';
import { formatRdvDateTime, formatRdvDateOnly, formatRdvTimeOnly } from '../utils/formatRdvDateTime';
import { differenceInMinutes, differenceInHours, differenceInDays, differenceInMonths, format, addMonths } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';
import './FicheDetail.css';

/** Date d'appel exploitable pour affichage (détails fiche, pas historique). */
function parseFicheDateAppel(fiche) {
  if (!fiche) return null;
  if (fiche.date_appel_time) {
    const d = new Date(fiche.date_appel_time);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (fiche.date_appel_date) {
    const d = new Date(fiche.date_appel_date);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (fiche.date_appel != null && fiche.date_appel !== '') {
    const n = Number(fiche.date_appel);
    if (!Number.isNaN(n)) {
      const d = new Date(n * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

/** Texte relatif après la date absolue : « Jeudi, il y a 1 mois et 1 semaine » (détails fiche uniquement). */
function formatDateAppelRelativeDescription(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const weekday = format(date, 'EEEE', { locale: frLocale });
  const dayLabel = weekday ? `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ` : '';

  if (date > now) {
    return `${dayLabel}dans le futur`;
  }

  const diffMins = differenceInMinutes(now, date);
  const diffHrs = differenceInHours(now, date);
  const diffDays = differenceInDays(now, date);

  if (diffDays >= 365) {
    return `${dayLabel}il y a longtemps`;
  }

  if (diffMins < 1) {
    return `${dayLabel}à l'instant`;
  }
  if (diffMins < 60) {
    return `${dayLabel}il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  }
  if (diffHrs < 24) {
    return `${dayLabel}il y a ${diffHrs} heure${diffHrs > 1 ? 's' : ''}`;
  }
  if (diffDays < 7) {
    return `${dayLabel}il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  }
  if (diffDays < 30) {
    const w = Math.floor(diffDays / 7);
    const d = diffDays % 7;
    let rel = `il y a ${w} semaine${w > 1 ? 's' : ''}`;
    if (d > 0) rel += `, ${d} jour${d > 1 ? 's' : ''}`;
    return `${dayLabel}${rel}`;
  }
  // ≥ 30 jours et &lt; 1 an : mois calendaires + reste en semaines (et jours si besoin)
  const fullMonths = differenceInMonths(now, date);
  if (fullMonths >= 1) {
    const afterMonths = addMonths(date, fullMonths);
    const remDays = Math.max(0, differenceInDays(now, afterMonths));
    const weeks = Math.floor(remDays / 7);
    const days = remDays % 7;
    let rel = `il y a ${fullMonths} mois`;
    if (weeks > 0) {
      rel += ` et ${weeks} semaine${weeks > 1 ? 's' : ''}`;
    } else if (days > 0) {
      rel += ` et ${days} jour${days > 1 ? 's' : ''}`;
    }
    return `${dayLabel}${rel}`;
  }
  const w = Math.floor(diffDays / 7);
  const d = diffDays % 7;
  let rel = `il y a ${w} semaine${w > 1 ? 's' : ''}`;
  if (d > 0) rel += `, ${d} jour${d > 1 ? 's' : ''}`;
  return `${dayLabel}${rel}`;
}

// Résout l'id d'une profession : si le libellé existe en base on le renvoie, sinon on crée la profession et on renvoie le nouvel id
async function resolveProfessionId(apiClient, displayName, currentId, professionsList) {
  const trimmed = displayName != null ? String(displayName).trim() : '';
  if (!trimmed) return currentId || '';
  const found = (professionsList || []).find(p => (p.nom || '').trim() === trimmed);
  if (found) return String(found.id);
  try {
    const res = await apiClient.post('/management/professions/find-or-create', { nom: trimmed });
    if (res.data?.success && res.data?.data?.id) return String(res.data.data.id);
  } catch (err) {
    console.error('Erreur find-or-create profession:', err);
  }
  return currentId || '';
}

// Créneaux horaires
const TIME_SLOTS = [
  { hour: '09:00:00', name: '9H ( 9h uniquement )' },
  { hour: '11:00:00', name: '11H ( 11h à 12h )' },
  { hour: '13:00:00', name: '13H ( 13h à 14h30 )' },
  { hour: '16:00:00', name: '16H ( 16h à 17h )' },
  { hour: '18:00:00', name: '18H ( 18h à 19h )' },
  { hour: '19:30:00', name: '20H ( 19h30 à 20h )' }
];

// États sans transition possible (aligné sur backend management.routes.js) : pas de « nouvel état »
const ETATS_SANS_NOUVEL_ETAT = [22, 25, 26, 34, 35]; // ANNULER 2 FOIS, REFUSER 2 FOIS, RDV ANNULER 2 FOIS, HHC FINANCEMENT, HHC TECHNIQUE

/** Commentaire (motif_qualif) en détails fiche : annuler, annuler 2×, RDV annuler, RDV annuler 2×, refuser, refuser 2×, hors cible air air, âge/doublon/locataire, financement, HC confirmateur, HHC financement à vérifier. */
const ETATS_AVEC_COMMENTAIRE_MOTIF = [5, 6, 11, 12, 22, 23, 24, 25, 26, 29, 34];
/** À la validation du passage d'état : commentaire obligatoire (motif_qualif). */
const ETATS_MOTIF_QUALIF_REQUIS = [5, 6, 11, 12, 22, 24, 25, 26, 29];

// Helper pour calculer le timeKey à partir d'une heure (HH:MM:SS)
// Évite les problèmes de fuseau horaire en calculant directement les secondes depuis minuit UTC
function hourToTimeKey(hour) {
  const [hours, minutes, seconds] = hour.split(':').map(Number);
  return hours * 3600 + minutes * 60 + (seconds || 0);
}

// Helper pour formater une date en YYYY-MM-DD en heure locale (évite le décalage UTC)
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Numéro de semaine ISO (lundi = début de semaine)
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Associe une heure "HH:MM" ou "HH:MM:SS" au créneau planning (hour key backend)
function timeToSlotHour(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  if (isNaN(h)) return null;
  const minutes = h * 60 + m;
  if (minutes >= 540 && minutes <= 659) return '09:00:00';
  if (minutes >= 660 && minutes <= 779) return '11:00:00';
  if (minutes >= 780 && minutes <= 959) return '13:00:00';
  if (minutes >= 960 && minutes <= 1079) return '16:00:00';
  if (minutes >= 1080 && minutes <= 1169) return '18:00:00';
  if (minutes >= 1170 && minutes <= 1200) return '19:30:00';
  return null;
}

/** Plage horaire alignée sur les buckets planning (voir timeToSlotMinuteRanges) pour filtrer date_rdv_time sur le dashboard. */
function getDashboardTimeRangeForPlanningSlot(slotHour) {
  const map = {
    '09:00:00': { time_debut: '09:00:00', time_fin: '10:59:59' },
    '11:00:00': { time_debut: '11:00:00', time_fin: '12:59:59' },
    '13:00:00': { time_debut: '13:00:00', time_fin: '15:59:59' },
    '16:00:00': { time_debut: '16:00:00', time_fin: '17:59:59' },
    '18:00:00': { time_debut: '18:00:00', time_fin: '19:29:59' },
    '19:30:00': { time_debut: '19:30:00', time_fin: '20:00:00' }
  };
  return map[slotHour] || { time_debut: '00:00:00', time_fin: '23:59:59' };
}

/** Ouvre le dashboard avec filtres : RDV confirmés (état 7), jour + créneau + département (CP). */
function buildDashboardUrlForPlanningSlot({ dep, date, slotHour }) {
  const range = getDashboardTimeRangeForPlanningSlot(slotHour);
  const params = new URLSearchParams({
    fiche_search: '1',
    page: '1',
    limit: '999999',
    date_champ: 'date_rdv_time',
    date_debut: date,
    date_fin: date,
    time_debut: range.time_debut,
    time_fin: range.time_fin,
    id_etat_final: '7'
  });
  if (dep != null && String(dep).trim() !== '') {
    params.set('cp', String(dep).trim());
  }
  return `/dashboard?${params.toString()}`;
}

const FicheDetail = ({ ficheHash, onClose, isModal = false }) => {
  // En mode modal, utiliser le contexte personnalisé, sinon utiliser useParams
  const routeParams = useRouteParams();
  const routerParams = useParams();
  const routerNavigate = useNavigate();
  
  const params = isModal && routeParams.params ? routeParams.params : routerParams;
  const navigate = isModal && routeParams.navigate ? routeParams.navigate : routerNavigate;
  
  const hashFromParams = params?.id;
  const hash = ficheHash || hashFromParams; // Utiliser le prop si fourni, sinon utiliser les params
  const { user, hasPermission, permissions } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('fiches'); // 'fiches', 'modifica', 'planning', 'sms', 'pdf'
  
  // Vérifier si l'utilisateur est qualité qualification (fonction 2, 8, 12)
  const userFonction = user?.fonction != null ? Number(user.fonction) : null;
  const isQualiteQualif = userFonction === 2 || userFonction === 8 || userFonction === 12;
  const isConfirmateurSession = userFonction === 6;
  const getConfirmateurLabel = (id) => {
    if (!id) return '';
    const found = confirmateurs?.find(c => String(c.id) === String(id));
    return found?.pseudo || `ID: ${id}`;
  };
  
  // Rediriger vers l'onglet fiches si l'utilisateur qualité qualification est sur un onglet masqué
  useEffect(() => {
    if (isQualiteQualif && (activeTab === 'planning' || activeTab === 'sms')) {
      setActiveTab('fiches');
    }
  }, [isQualiteQualif, activeTab]);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [planningWeek, setPlanningWeek] = useState(null);
  const [planningYear, setPlanningYear] = useState(null);
  const [planningDep, setPlanningDep] = useState(null);
  
  // État pour le modal de création de RDV
  const [showRdvModal, setShowRdvModal] = useState(false);
  const [rdvSubmitting, setRdvSubmitting] = useState(false);
  const [etatSubmitting, setEtatSubmitting] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); // { date, hour }
  const [showConfirmConfFields, setShowConfirmConfFields] = useState(false);
  const [rdvFormData, setRdvFormData] = useState({
    date_rdv_time: '',
    id_etat_final: 7, // CONFIRMER par défaut
    is_urgent: false, // RDV_URGENT
    id_confirmateur: '',
    id_confirmateur_2: '',
    id_confirmateur_3: '',
    produit: '',
    conf_rdv_avec: '',
    conf_appel_tunisie_avec: '',
    conf_deja_etude: '',
    conf_profession_monsieur: '',
    conf_type_contrat_mr: '',
    conf_profession_madame: '',
    conf_type_contrat_madame: '',
    conf_revenu: '',
    conf_credit: '',
    conf_mode_chauffage: '',
    conf_complement_chauffage: '',
    conf_consommation_electricite: '',
    conf_consommation_chauffage: '',
    conf_rdv_annule_precedent: '',
    conf_presence_couple: '',
    // Champs spécifiques PV
    surface_habitable: '',
    conf_orientation_toiture: '',
    conf_zones_ombres: '',
    conf_site_classe: '',
    nb_pans: '',
    // Champs spécifiques PAC
    surface_chauffee: '',
    consommation_chauffage: '',
    annee_systeme_chauffage: '',
    conf_commentaire_produit: ''
  });

  // État pour le formulaire de confirmation
  const [selectedEtat, setSelectedEtat] = useState(null);
  const [histoConfirmateurId, setHistoConfirmateurId] = useState('');
  const [confFormData, setConfFormData] = useState({
    produit: '',
    id_confirmateur: '',
    id_confirmateur_2: '',
    id_confirmateur_3: '',
    conf_rdv_date: '',
    conf_rdv_time: '',
    conf_rdv_avec: '',
    conf_appel_tunisie_avec: '',
    conf_deja_etude: '',
    conf_profession_monsieur: '',
    conf_type_contrat_mr: '',
    conf_profession_madame: '',
    conf_type_contrat_madame: '',
    conf_revenu: '',
    conf_credit: '',
    conf_mode_chauffage: '',
    conf_complement_chauffage: '',
    conf_consommation_electricite: '',
    conf_consommation_chauffage: '',
    conf_rdv_annule_precedent: '',
    conf_presence_couple: '',
    conf_orientation_toiture: '',
    conf_zones_ombres: '',
    conf_site_classe: '',
    nb_pans: '',
    // Champs techniques PAC
    annee_systeme_chauffage: '',
    surface_chauffee: '',
    consommation_chauffage: '',
    conf_commentaire_produit: ''
  });
  const [confProfMrDisplay, setConfProfMrDisplay] = useState('');
  const [confProfMmeDisplay, setConfProfMmeDisplay] = useState('');
  const [showSuggestionsMr, setShowSuggestionsMr] = useState(false);
  const [showSuggestionsMme, setShowSuggestionsMme] = useState(false);

  useEffect(() => {
    if (selectedEtat === 7) {
      setShowConfirmConfFields(false);
    }
  }, [selectedEtat]);

  // État pour le formulaire NRP
  const [nrpFormData, setNrpFormData] = useState({
    date_appel_date: '',
    date_appel_time: '',
    id_sous_etat: '',
    conf_commentaire_produit: ''
  });

  // État pour les formulaires d'autres états (8, 13, 16, 19, 44, 45)
  const [etatFormData, setEtatFormData] = useState({
    // Pour état 8 (ANNULER À REPROGRAMMER)
    conf_rdv_date: '',
    conf_rdv_time: '',
    id_sous_etat: '',
    conf_rdv_avec: '',
    conf_commentaire_produit: '',
    motif_qualif: '',
    // Pour état 19 (RAPPEL POUR BUREAU)
    date_rappel_date: '',
    date_rappel_time: '',
    auto_saisie: '',
    // Pour états 13, 44, 45 (SIGNER)
    date_sign_date: '',
    date_sign_time: '',
    produit: '',
    id_commercial: '',
    id_commercial_2: '',
    pseudo: '',
    ph3_pac: 'reau',
    ph3_rr_model: '',
    ph3_puissance: '',
    ph3_puissance_pv: '',
    ph3_ballon: '',
    ph3_marque_ballon: '',
    ph3_alimentation: '',
    ph3_type: '',
    ph3_prix: '',
    ph3_installateur: '',
    conf_consommations: '',
    ph3_bonus_30: '',
    valeur_mensualite: '',
    ph3_mensualite: '',
    ph3_attente: '',
    nbr_annee_finance: '',
    credit_immobilier: '',
    credit_autre: ''
  });

  // État pour le formulaire de décalage
  const [decalageFormData, setDecalageFormData] = useState({
    select_minutes: '0',
    id_confirmateur: '',
    message: '',
    date_prevu: '',
    nouvelle_date: ''
  });

  // État pour le compte rendu commercial
  const [compteRenduOption, setCompteRenduOption] = useState('');
  const [editingCompteRendu, setEditingCompteRendu] = useState(null);

  // État pour l'onglet Affectation (un seul commercial)
  const [affectationCommercial, setAffectationCommercial] = useState('');
  const [affectationSaving, setAffectationSaving] = useState(false);
  
  // États pour le formulaire de validation
  const [confRdvAvecValue, setConfRdvAvecValue] = useState('');
  const [confPresenceCoupleValue, setConfPresenceCoupleValue] = useState('');
  const [showValidationCardForm, setShowValidationCardForm] = useState(false);
  const [validationRdvDate, setValidationRdvDate] = useState('');
  const [validationRdvTime, setValidationRdvTime] = useState('');
  const [showHistorique, setShowHistorique] = useState(false); // État pour contrôler l'affichage de l'historique

  // Contrôle Qualité (états signer) : formulaire par fiche (clé = hash)
  const [cqFormByHash, setCqFormByHash] = useState({});

  // Récupérer les données de référence
  const { data: centres } = useQuery('centres', async () => {
    const res = await api.get('/management/centres');
    return res.data.data || [];
  });

  const { data: agents } = useQuery('agents', async () => {
    const res = await api.get('/management/utilisateurs');
    return (res.data.data || []).filter(u => u.fonction === 3);
  });

  const { data: commerciaux } = useQuery('commerciaux', async () => {
    const res = await api.get('/management/utilisateurs');
    return (res.data.data || []).filter(u => u.fonction === 5);
  });

  const { data: confirmateurs } = useQuery('confirmateurs', async () => {
    const res = await api.get('/management/utilisateurs');
    return (res.data.data || []).filter(u => u.fonction === 6 && (u.etat > 0 || u.etat == null));
  });

  const showHistoConfirmateurDropdown = [1, 7, 13, 14].includes(Number(user?.fonction));

  const { data: professions } = useQuery('professions', async () => {
    const res = await api.get('/management/professions');
    return res.data.data || [];
  });

  const { data: modeChauffage } = useQuery('mode-chauffage', async () => {
    const res = await api.get('/management/mode-chauffage');
    return res.data.data || [];
  });

  const { data: typeContrat } = useQuery('type-contrat', async () => {
    const res = await api.get('/management/type-contrat');
    return res.data.data || [];
  });

  // Synchroniser l'affichage autocomplete profession avec l'id sélectionné (préremplissage, sans écraser la saisie)
  useEffect(() => {
    if (!professions || selectedEtat !== 7) return;
    if (confFormData.conf_profession_monsieur) {
      const p = professions.find(pr => String(pr.id) === String(confFormData.conf_profession_monsieur));
      if (p?.nom && (confProfMrDisplay === '' || confProfMrDisplay === p.nom)) setConfProfMrDisplay(p.nom);
    }
    if (confFormData.conf_profession_madame) {
      const p = professions.find(pr => String(pr.id) === String(confFormData.conf_profession_madame));
      if (p?.nom && (confProfMmeDisplay === '' || confProfMmeDisplay === p.nom)) setConfProfMmeDisplay(p.nom);
    }
  }, [selectedEtat, confFormData.conf_profession_monsieur, confFormData.conf_profession_madame, professions]);

  const { data: produits } = useQuery('produits', async () => {
    try {
      const res = await api.get('/management/produits');
      return res.data.data || [];
    } catch (error) {
      console.warn('Impossible de charger les produits:', error);
      return [];
    }
  });

  const { data: installateurs } = useQuery('installateurs', async () => {
    try {
      const res = await api.get('/management/installateurs');
      return res.data.data || [];
    } catch (error) {
      console.warn('Impossible de charger les installateurs:', error);
      return [];
    }
  });

  const { data: typesFinancement = [] } = useQuery('financement', async () => {
    try {
      const res = await api.get('/management/financement');
      return res.data?.data ?? [];
    } catch (error) {
      console.warn('Impossible de charger les types de financement:', error);
      return [];
    }
  });

  // Récupérer les qualifications (peut être vide si la table n'existe pas)
  const { data: qualifications = [] } = useQuery('qualifications', async () => {
    try {
      const res = await api.get('/management/qualifications');
      return res.data.data || [];
    } catch (error) {
      console.warn('Impossible de charger les qualifications:', error);
      return [];
    }
  });

  // Sous-états chargés depuis l'API pour ces états (11 RDV ANNULER, 12 REFUSER : liste affichée, sélection facultative)
  const etatsAvecListeSousEtats = [2, 8, 11, 12, 13, 16, 19, 44, 45];
  // Sous-état obligatoire seulement pour ces états lorsque la liste existe (pas 11 ni 12)
  const etatsSousEtatObligatoire = [2, 8, 13, 16, 19, 44, 45];
  const { data: sousEtats = [] } = useQuery(
    ['sous-etat', selectedEtat],
    async () => {
      try {
        const res = await api.get(`/management/sous-etat/${selectedEtat}`);
        return res.data.data || [];
      } catch (error) {
        console.warn('Impossible de charger les sous-états:', error);
        return [];
      }
    },
    { enabled: selectedEtat !== null && etatsAvecListeSousEtats.includes(selectedEtat) }
  );

  // Admin session (1 admin, 11 backoffice, 13 RP confirmation, 14 RE confirmation) : formulaire honoré à suivre étendu
  const isAdminSessionHonoreSuivre = [1, 11, 13, 14].includes(Number(user?.fonction));

  // Pré-remplir A Rappeler le (J+2 jours ouvrés) quand l'état 9 (Honoré à suivre) est sélectionné
  useEffect(() => {
    const addWorkingDays = (date, days) => {
      const result = new Date(date);
      let added = 0;
      while (added < days) {
        result.setDate(result.getDate() + 1);
        const dow = result.getDay();
        if (dow !== 0 && dow !== 6) added++;
      }
      return result;
    };
    if (selectedEtat === 9) {
      const dateRappel = addWorkingDays(new Date(), 2);
      const dateRappelStr = dateRappel.toISOString().split('T')[0];
      setEtatFormData(prev => ({
        ...prev,
        date_rappel_date: prev.date_rappel_date || dateRappelStr,
        date_rappel_time: prev.date_rappel_time || '09:00'
      }));
    }
  }, [selectedEtat]);

  // Pré-remplir les sous-états selon l'option de compte rendu sélectionnée
  useEffect(() => {
    if (compteRenduOption && sousEtats.length > 0 && selectedEtat) {
      let sousEtatToSelect = null;
      
      if (compteRenduOption === 'deballé_réfléchir' && selectedEtat === 19) {
        // Trouver le sous-état "DÉBALLÉ DOIT RÉFLÉCHIR"
        sousEtatToSelect = sousEtats.find(se => se.titre === 'DÉBALLÉ DOIT RÉFLÉCHIR');
      } else if (compteRenduOption === 'porte_imprevu_nrp' && selectedEtat === 8) {
        // Pour "Porte / Imprévu / NRP", on laisse l'utilisateur choisir entre PORTE ou IMPRÉVU CLIENT
        // On ne pré-sélectionne pas automatiquement
      }
      
      // Ne pas présélectionner automatiquement le sous-état pour garder "Sélectionner" par défaut.
      if (sousEtatToSelect && !etatFormData.id_sous_etat && selectedEtat !== 19 && selectedEtat !== 2) {
        setEtatFormData({ ...etatFormData, id_sous_etat: String(sousEtatToSelect.id) });
      }
    }
  }, [sousEtats, compteRenduOption, selectedEtat]);

  // NRP (2) : sous-état et commentaire par défaut = "Appel raccroché"
  useEffect(() => {
    if (selectedEtat !== 2 || !Array.isArray(sousEtats) || sousEtats.length === 0) return;

    const defaultSousEtat = sousEtats.find((se) =>
      (se?.titre || '').toLowerCase().includes('raccroch')
    );

    if (!defaultSousEtat) return;

    setNrpFormData((prev) => {
      // Ne pas écraser un choix/saisie déjà fait
      if ((prev.id_sous_etat || '').toString().trim()) return prev;

      return {
        ...prev,
        id_sous_etat: String(defaultSousEtat.id),
        conf_commentaire_produit: (prev.conf_commentaire_produit || '').trim()
          ? prev.conf_commentaire_produit
          : (defaultSousEtat.titre || 'Appel raccroché')
      };
    });
  }, [selectedEtat, sousEtats]);

  // Récupérer la fiche (utiliser le hash au lieu de l'ID) avec rafraîchissement automatique toutes les 5 secondes
  const { data: ficheData, isLoading } = useQuery(
    ['fiche', hash],
    async () => {
      const res = await api.get(`/fiches/${hash}`);
      return res.data.data;
    },
    { 
      enabled: !!hash,
      // Rafraîchissement automatique toutes les 5 secondes dans le modal
      refetchInterval: isModal ? 5000 : false, // Uniquement si c'est un modal
      refetchOnWindowFocus: isModal, // Rafraîchir quand la fenêtre redevient active (modal uniquement)
      refetchOnReconnect: isModal // Rafraîchir quand la connexion est rétablie (modal uniquement)
    }
  );

  useEffect(() => {
    if (!ficheData?.date_rdv_time) return;
    const raw = String(ficheData.date_rdv_time);
    const normalized = raw.includes('T') ? raw.replace('T', ' ') : raw;
    const [datePart, timePart] = normalized.split(' ');
    const hhmm = (timePart || '').slice(0, 5);
    if (datePart) setValidationRdvDate(datePart);
    if (hhmm) setValidationRdvTime(hhmm);
  }, [ficheData?.date_rdv_time]);

  // États : pour confirmateur (6), matrice de transitions selon l'état actuel de la fiche
  const { data: etats } = useQuery(
    Number(user?.fonction) === 6 && ficheData?.id_etat_final ? ['etats', 'confirmateur', ficheData.id_etat_final] : ['etats'],
    async () => {
      const params = Number(user?.fonction) === 6 && ficheData?.id_etat_final ? { id_etat_fiche: ficheData.id_etat_final } : {};
      const res = await api.get('/management/etats', { params });
      return res.data.data || [];
    }
  );

  // États regroupés par phase (0,1,2,3), ordre BDD, pour les selects
  const etatsList = etats || [];
  const { phase0: etatsPhase0, phase1: etatsPhase1, phase2: etatsPhase2, phase3: etatsPhase3 } = getEtatsGroupedByPhase(etatsList);
  
  // Vérifier si c'est un commercial (fonction 5)
  const isCommercial = userFonction === 5;

  // Onglet Affectation : visible par administrateur (1), backoffice (11), RE confirmation (14), RP confirmation (13)
  const showAffectationTab = [1, 11, 13, 14].includes(Number(user?.fonction));
  const isAdminSession = [1, 2, 7].includes(Number(user?.fonction));
  
  // Vérifier si c'est un R2 (deuxième commercial assigné)
  const isR2 = isCommercial && ficheData && Number(ficheData.id_commercial_2) === Number(user?.id);

  const getCommercialDisplayName = (id) => {
    if (!id) return '';
    const found = (commerciaux || []).find((c) => String(c.id) === String(id));
    return found?.pseudo || `${found?.prenom || ''} ${found?.nom || ''}`.trim() || '';
  };
  const commercialAffecteNom = getCommercialDisplayName(ficheData?.id_commercial || affectationCommercial);
  
  // Rediriger vers l'onglet fiches si un commercial est sur un onglet désactivé
  useEffect(() => {
    if (isCommercial && (activeTab === 'modifica' || activeTab === 'planning' || activeTab === 'sms')) {
      setActiveTab('fiches');
    }
  }, [isCommercial, activeTab, ficheData]);

  // Synchroniser l'état d'affectation avec la fiche (pour l'onglet Affectation)
  useEffect(() => {
    if (ficheData) {
      setAffectationCommercial(ficheData.id_commercial != null ? String(ficheData.id_commercial) : '');
    }
  }, [ficheData?.id, ficheData?.id_commercial]);

  // Récupérer les décalages existants pour cette fiche
  const { data: decalagesData } = useQuery(
    ['decalages', ficheData?.id],
    async () => {
      if (!ficheData?.id) return null;
      const res = await api.get('/decalages');
      return (res.data.data || []).filter(d => d.id_fiche === ficheData.id);
    },
    { enabled: !!ficheData?.id }
  );

  // Initialiser le formulaire de décalage avec la date du RDV de la fiche
  useEffect(() => {
    if (ficheData && ficheData.date_rdv_time) {
      setDecalageFormData(prev => ({
        ...prev,
        date_prevu: ficheData.date_rdv_time,
        id_confirmateur: ficheData.id_confirmateur ? String(ficheData.id_confirmateur) : ''
      }));
    }
  }, [ficheData]);

  // Calculer la nouvelle date/heure en fonction du décalage sélectionné
  const calculateNouvelleDate = (datePrevu, minutes) => {
    if (!datePrevu || !minutes || minutes === '0') return '';
    
    try {
      const date = new Date(datePrevu);
      date.setMinutes(date.getMinutes() + parseInt(minutes));
      
      // Formater au format YYYY-MM-DD HH:MM:SS
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${mins}:00`;
    } catch (error) {
      console.error('Erreur lors du calcul de la nouvelle date:', error);
      return '';
    }
  };

  // Réinitialiser seulement date_prevu quand la date RDV de la fiche change
  // Le calcul de nouvelle_date est géré directement dans le onChange du select
  useEffect(() => {
    if (ficheData?.date_rdv_time && ficheData.date_rdv_time !== decalageFormData.date_prevu) {
      setDecalageFormData(prev => ({
        ...prev,
        date_prevu: ficheData.date_rdv_time
      }));
    }
  }, [ficheData?.date_rdv_time]);

  // Mutation pour créer/mettre à jour un décalage
  const decalageMutation = useMutation(
    async (data) => {
      console.log('Envoi de la requête de création de décalage:', data);
      const res = await api.post('/decalages', data);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['decalages', ficheData?.id]);
        queryClient.invalidateQueries(['fiche', hash]);
        alert('Décalage créé avec succès');
        setDecalageFormData({
          select_minutes: '0',
          id_confirmateur: ficheData?.id_confirmateur ? String(ficheData.id_confirmateur) : '',
          message: '',
          date_prevu: ficheData?.date_rdv_time || '',
          nouvelle_date: ''
        });
      },
      onError: (error) => {
        console.error('Erreur lors de la création du décalage:', error);
        console.error('Détails de l\'erreur:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          data: error.response?.data
        });
        const errorMessage = error.response?.data?.message || error.message || 'Erreur inconnue';
        alert('Erreur lors de la création du décalage: ' + errorMessage);
      }
    }
  );

  // Soumettre le formulaire de décalage
  const handleDecalageSubmit = async () => {
    // Utiliser ficheData au lieu de fiche car fiche est défini plus bas dans le render
    if (!ficheData) {
      console.error('Erreur : ficheData est null ou undefined');
      alert('Erreur : fiche non trouvée. Veuillez recharger la page.');
      return;
    }

    // Vérifier que l'ID de la fiche est bien défini et valide
    const ficheId = ficheData.id;
    if (!ficheId || ficheId === null || ficheId === undefined) {
      console.error('Erreur : ficheData.id est null ou undefined', ficheData);
      alert('Erreur : ID de fiche non trouvé. Veuillez recharger la page.');
      return;
    }

    // S'assurer que l'ID est un nombre
    const idFicheNum = parseInt(ficheId, 10);
    if (isNaN(idFicheNum) || idFicheNum <= 0) {
      console.error('Erreur : ficheData.id n\'est pas un nombre valide', ficheId);
      alert('Erreur : ID de fiche invalide. Veuillez recharger la page.');
      return;
    }

    if (!ficheData.date_rdv_time) {
      alert('Aucune date de RDV disponible pour créer un décalage');
      return;
    }

    if (!decalageFormData.select_minutes || decalageFormData.select_minutes === '0') {
      alert('Veuillez sélectionner une durée de décalage');
      return;
    }

    if (!decalageFormData.message.trim()) {
      alert('Veuillez saisir un message pour le décalage');
      return;
    }

    // Déterminer le destinataire selon la fonction
    let destination = null;
    
    if (user.fonction === 5) {
      // Commerciaux : utiliser le confirmateur de la fiche (obligatoire)
      destination = ficheData?.id_confirmateur;
      if (!destination) {
        alert('Cette fiche n\'a pas de confirmateur assigné. Veuillez assigner un confirmateur avant de créer un décalage.');
        return;
      }
    } else if (user.fonction === 6) {
      // Confirmateurs : utiliser leur propre ID
      destination = user.id;
    } else if ([1, 2, 7].includes(user.fonction)) {
      // Admins : utiliser le confirmateur sélectionné dans la liste déroulante
      destination = decalageFormData.id_confirmateur || ficheData?.id_confirmateur;
      if (!destination) {
        alert('Veuillez sélectionner un confirmateur depuis la liste déroulante');
        return;
      }
    } else {
      alert('Vous n\'avez pas la permission de créer un décalage');
      return;
    }

    // Vérifier que la nouvelle date a été calculée
    if (!decalageFormData.nouvelle_date || decalageFormData.select_minutes === '0') {
      alert('Veuillez sélectionner une durée de décalage (10 minutes, 1 heure, etc.)');
      return;
    }
    
    // Récupérer la date RDV originale de la fiche
    const dateRdvOriginale = ficheData?.date_rdv_time || decalageFormData.date_prevu || '';
    if (!dateRdvOriginale) {
      alert('Erreur : la date de rendez-vous originale n\'a pas été trouvée.');
      return;
    }
    
    // La nouvelle date calculée après ajout du décalage
    let dateNouvelle = decalageFormData.nouvelle_date;
    
    // S'assurer que date_nouvelle est au bon format (YYYY-MM-DD HH:MM:SS)
    if (dateNouvelle.includes('T')) {
      // Si c'est au format ISO, convertir en format MySQL
      const date = new Date(dateNouvelle);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      const secs = String(date.getSeconds()).padStart(2, '0');
      dateNouvelle = `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
    }

    // Log pour diagnostic
    console.log('Création de décalage avec les données:', {
      id_fiche: idFicheNum,
      destination: parseInt(destination, 10),
      message: decalageFormData.message.trim(),
      date_prevu: dateRdvOriginale,
      date_nouvelle: dateNouvelle,
      decalage_minutes: decalageFormData.select_minutes
    });

    decalageMutation.mutate({
      id_fiche: idFicheNum,
      destination: parseInt(destination, 10),
      message: decalageFormData.message.trim(),
      date_prevu: dateRdvOriginale, // Date RDV originale
      date_nouvelle: dateNouvelle    // Nouvelle date après décalage
    });
  };

  // Initialiser les données NRP si la fiche est déjà en état NRP (y compris après re-sélection du même état dans la liste)
  useEffect(() => {
    if (ficheData && ficheData.id_etat_final === 2 && (selectedEtat === null || selectedEtat === 2)) {
      // Si la fiche est en état NRP, initialiser les données du formulaire
      if (ficheData.date_appel_time) {
        const dateAppel = new Date(ficheData.date_appel_time);
        setNrpFormData({
          date_appel_date: dateAppel.toISOString().split('T')[0],
          date_appel_time: dateAppel.toTimeString().slice(0, 5),
          id_sous_etat: '',
          conf_commentaire_produit: ficheData.conf_commentaire_produit || ''
        });
      } else {
        // Initialiser avec des valeurs vides si pas de date_appel_time
        setNrpFormData({
          date_appel_date: '',
          date_appel_time: '',
          id_sous_etat: '',
          conf_commentaire_produit: ficheData.conf_commentaire_produit || ''
        });
      }
    }
  }, [ficheData, selectedEtat]);

  // Mutation pour valider une fiche
  const validateMutation = useMutation(
    async ({ type_valid, conf_rdv_avec, conf_presence_couple }) => {
      const res = await api.post(`/fiches/${hash}/valider`, {
        type_valid,
        conf_rdv_avec,
        conf_presence_couple
      });
      return res.data;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['fiche', hash]);
        queryClient.invalidateQueries(['modifica', hash]);
        queryClient.invalidateQueries(['planning-commercial']); // Mettre à jour le planning commercial
        alert(data.message || 'Fiche validée avec succès');
      },
      onError: (error) => {
        alert('Erreur lors de la validation: ' + (error.response?.data?.message || error.message));
      }
    }
  );

  // Mutation pour mettre à jour un champ
  const updateFieldMutation = useMutation(
    async ({ field, value }) => {
      const res = await api.patch(`/fiches/${hash}/field`, { field, value });
      return res.data;
    },
    {
      onSuccess: (data, variables) => {
        // Vérifier si un compte rendu a été créé (pour les commerciaux)
        if (data.data?.id_compte_rendu) {
          queryClient.invalidateQueries(['planning-commercial']); // Mettre à jour le planning commercial
          alert('Compte rendu créé avec succès. Les modifications sont en attente d\'approbation de l\'administrateur.');
        } else {
          queryClient.invalidateQueries(['fiche', hash]);
          queryClient.invalidateQueries(['planning-commercial']); // Mettre à jour le planning commercial
          queryClient.invalidateQueries(['fiches']); // Invalider la liste des fiches aussi
          queryClient.invalidateQueries(['modifica', hash]); // Invalider les modifications
          
          // Si la date du RDV a été modifiée, invalider et recharger toutes les queries de planning
          if (variables.field === 'date_rdv_time') {
            queryClient.invalidateQueries(['planning-week']);
            queryClient.invalidateQueries(['planning-availability']);
            queryClient.invalidateQueries(['planning-modal']);
            queryClient.invalidateQueries(['availability-modal']);
            // Forcer le refetch immédiat de toutes les queries de planning actives
            queryClient.refetchQueries(['planning-modal'], { active: true });
            queryClient.refetchQueries(['availability-modal'], { active: true });
          }
        }
        
        setEditingField(null);
        setEditValue('');
        // Si l'état final a été modifié, réinitialiser selectedEtat
        if (editingField === 'id_etat_final') {
          setSelectedEtat(null);
        }
      },
      onError: (error) => {
        console.error('Erreur lors de la mise à jour du champ:', error);
        console.error('Détails de l\'erreur:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.response?.data?.message,
          url: error.config?.url,
          method: error.config?.method,
          hash: hash,
          field: error.config?.data ? JSON.parse(error.config.data)?.field : 'unknown'
        });
        
        let errorMessage = 'Erreur lors de la mise à jour du champ';
        if (error.response?.status === 404) {
          errorMessage = 'Route non trouvée. Vérifiez que le hash de la fiche est valide.';
        } else if (error.response?.status === 400) {
          errorMessage = error.response?.data?.message || 'Données invalides';
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        alert(errorMessage);
      }
    }
  );

  // Mutation Contrôle Qualité (CQ ETAT, CQ DOSSIER, OBSERVATIONS) pour états signer — champ dédié observations_cq
  const controleQualiteMutation = useMutation(
    async ({ cq_etat, cq_dossier, observations_cq }) => {
      const res = await api.put(`/fiches/${hash}/controle-qualite`, {
        cq_etat: cq_etat || null,
        cq_dossier: cq_dossier || null,
        observations_cq: observations_cq || null
      });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['fiche', hash]);
        queryClient.invalidateQueries(['fiches']);
        setCqFormByHash(prev => {
          const next = { ...prev };
          delete next[hash];
          return next;
        });
        alert('Contrôle qualité enregistré avec succès.');
      },
      onError: (error) => {
        const msg = error.response?.data?.message || error.message || 'Erreur lors de l\'enregistrement du contrôle qualité';
        alert(msg);
      }
    }
  );

  // Récupérer les utilisateurs pour les couleurs
  const { data: usersData } = useQuery('users', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data || [];
  });

  // Récupérer le planning si nécessaire (même format que la page Planning)
  const { data: planningResponse, isLoading: isLoadingPlanning } = useQuery(
    ['planning-week', planningWeek, planningYear, planningDep],
    async () => {
      const res = await api.get('/planning/week', {
        params: { w: planningWeek, y: planningYear, dp: planningDep }
      });
      return res.data;
    },
    { enabled: false } // Les requêtes de planning sont gérées dans PlanningTab
  );

  const { data: availabilityResponse } = useQuery(
    ['planning-availability', planningWeek, planningYear, planningDep],
    async () => {
      const res = await api.get('/planning/availability', {
        params: { w: planningWeek, y: planningYear, dp: planningDep }
      });
      return res.data;
    },
    { enabled: false } // Les requêtes de planning sont gérées dans PlanningTab
  );

  // Extraire les données du planning et de la disponibilité
  const planningData = planningResponse?.data || {};
  const availabilityData = availabilityResponse?.data || {};

  // Calculer le département à partir du code postal (2 premiers chiffres)
  useEffect(() => {
    if (ficheData?.cp) {
      // Extraire les 2 premiers chiffres du code postal
      const cpStr = String(ficheData.cp).trim();
      let dep = '';
      
      // Si le code postal commence par des chiffres, prendre les 2 premiers
      if (/^\d/.test(cpStr)) {
        dep = cpStr.substring(0, 2);
      } else {
        // Sinon, essayer de trouver les 2 premiers chiffres dans la chaîne
        const match = cpStr.match(/\d{2}/);
        if (match) {
          dep = match[0];
        }
      }
      
      // S'assurer que le département est valide (2 chiffres)
      if (dep && dep.length === 2 && /^\d{2}$/.test(dep)) {
        setPlanningDep(dep);
        
        // Calculer la semaine actuelle si pas déjà définie
        if (!planningWeek || !planningYear) {
          const now = new Date();
          const getWeekNumber = (date) => {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
          };
          setPlanningWeek(getWeekNumber(now));
          setPlanningYear(now.getFullYear());
        }
      }
    }
  }, [ficheData?.cp]);

  // Prefetch du planning dès que dep/semaine/année sont connus (affichage instantané au clic onglet Planning)
  useEffect(() => {
    if (!planningDep || !planningWeek || !planningYear) return;
    queryClient.prefetchQuery(
      ['planning-modal', planningWeek, planningYear, planningDep],
      async () => {
        const res = await api.get('/planning/week', { params: { w: planningWeek, y: planningYear, dp: planningDep } });
        return res.data;
      },
      { staleTime: 60000 }
    );
    queryClient.prefetchQuery(
      ['availability-modal', planningWeek, planningYear, planningDep],
      async () => {
        const res = await api.get('/planning/availability', { params: { w: planningWeek, y: planningYear, dp: planningDep } });
        return res.data;
      },
      { staleTime: 60000 }
    );
  }, [planningDep, planningWeek, planningYear, queryClient]);

  // Mettre à jour automatiquement is_urgent si la date du RDV est aujourd'hui ou demain
  useEffect(() => {
    if (rdvFormData.date_rdv_time && showRdvModal) {
      const rdvDateStr = rdvFormData.date_rdv_time.split(' ')[0];
      if (rdvDateStr) {
        try {
          const rdvDate = new Date(rdvDateStr + 'T00:00:00');
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const rdvDateOnly = new Date(rdvDate);
          rdvDateOnly.setHours(0, 0, 0, 0);
          const isTodayOrTomorrow = rdvDateOnly.getTime() === today.getTime() || rdvDateOnly.getTime() === tomorrow.getTime();
          
          // Mettre à jour is_urgent si la date est aujourd'hui ou demain
          if (isTodayOrTomorrow) {
            setRdvFormData(prev => ({ ...prev, is_urgent: true }));
          }
        } catch (e) {
          console.error('Erreur lors de la vérification de la date:', e);
        }
      }
    }
  }, [rdvFormData.date_rdv_time, showRdvModal]);

  const handleEditField = (field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const handleSaveField = async (field) => {
    await updateFieldMutation.mutateAsync({ field, value: editValue });
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleSelectPlanningSlot = async (date, hour, rdvId = null, availabilityData = null) => {
    // Ouvrir le modal avec le formulaire
    // Vérifier et formater correctement la date et l'heure
    let dateStr = date;
    let timeStr = hour;
    
    // Si hour est au format "HH:MM:SS", extraire seulement "HH:MM"
    if (timeStr && timeStr.includes(':')) {
      const timeParts = timeStr.split(':');
      timeStr = `${timeParts[0]}:${timeParts[1] || '00'}`;
    } else if (!timeStr) {
      timeStr = '00:00';
    }
    
    // S'assurer que date est au format YYYY-MM-DD
    if (!dateStr || !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Essayer de parser la date si elle n'est pas au bon format
      try {
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          dateStr = formatDateLocal(parsedDate);
        } else {
          console.error('Date invalide:', dateStr);
          alert('Erreur: Date invalide');
          return;
        }
      } catch (e) {
        console.error('Erreur lors du parsing de la date:', e);
        alert('Erreur: Format de date invalide');
        return;
      }
    }
    
    // Construire dateTime pour le formulaire (format: YYYY-MM-DD HH:MM)
    // Ne pas utiliser new Date() car cela peut causer des problèmes de timezone
    const dateTime = `${dateStr} ${timeStr}`;
    
    // Confirmateurs : priorité à fiches_histo (source de vérité) pour ne pas écraser l'ancien confirmateur
    const confFromHisto = Array.isArray(ficheData?.confirmateurs_from_histo) && ficheData.confirmateurs_from_histo.length > 0
      ? ficheData.confirmateurs_from_histo.map((id) => String(id))
      : null;
    const baseConf1 = confFromHisto ? (confFromHisto[0] || '') : (ficheData?.id_confirmateur ? String(ficheData.id_confirmateur) : '');
    const baseConf2 = confFromHisto ? (confFromHisto[1] || '') : (ficheData?.id_confirmateur_2 ? String(ficheData.id_confirmateur_2) : '');
    const baseConf3 = confFromHisto ? (confFromHisto[2] || '') : (ficheData?.id_confirmateur_3 ? String(ficheData.id_confirmateur_3) : '');

    // Initialiser le formulaire avec les données de la fiche
    const nextRdvFormData = {
      date_rdv_time: `${dateStr} ${timeStr}`,
      id_etat_final: 7, // CONFIRMER par défaut
      is_urgent: ficheData?.rdv_urgent === 1 || ficheData?.rdv_urgent === true || ficheData?.qualification_code === 'RDV_URGENT', // RDV_URGENT
      id_confirmateur: baseConf1,
      id_confirmateur_2: baseConf2,
      id_confirmateur_3: baseConf3,
      produit: ficheData?.produit ? String(ficheData.produit) : '',
      conf_rdv_avec: ficheData?.conf_rdv_avec || '',
      // Champs spécifiques PV
      surface_habitable: ficheData?.surface_habitable || '',
      conf_orientation_toiture: (ficheData?.conf_orientation_toiture || ficheData?.orientation_toiture || '').toString(),
      conf_zones_ombres: (ficheData?.conf_zones_ombres || ficheData?.zones_ombres || '').toString(),
      conf_site_classe: (ficheData?.conf_site_classe || ficheData?.site_classe || '').toString(),
      conf_consommation_electricite: (ficheData?.conf_consommation_electricite != null ? String(ficheData.conf_consommation_electricite) : (ficheData?.consommation_electricite != null ? String(ficheData.consommation_electricite) : '')),
      nb_pans: ficheData?.nb_pans != null ? String(ficheData.nb_pans) : '',
      // Champs spécifiques PAC
      surface_chauffee: ficheData?.surface_chauffee || '',
      consommation_chauffage: ficheData?.consommation_chauffage || '',
      conf_mode_chauffage:
        ficheData?.conf_mode_chauffage != null && ficheData?.conf_mode_chauffage !== ''
          ? String(ficheData.conf_mode_chauffage)
          : ficheData?.mode_chauffage
            ? String(ficheData.mode_chauffage)
            : '',
      conf_complement_chauffage: ficheData?.conf_complement_chauffage || '',
      annee_systeme_chauffage: ficheData?.annee_systeme_chauffage || '',
      conf_commentaire_produit: '' // Vide par défaut pour le modal de création RDV
    };

    // Session confirmateur (fonction 6) : confirmateur connecté = toujours conf1 ; si conf1 existait → décaler en conf2 ; si conf1 et conf2 existaient → décaler (conf1→conf2, conf2→conf3).
    if (Number(user?.fonction) === 6 && user?.id) {
      const uid = String(user.id);
      const alreadyConfirmed = !!(confFromHisto && confFromHisto.length > 0);
      if (!alreadyConfirmed) {
        nextRdvFormData.id_confirmateur = uid;
        nextRdvFormData.id_confirmateur_2 = '';
        nextRdvFormData.id_confirmateur_3 = '';
      } else {
        // Connecté = conf1 ; ancien conf1 → conf2 ; ancien conf2 → conf3
        nextRdvFormData.id_confirmateur = uid;
        nextRdvFormData.id_confirmateur_2 = baseConf1 || '';
        nextRdvFormData.id_confirmateur_3 = baseConf2 || '';
      }
    }

    setRdvFormData(nextRdvFormData);
    
    setSelectedSlot({ date, hour });
    setShowRdvModal(true);
  };

  // Fonction pour créer le RDV depuis le formulaire (formData optionnel = données avec professions résolues)
  const handleCreateRdvFromForm = async (formData) => {
    const data = formData || rdvFormData;
    if (!data.date_rdv_time) {
      alert('Veuillez remplir la date et l\'heure du RDV');
      return;
    }

    setRdvSubmitting(true);
    try {
      // Vérifier la disponibilité du créneau
      let needsApproval = false;
      let availabilityCount = null;
      let availabilityFromPlanning = null;
      let confirmedCount = 0;

      // Récupérer le nombre de RDV confirmés et la disponibilité depuis le planning
      if (planningWeek && planningYear && planningDep && selectedSlot) {
        try {
          const planningRes = await api.get('/planning/week', {
            params: { w: planningWeek, y: planningYear, dp: planningDep }
          });
          const planningData = planningRes.data?.data || {};
          const dayPlanning = planningData[selectedSlot.date]?.time;
          
          if (dayPlanning) {
            const timeKey = hourToTimeKey(selectedSlot.hour);
            const slotPlanning = dayPlanning[timeKey];
            if (slotPlanning) {
              availabilityFromPlanning = slotPlanning.av !== undefined ? slotPlanning.av : null;
              
              if (slotPlanning.planning) {
                confirmedCount = slotPlanning.planning.filter(
                  rdv => rdv.etat_check !== 'AN' && rdv.etat_check !== 'RS'
                ).length;
              }
            }
          }
        } catch (err) {
          console.error('Erreur lors de la récupération du planning:', err);
        }
      }

      if (availabilityFromPlanning !== null && availabilityFromPlanning !== undefined) {
        availabilityCount = availabilityFromPlanning;
      }

      // Vérifier si le créneau est disponible ou a atteint sa limite
      if (availabilityCount !== null && availabilityCount !== undefined) {
        if (availabilityCount === 0 || confirmedCount >= availabilityCount) {
          needsApproval = true;
        }
      }

      // Vérifier la permission pour créer un RDV sans disponibilité
      const canCreateWithoutAvailability = permissions && permissions['CREATE_RDV_NO_AVAILABILITY'] === true;
      
      if (needsApproval && canCreateWithoutAvailability) {
        needsApproval = false;
      }

      // Préparer les données de mise à jour
      // RDV_URGENT doit être en état CONFIRMER (7) avec la qualification RDV_URGENT
      const updateData = {
        date_rdv_time: data.date_rdv_time.includes(':') 
          ? data.date_rdv_time 
          : `${data.date_rdv_time}:00`,
        id_etat_final: 7, // Toujours CONFIRMER (7) - RDV_URGENT est géré via id_qualif
        produit: data.produit ? parseInt(data.produit) : null,
        conf_produit: data.produit ? parseInt(data.produit) : null,
        id_confirmateur: data.id_confirmateur ? parseInt(data.id_confirmateur) : null,
        id_confirmateur_2: data.id_confirmateur_2 ? parseInt(data.id_confirmateur_2) : null,
        id_confirmateur_3: data.id_confirmateur_3 ? parseInt(data.id_confirmateur_3) : null,
        conf_rdv_avec: data.conf_rdv_avec || null,
        conf_appel_tunisie_avec: data.conf_appel_tunisie_avec || null,
        conf_deja_etude: data.conf_deja_etude || null,
        conf_profession_monsieur: data.conf_profession_monsieur ? parseInt(data.conf_profession_monsieur) : null,
        conf_type_contrat_mr: data.conf_type_contrat_mr ? parseInt(data.conf_type_contrat_mr) : null,
        conf_profession_madame: data.conf_profession_madame ? parseInt(data.conf_profession_madame) : null,
        conf_type_contrat_madame: data.conf_type_contrat_madame ? parseInt(data.conf_type_contrat_madame) : null,
        conf_revenu: data.conf_revenu || null,
        conf_credit: data.conf_credit || null,
        conf_mode_chauffage: data.conf_mode_chauffage ? parseInt(data.conf_mode_chauffage, 10) : null,
        conf_complement_chauffage: data.conf_complement_chauffage?.trim() ? data.conf_complement_chauffage.trim() : null,
        conf_consommation_electricite: data.conf_consommation_electricite || null,
        conf_consommation_chauffage: data.conf_consommation_chauffage || null,
        conf_rdv_annule_precedent: data.conf_rdv_annule_precedent || null,
        conf_presence_couple: data.conf_presence_couple || null,
        // Champs spécifiques PV
        surface_habitable: data.surface_habitable ? parseFloat(data.surface_habitable) : null,
        conf_orientation_toiture: data.conf_orientation_toiture || null,
        conf_zones_ombres: data.conf_zones_ombres || null,
        conf_site_classe: data.conf_site_classe || null,
        nb_pans: data.nb_pans ? parseInt(data.nb_pans) : null,
        // Champs spécifiques PAC
        surface_chauffee: data.surface_chauffee || null,
        consommation_chauffage: data.consommation_chauffage || null,
        mode_chauffage: data.conf_mode_chauffage ? parseInt(data.conf_mode_chauffage, 10) : null,
        annee_systeme_chauffage: data.annee_systeme_chauffage ? parseInt(data.annee_systeme_chauffage) : null,
        conf_commentaire_produit: data.conf_commentaire_produit || null
      };

      // Vérifier si le RDV est pour aujourd'hui ou demain
      const rdvDate = new Date(updateData.date_rdv_time);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const rdvDateOnly = new Date(rdvDate);
      rdvDateOnly.setHours(0, 0, 0, 0);
      
      // Si le RDV est pour aujourd'hui ou demain, le marquer comme urgent automatiquement
      const isTodayOrTomorrow = rdvDateOnly.getTime() === today.getTime() || rdvDateOnly.getTime() === tomorrow.getTime();
      
      // Gérer rdv_urgent (nouveau champ booléen)
      // Si c'est pour aujourd'hui ou demain, ou si l'utilisateur a coché la case, mettre à 1
      updateData.rdv_urgent = (data.is_urgent || isTodayOrTomorrow) ? 1 : 0;
      
      // Pour rétrocompatibilité, mettre à jour aussi id_qualif si nécessaire
      if (updateData.rdv_urgent === 1) {
        const urgentQualif = qualifications?.find(q => q.code === 'RDV_URGENT');
        if (urgentQualif) {
          updateData.id_qualif = urgentQualif.id;
        } else {
          // Si la table qualif n'existe pas, essayer de trouver par code directement
          updateData.id_qualif = 'RDV_URGENT';
        }
      } else {
        // Si pas urgent, s'assurer que id_qualif est null
        updateData.id_qualif = null;
      }

      // Mettre à jour la fiche
      const res = await api.put(`/fiches/${hash}`, updateData);

      // Vérifier si un compte rendu a été créé (pour les commerciaux)
      if (res.data.data?.id_compte_rendu) {
        alert('Compte rendu créé avec succès. Les modifications sont en attente d\'approbation de l\'administrateur.');
        setShowRdvModal(false);
        setRdvFormData({
          date_rdv_time: '',
          id_etat_final: 7,
          is_urgent: false,
          id_confirmateur: '',
          id_confirmateur_2: '',
          id_confirmateur_3: '',
          produit: '',
          conf_rdv_avec: '',
          conf_appel_tunisie_avec: '',
          conf_deja_etude: '',
          conf_profession_monsieur: '',
          conf_type_contrat_mr: '',
          conf_profession_madame: '',
          conf_type_contrat_madame: '',
          conf_revenu: '',
          conf_credit: '',
          conf_mode_chauffage: '',
          conf_complement_chauffage: '',
          conf_consommation_electricite: '',
          conf_consommation_chauffage: '',
          conf_rdv_annule_precedent: '',
          conf_presence_couple: '',
          surface_habitable: '',
          conf_orientation_toiture: '',
          conf_zones_ombres: '',
          conf_site_classe: '',
          nb_pans: '',
          surface_chauffee: '',
          consommation_chauffage: '',
          annee_systeme_chauffage: '',
          conf_commentaire_produit: ''
        });
        return;
      }

      if (needsApproval) {
        // Créer une notification pour les admins
        const dateFormatted = formatRdvDateTime(updateData.date_rdv_time);
        
        try {
          await api.post('/notifications', {
            type: 'rdv_approval',
            fiche_hash: hash,
            message: `Demande d'approbation pour un RDV le ${dateFormatted} - Fiche: ${ficheData?.nom || ''} ${ficheData?.prenom || ''} (${ficheData?.tel || ''}). Créneau sans disponibilité ou limite atteinte.`,
            metadata: {
              date_rdv_time: updateData.date_rdv_time,
              date_formatted: dateFormatted,
              nom: ficheData?.nom || '',
              prenom: ficheData?.prenom || '',
              tel: ficheData?.tel || ''
            }
          });
        } catch (notifError) {
          console.error('Erreur lors de la création de la notification:', notifError);
        }

        alert(`RDV créé en PRE-CONFIRMER. Une demande d'approbation a été envoyée aux administrateurs.`);
      } else {
        alert(`Rendez-vous créé avec succès${data.is_urgent ? ' (RDV URGENT)' : ' (CONFIRMER)'}`);
      }

      // Fermer le modal
      setShowRdvModal(false);
      setSelectedSlot(null);

      // Recharger les données
      queryClient.invalidateQueries(['fiche', hash]);
      queryClient.invalidateQueries(['planning-week']);
      queryClient.invalidateQueries(['planning-availability']);
      queryClient.invalidateQueries('professions'); // Rafraîchir la liste (nouvelle profession éventuelle)
      queryClient.invalidateQueries(['planning-modal']);
      queryClient.invalidateQueries(['availability-modal']);
      
      if (planningWeek && planningYear && planningDep) {
        await Promise.all([
          queryClient.refetchQueries(['planning-modal', planningWeek, planningYear, planningDep], { active: true }),
          queryClient.refetchQueries(['availability-modal', planningWeek, planningYear, planningDep], { active: true })
        ]);
      }
    } catch (error) {
      console.error('Erreur lors de la création du RDV:', error);
      alert('Erreur lors de la création du rendez-vous: ' + (error.response?.data?.message || error.message));
    } finally {
      setRdvSubmitting(false);
    }
  };

  // Helper functions pour le planning (comme dans Planning.jsx)
  const getUserColor = (userId) => {
    if (!userId || !usersData) return '#cccccc';
    const user = usersData.find(u => u.id === userId);
    return user?.color || '#cccccc';
  };

  const getUserName = (userId) => {
    if (!userId || !usersData) return '';
    const user = usersData.find(u => u.id === userId);
    return user?.pseudo || '';
  };

  const getAvailabilityColor = (planningCount, availability) => {
    if (availability === 0) return '#cccccc';
    if (planningCount >= availability && planningCount > 0) return '#f44336'; // Rouge
    if (planningCount < availability && planningCount > 0) return '#f7a219'; // Orange
    return '#8BC34A'; // Vert
  };

  // Obtenir les jours de la semaine
  const getDaysFromPlanning = () => {
    if (!planningWeek || !planningYear) return [];
    
    // Calculer le lundi de la semaine (plus robuste pour les transitions d'année)
    const getMondayOfWeek = (year, week) => {
      // Trouver le 4 janvier de l'année (toujours dans la semaine 1 ISO)
      const simple = new Date(year, 0, 4);
      // Obtenir le jour de la semaine (0 = dimanche, 6 = samedi)
      // En ISO, lundi = 1, donc on ajuste
      const jan4Day = simple.getDay() || 7; // Convertir dimanche (0) en 7
      // Le lundi de la semaine 1 est le 4 janvier moins (jour - 1) jours
      const week1Monday = new Date(year, 0, 4 - (jan4Day - 1));
      // Ajouter (week - 1) semaines pour obtenir le lundi de la semaine demandée
      const targetMonday = new Date(week1Monday);
      targetMonday.setDate(week1Monday.getDate() + (week - 1) * 7);
      return targetMonday;
    };
    
    const monday = getMondayOfWeek(planningYear, planningWeek);
    const daysFr = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const days = [];
    
    // Extraire les composants du lundi pour éviter les problèmes de fuseau horaire
    const mondayYear = monday.getFullYear();
    const mondayMonth = monday.getMonth();
    const mondayDay = monday.getDate();
    
    for (let i = 0; i < 5; i++) {
      // Créer la date directement avec les composants (évite les problèmes de fuseau horaire)
      const date = new Date(mondayYear, mondayMonth, mondayDay + i);
      days.push({
        date: formatDateLocal(date),
        dayName: daysFr[i]
      });
    }
    
    return days;
  };

  // Navigation entre les semaines
  const handlePrevWeek = () => {
    if (planningWeek === 1) {
      setPlanningYear(planningYear - 1);
      setPlanningWeek(52);
    } else {
      setPlanningWeek(planningWeek - 1);
    }
  };

  const handleNextWeek = () => {
    if (planningWeek === 52) {
      setPlanningYear(planningYear + 1);
      setPlanningWeek(1);
    } else {
      setPlanningWeek(planningWeek + 1);
    }
  };

  // Formater la date pour l'affichage
  const formatWeekRange = () => {
    const days = getDaysFromPlanning();
    if (days.length === 0) return '';
    // Parser les dates en heure locale pour éviter les problèmes de fuseau horaire
    const parseDateLocal = (dateStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };
    const start = parseDateLocal(days[0].date);
    const end = parseDateLocal(days[days.length - 1].date);
    return `${start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} au ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  };

  // Gérer le changement d'état
  const handleEtatChange = (newEtatId) => {
    setSelectedEtat(newEtatId);
    if ([5, 6, 11, 12, 22, 23, 24, 25, 26, 29, 34].includes(newEtatId)) {
      setEtatFormData(prev => ({ ...prev, motif_qualif: '' }));
    }
    // Si l'état est 19 (Rappel pour Bureau) : si déjà en 19, reprendre la date/heure de la fiche ; sinon date/heure actuelles
    if (newEtatId === 19) {
      if (Number(ficheData?.id_etat_final) === 19 && ficheData?.date_rdv_time) {
        const raw = String(ficheData.date_rdv_time);
        const parts = raw.split(/[\sT]/);
        const dateRappelStr = parts[0] || '';
        const timePart = parts[1] || '09:00:00';
        const dateRappelTime = timePart.substring(0, 5);
        setEtatFormData(prev => ({
          ...prev,
          date_rappel_date: dateRappelStr,
          date_rappel_time: dateRappelTime,
          id_sous_etat: '',
          conf_commentaire_produit: '',
          motif_qualif: ''
        }));
      } else {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        setEtatFormData(prev => ({
          ...prev,
          date_rappel_date: `${yyyy}-${mm}-${dd}`,
          date_rappel_time: `${hh}:${min}`,
          conf_commentaire_produit: '',
          motif_qualif: ''
        }));
      }
    }
    // Si l'état est 7 (confirmer), initialiser les valeurs du formulaire
    if (newEtatId === 7) {
      const currentDate = new Date();
      const dateStr = currentDate.toISOString().split('T')[0];
      const timeStr = currentDate.toTimeString().split(' ')[0].substring(0, 5);
      
      // Extraire date et heure depuis date_rdv_time si disponible
      let rdvDate = dateStr;
      let rdvTime = timeStr;
      if (ficheData?.date_rdv_time) {
        const parts = ficheData.date_rdv_time.split(' ');
        if (parts[0]) rdvDate = parts[0];
        if (parts[1]) rdvTime = parts[1].substring(0, 5);
      }
      
      // Confirmateurs : priorité fiches_histo (source de vérité) ; première confirmation => conf1 = connecté ; déjà confirmée => garder existants et ajouter connecté en conf2/conf3
      const histoConf = Array.isArray(ficheData?.confirmateurs_from_histo) && ficheData.confirmateurs_from_histo.length > 0
        ? ficheData.confirmateurs_from_histo.map((id) => String(id))
        : null;
      let idConf1 = histoConf ? (histoConf[0] || '') : (ficheData?.id_confirmateur ? String(ficheData.id_confirmateur) : '');
      let idConf2 = histoConf ? (histoConf[1] || '') : (ficheData?.id_confirmateur_2 ? String(ficheData.id_confirmateur_2) : '');
      let idConf3 = histoConf ? (histoConf[2] || '') : (ficheData?.id_confirmateur_3 ? String(ficheData.id_confirmateur_3) : '');
      // Confirmateurs : connecté = toujours conf1 ; si histo existe, décaler ancien conf1→conf2, ancien conf2→conf3
      if (Number(user?.fonction) === 6 && user?.id) {
        const uid = String(user.id);
        const alreadyConfirmed = !!(histoConf && histoConf.length > 0);
        if (!alreadyConfirmed) {
          idConf1 = uid;
          idConf2 = '';
          idConf3 = '';
        } else {
          idConf1 = uid;
          idConf2 = histoConf[0] || '';
          idConf3 = histoConf[1] || '';
        }
      }
      
      setConfFormData({
        produit: ficheData?.produit ? String(ficheData.produit) : '',
        id_confirmateur: idConf1,
        id_confirmateur_2: idConf2,
        id_confirmateur_3: idConf3,
        conf_rdv_date: rdvDate,
        conf_rdv_time: rdvTime,
        conf_rdv_avec: ficheData?.conf_rdv_avec || '',
        conf_appel_tunisie_avec: ficheData?.conf_appel_tunisie_avec || '',
        conf_deja_etude: ficheData?.conf_deja_etude || '',
        conf_profession_monsieur: ficheData?.conf_profession_monsieur != null ? String(ficheData.conf_profession_monsieur) : '',
        conf_type_contrat_mr: ficheData?.conf_type_contrat_mr != null ? String(ficheData.conf_type_contrat_mr) : '',
        conf_profession_madame: ficheData?.conf_profession_madame != null ? String(ficheData.conf_profession_madame) : '',
        conf_type_contrat_madame: ficheData?.conf_type_contrat_madame != null ? String(ficheData.conf_type_contrat_madame) : '',
        conf_revenu: ficheData?.conf_revenu || '',
        conf_credit: ficheData?.conf_credit || '',
        conf_mode_chauffage:
          ficheData?.conf_mode_chauffage != null && ficheData?.conf_mode_chauffage !== ''
            ? String(ficheData.conf_mode_chauffage)
            : ficheData?.mode_chauffage
              ? String(ficheData.mode_chauffage)
              : '',
        conf_complement_chauffage: ficheData?.conf_complement_chauffage || '',
        conf_consommation_electricite: ficheData?.conf_consommation_electricite || ficheData?.consommation_electricite || '',
        conf_consommation_chauffage: ficheData?.conf_consommation_chauffage || ficheData?.consommation_chauffage || '',
        conf_rdv_annule_precedent: ficheData?.conf_rdv_annule_precedent || '',
        conf_presence_couple: ficheData?.conf_presence_couple || '',
        conf_orientation_toiture: ficheData?.conf_orientation_toiture || ficheData?.orientation_toiture || '',
        conf_zones_ombres: ficheData?.conf_zones_ombres || ficheData?.zones_ombres || '',
        conf_site_classe: ficheData?.conf_site_classe || ficheData?.site_classe || '',
        nb_pans: ficheData?.nb_pans ? String(ficheData.nb_pans) : '',
        annee_systeme_chauffage: ficheData?.annee_systeme_chauffage ? String(ficheData.annee_systeme_chauffage) : '',
        surface_chauffee: ficheData?.surface_chauffee || '',
        consommation_chauffage: ficheData?.consommation_chauffage || '',
        conf_commentaire_produit: ficheData?.conf_commentaire_produit || ficheData?.commentaire || ''
      });
    } else {
      setConfFormData({
        produit: '',
        id_confirmateur: '',
        id_confirmateur_2: '',
        id_confirmateur_3: '',
        conf_rdv_date: '',
        conf_rdv_time: '',
        conf_rdv_avec: '',
        conf_appel_tunisie_avec: '',
        conf_deja_etude: '',
        conf_profession_monsieur: '',
        conf_type_contrat_mr: '',
        conf_profession_madame: '',
        conf_type_contrat_madame: '',
        conf_revenu: '',
        conf_credit: '',
        conf_mode_chauffage: '',
        conf_complement_chauffage: '',
        conf_consommation_electricite: '',
        conf_consommation_chauffage: '',
        conf_rdv_annule_precedent: '',
        conf_presence_couple: '',
        conf_orientation_toiture: '',
        conf_zones_ombres: '',
        nb_pans: '',
        conf_site_classe: '',
        annee_systeme_chauffage: '',
        surface_chauffee: '',
        consommation_chauffage: '',
        conf_commentaire_produit: ''
      });
      setConfProfMrDisplay('');
      setConfProfMmeDisplay('');
      setShowSuggestionsMr(false);
      setShowSuggestionsMme(false);
    }
  };

  // Soumettre la confirmation (état 7)
  const handleConfirmSubmit = async () => {
    try {
      // Validation : commentaire obligatoire pour la confirmation
      if (!(confFormData.conf_commentaire_produit || '').trim()) {
        alert('Veuillez saisir un commentaire.');
        return;
      }

      // Construire la date/heure du RDV
      const dateRdvTime = confFormData.conf_rdv_date && confFormData.conf_rdv_time 
        ? `${confFormData.conf_rdv_date} ${confFormData.conf_rdv_time}:00`
        : null;

      // Vérifier si le créneau planning est fermé (même règle que création RDV depuis l'onglet Planning)
      if (confFormData.conf_rdv_date && confFormData.conf_rdv_time) {
        let dep = planningDep;
        if (!dep && ficheData?.cp) {
          const cpStr = String(ficheData.cp).trim();
          if (/^\d/.test(cpStr)) dep = cpStr.substring(0, 2);
          else { const m = cpStr.match(/\d{2}/); if (m) dep = m[0]; }
        }
        if (dep && dep.length === 2 && /^\d{2}$/.test(dep)) {
          const rdvDate = new Date(confFormData.conf_rdv_date + 'T12:00:00');
          const week = getWeekNumber(rdvDate);
          const year = rdvDate.getFullYear();
          const slotHour = timeToSlotHour(confFormData.conf_rdv_time);
          if (slotHour) {
            const availRes = await api.get('/planning/availability', { params: { w: week, y: year, dp: dep } });
            const availData = availRes.data?.data?.[confFormData.conf_rdv_date]?.[slotHour];
            if (availData?.is_closed === 1) {
              alert('Impossible de confirmer : le créneau du planning pour cette date et heure est fermé.');
              return;
            }
          }
        }
      }

      // Résoudre les professions (créer en base si libellé saisi n'existe pas)
      const idProfMr = await resolveProfessionId(api, confProfMrDisplay, confFormData.conf_profession_monsieur, professions);
      const idProfMme = await resolveProfessionId(api, confProfMmeDisplay, confFormData.conf_profession_madame, professions);

      // Préparer les données à envoyer
      const updateData = {
        id_etat_final: 7,
        produit: confFormData.produit ? parseInt(confFormData.produit) : null,
        id_confirmateur: confFormData.id_confirmateur ? parseInt(confFormData.id_confirmateur) : null,
        id_confirmateur_2: confFormData.id_confirmateur_2 ? parseInt(confFormData.id_confirmateur_2) : null,
        id_confirmateur_3: confFormData.id_confirmateur_3 ? parseInt(confFormData.id_confirmateur_3) : null,
        date_rdv_time: dateRdvTime,
        conf_rdv_avec: confFormData.conf_rdv_avec || null,
        conf_appel_tunisie_avec: confFormData.conf_appel_tunisie_avec || null,
        conf_deja_etude: confFormData.conf_deja_etude || null,
        conf_profession_monsieur: idProfMr ? parseInt(idProfMr) : null,
        conf_type_contrat_mr: confFormData.conf_type_contrat_mr ? parseInt(confFormData.conf_type_contrat_mr) : null,
        conf_profession_madame: idProfMme ? parseInt(idProfMme) : null,
        conf_type_contrat_madame: confFormData.conf_type_contrat_madame ? parseInt(confFormData.conf_type_contrat_madame) : null,
        conf_revenu: confFormData.conf_revenu || null,
        conf_credit: confFormData.conf_credit || null,
        conf_mode_chauffage: confFormData.conf_mode_chauffage ? parseInt(confFormData.conf_mode_chauffage, 10) : null,
        conf_complement_chauffage: confFormData.conf_complement_chauffage?.trim() ? confFormData.conf_complement_chauffage.trim() : null,
        conf_consommation_electricite: confFormData.conf_consommation_electricite || null,
        conf_consommation_chauffage: confFormData.conf_consommation_chauffage || null,
        conf_rdv_annule_precedent: confFormData.conf_rdv_annule_precedent || null,
        conf_presence_couple: confFormData.conf_presence_couple || null,
        conf_orientation_toiture: confFormData.conf_orientation_toiture || null,
        conf_zones_ombres: confFormData.conf_zones_ombres || null,
        conf_site_classe: confFormData.conf_site_classe || null,
        nb_pans: confFormData.nb_pans ? parseInt(confFormData.nb_pans) : null,
        mode_chauffage: confFormData.conf_mode_chauffage ? parseInt(confFormData.conf_mode_chauffage, 10) : null,
        annee_systeme_chauffage: confFormData.annee_systeme_chauffage ? parseInt(confFormData.annee_systeme_chauffage) : null,
        surface_chauffee: confFormData.surface_chauffee ? parseFloat(confFormData.surface_chauffee) : null,
        consommation_chauffage: confFormData.consommation_chauffage || null,
        conf_commentaire_produit: confFormData.conf_commentaire_produit || null
      };

      // Appeler l'API pour mettre à jour
      const res = await api.put(`/fiches/${hash}`, updateData);
      
      if (res.data.success) {
        // Recharger les données
        queryClient.invalidateQueries(['fiche', hash]);
        queryClient.invalidateQueries(['fiches']);
        queryClient.invalidateQueries(['modifica', hash]); // Invalider les modifications
        queryClient.invalidateQueries(['planning-commercial']); // Mettre à jour le planning commercial
        queryClient.invalidateQueries('professions'); // Rafraîchir la liste (nouvelle profession éventuelle)
        setSelectedEtat(null);
        setCompteRenduOption('');
        setEditingCompteRendu(null);
        setConfFormData({
          produit: '',
          id_confirmateur: '',
          id_confirmateur_2: '',
          id_confirmateur_3: '',
          conf_rdv_date: '',
          conf_rdv_time: '',
          conf_rdv_avec: '',
          conf_appel_tunisie_avec: '',
          conf_deja_etude: '',
          conf_profession_monsieur: '',
          conf_type_contrat_mr: '',
          conf_profession_madame: '',
          conf_type_contrat_madame: '',
          conf_revenu: '',
          conf_credit: '',
          conf_mode_chauffage: '',
          conf_complement_chauffage: '',
          conf_consommation_electricite: '',
          conf_consommation_chauffage: '',
          conf_rdv_annule_precedent: '',
          conf_presence_couple: '',
          conf_orientation_toiture: '',
          conf_zones_ombres: '',
          conf_site_classe: '',
          nb_pans: '',
          annee_systeme_chauffage: '',
          surface_chauffee: '',
          consommation_chauffage: '',
          conf_commentaire_produit: ''
        });
        setConfProfMrDisplay('');
        setConfProfMmeDisplay('');
        setShowSuggestionsMr(false);
        setShowSuggestionsMme(false);
        alert('Fiche confirmée avec succès');
      }
    } catch (error) {
      console.error('Erreur lors de la confirmation:', error);
      alert('Erreur lors de la confirmation de la fiche: ' + (error.response?.data?.message || error.message));
    }
  };

  // Mutation pour modifier un compte rendu
  const updateCompteRenduMutation = useMutation(
    async ({ crId, data }) => {
      const res = await api.put(`/compte-rendu/${crId}`, data);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['fiche', hash]);
        queryClient.invalidateQueries(['planning-commercial']); // Mettre à jour le planning commercial
        setEditingCompteRendu(null);
        setCompteRenduOption('');
        setSelectedEtat(null);
        alert('Compte rendu modifié avec succès');
      },
      onError: (error) => {
        alert('Erreur lors de la modification du compte rendu: ' + (error.response?.data?.message || error.message));
      }
    }
  );

  // Soumettre le changement d'état pour les autres états
  const handleEtatSubmit = async () => {
    try {
      if (!selectedEtat) {
        alert('Veuillez sélectionner un état');
        return;
      }

      if (ficheData?.id_etat_final != null && ETATS_SANS_NOUVEL_ETAT.includes(Number(ficheData.id_etat_final))) {
        alert('Impossible de modifier l\'état : la fiche est dans un état définitif (annuler ou refus 2 fois, RDV annuler 2 fois, HHC financement à vérifier ou HHC technique).');
        return;
      }

      const isCommercialPorteImprevuNrp =
        Number(user?.fonction) === 5 && compteRenduOption === 'porte_imprevu_nrp' && Number(selectedEtat) === 8;

      // Validation : sous-état obligatoire si la liste existe (sauf états 11 et 12 où il est facultatif)
      if (
        etatsSousEtatObligatoire.includes(selectedEtat) &&
        sousEtats &&
        sousEtats.length > 0 &&
        !(selectedEtat === 8 && isCommercialPorteImprevuNrp)
      ) {
        const idSousEtat =
          selectedEtat === 2
            ? (nrpFormData.id_sous_etat || '').toString().trim()
            : (etatFormData.id_sous_etat || '').toString().trim();
        if (!idSousEtat) {
          alert('Veuillez sélectionner un sous-état.');
          return;
        }
      }

      if (ETATS_MOTIF_QUALIF_REQUIS.includes(selectedEtat)) {
        if (!(etatFormData.motif_qualif || '').trim()) {
          alert('Veuillez saisir un commentaire.');
          return;
        }
      }

      // Validation : commentaire obligatoire lorsque le formulaire le propose (11 et 12 : commentaire facultatif)
      const etatsAvecCommentaire = [2, 8, 9, 19, 23, 34, 13, 44, 45, 16, 38];
      if (etatsAvecCommentaire.includes(selectedEtat)) {
        const comment =
          selectedEtat === 2
            ? (nrpFormData.conf_commentaire_produit || '').trim()
            : [19, 23, 34].includes(selectedEtat)
              ? (etatFormData.motif_qualif || '').trim()
              : (etatFormData.conf_commentaire_produit || '').trim();
        if (!comment) {
          alert('Veuillez saisir un commentaire.');
          return;
        }
      }

      // HHC FINANCEMENT A VERIFIER (34) : "Appel avec qui" obligatoire
      if (selectedEtat === 34 && !(etatFormData.conf_rdv_avec || '').trim()) {
        alert('Veuillez renseigner "Appel avec qui".');
        return;
      }

      // Si on modifie un compte rendu existant
      if (editingCompteRendu) {
        const crToEdit = ficheData?.comptes_rendus?.find(cr => cr.id === editingCompteRendu);
        if (!crToEdit) {
          alert('Compte rendu non trouvé');
          return;
        }

        // Construire les données de modification selon le type d'état
        const modifications = {};
        const updateData = {
          id_etat_final: selectedEtat,
          commentaire: selectedEtat === 2
            ? (nrpFormData.conf_commentaire_produit || '')
            : (etatFormData.conf_commentaire_produit || '')
        };
        // Pour "Porte / Imprévu / NRP" (état 8), le commercial ne modifie que le commentaire.
        if (!isCommercialPorteImprevuNrp) {
          updateData.id_sous_etat = selectedEtat === 2
            ? (nrpFormData.id_sous_etat ? parseInt(nrpFormData.id_sous_etat) : null)
            : (etatFormData.id_sous_etat ? parseInt(etatFormData.id_sous_etat) : null);
        }

        // Pour SIGNER, ajouter les champs Phase 3
        if ([13, 44, 45].includes(selectedEtat)) {
          if (etatFormData.date_sign_date && etatFormData.date_sign_time) {
            const dateSignStr = `${etatFormData.date_sign_date} ${etatFormData.date_sign_time}:00`;
            modifications.date_sign_time = dateSignStr;
          }
          if (etatFormData.produit) {
            modifications.produit = parseInt(etatFormData.produit);
          }
          if (etatFormData.id_commercial) {
            modifications.id_commercial = parseInt(etatFormData.id_commercial);
          }
          if (etatFormData.id_commercial_2) {
            modifications.id_commercial_2 = parseInt(etatFormData.id_commercial_2);
          }
          if (etatFormData.pseudo) {
            modifications.pseudo = etatFormData.pseudo;
          }
          if (etatFormData.conf_consommations) {
            modifications.conf_consommations = etatFormData.conf_consommations;
          }
          if (etatFormData.valeur_mensualite) {
            modifications.valeur_mensualite = etatFormData.valeur_mensualite;
          }
          
          updateData.ph3_pac = etatFormData.ph3_pac || null;
          updateData.ph3_rr_model = etatFormData.ph3_rr_model || null;
          updateData.ph3_puissance = etatFormData.ph3_puissance || null;
          updateData.ph3_ballon = etatFormData.ph3_ballon || null;
          updateData.ph3_marque_ballon = etatFormData.ph3_marque_ballon || null;
          updateData.ph3_alimentation = etatFormData.ph3_alimentation || null;
          updateData.ph3_type = etatFormData.ph3_type || null;
          updateData.ph3_prix = etatFormData.ph3_prix || null;
          updateData.ph3_installateur = etatFormData.ph3_installateur ? parseInt(etatFormData.ph3_installateur) : null;
          updateData.ph3_bonus_30 = etatFormData.ph3_bonus_30 || null;
          updateData.ph3_mensualite = etatFormData.ph3_mensualite || null;
          updateData.ph3_attente = etatFormData.ph3_attente || null;
          updateData.nbr_annee_finance = etatFormData.nbr_annee_finance || null;
          updateData.credit_immobilier = etatFormData.credit_immobilier || null;
          updateData.credit_autre = etatFormData.credit_autre || null;
        } else if (selectedEtat === 8 && !isCommercialPorteImprevuNrp) {
          // ANNULER À REPROGRAMMER
          if (etatFormData.conf_rdv_date && etatFormData.conf_rdv_time) {
            modifications.conf_rdv_date = etatFormData.conf_rdv_date;
            modifications.conf_rdv_time = etatFormData.conf_rdv_time;
          }
          if (etatFormData.conf_rdv_avec) {
            modifications.conf_rdv_avec = etatFormData.conf_rdv_avec;
          }
        }

        if (Object.keys(modifications).length > 0) {
          updateData.modifications = modifications;
        }

        setEtatSubmitting(true);
        updateCompteRenduMutation.mutate({ crId: editingCompteRendu, data: updateData }, { onSettled: () => setEtatSubmitting(false) });
        return;
      }

      setEtatSubmitting(true);
      const updateData = {
        id_etat_final: parseInt(selectedEtat)
      };
      if (showHistoConfirmateurDropdown && histoConfirmateurId !== '' && histoConfirmateurId != null) {
        updateData.histo_id_confirmateur = parseInt(histoConfirmateurId, 10);
      }

      // Ajouter les champs spécifiques selon l'état sélectionné
      if (selectedEtat === 2) {
        // NRP - date_appel_time sera rempli automatiquement par le backend lors du changement d'état
        if (nrpFormData.id_sous_etat) {
          updateData.id_sous_etat = parseInt(nrpFormData.id_sous_etat);
        }
        if (nrpFormData.conf_commentaire_produit) {
          updateData.conf_commentaire_produit = nrpFormData.conf_commentaire_produit;
        }
      } else if (selectedEtat === 8) {
        // ANNULER À REPROGRAMMER
        // Pour "Porte / Imprévu / NRP" côté commercial, on ne saisit que le commentaire.
        if (!isCommercialPorteImprevuNrp) {
          if (etatFormData.conf_rdv_date) {
            const dateRdvStr = `${etatFormData.conf_rdv_date} ${etatFormData.conf_rdv_time || '00:00'}:00`;
            updateData.date_rdv_time = dateRdvStr;
          }
          if (etatFormData.id_sous_etat) {
            updateData.id_sous_etat = parseInt(etatFormData.id_sous_etat);
          }
          if (etatFormData.conf_rdv_avec) {
            updateData.conf_rdv_avec = etatFormData.conf_rdv_avec;
          }
        }
        if (etatFormData.conf_commentaire_produit) {
          updateData.conf_commentaire_produit = etatFormData.conf_commentaire_produit;
        }
      } else if (selectedEtat === 19) {
        // RAPPEL POUR BUREAU
        // Enregistrer la date de rappel choisie dans date_rdv_time
        // pour affichage cohérent dans l'historique et l'état actuel.
        if (etatFormData.date_rappel_date) {
          const dateRappelStr = `${etatFormData.date_rappel_date} ${etatFormData.date_rappel_time || '09:00'}:00`;
          updateData.date_rdv_time = dateRappelStr;
        }
        if (etatFormData.id_sous_etat) {
          updateData.id_sous_etat = parseInt(etatFormData.id_sous_etat);
        }
        if (etatFormData.motif_qualif) {
          updateData.motif_qualif = etatFormData.motif_qualif;
        }
      } else if ([5, 6, 9, 11, 12, 22, 23, 24, 25, 26, 29, 34].includes(selectedEtat)) {
        // CLIENT HONORE A SUIVRE (9), RDV ANNULER (11), REFUSER (12), HORS CIBLE (23), HHC FINANCEMENT (34), ANNULER (5), HC ÂGE/DBL/LOC (6), ANNULER 2× (22), HC FINANCEMENT (24), REFUSER 2× (25), RDV ANNULER 2× (26), HC AIR AIR (29)
        if (selectedEtat === 9 && etatFormData.conf_commentaire_produit) {
          updateData.conf_commentaire_produit = etatFormData.conf_commentaire_produit;
        }
        if ([11, 12].includes(selectedEtat)) {
          if (etatFormData.id_sous_etat) {
            updateData.id_sous_etat = parseInt(etatFormData.id_sous_etat, 10);
          }
          if (etatFormData.motif_qualif) updateData.motif_qualif = etatFormData.motif_qualif;
        } else if ([5, 6, 22, 24, 25, 26, 29].includes(selectedEtat) && etatFormData.motif_qualif) {
          updateData.motif_qualif = etatFormData.motif_qualif;
        } else if ([23, 34].includes(selectedEtat) && etatFormData.motif_qualif) {
          updateData.motif_qualif = etatFormData.motif_qualif;
        }
        if (selectedEtat === 34 && etatFormData.conf_rdv_avec) {
          updateData.conf_rdv_avec = etatFormData.conf_rdv_avec;
        }
        // Pour Honoré à suivre (9), ajouter A Rappeler le (toutes sessions)
        if (selectedEtat === 9) {
          if (etatFormData.date_rappel_date) {
            const dateRappelStr = `${etatFormData.date_rappel_date} ${etatFormData.date_rappel_time || '09:00'}:00`;
            updateData.date_rdv_time = dateRappelStr;
          }
          // Session admin/backoffice/RP/RE: possibilité d'assigner le commercial
          if (etatFormData.id_commercial) {
            if (isAdminSessionHonoreSuivre) {
              updateData.id_commercial = parseInt(etatFormData.id_commercial);
            }
          }
        }
      } else if ([13, 44, 45].includes(selectedEtat)) {
        // SIGNER, SIGNER PM, SIGNER COMPLET
        if (etatFormData.date_sign_date) {
          const dateSignStr = `${etatFormData.date_sign_date} ${etatFormData.date_sign_time || '00:00'}:00`;
          updateData.date_sign_time = dateSignStr;
        }
        if (etatFormData.produit) {
          updateData.produit = parseInt(etatFormData.produit);
        }
        if (etatFormData.id_sous_etat) {
          updateData.id_sous_etat = parseInt(etatFormData.id_sous_etat);
        }
        if (etatFormData.id_commercial) {
          updateData.id_commercial = parseInt(etatFormData.id_commercial);
        }
        if (etatFormData.id_commercial_2) {
          updateData.id_commercial_2 = parseInt(etatFormData.id_commercial_2);
        }
        if (etatFormData.pseudo) {
          updateData.pseudo = etatFormData.pseudo;
        }
        if (etatFormData.ph3_pac) {
          updateData.ph3_pac = etatFormData.ph3_pac;
        }
        if (etatFormData.ph3_rr_model) {
          updateData.ph3_rr_model = etatFormData.ph3_rr_model;
        }
        if (etatFormData.ph3_puissance) {
          updateData.ph3_puissance = etatFormData.ph3_puissance;
        }
        if (etatFormData.ph3_puissance_pv) {
          updateData.ph3_puissance_pv = etatFormData.ph3_puissance_pv;
        }
        if (etatFormData.ph3_ballon) {
          updateData.ph3_ballon = etatFormData.ph3_ballon;
        }
        if (etatFormData.ph3_marque_ballon) {
          updateData.ph3_marque_ballon = etatFormData.ph3_marque_ballon;
        }
        if (etatFormData.ph3_alimentation) {
          updateData.ph3_alimentation = etatFormData.ph3_alimentation;
        }
        if (etatFormData.ph3_type) {
          updateData.ph3_type = etatFormData.ph3_type;
        }
        if (etatFormData.ph3_prix) {
          updateData.ph3_prix = parseFloat(etatFormData.ph3_prix);
        }
        if (etatFormData.ph3_installateur) {
          updateData.ph3_installateur = parseInt(etatFormData.ph3_installateur);
        }
        if (etatFormData.conf_consommations) {
          updateData.conf_consommations = parseFloat(etatFormData.conf_consommations);
        }
        if (etatFormData.ph3_bonus_30) {
          updateData.ph3_bonus_30 = etatFormData.ph3_bonus_30;
        }
        if (etatFormData.valeur_mensualite) {
          updateData.valeur_mensualite = parseFloat(etatFormData.valeur_mensualite);
        }
        if (etatFormData.ph3_mensualite) {
          updateData.ph3_mensualite = parseFloat(etatFormData.ph3_mensualite);
        }
        if (etatFormData.ph3_attente) {
          updateData.ph3_attente = etatFormData.ph3_attente;
        }
        if (etatFormData.nbr_annee_finance) {
          updateData.nbr_annee_finance = parseInt(etatFormData.nbr_annee_finance);
        }
        if (etatFormData.credit_immobilier) {
          updateData.credit_immobilier = parseFloat(etatFormData.credit_immobilier);
        }
        if (etatFormData.credit_autre) {
          updateData.credit_autre = parseFloat(etatFormData.credit_autre);
        }
        if (etatFormData.conf_commentaire_produit) {
          updateData.conf_commentaire_produit = etatFormData.conf_commentaire_produit;
        }
      } else if ([16, 38].includes(selectedEtat)) {
        // SIGNER RETRACTER
        if (etatFormData.id_commercial) {
          updateData.id_commercial = parseInt(etatFormData.id_commercial);
        }
        if (etatFormData.id_commercial_2) {
          updateData.id_commercial_2 = parseInt(etatFormData.id_commercial_2);
        }
        if (etatFormData.conf_commentaire_produit) {
          updateData.conf_commentaire_produit = etatFormData.conf_commentaire_produit;
        }
      }

      // Appeler l'API pour mettre à jour
      const res = await api.put(`/fiches/${hash}`, updateData);
      
      if (res.data.success) {
        // Vérifier si un compte rendu a été créé (pour les commerciaux)
        if (res.data.data?.id_compte_rendu) {
          queryClient.invalidateQueries(['planning-commercial']); // Mettre à jour le planning commercial
          alert('Compte rendu créé avec succès. Les modifications sont en attente d\'approbation de l\'administrateur.');
        } else {
          // Recharger les données seulement si les modifications ont été appliquées directement
          queryClient.invalidateQueries(['fiche', hash]);
          queryClient.invalidateQueries(['fiches']);
          queryClient.invalidateQueries(['modifica', hash]); // Invalider les modifications
          queryClient.invalidateQueries(['planning-commercial']); // Mettre à jour le planning commercial
          // Invalider aussi les queries de planning au cas où
          queryClient.invalidateQueries(['planning-week']);
          queryClient.invalidateQueries(['planning-availability']);
          queryClient.invalidateQueries(['planning-modal']);
        }
        queryClient.invalidateQueries(['availability-modal']);
        setSelectedEtat(null);
        setCompteRenduOption('');
        setNrpFormData({
          date_appel_date: '',
          date_appel_time: '',
          id_sous_etat: '',
          conf_commentaire_produit: ''
        });
        // Pas d'alerte de succès ici pour éviter la popup lors de la validation de l'état.
      }
      setEtatSubmitting(false);
    } catch (error) {
      console.error('Erreur lors du changement d\'état:', error);
      alert('Erreur lors du changement d\'état: ' + (error.response?.data?.message || error.message));
      setEtatSubmitting(false);
    }
  };

  const renderField = (label, field, value, type = 'text', options = null, readOnly = false) => {
    const isEditing = editingField === field;
    
    
    // Permissions d'édition :
    // - Admins (1, 2, 7) : peuvent tout modifier
    // - Agents (3) : peuvent modifier les fiches de leur centre
    // - Commerciaux (5) : peuvent modifier leurs propres fiches (avec permission fiches_edit)
    // - Confirmateurs (6) : peuvent modifier les fiches qui leur sont assignées
    if (!ficheData || !user) {
      // Si les données ne sont pas chargées, afficher quand même le champ mais sans possibilité d'édition
      const canEdit = false;
      return (
        <tr>
          <td className="field-label">{label}</td>
          <td className="field-value">
            <span className="field-display">{value || '-'}</span>
          </td>
          <td className="field-actions"></td>
        </tr>
      );
    }
    
    // Permissions d'édition :
    // - Admins (1, 2, 7) : peuvent tout modifier
    // - Superviseur Qualification (2) : peuvent modifier les fiches des agents sous leur responsabilité
    // - RP Qualification (12) : peuvent modifier les fiches des agents sous la responsabilité de leurs superviseurs
    // - Agents (3) : peuvent modifier les fiches de leur centre
    // - Commerciaux (5) : peuvent modifier leurs propres fiches (avec permission fiches_edit)
    // - Confirmateurs (6) : peuvent modifier toutes les fiches
    // Convertir la fonction en nombre pour la comparaison (peut être string ou number)
    // Utiliser == au lieu de === pour gérer les comparaisons string/number
    const userFonctionRaw = user.fonction;
    const userFonction = userFonctionRaw != null ? Number(userFonctionRaw) : null;
    
    // Permissions d'édition pour qualité qualification (fonction 2, 8 et 12)
    // Utiliser == pour gérer les comparaisons string/number
    const isQualiteQualif = userFonction == 2 || userFonction == 8 || userFonction == 12;
    const isAdmin = userFonction == 1 || userFonction == 7;
    const isAgent = userFonction == 3 && user.centre === ficheData.id_centre;
    const isCommercial = userFonction == 5 && hasPermission('fiches_edit') && ficheData.id_commercial === user.id;
    const isConfirmateur = userFonction == 6;
    const isREConfirmation = userFonction == 14; // RE confirmation : modification rapide
    const isRPConfirmation = userFonction == 13; // RP confirmation : modification rapide
    const isBackoffice = userFonction == 11; // Backoffice : modification rapide
    const canEditModificationRapide = isREConfirmation || isRPConfirmation || isBackoffice || (typeof hasPermission === 'function' && hasPermission('fiche_quick_edit'));

    // Pour les sessions "modification rapide", tous les champs sont modifiables (sauf date_appel_time si backend le refuse)
    const effectiveReadOnly = readOnly && !canEditModificationRapide;
    const canEditField = !effectiveReadOnly && userFonction != null && (isAdmin || isQualiteQualif || isAgent || isCommercial || isConfirmateur || canEditModificationRapide);
    

    return (
      <tr>
        <td className="field-label">{label}</td>
        <td className="field-value">
          {isEditing ? (
            <div className="edit-controls">
              {type === 'select' && options ? (
                <select
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveField(field); } }}
                  className="form-control"
                  autoFocus
                >
                  <option value="">Sélectionner</option>
                  {options.map(opt => (
                    <option key={opt.id || opt.value} value={opt.id || opt.value}>
                      {opt.nom || opt.titre || opt.label}
                    </option>
                  ))}
                </select>
              ) : type === 'textarea' ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSaveField(field); } }}
                  className="form-control"
                  autoFocus
                  rows={4}
                  title="Ctrl+Entrée pour enregistrer"
                />
              ) : (
                <input
                  type={type}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveField(field); } }}
                  className="form-control"
                  autoFocus
                />
              )}
              <button
                className="btn-save"
                onClick={() => handleSaveField(field)}
                disabled={updateFieldMutation.isLoading}
              >
                <FaCheck />
              </button>
              <button
                className="btn-cancel"
                onClick={handleCancelEdit}
              >
                <FaTimes />
              </button>
            </div>
          ) : (
            <span className="field-display">
              {value || '-'}
            </span>
          )}
        </td>
        <td className="field-actions">
          {canEditField && !isEditing && (
            <button
              className="btn-edit"
              onClick={() => handleEditField(field, value)}
              title="Modifier"
            >
              <FaEdit />
            </button>
          )}
        </td>
      </tr>
    );
  };

  if (isLoading) {
    return <div className="loading">Chargement...</div>;
  }

  if (!ficheData) {
    return <div className="error">Fiche non trouvée</div>;
  }

  const fiche = ficheData;

  const isChangementEtatBloque = fiche.id_etat_final != null && ETATS_SANS_NOUVEL_ETAT.includes(Number(fiche.id_etat_final));

  const userFonctionTop = user ? Number(user.fonction) : null;
  const canEditModificationRapideTop = userFonctionTop === 14 || userFonctionTop === 13 || userFonctionTop === 11 || (typeof hasPermission === 'function' && hasPermission('fiche_quick_edit'));
  const getEtatColor = () => {
    if (fiche.etat_final_color) {
      return fiche.etat_final_color;
    }
    // Si pas de couleur dans les données, chercher dans la liste des états
    if (etats && fiche.id_etat_final) {
      const etat = etats.find(e => e.id === fiche.id_etat_final);
      return etat?.color || '#3498db';
    }
    return '#3498db'; // Couleur par défaut
  };

  const etatColor = getEtatColor();
  const etatActuelHeaderColor = (() => {
    const c = String(etatColor || '').trim().toLowerCase();
    if (c === '#ffffff' || c === '#fff' || c === 'white') return '#333333';
    return etatColor;
  })();

  const etatActuelHeaderTitre = fiche.id_etat_final
    ? (fiche.etat_final_titre || etats?.find((e) => e.id === fiche.id_etat_final)?.titre || 'État inconnu')
    : null;
  const etatActuelHeaderSous = fiche.sous_etat_titre || null;

  // Fonction pour générer le PDF
  const generatePDF = () => {
    if (!fiche) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const maxWidth = pageWidth - (margin * 2);
    const headerHeight = 18;
    const footerHeight = 8;
    const availableHeight = pageHeight - headerHeight - footerHeight;
    
    // Utiliser des tailles réduites par défaut pour garantir une seule page
    const sectionSpacing = 2;
    const titleFontSize = 8;
    const contentFontSize = 6.5;
    const lineHeight = 3;
    
    // Préparer les données
    const professionMr = professions?.find(p => p.id == fiche.profession_mr)?.nom || fiche.profession_mr || '-';
    const professionMme = professions?.find(p => p.id == fiche.profession_madame)?.nom || fiche.profession_madame || '-';
    const typeContratMr = typeContrat?.find(t => String(t.id) === String(fiche.type_contrat_mr))?.nom || fiche.type_contrat_mr || '-';
    const typeContratMme = typeContrat?.find(t => String(t.id) === String(fiche.type_contrat_madame))?.nom || fiche.type_contrat_madame || '-';
    const modeChauffageNom = modeChauffage?.find(m => m.id == fiche.mode_chauffage)?.nom || fiche.mode_chauffage || '-';
    const produitNom = fiche.produit_nom || (fiche.produit === 1 ? 'PAC' : fiche.produit === 2 ? 'PV' : '-');
    const centreNom = centres?.find(c => c.id === fiche.id_centre)?.titre || fiche.centre_titre || '-';
    const agentNom = agents?.find(a => a.id === fiche.id_agent)?.pseudo || fiche.agent_pseudo || '-';
    const commercialNom = commerciaux?.find(c => c.id === fiche.id_commercial)?.pseudo || fiche.commercial_pseudo || '-';
    const confirmateurNom = confirmateurs?.find(c => c.id === fiche.id_confirmateur)?.pseudo || fiche.confirmateur_pseudo || '-';
    
    // Estimer la hauteur nécessaire
    doc.setFontSize(contentFontSize);
    const estimateTextHeight = (text) => {
      const lines = doc.splitTextToSize(String(text || ''), maxWidth);
      return lines.length * lineHeight;
    };
    
    let estimatedHeight = 0;
    estimatedHeight += titleFontSize + sectionSpacing; // Informations personnelles
    estimatedHeight += estimateTextHeight(`Civilité: ${fiche.civ || '-'}`);
    estimatedHeight += estimateTextHeight(`Nom: ${fiche.nom || '-'}`);
    estimatedHeight += estimateTextHeight(`Prénom: ${fiche.prenom || '-'}`);
    estimatedHeight += estimateTextHeight(`Téléphone: ${fiche.tel || '-'}`);
    estimatedHeight += estimateTextHeight(`GSM1: ${fiche.gsm1 || '-'}`);
    estimatedHeight += estimateTextHeight(`GSM2: ${fiche.gsm2 || '-'}`);
    estimatedHeight += estimateTextHeight(`Adresse: ${fiche.adresse || '-'}`);
    estimatedHeight += estimateTextHeight(`CP: ${fiche.cp || '-'} | Ville: ${fiche.ville || '-'}`);
    estimatedHeight += estimateTextHeight(`Situation: ${fiche.situation_conjugale || '-'}`);
    estimatedHeight += sectionSpacing;
    
    estimatedHeight += titleFontSize + sectionSpacing; // Informations professionnelles
    estimatedHeight += estimateTextHeight(`Prof. Mr: ${professionMr} | Contrat: ${typeContratMr}`);
    estimatedHeight += estimateTextHeight(`Prof. Mme: ${professionMme} | Contrat: ${typeContratMme}`);
    estimatedHeight += estimateTextHeight(`Âge Mr: ${fiche.age_mr || '-'} | Âge Mme: ${fiche.age_madame || '-'}`);
    estimatedHeight += estimateTextHeight(`Revenu: ${fiche.revenu_foyer || '-'} | Crédit: ${fiche.credit_foyer || '-'}`);
    estimatedHeight += estimateTextHeight(`Enfants: ${fiche.nb_enfants || '-'}`);
    estimatedHeight += sectionSpacing;
    
    estimatedHeight += titleFontSize + sectionSpacing; // Informations logement
    estimatedHeight += estimateTextHeight(`Propriétaire: ${fiche.proprietaire_maison || '-'}`);
    estimatedHeight += estimateTextHeight(`Surface habitable: ${fiche.surface_habitable || '-'} m² | Surface chauffée: ${fiche.surface_chauffee || '-'} m²`);
    estimatedHeight += estimateTextHeight(`Année système: ${fiche.annee_systeme_chauffage || '-'}`);
    estimatedHeight += estimateTextHeight(`Mode chauffage: ${modeChauffageNom}`);
    estimatedHeight += estimateTextHeight(`Conso. chauffage: ${fiche.consommation_chauffage || '-'} | Conso. élec: ${fiche.consommation_electricite || '-'}`);
    if (fiche.produit === 2) {
      estimatedHeight += estimateTextHeight(`Pans: ${fiche.nb_pans || '-'}`);
    } else {
      estimatedHeight += estimateTextHeight(`Pièces: ${fiche.nb_pieces || '-'}`);
    }
    estimatedHeight += sectionSpacing;
    
    estimatedHeight += titleFontSize + sectionSpacing; // Informations produit
    estimatedHeight += estimateTextHeight(`Produit: ${produitNom} | Étude: ${fiche.etude || '-'}`);
    if (fiche.produit === 2) {
      estimatedHeight += estimateTextHeight(`Orientation: ${fiche.orientation_toiture || '-'} | Site classé: ${fiche.site_classe || '-'} | Ombres: ${fiche.zones_ombres || '-'}`);
    }
    estimatedHeight += sectionSpacing;
    
    estimatedHeight += titleFontSize + sectionSpacing; // Rendez-vous
    if (fiche.date_rdv_time) {
      const dateRdv = formatRdvDateTime(fiche.date_rdv_time);
      estimatedHeight += estimateTextHeight(`Date RDV: ${dateRdv}`);
    } else {
      estimatedHeight += estimateTextHeight(`Date RDV: -`);
    }
    estimatedHeight += estimateTextHeight(`RDV Urgent: ${(fiche.rdv_urgent === 1 || fiche.rdv_urgent === true || fiche.qualification_code === 'RDV_URGENT') ? 'OUI' : 'NON'}`);
    estimatedHeight += sectionSpacing;
    
    estimatedHeight += titleFontSize + sectionSpacing; // Assignation
    estimatedHeight += estimateTextHeight(`Centre: ${centreNom} | Agent: ${agentNom}`);
    if (commercialNom !== '-') {
      estimatedHeight += estimateTextHeight(`Commercial: ${commercialNom}`);
    }
    if (confirmateurNom !== '-') {
      estimatedHeight += estimateTextHeight(`Confirmateur: ${confirmateurNom}`);
    }
    estimatedHeight += sectionSpacing;
    
    if (fiche.commentaire) {
      estimatedHeight += titleFontSize + sectionSpacing;
      const commentLines = doc.splitTextToSize(fiche.commentaire, maxWidth);
      estimatedHeight += Math.min(commentLines.length * lineHeight, availableHeight - estimatedHeight - 10);
    }
    
    if (fiche.date_appel_time || fiche.date_appel) {
      estimatedHeight += titleFontSize + sectionSpacing;
      estimatedHeight += lineHeight;
    }
    
    // Ajuster les tailles si nécessaire
    let scaleFactor = 1;
    if (estimatedHeight > availableHeight) {
      scaleFactor = availableHeight / estimatedHeight;
      // Ajuster les tailles proportionnellement
      const adjustedTitleFontSize = Math.max(7, titleFontSize * scaleFactor);
      const adjustedContentFontSize = Math.max(6, contentFontSize * scaleFactor);
      const adjustedLineHeight = Math.max(2.8, lineHeight * scaleFactor);
      
      // Utiliser les valeurs ajustées
      const finalTitleFontSize = adjustedTitleFontSize;
      const finalContentFontSize = adjustedContentFontSize;
      const finalLineHeight = adjustedLineHeight;
      
      // Fonction helper pour ajouter du texte
      const addText = (text, x, y, options = {}) => {
        const { fontSize = finalContentFontSize, fontStyle = 'normal', color = [0, 0, 0], maxWidth: textMaxWidth = maxWidth } = options;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontStyle);
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(String(text || ''), textMaxWidth);
        doc.text(lines, x, y);
        return lines.length * finalLineHeight;
      };
      
      let yPos = headerHeight + 5;
      
      // En-tête
      doc.setFillColor(52, 152, 219);
      doc.rect(0, 0, pageWidth, headerHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('FICHE CLIENT', pageWidth / 2, headerHeight / 2 + 3, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      
      // Informations personnelles
      doc.setFontSize(finalTitleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMATIONS PERSONNELLES', margin, yPos);
      yPos += finalLineHeight + 1;
      yPos += addText(`Civilité: ${fiche.civ || '-'}`, margin, yPos);
      yPos += addText(`Nom: ${fiche.nom || '-'}`, margin, yPos);
      yPos += addText(`Prénom: ${fiche.prenom || '-'}`, margin, yPos);
      yPos += addText(`Téléphone: ${fiche.tel || '-'}`, margin, yPos);
      yPos += addText(`GSM1: ${fiche.gsm1 || '-'}`, margin, yPos);
      yPos += addText(`GSM2: ${fiche.gsm2 || '-'}`, margin, yPos);
      yPos += addText(`Adresse: ${fiche.adresse || '-'}`, margin, yPos);
      yPos += addText(`CP: ${fiche.cp || '-'} | Ville: ${fiche.ville || '-'}`, margin, yPos);
      yPos += addText(`Situation: ${fiche.situation_conjugale || '-'}`, margin, yPos);
      yPos += sectionSpacing;
      
      // Informations professionnelles
      doc.setFontSize(finalTitleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMATIONS PROFESSIONNELLES', margin, yPos);
      yPos += finalLineHeight + 1;
      yPos += addText(`Prof. Mr: ${professionMr} | Contrat: ${typeContratMr}`, margin, yPos);
      yPos += addText(`Prof. Mme: ${professionMme} | Contrat: ${typeContratMme}`, margin, yPos);
      yPos += addText(`Âge Mr: ${fiche.age_mr || '-'} | Âge Mme: ${fiche.age_madame || '-'}`, margin, yPos);
      yPos += addText(`Revenu: ${fiche.revenu_foyer || '-'} | Crédit: ${fiche.credit_foyer || '-'}`, margin, yPos);
      yPos += addText(`Enfants: ${fiche.nb_enfants || '-'}`, margin, yPos);
      yPos += sectionSpacing;
      
      // Informations logement
      doc.setFontSize(finalTitleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMATIONS LOGEMENT', margin, yPos);
      yPos += finalLineHeight + 1;
      yPos += addText(`Propriétaire: ${fiche.proprietaire_maison || '-'}`, margin, yPos);
      yPos += addText(`Surface habitable: ${fiche.surface_habitable || '-'} m² | Surface chauffée: ${fiche.surface_chauffee || '-'} m²`, margin, yPos);
      yPos += addText(`Année système: ${fiche.annee_systeme_chauffage || '-'}`, margin, yPos);
      yPos += addText(`Mode chauffage: ${modeChauffageNom}`, margin, yPos);
      yPos += addText(`Conso. chauffage: ${fiche.consommation_chauffage || '-'} | Conso. élec: ${fiche.consommation_electricite || '-'}`, margin, yPos);
      if (fiche.produit === 2) {
        yPos += addText(`Pans: ${fiche.nb_pans || '-'}`, margin, yPos);
      } else {
        yPos += addText(`Pièces: ${fiche.nb_pieces || '-'}`, margin, yPos);
      }
      yPos += sectionSpacing;
      
      // Informations produit
      doc.setFontSize(finalTitleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMATIONS PRODUIT', margin, yPos);
      yPos += finalLineHeight + 1;
      yPos += addText(`Produit: ${produitNom} | Étude: ${fiche.etude || '-'}`, margin, yPos);
      if (fiche.produit === 2) {
        yPos += addText(`Orientation: ${fiche.orientation_toiture || '-'} | Site classé: ${fiche.site_classe || '-'} | Ombres: ${fiche.zones_ombres || '-'}`, margin, yPos);
      }
      yPos += sectionSpacing;
      
      // Rendez-vous
      doc.setFontSize(finalTitleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('RENDEZ-VOUS', margin, yPos);
      yPos += finalLineHeight + 1;
      if (fiche.date_rdv_time) {
        const dateRdv = formatRdvDateTime(fiche.date_rdv_time);
        yPos += addText(`Date RDV: ${dateRdv}`, margin, yPos);
      } else {
        yPos += addText(`Date RDV: -`, margin, yPos);
      }
      const rdvUrgent = (fiche.rdv_urgent === 1 || fiche.rdv_urgent === true || fiche.qualification_code === 'RDV_URGENT') ? 'OUI' : 'NON';
      yPos += addText(`RDV Urgent: ${rdvUrgent}`, margin, yPos);
      yPos += sectionSpacing;
      
      // Assignation
      doc.setFontSize(finalTitleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('ASSIGNATION', margin, yPos);
      yPos += finalLineHeight + 1;
      yPos += addText(`Centre: ${centreNom} | Agent: ${agentNom}`, margin, yPos);
      if (commercialNom !== '-') {
        yPos += addText(`Commercial: ${commercialNom}`, margin, yPos);
      }
      if (confirmateurNom !== '-') {
        yPos += addText(`Confirmateur: ${confirmateurNom}`, margin, yPos);
      }
      yPos += sectionSpacing;
      
      // Commentaire (limité si nécessaire)
      if (fiche.commentaire) {
        doc.setFontSize(finalTitleFontSize);
        doc.setFont('helvetica', 'bold');
        doc.text('COMMENTAIRE', margin, yPos);
        yPos += finalLineHeight + 1;
        const remainingSpace = pageHeight - yPos - footerHeight;
        const maxCommentLines = Math.floor(remainingSpace / finalLineHeight);
        const commentLines = doc.splitTextToSize(fiche.commentaire, maxWidth);
        const linesToShow = commentLines.slice(0, maxCommentLines);
        doc.setFontSize(finalContentFontSize);
        doc.setFont('helvetica', 'normal');
        doc.text(linesToShow, margin, yPos);
        yPos += linesToShow.length * finalLineHeight;
      }
      
      // Date d'appel
      if (fiche.date_appel_time || fiche.date_appel) {
        doc.setFontSize(finalTitleFontSize);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORMATIONS D\'APPEL', margin, yPos);
        yPos += finalLineHeight + 1;
        const dateAppel = fiche.date_appel_time 
          ? new Date(fiche.date_appel_time).toLocaleString('fr-FR')
          : (fiche.date_appel ? new Date(fiche.date_appel * 1000).toLocaleString('fr-FR') : '-');
        yPos += addText(`Date & Heure d'appel: ${dateAppel}`, margin, yPos);
      }
    } else {
      // Version normale si tout tient sur une page
      const finalTitleFontSize = titleFontSize;
      const finalContentFontSize = contentFontSize;
      const finalLineHeight = lineHeight;
      
      const addText = (text, x, y, options = {}) => {
        const { fontSize = finalContentFontSize, fontStyle = 'normal', color = [0, 0, 0], maxWidth: textMaxWidth = maxWidth } = options;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontStyle);
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(String(text || ''), textMaxWidth);
        doc.text(lines, x, y);
        return lines.length * finalLineHeight;
      };
      
      let yPos = headerHeight + 5;
      
      // En-tête
      doc.setFillColor(52, 152, 219);
      doc.rect(0, 0, pageWidth, headerHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('FICHE CLIENT', pageWidth / 2, headerHeight / 2 + 3, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      
      // Informations personnelles
      doc.setFontSize(finalTitleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMATIONS PERSONNELLES', margin, yPos);
      yPos += finalLineHeight + 1;
      yPos += addText(`Civilité: ${fiche.civ || '-'}`, margin, yPos);
      yPos += addText(`Nom: ${fiche.nom || '-'}`, margin, yPos);
      yPos += addText(`Prénom: ${fiche.prenom || '-'}`, margin, yPos);
      yPos += addText(`Téléphone: ${fiche.tel || '-'}`, margin, yPos);
      yPos += addText(`GSM1: ${fiche.gsm1 || '-'}`, margin, yPos);
      yPos += addText(`GSM2: ${fiche.gsm2 || '-'}`, margin, yPos);
      yPos += addText(`Adresse: ${fiche.adresse || '-'}`, margin, yPos);
      yPos += addText(`CP: ${fiche.cp || '-'} | Ville: ${fiche.ville || '-'}`, margin, yPos);
      yPos += addText(`Situation: ${fiche.situation_conjugale || '-'}`, margin, yPos);
      yPos += sectionSpacing;
      
      // Informations professionnelles
      doc.setFontSize(finalTitleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMATIONS PROFESSIONNELLES', margin, yPos);
      yPos += finalLineHeight + 1;
      yPos += addText(`Prof. Mr: ${professionMr} | Contrat: ${typeContratMr}`, margin, yPos);
      yPos += addText(`Prof. Mme: ${professionMme} | Contrat: ${typeContratMme}`, margin, yPos);
      yPos += addText(`Âge Mr: ${fiche.age_mr || '-'} | Âge Mme: ${fiche.age_madame || '-'}`, margin, yPos);
      yPos += addText(`Revenu: ${fiche.revenu_foyer || '-'} | Crédit: ${fiche.credit_foyer || '-'}`, margin, yPos);
      yPos += addText(`Enfants: ${fiche.nb_enfants || '-'}`, margin, yPos);
      yPos += sectionSpacing;
      
      // Informations logement
      doc.setFontSize(finalTitleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMATIONS LOGEMENT', margin, yPos);
      yPos += finalLineHeight + 1;
      yPos += addText(`Propriétaire: ${fiche.proprietaire_maison || '-'}`, margin, yPos);
      yPos += addText(`Surface habitable: ${fiche.surface_habitable || '-'} m² | Surface chauffée: ${fiche.surface_chauffee || '-'} m²`, margin, yPos);
      yPos += addText(`Année système: ${fiche.annee_systeme_chauffage || '-'}`, margin, yPos);
      yPos += addText(`Mode chauffage: ${modeChauffageNom}`, margin, yPos);
      yPos += addText(`Conso. chauffage: ${fiche.consommation_chauffage || '-'} | Conso. élec: ${fiche.consommation_electricite || '-'}`, margin, yPos);
      if (fiche.produit === 2) {
        yPos += addText(`Pans: ${fiche.nb_pans || '-'}`, margin, yPos);
      } else {
        yPos += addText(`Pièces: ${fiche.nb_pieces || '-'}`, margin, yPos);
      }
      yPos += sectionSpacing;
      
      // Informations produit
      doc.setFontSize(finalTitleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMATIONS PRODUIT', margin, yPos);
      yPos += finalLineHeight + 1;
      yPos += addText(`Produit: ${produitNom} | Étude: ${fiche.etude || '-'}`, margin, yPos);
      if (fiche.produit === 2) {
        yPos += addText(`Orientation: ${fiche.orientation_toiture || '-'} | Site classé: ${fiche.site_classe || '-'} | Ombres: ${fiche.zones_ombres || '-'}`, margin, yPos);
      }
      yPos += sectionSpacing;
      
      // Rendez-vous
      doc.setFontSize(finalTitleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('RENDEZ-VOUS', margin, yPos);
      yPos += finalLineHeight + 1;
      if (fiche.date_rdv_time) {
        const dateRdv = formatRdvDateTime(fiche.date_rdv_time);
        yPos += addText(`Date RDV: ${dateRdv}`, margin, yPos);
      } else {
        yPos += addText(`Date RDV: -`, margin, yPos);
      }
      const rdvUrgent = (fiche.rdv_urgent === 1 || fiche.rdv_urgent === true || fiche.qualification_code === 'RDV_URGENT') ? 'OUI' : 'NON';
      yPos += addText(`RDV Urgent: ${rdvUrgent}`, margin, yPos);
      yPos += sectionSpacing;
      
      // Assignation
      doc.setFontSize(finalTitleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text('ASSIGNATION', margin, yPos);
      yPos += finalLineHeight + 1;
      yPos += addText(`Centre: ${centreNom} | Agent: ${agentNom}`, margin, yPos);
      if (commercialNom !== '-') {
        yPos += addText(`Commercial: ${commercialNom}`, margin, yPos);
      }
      if (confirmateurNom !== '-') {
        yPos += addText(`Confirmateur: ${confirmateurNom}`, margin, yPos);
      }
      yPos += sectionSpacing;
      
      // Commentaire (limité si nécessaire)
      if (fiche.commentaire) {
        doc.setFontSize(finalTitleFontSize);
        doc.setFont('helvetica', 'bold');
        doc.text('COMMENTAIRE', margin, yPos);
        yPos += finalLineHeight + 1;
        const remainingSpace = pageHeight - yPos - footerHeight;
        const maxCommentLines = Math.floor(remainingSpace / finalLineHeight);
        const commentLines = doc.splitTextToSize(fiche.commentaire, maxWidth);
        const linesToShow = commentLines.slice(0, maxCommentLines);
        doc.setFontSize(finalContentFontSize);
        doc.setFont('helvetica', 'normal');
        doc.text(linesToShow, margin, yPos);
        yPos += linesToShow.length * finalLineHeight;
      }
      
      // Date d'appel
      if (fiche.date_appel_time || fiche.date_appel) {
        doc.setFontSize(finalTitleFontSize);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORMATIONS D\'APPEL', margin, yPos);
        yPos += finalLineHeight + 1;
        const dateAppel = fiche.date_appel_time 
          ? new Date(fiche.date_appel_time).toLocaleString('fr-FR')
          : (fiche.date_appel ? new Date(fiche.date_appel * 1000).toLocaleString('fr-FR') : '-');
        yPos += addText(`Date & Heure d'appel: ${dateAppel}`, margin, yPos);
      }
    }

    // Pied de page
    doc.setFontSize(6);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Généré le ${new Date().toLocaleDateString('fr-FR')}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );

    // Télécharger le PDF
    const fileName = `Fiche_${fiche.nom || 'Client'}_${fiche.prenom || ''}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  return (
    <div 
      className="fiche-detail"
      style={{
        border: `8px solid ${etatColor}`,
        borderRadius: '8px',
        padding: '20px',
        backgroundColor: '#fff'
      }}
    >
      <div className="fiche-detail-header">
        <div className="fiche-detail-header-title">
          <div className="fiche-type-badge" style={{ 
            backgroundColor: fiche.produit_color || (fiche.produit === 1 ? '#66D5D4' : '#FFE441'),
            color: fiche.produit === 1 ? 'white' : 'black'
          }}>
            {fiche.produit_nom || (fiche.produit === 1 ? 'PAC' : 'PV')}
          </div>
          <h1>
            <FaInfoCircle /> Détails de la fiche
            {isR2 && <span style={{ 
              marginLeft: '10px', 
              fontSize: '0.7em', 
              fontWeight: 'normal',
              color: '#e74c3c',
              backgroundColor: '#fff',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid #e74c3c'
            }}>R2</span>}
          </h1>
        </div>
        <div className="fiche-detail-etat-actuel">
          <span className="fiche-detail-etat-label">État actuel :</span>
          <span
            className="fiche-detail-etat-value"
            style={{ color: etatActuelHeaderColor }}
          >
            {etatActuelHeaderTitre
              ? `${etatActuelHeaderTitre}${etatActuelHeaderSous ? ` · ${etatActuelHeaderSous}` : ''}`
              : '—'}
          </span>
        </div>
      </div>

      {/* Onglets */}
      <div className="fiche-tabs">
        <button
          className={`fiche-tab ${activeTab === 'fiches' ? 'active' : ''}`}
          onClick={() => setActiveTab('fiches')}
        >
          <FaFileAlt /> Fiches
        </button>
        {/* Désactiver l'onglet Modifica pour les commerciaux */}
        {!isCommercial && (
          <button
            className={`fiche-tab ${activeTab === 'modifica' ? 'active' : ''}`}
            onClick={() => setActiveTab('modifica')}
          >
            <FaListAlt /> Modifica
          </button>
        )}
        {/* Onglet Affectation : visible par administrateur, backoffice, RE confirmation, RP confirmation */}
        {showAffectationTab && (
          <button
            className={`fiche-tab ${activeTab === 'affectation' ? 'active' : ''}`}
            onClick={() => setActiveTab('affectation')}
          >
            <FaUserPlus /> {commercialAffecteNom ? `${commercialAffecteNom} | ` : ''}Affectation
          </button>
        )}
        {/* Masquer les onglets Planning et SMS pour les utilisateurs qualité qualification (fonction 2, 8, 12) et commerciaux */}
        {!isQualiteQualif && !isCommercial && (
          <>
            <button
              className={`fiche-tab ${activeTab === 'planning' ? 'active' : ''}`}
              onClick={() => setActiveTab('planning')}
            >
              <FaCalendar /> Planning
            </button>
            <button
              className={`fiche-tab ${activeTab === 'sms' ? 'active' : ''}`}
              onClick={() => setActiveTab('sms')}
            >
              <FaSms /> SMS
            </button>
          </>
        )}
        <button
          className={`fiche-tab ${activeTab === 'pdf' ? 'active' : ''}`}
          onClick={() => setActiveTab('pdf')}
        >
          <FaFilePdf /> PDF
        </button>
      </div>


      {/* Contenu des onglets */}
      {activeTab === 'fiches' && (
        <>
          {/* Détails de la fiche */}
          <div className="fiche-sections">
        {ETATS_AVEC_COMMENTAIRE_MOTIF.includes(Number(fiche.id_etat_final)) && (
          <div className="fiche-section">
            <h2 className="section-title">Commentaire sur l&apos;état</h2>
            <table className="fiche-details-table">
              <tbody>
                {renderField('Commentaire', 'motif_qualif', fiche.motif_qualif || '-', 'textarea')}
              </tbody>
            </table>
          </div>
        )}
        {/* Section Données personnelles */}
        <div className="fiche-section">
          <h2 className="section-title">Données personnelles</h2>
          <table className="fiche-details-table">
            <tbody>
              {renderField('Civilité', 'civ', fiche.civ, 'select', [
                { value: 'MR', label: 'MR' },
                { value: 'MME', label: 'MME' }
              ])}
              {renderField('Nom', 'nom', fiche.nom)}
              {renderField('Prénom', 'prenom', fiche.prenom)}
              {renderField('Téléphone', 'tel', fiche.tel, 'tel')}
              {renderField('GSM1', 'gsm1', fiche.gsm1, 'tel')}
              {renderField('GSM2', 'gsm2', fiche.gsm2, 'tel')}
              {renderField('Adresse', 'adresse', fiche.adresse, 'textarea')}
              {renderField('Code postal', 'cp', fiche.cp)}
              {renderField('Ville', 'ville', fiche.ville)}
            </tbody>
          </table>
        </div>

        {/* Section étude : titre = VALIDE par pseudo agent qualité (id_qualite) */}
        <div className="fiche-section">
          <h2 className="section-title">
            {fiche.id_qualite && (fiche.qualite_pseudo || '').trim()
              ? `VALIDE par ${String(fiche.qualite_pseudo).trim()}`
              : fiche.id_qualite
                ? "VALIDE par —"
                : "Détails de l'étude"}
          </h2>
          <table className="fiche-details-table">
            <tbody>
              {renderField('Étude à faire pour', 'produit',
                (fiche.conf_produit != null && fiche.conf_produit !== '')
                  ? (fiche.conf_produit === 1 || fiche.conf_produit === '1' ? 'PAC' : fiche.conf_produit === 2 || fiche.conf_produit === '2' ? 'PV' : String(fiche.conf_produit))
                  : (fiche.produit_nom || (fiche.produit === 1 ? 'PAC' : fiche.produit === 2 ? 'PV' : '-')),
                'select', [
                  { id: 1, nom: 'PAC' },
                  { id: 2, nom: 'PV' }
                ])}
              {/* Commentaire agent qualification : visible uniquement pour Backoffice (fonction 11) */}
              {Number(user?.fonction) === 11 &&
                renderField('Commentaire (Agent Qualification)', 'commentaire', fiche.commentaire || '-', 'textarea')}
              
              {/* Session confirmateur: si commentaire_qualite est vide -> conf_commentaire_produit, sinon -> commentaire.
                  Autres sessions: logique historique (état 7 => conf_commentaire_produit, sinon commentaire_qualite). */}
              {Number(user?.fonction) === 6 ? (
                renderField(
                  'Commentaire',
                  'commentaire',
                  (!(fiche.commentaire_qualite || '').trim() ? fiche.conf_commentaire_produit : fiche.commentaire) || '-',
                  'textarea'
                )
              ) : fiche.id_etat_final === 7 ? (
                renderField('Commentaire', 'conf_commentaire_produit', fiche.conf_commentaire_produit || '-', 'textarea')
              ) : (
                renderField('Commentaire', 'commentaire_qualite', fiche.commentaire_qualite || '-', 'textarea')
              )}
              {renderField('A déjà fait une étude', 'etude', fiche.etude || 'NON', 'select', [
                { value: 'OUI', label: 'Oui' },
                { value: 'NON', label: 'Non' }
              ])}
              {renderField('Détail de l\'étude', 'etude_raison', fiche.etude_raison || '-', 'textarea')}
              {renderField('Mode de chauffage', 'mode_chauffage',
                (() => {
                  const id = fiche.conf_mode_chauffage ?? fiche.mode_chauffage;
                  const m = modeChauffage?.find(x => x.id == id);
                  return m?.nom || m?.titre || '-';
                })(),
                'select', modeChauffage)}
              {renderField('Complément de chauffage (qualification)', 'complement_chauffage', fiche.complement_chauffage || '-', 'text')}
              {renderField('Complément de chauffage (confirmation)', 'conf_complement_chauffage', fiche.conf_complement_chauffage || '-', 'text')}
              {renderField('Année de système de chauffage', 'annee_systeme_chauffage', fiche.annee_systeme_chauffage || '-', 'number')}
              {renderField('Surface habitable', 'surface_habitable', fiche.surface_habitable || '-', 'number')}
              {renderField('Consommation chauffage', 'consommation_chauffage',
                (fiche.conf_consommations != null && fiche.conf_consommations !== '') ? String(fiche.conf_consommations) : (fiche.consommation_chauffage || '-'))}
              {renderField('Surface chauffée en M²', 'surface_chauffee', fiche.surface_chauffee || '-', 'number')}
              {fiche.surface_chauffee && (fiche.conf_consommations != null && fiche.conf_consommations !== '' ? fiche.conf_consommations : fiche.consommation_chauffage) && parseFloat(fiche.surface_chauffee) > 0 && parseFloat(String(fiche.conf_consommations != null && fiche.conf_consommations !== '' ? fiche.conf_consommations : fiche.consommation_chauffage).replace(/[^\d.,]/g, '').replace(',', '.')) > 0 ? (
                renderField('Consommation en M²', 'conso',
                  (parseFloat(String(fiche.conf_consommations != null && fiche.conf_consommations !== '' ? fiche.conf_consommations : fiche.consommation_chauffage).replace(/[^\d.,]/g, '').replace(',', '.')) / parseFloat(fiche.surface_chauffee)).toFixed(2) + ' €/m²',
                  'text')
              ) : (
                renderField('Consommation en M²', 'conso', '-', 'text')
              )}
              {renderField('Isolation', 'isolation', fiche.isolation || '-')}
              {renderField('Propriétaire de la maison', 'proprietaire_maison', fiche.proprietaire_maison || '-', 'select', [
                { value: 'MR', label: 'Mr' },
                { value: 'MME', label: 'Mme' },
                { value: 'LES DEUX', label: 'LES DEUX' }
              ])}
              {renderField('Nombre de pièces', 'nb_pieces', fiche.nb_pieces || '-', 'number')}
              {renderField('Nombre de pans', 'nb_pans', fiche.nb_pans || '-', 'number')}
              {renderField('Orientation de la toiture', 'orientation_toiture',
                (fiche.conf_orientation_toiture != null && String(fiche.conf_orientation_toiture).trim() !== '') ? fiche.conf_orientation_toiture : (fiche.orientation_toiture || '-'), 'text')}
              {renderField('Zones d\'ombres', 'zones_ombres',
                (fiche.conf_zones_ombres != null && String(fiche.conf_zones_ombres).trim() !== '') ? fiche.conf_zones_ombres : (fiche.zones_ombres || '-')
              )}
              {renderField('Proche d\'un site classé', 'site_classe', fiche.site_classe || fiche.conf_site_classe || '-', 'text')}
              {renderField('Âge du MR', 'age_mr', fiche.age_mr || '-', 'number')}
              {renderField('Âge du Madame', 'age_madame', fiche.age_madame || '-', 'number')}
              {renderField('Consommation électricité', 'consommation_electricite',
                (fiche.conf_consommation_electricite != null && String(fiche.conf_consommation_electricite).trim() !== '') ? fiche.conf_consommation_electricite : (fiche.consommation_electricite || '-')
              )}
              {renderField('Revenu du foyer', 'revenu_foyer', fiche.revenu_foyer || '-', 'number')}
              {renderField('Crédit du foyer', 'credit_foyer', fiche.credit_foyer || '-', 'number')}
              {renderField('Situation Conjugale', 'situation_conjugale', fiche.situation_conjugale || '-', 'select', [
                { value: 'MARIE', label: 'Marié' },
                { value: 'CELIBATAIRE', label: 'Célibataire' },
                { value: 'CONCUBINAGE', label: 'Concubinage' },
                { value: 'VEUF/VEUVE', label: 'Veuf/Veuve' },
                { value: 'DIVORCE', label: 'Divorcé' },
                { value: 'PAXE', label: 'Pacsé' }
              ])}
              {renderField('Nombre d\'enfants en Charges', 'nb_enfants', fiche.nb_enfants || '-', 'number')}
              {renderField('Profession Du MR', 'profession_mr',
                (fiche.conf_profession_monsieur != null && String(fiche.conf_profession_monsieur).trim() !== '')
                  ? (professions?.find(p => p.id == fiche.conf_profession_monsieur || (p.nom && String(p.nom).toLowerCase() === String(fiche.conf_profession_monsieur).toLowerCase()))?.nom || fiche.conf_profession_monsieur)
                  : (professions?.find(p => p.id == fiche.profession_mr)?.nom || fiche.profession_mr || '-'),
                'select', professions)}
              {renderField('Type de Contrat MR', 'type_contrat_mr',
                (fiche.conf_type_contrat_mr != null && fiche.conf_type_contrat_mr !== '')
                  ? (typeContrat?.find(t => String(t.id) === String(fiche.conf_type_contrat_mr))?.nom || fiche.conf_type_contrat_mr || '-')
                  : (typeContrat?.find(t => String(t.id) === String(fiche.type_contrat_mr))?.nom || fiche.type_contrat_mr || '-'),
                'select', typeContrat)}
              {renderField('Profession Du Madame', 'profession_madame',
                (fiche.conf_profession_madame != null && String(fiche.conf_profession_madame).trim() !== '')
                  ? (professions?.find(p => p.id == fiche.conf_profession_madame || (p.nom && String(p.nom).toLowerCase() === String(fiche.conf_profession_madame).toLowerCase()))?.nom || fiche.conf_profession_madame)
                  : (professions?.find(p => p.id == fiche.profession_madame)?.nom || fiche.profession_madame || '-'),
                'select', professions)}
              {renderField('Type de Contrat MME', 'type_contrat_madame',
                (fiche.conf_type_contrat_madame != null && fiche.conf_type_contrat_madame !== '')
                  ? (typeContrat?.find(t => String(t.id) === String(fiche.conf_type_contrat_madame))?.nom || fiche.conf_type_contrat_madame || '-')
                  : (typeContrat?.find(t => String(t.id) === String(fiche.type_contrat_madame))?.nom || fiche.type_contrat_madame || '-'),
                'select', typeContrat)}
              {renderField('Date & Heure d\'appel', 'date_appel_time', 
                (() => {
                  const dAppel = parseFicheDateAppel(fiche);
                  if (!dAppel) return '-';
                  const absolute = fiche.date_appel_time
                    ? dAppel.toLocaleString('fr-FR')
                    : fiche.date_appel_date
                      ? dAppel.toLocaleDateString('fr-FR')
                      : dAppel.toLocaleString('fr-FR');
                  return `${absolute} — ${formatDateAppelRelativeDescription(dAppel)}`;
                })(),
                null, null, true)}
              {renderField('Entretien en tunisie avec', 'conf_rdv_avec', fiche.conf_rdv_avec || fiche.rdv_avec || '-', 'select', [
                { value: 'MR', label: 'Mr' },
                { value: 'MME', label: 'Mme' }
              ])}
              {renderField('Centre', 'id_centre',
                centres?.find(c => c.id === fiche.id_centre)?.titre || fiche.centre_titre || '-',
                'select', centres)}
              {renderField('Présence du couple', 'rdv_seul',
                (() => {
                  const raw = (fiche.conf_presence_couple !== undefined && fiche.conf_presence_couple !== null && String(fiche.conf_presence_couple).trim() !== '')
                    ? String(fiche.conf_presence_couple).toUpperCase()
                    : (fiche.conf_rdv_avec || fiche.rdv_avec)
                      ? (fiche.conf_rdv_avec === 'SEUL' || fiche.rdv_avec === 'SEUL' ? 'NON' : 'OUI')
                      : null;
                  return raw || '-';
                })(),
                'select', [
                  { value: 'OUI', label: 'Oui (couple présent)' },
                  { value: 'NON', label: 'Non (RDV seul)' }
                ])}
            </tbody>
          </table>
        </div>

        {/* Formulaire de décalage de RDV */}
        {/* Conditions d'affichage selon l'ancienne application :
            - Pas pour fonction 6 (confirmateur)
            - Pas pour fonction 3 (agent)
            - Pas pour certains états finaux (13, 16, 38, 45, 44)
            - Pas si commercial (5) avec compte rendu existant
            - Doit avoir la permission decalage_create
            - Doit avoir une date de RDV */}
        {false && hasPermission('decalage_create') && 
         user.fonction !== 6 && 
         user.fonction !== 3 && 
         ficheData && !([13, 16, 38, 45, 44].includes(ficheData.id_etat_final)) &&
         ficheData.date_rdv_time && (
          <div className="fiche-section decalage-form" style={{ order: 9999 }}>
            <h2 className="section-title" style={{ 
              background: '#9cbfc8', 
              color: '#fff', 
              padding: '10px', 
              textAlign: 'center',
              marginBottom: '0',
              fontSize: '13.6px',
              fontWeight: 'bold'
            }}>
              Demande de décalage
            </h2>
            
            {/* Afficher les décalages existants pour cette fiche */}
            {decalagesData && decalagesData.length > 0 && (
              <div style={{ 
                border: '1px solid #e0e0e0', 
                borderTop: 'none', 
                padding: '15px',
                background: '#f9f9f9',
                marginBottom: '10px'
              }}>
                <h3 style={{ marginTop: '0', marginBottom: '10px', fontSize: '11.9px', fontWeight: 'bold' }}>
                  Demande de décalage ({decalagesData.length})
                </h3>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {decalagesData.map((decalage, index) => (
                    <div key={decalage.id || index} style={{ 
                      background: '#fff', 
                      padding: '10px', 
                      marginBottom: '8px', 
                      borderRadius: '4px',
                      border: '1px solid #ddd'
                    }}>
                      <div style={{ fontSize: '10.2px', color: '#666' }}>
                        <strong>Demande #{index + 1}</strong> - 
                        Créée le: {decalage.date_creation ? new Date(decalage.date_creation).toLocaleString('fr-FR') : 'N/A'}
                      </div>
                      <div style={{ fontSize: '10.2px', marginTop: '5px' }}>
                        <strong>Nouvelle date:</strong> {decalage.date_nouvelle ? formatRdvDateTime(decalage.date_nouvelle) : (decalage.date_prevu ? formatRdvDateTime(decalage.date_prevu) : 'N/A')}
                      </div>
                      {decalage.message && (
                        <div style={{ fontSize: '10.2px', marginTop: '5px', fontStyle: 'italic', color: '#555' }}>
                          "{decalage.message}"
                        </div>
                      )}
                      {decalage.etat_dec && (
                        <div style={{ fontSize: '10.2px', marginTop: '5px' }}>
                          <strong>État:</strong> {decalage.etat_dec}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '10px', fontSize: '10.2px', color: '#666', fontStyle: 'italic' }}>
                  Vous pouvez créer une nouvelle demande de décalage ci-dessous.
                </div>
              </div>
            )}
            
            <div style={{ 
              border: '1px solid #e0e0e0', 
              borderTop: 'none', 
              padding: '15px',
              background: '#fff'
            }}>
              <div className="form-group">
                <label htmlFor="select_minutes">Décalage de :</label>
                <select
                  id="select_minutes"
                  className="form-control"
                  value={decalageFormData.select_minutes}
                  onChange={(e) => {
                    const minutes = parseInt(e.target.value);
                    // Toujours utiliser la date de la fiche en priorité, sinon celle du formulaire
                    const dateRdvOriginale = ficheData?.date_rdv_time || decalageFormData.date_prevu || '';
                    
                    console.log('Décalage sélectionné:', {
                      minutes,
                      dateRdvOriginale,
                      ficheDataDateRdv: ficheData?.date_rdv_time,
                      decalageFormDataDatePrevu: decalageFormData.date_prevu,
                      selectValue: e.target.value
                    });
                    
                    if (minutes > 0 && dateRdvOriginale) {
                      try {
                        // Créer une nouvelle date à partir de la date RDV originale
                        const originalDate = new Date(dateRdvOriginale);
                        
                        // Vérifier que la date est valide
                        if (isNaN(originalDate.getTime())) {
                          console.error('Date RDV originale invalide:', dateRdvOriginale);
                          alert('Erreur : la date de rendez-vous originale est invalide.');
                          return;
                        }
                        
                        // Calculer la nouvelle date en ajoutant les minutes
                        const newDate = new Date(originalDate);
                        newDate.setMinutes(newDate.getMinutes() + minutes);
                        
                        console.log('Calcul de la nouvelle date:', {
                          originale: originalDate.toISOString(),
                          minutesAjoutees: minutes,
                          nouvelle: newDate.toISOString()
                        });
                        
                        // Formater la nouvelle date au format YYYY-MM-DD HH:MM:SS pour le backend
                        const year = newDate.getFullYear();
                        const month = String(newDate.getMonth() + 1).padStart(2, '0');
                        const day = String(newDate.getDate()).padStart(2, '0');
                        const hours = String(newDate.getHours()).padStart(2, '0');
                        const mins = String(newDate.getMinutes()).padStart(2, '0');
                        const secs = String(newDate.getSeconds()).padStart(2, '0');
                        const formattedNewDate = `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
                        
                        console.log('Nouvelle date formatée:', formattedNewDate);
                        
                        // Utiliser la forme fonctionnelle de setState pour garantir la cohérence
                        setDecalageFormData(prev => ({
                          ...prev,
                          select_minutes: e.target.value,
                          nouvelle_date: formattedNewDate,
                          date_prevu: dateRdvOriginale // Garder la date RDV originale
                        }));
                      } catch (error) {
                        console.error('Erreur lors du calcul de la nouvelle date:', error);
                        alert('Erreur lors du calcul de la nouvelle date. Veuillez réessayer.');
                      }
                    } else {
                      // Utiliser la forme fonctionnelle de setState pour garantir la cohérence
                      setDecalageFormData(prev => ({
                        ...prev,
                        select_minutes: e.target.value,
                        nouvelle_date: '',
                        date_prevu: dateRdvOriginale // Garder la date RDV originale
                      }));
                    }
                  }}
                >
                  <option value="0">SÉLECTIONNER</option>
                  <option value="10">10 MIN</option>
                  <option value="15">15 MIN</option>
                  <option value="20">20 MIN</option>
                  <option value="25">25 MIN</option>
                  <option value="30">30 MIN</option>
                  <option value="35">35 MIN</option>
                  <option value="40">40 MIN</option>
                  <option value="45">45 MIN</option>
                  <option value="50">50 MIN</option>
                  <option value="55">55 MIN</option>
                  <option value="60">1 HEURE</option>
                  <option value="75">1H15</option>
                  <option value="90">1H30</option>
                  <option value="105">1H45</option>
                  <option value="120">2 HEURES</option>
                </select>
              </div>

              {decalageFormData.nouvelle_date && (
                <div className="form-group" style={{ 
                  background: '#e8f5e9', 
                  padding: '10px', 
                  borderRadius: '4px',
                  marginBottom: '15px',
                  border: '2px solid #4caf50'
                }}>
                  <strong>📅 Nouvelle date/heure :</strong> 
                  <span style={{ 
                    display: 'block', 
                    marginTop: '5px', 
                    fontSize: '13.6px', 
                    fontWeight: 'bold',
                    color: '#2e7d32'
                  }}>
                    {(() => {
                      try {
                        const date = new Date(decalageFormData.nouvelle_date);
                        if (isNaN(date.getTime())) {
                          return decalageFormData.nouvelle_date;
                        }
                        return date.toLocaleString('fr-FR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                      } catch (error) {
                        return decalageFormData.nouvelle_date;
                      }
                    })()}
                  </span>
                  {ficheData?.date_rdv_time && (
                    <div style={{ 
                      marginTop: '8px', 
                      fontSize: '10.2px', 
                      color: '#666',
                      fontStyle: 'italic'
                    }}>
                      Date originale : {formatRdvDateTime(ficheData.date_rdv_time)}
                    </div>
                  )}
                </div>
              )}

              {/* Champ confirmateur */}
              {/* Pour commerciaux : afficher le confirmateur de la fiche (non modifiable) */}
              {user.fonction === 5 && (
                <div className="form-group">
                  <label htmlFor="id_confirmateur_dec">Confirmateur :</label>
                  {ficheData?.id_confirmateur ? (
                    <div style={{ 
                      background: '#f0f0f0', 
                      padding: '10px', 
                      borderRadius: '4px',
                      fontWeight: 'bold'
                    }}>
                      {confirmateurs?.find(c => c.id === ficheData.id_confirmateur)?.pseudo || `ID: ${ficheData.id_confirmateur}`}
                    </div>
                  ) : (
                    <div style={{ color: 'red', fontStyle: 'italic' }}>
                      Aucun confirmateur assigné à cette fiche. Veuillez assigner un confirmateur avant de créer un décalage.
                    </div>
                  )}
                </div>
              )}
              
              {/* Pour admins : liste déroulante pour sélectionner le confirmateur */}
              {([1, 2, 7].includes(user.fonction)) && (
                <div className="form-group">
                  <label htmlFor="id_confirmateur_dec">Confirmateur :</label>
                  <select
                    id="id_confirmateur_dec"
                    className="form-control"
                    value={decalageFormData.id_confirmateur || (fiche?.id_confirmateur ? String(fiche.id_confirmateur) : '')}
                    onChange={(e) => {
                      setDecalageFormData({...decalageFormData, id_confirmateur: e.target.value});
                    }}
                    required
                  >
                    <option value="">SÉLECTIONNER UN CONFIRMATEUR</option>
                    {confirmateurs?.map(conf => (
                      <option key={conf.id} value={conf.id}>
                        {conf.pseudo}
                      </option>
                    ))}
                  </select>
                  {!decalageFormData.id_confirmateur && !fiche?.id_confirmateur && (
                    <small style={{ color: '#666', fontStyle: 'italic' }}>
                      Sélectionnez un confirmateur depuis la liste
                    </small>
                  )}
                </div>
              )}
              
              {/* Pour confirmateurs : afficher leur propre ID (non modifiable) */}
              {user.fonction === 6 && (
                <div className="form-group">
                  <label htmlFor="id_confirmateur_dec">Confirmateur :</label>
                  <div style={{ 
                    background: '#f0f0f0', 
                    padding: '10px', 
                    borderRadius: '4px',
                    fontWeight: 'bold'
                  }}>
                    {user.pseudo || `ID: ${user.id}`}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="message_dec">Message du décalage :</label>
                <textarea
                  id="message_dec"
                  className="form-control"
                  rows="4"
                  value={decalageFormData.message}
                  onChange={(e) => {
                    setDecalageFormData({...decalageFormData, message: e.target.value});
                  }}
                  placeholder="Saisissez le message expliquant le décalage..."
                />
              </div>

              <div className="form-actions" style={{ textAlign: 'center', marginTop: '15px' }}>
                <button
                  className="btn-confirm"
                  onClick={handleDecalageSubmit}
                  disabled={decalageMutation.isLoading}
                  style={{
                    display: 'table',
                    width: 'max-content',
                    margin: '0 auto',
                    borderRadius: '7px',
                    fontWeight: 'bold',
                    padding: '10px 20px'
                  }}
                >
                  {decalageMutation.isLoading ? 'Envoi...' : 'Demande de décalage'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* État actuel et Historique */}
        {(fiche.id_etat_final || (fiche.historique && fiche.historique.length > 0)) && (
          <div className="fiche-section etat-current-history-section">
            {/* Fonction réutilisable pour afficher les détails selon l'état */}
            {(() => {
              const renderEtatDetails = (etatData) => {
                const etatId = etatData.id_etat;
                const confirmateursList = [
                  etatData.confirmateur_pseudo,
                  etatData.confirmateur_2_pseudo,
                  etatData.confirmateur_3_pseudo
                ].filter(Boolean).join(', ') || '-';
                const auteurChangementEtat =
                  etatData.histo_confirmateur_pseudo != null && String(etatData.histo_confirmateur_pseudo).trim() !== ''
                    ? String(etatData.histo_confirmateur_pseudo).trim()
                    : '';
                /** Libellé fixe « Confirmateur » ; la valeur = auteur du passage d'état (sinon repli liste assignés pour anciennes lignes). */
                const valeurConfirmateurAffichee =
                  auteurChangementEtat !== ''
                    ? auteurChangementEtat
                    : (confirmateursList !== '-' ? confirmateursList : '-');
                /** Confirmer, Honoré à suivre, Signer : afficher confirmateurs 1, 2 et 3 s'ils existent ; sinon repli sur l'auteur. */
                const ETATS_AVEC_CONF123 = [7, 9, 13, 16, 44, 45];
                const valeurConfirmateurEtatListe = ETATS_AVEC_CONF123.includes(Number(etatId))
                  ? (confirmateursList !== '-' ? confirmateursList : valeurConfirmateurAffichee)
                  : valeurConfirmateurAffichee;
                const hasAnyConfirmateurAssigne =
                  !!(etatData.confirmateur_pseudo || etatData.confirmateur_2_pseudo || etatData.confirmateur_3_pseudo);
                
                const items = [];
                
                // NRP (2)
                if (etatId === 2) {
                  if (etatData.sous_etat_titre) items.push({ label: 'Sous-état', value: etatData.sous_etat_titre });
                  if (etatData.confirmateur_pseudo || etatData.histo_confirmateur_pseudo) items.push({ label: 'Confirmateur', value: valeurConfirmateurAffichee });
                  // Afficher le commentaire commercial en priorité s'il existe
                  if (etatData.commentaire_commercial) {
                    items.push({ label: 'Commentaire commercial', value: etatData.commentaire_commercial, fullWidth: true });
                  } else if (etatData.conf_commentaire_produit) {
                    items.push({ label: 'Commentaire', value: etatData.conf_commentaire_produit, fullWidth: true });
                  }
                  if (etatData.date_rdv_time) items.push({ label: 'A rappeler le', value: formatRdvDateOnly(etatData.date_rdv_time) });
                  if (etatData.date_creation || etatData.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(etatData.date_creation || etatData.date_appel_time).toLocaleString('fr-FR') });
                }
                // RAPPEL POUR BUREAU (19)
                else if (etatId === 19) {
                  if (etatData.confirmateur_pseudo || etatData.histo_confirmateur_pseudo) items.push({ label: 'Confirmateur', value: valeurConfirmateurAffichee });
                  // Afficher le commentaire commercial en priorité s'il existe
                  if (etatData.commentaire_commercial) {
                    items.push({ label: 'Commentaire commercial', value: etatData.commentaire_commercial, fullWidth: true });
                  } else if (etatData.conf_commentaire_produit) {
                    items.push({ label: 'Commentaire', value: etatData.conf_commentaire_produit, fullWidth: true });
                  }
                  if (etatData.date_rdv_time) items.push({ label: 'A rappeler le', value: formatRdvDateTime(etatData.date_rdv_time) });
                  if (etatData.date_creation || etatData.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(etatData.date_creation || etatData.date_appel_time).toLocaleString('fr-FR') });
                }
                // ANNULER ET A REPROGRAMMER (8)
                else if (etatId === 8) {
                  if (etatData.confirmateur_pseudo || etatData.histo_confirmateur_pseudo) items.push({ label: 'Confirmateur', value: valeurConfirmateurAffichee });
                  // Afficher le commentaire commercial en priorité s'il existe
                  if (etatData.commentaire_commercial) {
                    items.push({ label: 'Commentaire commercial', value: etatData.commentaire_commercial, fullWidth: true });
                  } else if (etatData.conf_commentaire_produit) {
                    items.push({ label: 'Commentaire', value: etatData.conf_commentaire_produit, fullWidth: true });
                  }
                  if (etatData.date_rdv_time) items.push({ label: 'A rappeler le', value: formatRdvDateOnly(etatData.date_rdv_time) });
                  if (etatData.date_creation || etatData.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(etatData.date_creation || etatData.date_appel_time).toLocaleString('fr-FR') });
                }
                // CLIENT HONORE A SUIVRE (9)
                else if (etatId === 9) {
                  if (hasAnyConfirmateurAssigne || etatData.histo_confirmateur_pseudo) items.push({ label: 'Confirmateur', value: valeurConfirmateurEtatListe });
                  // Afficher le commentaire commercial en priorité s'il existe
                  if (etatData.commentaire_commercial) {
                    items.push({ label: 'Commentaire commercial', value: etatData.commentaire_commercial, fullWidth: true });
                  } else if (etatData.conf_commentaire_produit) {
                    items.push({ label: 'Commentaire', value: etatData.conf_commentaire_produit, fullWidth: true });
                  }
                  if (etatData.date_rdv_time) items.push({ label: 'A rappeler le', value: formatRdvDateOnly(etatData.date_rdv_time) });
                  if (etatData.date_creation || etatData.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(etatData.date_creation || etatData.date_appel_time).toLocaleString('fr-FR') });
                }
                // RDV ANNULER (11)
                else if (etatId === 11) {
                  if (etatData.confirmateur_pseudo || etatData.histo_confirmateur_pseudo) items.push({ label: 'Confirmateur', value: valeurConfirmateurAffichee });
                  // Afficher le commentaire commercial en priorité s'il existe
                  if (etatData.commentaire_commercial) {
                    items.push({ label: 'Commentaire commercial', value: etatData.commentaire_commercial, fullWidth: true });
                  } else if (etatData.conf_commentaire_produit) {
                    items.push({ label: 'Commentaire', value: etatData.conf_commentaire_produit, fullWidth: true });
                  }
                  if (etatData.conf_rdv_avec) items.push({ label: 'Appel avec qui', value: etatData.conf_rdv_avec });
                }
                // RDV ANNULER 2 FOIS (26)
                else if (etatId === 26) {
                  if (etatData.confirmateur_pseudo || etatData.histo_confirmateur_pseudo) items.push({ label: 'Confirmateur', value: valeurConfirmateurAffichee });
                  // Afficher le commentaire commercial en priorité s'il existe
                  if (etatData.commentaire_commercial) {
                    items.push({ label: 'Commentaire commercial', value: etatData.commentaire_commercial, fullWidth: true });
                  } else if (etatData.conf_commentaire_produit) {
                    items.push({ label: 'Commentaire', value: etatData.conf_commentaire_produit, fullWidth: true });
                  }
                  if (etatData.conf_rdv_avec) items.push({ label: 'Appel avec qui', value: etatData.conf_rdv_avec });
                }
                // REFUSER (12)
                else if (etatId === 12) {
                  if (etatData.confirmateur_pseudo || etatData.histo_confirmateur_pseudo) items.push({ label: 'Confirmateur', value: valeurConfirmateurAffichee });
                  // Afficher le commentaire commercial en priorité s'il existe
                  if (etatData.commentaire_commercial) {
                    items.push({ label: 'Commentaire commercial', value: etatData.commentaire_commercial, fullWidth: true });
                  } else if (etatData.conf_commentaire_produit) {
                    items.push({ label: 'Commentaire', value: etatData.conf_commentaire_produit, fullWidth: true });
                  }
                  if (etatData.date_creation || etatData.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(etatData.date_creation || etatData.date_appel_time).toLocaleString('fr-FR') });
                }
                // HHC FINANCEMENT A VERIFIER (34)
                else if (etatId === 34) {
                  if (etatData.confirmateur_pseudo || etatData.histo_confirmateur_pseudo) items.push({ label: 'Confirmateur', value: valeurConfirmateurAffichee });
                  // Afficher le commentaire commercial en priorité s'il existe
                  if (etatData.commentaire_commercial) {
                    items.push({ label: 'Commentaire commercial', value: etatData.commentaire_commercial, fullWidth: true });
                  } else if (etatData.conf_commentaire_produit) {
                    items.push({ label: 'Commentaire', value: etatData.conf_commentaire_produit, fullWidth: true });
                  }
                  if (etatData.date_creation || etatData.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(etatData.date_creation || etatData.date_appel_time).toLocaleString('fr-FR') });
                }
                // HCC TECHNIQUE (35)
                else if (etatId === 35) {
                  if (etatData.confirmateur_pseudo || etatData.histo_confirmateur_pseudo) items.push({ label: 'Confirmateur', value: valeurConfirmateurAffichee });
                  // Afficher le commentaire commercial en priorité s'il existe
                  if (etatData.commentaire_commercial) {
                    items.push({ label: 'Commentaire commercial', value: etatData.commentaire_commercial, fullWidth: true });
                  } else if (etatData.conf_commentaire_produit) {
                    items.push({ label: 'Commentaire', value: etatData.conf_commentaire_produit, fullWidth: true });
                  }
                  if (etatData.commercial_pseudo) items.push({ label: 'Commercial', value: etatData.commercial_pseudo });
                  if (etatData.date_creation || etatData.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(etatData.date_creation || etatData.date_appel_time).toLocaleString('fr-FR') });
                }
                // SIGNER, SIGNER RETRACTER, SIGNER COMPLET, SIGNER PM (13, 16, 45, 44) - Phase 3
                else if ([13, 16, 45, 44].includes(etatId)) {
                  if (etatData.sous_etat_titre) items.push({ label: 'SOUS ETAT', value: etatData.sous_etat_titre });
                  if (hasAnyConfirmateurAssigne || etatData.histo_confirmateur_pseudo) items.push({ label: 'Confirmateur', value: valeurConfirmateurEtatListe });
                  // Afficher le commentaire commercial s'il existe (après création d'un compte rendu approuvé)
                  if (etatData.commentaire_commercial) {
                    items.push({ label: 'Commentaire commercial', value: etatData.commentaire_commercial, fullWidth: true });
                  }
                  if (etatData.ph3_pac) {
                    const pacValue = etatData.ph3_pac === 'reau' || etatData.ph3_pac === 'R/EAU' ? 'R/EAU' : 
                                     etatData.ph3_pac === 'rr' || etatData.ph3_pac === 'R/R' ? 'R/R' : etatData.ph3_pac;
                    items.push({ label: 'PAC', value: pacValue });
                  }
                  if (etatData.ph3_attente) items.push({ label: 'Financement', value: etatData.ph3_attente });
                  if (etatData.ph3_type) items.push({ label: 'Type', value: etatData.ph3_type });
                  if (etatData.ph3_prix) items.push({ label: 'Prix', value: etatData.ph3_prix });
                  if (etatData.credit_immobilier) items.push({ label: 'Crédit immobilier', value: etatData.credit_immobilier });
                  if (etatData.credit_autre) items.push({ label: 'Autre crédit', value: etatData.credit_autre });
                  if (etatData.ph3_puissance) items.push({ label: 'Puissance', value: etatData.ph3_puissance });
                  if (etatData.ph3_ballon) {
                    const ballonValue = etatData.ph3_ballon === 'OUI' || etatData.ph3_ballon === 1 || etatData.ph3_ballon === '1' ? 'OUI' :
                                        etatData.ph3_ballon === 'NON' || etatData.ph3_ballon === 0 || etatData.ph3_ballon === '0' ? 'NON' : etatData.ph3_ballon;
                    items.push({ label: 'Ballon', value: ballonValue });
                  }
                  if (etatData.installeur_nom) items.push({ label: 'Installateur', value: etatData.installeur_nom });
                  if (etatData.ph3_consommation) items.push({ label: 'Consommation annuelle ancien système', value: etatData.ph3_consommation });
                  if (etatData.valeur_mensualite || etatData.ph3_mensualite) items.push({ label: 'Partie à financer du client', value: etatData.valeur_mensualite || etatData.ph3_mensualite });
                  if (etatData.ph3_bonus_30) items.push({ label: 'Bonus annoncé', value: etatData.ph3_bonus_30 });
                  if (etatData.ph3_mensualite) items.push({ label: 'Mensualité du crédit', value: etatData.ph3_mensualite });
                  if (etatData.ph3_nbr_annee_finance) items.push({ label: 'Nombre de mois du crédit', value: etatData.ph3_nbr_annee_finance });
                  if (etatData.ph3_alimentation) items.push({ label: 'Alimentation', value: etatData.ph3_alimentation });
                  if (etatData.date_sign_time) items.push({ label: 'DATE SIGNATURE', value: new Date(etatData.date_sign_time).toLocaleString('fr-FR') });
                }
                // CONFIRMER (7) — afficher tous les champs conf_ remplis (non null) ; si entrée CR : commentaire commercial uniquement
                else if (etatId === 7) {
                  if (hasAnyConfirmateurAssigne || etatData.histo_confirmateur_pseudo) items.push({ label: 'Confirmateur', value: valeurConfirmateurEtatListe });
                  if (etatData.from_compte_rendu && etatData.commentaire_commercial) {
                    items.push({ label: 'Commentaire commercial (compte rendu)', value: etatData.commentaire_commercial, fullWidth: true });
                  } else if (!etatData.from_compte_rendu && etatData.conf_commentaire_produit) {
                    items.push({ label: 'Commentaire confirmateur', value: etatData.conf_commentaire_produit, fullWidth: true });
                  }
                  if (etatData.date_rdv_time) items.push({ label: 'Date RDV', value: formatRdvDateTime(etatData.date_rdv_time) });
                  if (etatData.date_creation || etatData.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(etatData.date_creation || etatData.date_appel_time).toLocaleString('fr-FR') });
                  // Champs conf_ (affichés uniquement si non vides)
                  if (etatData.conf_rdv_avec) items.push({ label: 'RDV pris avec', value: etatData.conf_rdv_avec });
                  if (etatData.conf_appel_tunisie_avec) items.push({ label: 'Appel en Tunisie avec', value: etatData.conf_appel_tunisie_avec });
                  if (etatData.conf_deja_etude) items.push({ label: 'A déjà fait une étude', value: etatData.conf_deja_etude });
                  if (etatData.conf_rdv_annule_precedent) items.push({ label: 'RDV déjà annulé précédemment', value: etatData.conf_rdv_annule_precedent });
                  if (etatData.conf_presence_couple) items.push({ label: 'Présence du couple ou célibataire', value: etatData.conf_presence_couple });
                  const profMrId = etatData.conf_profession_monsieur ?? etatData.profession_mr;
                  if (profMrId != null && profMrId !== '') {
                    const professionMr = professions?.find(p => p.id == profMrId);
                    items.push({ label: 'Profession MR', value: professionMr ? professionMr.nom : String(profMrId) });
                  }
                  const typeContratMrId = etatData.conf_type_contrat_mr ?? etatData.type_contrat_mr;
                  if (typeContratMrId != null && typeContratMrId !== '') {
                    const typeContratMr = typeContrat?.find(t => String(t.id) === String(typeContratMrId));
                    items.push({ label: 'Type de contrat MR', value: typeContratMr ? typeContratMr.nom : String(typeContratMrId) });
                  }
                  const profMmeId = etatData.conf_profession_madame ?? etatData.profession_madame;
                  if (profMmeId != null && profMmeId !== '') {
                    const professionMme = professions?.find(p => p.id == profMmeId);
                    items.push({ label: 'Profession MME', value: professionMme ? professionMme.nom : String(profMmeId) });
                  }
                  const typeContratMmeId = etatData.conf_type_contrat_madame ?? etatData.type_contrat_madame;
                  if (typeContratMmeId != null && typeContratMmeId !== '') {
                    const typeContratMme = typeContrat?.find(t => String(t.id) === String(typeContratMmeId));
                    items.push({ label: 'Type de contrat MME', value: typeContratMme ? typeContratMme.nom : String(typeContratMmeId) });
                  }
                  if (etatData.conf_revenu || etatData.revenu_foyer) items.push({ label: 'Revenu', value: etatData.conf_revenu || etatData.revenu_foyer || '-' });
                  if (etatData.conf_credit || etatData.credit_foyer) items.push({ label: 'Crédit', value: etatData.conf_credit || etatData.credit_foyer || '-' });
                  const modeChauffageId = etatData.conf_mode_chauffage ?? etatData.mode_chauffage;
                  if (modeChauffageId != null && modeChauffageId !== '') {
                    const modeChauffageText = modeChauffage?.find(m => m.id == modeChauffageId)?.nom || modeChauffage?.find(m => m.id == modeChauffageId)?.titre || String(modeChauffageId);
                    items.push({ label: 'Mode de chauffage', value: modeChauffageText });
                  }
                  if (etatData.conf_consommation_electricite) items.push({ label: 'Consommations électrique', value: etatData.conf_consommation_electricite });
                  if (etatData.conf_consommation_chauffage) items.push({ label: 'Consommations chauffage', value: etatData.conf_consommation_chauffage });
                  if (etatData.conf_orientation_toiture != null && etatData.conf_orientation_toiture !== '') items.push({ label: 'Orientation toiture', value: String(etatData.conf_orientation_toiture) });
                  if (etatData.conf_zones_ombres != null && etatData.conf_zones_ombres !== '') items.push({ label: 'Zones d\'ombres', value: String(etatData.conf_zones_ombres) });
                  if (etatData.conf_site_classe != null && etatData.conf_site_classe !== '') items.push({ label: 'Proche d\'un site classé', value: String(etatData.conf_site_classe) });
                  if (etatData.produit) {
                    const produitText = produits?.find(p => p.id == etatData.produit)?.nom || (etatData.produit === 1 ? 'PAC' : etatData.produit === 2 ? 'PV' : etatData.produit);
                    items.push({ label: 'Produit', value: produitText });
                  }
                }
                // Contrôle qualité (observations_cq = champ dédié CQ signature)
                else if (etatData.cq_etat || etatData.cq_dossier) {
                  if (etatData.cq_etat) items.push({ label: 'CQ ETAT', value: etatData.cq_etat });
                  if (etatData.cq_dossier) items.push({ label: 'CQ DOSSIER', value: etatData.cq_dossier });
                  if (etatData.observations_cq) items.push({ label: 'Observation', value: etatData.observations_cq, fullWidth: true });
                }
                // Par défaut
                else {
                  if (etatData.confirmateur_pseudo || etatData.histo_confirmateur_pseudo) items.push({ label: 'Confirmateur', value: valeurConfirmateurAffichee });
                  // Afficher le commentaire commercial s'il existe (après création d'un compte rendu approuvé)
                  if (etatData.commentaire_commercial) {
                    items.push({ label: 'Commentaire commercial', value: etatData.commentaire_commercial, fullWidth: true });
                  }
                  // Pour les états non confirmés, afficher commentaire_qualite s'il existe, sinon conf_commentaire_produit
                  if (etatData.commentaire_qualite) {
                    items.push({ label: 'Commentaire', value: etatData.commentaire_qualite, fullWidth: true });
                  } else if (etatData.conf_commentaire_produit && !etatData.commentaire_commercial) {
                    items.push({ label: 'Commentaire', value: etatData.conf_commentaire_produit, fullWidth: true });
                  }
                  if (etatData.date_creation || etatData.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(etatData.date_creation || etatData.date_appel_time).toLocaleString('fr-FR') });
                }
                
                return items;
              };
              
              // Dernière entrée historique = passage à l'état actuel (pour date_creation et from_compte_rendu)
              const lastHisto = fiche.historique && fiche.historique.length > 0 ? fiche.historique[fiche.historique.length - 1] : null;
              const lastHistoEtatActuel = (lastHisto && lastHisto.id_etat === fiche.id_etat_final) ? lastHisto : null;
              const dateCreationEtatActuel = (lastHisto && lastHisto.id_etat === fiche.id_etat_final) ? lastHisto.date_creation : (fiche.date_modif_time || fiche.date_insert_time || null);
              
              // Construire l'objet état actuel à partir des données de la fiche
              const etatActuel = {
                id_etat: fiche.id_etat_final,
                etat_titre: fiche.etat_final_titre || etats?.find(e => e.id === fiche.id_etat_final)?.titre || 'État inconnu',
                etat_color: fiche.etat_final_color || etats?.find(e => e.id === fiche.id_etat_final)?.color || '#3498db',
                sous_etat_titre: fiche.sous_etat_titre || null,
                // Pseudo utilisateur ayant enregistré le passage à cet état (colonne id_confirmateur de la ligne fiches_histo)
                histo_confirmateur_pseudo: lastHistoEtatActuel?.histo_confirmateur_pseudo || null,
                // Utiliser les données actuelles de la fiche
                confirmateur_pseudo: confirmateurs?.find(c => c.id === fiche.id_confirmateur)?.pseudo || null,
                confirmateur_2_pseudo: confirmateurs?.find(c => c.id === fiche.id_confirmateur_2)?.pseudo || null,
                confirmateur_3_pseudo: confirmateurs?.find(c => c.id === fiche.id_confirmateur_3)?.pseudo || null,
                conf_commentaire_produit: lastHistoEtatActuel?.conf_commentaire_produit || fiche.conf_commentaire_produit || null,
                commentaire_qualite: fiche.commentaire_qualite || null,
                commentaire_commercial: fiche.commentaire_commercial || null,
                conf_rdv_avec: fiche.conf_rdv_avec || null,
                conf_appel_tunisie_avec: fiche.conf_appel_tunisie_avec || null,
                conf_deja_etude: fiche.conf_deja_etude || null,
                conf_profession_monsieur: fiche.conf_profession_monsieur ?? fiche.profession_mr ?? null,
                conf_type_contrat_mr: fiche.conf_type_contrat_mr ?? fiche.type_contrat_mr ?? null,
                conf_profession_madame: fiche.conf_profession_madame ?? fiche.profession_madame ?? null,
                conf_type_contrat_madame: fiche.conf_type_contrat_madame ?? fiche.type_contrat_madame ?? null,
                conf_revenu: fiche.conf_revenu || null,
                conf_credit: fiche.conf_credit || null,
                conf_mode_chauffage: fiche.conf_mode_chauffage ?? fiche.mode_chauffage ?? null,
                conf_consommation_electricite: fiche.conf_consommation_electricite || null,
                conf_consommation_chauffage: fiche.conf_consommation_chauffage || null,
                conf_rdv_annule_precedent: fiche.conf_rdv_annule_precedent || null,
                conf_presence_couple: fiche.conf_presence_couple || null,
                conf_orientation_toiture: fiche.conf_orientation_toiture ?? fiche.orientation_toiture ?? null,
                conf_zones_ombres: fiche.conf_zones_ombres ?? fiche.zones_ombres ?? null,
                conf_site_classe: fiche.conf_site_classe ?? fiche.site_classe ?? null,
                date_rdv_time: fiche.date_rdv_time || null,
                date_appel_time: fiche.date_appel_time || null,
                date_sign_time: fiche.date_sign_time || null,
                commercial_pseudo: commerciaux?.find(c => c.id === fiche.id_commercial)?.pseudo || null,
                installeur_nom: installateurs?.find(i => i.id === fiche.ph3_installateur)?.nom || null,
                // Phase 3
                ph3_pac: fiche.ph3_pac || null,
                ph3_type: fiche.ph3_type || null,
                ph3_prix: fiche.ph3_prix || null,
                ph3_puissance: fiche.ph3_puissance || fiche.ph3_puissance_pv || null,
                ph3_consommation: fiche.conf_consommations || null,
                ph3_bonus_30: fiche.ph3_bonus_30 || null,
                ph3_mensualite: fiche.ph3_mensualite || null,
                ph3_nbr_annee_finance: fiche.nbr_annee_finance || null,
                ph3_ballon: fiche.ph3_ballon || null,
                ph3_alimentation: fiche.ph3_alimentation || null,
                credit_immobilier: fiche.credit_immobilier || null,
                credit_autre: fiche.credit_autre || null,
                valeur_mensualite: fiche.valeur_mensualite || null,
                // Autres
                profession_mr: fiche.profession_mr || null,
                profession_madame: fiche.profession_madame || null,
                type_contrat_mr: fiche.type_contrat_mr || null,
                type_contrat_madame: fiche.type_contrat_madame || null,
                revenu_foyer: fiche.revenu_foyer || null,
                credit_foyer: fiche.credit_foyer || null,
                mode_chauffage: fiche.mode_chauffage || null,
                produit: fiche.produit || null,
                cq_etat: fiche.cq_etat || null,
                cq_dossier: fiche.cq_dossier || null,
                observations_cq: fiche.observations_cq || null,
                date_creation: dateCreationEtatActuel,
                from_compte_rendu: !!(lastHisto && lastHisto.id_etat === fiche.id_etat_final && lastHisto.from_compte_rendu)
              };

              // Afficher <CR> dans l'état actuel uniquement si cet état vient d'un compte rendu (dernière entrée historio = état actuel et from_compte_rendu)
              const isCurrentStateFromCR = lastHisto && lastHisto.id_etat === fiche.id_etat_final && lastHisto.from_compte_rendu;
              const crPseudoEtatActuel = isCurrentStateFromCR ? (lastHisto.cr_commercial_pseudo || '') : '';
              
              const detailItemsActuel = renderEtatDetails(etatActuel);
              const normalizeEtatTitle = (v) =>
                String(v || '')
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .trim();

              const historiquePriorityState = (() => {
                const hist = Array.isArray(fiche.historique) ? fiche.historique : [];
                if (hist.length === 0) return null;

                const hasSigned = (h) => {
                  const id = Number(h?.id_etat);
                  const t = normalizeEtatTitle(h?.etat_titre);
                  return [13, 44, 45, 16].includes(id) || t.includes('sign');
                };
                const hasASuivre = (h) => {
                  const id = Number(h?.id_etat);
                  const t = normalizeEtatTitle(h?.etat_titre);
                  return id === 9 || (t.includes('honore') && t.includes('suivr'));
                };
                const hasARepro = (h) => {
                  const id = Number(h?.id_etat);
                  const t = normalizeEtatTitle(h?.etat_titre);
                  return id === 8 || (t.includes('annuler') && t.includes('repro'));
                };

                const signedState = hist.find(hasSigned);
                if (signedState) return { label: 'Signé', color: signedState.etat_color || '#4CAF50' };

                const aSuivreState = hist.find(hasASuivre);
                if (aSuivreState) return { label: 'Honoré à suivre', color: aSuivreState.etat_color || '#f7a219' };

                const aReproState = hist.find(hasARepro);
                if (aReproState) return { label: 'Annuler à reprogrammer', color: aReproState.etat_color || '#9cbfc8' };

                return null;
              })();
              
              return (
                <>
                  {/* Section État Actuel - Toujours visible en premier plan */}
                  {fiche.id_etat_final && (
                    <div 
                      className="etat-actuel-card"
                      style={{
                        padding: '20px',
                        border: '6px solid #000000',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        position: 'relative'
                      }}
                    >
                      {/* Badge "État Actuel" */}
                      <div style={{
                        position: 'absolute',
                        top: '-12px',
                        right: '20px',
                        backgroundColor: etatActuel.etat_color,
                        color: etatActuel.etat_color === '#ffffff' || etatActuel.etat_color === '#fff' ? '#000' : '#fff',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        État Actuel
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '20px',
                        flexWrap: 'wrap',
                        gap: '15px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          {/* État */}
                          <span
                            style={{
                              padding: '8px 18px',
                              borderRadius: '6px',
                              backgroundColor: etatActuel.etat_color,
                              color: etatActuel.etat_color === '#ffffff' || etatActuel.etat_color === '#fff' ? '#000' : '#fff',
                              fontWeight: 'bold',
                              fontSize: '16px',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                            }}
                          >
                            {isCurrentStateFromCR ? (
                              <>
                                <span style={{ marginRight: '6px' }}>&lt;CR&gt;</span>
                                {crPseudoEtatActuel && <span style={{ marginRight: '6px' }}>{crPseudoEtatActuel} – </span>}
                              </>
                            ) : null}
                            {etatActuel.etat_titre}
                          </span>
                          {/* Sous-état */}
                          {etatActuel.sous_etat_titre && (
                            <span
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                backgroundColor: '#e8e8e8',
                                color: '#333',
                                fontSize: '13px',
                                fontWeight: 'bold',
                                border: '1px solid #ccc'
                              }}
                            >
                              {etatActuel.sous_etat_titre}
                            </span>
                          )}
                        </div>
                        <span style={{ 
                          color: '#666', 
                          fontSize: '14px',
                          fontWeight: '500'
                        }}>
                          {etatActuel.date_creation ? new Date(etatActuel.date_creation).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '-'}
                        </span>
                      </div>
                      
                      {/* Détails de l'état actuel */}
                      {detailItemsActuel.length > 0 && (
                        <div style={{ 
                          marginTop: '20px', 
                          paddingTop: '20px', 
                          borderTop: '2px solid #e0e0e0',
                          backgroundColor: '#fafafa',
                          padding: '15px',
                          borderRadius: '6px'
                        }}>
                          <h4 style={{ 
                            marginBottom: '15px', 
                            fontSize: '15px', 
                            fontWeight: 'bold',
                            color: '#333',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <FaInfoCircle style={{ color: etatActuel.etat_color }} />
                            Détails de l'état actuel
                          </h4>
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                            gap: '12px', 
                            fontSize: '14px' 
                          }}>
                            {detailItemsActuel.map((item, idx) => (
                              <div 
                                key={idx} 
                                style={{ 
                                  gridColumn: item.fullWidth ? '1 / -1' : 'auto',
                                  padding: '8px',
                                  backgroundColor: '#fff',
                                  borderRadius: '4px',
                                  border: '1px solid #e0e0e0'
                                }}
                              >
                                <strong style={{ color: '#555', display: 'block', marginBottom: '4px' }}>
                                  {item.label}:
                                </strong>
                                <span style={{ color: '#333' }}>
                                  {item.value || '-'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {fiche.id_etat_final === 7 && hasPermission('fiche_validate') && (
                        <div style={{
                          marginTop: '16px',
                          padding: '14px',
                          background: '#f8f9fa',
                          border: '2px solid #000',
                          borderRadius: '6px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <strong>Validation de la fiche</strong>
                            <button
                              type="button"
                              className="btn-validate"
                              onClick={() => setShowValidationCardForm((prev) => !prev)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                              <FaCheck />
                              {showValidationCardForm ? 'Masquer' : 'Valider'}
                            </button>
                          </div>

                          {showValidationCardForm && (
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label htmlFor="validation_rdv_date_inline" style={{ fontWeight: 600, fontSize: '13px' }}>Date RDV</label>
                                  <input
                                    id="validation_rdv_date_inline"
                                    type="date"
                                    value={validationRdvDate || ''}
                                    onChange={(e) => setValidationRdvDate(e.target.value)}
                                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label htmlFor="validation_rdv_time_inline" style={{ fontWeight: 600, fontSize: '13px' }}>Heure RDV</label>
                                  <input
                                    id="validation_rdv_time_inline"
                                    type="time"
                                    value={validationRdvTime || ''}
                                    onChange={(e) => setValidationRdvTime(e.target.value)}
                                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                                  />
                                </div>
                              </div>

                              <button
                                type="button"
                                className="btn-save"
                                disabled={updateFieldMutation.isLoading || !validationRdvDate || !validationRdvTime}
                                onClick={async () => {
                                  try {
                                    await updateFieldMutation.mutateAsync({
                                      field: 'date_rdv_time',
                                      value: `${validationRdvDate} ${validationRdvTime}:00`
                                    });
                                    alert('Heure du RDV mise à jour avec succès');
                                  } catch (err) {
                                    // Erreur déjà gérée par la mutation
                                  }
                                }}
                              >
                                {updateFieldMutation.isLoading ? 'Mise à jour...' : 'Enregistrer heure RDV'}
                              </button>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label htmlFor="conf_rdv_avec_validation_inline" style={{ fontWeight: 600, fontSize: '13px' }}>
                                  Avec qui le RDV a-t-il été validé ? (optionnel)
                                </label>
                                <select
                                  id="conf_rdv_avec_validation_inline"
                                  value={confRdvAvecValue || ''}
                                  onChange={(e) => setConfRdvAvecValue(e.target.value)}
                                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                                >
                                  <option value="">Sélectionner...</option>
                                  <option value="MR">Mr</option>
                                  <option value="MME">Mme</option>
                                  <option value="MR et MME">Mr et Mme</option>
                                </select>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label htmlFor="conf_presence_couple_validation_inline" style={{ fontWeight: '600', fontSize: '13px' }}>
                                  Présence du couple <span style={{ color: 'red' }}>*</span>
                                </label>
                                <select
                                  id="conf_presence_couple_validation_inline"
                                  value={confPresenceCoupleValue || ''}
                                  onChange={(e) => setConfPresenceCoupleValue(e.target.value)}
                                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                                >
                                  <option value="">Sélectionner...</option>
                                  <option value="OUI">OUI</option>
                                  <option value="NON">NON</option>
                                </select>
                              </div>

                              {fiche.valider > 0 ? (
                                <button
                                  className="btn-validate cancel"
                                  onClick={() => {
                                    if (window.confirm('Voulez-vous annuler la validation de cette fiche ?')) {
                                      validateMutation.mutate({ type_valid: '0' });
                                    }
                                  }}
                                  disabled={validateMutation.isLoading}
                                  title="Annuler la validation"
                                >
                                  Annuler la validation
                                </button>
                              ) : (
                                <button
                                  className="btn-validate"
                                  onClick={() => {
                                    validateMutation.mutate({
                                      type_valid: `1${confRdvAvecValue ? '-' + confRdvAvecValue : ''}`,
                                      conf_rdv_avec: confRdvAvecValue || null,
                                      conf_presence_couple: confPresenceCoupleValue || null
                                    });
                                  }}
                                  disabled={validateMutation.isLoading || !confPresenceCoupleValue}
                                  title="Valider la fiche confirmée"
                                >
                                  {validateMutation.isLoading ? 'Validation...' : 'Valider la fiche'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Contrôle Qualité (états signer : 13, 16, 44, 45) */}
                  {[13, 16, 44, 45].includes(fiche.id_etat_final) && (
                    <div className="fiche-section" style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '15px', fontWeight: 'bold' }}>
                        Contrôle Qualité
                      </h3>
                      {(() => {
                        const ficheHash = fiche.hash || hash;
                        const form = cqFormByHash[ficheHash] || {};
                        const vCqEtat = form.cq_etat !== undefined ? form.cq_etat : String(fiche.cq_etat ?? '');
                        const vCqDossier = form.cq_dossier !== undefined ? form.cq_dossier : String(fiche.cq_dossier ?? '');
                        const vObs = form.observations !== undefined ? form.observations : String(fiche.observations_cq ?? '');
                        return (
                          <>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                              <label htmlFor="cq_etat_signer">CQ ETAT :</label>
                              <select
                                id="cq_etat_signer"
                                className="form-control"
                                value={vCqEtat}
                                onChange={(e) => setCqFormByHash(prev => ({
                                  ...prev,
                                  [ficheHash]: { ...(prev[ficheHash] || {}), cq_etat: e.target.value }
                                }))}
                              >
                                <option value="">Sélectionnez</option>
                                <option value="1">NRP / INJOIGNABLE</option>
                                <option value="2">RAS</option>
                                <option value="3">NEGATIF</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                              <label htmlFor="cq_dossier_signer">CQ DOSSIER :</label>
                              <select
                                id="cq_dossier_signer"
                                className="form-control"
                                value={vCqDossier}
                                onChange={(e) => setCqFormByHash(prev => ({
                                  ...prev,
                                  [ficheHash]: { ...(prev[ficheHash] || {}), cq_dossier: e.target.value }
                                }))}
                              >
                                <option value="">Sélectionnez</option>
                                <option value="1">COMPLET</option>
                                <option value="2">INCOMPLET</option>
                              </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: '12px' }}>
                              <label htmlFor="cq_observations_signer">OBSERVATIONS :</label>
                              <textarea
                                id="cq_observations_signer"
                                className="form-control"
                                rows={3}
                                value={vObs}
                                onChange={(e) => setCqFormByHash(prev => ({
                                  ...prev,
                                  [ficheHash]: { ...(prev[ficheHash] || {}), observations: e.target.value }
                                }))}
                                placeholder="Commentaires..."
                              />
                            </div>
                            <div style={{ marginTop: '12px' }}>
                              <button
                                type="button"
                                className="btn-confirm"
                                disabled={controleQualiteMutation.isLoading}
                                onClick={() => controleQualiteMutation.mutate({
                                  cq_etat: vCqEtat || null,
                                  cq_dossier: vCqDossier || null,
                                  observations_cq: vObs || null
                                })}
                              >
                                {controleQualiteMutation.isLoading ? 'Enregistrement...' : 'Valider'}
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  
                  {/* Section Historique - Pliable (masquée en session commercial) */}
                  {user?.fonction !== 5 && fiche.historique && fiche.historique.length > 0 && (
                    <>
                      {historiquePriorityState && (
                        <div
                          style={{
                            width: '100%',
                            marginBottom: '10px',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            backgroundColor: historiquePriorityState.color,
                            color: historiquePriorityState.color === '#ffffff' || historiquePriorityState.color === '#fff' ? '#000' : '#fff',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            fontSize: '16px'
                          }}
                        >
                          {historiquePriorityState.label}
                        </div>
                      )}
                      <div 
                        className="section-title historique-title-bar" 
                        style={{ 
                          cursor: 'pointer', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          userSelect: 'none',
                          padding: '12px 15px',
                          backgroundColor: '#000000',
                          color: '#ffffff',
                          borderRadius: '6px',
                          marginBottom: '15px',
                          border: '1px solid #000000'
                        }}
                        onClick={() => setShowHistorique(!showHistorique)}
                      >
                        <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#ffffff' }}>
                          <FaHistory style={{ marginRight: '8px', color: '#ffffff' }} />
                          Historique des états ({fiche.historique.length} entrée{fiche.historique.length > 1 ? 's' : ''})
                        </span>
                        {showHistorique ? <FaChevronUp style={{ color: '#ffffff' }} /> : <FaChevronDown style={{ color: '#ffffff' }} />}
                      </div>
                      
                      {showHistorique && (
                        <div className="historique-list" style={{ marginTop: '10px' }}>
                          {fiche.historique.slice().reverse().map((histo, index) => {
                            const detailItems = renderEtatDetails(histo);
                            
                            return (
                              <div
                                key={histo.id}
                                className="historique-item"
                                style={{
                                  borderLeft: `4px solid ${histo.etat_color || '#3498db'}`,
                                  padding: '15px',
                                  marginBottom: '15px',
                                  backgroundColor: '#f9f9f9',
                                  borderRadius: '4px',
                                  opacity: index === 0 && fiche.historique.length > 1 ? 0.7 : 1 // Légèrement transparent si c'est le dernier (déjà affiché en état actuel)
                                }}
                              >
                                <div className="historique-header" style={{ marginBottom: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    <span
                                      className="historique-etat"
                                      style={{
                                        backgroundColor: histo.etat_color || '#3498db',
                                        color: histo.etat_color === '#ffffff' || histo.etat_color === '#fff' ? '#000' : '#fff',
                                        padding: '5px 15px',
                                        borderRadius: '4px',
                                        fontWeight: 'bold',
                                        fontSize: '14px'
                                      }}
                                    >
                                      {histo.from_compte_rendu && (
                                        <span style={{ marginRight: '6px' }}>&lt;CR&gt;{histo.cr_commercial_pseudo ? ` ${histo.cr_commercial_pseudo}` : ''}</span>
                                      )}
                                      {histo.etat_titre || 'État inconnu'}
                                    </span>
                                    {histo.sous_etat_titre && (
                                      <span
                                        style={{
                                          padding: '4px 10px',
                                          borderRadius: '4px',
                                          backgroundColor: '#e0e0e0',
                                          color: '#333',
                                          fontSize: '12px',
                                          fontWeight: 'bold'
                                        }}
                                      >
                                        {histo.sous_etat_titre}
                                      </span>
                                    )}
                                    <span className="historique-date" style={{ color: '#666', fontSize: '13px', marginLeft: 'auto' }}>
                                      {histo.date_creation ? new Date(histo.date_creation).toLocaleString('fr-FR') : '-'}
                                    </span>
                                  </div>
                                </div>
                                
                                {detailItems.length > 0 && (
                                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ddd', fontSize: '13px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                      {detailItems.map((item, idx) => (
                                        <div key={idx} style={{ gridColumn: item.fullWidth ? 'span 2' : 'span 1' }}>
                                          <strong>{item.label}:</strong> {item.value || '-'}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Section Changement d'état - En bas de la page */}
        {/* Permissions : 
            - Admins (1, 2, 7) et Agents (3) : peuvent changer vers tous les états
            - Commerciaux (5) : peuvent changer uniquement vers les états de Phase 3 (groupe = 3) ou CONFIRMER (état 7)
            - Confirmateurs (6) : peuvent changer l'état des fiches qui leur sont assignées
        */}
        {/* Section Compte rendu : visible uniquement en session commercial propriétaire */}
        {(user?.fonction === 5 && (Number(ficheData?.id_commercial) === Number(user?.id) || Number(ficheData?.id_commercial_2) === Number(user?.id))) && (
          <>
            {/* Afficher les comptes rendu en attente uniquement (masquer après approbation/rejet) */}
            {ficheData?.comptes_rendus && ficheData.comptes_rendus.some((cr) => cr.statut === 'pending') && (
              <div className="fiche-section compte-rendu-section">
                <h2 className="section-title">Comptes rendu en attente</h2>
                {ficheData.comptes_rendus.filter((cr) => cr.statut === 'pending').map((cr) => {
                  // Mapper l'état de la base de données vers le libellé commercial
                  const getEtatCommercialLabel = (etatId) => {
                    if ([13, 44, 45].includes(etatId)) return 'Signer';
                    if (etatId === 9) return 'Déballé veut réfléchir';
                    if (etatId === 12) return 'Déballé sans suite';
                    if (etatId === 34) return 'Infinançable';
                    if (etatId === 35) return 'Infaisabilité technique';
                    if (etatId === 23) return 'Hors cible confirmateur';
                    if (etatId === 8) return 'Porte / Imprévu / NRP';
                    return cr.etat_titre || 'N/A';
                  };

                  return (
                    <div key={cr.id} className="compte-rendu-item" style={{ 
                      marginBottom: '20px', 
                      padding: '15px', 
                      border: '1px solid #ddd', 
                      borderRadius: '5px',
                      backgroundColor: cr.statut === 'pending' ? '#fff3cd' : cr.statut === 'approved' ? '#d4edda' : '#f8d7da'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div>
                          <strong>État :</strong> {getEtatCommercialLabel(cr.id_etat_final)} | 
                          <strong> Statut :</strong> {cr.statut === 'pending' ? 'En attente' : cr.statut === 'approved' ? 'Approuvé' : 'Rejeté'} |
                          <strong> Date :</strong> {cr.date_creation ? new Date(cr.date_creation).toLocaleString('fr-FR') : 'N/A'}
                        </div>
                        {cr.statut === 'pending' && (
                          <button 
                            className="btn-edit" 
                            onClick={() => {
                              setEditingCompteRendu(cr.id);
                              // Charger les données du compte rendu dans le formulaire
                              if ([13, 44, 45].includes(cr.id_etat_final)) {
                                setCompteRenduOption('signer');
                                setSelectedEtat(cr.id_etat_final);
                                // Extraire date et heure de date_sign_time si disponible
                                let dateSignDate = '';
                                let dateSignTime = '';
                                if (cr.modifications?.date_sign_time) {
                                  const dateSign = new Date(cr.modifications.date_sign_time);
                                  dateSignDate = dateSign.toISOString().split('T')[0];
                                  dateSignTime = dateSign.toTimeString().split(' ')[0].substring(0, 5);
                                }
                                setEtatFormData({
                                  date_sign_date: dateSignDate,
                                  date_sign_time: dateSignTime,
                                  produit: cr.modifications?.produit ? String(cr.modifications.produit) : (ficheData?.produit ? String(ficheData.produit) : ''),
                                  id_sous_etat: cr.id_sous_etat ? String(cr.id_sous_etat) : '',
                                  id_commercial: cr.modifications?.id_commercial ? String(cr.modifications.id_commercial) : String(user?.id || ''),
                                  id_commercial_2: cr.modifications?.id_commercial_2 ? String(cr.modifications.id_commercial_2) : '',
                                  pseudo: cr.modifications?.pseudo || '',
                                  ph3_pac: cr.ph3_pac || 'reau',
                                  ph3_rr_model: cr.ph3_rr_model || '',
                                  ph3_puissance: cr.ph3_puissance || '',
                                  ph3_ballon: cr.ph3_ballon || '',
                                  ph3_marque_ballon: cr.ph3_marque_ballon || '',
                                  ph3_alimentation: cr.ph3_alimentation || '',
                                  ph3_type: cr.ph3_type || '',
                                  ph3_prix: cr.ph3_prix || '',
                                  ph3_installateur: cr.ph3_installateur ? String(cr.ph3_installateur) : '',
                                  conf_consommations: cr.modifications?.conf_consommations || '',
                                  ph3_bonus_30: cr.ph3_bonus_30 || '',
                                  valeur_mensualite: cr.modifications?.valeur_mensualite || '',
                                  ph3_mensualite: cr.ph3_mensualite || '',
                                  ph3_attente: cr.ph3_attente || '',
                                  nbr_annee_finance: cr.nbr_annee_finance || '',
                                  credit_immobilier: cr.credit_immobilier || '',
                                  credit_autre: cr.credit_autre || '',
                                  conf_commentaire_produit: cr.commentaire || ''
                                });
                              } else if (cr.id_etat_final === 9) {
                                setCompteRenduOption('deballé_réfléchir');
                                setSelectedEtat(9);
                                setEtatFormData({...etatFormData, conf_commentaire_produit: cr.commentaire || ''});
                              } else if (cr.id_etat_final === 12) {
                                setCompteRenduOption('deballé_sans_suite');
                                setSelectedEtat(12);
                                setEtatFormData({...etatFormData, conf_commentaire_produit: '', motif_qualif: cr.commentaire || ''});
                              } else if (cr.id_etat_final === 34) {
                                setCompteRenduOption('infinançable');
                                setSelectedEtat(34);
                                setEtatFormData({...etatFormData, conf_commentaire_produit: '', motif_qualif: cr.commentaire || ''});
                              } else if (cr.id_etat_final === 35) {
                                setCompteRenduOption('infaisabilité_technique');
                                setSelectedEtat(35);
                                setEtatFormData({...etatFormData, conf_commentaire_produit: cr.commentaire || ''});
                              } else if (cr.id_etat_final === 8) {
                                setCompteRenduOption('porte_imprevu_nrp');
                                setSelectedEtat(8);
                                // Extraire date et heure si disponibles
                                let dateRdv = '';
                                let timeRdv = '';
                                if (cr.modifications?.conf_rdv_date) {
                                  dateRdv = cr.modifications.conf_rdv_date;
                                  timeRdv = cr.modifications.conf_rdv_time || '';
                                }
                                setEtatFormData({
                                  ...etatFormData,
                                  conf_rdv_date: dateRdv,
                                  conf_rdv_time: timeRdv,
                                  id_sous_etat: cr.id_sous_etat ? String(cr.id_sous_etat) : '',
                                  conf_rdv_avec: cr.modifications?.conf_rdv_avec || '',
                                  conf_commentaire_produit: cr.commentaire || ''
                                });
                              }
                            }}
                            style={{ padding: '5px 10px', fontSize: '0.9em' }}
                          >
                            Modifier
                          </button>
                        )}
                      </div>
                      {/* Afficher uniquement le compte rendu (commentaire) */}
                      {cr.commentaire && (
                        <div style={{ marginBottom: '10px' }}>
                          <strong>Compte rendu :</strong> {cr.commentaire}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Section pour créer un nouveau compte rendu (masquée si on édite un compte rendu ou s'il y a déjà un compte rendu en attente) */}
            {!editingCompteRendu && !(ficheData?.comptes_rendus && ficheData.comptes_rendus.some(cr => cr.statut === 'pending')) && (
              <div className="fiche-section compte-rendu-section">
                <h2 className="section-title">{editingCompteRendu ? 'Modifier le compte rendu' : 'Compte rendu'}</h2>
                <div className="compte-rendu-form">
                  <div className="form-group">
                    <label htmlFor="compte_rendu_option">Type de compte rendu :</label>
                  <select
                    id="compte_rendu_option"
                    className="form-control"
                    value={compteRenduOption}
                    onChange={(e) => {
                    setCompteRenduOption(e.target.value);
                    // Définir l'état correspondant selon l'option sélectionnée
                    // Les libellés affichés au commercial ne correspondent pas aux IDs d'états réels
                    if (e.target.value === 'signer') {
                      setSelectedEtat(13); // SIGNER
                      // Réinitialiser le formulaire pour SIGNER
                      const currentDate = new Date();
                      const dateStr = currentDate.toISOString().split('T')[0];
                      const timeStr = currentDate.toTimeString().split(' ')[0].substring(0, 5);
                      setEtatFormData({
                        ...etatFormData,
                        date_sign_date: dateStr,
                        date_sign_time: timeStr,
                        produit: ficheData?.produit ? String(ficheData.produit) : '',
                        id_commercial: String(user?.id || ''),
                        id_sous_etat: ''
                      });
                    } else if (e.target.value === 'deballé_réfléchir') {
                      setSelectedEtat(9); // CLIENT HONORE A SUIVRE
                      setEtatFormData({
                        ...etatFormData,
                        conf_commentaire_produit: ''
                      });
                    } else if (e.target.value === 'deballé_sans_suite') {
                      setSelectedEtat(12); // REFUSER
                      setEtatFormData({
                        ...etatFormData,
                        conf_commentaire_produit: '',
                        motif_qualif: ''
                      });
                    } else if (e.target.value === 'infinançable') {
                      setSelectedEtat(34); // HHC FINANCEMENT A VERIFIER
                      setEtatFormData({
                        ...etatFormData,
                        conf_commentaire_produit: '',
                        motif_qualif: ''
                      });
                    } else if (e.target.value === 'infaisabilité_technique') {
                      setSelectedEtat(35); // HCC TECHNIQUE
                      setEtatFormData({
                        ...etatFormData,
                        conf_commentaire_produit: ''
                      });
                    } else if (e.target.value === 'porte_imprevu_nrp') {
                      setSelectedEtat(8); // ANNULER À REPROGRAMMER
                      setEtatFormData({
                        ...etatFormData,
                        conf_rdv_date: '',
                        conf_rdv_time: '',
                        id_sous_etat: '',
                        conf_rdv_avec: '',
                        conf_commentaire_produit: ''
                      });
                    } else {
                      setSelectedEtat(null);
                    }
                    }}
                  >
                    <option value="">Sélectionner une option</option>
                    <option value="signer">Signer</option>
                    <option value="deballé_réfléchir">Déballé veut réfléchir</option>
                    <option value="deballé_sans_suite">Déballé sans suite</option>
                    <option value="infinançable">Infinançable</option>
                    <option value="infaisabilité_technique">Infaisabilité technique</option>
                    <option value="porte_imprevu_nrp">Porte / Imprévu / NRP</option>
                  </select>
                </div>
              </div>
            </div>
            )}

            {/* Section pour modifier un compte rendu - Afficher la liste déroulante */}
            {editingCompteRendu && (() => {
              const crToEdit = ficheData?.comptes_rendus?.find(cr => cr.id === editingCompteRendu);
              if (!crToEdit || crToEdit.statut !== 'pending') return null;
              
              return (
                <div className="fiche-section compte-rendu-section">
                  <h2 className="section-title">Modifier le compte rendu</h2>
                  <div className="compte-rendu-form">
                    <div className="form-group">
                      <label htmlFor="compte_rendu_option_edit">Type de compte rendu :</label>
                      <select
                        id="compte_rendu_option_edit"
                        className="form-control"
                        value={compteRenduOption}
                        onChange={(e) => {
                          setCompteRenduOption(e.target.value);
                          // Définir l'état correspondant selon l'option sélectionnée
                          if (e.target.value === 'signer') {
                            setSelectedEtat(13); // SIGNER
                            // Réinitialiser le formulaire pour SIGNER
                            const currentDate = new Date();
                            const dateStr = currentDate.toISOString().split('T')[0];
                            const timeStr = currentDate.toTimeString().split(' ')[0].substring(0, 5);
                            setEtatFormData({
                              ...etatFormData,
                              date_sign_date: dateStr,
                              date_sign_time: timeStr,
                              produit: ficheData?.produit ? String(ficheData.produit) : '',
                              id_commercial: String(user?.id || ''),
                              id_sous_etat: ''
                            });
                          } else if (e.target.value === 'deballé_réfléchir') {
                            setSelectedEtat(9); // CLIENT HONORE A SUIVRE
                            setEtatFormData({
                              ...etatFormData,
                              conf_commentaire_produit: ''
                            });
                          } else if (e.target.value === 'deballé_sans_suite') {
                            setSelectedEtat(12); // REFUSER
                            setEtatFormData({
                              ...etatFormData,
                              conf_commentaire_produit: '',
                              motif_qualif: ''
                            });
                          } else if (e.target.value === 'infinançable') {
                            setSelectedEtat(34); // HHC FINANCEMENT A VERIFIER
                            setEtatFormData({
                              ...etatFormData,
                              conf_commentaire_produit: '',
                              motif_qualif: ''
                            });
                          } else if (e.target.value === 'infaisabilité_technique') {
                            setSelectedEtat(35); // HCC TECHNIQUE
                            setEtatFormData({
                              ...etatFormData,
                              conf_commentaire_produit: ''
                            });
                          } else if (e.target.value === 'porte_imprevu_nrp') {
                            setSelectedEtat(8); // ANNULER À REPROGRAMMER
                            setEtatFormData({
                              ...etatFormData,
                              conf_rdv_date: '',
                              conf_rdv_time: '',
                              id_sous_etat: '',
                              conf_rdv_avec: '',
                              conf_commentaire_produit: ''
                            });
                          } else {
                            setSelectedEtat(null);
                          }
                        }}
                      >
                        <option value="">Sélectionner une option</option>
                        <option value="signer">Signer</option>
                        <option value="deballé_réfléchir">Déballé veut réfléchir</option>
                        <option value="deballé_sans_suite">Déballé sans suite</option>
                        <option value="infinançable">Infinançable</option>
                        <option value="infaisabilité_technique">Infaisabilité technique</option>
                        <option value="porte_imprevu_nrp">Porte / Imprévu / NRP</option>
                      </select>
                    </div>
                    <div style={{ marginTop: '10px', textAlign: 'right' }}>
                      <button 
                        className="btn-cancel" 
                        onClick={() => {
                          setEditingCompteRendu(null);
                          setCompteRenduOption('');
                          setSelectedEtat(null);
                          setEtatFormData({
                            date_sign_date: '', date_sign_time: '', produit: '', id_sous_etat: '', id_commercial: '', 
                            id_commercial_2: '', pseudo: '', ph3_pac: 'reau', ph3_rr_model: '', ph3_puissance: '', 
                            ph3_ballon: '', ph3_marque_ballon: '', ph3_alimentation: '', ph3_type: '', ph3_prix: '', 
                            ph3_installateur: '', conf_consommations: '', ph3_bonus_30: '', valeur_mensualite: '', 
                            ph3_mensualite: '', ph3_attente: '', nbr_annee_finance: '', credit_immobilier: '', 
                            credit_autre: '', conf_commentaire_produit: '', conf_rdv_date: '', conf_rdv_time: '', conf_rdv_avec: '',
                          });
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Afficher les formulaires pour les commerciaux après sélection d'une option (uniquement si on édite un compte rendu ou si on crée un nouveau) */}
            {/* Formulaire SIGNER (états 13, 44, 45) pour commerciaux */}
            {[13, 44, 45].includes(selectedEtat) && (editingCompteRendu || !(ficheData?.comptes_rendus && ficheData.comptes_rendus.some(cr => cr.statut === 'pending'))) && (
              <div className="fiche-section etat-change-section" style={{ marginTop: '20px' }}>
                <div className="etat-form">
                  <h3>Informations Signature</h3>
                  
                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_produit_signer">Signature pour :</label>
                    <select
                      id="compte_rendu_etat_produit_signer"
                      className="form-control"
                      value={etatFormData.produit}
                      onChange={(e) => setEtatFormData({...etatFormData, produit: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      {produits?.map(prod => (
                        <option key={prod.id} value={prod.id}>
                          {prod.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="compte_rendu_etat_date_sign_date">Signé le :</label>
                      <input
                        type="date"
                        id="compte_rendu_etat_date_sign_date"
                        className="form-control"
                        value={etatFormData.date_sign_date}
                        onChange={(e) => setEtatFormData({...etatFormData, date_sign_date: e.target.value})}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="compte_rendu_etat_date_sign_time">Heure :</label>
                      <input
                        type="time"
                        id="compte_rendu_etat_date_sign_time"
                        className="form-control"
                        value={etatFormData.date_sign_time}
                        onChange={(e) => setEtatFormData({...etatFormData, date_sign_time: e.target.value})}
                      />
                    </div>
                  </div>

                  {sousEtats.length > 0 && (
                    <div className="form-group">
                      <label htmlFor="compte_rendu_etat_id_sous_etat_signer">Sous État :</label>
                      <select
                        id="compte_rendu_etat_id_sous_etat_signer"
                        className="form-control"
                        value={etatFormData.id_sous_etat}
                        onChange={(e) => setEtatFormData({...etatFormData, id_sous_etat: e.target.value})}
                      >
                        <option value="">Sélectionner</option>
                        {sousEtats.map(setat => (
                          <option key={setat.id} value={setat.id}>
                            {setat.titre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_id_commercial_signer">Commercial :</label>
                    <select
                      id="compte_rendu_etat_id_commercial_signer"
                      className="form-control"
                      value={etatFormData.id_commercial}
                      onChange={(e) => setEtatFormData({...etatFormData, id_commercial: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      {commerciaux?.map(com => (
                        <option key={com.id} value={com.id}>
                          {com.pseudo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_id_commercial_2_signer">Commercial 2 (optionnel) :</label>
                    <select
                      id="compte_rendu_etat_id_commercial_2_signer"
                      className="form-control"
                      value={etatFormData.id_commercial_2}
                      onChange={(e) => setEtatFormData({...etatFormData, id_commercial_2: e.target.value})}
                    >
                      <option value="">Aucun</option>
                      {commerciaux?.map(com => (
                        <option key={com.id} value={com.id}>
                          {com.pseudo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_pseudo_signer">Pseudo :</label>
                    <input
                      type="text"
                      id="compte_rendu_etat_pseudo_signer"
                      className="form-control"
                      value={etatFormData.pseudo}
                      onChange={(e) => setEtatFormData({...etatFormData, pseudo: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_ph3_pac_signer">Pac :</label>
                    <select
                      id="compte_rendu_etat_ph3_pac_signer"
                      className="form-control"
                      value={etatFormData.ph3_pac}
                      onChange={(e) => setEtatFormData({...etatFormData, ph3_pac: e.target.value})}
                    >
                      <option value="reau">R/EAU</option>
                      <option value="rr">R/R</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_ph3_rr_model_signer">Marque Pac :</label>
                    <input
                      type="text"
                      id="compte_rendu_etat_ph3_rr_model_signer"
                      className="form-control"
                      value={etatFormData.ph3_rr_model}
                      onChange={(e) => setEtatFormData({...etatFormData, ph3_rr_model: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_ph3_puissance_signer">Puissance :</label>
                    <select
                      id="compte_rendu_etat_ph3_puissance_signer"
                      className="form-control"
                      value={etatFormData.ph3_puissance}
                      onChange={(e) => setEtatFormData({...etatFormData, ph3_puissance: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      <option value="11kw">11kw</option>
                      <option value="14kw">14kw</option>
                      <option value="16kw">16kw</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_ph3_ballon_signer">Ballon :</label>
                    <select
                      id="compte_rendu_etat_ph3_ballon_signer"
                      className="form-control"
                      value={etatFormData.ph3_ballon}
                      onChange={(e) => setEtatFormData({...etatFormData, ph3_ballon: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      <option value="Avec Ballon">Avec Ballon</option>
                      <option value="Sans Ballon">Sans Ballon</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_ph3_marque_ballon_signer">Marque ballon :</label>
                    <input
                      type="text"
                      id="compte_rendu_etat_ph3_marque_ballon_signer"
                      className="form-control"
                      value={etatFormData.ph3_marque_ballon}
                      onChange={(e) => setEtatFormData({...etatFormData, ph3_marque_ballon: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_ph3_alimentation_signer">Alimentation :</label>
                    <select
                      id="compte_rendu_etat_ph3_alimentation_signer"
                      className="form-control"
                      value={etatFormData.ph3_alimentation}
                      onChange={(e) => setEtatFormData({...etatFormData, ph3_alimentation: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      <option value="mono">mono</option>
                      <option value="triphase">triphase</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_ph3_type_signer">Type :</label>
                    <select
                      id="compte_rendu_etat_ph3_type_signer"
                      className="form-control"
                      value={etatFormData.ph3_type}
                      onChange={(e) => setEtatFormData({...etatFormData, ph3_type: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      <option value="Radiateur">Radiateur</option>
                      <option value="Plancher chauffant">Plancher chauffant</option>
                      <option value="Bizone">Bizone</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_ph3_prix_signer">Prix En € :</label>
                    <input
                      type="number"
                      id="compte_rendu_etat_ph3_prix_signer"
                      className="form-control"
                      value={etatFormData.ph3_prix}
                      onChange={(e) => setEtatFormData({...etatFormData, ph3_prix: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_ph3_installateur_signer">Installateur :</label>
                    <select
                      id="compte_rendu_etat_ph3_installateur_signer"
                      className="form-control"
                      value={etatFormData.ph3_installateur}
                      onChange={(e) => setEtatFormData({...etatFormData, ph3_installateur: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      {installateurs?.map(inst => (
                        <option key={inst.id} value={inst.id}>
                          {inst.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_conf_consommations_signer">Conso actuelle du client (par mois) :</label>
                    <input
                      type="number"
                      id="compte_rendu_etat_conf_consommations_signer"
                      className="form-control"
                      value={etatFormData.conf_consommations}
                      onChange={(e) => setEtatFormData({...etatFormData, conf_consommations: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_ph3_bonus_30_signer">Bonus :</label>
                    <select
                      id="compte_rendu_etat_ph3_bonus_30_signer"
                      className="form-control"
                      value={etatFormData.ph3_bonus_30}
                      onChange={(e) => setEtatFormData({...etatFormData, ph3_bonus_30: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      <option value="100€ (conso inf 1500€)">100€ (conso inf 1500€)</option>
                      <option value="20% (conso sup ou égale 1500€)">20% (conso sup ou égale 1500€)</option>
                      <option value="30% (conso sup ou égale 3000€)">30% (conso sup ou égale 3000€)</option>
                      <option value="12k reste à charge (74 ans et +)">12k reste à charge (74 ans et +)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_valeur_mensualite_signer">Reste à charge après bonus (par mois) :</label>
                    <input
                      type="number"
                      id="compte_rendu_etat_valeur_mensualite_signer"
                      className="form-control"
                      value={etatFormData.valeur_mensualite}
                      onChange={(e) => setEtatFormData({...etatFormData, valeur_mensualite: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_ph3_mensualite_signer">Mensualité du Crédit :</label>
                    <input
                      type="number"
                      id="compte_rendu_etat_ph3_mensualite_signer"
                      className="form-control"
                      value={etatFormData.ph3_mensualite}
                      onChange={(e) => setEtatFormData({...etatFormData, ph3_mensualite: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_ph3_attente_signer">Financement :</label>
                    <select
                      id="compte_rendu_etat_ph3_attente_signer"
                      className="form-control"
                      value={etatFormData.ph3_attente}
                      onChange={(e) => setEtatFormData({...etatFormData, ph3_attente: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      {typesFinancement.filter(t => t.etat !== 0).map(t => (
                        <option key={t.id} value={t.nom}>{t.nom}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_nbr_annee_finance_signer">Nombre de mois du crédit :</label>
                    <input
                      type="number"
                      id="compte_rendu_etat_nbr_annee_finance_signer"
                      className="form-control"
                      value={etatFormData.nbr_annee_finance}
                      onChange={(e) => setEtatFormData({...etatFormData, nbr_annee_finance: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_credit_immobilier_signer">Crédit immobilier :</label>
                    <input
                      type="number"
                      id="compte_rendu_etat_credit_immobilier_signer"
                      className="form-control"
                      value={etatFormData.credit_immobilier}
                      onChange={(e) => setEtatFormData({...etatFormData, credit_immobilier: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_credit_autre_signer">Autre crédit :</label>
                    <input
                      type="number"
                      id="compte_rendu_etat_credit_autre_signer"
                      className="form-control"
                      value={etatFormData.credit_autre}
                      onChange={(e) => setEtatFormData({...etatFormData, credit_autre: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_conf_commentaire_signer">Compte rendu :</label>
                    <textarea
                      id="compte_rendu_etat_conf_commentaire_signer"
                      className="form-control"
                      rows="4"
                      value={etatFormData.conf_commentaire_produit}
                      onChange={(e) => setEtatFormData({...etatFormData, conf_commentaire_produit: e.target.value})}
                      placeholder="Saisissez votre compte rendu commercial..."
                    />
                  </div>

                  <div className="form-actions">
                    <button className="btn-confirm" onClick={handleEtatSubmit} disabled={etatSubmitting || isChangementEtatBloque}>{etatSubmitting ? 'Enregistrement…' : 'Enregistrer'}</button>
                    <button className="btn-cancel" onClick={() => {
                      setSelectedEtat(null);
                      setCompteRenduOption('');
                      setEtatFormData({
                        ...etatFormData,
                        date_sign_date: '', date_sign_time: '', produit: '', id_sous_etat: '', id_commercial: '', 
                        id_commercial_2: '', pseudo: '', ph3_pac: 'reau', ph3_rr_model: '', ph3_puissance: '', 
                        ph3_ballon: '', ph3_marque_ballon: '', ph3_alimentation: '', ph3_type: '', ph3_prix: '', 
                        ph3_installateur: '', conf_consommations: '', ph3_bonus_30: '', valeur_mensualite: '', 
                        ph3_mensualite: '', ph3_attente: '', nbr_annee_finance: '', credit_immobilier: '', 
                        credit_autre: '', conf_commentaire_produit: ''
                      });
                    }}>Annuler</button>
                  </div>
                </div>
              </div>
            )}

            {/* Formulaire pour états 9, 12, 23, 34 pour commerciaux */}
            {[9, 12, 23, 34].includes(selectedEtat) && (editingCompteRendu || !(ficheData?.comptes_rendus && ficheData.comptes_rendus.some(cr => cr.statut === 'pending'))) && (
              <div className="fiche-section etat-change-section" style={{ marginTop: '20px' }}>
                <div className="etat-form">
                  <h3>Commentaire</h3>
                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_conf_commentaire_simple">Compte rendu :</label>
                    <textarea
                      id="compte_rendu_etat_conf_commentaire_simple"
                      className="form-control"
                      rows="4"
                      value={etatFormData.conf_commentaire_produit}
                      onChange={(e) => setEtatFormData({...etatFormData, conf_commentaire_produit: e.target.value})}
                      placeholder="Saisissez votre compte rendu commercial..."
                    />
                  </div>
                  <div className="form-actions">
                    <button className="btn-confirm" onClick={handleEtatSubmit} disabled={etatSubmitting || isChangementEtatBloque}>{etatSubmitting ? 'Enregistrement…' : 'Enregistrer'}</button>
                    <button className="btn-cancel" onClick={() => {
                      setSelectedEtat(null);
                      setCompteRenduOption('');
                      setEtatFormData({...etatFormData, conf_commentaire_produit: ''});
                    }}>Annuler</button>
                  </div>
                </div>
              </div>
            )}

            {/* Formulaire ANNULER À REPROGRAMMER (état 8) pour commerciaux */}
            {selectedEtat === 8 && (editingCompteRendu || !(ficheData?.comptes_rendus && ficheData.comptes_rendus.some(cr => cr.statut === 'pending'))) && (
              <div className="fiche-section etat-change-section" style={{ marginTop: '20px' }}>
                <div className="etat-form">
                  {/* Pour l'option "Porte / Imprévu / NRP", le commercial ne remplit que le commentaire.
                      Les autres champs seront saisis dans la page Compte Rendu. */}
                  {Number(user?.fonction) === 5 && compteRenduOption === 'porte_imprevu_nrp' ? null : (
                    <>
                      {sousEtats.length > 0 && (
                        <div className="form-group">
                          <label htmlFor="compte_rendu_etat_id_sous_etat_8">Sous État :</label>
                          <select
                            id="compte_rendu_etat_id_sous_etat_8"
                            className="form-control"
                            value={etatFormData.id_sous_etat}
                            onChange={(e) => setEtatFormData({ ...etatFormData, id_sous_etat: e.target.value })}
                          >
                            <option value="">Sélectionner</option>
                            {sousEtats.map((setat) => (
                              <option key={setat.id} value={setat.id}>
                                {setat.titre}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="form-group">
                        <label htmlFor="compte_rendu_etat_conf_rdv_avec_8">Appel Avec :</label>
                        <select
                          id="compte_rendu_etat_conf_rdv_avec_8"
                          className="form-control"
                          value={etatFormData.conf_rdv_avec}
                          onChange={(e) => setEtatFormData({ ...etatFormData, conf_rdv_avec: e.target.value })}
                        >
                          <option value="">Sélectionner</option>
                          <option value="MR">MR</option>
                          <option value="MME">MME</option>
                          <option value="AUTRE">AUTRE</option>
                        </select>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="compte_rendu_etat_conf_rdv_date_8">A Rappeler Le :</label>
                          <input
                            type="date"
                            id="compte_rendu_etat_conf_rdv_date_8"
                            className="form-control"
                            value={etatFormData.conf_rdv_date}
                            onChange={(e) => setEtatFormData({ ...etatFormData, conf_rdv_date: e.target.value })}
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="compte_rendu_etat_conf_rdv_time_8">Heure :</label>
                          <input
                            type="time"
                            id="compte_rendu_etat_conf_rdv_time_8"
                            className="form-control"
                            value={etatFormData.conf_rdv_time}
                            onChange={(e) => setEtatFormData({ ...etatFormData, conf_rdv_time: e.target.value })}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label htmlFor="compte_rendu_etat_conf_commentaire_8">Compte rendu :</label>
                    <textarea
                      id="compte_rendu_etat_conf_commentaire_8"
                      className="form-control"
                      rows="4"
                      value={etatFormData.conf_commentaire_produit}
                      onChange={(e) => setEtatFormData({...etatFormData, conf_commentaire_produit: e.target.value})}
                      placeholder="Saisissez votre compte rendu commercial..."
                    />
                  </div>

                  <div className="form-actions">
                    <button className="btn-confirm" onClick={handleEtatSubmit} disabled={etatSubmitting || isChangementEtatBloque}>{etatSubmitting ? 'Enregistrement…' : 'Enregistrer'}</button>
                    <button className="btn-cancel" onClick={() => {
                      setSelectedEtat(null);
                      setCompteRenduOption('');
                      setEtatFormData({...etatFormData, conf_rdv_date: '', conf_rdv_time: '', id_sous_etat: '', conf_rdv_avec: '', conf_commentaire_produit: ''});
                    }}>Annuler</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Permissions pour changer l'état :
            - Admins (1, 2, 7), Backoffice (11) : peuvent changer vers tous les états (y compris fiche confirmée)
            - Superviseur Qualification (2) : peuvent changer les fiches des agents sous leur responsabilité
            - RP Qualification (12) : peuvent changer les fiches des agents sous la responsabilité de leurs superviseurs
            - Agents (3) : peuvent changer les fiches de leur centre
            - Confirmateurs (6), RE Confirmation (14), RP Confirmation (13) : peuvent changer l'état (y compris si fiche déjà confirmée) */}
        {!(isModal && isQualiteQualif) && ((Number(user?.fonction) === 1 || Number(user?.fonction) === 2 || Number(user?.fonction) === 7 || Number(user?.fonction) === 8 || Number(user?.fonction) === 11 || Number(user?.fonction) === 12) ||
          (Number(user?.fonction) === 3 && user?.centre === ficheData?.id_centre) ||
          (Number(user?.fonction) === 6 || Number(user?.fonction) === 14 || Number(user?.fonction) === 13)) && (
          <div className="fiche-section etat-change-section">
            <h2 className="section-title">Changer l'état de la fiche</h2>
            <div className="etat-change-form">
              <div className="form-group">
                <label htmlFor="id_etat_final">Nouvel état :</label>
                <select
                  id="id_etat_final"
                  className="form-control"
                  value={selectedEtat != null ? String(selectedEtat) : ''}
                  disabled={isChangementEtatBloque}
                  onChange={(e) => handleEtatChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                >
                  <option value="">Choisissez un état</option>
                  {/* Afficher l'état actuel comme option visible dans la liste (surtout pour les confirmateurs) */}
                  {fiche.id_etat_final && (() => {
                    const etatActuel = etats?.find(e => e.id === fiche.id_etat_final);
                    if (!etatActuel) return null;
                    // Vérifier si l'état actuel n'est pas déjà dans les listes de phases
                    const isInPhases = [...etatsPhase0, ...etatsPhase1, ...etatsPhase2, ...etatsPhase3].some(e => e.id === etatActuel.id);
                    // Si l'état actuel n'est pas dans les phases, l'afficher dans un groupe séparé pour qu'il soit toujours visible
                    if (!isInPhases) {
                      return (
                        <optgroup label="État actuel">
                          <option 
                            value={etatActuel.id} 
                            style={{ 
                              backgroundColor: etatActuel.color || '#cccccc', 
                              color: (etatActuel.color === '#ffffff' || etatActuel.color === '#fff') ? '#000' : '#fff',
                              fontWeight: 'bold'
                            }}
                          >
                            {etatActuel.titre} (actuel)
                          </option>
                        </optgroup>
                      );
                    }
                    return null; // Déjà affiché dans les phases
                  })()}
                  {!isAdminSession && etatsPhase0.length > 0 && (
                    <optgroup label="PHASE 0">
                      {etatsPhase0.map(etat => (
                        <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc', color: (etat.color === '#ffffff' || etat.color === '#fff') ? '#000' : '#fff' }}>
                          {etat.titre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {etatsPhase1.length > 0 && (
                    <optgroup label="PHASE 1">
                      {etatsPhase1.map(etat => (
                        <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc', color: (etat.color === '#ffffff' || etat.color === '#fff') ? '#000' : '#fff' }}>
                          {etat.titre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {etatsPhase2.length > 0 && (
                    <optgroup label="PHASE 2">
                      {etatsPhase2.map(etat => (
                        <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc', color: (etat.color === '#ffffff' || etat.color === '#fff') ? '#000' : '#fff' }}>
                          {etat.titre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {etatsPhase3.length > 0 && (
                    <optgroup label="PHASE 3">
                      {etatsPhase3.map(etat => (
                        <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc', color: (etat.color === '#ffffff' || etat.color === '#fff') ? '#000' : '#fff' }}>
                          {etat.titre}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {isChangementEtatBloque && (
                  <p style={{ marginTop: '10px', color: '#666', fontSize: '0.9em' }}>
                    Cette fiche est dans un état définitif : le changement d&apos;état n&apos;est plus possible.
                  </p>
                )}
            </div>

            {showHistoConfirmateurDropdown && (
              <div className="form-group">
                <label htmlFor="histo_confirmateur">Confirmateur (historique)</label>
                <select
                  id="histo_confirmateur"
                  className="form-control"
                  value={histoConfirmateurId}
                  onChange={(e) => setHistoConfirmateurId(e.target.value)}
                  title="Confirmateur enregistré dans l'historique lors du changement d'état"
                >
                  <option value="">Tout</option>
                  {(confirmateurs || []).map(c => (
                    <option key={c.id} value={c.id}>{c.pseudo || `Utilisateur ${c.id}`}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Formulaire de confirmation (état 7) */}
            {selectedEtat === 7 && (
              <div className="confirmation-form">
                <h3>Informations de confirmation</h3>
                <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                  {!showConfirmConfFields ? (
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setShowConfirmConfFields(true)}
                      title="Afficher les champs conf_"
                    >
                      <FaReplyAll size={20} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setShowConfirmConfFields(false)}
                      title="Réduire les champs conf_"
                    >
                      <FaChevronUp size={20} />
                    </button>
                  )}
                </div>
                <table className="rdv-form-table">
                  <tbody>
                    <tr>
                      <td><label htmlFor="conf_produit">Étude à faire pour :</label></td>
                      <td>
                        <select
                          id="conf_produit"
                          className="form-control"
                          value={confFormData.produit}
                          onChange={(e) => setConfFormData({...confFormData, produit: e.target.value})}
                          required
                        >
                          <option value="">Sélectionner</option>
                          <option value="1">PAC</option>
                          <option value="2">PV</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_id_confirmateur">Confirmateur :</label></td>
                      <td>
                        <select
                          id="conf_id_confirmateur"
                          className="form-control"
                          value={confFormData.id_confirmateur}
                          onChange={(e) => setConfFormData({...confFormData, id_confirmateur: e.target.value})}
                          disabled={isConfirmateurSession}
                        >
                          <option value="">{isConfirmateurSession ? '—' : 'Sélectionner'}</option>
                          {isConfirmateurSession ? (
                            confFormData.id_confirmateur ? (
                              <option value={confFormData.id_confirmateur}>
                                {getConfirmateurLabel(confFormData.id_confirmateur)}
                              </option>
                            ) : null
                          ) : (
                            confirmateurs?.map(conf => (
                              <option key={conf.id} value={conf.id}>
                                {conf.pseudo}
                              </option>
                            ))
                          )}
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_id_confirmateur_2">Confirmateur 2 (optionnel) :</label></td>
                      <td>
                        <select
                          id="conf_id_confirmateur_2"
                          className="form-control"
                          value={confFormData.id_confirmateur_2}
                          onChange={(e) => setConfFormData({...confFormData, id_confirmateur_2: e.target.value})}
                          disabled={isConfirmateurSession}
                        >
                          <option value="">Aucun</option>
                          {isConfirmateurSession ? (
                            confFormData.id_confirmateur_2 ? (
                              <option value={confFormData.id_confirmateur_2}>
                                {getConfirmateurLabel(confFormData.id_confirmateur_2)}
                              </option>
                            ) : null
                          ) : (
                            confirmateurs?.map(conf => (
                              <option key={conf.id} value={conf.id}>
                                {conf.pseudo}
                              </option>
                            ))
                          )}
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_id_confirmateur_3">Confirmateur 3 (optionnel) :</label></td>
                      <td>
                        <select
                          id="conf_id_confirmateur_3"
                          className="form-control"
                          value={confFormData.id_confirmateur_3}
                          onChange={(e) => setConfFormData({...confFormData, id_confirmateur_3: e.target.value})}
                          disabled={isConfirmateurSession}
                        >
                          <option value="">Aucun</option>
                          {isConfirmateurSession ? (
                            confFormData.id_confirmateur_3 ? (
                              <option value={confFormData.id_confirmateur_3}>
                                {getConfirmateurLabel(confFormData.id_confirmateur_3)}
                              </option>
                            ) : null
                          ) : (
                            confirmateurs?.map(conf => (
                              <option key={conf.id} value={conf.id}>
                                {conf.pseudo}
                              </option>
                            ))
                          )}
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_rdv_date">Date RDV :</label></td>
                      <td>
                        <input
                          type="date"
                          id="conf_rdv_date"
                          className="form-control"
                          value={confFormData.conf_rdv_date}
                          onChange={(e) => setConfFormData({...confFormData, conf_rdv_date: e.target.value})}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_rdv_time">Heure RDV :</label></td>
                      <td>
                        <input
                          type="time"
                          id="conf_rdv_time"
                          className="form-control"
                          value={confFormData.conf_rdv_time}
                          onChange={(e) => setConfFormData({...confFormData, conf_rdv_time: e.target.value})}
                        />
                      </td>
                    </tr>
                    {showConfirmConfFields && (
                      <>
                    <tr>
                      <td><label htmlFor="conf_rdv_avec">RDV pris avec :</label></td>
                      <td>
                        <select
                          id="conf_rdv_avec"
                          className="form-control"
                          value={confFormData.conf_rdv_avec}
                          onChange={(e) => setConfFormData({...confFormData, conf_rdv_avec: e.target.value})}
                        >
                          <option value="">Sélectionner</option>
                          <option value="MR">MR</option>
                          <option value="MME">MME</option>
                          <option value="AUTRE">AUTRE</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_appel_tunisie_avec">Appel en Tunisie avec :</label></td>
                      <td>
                        <select
                          id="conf_appel_tunisie_avec"
                          className="form-control"
                          value={confFormData.conf_appel_tunisie_avec}
                          onChange={(e) => setConfFormData({...confFormData, conf_appel_tunisie_avec: e.target.value})}
                        >
                          <option value="">Sélectionner</option>
                          <option value="MR">Mr</option>
                          <option value="MME">Mme</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_deja_etude">A déjà fait une étude :</label></td>
                      <td>
                        <select
                          id="conf_deja_etude"
                          className="form-control"
                          value={confFormData.conf_deja_etude}
                          onChange={(e) => setConfFormData({...confFormData, conf_deja_etude: e.target.value})}
                        >
                          <option value="">Sélectionner</option>
                          <option value="OUI">OUI</option>
                          <option value="NON">NON</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_rdv_annule_precedent">RDV déjà annulé précédemment :</label></td>
                      <td>
                        <select
                          id="conf_rdv_annule_precedent"
                          className="form-control"
                          value={confFormData.conf_rdv_annule_precedent}
                          onChange={(e) => setConfFormData({...confFormData, conf_rdv_annule_precedent: e.target.value})}
                        >
                          <option value="">Sélectionner</option>
                          <option value="OUI">OUI</option>
                          <option value="NON">NON</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_presence_couple">Présence du couple ou célibataire :</label></td>
                      <td>
                        <select
                          id="conf_presence_couple"
                          className="form-control"
                          value={confFormData.conf_presence_couple}
                          onChange={(e) => setConfFormData({...confFormData, conf_presence_couple: e.target.value})}
                        >
                          <option value="">Sélectionner</option>
                          <option value="OUI">OUI</option>
                          <option value="NON">NON</option>
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><label>Profession MR :</label></td>
                      <td>
                        <div className="autocomplete-wrap">
                          <input
                            type="text"
                            className="autocomplete-input"
                            placeholder="Rechercher ou saisir une profession..."
                            autoComplete="off"
                            value={confProfMrDisplay}
                            onChange={(e) => {
                              const v = e.target.value;
                              setConfProfMrDisplay(v);
                              const match = professions?.find(p => (p.nom || '') === v);
                              if (!match && confFormData.conf_profession_monsieur) {
                                setConfFormData(prev => ({ ...prev, conf_profession_monsieur: '' }));
                              }
                            }}
                            onFocus={() => setShowSuggestionsMr(true)}
                            onBlur={() => setTimeout(() => setShowSuggestionsMr(false), 200)}
                          />
                          <div className={`autocomplete-suggestions ${showSuggestionsMr ? 'active' : ''}`}>
                            {(professions || [])
                              .filter(p => !confProfMrDisplay || (p.nom || '').toLowerCase().includes(confProfMrDisplay.toLowerCase()))
                              .slice(0, 50)
                              .map(prof => (
                                <div
                                  key={prof.id}
                                  onMouseDown={(e) => { e.preventDefault(); setConfFormData(prev => ({ ...prev, conf_profession_monsieur: String(prof.id) })); setConfProfMrDisplay(prof.nom || ''); setShowSuggestionsMr(false); }}
                                >
                                  {prof.nom}
                                </div>
                              ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_type_contrat_mr">Type de Contrat MR :</label></td>
                      <td>
                        <select
                          id="conf_type_contrat_mr"
                          className="form-control"
                          value={confFormData.conf_type_contrat_mr}
                          onChange={(e) => setConfFormData({...confFormData, conf_type_contrat_mr: e.target.value})}
                        >
                          <option value="">Sélectionner</option>
                          {(typeContrat || []).map(t => (
                            <option key={t.id} value={t.id}>{t.nom}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><label>Profession MME :</label></td>
                      <td>
                        <div className="autocomplete-wrap">
                          <input
                            type="text"
                            className="autocomplete-input"
                            placeholder="Rechercher ou saisir une profession..."
                            autoComplete="off"
                            value={confProfMmeDisplay}
                            onChange={(e) => {
                              const v = e.target.value;
                              setConfProfMmeDisplay(v);
                              const match = professions?.find(p => (p.nom || '') === v);
                              if (!match && confFormData.conf_profession_madame) {
                                setConfFormData(prev => ({ ...prev, conf_profession_madame: '' }));
                              }
                            }}
                            onFocus={() => setShowSuggestionsMme(true)}
                            onBlur={() => setTimeout(() => setShowSuggestionsMme(false), 200)}
                          />
                          <div className={`autocomplete-suggestions ${showSuggestionsMme ? 'active' : ''}`}>
                            {(professions || [])
                              .filter(p => !confProfMmeDisplay || (p.nom || '').toLowerCase().includes(confProfMmeDisplay.toLowerCase()))
                              .slice(0, 50)
                              .map(prof => (
                                <div
                                  key={prof.id}
                                  onMouseDown={(e) => { e.preventDefault(); setConfFormData(prev => ({ ...prev, conf_profession_madame: String(prof.id) })); setConfProfMmeDisplay(prof.nom || ''); setShowSuggestionsMme(false); }}
                                >
                                  {prof.nom}
                                </div>
                              ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_type_contrat_madame">Type de Contrat MME :</label></td>
                      <td>
                        <select
                          id="conf_type_contrat_madame"
                          className="form-control"
                          value={confFormData.conf_type_contrat_madame}
                          onChange={(e) => setConfFormData({...confFormData, conf_type_contrat_madame: e.target.value})}
                        >
                          <option value="">Sélectionner</option>
                          {(typeContrat || []).map(t => (
                            <option key={t.id} value={t.id}>{t.nom}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_revenu">Revenu :</label></td>
                      <td>
                        <input
                          type="text"
                          id="conf_revenu"
                          className="form-control"
                          value={confFormData.conf_revenu}
                          onChange={(e) => setConfFormData({...confFormData, conf_revenu: e.target.value})}
                          placeholder="Revenu"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_credit">Crédit :</label></td>
                      <td>
                        <input
                          type="text"
                          id="conf_credit"
                          className="form-control"
                          value={confFormData.conf_credit}
                          onChange={(e) => setConfFormData({...confFormData, conf_credit: e.target.value})}
                          placeholder="Crédit"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_consommation_electricite_gen">Consommations électrique :</label></td>
                      <td>
                        <input
                          type="text"
                          id="conf_consommation_electricite_gen"
                          className="form-control"
                          value={confFormData.conf_consommation_electricite}
                          onChange={(e) => setConfFormData({...confFormData, conf_consommation_electricite: e.target.value})}
                          placeholder="Ex: 800 €/an"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_consommation_chauffage_gen">Consommations chauffage :</label></td>
                      <td>
                        <input
                          type="text"
                          id="conf_consommation_chauffage_gen"
                          className="form-control"
                          value={confFormData.conf_consommation_chauffage}
                          onChange={(e) => setConfFormData({...confFormData, conf_consommation_chauffage: e.target.value})}
                          placeholder="Ex: 1500 €/an"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_mode_chauffage_gen">Mode de chauffage :</label></td>
                      <td>
                        <select
                          id="conf_mode_chauffage_gen"
                          className="form-control"
                          value={confFormData.conf_mode_chauffage}
                          onChange={(e) => setConfFormData({...confFormData, conf_mode_chauffage: e.target.value})}
                        >
                          <option value="">Sélectionner</option>
                          {(modeChauffage || []).map(mode => (
                            <option key={mode.id} value={mode.id}>{mode.nom || mode.titre || `Mode ${mode.id}`}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td><label htmlFor="conf_complement_chauffage_gen">Complément de chauffage :</label></td>
                      <td>
                        <input
                          type="text"
                          id="conf_complement_chauffage_gen"
                          className="form-control"
                          value={confFormData.conf_complement_chauffage || ''}
                          onChange={(e) => setConfFormData({ ...confFormData, conf_complement_chauffage: e.target.value })}
                          placeholder="Ex. appoint électrique, poêle…"
                        />
                      </td>
                    </tr>

                    {/* Champs spécifiques PAC */}
                    {confFormData.produit === '1' && (
                      <>
                        <tr>
                          <td><label htmlFor="conf_annee_systeme_chauffage">Année du système de chauffage :</label></td>
                          <td>
                            <input
                              type="number"
                              id="conf_annee_systeme_chauffage"
                              className="form-control"
                              value={confFormData.annee_systeme_chauffage}
                              onChange={(e) => setConfFormData({...confFormData, annee_systeme_chauffage: e.target.value})}
                              placeholder="Ex: 2010"
                              min="1970"
                              max={new Date().getFullYear()}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td><label htmlFor="conf_surface_chauffee">Surface chauffée (m²) :</label></td>
                          <td>
                            <input
                              type="number"
                              id="conf_surface_chauffee"
                              className="form-control"
                              value={confFormData.surface_chauffee}
                              onChange={(e) => setConfFormData({...confFormData, surface_chauffee: e.target.value})}
                              placeholder="Ex: 100"
                              min="0"
                            />
                          </td>
                        </tr>
                        <tr>
                          <td><label htmlFor="conf_consommation_chauffage">Consommation chauffage (€) :</label></td>
                          <td>
                            <input
                              type="text"
                              id="conf_consommation_chauffage"
                              className="form-control"
                              value={confFormData.consommation_chauffage}
                              onChange={(e) => setConfFormData({...confFormData, consommation_chauffage: e.target.value})}
                              placeholder="Ex: 1500 €/an"
                            />
                          </td>
                        </tr>
                      </>
                    )}

                    {/* Champs spécifiques PV */}
                    {confFormData.produit === '2' && (
                      <>
                        <tr>
                          <td><label htmlFor="conf_orientation_toiture">Orientation toiture :</label></td>
                          <td>
                            <input
                              type="text"
                              id="conf_orientation_toiture"
                              className="form-control"
                              value={confFormData.conf_orientation_toiture || ''}
                              onChange={(e) => setConfFormData({...confFormData, conf_orientation_toiture: e.target.value})}
                              placeholder="Ex: Sud, Nord-Est..."
                            />
                          </td>
                        </tr>
                        <tr>
                          <td><label htmlFor="conf_zones_ombres">Zones ombres :</label></td>
                          <td>
                            <input
                              type="text"
                              id="conf_zones_ombres"
                              className="form-control"
                              value={confFormData.conf_zones_ombres}
                              onChange={(e) => setConfFormData({...confFormData, conf_zones_ombres: e.target.value})}
                              placeholder="Ex: Arbres, cheminée, bâtiment voisin..."
                            />
                          </td>
                        </tr>
                        <tr>
                          <td><label htmlFor="conf_site_classe">Proche d'un site classé :</label></td>
                          <td>
                            <select
                              id="conf_site_classe"
                              className="form-control"
                              value={confFormData.conf_site_classe}
                              onChange={(e) => setConfFormData({...confFormData, conf_site_classe: e.target.value})}
                            >
                              <option value="">Sélectionner</option>
                              <option value="OUI">OUI</option>
                              <option value="NON">NON</option>
                            </select>
                          </td>
                        </tr>
                        <tr>
                          <td><label htmlFor="conf_nb_pans">Nombre de pans :</label></td>
                          <td>
                            <input
                              type="number"
                              id="conf_nb_pans"
                              className="form-control"
                              min="1"
                              value={confFormData.nb_pans}
                              onChange={(e) => setConfFormData({...confFormData, nb_pans: e.target.value})}
                            />
                          </td>
                        </tr>
                      </>
                    )}
                      </>
                    )}

                    <tr>
                      <td><label htmlFor="conf_commentaire_produit">Commentaire :</label></td>
                      <td>
                        <textarea
                          id="conf_commentaire_produit"
                          className="form-control"
                          rows="4"
                          value={confFormData.conf_commentaire_produit}
                          onChange={(e) => setConfFormData({...confFormData, conf_commentaire_produit: e.target.value})}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="form-actions">
                  <button
                    className="btn-confirm"
                    onClick={handleConfirmSubmit}
                  >
                    Confirmer
                  </button>
                  <button
                    className="btn-cancel"
                    onClick={() => {
                      setSelectedEtat(null);
                      setConfFormData({
                        produit: '',
                        id_confirmateur: '',
                        id_confirmateur_2: '',
                        id_confirmateur_3: '',
                        conf_rdv_date: '',
                        conf_rdv_time: '',
                        conf_rdv_avec: '',
                        conf_orientation_toiture: '',
                        conf_zones_ombres: '',
                        conf_site_classe: '',
                        conf_consommation_electricite: '',
                        conf_mode_chauffage: '',
                        conf_complement_chauffage: '',
                        annee_systeme_chauffage: '',
                        surface_chauffee: '',
                        consommation_chauffage: '',
                        nb_pans: '',
                        conf_commentaire_produit: ''
                      });
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Formulaire NRP (état 2) */}
            {selectedEtat === 2 && (
              <div className="nrp-form" style={{ marginTop: '20px' }}>
                <h3>Informations NRP</h3>

                <div className="form-group">
                  <label htmlFor="nrp_id_sous_etat">Sous État :</label>
                  <select
                    id="nrp_id_sous_etat"
                    className="form-control"
                    value={nrpFormData.id_sous_etat}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedSousEtat = sousEtats.find(se => String(se.id) === String(selectedId));
                      setNrpFormData({
                        ...nrpFormData,
                        id_sous_etat: selectedId,
                        // Préremplit le commentaire avec le sous-état choisi.
                        // Le confirmateur peut ensuite le modifier librement.
                        conf_commentaire_produit: selectedSousEtat?.titre || ''
                      });
                    }}
                  >
                    <option value="">Sélectionner</option>
                    {sousEtats.map(setat => (
                      <option key={setat.id} value={setat.id}>
                        {setat.titre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="nrp_conf_commentaire_produit">Commentaire :</label>
                  <textarea
                    id="nrp_conf_commentaire_produit"
                    className="form-control"
                    rows="4"
                    value={nrpFormData.conf_commentaire_produit}
                    onChange={(e) => setNrpFormData({...nrpFormData, conf_commentaire_produit: e.target.value})}
                  />
                </div>

                <div className="form-actions">
                  <button
                    className="btn-confirm"
                    onClick={handleEtatSubmit}
                    disabled={etatSubmitting || isChangementEtatBloque}
                  >
                    {etatSubmitting ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <button
                    className="btn-cancel"
                    onClick={() => {
                      setSelectedEtat(null);
                      setNrpFormData({
                        date_appel_date: '',
                        date_appel_time: '',
                        id_sous_etat: '',
                        conf_commentaire_produit: ''
                      });
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Formulaire ANNULER À REPROGRAMMER (état 8) - visible aussi pour commerciaux (mais seulement si pas déjà dans section compte rendu) */}
            {selectedEtat === 8 && !(user?.fonction === 5 && compteRenduOption) && (
              <div className="etat-form" style={{ marginTop: '20px' }}>
                <h3>Informations Annuler à Reprogrammer</h3>
                
                {sousEtats.length > 0 && (
                  <div className="form-group">
                    <label htmlFor="etat_id_sous_etat_8">Sous État :</label>
                    <select
                      id="etat_id_sous_etat_8"
                      className="form-control"
                      value={etatFormData.id_sous_etat}
                      onChange={(e) => setEtatFormData({...etatFormData, id_sous_etat: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      {sousEtats.map(setat => (
                        <option key={setat.id} value={setat.id}>
                          {setat.titre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="etat_conf_rdv_avec_8">Appel Avec :</label>
                  <select
                    id="etat_conf_rdv_avec_8"
                    className="form-control"
                    value={etatFormData.conf_rdv_avec}
                    onChange={(e) => setEtatFormData({...etatFormData, conf_rdv_avec: e.target.value})}
                  >
                    <option value="">Sélectionner</option>
                    <option value="MR">MR</option>
                    <option value="MME">MME</option>
                    <option value="AUTRE">AUTRE</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="etat_conf_rdv_date_8">A Rappeler Le :</label>
                    <input
                      type="date"
                      id="etat_conf_rdv_date_8"
                      className="form-control"
                      value={etatFormData.conf_rdv_date}
                      onChange={(e) => setEtatFormData({...etatFormData, conf_rdv_date: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="etat_conf_rdv_time_8">Heure :</label>
                    <input
                      type="time"
                      id="etat_conf_rdv_time_8"
                      className="form-control"
                      value={etatFormData.conf_rdv_time}
                      onChange={(e) => setEtatFormData({...etatFormData, conf_rdv_time: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="etat_conf_commentaire_8">Commentaire :</label>
                  <textarea
                    id="etat_conf_commentaire_8"
                    className="form-control"
                    rows="4"
                    value={etatFormData.conf_commentaire_produit}
                    onChange={(e) => setEtatFormData({...etatFormData, conf_commentaire_produit: e.target.value})}
                  />
                </div>

                <div className="form-actions">
                  <button className="btn-confirm" onClick={handleEtatSubmit} disabled={etatSubmitting || isChangementEtatBloque}>{etatSubmitting ? 'Enregistrement…' : 'Enregistrer'}</button>
                  <button className="btn-cancel" onClick={() => {
                    setSelectedEtat(null);
                    setEtatFormData({...etatFormData, conf_rdv_date: '', conf_rdv_time: '', id_sous_etat: '', conf_rdv_avec: '', conf_commentaire_produit: ''});
                  }}>Annuler</button>
                </div>
              </div>
            )}

            {/* Formulaire RAPPEL POUR BUREAU (état 19) */}
            {selectedEtat === 19 && (
              <div className="etat-form" style={{ marginTop: '20px' }}>
                <h3>Informations Rappel pour Bureau</h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="etat_date_rappel_date_19">A Rappeler Le :</label>
                    <input
                      type="date"
                      id="etat_date_rappel_date_19"
                      className="form-control"
                      value={etatFormData.date_rappel_date}
                      onChange={(e) => setEtatFormData({...etatFormData, date_rappel_date: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="etat_date_rappel_time_19">Heure :</label>
                    <input
                      type="time"
                      id="etat_date_rappel_time_19"
                      className="form-control"
                      value={etatFormData.date_rappel_time}
                      onChange={(e) => setEtatFormData({...etatFormData, date_rappel_time: e.target.value})}
                    />
                  </div>
                </div>

                {sousEtats.length > 0 && (
                  <div className="form-group">
                    <label htmlFor="etat_id_sous_etat_19">Sous État :</label>
                    <select
                      id="etat_id_sous_etat_19"
                      className="form-control"
                      value={etatFormData.id_sous_etat}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const selectedSousEtat = sousEtats.find(se => String(se.id) === String(selectedId));
                        setEtatFormData({
                          ...etatFormData,
                          id_sous_etat: selectedId,
                          // Préremplit le commentaire avec le sous-état choisi.
                          // Le confirmateur peut ensuite le modifier librement.
                          motif_qualif: selectedSousEtat?.titre || ''
                        });
                      }}
                    >
                      <option value="">Sélectionner</option>
                      {sousEtats.map(setat => (
                        <option key={setat.id} value={setat.id}>
                          {setat.titre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="etat_conf_commentaire_19">Commentaire :</label>
                  <textarea
                    id="etat_conf_commentaire_19"
                    className="form-control"
                    rows="4"
                    value={etatFormData.motif_qualif}
                    onChange={(e) => setEtatFormData({...etatFormData, motif_qualif: e.target.value})}
                  />
                </div>

                <div className="form-actions">
                  <button className="btn-confirm" onClick={handleEtatSubmit} disabled={etatSubmitting || isChangementEtatBloque}>{etatSubmitting ? 'Enregistrement…' : 'Enregistrer'}</button>
                  <button className="btn-cancel" onClick={() => {
                    setSelectedEtat(null);
                    setEtatFormData({...etatFormData, date_rappel_date: '', date_rappel_time: '', id_sous_etat: '', conf_commentaire_produit: '', motif_qualif: ''});
                  }}>Annuler</button>
                </div>
              </div>
            )}

            {/* Formulaire SIGNER (états 13, 44, 45) - visible aussi pour commerciaux (mais seulement si pas déjà dans section compte rendu) */}
            {[13, 44, 45].includes(selectedEtat) && !(user?.fonction === 5 && compteRenduOption) && (
              <div className="etat-form" style={{ marginTop: '20px' }}>
                <h3>Informations Signature</h3>
                
                <div className="form-group">
                  <label htmlFor="etat_produit_signer">Signature pour :</label>
                  <select
                    id="etat_produit_signer"
                    className="form-control"
                    value={etatFormData.produit}
                    onChange={(e) => setEtatFormData({...etatFormData, produit: e.target.value})}
                  >
                    <option value="">Sélectionner</option>
                    {produits?.map(prod => (
                      <option key={prod.id} value={prod.id}>
                        {prod.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="etat_date_sign_date">Signé le :</label>
                    <input
                      type="date"
                      id="etat_date_sign_date"
                      className="form-control"
                      value={etatFormData.date_sign_date}
                      onChange={(e) => setEtatFormData({...etatFormData, date_sign_date: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="etat_date_sign_time">Heure :</label>
                    <input
                      type="time"
                      id="etat_date_sign_time"
                      className="form-control"
                      value={etatFormData.date_sign_time}
                      onChange={(e) => setEtatFormData({...etatFormData, date_sign_time: e.target.value})}
                    />
                  </div>
                </div>

                {sousEtats.length > 0 && (
                  <div className="form-group">
                    <label htmlFor="etat_id_sous_etat_signer">Sous État :</label>
                    <select
                      id="etat_id_sous_etat_signer"
                      className="form-control"
                      value={etatFormData.id_sous_etat}
                      onChange={(e) => setEtatFormData({...etatFormData, id_sous_etat: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      {sousEtats.map(setat => (
                        <option key={setat.id} value={setat.id}>
                          {setat.titre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="etat_id_commercial_signer">Commercial :</label>
                  <select
                    id="etat_id_commercial_signer"
                    className="form-control"
                    value={etatFormData.id_commercial}
                    onChange={(e) => setEtatFormData({...etatFormData, id_commercial: e.target.value})}
                  >
                    <option value="">Sélectionner</option>
                    {commerciaux?.map(com => (
                      <option key={com.id} value={com.id}>
                        {com.pseudo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="etat_id_commercial_2_signer">Commercial 2 (optionnel) :</label>
                  <select
                    id="etat_id_commercial_2_signer"
                    className="form-control"
                    value={etatFormData.id_commercial_2}
                    onChange={(e) => setEtatFormData({...etatFormData, id_commercial_2: e.target.value})}
                  >
                    <option value="">Aucun</option>
                    {commerciaux?.map(com => (
                      <option key={com.id} value={com.id}>
                        {com.pseudo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="etat_pseudo_signer">Pseudo :</label>
                  <input
                    type="text"
                    id="etat_pseudo_signer"
                    className="form-control"
                    value={etatFormData.pseudo}
                    onChange={(e) => setEtatFormData({...etatFormData, pseudo: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="etat_ph3_pac_signer">Pac :</label>
                  <select
                    id="etat_ph3_pac_signer"
                    className="form-control"
                    value={etatFormData.ph3_pac}
                    onChange={(e) => setEtatFormData({...etatFormData, ph3_pac: e.target.value})}
                  >
                    <option value="reau">R/EAU</option>
                    <option value="rr">R/R</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="etat_ph3_rr_model_signer">Marque Pac :</label>
                  <input
                    type="text"
                    id="etat_ph3_rr_model_signer"
                    className="form-control"
                    value={etatFormData.ph3_rr_model}
                    onChange={(e) => setEtatFormData({...etatFormData, ph3_rr_model: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="etat_ph3_puissance_signer">Puissance :</label>
                  <select
                    id="etat_ph3_puissance_signer"
                    className="form-control"
                    value={etatFormData.ph3_puissance}
                    onChange={(e) => setEtatFormData({...etatFormData, ph3_puissance: e.target.value})}
                  >
                    <option value="">Sélectionner</option>
                    <option value="11kw">11kw</option>
                    <option value="14kw">14kw</option>
                    <option value="16kw">16kw</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="etat_ph3_ballon_signer">Ballon :</label>
                  <select
                    id="etat_ph3_ballon_signer"
                    className="form-control"
                    value={etatFormData.ph3_ballon}
                    onChange={(e) => setEtatFormData({...etatFormData, ph3_ballon: e.target.value})}
                  >
                    <option value="">Sélectionner</option>
                    <option value="Avec Ballon">Avec Ballon</option>
                    <option value="Sans Ballon">Sans Ballon</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="etat_ph3_marque_ballon_signer">Marque ballon :</label>
                  <input
                    type="text"
                    id="etat_ph3_marque_ballon_signer"
                    className="form-control"
                    value={etatFormData.ph3_marque_ballon}
                    onChange={(e) => setEtatFormData({...etatFormData, ph3_marque_ballon: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="etat_ph3_alimentation_signer">Alimentation :</label>
                  <select
                    id="etat_ph3_alimentation_signer"
                    className="form-control"
                    value={etatFormData.ph3_alimentation}
                    onChange={(e) => setEtatFormData({...etatFormData, ph3_alimentation: e.target.value})}
                  >
                    <option value="">Sélectionner</option>
                    <option value="mono">mono</option>
                    <option value="triphase">triphase</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="etat_ph3_type_signer">Type :</label>
                  <select
                    id="etat_ph3_type_signer"
                    className="form-control"
                    value={etatFormData.ph3_type}
                    onChange={(e) => setEtatFormData({...etatFormData, ph3_type: e.target.value})}
                  >
                    <option value="">Sélectionner</option>
                    <option value="Radiateur">Radiateur</option>
                    <option value="Plancher chauffant">Plancher chauffant</option>
                    <option value="Bizone">Bizone</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="etat_ph3_prix_signer">Prix En € :</label>
                  <input
                    type="number"
                    id="etat_ph3_prix_signer"
                    className="form-control"
                    value={etatFormData.ph3_prix}
                    onChange={(e) => setEtatFormData({...etatFormData, ph3_prix: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="etat_ph3_installateur_signer">Installateur :</label>
                  <select
                    id="etat_ph3_installateur_signer"
                    className="form-control"
                    value={etatFormData.ph3_installateur}
                    onChange={(e) => setEtatFormData({...etatFormData, ph3_installateur: e.target.value})}
                  >
                    <option value="">Sélectionner</option>
                    {installateurs?.map(inst => (
                      <option key={inst.id} value={inst.id}>
                        {inst.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="etat_conf_consommations_signer">Conso actuelle du client (par mois) :</label>
                  <input
                    type="number"
                    id="etat_conf_consommations_signer"
                    className="form-control"
                    value={etatFormData.conf_consommations}
                    onChange={(e) => setEtatFormData({...etatFormData, conf_consommations: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="etat_ph3_bonus_30_signer">Bonus :</label>
                  <select
                    id="etat_ph3_bonus_30_signer"
                    className="form-control"
                    value={etatFormData.ph3_bonus_30}
                    onChange={(e) => setEtatFormData({...etatFormData, ph3_bonus_30: e.target.value})}
                  >
                    <option value="">Sélectionner</option>
                    <option value="100€ (conso inf 1500€)">100€ (conso inf 1500€)</option>
                    <option value="20% (conso sup ou égale 1500€)">20% (conso sup ou égale 1500€)</option>
                    <option value="30% (conso sup ou égale 3000€)">30% (conso sup ou égale 3000€)</option>
                    <option value="12k reste à charge (74 ans et +)">12k reste à charge (74 ans et +)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="etat_valeur_mensualite_signer">Reste à charge après bonus (par mois) :</label>
                  <input
                    type="number"
                    id="etat_valeur_mensualite_signer"
                    className="form-control"
                    value={etatFormData.valeur_mensualite}
                    onChange={(e) => setEtatFormData({...etatFormData, valeur_mensualite: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="etat_ph3_mensualite_signer">Mensualité du Crédit :</label>
                  <input
                    type="number"
                    id="etat_ph3_mensualite_signer"
                    className="form-control"
                    value={etatFormData.ph3_mensualite}
                    onChange={(e) => setEtatFormData({...etatFormData, ph3_mensualite: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="etat_ph3_attente_signer">Financement :</label>
                  <select
                    id="etat_ph3_attente_signer"
                    className="form-control"
                    value={etatFormData.ph3_attente}
                    onChange={(e) => setEtatFormData({...etatFormData, ph3_attente: e.target.value})}
                  >
                    <option value="">Sélectionner</option>
                    {typesFinancement.filter(t => t.etat !== 0).map(t => (
                      <option key={t.id} value={t.nom}>{t.nom}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="etat_nbr_annee_finance_signer">Nombre de mois du crédit :</label>
                  <input
                    type="number"
                    id="etat_nbr_annee_finance_signer"
                    className="form-control"
                    value={etatFormData.nbr_annee_finance}
                    onChange={(e) => setEtatFormData({...etatFormData, nbr_annee_finance: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="etat_credit_immobilier_signer">Crédit immobilier :</label>
                  <input
                    type="number"
                    id="etat_credit_immobilier_signer"
                    className="form-control"
                    value={etatFormData.credit_immobilier}
                    onChange={(e) => setEtatFormData({...etatFormData, credit_immobilier: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="etat_credit_autre_signer">Autre crédit :</label>
                  <input
                    type="number"
                    id="etat_credit_autre_signer"
                    className="form-control"
                    value={etatFormData.credit_autre}
                    onChange={(e) => setEtatFormData({...etatFormData, credit_autre: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="etat_conf_commentaire_signer">
                    {user?.fonction === 5 ? 'Compte rendu :' : 'Commentaire :'}
                  </label>
                  {!hasPermission('compte_rendu_write') && (
                    <div className="alert alert-info" style={{ marginBottom: '10px', padding: '8px', fontSize: '0.77em' }}>
                      <FaInfoCircle /> Vous n'avez pas la permission de rédiger un compte rendu.
                    </div>
                  )}
                  <textarea
                    id="etat_conf_commentaire_signer"
                    className="form-control"
                    rows="4"
                    value={etatFormData.conf_commentaire_produit}
                    onChange={(e) => setEtatFormData({...etatFormData, conf_commentaire_produit: e.target.value})}
                    disabled={!hasPermission('compte_rendu_write')}
                    placeholder={user?.fonction === 5 ? 'Saisissez votre compte rendu commercial...' : 'Saisissez un commentaire...'}
                  />
                </div>

                <div className="form-actions">
                  <button className="btn-confirm" onClick={handleEtatSubmit} disabled={etatSubmitting || isChangementEtatBloque}>{etatSubmitting ? 'Enregistrement…' : 'Enregistrer'}</button>
                  <button className="btn-cancel" onClick={() => {
                    setSelectedEtat(null);
                    if (user?.fonction === 5) {
                      setCompteRenduOption('');
                    }
                    setEtatFormData({
                      ...etatFormData,
                      date_sign_date: '', date_sign_time: '', produit: '', id_sous_etat: '', id_commercial: '', 
                      id_commercial_2: '', pseudo: '', ph3_pac: 'reau', ph3_rr_model: '', ph3_puissance: '', 
                      ph3_ballon: '', ph3_marque_ballon: '', ph3_alimentation: '', ph3_type: '', ph3_prix: '', 
                      ph3_installateur: '', conf_consommations: '', ph3_bonus_30: '', valeur_mensualite: '', 
                      ph3_mensualite: '', ph3_attente: '', nbr_annee_finance: '', credit_immobilier: '', 
                      credit_autre: '', conf_commentaire_produit: ''
                    });
                  }}>Annuler</button>
                </div>
              </div>
            )}

            {/* Formulaire SIGNER RETRACTER (états 16, 38) */}
            {[16, 38].includes(selectedEtat) && (
              <div className="etat-form" style={{ marginTop: '20px' }}>
                <h3>Informations Signer Retracter</h3>
                
                <div className="form-group">
                  <label htmlFor="etat_id_commercial_retracter">Commercial :</label>
                  <select
                    id="etat_id_commercial_retracter"
                    className="form-control"
                    value={etatFormData.id_commercial}
                    onChange={(e) => setEtatFormData({...etatFormData, id_commercial: e.target.value})}
                  >
                    <option value="">Sélectionner</option>
                    {commerciaux?.map(com => (
                      <option key={com.id} value={com.id}>
                        {com.pseudo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="etat_id_commercial_2_retracter">Commercial 2 (optionnel) :</label>
                  <select
                    id="etat_id_commercial_2_retracter"
                    className="form-control"
                    value={etatFormData.id_commercial_2}
                    onChange={(e) => setEtatFormData({...etatFormData, id_commercial_2: e.target.value})}
                  >
                    <option value="">Aucun</option>
                    {commerciaux?.map(com => (
                      <option key={com.id} value={com.id}>
                        {com.pseudo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="etat_conf_commentaire_retracter">Commentaire :</label>
                  <textarea
                    id="etat_conf_commentaire_retracter"
                    className="form-control"
                    rows="4"
                    value={etatFormData.conf_commentaire_produit}
                    onChange={(e) => setEtatFormData({...etatFormData, conf_commentaire_produit: e.target.value})}
                  />
                </div>

                <div className="form-actions">
                  <button className="btn-confirm" onClick={handleEtatSubmit} disabled={etatSubmitting || isChangementEtatBloque}>{etatSubmitting ? 'Enregistrement…' : 'Enregistrer'}</button>
                  <button className="btn-cancel" onClick={() => {
                    setSelectedEtat(null);
                    setEtatFormData({...etatFormData, id_commercial: '', id_commercial_2: '', conf_commentaire_produit: ''});
                  }}>Annuler</button>
                </div>
              </div>
            )}

            {/* Formulaire Honoré à suivre (état 9) */}
            {selectedEtat === 9 && (
              <div className="etat-form" style={{ marginTop: '20px' }}>
                <h3>Honoré à suivre</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="etat_date_rappel_9">A Rappeler le :</label>
                    <input
                      type="date"
                      id="etat_date_rappel_9"
                      className="form-control"
                      value={etatFormData.date_rappel_date}
                      onChange={(e) => setEtatFormData({...etatFormData, date_rappel_date: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="etat_date_rappel_time_9">Heure :</label>
                    <input
                      type="time"
                      id="etat_date_rappel_time_9"
                      className="form-control"
                      value={etatFormData.date_rappel_time}
                      onChange={(e) => setEtatFormData({...etatFormData, date_rappel_time: e.target.value})}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Date d&apos;appel :</label>
                  <div className="form-control" style={{ backgroundColor: '#f8f9fa' }}>
                    {new Date().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  <small style={{ color: '#6c757d' }}>Remplie automatiquement à l&apos;enregistrement</small>
                </div>
                {isAdminSessionHonoreSuivre && (
                  <div className="form-group">
                    <label htmlFor="etat_commercial_9">Commercial :</label>
                    <select
                      id="etat_commercial_9"
                      className="form-control"
                      value={etatFormData.id_commercial}
                      onChange={(e) => setEtatFormData({...etatFormData, id_commercial: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      {(commerciaux || []).filter(c => c.etat > 0 || c.etat == null).map(c => (
                        <option key={c.id} value={c.id}>{c.pseudo || `${c.prenom || ''} ${c.nom || ''}`.trim() || c.id}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="etat_conf_commentaire_9">Commentaire :</label>
                  <textarea
                    id="etat_conf_commentaire_9"
                    className="form-control"
                    rows="4"
                    value={etatFormData.conf_commentaire_produit}
                    onChange={(e) => setEtatFormData({...etatFormData, conf_commentaire_produit: e.target.value})}
                  />
                </div>
                <div className="form-actions">
                  <button className="btn-confirm" onClick={handleEtatSubmit} disabled={etatSubmitting || isChangementEtatBloque}>{etatSubmitting ? 'Enregistrement…' : 'Enregistrer'}</button>
                  <button className="btn-cancel" onClick={() => {
                    setSelectedEtat(null);
                    setCompteRenduOption('');
                    setEtatFormData({...etatFormData, date_rappel_date: '', date_rappel_time: '', id_commercial: '', conf_commentaire_produit: ''});
                  }}>Annuler</button>
                </div>
              </div>
            )}

            {/* États avec commentaire (motif_qualif) : annuler, refus, hors cible, etc. */}
            {[5, 6, 11, 12, 22, 23, 24, 25, 26, 29, 34].includes(selectedEtat) && (
              <div className="etat-form" style={{ marginTop: '20px' }}>
                <h3>
                  {[11, 12].includes(selectedEtat)
                    ? 'RDV annulé / Refus'
                    : [23, 34].includes(selectedEtat)
                      ? 'Informations complémentaires'
                      : "Commentaire sur l'état"}
                </h3>
                {[11, 12].includes(selectedEtat) && sousEtats.length > 0 && (
                  <div className="form-group">
                    <label htmlFor="etat_id_sous_etat_11_12">Sous-état (facultatif) :</label>
                    <select
                      id="etat_id_sous_etat_11_12"
                      className="form-control"
                      value={etatFormData.id_sous_etat || ''}
                      onChange={(e) => setEtatFormData({ ...etatFormData, id_sous_etat: e.target.value })}
                    >
                      <option value="">—</option>
                      {sousEtats.map((se) => (
                        <option key={se.id} value={String(se.id)}>{se.titre}</option>
                      ))}
                    </select>
                  </div>
                )}
                {selectedEtat === 34 && (
                  <div className="form-group">
                    <label htmlFor="etat_conf_rdv_avec_34">Appel avec qui :</label>
                    <select
                      id="etat_conf_rdv_avec_34"
                      className="form-control"
                      value={etatFormData.conf_rdv_avec || ''}
                      onChange={(e) => setEtatFormData({...etatFormData, conf_rdv_avec: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      <option value="MR">MR</option>
                      <option value="MME">MME</option>
                      <option value="AUTRE">AUTRE</option>
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="etat_conf_commentaire_simple">
                    Commentaire * :
                  </label>
                  <textarea
                    id="etat_conf_commentaire_simple"
                    className="form-control"
                    rows="4"
                    value={etatFormData.motif_qualif}
                    onChange={(e) => setEtatFormData({...etatFormData, motif_qualif: e.target.value})}
                  />
                </div>
                <div className="form-actions">
                  <button className="btn-confirm" onClick={handleEtatSubmit} disabled={etatSubmitting || isChangementEtatBloque}>{etatSubmitting ? 'Enregistrement…' : 'Enregistrer'}</button>
                  <button className="btn-cancel" onClick={() => {
                    setSelectedEtat(null);
                    setCompteRenduOption('');
                    setEtatFormData({...etatFormData, conf_commentaire_produit: '', motif_qualif: '', conf_rdv_avec: '', id_sous_etat: ''});
                  }}>Annuler</button>
                </div>
              </div>
            )}

            {/* Bouton Enregistrer pour les autres états sans formulaire spécifique */}
            {selectedEtat && 
             selectedEtat !== 7 && 
             selectedEtat !== 2 && 
             selectedEtat !== 8 && 
             selectedEtat !== 19 && 
             ![5, 6, 9, 11, 12, 13, 16, 22, 23, 24, 25, 26, 29, 34, 38, 44, 45].includes(selectedEtat) && (
              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button
                  className="btn-confirm"
                  onClick={handleEtatSubmit}
                  disabled={etatSubmitting || isChangementEtatBloque}
                >
                  {etatSubmitting ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setSelectedEtat(null);
                    setCompteRenduOption('');
                  }}
                >
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Section de validation - seulement pour les fiches confirmées (état 7) et si permission accordée */}
        {false && fiche.id_etat_final === 7 && hasPermission('fiche_validate') && (
          <div className="fiche-section validation-section-bottom">
            <h2 className="section-title">Validation de la fiche</h2>
            {fiche.valider > 0 ? (
              <div className="validation-info">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  <span className="validation-badge validated">✓ Validée</span>
                  {fiche.validateur_pseudo && (
                    <span className="validation-with">Validé par : {fiche.validateur_pseudo}</span>
                  )}
                  {fiche.conf_rdv_avec && (
                    <span className="validation-with">Avec qui : {fiche.conf_rdv_avec}</span>
                  )}
                  {fiche.conf_presence_couple && (
                    <span className="validation-with">Présence couple : {fiche.conf_presence_couple}</span>
                  )}
                </div>
                <button
                  className="btn-validate cancel"
                  onClick={() => {
                    if (window.confirm('Voulez-vous annuler la validation de cette fiche ?')) {
                      validateMutation.mutate({ type_valid: '0' });
                    }
                  }}
                  disabled={validateMutation.isLoading}
                  title="Annuler la validation"
                >
                  Annuler la validation
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label htmlFor="conf_rdv_avec_validation" style={{ fontWeight: '600', fontSize: '13px' }}>
                    Avec qui le RDV a-t-il été validé ? (optionnel)
                  </label>
                  <select
                    id="conf_rdv_avec_validation"
                    value={confRdvAvecValue || ''}
                    onChange={(e) => setConfRdvAvecValue(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="MR">Mr</option>
                    <option value="MME">Mme</option>
                    <option value="MR et MME">Mr et Mme</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label htmlFor="conf_presence_couple_validation" style={{ fontWeight: '600', fontSize: '13px' }}>
                    Présence du couple <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select
                    id="conf_presence_couple_validation"
                    value={confPresenceCoupleValue || ''}
                    onChange={(e) => setConfPresenceCoupleValue(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="OUI">OUI</option>
                    <option value="NON">NON</option>
                  </select>
                </div>
                <button
                  className="btn-validate"
                  onClick={() => {
                    validateMutation.mutate({ 
                      type_valid: `1${confRdvAvecValue ? '-' + confRdvAvecValue : ''}`,
                      conf_rdv_avec: confRdvAvecValue || null,
                      conf_presence_couple: confPresenceCoupleValue || null
                    });
                  }}
                  disabled={validateMutation.isLoading || !confPresenceCoupleValue}
                  title="Valider la fiche confirmée"
                >
                  {validateMutation.isLoading ? 'Validation...' : 'Valider la fiche'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Formulaire de décalage de RDV — déplacé tout en bas de la page détails fiche */}
        {hasPermission('decalage_create') && 
         user.fonction !== 6 && 
         user.fonction !== 3 && 
         ficheData && !([13, 16, 38, 45, 44].includes(ficheData.id_etat_final)) &&
         ficheData.date_rdv_time && (
          <div className="fiche-section decalage-form" style={{ marginTop: '24px' }}>
            <h2 className="section-title" style={{ 
              background: '#9cbfc8', 
              color: '#fff', 
              padding: '10px', 
              textAlign: 'center',
              marginBottom: '0',
              fontSize: '13.6px',
              fontWeight: 'bold'
            }}>
              Demande de décalage
            </h2>
            
            {decalagesData && decalagesData.length > 0 && (
              <div style={{ 
                border: '1px solid #e0e0e0', 
                borderTop: 'none', 
                padding: '15px',
                background: '#f9f9f9',
                marginBottom: '10px'
              }}>
                <h3 style={{ marginTop: '0', marginBottom: '10px', fontSize: '11.9px', fontWeight: 'bold' }}>
                  Demande de décalage ({decalagesData.length})
                </h3>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {decalagesData.map((decalage, index) => (
                    <div key={decalage.id || index} style={{ 
                      background: '#fff', 
                      padding: '10px', 
                      marginBottom: '8px', 
                      borderRadius: '4px',
                      border: '1px solid #ddd'
                    }}>
                      <div style={{ fontSize: '10.2px', color: '#666' }}>
                        <strong>Demande #{index + 1}</strong> - 
                        Créée le: {decalage.date_creation ? new Date(decalage.date_creation).toLocaleString('fr-FR') : 'N/A'}
                      </div>
                      <div style={{ fontSize: '10.2px', marginTop: '5px' }}>
                        <strong>Nouvelle date:</strong> {decalage.date_nouvelle ? formatRdvDateTime(decalage.date_nouvelle) : (decalage.date_prevu ? formatRdvDateTime(decalage.date_prevu) : 'N/A')}
                      </div>
                      {decalage.message && (
                        <div style={{ fontSize: '10.2px', marginTop: '5px', fontStyle: 'italic', color: '#555' }}>
                          "{decalage.message}"
                        </div>
                      )}
                      {decalage.etat_dec && (
                        <div style={{ fontSize: '10.2px', marginTop: '5px' }}>
                          <strong>État:</strong> {decalage.etat_dec}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '10px', fontSize: '10.2px', color: '#666', fontStyle: 'italic' }}>
                  Vous pouvez créer une nouvelle demande de décalage ci-dessous.
                </div>
              </div>
            )}
            
            <div style={{ 
              border: '1px solid #e0e0e0', 
              borderTop: 'none', 
              padding: '15px',
              background: '#fff'
            }}>
              <div className="form-group">
                <label htmlFor="select_minutes_bottom">Décalage de :</label>
                <select
                  id="select_minutes_bottom"
                  className="form-control"
                  value={decalageFormData.select_minutes}
                  onChange={(e) => {
                    const minutes = parseInt(e.target.value);
                    const dateRdvOriginale = ficheData?.date_rdv_time || decalageFormData.date_prevu || '';
                    if (minutes > 0 && dateRdvOriginale) {
                      try {
                        const originalDate = new Date(dateRdvOriginale);
                        if (isNaN(originalDate.getTime())) {
                          alert('Erreur : la date de rendez-vous originale est invalide.');
                          return;
                        }
                        const newDate = new Date(originalDate);
                        newDate.setMinutes(newDate.getMinutes() + minutes);
                        const year = newDate.getFullYear();
                        const month = String(newDate.getMonth() + 1).padStart(2, '0');
                        const day = String(newDate.getDate()).padStart(2, '0');
                        const hours = String(newDate.getHours()).padStart(2, '0');
                        const mins = String(newDate.getMinutes()).padStart(2, '0');
                        const secs = String(newDate.getSeconds()).padStart(2, '0');
                        const formattedNewDate = `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
                        setDecalageFormData(prev => ({
                          ...prev,
                          select_minutes: e.target.value,
                          nouvelle_date: formattedNewDate,
                          date_prevu: dateRdvOriginale
                        }));
                      } catch (error) {
                        alert('Erreur lors du calcul de la nouvelle date. Veuillez réessayer.');
                      }
                    } else {
                      setDecalageFormData(prev => ({
                        ...prev,
                        select_minutes: e.target.value,
                        nouvelle_date: '',
                        date_prevu: dateRdvOriginale
                      }));
                    }
                  }}
                >
                  <option value="0">SÉLECTIONNER</option>
                  <option value="10">10 MIN</option>
                  <option value="15">15 MIN</option>
                  <option value="20">20 MIN</option>
                  <option value="25">25 MIN</option>
                  <option value="30">30 MIN</option>
                  <option value="35">35 MIN</option>
                  <option value="40">40 MIN</option>
                  <option value="45">45 MIN</option>
                  <option value="50">50 MIN</option>
                  <option value="55">55 MIN</option>
                  <option value="60">1 HEURE</option>
                  <option value="75">1H15</option>
                  <option value="90">1H30</option>
                  <option value="105">1H45</option>
                  <option value="120">2 HEURES</option>
                </select>
              </div>

              {decalageFormData.nouvelle_date && (
                <div className="form-group" style={{ 
                  background: '#e8f5e9', 
                  padding: '10px', 
                  borderRadius: '4px',
                  marginBottom: '15px',
                  border: '2px solid #4caf50'
                }}>
                  <strong>📅 Nouvelle date/heure :</strong> 
                  <span style={{ display: 'block', marginTop: '5px', fontSize: '13.6px', fontWeight: 'bold', color: '#2e7d32' }}>
                    {(() => {
                      try {
                        const date = new Date(decalageFormData.nouvelle_date);
                        if (isNaN(date.getTime())) return decalageFormData.nouvelle_date;
                        return date.toLocaleString('fr-FR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                      } catch (error) {
                        return decalageFormData.nouvelle_date;
                      }
                    })()}
                  </span>
                  {ficheData?.date_rdv_time && (
                    <div style={{ marginTop: '8px', fontSize: '10.2px', color: '#666', fontStyle: 'italic' }}>
                      Date originale : {formatRdvDateTime(ficheData.date_rdv_time)}
                    </div>
                  )}
                </div>
              )}

              {user.fonction === 5 && (
                <div className="form-group">
                  <label htmlFor="id_confirmateur_dec_bottom">Confirmateur :</label>
                  {ficheData?.id_confirmateur ? (
                    <div style={{ background: '#f0f0f0', padding: '10px', borderRadius: '4px', fontWeight: 'bold' }}>
                      {confirmateurs?.find(c => c.id === ficheData.id_confirmateur)?.pseudo || `ID: ${ficheData.id_confirmateur}`}
                    </div>
                  ) : (
                    <div style={{ color: 'red', fontStyle: 'italic' }}>
                      Aucun confirmateur assigné à cette fiche. Veuillez assigner un confirmateur avant de créer un décalage.
                    </div>
                  )}
                </div>
              )}

              {([1, 2, 7].includes(user.fonction)) && (
                <div className="form-group">
                  <label htmlFor="id_confirmateur_dec_bottom">Confirmateur :</label>
                  <select
                    id="id_confirmateur_dec_bottom"
                    className="form-control"
                    value={decalageFormData.id_confirmateur || (fiche?.id_confirmateur ? String(fiche.id_confirmateur) : '')}
                    onChange={(e) => {
                      setDecalageFormData({...decalageFormData, id_confirmateur: e.target.value});
                    }}
                    required
                  >
                    <option value="">SÉLECTIONNER UN CONFIRMATEUR</option>
                    {confirmateurs?.map(conf => (
                      <option key={conf.id} value={conf.id}>
                        {conf.pseudo}
                      </option>
                    ))}
                  </select>
                  {!decalageFormData.id_confirmateur && !fiche?.id_confirmateur && (
                    <small style={{ color: '#666', fontStyle: 'italic' }}>
                      Sélectionnez un confirmateur depuis la liste
                    </small>
                  )}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="message_dec_bottom">Message du décalage :</label>
                <textarea
                  id="message_dec_bottom"
                  className="form-control"
                  rows="4"
                  value={decalageFormData.message}
                  onChange={(e) => {
                    setDecalageFormData({...decalageFormData, message: e.target.value});
                  }}
                  placeholder="Saisissez le message expliquant le décalage..."
                />
              </div>

              <div className="form-actions" style={{ textAlign: 'center', marginTop: '15px' }}>
                <button
                  className="btn-confirm"
                  onClick={handleDecalageSubmit}
                  disabled={decalageMutation.isLoading}
                  style={{
                    display: 'table',
                    width: 'max-content',
                    margin: '0 auto',
                    borderRadius: '7px',
                    fontWeight: 'bold',
                    padding: '10px 20px'
                  }}
                >
                  {decalageMutation.isLoading ? 'Envoi...' : 'Demande de décalage'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {/* Onglet Modifica */}
      {activeTab === 'modifica' && (
        <ModificaTab ficheHash={hash} />
      )}

      {/* Onglet Affectation - Affecter la fiche à un ou deux commerciaux */}
      {activeTab === 'affectation' && showAffectationTab && (
        <div className="fiche-section affectation-tab" style={{ padding: '20px' }}>
          <h2 className="section-title"><FaUserPlus /> Affectation commerciale</h2>
          <p style={{ color: '#333', marginBottom: '8px', fontWeight: 700 }}>
            Commercial affecte: {commercialAffecteNom || 'Aucun'}
          </p>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Affectez cette fiche à un commercial.
          </p>
          <div className="form-row" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
            <div className="form-group">
              <label htmlFor="affectation-commercial">Commercial</label>
              <select
                id="affectation-commercial"
                className="form-control"
                value={affectationCommercial}
                onChange={(e) => setAffectationCommercial(e.target.value)}
              >
                <option value="">— Aucun —</option>
                {(commerciaux || []).filter(c => c.etat > 0 || c.etat == null).map(c => (
                  <option key={c.id} value={String(c.id)}>{c.pseudo || `${c.prenom || ''} ${c.nom || ''}`.trim() || c.id}</option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn-save"
                disabled={affectationSaving}
                onClick={async () => {
                  if (!hash) return;
                  setAffectationSaving(true);
                  try {
                    await updateFieldMutation.mutateAsync({ field: 'id_commercial', value: affectationCommercial || null });
                    await updateFieldMutation.mutateAsync({ field: 'id_commercial_2', value: null });
                  } finally {
                    setAffectationSaving(false);
                  }
                }}
              >
                {affectationSaving ? 'Enregistrement...' : 'Enregistrer l\'affectation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onglet Planning - Masqué pour qualité qualification */}
      {activeTab === 'planning' && !isQualiteQualif && (
        <PlanningTab
          ficheHash={hash}
          ficheData={ficheData}
          planningWeek={planningWeek}
          planningYear={planningYear}
          planningDep={planningDep}
          setPlanningWeek={setPlanningWeek}
          setPlanningYear={setPlanningYear}
          setPlanningDep={setPlanningDep}
          onSelectSlot={handleSelectPlanningSlot}
          getUserColor={getUserColor}
          getUserName={getUserName}
          getAvailabilityColor={getAvailabilityColor}
          TIME_SLOTS={TIME_SLOTS}
          user={user}
        />
      )}

      {/* Onglet SMS - Masqué pour qualité qualification */}
      {activeTab === 'sms' && !isQualiteQualif && (
        <SMSTab
          ficheHash={hash}
          ficheData={ficheData}
        />
      )}

      {/* Onglet PDF */}
      {activeTab === 'pdf' && (
        <div className="pdf-tab" style={{ padding: '20px' }}>
          <div style={{ 
            background: '#f5f5f5', 
            padding: '20px', 
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h2 style={{ marginTop: 0, color: '#2c3e50' }}>
              <FaFilePdf style={{ marginRight: '10px' }} />
              Génération de PDF
            </h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Cliquez sur le bouton ci-dessous pour générer et télécharger un PDF contenant toutes les informations de la fiche.
            </p>
            <button
              onClick={generatePDF}
              style={{
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '5px',
                fontSize: '13.6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <FaFilePdf /> Générer le PDF
            </button>
          </div>
          
          {fiche && (
            <div style={{ 
              background: 'white', 
              padding: '15px', 
              borderRadius: '5px',
              border: '1px solid #ddd'
            }}>
              <h3 style={{ color: '#2c3e50', marginTop: 0 }}>Aperçu des informations</h3>
              <p><strong>Client:</strong> {fiche.nom} {fiche.prenom}</p>
              <p><strong>Téléphone:</strong> {fiche.tel}</p>
              <p><strong>Produit:</strong> {fiche.produit_nom || (fiche.produit === 1 ? 'PAC' : fiche.produit === 2 ? 'PV' : '-')}</p>
              <p><strong>État:</strong> {fiche.etat_titre || '-'}</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de création de RDV */}
      {showRdvModal && selectedSlot && (
        <CreateRdvModal
          ficheData={ficheData}
          user={user}
          selectedSlot={selectedSlot}
          rdvFormData={rdvFormData}
          setRdvFormData={setRdvFormData}
          confirmateurs={confirmateurs}
          onClose={() => {
            setShowRdvModal(false);
            setSelectedSlot(null);
          }}
          onSubmit={handleCreateRdvFromForm}
          rdvSubmitting={rdvSubmitting}
        />
      )}
    </div>
  );
};

// Composant pour l'onglet Modifica
const ModificaTab = ({ ficheHash }) => {
  const { data: modificaData, isLoading, error } = useQuery(
    ['modifica', ficheHash],
    async () => {
      const res = await api.get(`/fiches/${ficheHash}/modifica`);
      console.log('Modifica response:', res.data);
      if (res.data.success) {
        return res.data.data || [];
      } else {
        console.warn('Réponse modifica sans succès:', res.data);
        return [];
      }
    },
    { 
      enabled: !!ficheHash,
      retry: 1, // Réessayer une fois en cas d'erreur
      onError: (err) => {
        console.error('Erreur lors de la récupération des modifications:', err);
        console.error('Détails de l\'erreur:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          url: err.config?.url
        });
      }
    }
  );

  if (isLoading) return <div className="loading">Chargement de l'historique...</div>;
  
  if (error) {
    return (
      <div className="modifica-tab">
        <h2>Historique des modifications</h2>
        <div className="error">
          <p><strong>Erreur lors du chargement des modifications</strong></p>
          <p>{error.message}</p>
          {error.response && (
            <p>Status: {error.response.status} - {error.response.statusText}</p>
          )}
          {error.response?.data?.message && (
            <p>Message serveur: {error.response.data.message}</p>
          )}
          <p className="help-text">Vérifiez la console pour plus de détails.</p>
        </div>
      </div>
    );
  }

  console.log('Modifica data:', modificaData);

  return (
    <div className="modifica-tab">
      <h2>Historique des modifications</h2>
      {modificaData && modificaData.length > 0 ? (
        <table className="modifica-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Type</th>
              <th>Ancienne valeur</th>
              <th>Nouvelle valeur</th>
            </tr>
          </thead>
          <tbody>
            {modificaData.map(mod => (
              <tr key={mod.id}>
                <td>{mod.date_modif_time ? new Date(mod.date_modif_time).toLocaleString('fr-FR') : '-'}</td>
                <td>{mod.user_pseudo || '-'}</td>
                <td>{mod.type || '-'}</td>
                <td className="modifica-value">{mod.ancien_valeur || '-'}</td>
                <td className="modifica-value">{mod.nouvelle_valeur || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="no-modifications">
          <p>Aucune modification enregistrée.</p>
          <p className="help-text">Les modifications seront affichées ici après chaque modification de la fiche.</p>
        </div>
      )}
    </div>
  );
};

// Composant pour l'onglet Planning
const PlanningTab = ({ 
  ficheHash, 
  ficheData, 
  planningWeek, 
  planningYear, 
  planningDep, 
  setPlanningWeek, 
  setPlanningYear, 
  setPlanningDep,
  onSelectSlot,
  getUserColor,
  getUserName,
  getAvailabilityColor,
  TIME_SLOTS,
  user
}) => {
  const queryClient = useQueryClient();
  
  // Vérifier si l'utilisateur peut éditer (uniquement fonction 1)
  const canEdit = user?.fonction === 1;
  /** RE confirmation (14), RP confirmation (13), backoffice (11) : lien dashboard par créneau */
  const sessionCanOpenSlotDashboard = [14, 13, 11].includes(Number(user?.fonction));
  
  const { data: planningResponse, isLoading: isLoadingPlanning, refetch: refetchPlanning } = useQuery(
    ['planning-modal', planningWeek, planningYear, planningDep],
    async () => {
      if (!planningWeek || !planningYear || !planningDep) return null;
      const res = await api.get('/planning/week', { params: { w: planningWeek, y: planningYear, dp: planningDep } });
      return res.data;
    },
    { 
      enabled: !!planningDep && !!planningWeek && !!planningYear,
      staleTime: 60000,
      refetchInterval: 60000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true
    }
  );

  const { data: availabilityResponse, isLoading: isLoadingAvailability, refetch: refetchAvailability } = useQuery(
    ['availability-modal', planningWeek, planningYear, planningDep],
    async () => {
      if (!planningWeek || !planningYear || !planningDep) return null;
      const res = await api.get('/planning/availability', { params: { w: planningWeek, y: planningYear, dp: planningDep } });
      return res.data;
    },
    { 
      enabled: !!planningDep && !!planningWeek && !!planningYear,
      staleTime: 60000,
      refetchInterval: 60000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true
    }
  );

  const planningData = planningResponse?.data || {};
  const availabilityData = availabilityResponse?.data || {};
  
  // Rafraîchir automatiquement les données à l'ouverture de l'onglet Planning
  useEffect(() => {
    if (planningDep && planningWeek && planningYear) {
      refetchPlanning();
      refetchAvailability();
    }
  }, [planningDep, planningWeek, planningYear]); // au montage / changement dep-semaine-année
  
  // Mutation pour modifier la disponibilité (définie après les queries pour accéder aux refetch)
  const updateAvailabilityMutation = useMutation(
    async ({ week, year, dep, date, hour, value, type }) => {
      console.log('Mutation called with:', { week, year, dep, date, hour, value, type });
      const res = await api.put('/planning/availability', { week, year, dep, date, hour, value, type });
      console.log('Mutation response:', res.data);
      return res.data;
    },
    {
      onSuccess: (data) => {
        console.log('Availability updated successfully:', data);
        queryClient.invalidateQueries(['planning-modal']);
        queryClient.invalidateQueries(['availability-modal']);
        // Rafraîchir explicitement les données
        setTimeout(() => {
          refetchPlanning();
          refetchAvailability();
        }, 100);
      },
      onError: (error) => {
        console.error('Erreur modification disponibilité:', error);
        console.error('Error details:', error.response?.data);
        alert(error.response?.data?.message || 'Erreur lors de la modification');
      }
    }
  );
  
  // Handler pour mettre à jour la disponibilité
  const handleUpdateAvailability = (date, hour, value, type = 'hour') => {
    if (!planningWeek || !planningYear || !planningDep) {
      console.warn('Missing planning parameters:', { planningWeek, planningYear, planningDep });
      return;
    }
    
    // Formater l'heure correctement (HH:MM:SS)
    let hourFormatted = hour;
    if (hour && !hour.includes(':')) {
      hourFormatted = `${hour}:00:00`;
    } else if (hour && hour.split(':').length === 2) {
      hourFormatted = `${hour}:00`;
    }
    
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 0) {
      alert('Valeur invalide');
      return;
    }
    
    console.log('handleUpdateAvailability called:', { date, hour, hourFormatted, value: numValue, type });
    
    updateAvailabilityMutation.mutate({
      week: planningWeek,
      year: planningYear,
      dep: planningDep,
      date,
      hour: hourFormatted,
      value: numValue,
      type
    });
  };
  
  const getMondayOfWeek = (year, week) => {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return ISOweekStart;
  };

  const getDaysFromPlanning = () => {
    if (!planningWeek || !planningYear) return [];
    const monday = getMondayOfWeek(planningYear, planningWeek);
    const daysFr = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const days = [];
    
    // Extraire les composants du lundi pour éviter les problèmes de fuseau horaire
    const mondayYear = monday.getFullYear();
    const mondayMonth = monday.getMonth();
    const mondayDay = monday.getDate();
    
    for (let i = 0; i < 5; i++) {
      // Créer la date directement avec les composants (évite les problèmes de fuseau horaire)
      const date = new Date(mondayYear, mondayMonth, mondayDay + i);
      days.push({
        date: formatDateLocal(date),
        dayName: daysFr[i]
      });
    }
    return days;
  };

  const handlePrevWeek = () => {
    if (planningWeek === 1) {
      setPlanningYear(planningYear - 1);
      setPlanningWeek(52);
    } else {
      setPlanningWeek(planningWeek - 1);
    }
  };

  const handleNextWeek = () => {
    if (planningWeek === 52) {
      setPlanningYear(planningYear + 1);
      setPlanningWeek(1);
    } else {
      setPlanningWeek(planningWeek + 1);
    }
  };

  const formatWeekRange = () => {
    const days = getDaysFromPlanning();
    if (days.length === 0) return '';
    // Parser les dates en heure locale pour éviter les problèmes de fuseau horaire
    const parseDateLocal = (dateStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };
    const start = parseDateLocal(days[0].date);
    const end = parseDateLocal(days[days.length - 1].date);
    return `${start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} au ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  };

  const days = getDaysFromPlanning();

  return (
    <div className="planning-tab">
      <div className="planning-tab-header">
        <h2>
          Planning - Département {planningDep || 'N/A'}
          {ficheData?.cp && (
            <span className="planning-dep-info"> (Code postal: {ficheData.cp})</span>
          )}
        </h2>
        <div className="planning-week-navigation">
          <button onClick={handlePrevWeek} className="nav-btn" title="Semaine précédente">
            <FaChevronLeft />
          </button>
          <span className="week-info">
            Semaine {planningWeek} - {formatWeekRange()}
          </span>
          <button onClick={handleNextWeek} className="nav-btn" title="Semaine suivante">
            <FaChevronRight />
          </button>
        </div>
      </div>
      <div className="planning-tab-body">
        {!planningDep ? (
          <div className="error">
            Impossible de déterminer le département à partir du code postal de la fiche.
            {ficheData?.cp && <p>Code postal actuel: {ficheData.cp}</p>}
          </div>
        ) : isLoadingPlanning || isLoadingAvailability ? (
          <div className="loading">Chargement du planning pour le département {planningDep}...</div>
        ) : planningResponse && Object.keys(planningData).length > 0 ? (
          <PlanningViewForModal
            planning={planningData}
            availability={availabilityData}
            days={days}
            timeSlots={TIME_SLOTS}
            getUserColor={getUserColor}
            getUserName={getUserName}
            getAvailabilityColor={getAvailabilityColor}
            dep={planningDep}
            week={planningWeek}
            year={planningYear}
            onSelectSlot={(date, hour) => onSelectSlot(date, hour, null, availabilityData)}
            onUpdateAvailability={handleUpdateAvailability}
            canEdit={canEdit}
            currentFicheHash={ficheHash}
            sessionCanOpenSlotDashboard={sessionCanOpenSlotDashboard}
          />
        ) : (
          <div className="error">Aucun planning disponible pour le département {planningDep}</div>
        )}
      </div>
    </div>
  );
};

// Composant pour l'onglet SMS
const SMSTab = ({ ficheHash, ficheData }) => {
  const { user } = useAuth();
  const [selectedTel, setSelectedTel] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('0');
  const [customMessage, setCustomMessage] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('+33'); // France par défaut
  
  const queryClient = useQueryClient();
  
  // Liste des indicatifs téléphoniques
  const countryCodes = [
    { code: '+33', country: 'France', flag: '🇫🇷' },
    { code: '+216', country: 'Tunisie', flag: '🇹🇳' },
    { code: '+212', country: 'Maroc', flag: '🇲🇦' },
    { code: '+213', country: 'Algérie', flag: '🇩🇿' },
    { code: '+1', country: 'États-Unis/Canada', flag: '🇺🇸' },
    { code: '+32', country: 'Belgique', flag: '🇧🇪' },
    { code: '+41', country: 'Suisse', flag: '🇨🇭' },
    { code: '+44', country: 'Royaume-Uni', flag: '🇬🇧' },
    { code: '+49', country: 'Allemagne', flag: '🇩🇪' },
    { code: '+34', country: 'Espagne', flag: '🇪🇸' },
    { code: '+39', country: 'Italie', flag: '🇮🇹' },
    { code: '+351', country: 'Portugal', flag: '🇵🇹' },
    { code: '+352', country: 'Luxembourg', flag: '🇱🇺' },
    { code: '+377', country: 'Monaco', flag: '🇲🇨' },
    { code: '+221', country: 'Sénégal', flag: '🇸🇳' },
    { code: '+225', country: 'Côte d\'Ivoire', flag: '🇨🇮' },
    { code: '+229', country: 'Bénin', flag: '🇧🇯' },
    { code: '+226', country: 'Burkina Faso', flag: '🇧🇫' },
    { code: '+227', country: 'Niger', flag: '🇳🇪' },
    { code: '+228', country: 'Togo', flag: '🇹🇬' },
    { code: '+230', country: 'Maurice', flag: '🇲🇺' },
    { code: '+262', country: 'La Réunion', flag: '🇷🇪' },
    { code: '+590', country: 'Guadeloupe', flag: '🇬🇵' },
    { code: '+594', country: 'Guyane', flag: '🇬🇫' },
    { code: '+596', country: 'Martinique', flag: '🇲🇶' },
    { code: '+687', country: 'Nouvelle-Calédonie', flag: '🇳🇨' },
    { code: '+689', country: 'Polynésie française', flag: '🇵🇫' }
  ];
  
  // Récupérer les catégories SMS depuis l'API
  const { data: smsCategories, isLoading: loadingCategories } = useQuery(
    'sms_categories',
    async () => {
      const res = await api.get('/management/sms-categories');
      return res.data.data || [];
    },
    {
      onError: (error) => {
        console.error('Erreur lors du chargement des catégories SMS:', error);
      }
    }
  );
  
  const { data: smsList, isLoading } = useQuery(
    ['sms', ficheHash],
    async () => {
      const res = await api.get(`/fiches/${ficheHash}/sms`);
      return res.data.data || [];
    },
    { enabled: !!ficheHash }
  );

  const sendSMSMutation = useMutation(
    async (data) => {
      const res = await api.post(`/fiches/${ficheHash}/sms`, data);
      return res.data;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['sms', ficheHash]);
        queryClient.invalidateQueries(['modifica', ficheHash]);
        const message = data?.message || data?.data?.message || 'SMS envoyé avec succès!';
        alert(message);
        setCustomMessage('');
      },
      onError: (error) => {
        console.error('Erreur:', error);
        const errorMessage = error.response?.data?.message || 
                            error.response?.data?.error || 
                            error.message || 
                            'Erreur lors de l\'envoi du SMS';
        alert('Erreur lors de l\'envoi du SMS: ' + errorMessage);
      }
    }
  );

  // Fonction pour remplacer les variables dans le message
  const replaceVariables = React.useCallback((message) => {
    if (!message || !ficheData) {
      console.log('[SMS Frontend] replaceVariables: message ou ficheData manquant', { 
        hasMessage: !!message, 
        hasFicheData: !!ficheData 
      });
      return message;
    }
    
    console.log('[SMS Frontend] replaceVariables: Données ficheData', {
      hasDateRdv: !!ficheData.date_rdv_time,
      dateRdvValue: ficheData.date_rdv_time,
      nom: ficheData.nom,
      prenom: ficheData.prenom,
      civ: ficheData.civ
    });
    
    let dateRdv = null;
    let dateRdvStr = '';
    let heureRdvStr = '';
    
    if (ficheData?.date_rdv_time) {
      try {
        let dateRdvValue = ficheData.date_rdv_time;
        // Affichage indépendant du fuseau horaire : utiliser les utilitaires qui lisent la chaîne telle quelle
        if (typeof dateRdvValue === 'string') {
          dateRdvStr = formatRdvDateOnly(dateRdvValue);
          heureRdvStr = formatRdvTimeOnly(dateRdvValue);
        } else if (typeof dateRdvValue === 'number') {
          // Timestamp : on ne peut pas garantir l'indépendance TZ sans connaître le TZ de stockage
          const d = new Date(dateRdvValue * 1000);
          if (!isNaN(d.getTime())) {
            dateRdvStr = formatRdvDateOnly(d.toISOString().slice(0, 10));
            heureRdvStr = d.toISOString().slice(11, 16);
          }
        }
      } catch (error) {
        console.error('[SMS Frontend] Erreur lors du formatage de date_rdv_time:', error, ficheData.date_rdv_time);
      }
    } else {
      console.log('[SMS Frontend] Pas de date_rdv_time dans ficheData', {
        ficheDataKeys: ficheData ? Object.keys(ficheData) : 'ficheData is null'
      });
    }
    
    const processedMessage = message
      .replace(/\{\{prenom\}\}/g, ficheData.prenom?.toUpperCase() || '')
      .replace(/\{\{nom\}\}/g, ficheData.nom?.toUpperCase() || '')
      .replace(/\{\{date_rdv\}\}/g, dateRdvStr)
      .replace(/\{\{heure_rdv\}\}/g, heureRdvStr)
      .replace(/\{\{civ\}\}/g, ficheData.civ || '');
    
    console.log('[SMS Frontend] Variables restantes après remplacement:', {
      hasDateRdv: /\{\{date_rdv\}\}/.test(processedMessage),
      hasHeureRdv: /\{\{heure_rdv\}\}/.test(processedMessage),
      messagePreview: processedMessage.substring(0, 150)
    });
    
    return processedMessage;
  }, [ficheData]);

  // Construire les messages prédéfinis à partir des catégories
  const predefinedMessages = React.useMemo(() => {
    const messages = { '0': '' }; // Message personnalisé
    
    if (smsCategories && Array.isArray(smsCategories)) {
      smsCategories.forEach((cat) => {
        messages[String(cat.id)] = replaceVariables(cat.message);
      });
    }
    
    return messages;
  }, [smsCategories, replaceVariables]);

  const handleSendSMS = () => {
    if (!selectedTel || selectedTel.trim() === '') {
      alert('Veuillez sélectionner un numéro de téléphone');
      return;
    }
    if (!user || !user.id) {
      alert('Utilisateur non connecté');
      return;
    }
    let message = '';
    if (selectedCategory === '0') {
      message = customMessage;
    } else {
      // Trouver la catégorie sélectionnée
      const selectedCat = smsCategories?.find(cat => String(cat.id) === selectedCategory);
      if (selectedCat) {
        message = replaceVariables(selectedCat.message);
      } else {
        message = predefinedMessages[selectedCategory] || '';
      }
    }
    
    if (!message || message.trim() === '') {
      alert('Veuillez saisir un message');
      return;
    }
    
    // Formater le numéro avec l'indicatif
    let formattedTel = selectedTel.trim();
    // Si le numéro ne commence pas déjà par un indicatif, ajouter celui sélectionné
    if (!formattedTel.startsWith('+') && !formattedTel.startsWith('00')) {
      // Supprimer le 0 initial pour la France si présent
      if (selectedCountryCode === '+33' && formattedTel.startsWith('0')) {
        formattedTel = formattedTel.substring(1);
      }
      formattedTel = selectedCountryCode + formattedTel;
    }
    
    sendSMSMutation.mutate({
      tel: formattedTel,
      message: message.trim(),
      id_confirmateur: user.id
    });
  };

  // Récupérer les numéros disponibles
  const availableTels = React.useMemo(() => [
    { value: ficheData?.tel, label: `Téléphone: ${ficheData?.tel}` },
    { value: ficheData?.gsm1, label: `GSM1: ${ficheData?.gsm1}` },
    { value: ficheData?.gsm2, label: `GSM2: ${ficheData?.gsm2}` }
  ].filter(t => t.value), [ficheData?.tel, ficheData?.gsm1, ficheData?.gsm2]);

  useEffect(() => {
    if (availableTels.length > 0 && !selectedTel) {
      setSelectedTel(availableTels[0].value);
    }
  }, [availableTels, selectedTel]);

  if (isLoading) return <div className="loading">Chargement...</div>;

  return (
    <div className="sms-tab">
      <h2>Envoyer un SMS</h2>
      <div className="sms-form">
        <div className="form-group">
          <label>Indicatif téléphonique :</label>
          <select
            value={selectedCountryCode}
            onChange={(e) => setSelectedCountryCode(e.target.value)}
            className="form-control"
            style={{ marginBottom: '10px' }}
          >
            {countryCodes.map(country => (
              <option key={country.code} value={country.code}>
                {country.flag} {country.code} - {country.country}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Numéro de téléphone :</label>
          <select
            value={selectedTel}
            onChange={(e) => setSelectedTel(e.target.value)}
            className="form-control"
          >
            {availableTels.map(tel => (
              <option key={tel.value} value={tel.value}>{tel.label}</option>
            ))}
          </select>
          {selectedTel && (
            <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
              Numéro formaté : {(() => {
                let formatted = selectedTel.trim();
                if (!formatted.startsWith('+') && !formatted.startsWith('00')) {
                  if (selectedCountryCode === '+33' && formatted.startsWith('0')) {
                    formatted = formatted.substring(1);
                  }
                  formatted = selectedCountryCode + formatted;
                }
                return formatted;
              })()}
            </div>
          )}
        </div>
        <div className="form-group">
          <label>Catégorie de message :</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCustomMessage('');
            }}
            className="form-control"
          >
            <option value="0">Message personnalisé</option>
            {smsCategories && smsCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.titre}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Message :</label>
          {selectedCategory === '0' ? (
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="form-control"
              rows="6"
              placeholder="Saisissez votre message personnalisé"
            />
          ) : (
            <textarea
              value={predefinedMessages[selectedCategory] || ''}
              readOnly
              className="form-control"
              rows="6"
              placeholder={loadingCategories ? 'Chargement des catégories...' : 'Message de la catégorie sélectionnée'}
            />
          )}
        </div>
        <div className="form-actions">
          <button
            className="btn-send-sms"
            onClick={handleSendSMS}
            disabled={sendSMSMutation.isLoading}
          >
            {sendSMSMutation.isLoading ? 'Envoi...' : 'Envoyer SMS'}
          </button>
        </div>
      </div>
      
      <div className="sms-history">
        <h3>Historique des SMS</h3>
        {smsList && smsList.length > 0 ? (
          <table className="sms-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Confirmateur</th>
                <th>Téléphone</th>
                <th>Message</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {smsList.map(sms => (
                <tr key={sms.id}>
                  <td>{sms.date_modif_time ? new Date(sms.date_modif_time).toLocaleString('fr-FR') : '-'}</td>
                  <td>{sms.confirmateur_pseudo || '-'}</td>
                  <td>{sms.tel || '-'}</td>
                  <td className="sms-message">{sms.message || '-'}</td>
                  <td>{sms.statut || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Aucun SMS envoyé.</p>
        )}
      </div>
    </div>
  );
};

// Composant PlanningView pour le modal (réutilisé depuis Planning.jsx)
const PlanningViewForModal = ({ 
  planning, 
  availability, 
  days, 
  timeSlots, 
  getUserColor, 
  getUserName, 
  getAvailabilityColor, 
  dep,
  week,
  year,
  onSelectSlot,
  onUpdateAvailability,
  canEdit = false,
  currentFicheHash, // Le hash est passé mais on ne peut plus comparer par ID car il est masqué
  sessionCanOpenSlotDashboard = false
}) => {
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [cellAvailabilityValues, setCellAvailabilityValues] = useState({});
  const [pendingAvailabilityEdits, setPendingAvailabilityEdits] = useState({});
  
  // Synchroniser le state local avec les données reçues
  useEffect(() => {
    if (planning && availability) {
      const newValues = {};
      days.forEach(day => {
        timeSlots.forEach(slot => {
          const dayPlanning = planning?.[day.date]?.time?.[hourToTimeKey(slot.hour)];
          const availabilityFromPlanning = dayPlanning?.av ?? null;
          const availData = availability?.[day.date]?.[slot.hour];
          const availabilityCount = availabilityFromPlanning !== null ? availabilityFromPlanning : (availData?.nbr_com ?? null);
          if (availabilityCount !== null && availabilityCount !== undefined) {
            newValues[`${day.date}-${slot.hour}`] = availabilityCount;
          }
        });
      });
      setCellAvailabilityValues(newValues);
    }
  }, [planning, availability, days, timeSlots]);
  
  const handleCellDoubleClick = (date, hour, e) => {
    e.stopPropagation();
    if (!canEdit) return;
    // Vérifier si le créneau est fermé
    const availData = availability?.[date]?.[hour];
    const isClosed = availData?.is_closed === 1;
    if (isClosed) return; // Ne pas permettre l'édition si le créneau est fermé
    const currentValue = availData?.nbr_com ?? 0; // null devient 0 pour l'édition
    setEditingCell(`${date}-${hour}`);
    setEditValue(currentValue.toString());
  };
  
  const handleSave = (date, hour) => {
    if (editValue === '' || editValue === null || editValue === undefined) {
      setEditingCell(null);
      setEditValue('');
      return;
    }
    const value = parseInt(editValue);
    if (isNaN(value) || value < 0) {
      return;
    }
    if (onUpdateAvailability) {
      onUpdateAvailability(date, hour, value, 'hour');
    }
    setEditingCell(null);
    setEditValue('');
  };
  
  const handleCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Handler pour modifier la disponibilité d'un créneau via le champ texte
  const handleCellAvailabilityChange = (date, hour, value) => {
    const key = `${date}-${hour}`;
    if (value === '' || value === null || value === undefined) {
      setPendingAvailabilityEdits((prev) => ({ ...prev, [key]: '' }));
      return;
    }
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 0) {
      return;
    }
    // Édition locale uniquement : la valeur n'est sauvegardée qu'au clic sur Valider.
    setPendingAvailabilityEdits((prev) => ({ ...prev, [key]: numValue }));
  };

  const handleValidateCellAvailability = (date, hour, fallbackValue = 0) => {
    const key = `${date}-${hour}`;
    const rawValue = pendingAvailabilityEdits[key];
    const valueToSave = rawValue === '' || rawValue === null || rawValue === undefined
      ? 0
      : parseInt(rawValue, 10);
    if (isNaN(valueToSave) || valueToSave < 0) return;
    if (onUpdateAvailability) {
      onUpdateAvailability(date, hour, valueToSave, 'hour');
    }
    setCellAvailabilityValues((prev) => ({ ...prev, [key]: valueToSave }));
    setPendingAvailabilityEdits((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleCancelCellAvailability = (date, hour) => {
    const key = `${date}-${hour}`;
    setPendingAvailabilityEdits((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  };

  return (
    <div className="planning-view">
      <div className="planning-table-container">
        <table className="planning-table">
          <thead>
            <tr>
              <th>Heure</th>
              {days.map(day => (
                <th key={day.date}>
                  <div className="day-header-planning">
                    <span>{day.dayName} {day.date.split('-')[2]}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map(slot => {
              const timeKey = hourToTimeKey(slot.hour);
              return (
                <tr key={slot.hour}>
                  <td className="time-slot-header">{slot.name}</td>
                  {days.map(day => {
                    // Le planning est structuré comme planning[date].time[timeKey]
                    const dayPlanning = planning?.[day.date]?.time?.[timeKey];
                    const rdvs = dayPlanning?.planning || [];
                    // Utiliser d'abord la disponibilité du planning, sinon celle de availability
                    const availabilityFromPlanning = dayPlanning?.av ?? null;
                    const availData = availability?.[day.date]?.[slot.hour];
                    const isClosed = availData?.is_closed === 1;
                    const availabilityCount = availabilityFromPlanning !== null ? availabilityFromPlanning : (availData?.nbr_com ?? null);
                    // availability peut être null (pas de planning créé), 0 (bloqué), ou > 0 (disponible)
                    const hasPlanning = availabilityCount !== null && availabilityCount !== undefined;
                    const isBlocked = availabilityCount === 0;
                    // Un créneau est disponible s'il a un planning avec disponibilité > 0, OU s'il n'a pas de planning mais n'est pas bloqué
                    const isAvailable = (hasPlanning && availabilityCount > 0) || (!hasPlanning && !isBlocked);
                    
                    // Compter uniquement les fiches confirmées (état final = 7, pas annulées ni reportées)
                    const confirmedRdvs = rdvs.filter(rdv => rdv.etat_check !== 'AN' && rdv.etat_check !== 'RS');
                    const confirmedCount = confirmedRdvs.length;
                    // Compter les fiches réellement validées par le confirmateur (valider == 1, accepte nombre/chaîne/boolean)
                    const validatedCount = rdvs.filter(rdv => (Number(rdv.valider) === 1 || rdv.valider === true || rdv.valider === '1')).length;
                    
                    // Toujours afficher le badge si on a des données (disponibilité ou fiches confirmées)
                    const hasData = hasPlanning || confirmedCount > 0;
                    const displayAvailability = availabilityCount !== null ? availabilityCount : 0;
                    
                    // Couleur du badge : vert si OK, orange si presque plein, rouge si plein
                    let bgColor = '#cccccc';
                    if (hasPlanning && availabilityCount > 0) {
                      bgColor = getAvailabilityColor(confirmedCount, availabilityCount);
                    } else if (confirmedCount > 0) {
                      bgColor = '#e74c3c'; // Rouge si des RDV mais pas de planning
                    }
                    
                    // Note: L'ID est masqué, on ne peut plus comparer directement
                    // On marque simplement le créneau si on a des RDV
                    const currentFicheInSlot = false;
                    const isEditing = editingCell === `${day.date}-${slot.hour}`;
                    // canEditThis : éditable même si valeur = 0 ; bloqué seulement si le créneau est fermé (is_closed=1)
                    const canEditThis = canEdit && !isClosed;
                    
                    const dashboardSlotHref =
                      sessionCanOpenSlotDashboard && dep
                        ? buildDashboardUrlForPlanningSlot({ dep, date: day.date, slotHour: slot.hour })
                        : null;

                    return (
                      <td
                        key={`${day.date}-${slot.hour}`}
                        className={`planning-cell ${isBlocked ? 'blocked' : ''} ${hasPlanning ? 'has-planning' : ''} ${currentFicheInSlot ? 'current-fiche' : ''} ${hasData ? 'has-data' : ''} ${isAvailable && !hasData ? 'available-slot' : ''}`}
                        style={{ 
                          backgroundColor: isBlocked ? 'rgba(34, 45, 50, 0.8)' : 'transparent',
                          position: 'relative',
                          cursor: isAvailable ? 'pointer' : 'default',
                          border: isAvailable && !hasData ? '2px dashed #8BC34A' : 'none'
                        }}
                        onClick={() => !isEditing && isAvailable && onSelectSlot(day.date, slot.hour)}
                        onDoubleClick={(e) => canEditThis && handleCellDoubleClick(day.date, slot.hour, e)}
                        title={
                          (() => {
                            const validatedLabel = hasData && rdvs.length > 0
                              ? `${validatedCount} validées / ${rdvs.length} total`
                              : null;
                            if (isEditing) return 'Modifier la disponibilité';
                            const actionLabel = canEditThis && hasData
                              ? `Double-cliquer pour modifier la disponibilité (${day.dayName} à ${slot.name})`
                              : isAvailable
                              ? `Cliquer pour créer un rendez-vous le ${day.dayName} à ${slot.name}`
                              : isBlocked
                              ? 'Créneau bloqué'
                              : 'Créneau non disponible';
                            return validatedLabel ? `${validatedLabel} — ${actionLabel}` : actionLabel;
                          })()
                        }
                      >
                        {dashboardSlotHref && (
                          <a
                            href={dashboardSlotHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="planning-slot-dashboard-link"
                            title="Ouvrir le tableau de bord : RDV de ce créneau (filtres appliqués)"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Voir les RDV de ce créneau sur le tableau de bord"
                          >
                            <FaInfoCircle />
                          </a>
                        )}
                        {/* Badge de disponibilité avec format "X / Y" - TOUJOURS affiché si on a des données */}
                        {isEditing ? (
                          <div className="edit-controls" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="availability-input"
                              autoFocus
                              min="0"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSave(day.date, slot.hour);
                                } else if (e.key === 'Escape') {
                                  handleCancel();
                                }
                              }}
                              style={{
                                width: '50px',
                                padding: '2px 4px',
                                fontSize: '11px',
                                border: '1px solid #ccc',
                                borderRadius: '3px'
                              }}
                            />
                            <button
                              className="save-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSave(day.date, slot.hour);
                              }}
                              style={{
                                padding: '2px 6px',
                                marginLeft: '4px',
                                fontSize: '10px',
                                background: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                            >
                              <FaCheck />
                            </button>
                            <button
                              className="cancel-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancel();
                              }}
                              style={{
                                padding: '2px 6px',
                                marginLeft: '2px',
                                fontSize: '10px',
                                background: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                            >
                              <FaTimes />
                            </button>
                          </div>
                        ) : hasData ? (
                          <>
                            <div className="availability-info">
                              <div className="availability-badge" style={{ backgroundColor: bgColor }}>
                                <span className="availability-text-compact">
                                  {confirmedCount} / {displayAvailability}
                                </span>
                              </div>
                            </div>
                            {canEditThis && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  left: '50%',
                                  top: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  zIndex: 10,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <input
                                  type="number"
                                  className="availability-input"
                                  value={pendingAvailabilityEdits[`${day.date}-${slot.hour}`] !== undefined
                                    ? pendingAvailabilityEdits[`${day.date}-${slot.hour}`]
                                    : (cellAvailabilityValues[`${day.date}-${slot.hour}`] !== undefined
                                      ? cellAvailabilityValues[`${day.date}-${slot.hour}`]
                                      : (availabilityCount !== null ? availabilityCount : ''))}
                                  onChange={(e) => handleCellAvailabilityChange(day.date, slot.hour, e.target.value)}
                                  min="0"
                                  placeholder="-"
                                  title="Saisir la valeur puis cliquer sur Valider"
                                />
                                {pendingAvailabilityEdits[`${day.date}-${slot.hour}`] !== undefined && (
                                  <>
                                    <button
                                      className="save-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleValidateCellAvailability(day.date, slot.hour, availabilityCount ?? 0);
                                      }}
                                      title="Valider"
                                      style={{ padding: '1px 4px', fontSize: '8px', lineHeight: 1 }}
                                    >
                                      <FaCheck />
                                    </button>
                                    <button
                                      className="cancel-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelCellAvailability(day.date, slot.hour);
                                      }}
                                      title="Annuler"
                                      style={{ padding: '1px 4px', fontSize: '8px', lineHeight: 1 }}
                                    >
                                      <FaTimes />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </>
                        ) : isAvailable && !isBlocked ? (
                          <>
                            <div className="availability-info">
                              <div className="availability-badge" style={{ backgroundColor: '#8BC34A', opacity: 0.7 }}>
                                <span className="availability-text-compact" style={{ fontSize: '8.5px' }}>
                                  Cliquer pour créer
                                </span>
                              </div>
                            </div>
                            {canEditThis && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  left: '50%',
                                  top: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  zIndex: 10,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <input
                                  type="number"
                                  className="availability-input"
                                  value={pendingAvailabilityEdits[`${day.date}-${slot.hour}`] !== undefined
                                    ? pendingAvailabilityEdits[`${day.date}-${slot.hour}`]
                                    : (cellAvailabilityValues[`${day.date}-${slot.hour}`] !== undefined
                                      ? cellAvailabilityValues[`${day.date}-${slot.hour}`]
                                      : '')}
                                  onChange={(e) => handleCellAvailabilityChange(day.date, slot.hour, e.target.value)}
                                  min="0"
                                  placeholder="-"
                                  title="Saisir la valeur puis cliquer sur Valider"
                                />
                                {pendingAvailabilityEdits[`${day.date}-${slot.hour}`] !== undefined && (
                                  <>
                                    <button
                                      className="save-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleValidateCellAvailability(day.date, slot.hour, 0);
                                      }}
                                      title="Valider"
                                      style={{ padding: '1px 4px', fontSize: '8px', lineHeight: 1 }}
                                    >
                                      <FaCheck />
                                    </button>
                                    <button
                                      className="cancel-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelCellAvailability(day.date, slot.hour);
                                      }}
                                      title="Annuler"
                                      style={{ padding: '1px 4px', fontSize: '8px', lineHeight: 1 }}
                                    >
                                      <FaTimes />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Composant Modal pour créer un RDV
const CreateRdvModal = ({ 
  ficheData, 
  user,
  selectedSlot, 
  rdvFormData, 
  setRdvFormData, 
  confirmateurs,
  onClose, 
  onSubmit,
  rdvSubmitting = false
}) => {
  const isConfirmateurSession = Number(user?.fonction) === 6;
  const [showRdvConfFields, setShowRdvConfFields] = useState(false);

  const getConfirmateurLabel = (id) => {
    if (!id) return '';
    const found = confirmateurs?.find(c => String(c.id) === String(id));
    return found?.pseudo || `ID: ${id}`;
  };

  // En session confirmateur : priorité confirmateurs_from_histo (source de vérité) ; première confirmation => conf1 = connecté ; déjà confirmée => garder tous les confirmateurs existants et ajouter connecté en conf2/conf3
  useEffect(() => {
    if (!isConfirmateurSession || !user?.id) return;
    const uid = String(user.id);
    const histoConf = Array.isArray(ficheData?.confirmateurs_from_histo) && ficheData.confirmateurs_from_histo.length > 0
      ? ficheData.confirmateurs_from_histo.map((id) => String(id))
      : null;

    setRdvFormData((prev) => {
      let a = prev?.id_confirmateur || '';
      let b = prev?.id_confirmateur_2 || '';
      let c = prev?.id_confirmateur_3 || '';
      if (histoConf && histoConf.length > 0 && !a && !b && !c) {
        a = histoConf[0] || '';
        b = histoConf[1] || '';
        c = histoConf[2] || '';
      }
      const alreadyConfirmed = !!(histoConf && histoConf.length > 0);

      if ([a, b, c].includes(uid)) return histoConf && histoConf.length > 0 && !prev?.id_confirmateur ? { ...prev, id_confirmateur: uid, id_confirmateur_2: a, id_confirmateur_3: b } : prev;
      if (!alreadyConfirmed) {
        return { ...prev, id_confirmateur: uid, id_confirmateur_2: '', id_confirmateur_3: '' };
      }
      // Connecté = conf1 ; ancien conf1 → conf2 ; ancien conf2 → conf3
      return { ...prev, id_confirmateur: uid, id_confirmateur_2: a, id_confirmateur_3: b };
    });
  }, [isConfirmateurSession, user?.id, setRdvFormData, ficheData?.confirmateurs_from_histo]);

  // Préremplir les champs PV depuis ficheData si ils sont vides dans rdvFormData
  useEffect(() => {
    if (!ficheData) return;
    
    setRdvFormData((prev) => {
      const updates = {};
      let hasChanges = false;

      // Orientation toiture
      if (!prev.conf_orientation_toiture && (ficheData.conf_orientation_toiture || ficheData.orientation_toiture)) {
        updates.conf_orientation_toiture = (ficheData.conf_orientation_toiture || ficheData.orientation_toiture).toString();
        hasChanges = true;
      }

      // Zones ombres
      if (!prev.conf_zones_ombres && (ficheData.conf_zones_ombres || ficheData.zones_ombres)) {
        updates.conf_zones_ombres = (ficheData.conf_zones_ombres || ficheData.zones_ombres).toString();
        hasChanges = true;
      }

      // Site classé
      if (!prev.conf_site_classe && (ficheData.conf_site_classe || ficheData.site_classe)) {
        updates.conf_site_classe = (ficheData.conf_site_classe || ficheData.site_classe).toString();
        hasChanges = true;
      }

      // Consommation électricité
      if (!prev.conf_consommation_electricite && (ficheData.conf_consommation_electricite != null || ficheData.consommation_electricite != null)) {
        updates.conf_consommation_electricite = String(ficheData.conf_consommation_electricite != null ? ficheData.conf_consommation_electricite : ficheData.consommation_electricite);
        hasChanges = true;
      }

      // Nombre de pans
      if (!prev.nb_pans && ficheData.nb_pans != null) {
        updates.nb_pans = String(ficheData.nb_pans);
        hasChanges = true;
      }

      return hasChanges ? { ...prev, ...updates } : prev;
    });
  }, [ficheData, setRdvFormData]);

  // Récupérer les modes de chauffage pour les champs PAC
  const { data: modeChauffage } = useQuery('mode-chauffage', async () => {
    const res = await api.get('/management/mode-chauffage');
    return res.data.data || [];
  });

  const { data: professionsRdv } = useQuery('professions', async () => {
    const res = await api.get('/management/professions');
    return res.data?.data || res.data || [];
  });
  const { data: typeContratRdv } = useQuery('type-contrat', async () => {
    const res = await api.get('/management/type-contrat');
    return res.data?.data || res.data || [];
  });
  const [rdvProfMrDisplay, setRdvProfMrDisplay] = useState('');
  const [rdvProfMmeDisplay, setRdvProfMmeDisplay] = useState('');
  const [showRdvSuggestionsMr, setShowRdvSuggestionsMr] = useState(false);
  const [showRdvSuggestionsMme, setShowRdvSuggestionsMme] = useState(false);

  // Afficher le nom de la profession dans l'autocomplete quand ficheData ou rdvFormData a un id (après déclaration de professionsRdv / state)
  useEffect(() => {
    if (!professionsRdv?.length) return;
    if (rdvFormData.conf_profession_monsieur) {
      const p = professionsRdv.find(pr => String(pr.id) === String(rdvFormData.conf_profession_monsieur));
      if (p?.nom && (rdvProfMrDisplay === '' || rdvProfMrDisplay === p.nom)) setRdvProfMrDisplay(p.nom);
    }
    if (rdvFormData.conf_profession_madame) {
      const p = professionsRdv.find(pr => String(pr.id) === String(rdvFormData.conf_profession_madame));
      if (p?.nom && (rdvProfMmeDisplay === '' || rdvProfMmeDisplay === p.nom)) setRdvProfMmeDisplay(p.nom);
    }
  }, [professionsRdv, rdvFormData.conf_profession_monsieur, rdvFormData.conf_profession_madame]);

  const { data: produits, isLoading: isLoadingProduits, error: produitsError } = useQuery(
    'produits-modal', 
    async () => {
      try {
        const res = await api.get('/management/produits');
        console.log('Produits API response:', res.data);
        const produitsData = res.data?.data || res.data || [];
        console.log('Produits data:', produitsData);
        return produitsData;
      } catch (error) {
        console.error('Erreur lors de la récupération des produits:', error);
        return [];
      }
    },
    {
      enabled: true, // Toujours activer la requête
      staleTime: 5 * 60 * 1000, // Cache pendant 5 minutes
      retry: 2,
    }
  );
  
  // Debug: afficher les produits dans la console
  useEffect(() => {
    console.log('Produits dans le modal:', produits);
    console.log('isLoadingProduits:', isLoadingProduits);
    console.log('produitsError:', produitsError);
  }, [produits, isLoadingProduits, produitsError]);

  useEffect(() => {
    setShowRdvConfFields(false);
  }, [selectedSlot?.date, selectedSlot?.hour]);

  const dateFormatted = selectedSlot 
    ? formatRdvDateTime(`${selectedSlot.date} ${String(selectedSlot.hour).substring(0, 5)}`)
    : '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content rdv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ color: '#000' }}>Créer un rendez-vous</h2>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="modal-body">
          <div className="rdv-form-info">
            <p><strong>Date et heure :</strong> {dateFormatted}</p>
            <p><strong>Fiche :</strong> {ficheData?.nom || ''} {ficheData?.prenom || ''} ({ficheData?.tel || ''})</p>
          </div>

          <form className="rdv-form" onSubmit={async (e) => {
            e.preventDefault();
            if (rdvSubmitting) return;
            const idMr = await resolveProfessionId(api, rdvProfMrDisplay, rdvFormData.conf_profession_monsieur, professionsRdv);
            const idMme = await resolveProfessionId(api, rdvProfMmeDisplay, rdvFormData.conf_profession_madame, professionsRdv);
            onSubmit({ ...rdvFormData, conf_profession_monsieur: idMr, conf_profession_madame: idMme });
          }}>
            <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              {!showRdvConfFields ? (
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowRdvConfFields(true)}
                  title="Afficher les champs conf_"
                >
                  <FaReplyAll size={20} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowRdvConfFields(false)}
                  title="Réduire les champs conf_"
                >
                  <FaChevronUp size={20} />
                </button>
              )}
            </div>
            <table className="rdv-form-table">
              <tbody>
                {/* RDV urgent */}
                <tr>
                  <td>
                    {(() => {
                      const rdvDateStr = rdvFormData.date_rdv_time ? rdvFormData.date_rdv_time.split(' ')[0] : '';
                      let isAutoUrgent = false;
                      if (rdvDateStr) {
                        const rdvDate = new Date(rdvDateStr);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const tomorrow = new Date(today);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const rdvDateOnly = new Date(rdvDate);
                        rdvDateOnly.setHours(0, 0, 0, 0);
                        isAutoUrgent = rdvDateOnly.getTime() === today.getTime() || rdvDateOnly.getTime() === tomorrow.getTime();
                      }
                      const isUrgent = rdvFormData.is_urgent || isAutoUrgent;
                      return <strong>RDV URGENT</strong>;
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const rdvDateStr = rdvFormData.date_rdv_time ? rdvFormData.date_rdv_time.split(' ')[0] : '';
                      let isAutoUrgent = false;
                      if (rdvDateStr) {
                        const rdvDate = new Date(rdvDateStr);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const tomorrow = new Date(today);
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const rdvDateOnly = new Date(rdvDate);
                        rdvDateOnly.setHours(0, 0, 0, 0);
                        isAutoUrgent = rdvDateOnly.getTime() === today.getTime() || rdvDateOnly.getTime() === tomorrow.getTime();
                      }
                      const isUrgent = rdvFormData.is_urgent || isAutoUrgent;
                      return (
                        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isUrgent}
                            onChange={(e) => setRdvFormData({...rdvFormData, is_urgent: e.target.checked, id_etat_final: 7})}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: 'bold' }}>RDV URGENT</span>
                          {isAutoUrgent && (
                            <span style={{ fontSize: '0.72em', color: '#f44336', fontStyle: 'italic', marginLeft: '8px' }}>
                              (Automatique : RDV aujourd'hui ou demain)
                            </span>
                          )}
                        </label>
                      );
                    })()}
                  </td>
                </tr>
                <tr>
                  <td><label htmlFor="rdv_date">Date RDV *</label></td>
                  <td>
                    <input
                      type="date"
                      id="rdv_date"
                      className="form-control"
                      value={rdvFormData.date_rdv_time ? rdvFormData.date_rdv_time.split(' ')[0] : ''}
                      onChange={(e) => {
                        const time = rdvFormData.date_rdv_time ? rdvFormData.date_rdv_time.split(' ')[1] : '00:00';
                        setRdvFormData({...rdvFormData, date_rdv_time: `${e.target.value} ${time}`});
                      }}
                      required
                    />
                  </td>
                </tr>
                <tr>
                  <td><label htmlFor="rdv_time">Heure RDV *</label></td>
                  <td>
                    <input
                      type="time"
                      id="rdv_time"
                      className="form-control"
                      value={rdvFormData.date_rdv_time ? rdvFormData.date_rdv_time.split(' ')[1]?.substring(0, 5) : ''}
                      onChange={(e) => {
                        const date = rdvFormData.date_rdv_time ? rdvFormData.date_rdv_time.split(' ')[0] : selectedSlot?.date || '';
                        setRdvFormData({...rdvFormData, date_rdv_time: `${date} ${e.target.value}`});
                      }}
                      required
                    />
                  </td>
                </tr>
                <tr>
                  <td><label htmlFor="rdv_produit">Produit *</label></td>
                  <td>
                    {isLoadingProduits ? (
                      <div>Chargement des produits...</div>
                    ) : produitsError ? (
                      <div style={{ color: 'red' }}>Erreur lors du chargement des produits</div>
                    ) : (
                      <select
                        id="rdv_produit"
                        className="form-control"
                        value={rdvFormData.produit}
                        onChange={(e) => setRdvFormData({...rdvFormData, produit: e.target.value})}
                        required
                      >
                        <option value="">Sélectionner un produit</option>
                        {produits && Array.isArray(produits) && produits.length > 0 ? (
                          produits
                            .filter(p => p && (p.etat > 0 || p.etat === undefined))
                            .map(prod => (
                              <option key={prod.id} value={prod.id}>
                                {prod.nom || `Produit ${prod.id}`}
                              </option>
                            ))
                        ) : (
                          <option value="" disabled>Aucun produit disponible</option>
                        )}
                      </select>
                    )}
                    {produits && Array.isArray(produits) && (
                      <small style={{ color: '#666', fontSize: '10.2px' }}>
                        {produits.length} produit(s) disponible(s)
                      </small>
                    )}
                  </td>
                </tr>
                <tr>
                  <td><label htmlFor="rdv_confirmateur">Confirmateur *</label></td>
                  <td>
                    <select
                      id="rdv_confirmateur"
                      className="form-control"
                      value={rdvFormData.id_confirmateur}
                      onChange={(e) => setRdvFormData({...rdvFormData, id_confirmateur: e.target.value})}
                      disabled={isConfirmateurSession}
                      required
                    >
                      <option value="">{isConfirmateurSession ? '—' : 'Sélectionner'}</option>
                      {isConfirmateurSession ? (
                        rdvFormData.id_confirmateur ? (
                          <option value={rdvFormData.id_confirmateur}>
                            {getConfirmateurLabel(rdvFormData.id_confirmateur)}
                          </option>
                        ) : null
                      ) : (
                        confirmateurs?.map(conf => (
                          <option key={conf.id} value={conf.id}>
                            {conf.pseudo}
                          </option>
                        ))
                      )}
                    </select>
                  </td>
                </tr>
                <tr>
                  <td><label htmlFor="rdv_confirmateur_2">Confirmateur 2 (optionnel)</label></td>
                  <td>
                    <select
                      id="rdv_confirmateur_2"
                      className="form-control"
                      value={rdvFormData.id_confirmateur_2}
                      onChange={(e) => setRdvFormData({...rdvFormData, id_confirmateur_2: e.target.value})}
                      disabled={isConfirmateurSession}
                    >
                      <option value="">Aucun</option>
                      {isConfirmateurSession ? (
                        rdvFormData.id_confirmateur_2 ? (
                          <option value={rdvFormData.id_confirmateur_2}>
                            {getConfirmateurLabel(rdvFormData.id_confirmateur_2)}
                          </option>
                        ) : null
                      ) : (
                        confirmateurs?.map(conf => (
                          <option key={conf.id} value={conf.id}>
                            {conf.pseudo}
                          </option>
                        ))
                      )}
                    </select>
                  </td>
                </tr>
                <tr>
                  <td><label htmlFor="rdv_confirmateur_3">Confirmateur 3 (optionnel)</label></td>
                  <td>
                    <select
                      id="rdv_confirmateur_3"
                      className="form-control"
                      value={rdvFormData.id_confirmateur_3}
                      onChange={(e) => setRdvFormData({...rdvFormData, id_confirmateur_3: e.target.value})}
                      disabled={isConfirmateurSession}
                    >
                      <option value="">Aucun</option>
                      {isConfirmateurSession ? (
                        rdvFormData.id_confirmateur_3 ? (
                          <option value={rdvFormData.id_confirmateur_3}>
                            {getConfirmateurLabel(rdvFormData.id_confirmateur_3)}
                          </option>
                        ) : null
                      ) : (
                        confirmateurs?.map(conf => (
                          <option key={conf.id} value={conf.id}>
                            {conf.pseudo}
                          </option>
                        ))
                      )}
                    </select>
                  </td>
                </tr>
                {showRdvConfFields && (
                  <>
                <tr>
                  <td><label htmlFor="rdv_avec">RDV pris avec</label></td>
                  <td>
                    <select
                      id="rdv_avec"
                      className="form-control"
                      value={rdvFormData.conf_rdv_avec}
                      onChange={(e) => setRdvFormData({...rdvFormData, conf_rdv_avec: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      <option value="MR">MR</option>
                      <option value="MME">MME</option>
                      <option value="AUTRE">AUTRE</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td><label>Appel en Tunisie avec</label></td>
                  <td>
                    <select
                      className="form-control"
                      value={rdvFormData.conf_appel_tunisie_avec || ''}
                      onChange={(e) => setRdvFormData({...rdvFormData, conf_appel_tunisie_avec: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      <option value="MR">Mr</option>
                      <option value="MME">Mme</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td><label>A déjà fait une étude</label></td>
                  <td>
                    <select
                      className="form-control"
                      value={rdvFormData.conf_deja_etude || ''}
                      onChange={(e) => setRdvFormData({...rdvFormData, conf_deja_etude: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      <option value="OUI">OUI</option>
                      <option value="NON">NON</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td><label>RDV déjà annulé précédemment</label></td>
                  <td>
                    <select
                      className="form-control"
                      value={rdvFormData.conf_rdv_annule_precedent || ''}
                      onChange={(e) => setRdvFormData({...rdvFormData, conf_rdv_annule_precedent: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      <option value="OUI">OUI</option>
                      <option value="NON">NON</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td><label>Présence du couple ou célibataire</label></td>
                  <td>
                    <select
                      className="form-control"
                      value={rdvFormData.conf_presence_couple || ''}
                      onChange={(e) => setRdvFormData({...rdvFormData, conf_presence_couple: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      <option value="OUI">OUI</option>
                      <option value="NON">NON</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td><label>Profession MR</label></td>
                  <td>
                    <div className="autocomplete-wrap">
                      <input
                        type="text"
                        className="autocomplete-input"
                        placeholder="Rechercher ou saisir une profession..."
                        autoComplete="off"
                        value={rdvProfMrDisplay}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRdvProfMrDisplay(v);
                          if (!(professionsRdv || []).find(p => (p.nom || '') === v) && rdvFormData.conf_profession_monsieur) {
                            setRdvFormData(prev => ({ ...prev, conf_profession_monsieur: '' }));
                          }
                        }}
                        onFocus={() => setShowRdvSuggestionsMr(true)}
                        onBlur={() => setTimeout(() => setShowRdvSuggestionsMr(false), 200)}
                      />
                      <div className={`autocomplete-suggestions ${showRdvSuggestionsMr ? 'active' : ''}`}>
                        {(professionsRdv || [])
                          .filter(p => !rdvProfMrDisplay || (p.nom || '').toLowerCase().includes(rdvProfMrDisplay.toLowerCase()))
                          .slice(0, 50)
                          .map(prof => (
                            <div
                              key={prof.id}
                              onMouseDown={(e) => { e.preventDefault(); setRdvFormData(prev => ({ ...prev, conf_profession_monsieur: String(prof.id) })); setRdvProfMrDisplay(prof.nom || ''); setShowRdvSuggestionsMr(false); }}
                            >
                              {prof.nom}
                            </div>
                          ))}
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td><label>Type de Contrat MR</label></td>
                  <td>
                    <select
                      className="form-control"
                      value={rdvFormData.conf_type_contrat_mr || ''}
                      onChange={(e) => setRdvFormData({...rdvFormData, conf_type_contrat_mr: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      {(typeContratRdv || []).map(t => (
                        <option key={t.id} value={t.id}>{t.nom}</option>
                      ))}
                    </select>
                  </td>
                </tr>
                <tr>
                  <td><label>Profession MME</label></td>
                  <td>
                    <div className="autocomplete-wrap">
                      <input
                        type="text"
                        className="autocomplete-input"
                        placeholder="Rechercher ou saisir une profession..."
                        autoComplete="off"
                        value={rdvProfMmeDisplay}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRdvProfMmeDisplay(v);
                          if (!(professionsRdv || []).find(p => (p.nom || '') === v) && rdvFormData.conf_profession_madame) {
                            setRdvFormData(prev => ({ ...prev, conf_profession_madame: '' }));
                          }
                        }}
                        onFocus={() => setShowRdvSuggestionsMme(true)}
                        onBlur={() => setTimeout(() => setShowRdvSuggestionsMme(false), 200)}
                      />
                      <div className={`autocomplete-suggestions ${showRdvSuggestionsMme ? 'active' : ''}`}>
                        {(professionsRdv || [])
                          .filter(p => !rdvProfMmeDisplay || (p.nom || '').toLowerCase().includes(rdvProfMmeDisplay.toLowerCase()))
                          .slice(0, 50)
                          .map(prof => (
                            <div
                              key={prof.id}
                              onMouseDown={(e) => { e.preventDefault(); setRdvFormData(prev => ({ ...prev, conf_profession_madame: String(prof.id) })); setRdvProfMmeDisplay(prof.nom || ''); setShowRdvSuggestionsMme(false); }}
                            >
                              {prof.nom}
                            </div>
                          ))}
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td><label>Type de Contrat MME</label></td>
                  <td>
                    <select
                      className="form-control"
                      value={rdvFormData.conf_type_contrat_madame || ''}
                      onChange={(e) => setRdvFormData({...rdvFormData, conf_type_contrat_madame: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      {(typeContratRdv || []).map(t => (
                        <option key={t.id} value={t.id}>{t.nom}</option>
                      ))}
                    </select>
                  </td>
                </tr>
                <tr>
                  <td><label>Revenu</label></td>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={rdvFormData.conf_revenu || ''}
                      onChange={(e) => setRdvFormData({...rdvFormData, conf_revenu: e.target.value})}
                      placeholder="Revenu"
                    />
                  </td>
                </tr>
                <tr>
                  <td><label>Crédit</label></td>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={rdvFormData.conf_credit || ''}
                      onChange={(e) => setRdvFormData({...rdvFormData, conf_credit: e.target.value})}
                      placeholder="Crédit"
                    />
                  </td>
                </tr>
                <tr>
                  <td><label>Mode de chauffage</label></td>
                  <td>
                    <select
                      className="form-control"
                      value={rdvFormData.conf_mode_chauffage || ''}
                      onChange={(e) => setRdvFormData({...rdvFormData, conf_mode_chauffage: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      {(modeChauffage || []).map(mode => (
                        <option key={mode.id} value={mode.id}>{mode.nom || mode.titre || `Mode ${mode.id}`}</option>
                      ))}
                    </select>
                  </td>
                </tr>
                <tr>
                  <td><label>Complément de chauffage</label></td>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={rdvFormData.conf_complement_chauffage || ''}
                      onChange={(e) => setRdvFormData({ ...rdvFormData, conf_complement_chauffage: e.target.value })}
                      placeholder="Ex. appoint électrique, poêle…"
                    />
                  </td>
                </tr>
                <tr>
                  <td><label>Consommations électrique</label></td>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={rdvFormData.conf_consommation_electricite || ''}
                      onChange={(e) => setRdvFormData({...rdvFormData, conf_consommation_electricite: e.target.value})}
                      placeholder="Ex: 800 €/an"
                    />
                  </td>
                </tr>
                <tr>
                  <td><label>Consommations chauffage</label></td>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={rdvFormData.conf_consommation_chauffage || ''}
                      onChange={(e) => setRdvFormData({...rdvFormData, conf_consommation_chauffage: e.target.value})}
                      placeholder="Ex: 1500 €/an"
                    />
                  </td>
                </tr>

                {/* Champs spécifiques PAC */}
                {(() => {
                  const selectedProduit = produits?.find(p => String(p.id) === String(rdvFormData.produit));
                  const isPAC = selectedProduit?.nom?.toUpperCase().includes('PAC') || rdvFormData.produit === '1';
                  if (!isPAC) return null;
                  return (
                    <>
                      <tr>
                        <td><label htmlFor="rdv_surface_chauffee">Surface chauffée (m²)</label></td>
                        <td>
                          <input
                            type="number"
                            id="rdv_surface_chauffee"
                            className="form-control"
                            value={rdvFormData.surface_chauffee || ''}
                            onChange={(e) => setRdvFormData({...rdvFormData, surface_chauffee: e.target.value})}
                            placeholder="Ex: 100"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td><label htmlFor="rdv_consommation_chauffage">Consommation chauffage (€)</label></td>
                        <td>
                          <input
                            type="text"
                            id="rdv_consommation_chauffage"
                            className="form-control"
                            value={rdvFormData.consommation_chauffage || ''}
                            onChange={(e) => setRdvFormData({...rdvFormData, consommation_chauffage: e.target.value})}
                            placeholder="Ex: 1500 €/an"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td><label htmlFor="rdv_annee_systeme">Année système chauffage</label></td>
                        <td>
                          <input
                            type="number"
                            id="rdv_annee_systeme"
                            className="form-control"
                            value={rdvFormData.annee_systeme_chauffage || ''}
                            onChange={(e) => setRdvFormData({...rdvFormData, annee_systeme_chauffage: e.target.value})}
                            placeholder="Ex: 2010"
                          />
                        </td>
                      </tr>
                    </>
                  );
                })()}
                {/* Champs spécifiques PV */}
                {(() => {
                  const selectedProduit = produits?.find(p => String(p.id) === String(rdvFormData.produit));
                  const isPV = selectedProduit?.nom?.toUpperCase().includes('PV') || rdvFormData.produit === '2';
                  if (!isPV) return null;
                  return (
                    <>
                      <tr>
                        <td><label htmlFor="rdv_surface_habitable">Surface habitable (m²)</label></td>
                        <td>
                          <input
                            type="number"
                            id="rdv_surface_habitable"
                            className="form-control"
                            value={rdvFormData.surface_habitable || ''}
                            onChange={(e) => setRdvFormData({...rdvFormData, surface_habitable: e.target.value})}
                            placeholder="Ex: 120"
                            min="0"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td><label htmlFor="rdv_orientation">Orientation toiture</label></td>
                        <td>
                          <input
                            type="text"
                            id="rdv_orientation"
                            className="form-control"
                            value={rdvFormData.conf_orientation_toiture || ''}
                            onChange={(e) => setRdvFormData({...rdvFormData, conf_orientation_toiture: e.target.value})}
                            placeholder="Ex: Sud, Nord-Est..."
                          />
                        </td>
                      </tr>
                      <tr>
                        <td><label htmlFor="rdv_zones_ombres">Zones ombres</label></td>
                        <td>
                          <input
                            type="text"
                            id="rdv_zones_ombres"
                            className="form-control"
                            value={rdvFormData.conf_zones_ombres}
                            onChange={(e) => setRdvFormData({...rdvFormData, conf_zones_ombres: e.target.value})}
                            placeholder="Ex: Arbres, cheminée, bâtiment voisin..."
                          />
                        </td>
                      </tr>
                      <tr>
                        <td><label htmlFor="rdv_site_classe">Proche d&apos;un site classé</label></td>
                        <td>
                          <input
                            type="text"
                            id="rdv_site_classe"
                            className="form-control"
                            value={rdvFormData.conf_site_classe || ''}
                            onChange={(e) => setRdvFormData({...rdvFormData, conf_site_classe: e.target.value})}
                            placeholder="Ex: Oui, Non, précisions..."
                          />
                        </td>
                      </tr>
                      <tr>
                        <td><label htmlFor="rdv_nb_pans">Nombre de pans</label></td>
                        <td>
                          <input
                            type="number"
                            id="rdv_nb_pans"
                            className="form-control"
                            min="1"
                            value={rdvFormData.nb_pans}
                            onChange={(e) => setRdvFormData({...rdvFormData, nb_pans: e.target.value})}
                            placeholder="Ex: 4"
                          />
                        </td>
                      </tr>
                    </>
                  );
                })()}
                  </>
                )}
                <tr>
                  <td><label htmlFor="rdv_commentaire">Commentaire Confirmation</label></td>
                  <td>
                    <textarea
                      id="rdv_commentaire"
                      className="form-control"
                      rows="4"
                      value={rdvFormData.conf_commentaire_produit}
                      onChange={(e) => setRdvFormData({...rdvFormData, conf_commentaire_produit: e.target.value})}
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Annuler
              </button>
              <button type="submit" className="btn-save" disabled={rdvSubmitting}>
                {rdvSubmitting ? 'Création…' : 'Créer le RDV'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FicheDetail;
