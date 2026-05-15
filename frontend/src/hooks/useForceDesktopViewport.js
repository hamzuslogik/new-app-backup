import { useEffect } from 'react';

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

      document.body.classList.remove(pageClassName);
      document.documentElement.classList.remove(pageClassName);

      document.documentElement.style.minWidth = '';
      document.documentElement.style.width = '';
      document.documentElement.style.maxWidth = '';
      document.documentElement.style.overflowX = '';
      document.body.style.minWidth = '';
      document.body.style.width = '';
      document.body.style.maxWidth = '';
      document.body.style.overflowX = '';
    };
  }, [pageClassName, width]);
};

export default useForceDesktopViewport;
