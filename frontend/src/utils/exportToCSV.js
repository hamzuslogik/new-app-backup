/**
 * Fonction utilitaire pour exporter des données en CSV
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

export default exportToCSV;

