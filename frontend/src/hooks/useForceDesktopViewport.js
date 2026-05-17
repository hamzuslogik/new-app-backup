import { useEffect } from 'react';

const DEFAULT_WIDTH = 1400;

/**
 * Force l'affichage desktop sur mobile (même méthode que Dashboard).
 * Utilise data-desktop-viewport sur html/body — pas de classe sur body pour éviter
 * les conflits avec le conteneur racine de la page (.xxx-page).
 */
const useForceDesktopViewport = (_pageClassName, width = DEFAULT_WIDTH) => {
  useEffect(() => {
    const originalViewport = document.querySelector('meta[name="viewport"]');
    const originalContent = originalViewport?.getAttribute('content') || '';

    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', `width=${width}`);

    document.documentElement.dataset.desktopViewport = String(width);
    document.body.dataset.desktopViewport = String(width);

    document.documentElement.style.minWidth = `${width}px`;
    document.documentElement.style.width = 'auto';
    document.documentElement.style.maxWidth = 'none';
    document.documentElement.style.overflowX = 'auto';
    document.body.style.minWidth = `${width}px`;
    document.body.style.width = 'auto';
    document.body.style.maxWidth = 'none';
    document.body.style.overflowX = 'auto';

    return () => {
      if (originalViewport && originalContent) {
        originalViewport.setAttribute('content', originalContent);
      } else if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1');
      }

      delete document.documentElement.dataset.desktopViewport;
      delete document.body.dataset.desktopViewport;

      document.documentElement.style.minWidth = '';
      document.documentElement.style.width = '';
      document.documentElement.style.maxWidth = '';
      document.documentElement.style.overflowX = '';
      document.body.style.minWidth = '';
      document.body.style.width = '';
      document.body.style.maxWidth = '';
      document.body.style.overflowX = '';
    };
  }, [width]);
};

export default useForceDesktopViewport;
