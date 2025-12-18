import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { FaEdit, FaCheck, FaTimes, FaCalendar, FaUser, FaPhone, FaMapMarkerAlt, FaHome, FaBriefcase, FaFileAlt, FaHistory, FaArrowLeft, FaChevronLeft, FaChevronRight, FaChevronDown, FaChevronUp, FaSms, FaListAlt, FaInfoCircle, FaFilePdf } from 'react-icons/fa';
import jsPDF from 'jspdf';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useRouteParams } from '../contexts/RouteParamsContext';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import './FicheDetail.css';

// Créneaux horaires
const TIME_SLOTS = [
  { hour: '09:00:00', name: '9H ( 9h uniquement )' },
  { hour: '11:00:00', name: '11H ( 11h à 12h )' },
  { hour: '13:00:00', name: '13H ( 13h à 14h30 )' },
  { hour: '16:00:00', name: '16H ( 16h à 17h )' },
  { hour: '18:00:00', name: '18H ( 18h à 19h )' },
  { hour: '19:30:00', name: '20H ( 19h30 à 20h )' }
];

// Helper pour calculer le timeKey à partir d'une heure (HH:MM:SS)
// Évite les problèmes de fuseau horaire en calculant directement les secondes depuis minuit UTC
function hourToTimeKey(hour) {
  const [hours, minutes, seconds] = hour.split(':').map(Number);
  return hours * 3600 + minutes * 60 + (seconds || 0);
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
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [planningWeek, setPlanningWeek] = useState(null);
  const [planningYear, setPlanningYear] = useState(null);
  const [planningDep, setPlanningDep] = useState(null);
  
  // État pour le modal de création de RDV
  const [showRdvModal, setShowRdvModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); // { date, hour }
  const [rdvFormData, setRdvFormData] = useState({
    date_rdv_time: '',
    id_etat_final: 7, // CONFIRMER par défaut
    is_urgent: false, // RDV_URGENT
    id_confirmateur: '',
    id_confirmateur_2: '',
    id_confirmateur_3: '',
    produit: '',
    conf_rdv_avec: '',
    // Champs spécifiques PV
    conf_orientation_toiture: '',
    conf_zones_ombres: '',
    conf_site_classe: '',
    conf_consommation_electricite: '',
    nb_pans: '',
    // Champs spécifiques PAC
    surface_chauffee: '',
    consommation_chauffage: '',
    mode_chauffage: '',
    annee_systeme_chauffage: '',
    conf_commentaire_produit: ''
  });
  
  // État pour le formulaire de confirmation
  const [selectedEtat, setSelectedEtat] = useState(null);
  const [confFormData, setConfFormData] = useState({
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
    nb_pans: '',
    conf_commentaire_produit: ''
  });

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
  
  // États pour le formulaire de validation
  const [confRdvAvecValue, setConfRdvAvecValue] = useState('');
  const [confPresenceCoupleValue, setConfPresenceCoupleValue] = useState('');
  const [showHistorique, setShowHistorique] = useState(false); // État pour contrôler l'affichage de l'historique

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
    return (res.data.data || []).filter(u => u.fonction === 6);
  });

  const { data: etats } = useQuery('etats', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

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

  // Récupérer les sous-états dynamiquement selon l'état sélectionné
  // États qui ont des sous-états : 2 (NRP), 8 (ANNULER À REPROGRAMMER), 13 (SIGNER), 16 (SIGNER RETRACTER), 19 (RAPPEL POUR BUREAU), 44 (SIGNER PM), 45 (SIGNER COMPLET)
  const etatsAvecSousEtats = [2, 8, 13, 16, 19, 44, 45];
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
    { enabled: selectedEtat !== null && etatsAvecSousEtats.includes(selectedEtat) }
  );

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
      
      if (sousEtatToSelect && !etatFormData.id_sous_etat) {
        setEtatFormData({ ...etatFormData, id_sous_etat: String(sousEtatToSelect.id) });
      }
    }
  }, [sousEtats, compteRenduOption, selectedEtat]);

  // Récupérer la fiche (utiliser le hash au lieu de l'ID)
  const { data: ficheData, isLoading } = useQuery(
    ['fiche', hash],
    async () => {
      const res = await api.get(`/fiches/${hash}`);
      return res.data.data;
    },
    { enabled: !!hash }
  );

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

  // Initialiser les données NRP si la fiche est déjà en état NRP
  useEffect(() => {
    if (ficheData && ficheData.id_etat_final === 2 && !selectedEtat) {
      // Si la fiche est en état NRP, initialiser les données du formulaire
      if (ficheData.date_appel_time) {
        const dateAppel = new Date(ficheData.date_appel_time);
        setNrpFormData({
          date_appel_date: dateAppel.toISOString().split('T')[0],
          date_appel_time: dateAppel.toTimeString().slice(0, 5),
          id_sous_etat: ficheData.id_sous_etat ? String(ficheData.id_sous_etat) : '',
          conf_commentaire_produit: ficheData.conf_commentaire_produit || ''
        });
      } else {
        // Initialiser avec des valeurs vides si pas de date_appel_time
        setNrpFormData({
          date_appel_date: '',
          date_appel_time: '',
          id_sous_etat: ficheData.id_sous_etat ? String(ficheData.id_sous_etat) : '',
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
          dateStr = parsedDate.toISOString().split('T')[0];
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
    
    // Initialiser le formulaire avec les données de la fiche
    setRdvFormData({
      date_rdv_time: `${dateStr} ${timeStr}`,
      id_etat_final: 7, // CONFIRMER par défaut
      is_urgent: ficheData?.rdv_urgent === 1 || ficheData?.rdv_urgent === true || ficheData?.qualification_code === 'RDV_URGENT', // RDV_URGENT
      id_confirmateur: ficheData?.id_confirmateur ? String(ficheData.id_confirmateur) : '',
      id_confirmateur_2: ficheData?.id_confirmateur_2 ? String(ficheData.id_confirmateur_2) : '',
      id_confirmateur_3: ficheData?.id_confirmateur_3 ? String(ficheData.id_confirmateur_3) : '',
      produit: ficheData?.produit ? String(ficheData.produit) : '',
      conf_rdv_avec: ficheData?.conf_rdv_avec || '',
      // Champs spécifiques PV
      conf_orientation_toiture: ficheData?.conf_orientation_toiture || ficheData?.orientation_toiture || '',
      conf_zones_ombres: ficheData?.conf_zones_ombres || ficheData?.zones_ombres || '',
      conf_site_classe: ficheData?.conf_site_classe || ficheData?.site_classe || '',
      conf_consommation_electricite: ficheData?.conf_consommation_electricite || ficheData?.consommation_electricite || '',
      nb_pans: ficheData?.nb_pans ? String(ficheData.nb_pans) : '',
      // Champs spécifiques PAC
      surface_chauffee: ficheData?.surface_chauffee || '',
      consommation_chauffage: ficheData?.consommation_chauffage || '',
      mode_chauffage: ficheData?.mode_chauffage ? String(ficheData.mode_chauffage) : '',
      annee_systeme_chauffage: ficheData?.annee_systeme_chauffage || '',
      conf_commentaire_produit: ficheData?.conf_commentaire_produit || ficheData?.commentaire || ''
    });
    
    setSelectedSlot({ date, hour });
    setShowRdvModal(true);
  };

  // Fonction pour créer le RDV depuis le formulaire
  const handleCreateRdvFromForm = async () => {
    if (!rdvFormData.date_rdv_time) {
      alert('Veuillez remplir la date et l\'heure du RDV');
      return;
    }

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
        date_rdv_time: rdvFormData.date_rdv_time.includes(':') 
          ? rdvFormData.date_rdv_time 
          : `${rdvFormData.date_rdv_time}:00`,
        id_etat_final: 7, // Toujours CONFIRMER (7) - RDV_URGENT est géré via id_qualif
        produit: rdvFormData.produit ? parseInt(rdvFormData.produit) : null,
        id_confirmateur: rdvFormData.id_confirmateur ? parseInt(rdvFormData.id_confirmateur) : null,
        id_confirmateur_2: rdvFormData.id_confirmateur_2 ? parseInt(rdvFormData.id_confirmateur_2) : null,
        id_confirmateur_3: rdvFormData.id_confirmateur_3 ? parseInt(rdvFormData.id_confirmateur_3) : null,
        conf_rdv_avec: rdvFormData.conf_rdv_avec || null,
        // Champs spécifiques PV
        conf_orientation_toiture: rdvFormData.conf_orientation_toiture || null,
        conf_zones_ombres: rdvFormData.conf_zones_ombres || null,
        conf_site_classe: rdvFormData.conf_site_classe || null,
        conf_consommation_electricite: rdvFormData.conf_consommation_electricite || null,
        nb_pans: rdvFormData.nb_pans ? parseInt(rdvFormData.nb_pans) : null,
        // Champs spécifiques PAC
        surface_chauffee: rdvFormData.surface_chauffee || null,
        consommation_chauffage: rdvFormData.consommation_chauffage || null,
        mode_chauffage: rdvFormData.mode_chauffage ? parseInt(rdvFormData.mode_chauffage) : null,
        annee_systeme_chauffage: rdvFormData.annee_systeme_chauffage ? parseInt(rdvFormData.annee_systeme_chauffage) : null,
        conf_commentaire_produit: rdvFormData.conf_commentaire_produit || null
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
      updateData.rdv_urgent = (rdvFormData.is_urgent || isTodayOrTomorrow) ? 1 : 0;
      
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
          conf_orientation_toiture: '',
          conf_zones_ombres: '',
          conf_site_classe: '',
          conf_consommation_electricite: '',
          nb_pans: '',
          surface_chauffee: '',
          consommation_chauffage: '',
          mode_chauffage: '',
          annee_systeme_chauffage: '',
          conf_commentaire_produit: ''
        });
        return;
      }

      if (needsApproval) {
        // Créer une notification pour les admins
        const dateFormatted = new Date(updateData.date_rdv_time).toLocaleString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
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
        alert(`Rendez-vous créé avec succès${rdvFormData.is_urgent ? ' (RDV URGENT)' : ' (CONFIRMER)'}`);
      }

      // Fermer le modal
      setShowRdvModal(false);
      setSelectedSlot(null);

      // Recharger les données
      queryClient.invalidateQueries(['fiche', hash]);
      queryClient.invalidateQueries(['planning-week']);
      queryClient.invalidateQueries(['planning-availability']);
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
    
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
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
    const start = new Date(days[0].date);
    const end = new Date(days[days.length - 1].date);
    return `${start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} au ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  };

  // Gérer le changement d'état
  const handleEtatChange = (newEtatId) => {
    setSelectedEtat(newEtatId);
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
      
      setConfFormData({
        produit: ficheData?.produit ? String(ficheData.produit) : '',
        id_confirmateur: ficheData?.id_confirmateur ? String(ficheData.id_confirmateur) : '',
        id_confirmateur_2: ficheData?.id_confirmateur_2 ? String(ficheData.id_confirmateur_2) : '',
        id_confirmateur_3: ficheData?.id_confirmateur_3 ? String(ficheData.id_confirmateur_3) : '',
        conf_rdv_date: rdvDate,
        conf_rdv_time: rdvTime,
        conf_rdv_avec: ficheData?.conf_rdv_avec || '',
        conf_orientation_toiture: ficheData?.conf_orientation_toiture || ficheData?.orientation_toiture || '',
        conf_zones_ombres: ficheData?.conf_zones_ombres || ficheData?.zones_ombres || '',
        conf_site_classe: ficheData?.conf_site_classe || ficheData?.site_classe || '',
        conf_consommation_electricite: ficheData?.conf_consommation_electricite || ficheData?.consommation_electricite || '',
        nb_pans: ficheData?.nb_pans ? String(ficheData.nb_pans) : '',
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
        conf_orientation_toiture: '',
        conf_zones_ombres: '',
        nb_pans: '',
        conf_site_classe: '',
        conf_consommation_electricite: '',
        conf_commentaire_produit: ''
      });
    }
  };

  // Soumettre la confirmation (état 7)
  const handleConfirmSubmit = async () => {
    try {
      // Construire la date/heure du RDV
      const dateRdvTime = confFormData.conf_rdv_date && confFormData.conf_rdv_time 
        ? `${confFormData.conf_rdv_date} ${confFormData.conf_rdv_time}:00`
        : null;

      // Préparer les données à envoyer
      const updateData = {
        id_etat_final: 7,
        produit: confFormData.produit ? parseInt(confFormData.produit) : null,
        id_confirmateur: confFormData.id_confirmateur ? parseInt(confFormData.id_confirmateur) : null,
        id_confirmateur_2: confFormData.id_confirmateur_2 ? parseInt(confFormData.id_confirmateur_2) : null,
        id_confirmateur_3: confFormData.id_confirmateur_3 ? parseInt(confFormData.id_confirmateur_3) : null,
        date_rdv_time: dateRdvTime,
        conf_rdv_avec: confFormData.conf_rdv_avec || null,
        conf_orientation_toiture: confFormData.conf_orientation_toiture || null,
        conf_zones_ombres: confFormData.conf_zones_ombres || null,
        conf_site_classe: confFormData.conf_site_classe || null,
        conf_consommation_electricite: confFormData.conf_consommation_electricite || null,
        nb_pans: confFormData.nb_pans ? parseInt(confFormData.nb_pans) : null,
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
          conf_orientation_toiture: '',
          conf_zones_ombres: '',
          conf_site_classe: '',
          conf_consommation_electricite: '',
          nb_pans: '',
          conf_commentaire_produit: ''
        });
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
          commentaire: etatFormData.conf_commentaire_produit || '',
          id_sous_etat: etatFormData.id_sous_etat ? parseInt(etatFormData.id_sous_etat) : null
        };

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
        } else if (selectedEtat === 8) {
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

        updateCompteRenduMutation.mutate({ crId: editingCompteRendu, data: updateData });
        return;
      }

      const updateData = {
        id_etat_final: parseInt(selectedEtat)
      };

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
        if (etatFormData.conf_commentaire_produit) {
          updateData.conf_commentaire_produit = etatFormData.conf_commentaire_produit;
        }
      } else if (selectedEtat === 19) {
        // RAPPEL POUR BUREAU
        if (etatFormData.date_rappel_date) {
          const dateRappelStr = `${etatFormData.date_rappel_date} ${etatFormData.date_rappel_time || '00:00'}:00`;
          updateData.date_rdv_time = dateRappelStr;
        }
        if (etatFormData.id_sous_etat) {
          updateData.id_sous_etat = parseInt(etatFormData.id_sous_etat);
        }
        if (etatFormData.conf_commentaire_produit) {
          updateData.conf_commentaire_produit = etatFormData.conf_commentaire_produit;
        }
      } else if ([9, 12, 23, 34].includes(selectedEtat)) {
        // CLIENT HONORE A SUIVRE (9), REFUSER (12), HORS CIBLE CONFIRMATEUR (23), HHC FINANCEMENT A VERIFIER (34)
        if (etatFormData.conf_commentaire_produit) {
          updateData.conf_commentaire_produit = etatFormData.conf_commentaire_produit;
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
        alert('État de la fiche mis à jour avec succès');
      }
    } catch (error) {
      console.error('Erreur lors du changement d\'état:', error);
      alert('Erreur lors du changement d\'état: ' + (error.response?.data?.message || error.message));
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
    // - Agents (3) : peuvent modifier les fiches de leur centre
    // - Commerciaux (5) : peuvent modifier leurs propres fiches (avec permission fiches_edit)
    // - Confirmateurs (6) : peuvent modifier toutes les fiches
    const canEdit = !readOnly && (user.fonction === 1 || user.fonction === 2 || user.fonction === 7 || 
                    (user.fonction === 3 && user.centre === ficheData.id_centre) ||
                    (user.fonction === 5 && hasPermission('fiches_edit') && ficheData.id_commercial === user.id) ||
                    (user.fonction === 6)); // Confirmateurs peuvent modifier toutes les fiches

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
              ) : (
                <input
                  type={type}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
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
          {canEdit && !isEditing && (
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
  
  // Obtenir la couleur de l'état
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

  // Fonction pour générer le PDF
  const generatePDF = () => {
    if (!fiche) return;

    const doc = new jsPDF();
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);

    // Fonction helper pour ajouter du texte avec gestion du débordement
    const addText = (text, x, y, options = {}) => {
      const { fontSize = 10, fontStyle = 'normal', color = [0, 0, 0], maxWidth: textMaxWidth = maxWidth } = options;
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      doc.setTextColor(color[0], color[1], color[2]);
      
      const lines = doc.splitTextToSize(String(text || ''), textMaxWidth);
      doc.text(lines, x, y);
      return lines.length * (fontSize * 0.4) + 2;
    };

    // En-tête
    doc.setFillColor(52, 152, 219);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('FICHE CLIENT', pageWidth / 2, 25, { align: 'center' });
    
    yPos = 50;
    doc.setTextColor(0, 0, 0);

    // Informations personnelles
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMATIONS PERSONNELLES', margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    yPos += addText(`Civilité: ${fiche.civ || '-'}`, margin, yPos);
    yPos += addText(`Nom: ${fiche.nom || '-'}`, margin, yPos);
    yPos += addText(`Prénom: ${fiche.prenom || '-'}`, margin, yPos);
    yPos += addText(`Téléphone: ${fiche.tel || '-'}`, margin, yPos);
    yPos += addText(`GSM1: ${fiche.gsm1 || '-'}`, margin, yPos);
    yPos += addText(`GSM2: ${fiche.gsm2 || '-'}`, margin, yPos);
    yPos += addText(`Adresse: ${fiche.adresse || '-'}`, margin, yPos);
    yPos += addText(`Code Postal: ${fiche.cp || '-'}`, margin, yPos);
    yPos += addText(`Ville: ${fiche.ville || '-'}`, margin, yPos);
    yPos += addText(`Situation conjugale: ${fiche.situation_conjugale || '-'}`, margin, yPos);
    yPos += 5;

    // Vérifier si on doit ajouter une nouvelle page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Informations professionnelles
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMATIONS PROFESSIONNELLES', margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const professionMr = professions?.find(p => p.id == fiche.profession_mr)?.nom || fiche.profession_mr || '-';
    const professionMme = professions?.find(p => p.id == fiche.profession_madame)?.nom || fiche.profession_madame || '-';
    const typeContratMr = typeContrat?.find(t => String(t.id) === String(fiche.type_contrat_mr))?.nom || fiche.type_contrat_mr || '-';
    const typeContratMme = typeContrat?.find(t => String(t.id) === String(fiche.type_contrat_madame))?.nom || fiche.type_contrat_madame || '-';
    
    yPos += addText(`Profession Monsieur: ${professionMr}`, margin, yPos);
    yPos += addText(`Type contrat Monsieur: ${typeContratMr}`, margin, yPos);
    yPos += addText(`Profession Madame: ${professionMme}`, margin, yPos);
    yPos += addText(`Type contrat Madame: ${typeContratMme}`, margin, yPos);
    yPos += addText(`Âge Monsieur: ${fiche.age_mr || '-'}`, margin, yPos);
    yPos += addText(`Âge Madame: ${fiche.age_madame || '-'}`, margin, yPos);
    yPos += addText(`Revenu foyer: ${fiche.revenu_foyer || '-'}`, margin, yPos);
    yPos += addText(`Crédit foyer: ${fiche.credit_foyer || '-'}`, margin, yPos);
    yPos += addText(`Nombre d'enfants: ${fiche.nb_enfants || '-'}`, margin, yPos);
    yPos += 5;

    // Vérifier si on doit ajouter une nouvelle page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Informations logement
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMATIONS LOGEMENT', margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    yPos += addText(`Propriétaire maison: ${fiche.proprietaire_maison || '-'}`, margin, yPos);
    yPos += addText(`Surface habitable: ${fiche.surface_habitable || '-'} m²`, margin, yPos);
    yPos += addText(`Surface chauffée: ${fiche.surface_chauffee || '-'} m²`, margin, yPos);
    yPos += addText(`Année système chauffage: ${fiche.annee_systeme_chauffage || '-'}`, margin, yPos);
    const modeChauffageNom = modeChauffage?.find(m => m.id == fiche.mode_chauffage)?.nom || fiche.mode_chauffage || '-';
    yPos += addText(`Mode chauffage: ${modeChauffageNom}`, margin, yPos);
    yPos += addText(`Consommation chauffage: ${fiche.consommation_chauffage || '-'}`, margin, yPos);
    yPos += addText(`Consommation électricité: ${fiche.consommation_electricite || '-'}`, margin, yPos);
    if (fiche.produit === 2) {
      yPos += addText(`Nombre de pans: ${fiche.nb_pans || '-'}`, margin, yPos);
    } else {
      yPos += addText(`Nombre de pièces: ${fiche.nb_pieces || '-'}`, margin, yPos);
    }
    yPos += 5;

    // Vérifier si on doit ajouter une nouvelle page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Informations produit
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMATIONS PRODUIT', margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const produitNom = fiche.produit_nom || (fiche.produit === 1 ? 'PAC' : fiche.produit === 2 ? 'PV' : '-');
    yPos += addText(`Produit: ${produitNom}`, margin, yPos);
    yPos += addText(`Étude: ${fiche.etude || '-'}`, margin, yPos);
    
    if (fiche.produit === 2) {
      yPos += addText(`Orientation toiture: ${fiche.orientation_toiture || '-'}`, margin, yPos);
      yPos += addText(`Site classé: ${fiche.site_classe || '-'}`, margin, yPos);
      yPos += addText(`Zones d'ombres: ${fiche.zones_ombres || '-'}`, margin, yPos);
    }
    yPos += 5;

    // Vérifier si on doit ajouter une nouvelle page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Rendez-vous
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RENDEZ-VOUS', margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (fiche.date_rdv_time) {
      const dateRdv = new Date(fiche.date_rdv_time).toLocaleString('fr-FR');
      yPos += addText(`Date RDV: ${dateRdv}`, margin, yPos);
    } else {
      yPos += addText(`Date RDV: -`, margin, yPos);
    }
    const rdvUrgent = (fiche.rdv_urgent === 1 || fiche.rdv_urgent === true || fiche.qualification_code === 'RDV_URGENT') ? 'OUI' : 'NON';
    yPos += addText(`RDV Urgent: ${rdvUrgent}`, margin, yPos);
    yPos += 5;

    // Vérifier si on doit ajouter une nouvelle page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Assignation
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ASSIGNATION', margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const centreNom = centres?.find(c => c.id === fiche.id_centre)?.titre || fiche.centre_titre || '-';
    const agentNom = agents?.find(a => a.id === fiche.id_agent)?.pseudo || fiche.agent_pseudo || '-';
    const commercialNom = commerciaux?.find(c => c.id === fiche.id_commercial)?.pseudo || fiche.commercial_pseudo || '-';
    const confirmateurNom = confirmateurs?.find(c => c.id === fiche.id_confirmateur)?.pseudo || fiche.confirmateur_pseudo || '-';
    
    yPos += addText(`Centre: ${centreNom}`, margin, yPos);
    yPos += addText(`Agent: ${agentNom}`, margin, yPos);
    if (commercialNom !== '-') {
      yPos += addText(`Commercial: ${commercialNom}`, margin, yPos);
    }
    if (confirmateurNom !== '-') {
      yPos += addText(`Confirmateur: ${confirmateurNom}`, margin, yPos);
    }
    yPos += 5;

    // Commentaire
    if (fiche.commentaire) {
      // Vérifier si on doit ajouter une nouvelle page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('COMMENTAIRE', margin, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      yPos += addText(fiche.commentaire, margin, yPos, { maxWidth: maxWidth });
    }

    // Date d'appel
    if (fiche.date_appel_time || fiche.date_appel) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMATIONS D\'APPEL', margin, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const dateAppel = fiche.date_appel_time 
        ? new Date(fiche.date_appel_time).toLocaleString('fr-FR')
        : (fiche.date_appel ? new Date(fiche.date_appel * 1000).toLocaleString('fr-FR') : '-');
      yPos += addText(`Date & Heure d'appel: ${dateAppel}`, margin, yPos);
    }

    // Pied de page
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} sur ${pageCount} - Généré le ${new Date().toLocaleDateString('fr-FR')}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

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
        <div className="fiche-type-badge" style={{ 
          backgroundColor: fiche.produit_color || (fiche.produit === 1 ? '#0000CD' : '#FFE441'),
          color: fiche.produit === 1 ? 'white' : 'black'
        }}>
          {fiche.produit_nom || (fiche.produit === 1 ? 'PAC' : 'PV')}
        </div>
        <h1><FaInfoCircle /> Détail de la fiche</h1>
      </div>

      {/* Onglets */}
      <div className="fiche-tabs">
        <button
          className={`fiche-tab ${activeTab === 'fiches' ? 'active' : ''}`}
          onClick={() => setActiveTab('fiches')}
        >
          <FaFileAlt /> Fiches
        </button>
        <button
          className={`fiche-tab ${activeTab === 'modifica' ? 'active' : ''}`}
          onClick={() => setActiveTab('modifica')}
        >
          <FaListAlt /> Modifica
        </button>
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
              {renderField('Situation conjugale', 'situation_conjugale', fiche.situation_conjugale, 'select', [
                { value: 'MARIE', label: 'Marié' },
                { value: 'CELIBATAIRE', label: 'Célibataire' },
                { value: 'CONCUBINAGE', label: 'Concubinage' },
                { value: 'VEUF/VEUVE', label: 'Veuf/Veuve' },
                { value: 'DIVORCE', label: 'Divorcé' },
                { value: 'PAXE', label: 'Pacsé' }
              ])}
            </tbody>
          </table>
        </div>

        {/* Section Détails de l'étude */}
        <div className="fiche-section">
          <h2 className="section-title">Détails de l'étude</h2>
          <table className="fiche-details-table">
            <tbody>
              {renderField('Étude à faire pour', 'produit', 
                fiche.produit_nom || (fiche.produit === 1 ? 'PAC' : fiche.produit === 2 ? 'PV' : '-'),
                'select', [
                  { id: 1, nom: 'PAC' },
                  { id: 2, nom: 'PV' }
                ])}
              {renderField('Commentaire', 'commentaire', fiche.commentaire || '-', 'textarea')}
              {renderField('A déjà fait une étude', 'etude', fiche.etude || 'NON', 'select', [
                { value: 'OUI', label: 'Oui' },
                { value: 'NON', label: 'Non' }
              ])}
              {renderField('Détail de l\'étude', 'etude_raison', fiche.etude_raison || '-', 'textarea')}
              {renderField('Mode de chauffage', 'mode_chauffage',
                modeChauffage?.find(m => m.id == fiche.mode_chauffage)?.titre || fiche.mode_chauffage || '-',
                'select', modeChauffage)}
              {renderField('Année de système de chauffage', 'annee_systeme_chauffage', fiche.annee_systeme_chauffage || '-', 'number')}
              {renderField('Surface habitable', 'surface_habitable', fiche.surface_habitable || '-', 'number')}
              {renderField('Consommation chauffage', 'consommation_chauffage', fiche.consommation_chauffage || '-')}
              {renderField('Surface chauffée en M²', 'surface_chauffee', fiche.surface_chauffee || '-', 'number')}
              {fiche.surface_chauffee && fiche.consommation_chauffage && parseFloat(fiche.surface_chauffee) > 0 && parseFloat(fiche.consommation_chauffage.replace(/[^\d.,]/g, '').replace(',', '.')) > 0 ? (
                renderField('Consommation en M²', 'conso', 
                  (parseFloat(fiche.consommation_chauffage.replace(/[^\d.,]/g, '').replace(',', '.')) / parseFloat(fiche.surface_chauffee)).toFixed(2) + ' €/m²',
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
              {renderField('Orientation de la toiture', 'orientation_toiture', fiche.orientation_toiture || fiche.conf_orientation_toiture || '-', 'select', [
                { value: 'NORD', label: 'NORD' },
                { value: 'SUD', label: 'SUD' },
                { value: 'EST', label: 'EST' },
                { value: 'OUEST', label: 'OUEST' },
                { value: 'NORD-EST', label: 'NORD-EST' },
                { value: 'NORD-OUEST', label: 'NORD-OUEST' },
                { value: 'SUD-EST', label: 'SUD-EST' },
                { value: 'SUD-OUEST', label: 'SUD-OUEST' }
              ])}
              {renderField('Proche d\'un site classé', 'site_classe', fiche.site_classe || fiche.conf_site_classe || '-', 'select', [
                { value: 'OUI', label: 'Oui' },
                { value: 'NON', label: 'Non' }
              ])}
              {renderField('Âge du MR', 'age_mr', fiche.age_mr || '-', 'number')}
              {renderField('Âge du Madame', 'age_madame', fiche.age_madame || '-', 'number')}
              {renderField('Consommation électricité', 'consommation_electricite', fiche.consommation_electricite || '-')}
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
              {renderField('Date & Heure d\'appel', 'date_appel_time', 
                (fiche.date_appel_time || fiche.date_appel_date) 
                  ? (fiche.date_appel_time ? new Date(fiche.date_appel_time).toLocaleString('fr-FR') : 
                     (fiche.date_appel_date ? new Date(fiche.date_appel_date).toLocaleDateString('fr-FR') : '-'))
                  : '-',
                null, null, true)}
              {renderField('Entretien en tunisie avec', 'conf_rdv_avec', fiche.conf_rdv_avec || fiche.rdv_avec || '-', 'select', [
                { value: 'MR', label: 'Mr' },
                { value: 'MME', label: 'Mme' }
              ])}
              {renderField('Agent', 'id_agent',
                agents?.find(a => a.id === fiche.id_agent)?.pseudo || fiche.agent_pseudo || '-',
                null, null)}
              {renderField('Centre', 'id_centre',
                centres?.find(c => c.id === fiche.id_centre)?.titre || fiche.centre_titre || '-',
                'select', centres)}
              {renderField('RDV SEUL', 'rdv_seul', 
                (fiche.conf_rdv_avec || fiche.rdv_avec) ? (fiche.conf_rdv_avec === 'SEUL' || fiche.rdv_avec === 'SEUL' ? 'OUI' : 'NON') : '-',
                'select', [
                  { value: 'OUI', label: 'Oui (RDV seul)' },
                  { value: 'NON', label: 'Non (Couple présent)' }
                ])}
            </tbody>
          </table>
        </div>

        {/* Section Informations professionnelles */}
        <div className="fiche-section">
          <h2 className="section-title">Informations professionnelles</h2>
          <table className="fiche-details-table">
            <tbody>
              {renderField('Profession Du MR', 'profession_mr', 
                professions?.find(p => p.id == fiche.profession_mr)?.nom || fiche.profession_mr || '-',
                'select', professions)}
              {renderField('Type de Contrat MR', 'type_contrat_mr',
                typeContrat?.find(t => String(t.id) === String(fiche.type_contrat_mr))?.nom || fiche.type_contrat_mr || '-',
                'select', typeContrat)}
              {renderField('Profession Du Madame', 'profession_madame',
                professions?.find(p => p.id == fiche.profession_madame)?.nom || fiche.profession_madame || '-',
                'select', professions)}
              {renderField('Type de Contrat MME', 'type_contrat_madame',
                typeContrat?.find(t => String(t.id) === String(fiche.type_contrat_madame))?.nom || fiche.type_contrat_madame || '-',
                'select', typeContrat)}
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
        {hasPermission('decalage_create') && 
         user.fonction !== 6 && 
         user.fonction !== 3 && 
         ficheData && !([13, 16, 38, 45, 44].includes(ficheData.id_etat_final)) &&
         ficheData.date_rdv_time && (
          <div className="fiche-section decalage-form">
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
                        <strong>Nouvelle date:</strong> {decalage.date_nouvelle ? new Date(decalage.date_nouvelle).toLocaleString('fr-FR') : (decalage.date_prevu ? new Date(decalage.date_prevu).toLocaleString('fr-FR') : 'N/A')}
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
                      Date originale : {new Date(ficheData.date_rdv_time).toLocaleString('fr-FR')}
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

        {/* Historique */}
        {fiche.historique && fiche.historique.length > 0 && (
          <div className="fiche-section">
            <div 
              className="section-title" 
              style={{ 
                cursor: 'pointer', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                userSelect: 'none'
              }}
              onClick={() => setShowHistorique(!showHistorique)}
            >
              <span>Historique des états</span>
              {showHistorique ? <FaChevronUp /> : <FaChevronDown />}
            </div>
            
            {/* Afficher le dernier statut directement */}
            {fiche.historique.length > 0 && (() => {
              const dernierHisto = fiche.historique[fiche.historique.length - 1];
              
              // Fonction pour afficher les informations selon l'état (réutilisée du code de l'historique)
              const renderHistoDetails = (histo) => {
                const etatId = histo.id_etat;
                const confirmateursList = [
                  histo.confirmateur_pseudo,
                  histo.confirmateur_2_pseudo,
                  histo.confirmateur_3_pseudo
                ].filter(Boolean).join(', ') || '-';
                
                const items = [];
                
                // NRP (2)
                if (etatId === 2) {
                  if (histo.sous_etat_titre) items.push({ label: 'Sous-état', value: histo.sous_etat_titre });
                  if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                  if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                  if (histo.date_rdv_time) items.push({ label: 'A rappeler le', value: new Date(histo.date_rdv_time).toLocaleDateString('fr-FR') });
                  if (histo.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                }
                // RAPPEL POUR BUREAU (19)
                else if (etatId === 19) {
                  if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                  if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                  if (histo.date_rdv_time) items.push({ label: 'A rappeler le', value: new Date(histo.date_rdv_time).toLocaleDateString('fr-FR') });
                  if (histo.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                }
                // ANNULER ET A REPROGRAMMER (8)
                else if (etatId === 8) {
                  if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                  if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                  if (histo.date_rdv_time) items.push({ label: 'A rappeler le', value: new Date(histo.date_rdv_time).toLocaleDateString('fr-FR') });
                  if (histo.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                }
                // CLIENT HONORE A SUIVRE (9)
                else if (etatId === 9) {
                  if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                  if (histo.confirmateur_2_pseudo) items.push({ label: 'Confirmateur 2', value: histo.confirmateur_2_pseudo });
                  if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                  if (histo.date_rdv_time) items.push({ label: 'A rappeler le', value: new Date(histo.date_rdv_time).toLocaleDateString('fr-FR') });
                  if (histo.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                }
                // RDV ANNULER (11)
                else if (etatId === 11) {
                  if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                  if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                  if (histo.conf_rdv_avec) items.push({ label: 'Appel avec qui', value: histo.conf_rdv_avec });
                }
                // RDV ANNULER 2 FOIS (26)
                else if (etatId === 26) {
                  if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                  if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                  if (histo.conf_rdv_avec) items.push({ label: 'Appel avec qui', value: histo.conf_rdv_avec });
                }
                // REFUSER (12)
                else if (etatId === 12) {
                  if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                  if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                  if (histo.date_appel_time) items.push({ label: 'Date appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                }
                // HHC FINANCEMENT A VERIFIER (34)
                else if (etatId === 34) {
                  if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                  if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                  if (histo.date_appel_time) items.push({ label: 'Date appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                }
                // HHC TECHNIQUE (35)
                else if (etatId === 35) {
                  if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                  if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                  if (histo.commercial_pseudo) items.push({ label: 'Commercial', value: histo.commercial_pseudo });
                  if (histo.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                }
                // SIGNER, SIGNER RETRACTER, SIGNER COMPLET, SIGNER PM (13, 16, 45, 44) - Phase 3
                else if ([13, 16, 45, 44].includes(etatId)) {
                  // ETAT
                  if (histo.etat_titre) items.push({ label: 'ETAT', value: histo.etat_titre });
                  
                  // SOUS ETAT : COMPLETE / INCOMPLETE
                  if (histo.sous_etat_titre) {
                    items.push({ label: 'SOUS ETAT', value: histo.sous_etat_titre });
                  }
                  
                  // PSEUDO (Confirmateur)
                  if (histo.confirmateur_pseudo) items.push({ label: 'PSEUDO', value: confirmateursList });
                  
                  // PAC : R/EAU ; R/R
                  if (histo.ph3_pac) {
                    const pacValue = histo.ph3_pac === 'reau' || histo.ph3_pac === 'R/EAU' ? 'R/EAU' : 
                                     histo.ph3_pac === 'rr' || histo.ph3_pac === 'R/R' ? 'R/R' : histo.ph3_pac;
                    items.push({ label: 'PAC', value: pacValue });
                  }
                  
                  // Financement
                  if (histo.ph3_financement || histo.ph3_type) items.push({ label: 'Financement', value: histo.ph3_financement || histo.ph3_type });
                  
                  // Prix
                  if (histo.ph3_prix) items.push({ label: 'Prix', value: histo.ph3_prix });
                  
                  // Crédit immobilier
                  if (histo.credit_immobilier) items.push({ label: 'Crédit immobilier', value: histo.credit_immobilier });
                  
                  // Autre crédit
                  if (histo.credit_autre) items.push({ label: 'Autre crédit', value: histo.credit_autre });
                  
                  // Puissance
                  if (histo.ph3_puissance) items.push({ label: 'Puissance', value: histo.ph3_puissance });
                  
                  // Ballon
                  if (histo.ph3_ballon) {
                    const ballonValue = histo.ph3_ballon === 'OUI' || histo.ph3_ballon === 1 || histo.ph3_ballon === '1' ? 'OUI' :
                                        histo.ph3_ballon === 'NON' || histo.ph3_ballon === 0 || histo.ph3_ballon === '0' ? 'NON' : histo.ph3_ballon;
                    items.push({ label: 'Ballon', value: ballonValue });
                  }
                  
                  // Installateur
                  if (histo.installeur_nom) items.push({ label: 'Installateur', value: histo.installeur_nom });
                  
                  // consommation annuelle ancien système
                  if (histo.ph3_consommation || histo.conf_consommations) items.push({ label: 'Consommation annuelle ancien système', value: histo.ph3_consommation || histo.conf_consommations });
                  
                  // Partie à financer du client (valeur_mensualite ou ph3_mensualite)
                  if (histo.valeur_mensualite || histo.ph3_mensualite) items.push({ label: 'Partie à financer du client', value: histo.valeur_mensualite || histo.ph3_mensualite });
                  
                  // Bonus annoncé
                  if (histo.ph3_bonus || histo.ph3_bonus_30) items.push({ label: 'Bonus annoncé', value: histo.ph3_bonus || histo.ph3_bonus_30 });
                  
                  // Mensualité du crédit
                  if (histo.ph3_mensualite) items.push({ label: 'Mensualité du crédit', value: histo.ph3_mensualite });
                  
                  // Nombre de mois du crédit
                  if (histo.ph3_nbr_annee_finance || histo.nbr_annee_finance) items.push({ label: 'Nombre de mois du crédit', value: histo.ph3_nbr_annee_finance || histo.nbr_annee_finance });
                  
                  // Alimentation
                  if (histo.ph3_alimentation) items.push({ label: 'Alimentation', value: histo.ph3_alimentation });
                  
                  // Type
                  if (histo.ph3_type) items.push({ label: 'Type', value: histo.ph3_type });
                  
                  // DATE SIGNATURE
                  if (histo.date_sign_time) items.push({ label: 'DATE SIGNATURE', value: new Date(histo.date_sign_time).toLocaleString('fr-FR') });
                }
                // CONFIRMER (7)
                else if (etatId === 7) {
                  if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                  if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire confirmateur', value: histo.conf_commentaire_produit, fullWidth: true });
                  if (histo.conf_rdv_avec) items.push({ label: 'Entretien avec', value: histo.conf_rdv_avec });
                  if (histo.date_rdv_time) items.push({ label: 'Date RDV', value: new Date(histo.date_rdv_time).toLocaleString('fr-FR') });
                  if (histo.date_appel_time) items.push({ label: 'Date appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                  
                  // Profession MR et type de contrat
                  const professionMr = professions?.find(p => p.id == histo.profession_mr);
                  const typeContratMr = typeContrat?.find(t => String(t.id) === String(histo.type_contrat_mr));
                  if (histo.profession_mr || histo.type_contrat_mr) {
                    const profMrText = professionMr ? professionMr.nom : (histo.profession_mr || '-');
                    const contratMrText = typeContratMr ? typeContratMr.nom : (histo.type_contrat_mr || '-');
                    items.push({ label: 'Profession MR et type de contrat', value: `${profMrText}${histo.profession_mr && histo.type_contrat_mr ? ' - ' : ''}${contratMrText}` });
                  }
                  
                  // Profession MME et type de contrat
                  const professionMme = professions?.find(p => p.id == histo.profession_madame);
                  const typeContratMme = typeContrat?.find(t => String(t.id) === String(histo.type_contrat_madame));
                  if (histo.profession_madame || histo.type_contrat_madame) {
                    const profMmeText = professionMme ? professionMme.nom : (histo.profession_madame || '-');
                    const contratMmeText = typeContratMme ? typeContratMme.nom : (histo.type_contrat_madame || '-');
                    items.push({ label: 'Profession MME et type de contrat', value: `${profMmeText}${histo.profession_madame && histo.type_contrat_madame ? ' - ' : ''}${contratMmeText}` });
                  }
                  
                  if (histo.revenu_foyer) items.push({ label: 'Revenu', value: histo.revenu_foyer });
                  if (histo.credit_foyer) items.push({ label: 'Crédit', value: histo.credit_foyer });
                  
                  // Mode de chauffage
                  if (histo.mode_chauffage) {
                    const modeChauffageText = modeChauffage?.find(m => m.id == histo.mode_chauffage)?.nom || histo.mode_chauffage;
                    items.push({ label: 'Mode de chauffage', value: modeChauffageText });
                  }
                  
                  // Produit
                  if (histo.produit) {
                    const produitText = produits?.find(p => p.id == histo.produit)?.nom || (histo.produit === 1 ? 'PAC' : histo.produit === 2 ? 'PV' : histo.produit);
                    items.push({ label: 'Produit', value: produitText });
                  }
                }
                    // CONFIRMER (7)
                    else if (etatId === 7) {
                      if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                      if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire confirmateur', value: histo.conf_commentaire_produit, fullWidth: true });
                      if (histo.conf_rdv_avec) items.push({ label: 'Entretien avec', value: histo.conf_rdv_avec });
                      if (histo.date_rdv_time) items.push({ label: 'Date RDV', value: new Date(histo.date_rdv_time).toLocaleString('fr-FR') });
                      if (histo.date_appel_time) items.push({ label: 'Date appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                      
                      // Profession MR et type de contrat
                      const professionMr = professions?.find(p => p.id == histo.profession_mr);
                      const typeContratMr = typeContrat?.find(t => String(t.id) === String(histo.type_contrat_mr));
                      if (histo.profession_mr || histo.type_contrat_mr) {
                        const profMrText = professionMr ? professionMr.nom : (histo.profession_mr || '-');
                        const contratMrText = typeContratMr ? typeContratMr.nom : (histo.type_contrat_mr || '-');
                        items.push({ label: 'Profession MR et type de contrat', value: `${profMrText}${histo.profession_mr && histo.type_contrat_mr ? ' - ' : ''}${contratMrText}` });
                      }
                      
                      // Profession MME et type de contrat
                      const professionMme = professions?.find(p => p.id == histo.profession_madame);
                      const typeContratMme = typeContrat?.find(t => String(t.id) === String(histo.type_contrat_madame));
                      if (histo.profession_madame || histo.type_contrat_madame) {
                        const profMmeText = professionMme ? professionMme.nom : (histo.profession_madame || '-');
                        const contratMmeText = typeContratMme ? typeContratMme.nom : (histo.type_contrat_madame || '-');
                        items.push({ label: 'Profession MME et type de contrat', value: `${profMmeText}${histo.profession_madame && histo.type_contrat_madame ? ' - ' : ''}${contratMmeText}` });
                      }
                      
                      if (histo.revenu_foyer) items.push({ label: 'Revenu', value: histo.revenu_foyer });
                      if (histo.credit_foyer) items.push({ label: 'Crédit', value: histo.credit_foyer });
                      
                      // Mode de chauffage
                      if (histo.mode_chauffage) {
                        const modeChauffageText = modeChauffage?.find(m => m.id == histo.mode_chauffage)?.nom || histo.mode_chauffage;
                        items.push({ label: 'Mode de chauffage', value: modeChauffageText });
                      }
                      
                      // Produit
                      if (histo.produit) {
                        const produitText = produits?.find(p => p.id == histo.produit)?.nom || (histo.produit === 1 ? 'PAC' : histo.produit === 2 ? 'PV' : histo.produit);
                        items.push({ label: 'Produit', value: produitText });
                      }
                    }
                    // Contrôle qualité - États avec cq_etat et cq_dossier
                    else if (histo.cq_etat || histo.cq_dossier) {
                      if (histo.cq_etat) items.push({ label: 'CQ ETAT', value: histo.cq_etat });
                      if (histo.cq_dossier) items.push({ label: 'CQ DOSSIER', value: histo.cq_dossier });
                      if (histo.commentaire_qualite) items.push({ label: 'Observation', value: histo.commentaire_qualite, fullWidth: true });
                    }
                    // Par défaut : afficher confirmateur, commentaire, date appel
                    else {
                      if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                      if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                      if (histo.date_appel_time) items.push({ label: 'Date appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                    }
                
                return items;
              };
              
              const detailItems = renderHistoDetails(dernierHisto);
              
              return (
                <div 
                  className="dernier-statut"
                  style={{
                    padding: '15px',
                    border: `3px solid ${dernierHisto.etat_color || '#3498db'}`,
                    borderRadius: '4px',
                    marginBottom: '15px',
                    backgroundColor: '#f9f9f9'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '15px',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      {/* Afficher le sous-état devant l'état s'il existe */}
                      {dernierHisto.sous_etat_titre && (
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
                          {dernierHisto.sous_etat_titre}
                        </span>
                      )}
                      <span
                        style={{
                          padding: '5px 15px',
                          borderRadius: '4px',
                          backgroundColor: dernierHisto.etat_color || '#3498db',
                          color: dernierHisto.etat_color === '#ffffff' || dernierHisto.etat_color === '#fff' ? '#000' : '#fff',
                          fontWeight: 'bold',
                          fontSize: '14px'
                        }}
                      >
                        {dernierHisto.etat_titre || 'État inconnu'}
                      </span>
                    </div>
                    <span style={{ color: '#666', fontSize: '13px' }}>
                      {dernierHisto.date_creation ? new Date(dernierHisto.date_creation).toLocaleString('fr-FR') : '-'}
                    </span>
                  </div>
                  
                  {/* Afficher les informations complémentaires du dernier statut */}
                  {detailItems.length > 0 && (
                    <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
                      <h4 style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>Informations du changement d'état :</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
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
            })()}
            
            {/* Afficher l'historique complet si ouvert */}
            {showHistorique && (
            <div className="historique-list">
                {fiche.historique.map((histo, index) => {
                  // Fonction pour afficher les informations selon l'état
                  const renderHistoDetails = () => {
                    const etatId = histo.id_etat;
                    const confirmateursList = [
                      histo.confirmateur_pseudo,
                      histo.confirmateur_2_pseudo,
                      histo.confirmateur_3_pseudo
                    ].filter(Boolean).join(', ') || '-';
                    
                    const items = [];
                    
                    // NRP (2)
                    if (etatId === 2) {
                      if (histo.sous_etat_titre) items.push({ label: 'Sous-état', value: histo.sous_etat_titre });
                      if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                      if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                      if (histo.date_rdv_time) items.push({ label: 'A rappeler le', value: new Date(histo.date_rdv_time).toLocaleDateString('fr-FR') });
                      if (histo.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                    }
                    // RAPPEL POUR BUREAU (19)
                    else if (etatId === 19) {
                      if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                      if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                      if (histo.date_rdv_time) items.push({ label: 'A rappeler le', value: new Date(histo.date_rdv_time).toLocaleDateString('fr-FR') });
                      if (histo.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                    }
                    // ANNULER ET A REPROGRAMMER (8)
                    else if (etatId === 8) {
                      if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                      if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                      if (histo.date_rdv_time) items.push({ label: 'A rappeler le', value: new Date(histo.date_rdv_time).toLocaleDateString('fr-FR') });
                      if (histo.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                    }
                    // CLIENT HONORE A SUIVRE (9)
                    else if (etatId === 9) {
                      if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                      if (histo.confirmateur_2_pseudo) items.push({ label: 'Confirmateur 2', value: histo.confirmateur_2_pseudo });
                      if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                      if (histo.date_rdv_time) items.push({ label: 'A rappeler le', value: new Date(histo.date_rdv_time).toLocaleDateString('fr-FR') });
                      if (histo.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                    }
                    // RDV ANNULER (11)
                    else if (etatId === 11) {
                      if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                      if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                      if (histo.conf_rdv_avec) items.push({ label: 'Appel avec qui', value: histo.conf_rdv_avec });
                    }
                    // RDV ANNULER 2 FOIS (26)
                    else if (etatId === 26) {
                      if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                      if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                      if (histo.conf_rdv_avec) items.push({ label: 'Appel avec qui', value: histo.conf_rdv_avec });
                    }
                    // REFUSER (12)
                    else if (etatId === 12) {
                      if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                      if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                      if (histo.date_appel_time) items.push({ label: 'Date appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                    }
                    // HHC FINANCEMENT A VERIFIER (34)
                    else if (etatId === 34) {
                      if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                      if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                      if (histo.date_appel_time) items.push({ label: 'Date appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                    }
                    // HHC TECHNIQUE (35)
                    else if (etatId === 35) {
                      if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                      if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                      if (histo.commercial_pseudo) items.push({ label: 'Commercial', value: histo.commercial_pseudo });
                      if (histo.date_appel_time) items.push({ label: 'Date d\'appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                    }
                    // SIGNER, SIGNER RETRACTER, SIGNER COMPLET, SIGNER PM (13, 16, 45, 44) - Phase 3
                    else if ([13, 16, 45, 44].includes(etatId)) {
                      // ETAT
                      if (histo.etat_titre) items.push({ label: 'ETAT', value: histo.etat_titre });
                      
                      // SOUS ETAT : COMPLETE / INCOMPLETE
                      if (histo.sous_etat_titre) {
                        items.push({ label: 'SOUS ETAT', value: histo.sous_etat_titre });
                      }
                      
                      // PSEUDO (Confirmateur)
                      if (histo.confirmateur_pseudo) items.push({ label: 'PSEUDO', value: confirmateursList });
                      
                      // PAC : R/EAU ; R/R
                      if (histo.ph3_pac) {
                        const pacValue = histo.ph3_pac === 'reau' || histo.ph3_pac === 'R/EAU' ? 'R/EAU' : 
                                         histo.ph3_pac === 'rr' || histo.ph3_pac === 'R/R' ? 'R/R' : histo.ph3_pac;
                        items.push({ label: 'PAC', value: pacValue });
                      }
                      
                      // Financement
                      if (histo.ph3_financement || histo.ph3_type) items.push({ label: 'Financement', value: histo.ph3_financement || histo.ph3_type });
                      
                      // Prix
                      if (histo.ph3_prix) items.push({ label: 'Prix', value: histo.ph3_prix });
                      
                      // Crédit immobilier
                      if (histo.credit_immobilier) items.push({ label: 'Crédit immobilier', value: histo.credit_immobilier });
                      
                      // Autre crédit
                      if (histo.credit_autre) items.push({ label: 'Autre crédit', value: histo.credit_autre });
                      
                      // Puissance
                      if (histo.ph3_puissance) items.push({ label: 'Puissance', value: histo.ph3_puissance });
                      
                      // Ballon
                      if (histo.ph3_ballon) {
                        const ballonValue = histo.ph3_ballon === 'OUI' || histo.ph3_ballon === 1 || histo.ph3_ballon === '1' ? 'OUI' :
                                            histo.ph3_ballon === 'NON' || histo.ph3_ballon === 0 || histo.ph3_ballon === '0' ? 'NON' : histo.ph3_ballon;
                        items.push({ label: 'Ballon', value: ballonValue });
                      }
                      
                      // Installateur
                      if (histo.installeur_nom) items.push({ label: 'Installateur', value: histo.installeur_nom });
                      
                      // consommation annuelle ancien système
                      if (histo.ph3_consommation || histo.conf_consommations) items.push({ label: 'Consommation annuelle ancien système', value: histo.ph3_consommation || histo.conf_consommations });
                      
                      // Partie à financer du client (valeur_mensualite ou ph3_mensualite)
                      if (histo.valeur_mensualite || histo.ph3_mensualite) items.push({ label: 'Partie à financer du client', value: histo.valeur_mensualite || histo.ph3_mensualite });
                      
                      // Bonus annoncé
                      if (histo.ph3_bonus || histo.ph3_bonus_30) items.push({ label: 'Bonus annoncé', value: histo.ph3_bonus || histo.ph3_bonus_30 });
                      
                      // Mensualité du crédit
                      if (histo.ph3_mensualite) items.push({ label: 'Mensualité du crédit', value: histo.ph3_mensualite });
                      
                      // Nombre de mois du crédit
                      if (histo.ph3_nbr_annee_finance || histo.nbr_annee_finance) items.push({ label: 'Nombre de mois du crédit', value: histo.ph3_nbr_annee_finance || histo.nbr_annee_finance });
                      
                      // Alimentation
                      if (histo.ph3_alimentation) items.push({ label: 'Alimentation', value: histo.ph3_alimentation });
                      
                      // Type
                      if (histo.ph3_type) items.push({ label: 'Type', value: histo.ph3_type });
                      
                      // DATE SIGNATURE
                      if (histo.date_sign_time) items.push({ label: 'DATE SIGNATURE', value: new Date(histo.date_sign_time).toLocaleString('fr-FR') });
                    }
                    // Contrôle qualité - États avec cq_etat et cq_dossier (groupe 0 ou autres selon logique métier)
                    else if (histo.cq_etat || histo.cq_dossier) {
                      if (histo.cq_etat) items.push({ label: 'CQ ETAT', value: histo.cq_etat });
                      if (histo.cq_dossier) items.push({ label: 'CQ DOSSIER', value: histo.cq_dossier });
                      if (histo.commentaire_qualite) items.push({ label: 'Observation', value: histo.commentaire_qualite, fullWidth: true });
                    }
                    // Par défaut : afficher confirmateur, commentaire, date appel
                    else {
                      if (histo.confirmateur_pseudo) items.push({ label: 'Confirmateur', value: confirmateursList });
                      if (histo.conf_commentaire_produit) items.push({ label: 'Commentaire', value: histo.conf_commentaire_produit, fullWidth: true });
                      if (histo.date_appel_time) items.push({ label: 'Date appel', value: new Date(histo.date_appel_time).toLocaleString('fr-FR') });
                    }
                    
                    return items;
                  };
                  
                  const detailItems = renderHistoDetails();
                  
                  return (
                <div
                  key={histo.id}
                  className="historique-item"
                  style={{
                        borderLeftColor: histo.etat_color || '#3498db',
                        padding: '15px',
                        marginBottom: '15px',
                        backgroundColor: '#f9f9f9',
                        borderRadius: '4px'
                      }}
                    >
                      <div className="historique-header" style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          {/* Afficher le sous-état devant l'état s'il existe */}
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
                      {histo.etat_titre || 'État inconnu'}
                    </span>
                          <span className="historique-date" style={{ color: '#666', fontSize: '13px', marginLeft: 'auto' }}>
                    {histo.date_creation ? new Date(histo.date_creation).toLocaleString('fr-FR') : '-'}
                  </span>
                </div>
                      </div>
                      
                      {/* Afficher les informations complémentaires selon l'état */}
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
          </div>
        )}

        {/* Section Changement d'état - En bas de la page */}
        {/* Permissions : 
            - Admins (1, 2, 7) et Agents (3) : peuvent changer vers tous les états
            - Commerciaux (5) : peuvent changer uniquement vers les états de Phase 3 (groupe = 3) ou CONFIRMER (état 7)
            - Confirmateurs (6) : peuvent changer l'état des fiches qui leur sont assignées
        */}
        {/* Section Compte rendu pour commerciaux */}
        {user?.fonction === 5 && (Number(ficheData?.id_commercial) === Number(user?.id) || Number(ficheData?.id_commercial_2) === Number(user?.id)) && (
          <>
            {/* Afficher les comptes rendu existants */}
            {ficheData?.comptes_rendus && ficheData.comptes_rendus.length > 0 && (
              <div className="fiche-section compte-rendu-section">
                <h2 className="section-title">Comptes rendu en attente</h2>
                {ficheData.comptes_rendus.map((cr) => {
                  // Mapper l'état de la base de données vers le libellé commercial
                  const getEtatCommercialLabel = (etatId) => {
                    if ([13, 44, 45].includes(etatId)) return 'Signer';
                    if (etatId === 9) return 'Déballé veut réfléchir';
                    if (etatId === 12) return 'Déballé sans suite';
                    if (etatId === 34) return 'Infinançable';
                    if (etatId === 23) return 'Infaisabilité technique';
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
                                setEtatFormData({...etatFormData, conf_commentaire_produit: cr.commentaire || ''});
                              } else if (cr.id_etat_final === 34) {
                                setCompteRenduOption('infinançable');
                                setSelectedEtat(34);
                                setEtatFormData({...etatFormData, conf_commentaire_produit: cr.commentaire || ''});
                              } else if (cr.id_etat_final === 23) {
                                setCompteRenduOption('infaisabilité_technique');
                                setSelectedEtat(23);
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
                        conf_commentaire_produit: ''
                      });
                    } else if (e.target.value === 'infinançable') {
                      setSelectedEtat(34); // HHC FINANCEMENT A VERIFIER
                      setEtatFormData({
                        ...etatFormData,
                        conf_commentaire_produit: ''
                      });
                    } else if (e.target.value === 'infaisabilité_technique') {
                      setSelectedEtat(23); // HORS CIBLE CONFIRMATEUR
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
                              conf_commentaire_produit: ''
                            });
                          } else if (e.target.value === 'infinançable') {
                            setSelectedEtat(34); // HHC FINANCEMENT A VERIFIER
                            setEtatFormData({
                              ...etatFormData,
                              conf_commentaire_produit: ''
                            });
                          } else if (e.target.value === 'infaisabilité_technique') {
                            setSelectedEtat(23); // HORS CIBLE CONFIRMATEUR
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
                            credit_autre: '', conf_commentaire_produit: '', conf_rdv_date: '', conf_rdv_time: '', conf_rdv_avec: ''
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
            {[13, 44, 45].includes(selectedEtat) && selectedEtat !== ficheData?.id_etat_final && (editingCompteRendu || !(ficheData?.comptes_rendus && ficheData.comptes_rendus.some(cr => cr.statut === 'pending'))) && (
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
                      <option value="franfinance">franfinance</option>
                      <option value="domo">domo</option>
                      <option value="sofinco">sofinco</option>
                      <option value="projexio">projexio</option>
                      <option value="cetelem">cetelem</option>
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
                    <button className="btn-confirm" onClick={handleEtatSubmit}>Enregistrer</button>
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
            {[9, 12, 23, 34].includes(selectedEtat) && selectedEtat !== ficheData?.id_etat_final && (editingCompteRendu || !(ficheData?.comptes_rendus && ficheData.comptes_rendus.some(cr => cr.statut === 'pending'))) && (
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
                    <button className="btn-confirm" onClick={handleEtatSubmit}>Enregistrer</button>
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
            {selectedEtat === 8 && selectedEtat !== ficheData?.id_etat_final && (editingCompteRendu || !(ficheData?.comptes_rendus && ficheData.comptes_rendus.some(cr => cr.statut === 'pending'))) && (
              <div className="fiche-section etat-change-section" style={{ marginTop: '20px' }}>
                <div className="etat-form">
                  <h3>Informations Annuler à Reprogrammer</h3>
                  
                  {sousEtats.length > 0 && (
                    <div className="form-group">
                      <label htmlFor="compte_rendu_etat_id_sous_etat_8">Sous État :</label>
                      <select
                        id="compte_rendu_etat_id_sous_etat_8"
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
                    <label htmlFor="compte_rendu_etat_conf_rdv_avec_8">Appel Avec :</label>
                    <select
                      id="compte_rendu_etat_conf_rdv_avec_8"
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
                      <label htmlFor="compte_rendu_etat_conf_rdv_date_8">A Rappeler Le :</label>
                      <input
                        type="date"
                        id="compte_rendu_etat_conf_rdv_date_8"
                        className="form-control"
                        value={etatFormData.conf_rdv_date}
                        onChange={(e) => setEtatFormData({...etatFormData, conf_rdv_date: e.target.value})}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="compte_rendu_etat_conf_rdv_time_8">Heure :</label>
                      <input
                        type="time"
                        id="compte_rendu_etat_conf_rdv_time_8"
                        className="form-control"
                        value={etatFormData.conf_rdv_time}
                        onChange={(e) => setEtatFormData({...etatFormData, conf_rdv_time: e.target.value})}
                      />
                    </div>
                  </div>

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
                    <button className="btn-confirm" onClick={handleEtatSubmit}>Enregistrer</button>
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
            - Admins (1, 2, 7) : peuvent changer vers tous les états
            - Agents (3) : peuvent changer les fiches de leur centre
            - Confirmateurs (6) : peuvent changer toutes les fiches */}
        {((user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7) ||
          (user?.fonction === 3 && user?.centre === ficheData?.id_centre) ||
          (user?.fonction === 6)) && (
          <div className="fiche-section etat-change-section">
            <h2 className="section-title">Changer l'état de la fiche</h2>
            <div className="etat-change-form">
              <div className="form-group">
                <label htmlFor="id_etat_final">Nouvel état :</label>
                <select
                  id="id_etat_final"
                  className="form-control"
                  value={selectedEtat !== null ? selectedEtat : (fiche.id_etat_final || '')}
                  onChange={(e) => handleEtatChange(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Sélectionner un état</option>
                  {/* Pour admins, agents et confirmateurs : afficher tous les états */}
                  {etats?.map(etat => (
                    <option 
                      key={etat.id} 
                      value={etat.id}
                      style={{ backgroundColor: etat.color || '#cccccc', color: etat.color === '#ffffff' || etat.color === '#fff' ? '#000' : '#fff' }}
                    >
                      {etat.titre}
                    </option>
                  ))}
                </select>
            </div>

            {/* Formulaire de confirmation (état 7) */}
            {selectedEtat === 7 && selectedEtat !== fiche.id_etat_final && (
              <div className="confirmation-form">
                <h3>Informations de confirmation</h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="conf_produit">Étude à faire pour :</label>
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
                  </div>

                  <div className="form-group">
                    <label htmlFor="conf_id_confirmateur">Confirmateur :</label>
                    <select
                      id="conf_id_confirmateur"
                      className="form-control"
                      value={confFormData.id_confirmateur}
                      onChange={(e) => setConfFormData({...confFormData, id_confirmateur: e.target.value})}
                    >
                      <option value="">Sélectionner</option>
                      {confirmateurs?.map(conf => (
                        <option key={conf.id} value={conf.id}>
                          {conf.pseudo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="conf_id_confirmateur_2">Confirmateur 2 (optionnel) :</label>
                    <select
                      id="conf_id_confirmateur_2"
                      className="form-control"
                      value={confFormData.id_confirmateur_2}
                      onChange={(e) => setConfFormData({...confFormData, id_confirmateur_2: e.target.value})}
                    >
                      <option value="">Aucun</option>
                      {confirmateurs?.map(conf => (
                        <option key={conf.id} value={conf.id}>
                          {conf.pseudo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="conf_id_confirmateur_3">Confirmateur 3 (optionnel) :</label>
                    <select
                      id="conf_id_confirmateur_3"
                      className="form-control"
                      value={confFormData.id_confirmateur_3}
                      onChange={(e) => setConfFormData({...confFormData, id_confirmateur_3: e.target.value})}
                    >
                      <option value="">Aucun</option>
                      {confirmateurs?.map(conf => (
                        <option key={conf.id} value={conf.id}>
                          {conf.pseudo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="conf_rdv_date">Date RDV :</label>
                    <input
                      type="date"
                      id="conf_rdv_date"
                      className="form-control"
                      value={confFormData.conf_rdv_date}
                      onChange={(e) => setConfFormData({...confFormData, conf_rdv_date: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="conf_rdv_time">Heure RDV :</label>
                    <input
                      type="time"
                      id="conf_rdv_time"
                      className="form-control"
                      value={confFormData.conf_rdv_time}
                      onChange={(e) => setConfFormData({...confFormData, conf_rdv_time: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="conf_rdv_avec">RDV pris avec :</label>
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
                  </div>
                </div>

                {/* Champs spécifiques PV */}
                {confFormData.produit === '2' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="conf_orientation_toiture">Orientation toiture :</label>
                      <select
                        id="conf_orientation_toiture"
                        className="form-control"
                        value={confFormData.conf_orientation_toiture}
                        onChange={(e) => setConfFormData({...confFormData, conf_orientation_toiture: e.target.value})}
                      >
                        <option value="">Sélectionner</option>
                        <option value="NORD">NORD</option>
                        <option value="SUD">SUD</option>
                        <option value="EST">EST</option>
                        <option value="OUEST">OUEST</option>
                        <option value="NORD-EST">NORD-EST</option>
                        <option value="NORD-OUEST">NORD-OUEST</option>
                        <option value="SUD-EST">SUD-EST</option>
                        <option value="SUD-OUEST">SUD-OUEST</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="conf_zones_ombres">Zones ombres :</label>
                      <select
                        id="conf_zones_ombres"
                        className="form-control"
                        value={confFormData.conf_zones_ombres}
                        onChange={(e) => setConfFormData({...confFormData, conf_zones_ombres: e.target.value})}
                      >
                        <option value="">Sélectionner</option>
                        <option value="OUI">OUI</option>
                        <option value="NON">NON</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="conf_site_classe">Proche d'un site classé :</label>
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
                    </div>

                    <div className="form-group">
                      <label htmlFor="conf_consommation_electricite">Consommation électricité (€) :</label>
                      <input
                        type="text"
                        id="conf_consommation_electricite"
                        className="form-control"
                        value={confFormData.conf_consommation_electricite}
                        onChange={(e) => setConfFormData({...confFormData, conf_consommation_electricite: e.target.value})}
                        placeholder="Ex: 800 €/an"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="conf_nb_pans">Nombre de pans :</label>
                      <input
                        type="number"
                        id="conf_nb_pans"
                        className="form-control"
                        min="1"
                        value={confFormData.nb_pans}
                        onChange={(e) => setConfFormData({...confFormData, nb_pans: e.target.value})}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="conf_commentaire_produit">Commentaire :</label>
                  <textarea
                    id="conf_commentaire_produit"
                    className="form-control"
                    rows="4"
                    value={confFormData.conf_commentaire_produit}
                    onChange={(e) => setConfFormData({...confFormData, conf_commentaire_produit: e.target.value})}
                  />
                </div>

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
            {selectedEtat === 2 && selectedEtat !== fiche.id_etat_final && (
              <div className="nrp-form" style={{ marginTop: '20px' }}>
                <h3>Informations NRP</h3>

                <div className="form-group">
                  <label htmlFor="nrp_id_sous_etat">Sous État :</label>
                  <select
                    id="nrp_id_sous_etat"
                    className="form-control"
                    value={nrpFormData.id_sous_etat}
                    onChange={(e) => setNrpFormData({...nrpFormData, id_sous_etat: e.target.value})}
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
                  >
                    Enregistrer
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
            {selectedEtat === 8 && selectedEtat !== fiche.id_etat_final && !(user?.fonction === 5 && compteRenduOption) && (
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
                  <button className="btn-confirm" onClick={handleEtatSubmit}>Enregistrer</button>
                  <button className="btn-cancel" onClick={() => {
                    setSelectedEtat(null);
                    setEtatFormData({...etatFormData, conf_rdv_date: '', conf_rdv_time: '', id_sous_etat: '', conf_rdv_avec: '', conf_commentaire_produit: ''});
                  }}>Annuler</button>
                </div>
              </div>
            )}

            {/* Formulaire RAPPEL POUR BUREAU (état 19) */}
            {selectedEtat === 19 && selectedEtat !== fiche.id_etat_final && (
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
                  <label htmlFor="etat_conf_commentaire_19">Commentaire :</label>
                  <textarea
                    id="etat_conf_commentaire_19"
                    className="form-control"
                    rows="4"
                    value={etatFormData.conf_commentaire_produit}
                    onChange={(e) => setEtatFormData({...etatFormData, conf_commentaire_produit: e.target.value})}
                  />
                </div>

                <div className="form-actions">
                  <button className="btn-confirm" onClick={handleEtatSubmit}>Enregistrer</button>
                  <button className="btn-cancel" onClick={() => {
                    setSelectedEtat(null);
                    setEtatFormData({...etatFormData, date_rappel_date: '', date_rappel_time: '', id_sous_etat: '', conf_commentaire_produit: ''});
                  }}>Annuler</button>
                </div>
              </div>
            )}

            {/* Formulaire SIGNER (états 13, 44, 45) - visible aussi pour commerciaux (mais seulement si pas déjà dans section compte rendu) */}
            {[13, 44, 45].includes(selectedEtat) && selectedEtat !== fiche.id_etat_final && !(user?.fonction === 5 && compteRenduOption) && (
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
                    <option value="franfinance">franfinance</option>
                    <option value="domo">domo</option>
                    <option value="sofinco">sofinco</option>
                    <option value="projexio">projexio</option>
                    <option value="cetelem">cetelem</option>
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
                  <button className="btn-confirm" onClick={handleEtatSubmit}>Enregistrer</button>
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
            {[16, 38].includes(selectedEtat) && selectedEtat !== fiche.id_etat_final && (
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
                  <button className="btn-confirm" onClick={handleEtatSubmit}>Enregistrer</button>
                  <button className="btn-cancel" onClick={() => {
                    setSelectedEtat(null);
                    setEtatFormData({...etatFormData, id_commercial: '', id_commercial_2: '', conf_commentaire_produit: ''});
                  }}>Annuler</button>
                </div>
              </div>
            )}

            {/* Formulaire pour états 9 (CLIENT HONORE A SUIVRE), 12 (REFUSER), 23 (HORS CIBLE CONFIRMATEUR), 34 (HHC FINANCEMENT A VERIFIER) */}
            {[9, 12, 23, 34].includes(selectedEtat) && selectedEtat !== fiche.id_etat_final && (
              <div className="etat-form" style={{ marginTop: '20px' }}>
                <h3>Commentaire</h3>
                <div className="form-group">
                  <label htmlFor="etat_conf_commentaire_simple">Commentaire :</label>
                  <textarea
                    id="etat_conf_commentaire_simple"
                    className="form-control"
                    rows="4"
                    value={etatFormData.conf_commentaire_produit}
                    onChange={(e) => setEtatFormData({...etatFormData, conf_commentaire_produit: e.target.value})}
                  />
                </div>
                <div className="form-actions">
                  <button className="btn-confirm" onClick={handleEtatSubmit}>Enregistrer</button>
                  <button className="btn-cancel" onClick={() => {
                    setSelectedEtat(null);
                    setCompteRenduOption('');
                    setEtatFormData({...etatFormData, conf_commentaire_produit: ''});
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
             ![9, 12, 13, 16, 23, 34, 38, 44, 45].includes(selectedEtat) && 
             selectedEtat !== fiche.id_etat_final && (
              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button
                  className="btn-confirm"
                  onClick={handleEtatSubmit}
                >
                  Enregistrer
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
        {fiche.id_etat_final === 7 && hasPermission('fiche_validate') && (
          <div className="fiche-section validation-section-bottom">
            <h2 className="section-title">Validation de la fiche</h2>
            {fiche.valider > 0 ? (
              <div className="validation-info">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  <span className="validation-badge validated">✓ Validée</span>
                  {fiche.conf_rdv_avec && (
                    <span className="validation-with">Avec: {fiche.conf_rdv_avec}</span>
                  )}
                  {fiche.conf_presence_couple && (
                    <span className="validation-with">Présence du couple: {fiche.conf_presence_couple}</span>
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
                  <input
                    id="conf_rdv_avec_validation"
                    type="text"
                    placeholder="Ex: MR, MME"
                    value={confRdvAvecValue || ''}
                    onChange={(e) => setConfRdvAvecValue(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                  />
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
      </div>
        </>
      )}

      {/* Onglet Modifica */}
      {activeTab === 'modifica' && (
        <ModificaTab ficheHash={hash} />
      )}

      {/* Onglet Planning */}
      {activeTab === 'planning' && (
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

      {/* Onglet SMS */}
      {activeTab === 'sms' && (
        <SMSTab
          ficheHash={hash}
          ficheData={ficheData}
          confirmateurs={confirmateurs}
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
          selectedSlot={selectedSlot}
          rdvFormData={rdvFormData}
          setRdvFormData={setRdvFormData}
          confirmateurs={confirmateurs}
          onClose={() => {
            setShowRdvModal(false);
            setSelectedSlot(null);
          }}
          onSubmit={handleCreateRdvFromForm}
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
  
  // Mutation pour modifier la disponibilité
  const updateAvailabilityMutation = useMutation(
    async ({ week, year, dep, date, hour, value, type }) => {
      const res = await api.put('/planning/availability', { week, year, dep, date, hour, value, type });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['planning-modal']);
        queryClient.invalidateQueries(['availability-modal']);
      },
      onError: (error) => {
        console.error('Erreur modification disponibilité:', error);
        alert(error.response?.data?.message || 'Erreur lors de la modification');
      }
    }
  );
  
  // Handler pour mettre à jour la disponibilité
  const handleUpdateAvailability = (date, hour, value, type = 'hour') => {
    if (!planningWeek || !planningYear || !planningDep) return;
    
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
  
  const { data: planningResponse, isLoading: isLoadingPlanning, refetch: refetchPlanning } = useQuery(
    ['planning-modal', planningWeek, planningYear, planningDep],
    async () => {
      if (!planningWeek || !planningYear || !planningDep) return null;
      const res = await api.get('/planning/week', { params: { w: planningWeek, y: planningYear, dp: planningDep } });
      return res.data;
    },
    { enabled: !!planningDep && !!planningWeek && !!planningYear }
  );

  const { data: availabilityResponse, isLoading: isLoadingAvailability, refetch: refetchAvailability } = useQuery(
    ['availability-modal', planningWeek, planningYear, planningDep],
    async () => {
      if (!planningWeek || !planningYear || !planningDep) return null;
      const res = await api.get('/planning/availability', { params: { w: planningWeek, y: planningYear, dp: planningDep } });
      return res.data;
    },
    { enabled: !!planningDep && !!planningWeek && !!planningYear }
  );

  const planningData = planningResponse?.data || {};
  const availabilityData = availabilityResponse?.data || {};
  
  // Debug logs pour vérifier les données reçues
  useEffect(() => {
    if (planningResponse) {
      console.log('Planning response:', planningResponse);
      console.log('Planning data:', planningData);
    }
    if (availabilityResponse) {
      console.log('Availability response:', availabilityResponse);
      console.log('Availability data:', availabilityData);
    }
  }, [planningResponse, availabilityResponse, planningData, availabilityData]);

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
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
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
    const start = new Date(days[0].date);
    const end = new Date(days[days.length - 1].date);
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
          />
        ) : (
          <div className="error">Aucun planning disponible pour le département {planningDep}</div>
        )}
      </div>
    </div>
  );
};

// Composant pour l'onglet SMS
const SMSTab = ({ ficheHash, ficheData, confirmateurs }) => {
  const [selectedTel, setSelectedTel] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('0');
  const [customMessage, setCustomMessage] = useState('');
  const [idConfirmateur, setIdConfirmateur] = useState('');
  
  // Bloquer le scroll du body quand le modal RDV est ouvert
  useModalScrollLock(showRdvModal);
  
  const queryClient = useQueryClient();
  
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
      onSuccess: () => {
        queryClient.invalidateQueries(['sms', ficheHash]);
        queryClient.invalidateQueries(['modifica', ficheHash]);
        alert('SMS envoyé avec succès!');
        setCustomMessage('');
      },
      onError: (error) => {
        console.error('Erreur:', error);
        alert('Erreur lors de l\'envoi du SMS: ' + (error.response?.data?.message || error.message));
      }
    }
  );

  // Messages prédéfinis
  const predefinedMessages = {
    '0': '', // Message personnalisé
    '1': `Cher(e) Mr/Mme ${ficheData?.prenom?.toUpperCase() || ''} ${ficheData?.nom?.toUpperCase() || ''},

Suite à notre appel téléphonique, Bureau central Environnement confirme votre rendez-vous prévu le ${ficheData?.date_rdv_time ? new Date(ficheData.date_rdv_time).toLocaleDateString('fr-FR') : ''} à ${ficheData?.date_rdv_time ? new Date(ficheData.date_rdv_time).toTimeString().slice(0, 5) : ''} avec l'un de nos techniciens, en présence de votre conjoint(e).

Restant à votre disposition pour tous renseignements complémentaires, nous vous prions d'agréer, Madame, Monsieur, nos salutations distinguées.`,
    '2': `Cher(e) Mr/Mme ${ficheData?.prenom?.toUpperCase() || ''} ${ficheData?.nom?.toUpperCase() || ''},

Nous vous informons que des pièces manquantes sont nécessaires pour finaliser votre dossier.

Veuillez nous contacter au plus vite pour compléter votre dossier.

Cordialement.`,
    '3': `Cher(e) Mr/Mme ${ficheData?.prenom?.toUpperCase() || ''} ${ficheData?.nom?.toUpperCase() || ''},

Nous vous rappelons qu'il est important de signer votre contrat NRP.

Veuillez nous contacter pour finaliser votre dossier.

Cordialement.`
  };

  const handleSendSMS = () => {
    if (!selectedTel) {
      alert('Veuillez sélectionner un numéro de téléphone');
      return;
    }
    if (!idConfirmateur) {
      alert('Veuillez sélectionner un confirmateur');
      return;
    }
    const message = selectedCategory === '0' ? customMessage : predefinedMessages[selectedCategory];
    if (!message) {
      alert('Veuillez saisir un message');
      return;
    }
    sendSMSMutation.mutate({
      tel: selectedTel,
      message: message,
      id_confirmateur: parseInt(idConfirmateur)
    });
  };

  // Récupérer les numéros disponibles
  const availableTels = [
    { value: ficheData?.tel, label: `Téléphone: ${ficheData?.tel}` },
    { value: ficheData?.gsm1, label: `GSM1: ${ficheData?.gsm1}` },
    { value: ficheData?.gsm2, label: `GSM2: ${ficheData?.gsm2}` }
  ].filter(t => t.value);

  useEffect(() => {
    if (availableTels.length > 0 && !selectedTel) {
      setSelectedTel(availableTels[0].value);
    }
  }, [ficheData]);

  if (isLoading) return <div className="loading">Chargement...</div>;

  return (
    <div className="sms-tab">
      <h2>Envoyer un SMS</h2>
      <div className="sms-form">
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
        </div>
        <div className="form-group">
          <label>Confirmateur :</label>
          <select
            value={idConfirmateur}
            onChange={(e) => setIdConfirmateur(e.target.value)}
            className="form-control"
            required
          >
            <option value="">Sélectionner un confirmateur</option>
            {confirmateurs?.map(conf => (
              <option key={conf.id} value={conf.id}>{conf.pseudo}</option>
            ))}
          </select>
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
            <option value="1">RAPPEL RDV</option>
            <option value="2">PIÉCES MANQUANTES</option>
            <option value="3">SIGNER NRP</option>
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
              value={predefinedMessages[selectedCategory]}
              readOnly
              className="form-control"
              rows="6"
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
  currentFicheHash // Le hash est passé mais on ne peut plus comparer par ID car il est masqué
}) => {
  const [editValues, setEditValues] = useState({});
  
  const handleAvailabilityChange = (date, hour, value) => {
    setEditValues(prev => ({
      ...prev,
      [`${date}-${hour}`]: value
    }));
  };
  
  const handleAvailabilityBlur = (date, hour) => {
    const value = editValues[`${date}-${hour}`];
    if (value === undefined || value === '') return;
    
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 0) {
      // Réinitialiser la valeur si invalide
      setEditValues(prev => {
        const newValues = { ...prev };
        delete newValues[`${date}-${hour}`];
        return newValues;
      });
      return;
    }
    
    if (onUpdateAvailability) {
      onUpdateAvailability(date, hour, numValue, 'hour');
    }
    
    // Nettoyer la valeur après sauvegarde
    setEditValues(prev => {
      const newValues = { ...prev };
      delete newValues[`${date}-${hour}`];
      return newValues;
    });
  };
  
  const handleAvailabilityKeyDown = (date, hour, e) => {
    if (e.key === 'Enter') {
      e.target.blur(); // Déclenche handleAvailabilityBlur
    } else if (e.key === 'Escape') {
      // Annuler la modification
      setEditValues(prev => {
        const newValues = { ...prev };
        delete newValues[`${date}-${hour}`];
        return newValues;
      });
      e.target.blur();
    }
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
                    const availabilityCount = availabilityFromPlanning !== null ? availabilityFromPlanning : (availData?.nbr_com ?? null);
                    // availability peut être null (pas de planning créé), 0 (bloqué), ou > 0 (disponible)
                    const hasPlanning = availabilityCount !== null && availabilityCount !== undefined;
                    const isBlocked = availabilityCount === 0;
                    // Un créneau est disponible s'il a un planning avec disponibilité > 0, OU s'il n'a pas de planning mais n'est pas bloqué
                    const isAvailable = (hasPlanning && availabilityCount > 0) || (!hasPlanning && !isBlocked);
                    
                    // Compter uniquement les fiches confirmées (état final = 7, pas annulées ni reportées)
                    const confirmedRdvs = rdvs.filter(rdv => rdv.etat_check !== 'AN' && rdv.etat_check !== 'RS');
                    const confirmedCount = confirmedRdvs.length;
                    
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
                    const canEditThis = canEdit && !isBlocked;
                    const cellKey = `${day.date}-${slot.hour}`;
                    const currentEditValue = editValues[cellKey];
                    const inputValue = currentEditValue !== undefined ? currentEditValue : (availabilityCount !== null ? availabilityCount : '');
                    
                    return (
                      <td
                        key={cellKey}
                        className={`planning-cell ${isBlocked ? 'blocked' : ''} ${hasPlanning ? 'has-planning' : ''} ${currentFicheInSlot ? 'current-fiche' : ''} ${hasData ? 'has-data' : ''} ${isAvailable && !hasData ? 'available-slot' : ''}`}
                        style={{ 
                          backgroundColor: isBlocked ? 'rgba(34, 45, 50, 0.8)' : 'transparent',
                          position: 'relative',
                          cursor: isAvailable ? 'pointer' : 'default',
                          border: isAvailable && !hasData ? '2px dashed #8BC34A' : 'none'
                        }}
                        onClick={() => isAvailable && onSelectSlot(day.date, slot.hour)}
                        title={isAvailable ? `Cliquer pour créer un rendez-vous le ${day.dayName} à ${slot.name}` : isBlocked ? 'Créneau bloqué' : 'Créneau non disponible'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {/* Badge de disponibilité avec format "X / Y" - TOUJOURS affiché si on a des données */}
                          {hasData ? (
                            <div className="availability-info">
                              <div className="availability-badge" style={{ backgroundColor: bgColor }}>
                                <span className="availability-text-compact">
                                  {confirmedCount} / {displayAvailability}
                                </span>
                              </div>
                            </div>
                          ) : isAvailable && !isBlocked ? (
                            <div className="availability-info">
                              <div className="availability-badge" style={{ backgroundColor: '#8BC34A', opacity: 0.7 }}>
                                <span className="availability-text-compact" style={{ fontSize: '8.5px' }}>
                                  Cliquer pour créer
                                </span>
                              </div>
                            </div>
                          ) : null}
                          
                          {/* Champ texte pour modifier la disponibilité (uniquement pour admin) */}
                          {canEditThis && (
                            <input
                              type="number"
                              value={inputValue}
                              onChange={(e) => handleAvailabilityChange(day.date, slot.hour, e.target.value)}
                              onBlur={() => handleAvailabilityBlur(day.date, slot.hour)}
                              onKeyDown={(e) => handleAvailabilityKeyDown(day.date, slot.hour, e)}
                              onClick={(e) => e.stopPropagation()}
                              min="0"
                              placeholder="0"
                              style={{
                                width: '35px',
                                padding: '2px 4px',
                                fontSize: '10px',
                                border: '1px solid #ccc',
                                borderRadius: '3px',
                                textAlign: 'center'
                              }}
                              title="Modifier la disponibilité"
                            />
                          )}
                        </div>
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
  selectedSlot, 
  rdvFormData, 
  setRdvFormData, 
  confirmateurs,
  onClose, 
  onSubmit 
}) => {
  // Récupérer les modes de chauffage pour les champs PAC
  const { data: modeChauffage } = useQuery('mode-chauffage', async () => {
    const res = await api.get('/management/mode-chauffage');
    return res.data.data || [];
  });

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

  const dateFormatted = selectedSlot 
    ? new Date(`${selectedSlot.date} ${selectedSlot.hour}:00:00`).toLocaleString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content rdv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Créer un rendez-vous</h2>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <div className="modal-body">
          <div className="rdv-form-info">
            <p><strong>Date et heure :</strong> {dateFormatted}</p>
            <p><strong>Fiche :</strong> {ficheData?.nom || ''} {ficheData?.prenom || ''} ({ficheData?.tel || ''})</p>
          </div>

          <form className="rdv-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
            {/* Case à cocher pour RDV urgent - Par défaut CONFIRMER */}
            <div className="form-group">
              {(() => {
                // Vérifier si la date du RDV est aujourd'hui ou demain
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
                  <>
                    <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isUrgent}
                        onChange={(e) => setRdvFormData({...rdvFormData, is_urgent: e.target.checked, id_etat_final: 7})}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 'bold' }}>RDV URGENT</span>
                      {isAutoUrgent && !rdvFormData.is_urgent && (
                        <span style={{ fontSize: '0.72em', color: '#f44336', fontStyle: 'italic', marginLeft: '8px' }}>
                          (Automatique : RDV aujourd'hui ou demain)
                        </span>
                      )}
                    </label>
                    <p style={{ marginTop: '4px', fontSize: '0.77em', color: '#666', fontStyle: 'italic' }}>
                      Par défaut, le rendez-vous est en état CONFIRMER. Cochez cette case pour le marquer comme urgent.
                      {isAutoUrgent && (
                        <span style={{ color: '#f44336', fontWeight: 'bold' }}> Les RDV d'aujourd'hui ou de demain sont automatiquement marqués comme urgents.</span>
                      )}
                    </p>
                  </>
                );
              })()}
            </div>

            {/* Date et heure du RDV */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="rdv_date">Date RDV *</label>
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
              </div>
              <div className="form-group">
                <label htmlFor="rdv_time">Heure RDV *</label>
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
              </div>
            </div>

            {/* Produit */}
            <div className="form-group">
              <label htmlFor="rdv_produit">Produit *</label>
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
            </div>

            {/* Confirmateurs */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="rdv_confirmateur">Confirmateur *</label>
                <select
                  id="rdv_confirmateur"
                  className="form-control"
                  value={rdvFormData.id_confirmateur}
                  onChange={(e) => setRdvFormData({...rdvFormData, id_confirmateur: e.target.value})}
                  required
                >
                  <option value="">Sélectionner</option>
                  {confirmateurs?.map(conf => (
                    <option key={conf.id} value={conf.id}>
                      {conf.pseudo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="rdv_confirmateur_2">Confirmateur 2 (optionnel)</label>
                <select
                  id="rdv_confirmateur_2"
                  className="form-control"
                  value={rdvFormData.id_confirmateur_2}
                  onChange={(e) => setRdvFormData({...rdvFormData, id_confirmateur_2: e.target.value})}
                >
                  <option value="">Aucun</option>
                  {confirmateurs?.map(conf => (
                    <option key={conf.id} value={conf.id}>
                      {conf.pseudo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="rdv_confirmateur_3">Confirmateur 3 (optionnel)</label>
              <select
                id="rdv_confirmateur_3"
                className="form-control"
                value={rdvFormData.id_confirmateur_3}
                onChange={(e) => setRdvFormData({...rdvFormData, id_confirmateur_3: e.target.value})}
              >
                <option value="">Aucun</option>
                {confirmateurs?.map(conf => (
                  <option key={conf.id} value={conf.id}>
                    {conf.pseudo}
                  </option>
                ))}
              </select>
            </div>

            {/* RDV avec */}
            <div className="form-group">
              <label htmlFor="rdv_avec">RDV pris avec</label>
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
            </div>

            {/* Champs spécifiques selon le produit */}
            {(() => {
              // Identifier le produit sélectionné
              const selectedProduit = produits?.find(p => String(p.id) === String(rdvFormData.produit));
              const isPAC = selectedProduit?.nom?.toUpperCase().includes('PAC') || rdvFormData.produit === '1';
              const isPV = selectedProduit?.nom?.toUpperCase().includes('PV') || rdvFormData.produit === '2';
              
              return (
                <>
                  {/* Champs spécifiques PAC */}
                  {isPAC && (
                    <>
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="rdv_surface_chauffee">Surface chauffée (m²)</label>
                          <input
                            type="number"
                            id="rdv_surface_chauffee"
                            className="form-control"
                            value={rdvFormData.surface_chauffee || ''}
                            onChange={(e) => setRdvFormData({...rdvFormData, surface_chauffee: e.target.value})}
                            placeholder="Ex: 100"
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="rdv_consommation_chauffage">Consommation chauffage (€)</label>
                          <input
                            type="text"
                            id="rdv_consommation_chauffage"
                            className="form-control"
                            value={rdvFormData.consommation_chauffage || ''}
                            onChange={(e) => setRdvFormData({...rdvFormData, consommation_chauffage: e.target.value})}
                            placeholder="Ex: 1500 €/an"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="rdv_mode_chauffage">Mode de chauffage</label>
                          <select
                            id="rdv_mode_chauffage"
                            className="form-control"
                            value={rdvFormData.mode_chauffage || ''}
                            onChange={(e) => setRdvFormData({...rdvFormData, mode_chauffage: e.target.value})}
                          >
                            <option value="">Sélectionner</option>
                            {modeChauffage?.map(mode => (
                              <option key={mode.id} value={mode.id}>
                                {mode.titre}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label htmlFor="rdv_annee_systeme">Année système chauffage</label>
                          <input
                            type="number"
                            id="rdv_annee_systeme"
                            className="form-control"
                            value={rdvFormData.annee_systeme_chauffage || ''}
                            onChange={(e) => setRdvFormData({...rdvFormData, annee_systeme_chauffage: e.target.value})}
                            placeholder="Ex: 2010"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Champs spécifiques PV */}
                  {isPV && (
                    <>
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="rdv_orientation">Orientation toiture</label>
                          <select
                            id="rdv_orientation"
                            className="form-control"
                            value={rdvFormData.conf_orientation_toiture}
                            onChange={(e) => setRdvFormData({...rdvFormData, conf_orientation_toiture: e.target.value})}
                          >
                            <option value="">Sélectionner</option>
                            <option value="NORD">NORD</option>
                            <option value="SUD">SUD</option>
                            <option value="EST">EST</option>
                            <option value="OUEST">OUEST</option>
                            <option value="NORD-EST">NORD-EST</option>
                            <option value="NORD-OUEST">NORD-OUEST</option>
                            <option value="SUD-EST">SUD-EST</option>
                            <option value="SUD-OUEST">SUD-OUEST</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label htmlFor="rdv_zones_ombres">Zones ombres</label>
                          <select
                            id="rdv_zones_ombres"
                            className="form-control"
                            value={rdvFormData.conf_zones_ombres}
                            onChange={(e) => setRdvFormData({...rdvFormData, conf_zones_ombres: e.target.value})}
                          >
                            <option value="">Sélectionner</option>
                            <option value="OUI">OUI</option>
                            <option value="NON">NON</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="rdv_site_classe">Site classé</label>
                          <select
                            id="rdv_site_classe"
                            className="form-control"
                            value={rdvFormData.conf_site_classe}
                            onChange={(e) => setRdvFormData({...rdvFormData, conf_site_classe: e.target.value})}
                          >
                            <option value="">Sélectionner</option>
                            <option value="OUI">OUI</option>
                            <option value="NON">NON</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label htmlFor="rdv_consommation_elec">Consommation électricité (€)</label>
                          <input
                            type="text"
                            id="rdv_consommation_elec"
                            className="form-control"
                            value={rdvFormData.conf_consommation_electricite}
                            onChange={(e) => setRdvFormData({...rdvFormData, conf_consommation_electricite: e.target.value})}
                            placeholder="Ex: 800 €/an"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label htmlFor="rdv_nb_pans">Nombre de pans</label>
                          <input
                            type="number"
                            id="rdv_nb_pans"
                            className="form-control"
                            min="1"
                            value={rdvFormData.nb_pans}
                            onChange={(e) => setRdvFormData({...rdvFormData, nb_pans: e.target.value})}
                            placeholder="Ex: 4"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              );
            })()}

            {/* Commentaire */}
            <div className="form-group">
              <label htmlFor="rdv_commentaire">Commentaire produit</label>
              <textarea
                id="rdv_commentaire"
                className="form-control"
                rows="4"
                value={rdvFormData.conf_commentaire_produit}
                onChange={(e) => setRdvFormData({...rdvFormData, conf_commentaire_produit: e.target.value})}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Annuler
              </button>
              <button type="submit" className="btn-save">
                Créer le RDV
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FicheDetail;
