import jsPDF from 'jspdf';
import { formatRdvDateTime } from './formatRdvDateTime';

function modeChauffageAffiche(confProp, modeProp) {
  const v = confProp ?? modeProp;
  if (v == null || v === '') return '';
  return String(v).trim();
}

/**
 * Génère et télécharge le PDF « Fiche client » (même rendu que l'onglet PDF du détail fiche).
 * @param {object} fiche - Données fiche (GET /fiches/:hash)
 * @param {object} lookups - Listes de référence pour libellés
 */
export function generateFicheClientPdf(fiche, lookups = {}) {
  const {
    professions = [],
    typeContrat = [],
    centres = [],
    agents = [],
    commerciaux = [],
    confirmateurs = [],
  } = lookups;

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
    const modeChauffageNom = modeChauffageAffiche(fiche.conf_mode_chauffage, fiche.mode_chauffage) || '-';
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
}
