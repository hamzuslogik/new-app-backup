/**
 * Fonction utilitaire pour appliquer les améliorations UX standard
 * aux onglets de gestion simples (avec un seul champ "nom")
 */

export const applyStandardUXImprovements = (componentName, entityName) => {
  return {
    imports: `import { FaInfoCircle } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import Tooltip from '../common/Tooltip';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import useLocalStorage from '../../hooks/useLocalStorage';`,
    
    searchTermHook: `const [searchTerm, setSearchTerm] = useLocalStorage('management_${componentName.toLowerCase()}_search', '');`,
    
    keyboardShortcuts: `  // Raccourcis clavier
  useKeyboardShortcuts({
    'escape': () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
        setFormData({ nom: '' });
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
  }, [showForm]);`,
    
    errorHandling: {
      create: `      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la création du ${entityName}';
        const errorDetails = error.response?.data?.details ? 
                            \` Détails: \${error.response.data.details}\` : '';
        toast.error(\`\${errorMessage}\${errorDetails}\`, { autoClose: 5000 });
      },`,
      update: `      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la mise à jour du ${entityName}';
        const errorDetails = error.response?.data?.details ? 
                            \` Détails: \${error.response.data.details}\` : '';
        toast.error(\`\${errorMessage}\${errorDetails}\`, { autoClose: 5000 });
      },`,
      delete: `      onError: (error) => {
        const errorMessage = error.response?.data?.message || 
                            error.message || 
                            'Erreur lors de la suppression du ${entityName}';
        const errorDetails = error.response?.data?.details ? 
                            \` Détails: \${error.response.data.details}\` : '';
        toast.error(\`\${errorMessage}\${errorDetails}\`, { autoClose: 5000 });
      },`
    },
    
    loadingSpinner: `  if (isLoading) return <LoadingSpinner text="Chargement des ${entityName.toLowerCase()}..." />;`,
    
    formField: `<label>
                  Nom *
                  <Tooltip text="Nom du ${entityName.toLowerCase()}. Ce champ est obligatoire.">
                    <FaInfoCircle className="info-icon" />
                  </Tooltip>
                </label>`,
    
    formActions: `<button type="submit" className="btn-primary" disabled={createMutation.isLoading || updateMutation.isLoading}>
                  {createMutation.isLoading || updateMutation.isLoading ? (
                    <>
                      <LoadingSpinner size="small" text="" />
                      {editingId ? 'Modification...' : 'Création...'}
                    </>
                  ) : (
                    <>
                      {editingId ? 'Modifier' : 'Créer'} <span className="shortcut-hint">(Ctrl+S)</span>
                    </>
                  )}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>
                  Annuler <span className="shortcut-hint">(Esc)</span>
                </button>`
  };
};

