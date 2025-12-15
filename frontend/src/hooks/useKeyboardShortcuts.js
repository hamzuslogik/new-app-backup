import { useEffect } from 'react';

/**
 * Hook pour gérer les raccourcis clavier
 * @param {Object|Array} shortcuts - Objet avec les raccourcis { 'ctrl+s': callback, 'escape': callback }
 *                                   Ou tableau d'objets [{ key: 's', ctrlKey: true, handler: callback }]
 * @param {Array} deps - Dépendances pour le useEffect
 */
export const useKeyboardShortcuts = (shortcuts, deps = []) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Si shortcuts est un tableau (nouveau format)
      if (Array.isArray(shortcuts)) {
        for (const shortcut of shortcuts) {
          const { key, ctrlKey, shiftKey, altKey, metaKey, handler } = shortcut;
          if (
            event.key.toLowerCase() === key?.toLowerCase() &&
            (ctrlKey === undefined || event.ctrlKey === ctrlKey || event.metaKey === ctrlKey) &&
            (shiftKey === undefined || event.shiftKey === shiftKey) &&
            (altKey === undefined || event.altKey === altKey) &&
            (metaKey === undefined || event.metaKey === metaKey)
          ) {
            event.preventDefault();
            handler(event);
            return;
          }
        }
        return;
      }

      // Ancien format (objet)
      const parts = [];
      if (event.ctrlKey || event.metaKey) parts.push('ctrl');
      if (event.shiftKey) parts.push('shift');
      if (event.altKey) parts.push('alt');
      
      const key = event.key.toLowerCase();
      if (key !== 'control' && key !== 'shift' && key !== 'alt' && key !== 'meta') {
        parts.push(key);
      }
      
      const combination = parts.join('+');
      
      // Chercher le raccourci correspondant
      if (shortcuts[combination]) {
        event.preventDefault();
        shortcuts[combination](event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, ...deps]);
};

export default useKeyboardShortcuts;

