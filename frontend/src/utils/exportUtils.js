import jsPDF from 'jspdf';

/**
 * Exporte des données en CSV
 * @param {Array} data - Tableau d'objets à exporter
 * @param {Array} columns - Configuration des colonnes [{ key: 'id', label: 'ID' }, ...]
 * @param {string} filename - Nom du fichier (sans extension)
 */
export const exportToCSV = (data, columns, filename = 'export') => {
  if (!data || data.length === 0) {
    alert('Aucune donnée à exporter');
    return;
  }

  // Créer l'en-tête CSV
  const headers = columns.map(col => col.label || col.key).join(',');
  
  // Créer les lignes de données
  const rows = data.map(item => {
    return columns.map(col => {
      let value = item[col.key];
      
      // Gérer les valeurs nulles/undefined
      if (value === null || value === undefined) {
        value = '';
      }
      
      // Gérer les objets complexes (ex: badge, etc.)
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      
      // Échapper les virgules et guillemets
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      
      return value;
    }).join(',');
  });

  // Combiner en-tête et données
  const csvContent = [headers, ...rows].join('\n');

  // Ajouter BOM pour Excel (UTF-8)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Créer le lien de téléchargement
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Nettoyer l'URL
  URL.revokeObjectURL(url);
};

/**
 * Exporte des données en Excel (format XML simple)
 * @param {Array} data - Tableau d'objets à exporter
 * @param {Array} columns - Configuration des colonnes [{ key: 'id', label: 'ID' }, ...]
 * @param {string} filename - Nom du fichier (sans extension)
 */
export const exportToExcel = (data, columns, filename = 'export') => {
  if (!data || data.length === 0) {
    alert('Aucune donnée à exporter');
    return;
  }

  // Créer le contenu XML Excel
  let xmlContent = '<?xml version="1.0"?>\n';
  xmlContent += '<?mso-application progid="Excel.Sheet"?>\n';
  xmlContent += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xmlContent += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
  xmlContent += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
  xmlContent += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xmlContent += ' xmlns:html="http://www.w3.org/TR/REC-html40">\n';
  xmlContent += '<Worksheet ss:Name="Sheet1">\n';
  xmlContent += '<Table>\n';

  // En-têtes
  xmlContent += '<Row>\n';
  columns.forEach(col => {
    xmlContent += `<Cell><Data ss:Type="String">${escapeXml(col.label || col.key)}</Data></Cell>\n`;
  });
  xmlContent += '</Row>\n';

  // Données
  data.forEach(item => {
    xmlContent += '<Row>\n';
    columns.forEach(col => {
      let value = item[col.key];
      if (value === null || value === undefined) {
        value = '';
      }
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      const type = typeof value === 'number' ? 'Number' : 'String';
      xmlContent += `<Cell><Data ss:Type="${type}">${escapeXml(String(value))}</Data></Cell>\n`;
    });
    xmlContent += '</Row>\n';
  });

  xmlContent += '</Table>\n';
  xmlContent += '</Worksheet>\n';
  xmlContent += '</Workbook>';

  // Créer le blob
  const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
  
  // Créer le lien de téléchargement
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xls`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Nettoyer l'URL
  URL.revokeObjectURL(url);
};

/**
 * Échappe les caractères XML
 */
const escapeXml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Exporte des données en PDF
 * @param {Array} data - Tableau d'objets à exporter
 * @param {Array} columns - Configuration des colonnes [{ key: 'id', label: 'ID' }, ...]
 * @param {string} filename - Nom du fichier (sans extension)
 * @param {string} title - Titre du document
 */
export const exportToPDF = (data, columns, filename = 'export', title = 'Export') => {
  if (!data || data.length === 0) {
    alert('Aucune donnée à exporter');
    return;
  }

  const doc = new jsPDF('landscape'); // Mode paysage pour plus d'espace
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const startY = 30;
  let yPos = startY;

  // Titre
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, yPos);
  yPos += 10;

  // Date d'export
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, margin, yPos);
  yPos += 10;

  // Calculer la largeur des colonnes
  const numColumns = columns.length;
  const availableWidth = pageWidth - (margin * 2);
  const colWidth = availableWidth / numColumns;

  // En-têtes
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  let xPos = margin;
  
  columns.forEach((col, index) => {
    const label = col.label || col.key;
    doc.text(label.substring(0, 20), xPos, yPos); // Limiter à 20 caractères
    xPos += colWidth;
  });
  
  yPos += 7;
  doc.setLineWidth(0.5);
  doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
  yPos += 3;

  // Données
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  data.forEach((item, rowIndex) => {
    // Vérifier si on a besoin d'une nouvelle page
    if (yPos > pageHeight - 20) {
      doc.addPage();
      yPos = startY;
    }

    xPos = margin;
    columns.forEach((col, colIndex) => {
      let value = item[col.key];
      if (value === null || value === undefined) {
        value = '';
      }
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      
      const text = String(value).substring(0, 25); // Limiter à 25 caractères
      doc.text(text, xPos, yPos);
      xPos += colWidth;
    });
    
    yPos += 6;
    
    // Ligne de séparation
    if (rowIndex < data.length - 1) {
      doc.setLineWidth(0.1);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos - 1, pageWidth - margin, yPos - 1);
    }
  });

  // Pied de page
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} sur ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Télécharger le PDF
  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
};

