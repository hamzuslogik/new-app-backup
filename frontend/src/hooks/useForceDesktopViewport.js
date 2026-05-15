import { useEffect } from 'react';

/**
 * Force une largeur « desktop » pour les tableaux larges tout en évitant de mettre
 * overflow-x sur html/body (sinon double scroll, sticky header décalé, bande blanche au-dessus).
 * La zone de scroll horizontal est confinée à #root.
 */
const useForceDesktopViewport = (pageClassName = 'desktop-forced-page', width = 1400) => {
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

    document.body.classList.add(pageClassName);
    document.documentElement.classList.add(pageClassName);

    const root = document.getElementById('root');
    if (root) {
      root.dataset.forceDesktopWidth = String(width);
      root.style.minWidth = `${width}px`;
      root.style.overflowX = 'auto';
    }

    return () => {
      if (originalViewport && originalContent) {
        originalViewport.setAttribute('content', originalContent);
      } else if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1');
      }

      document.body.classList.remove(pageClassName);
      document.documentElement.classList.remove(pageClassName);

      const r = document.getElementById('root');
      if (r) {
        delete r.dataset.forceDesktopWidth;
        r.style.minWidth = '';
        r.style.overflowX = '';
      }
    };
  }, [pageClassName, width]);
};

export default useForceDesktopViewport;

