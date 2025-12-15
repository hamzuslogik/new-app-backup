import { useEffect } from 'react';

/**
 * Hook personnalisé pour bloquer le défilement du body quand un modal est ouvert
 * Permet le scroll avec la roulette et les flèches uniquement sur le modal
 * @param {boolean} isOpen - État du modal (ouvert/fermé)
 */
export const useModalScrollLock = (isOpen) => {
  useEffect(() => {
    if (isOpen) {
      // Sauvegarder les valeurs actuelles
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const originalBodyPaddingRight = document.body.style.paddingRight;
      const originalBodyPosition = document.body.style.position;
      const originalBodyTop = document.body.style.top;
      const originalBodyWidth = document.body.style.width;
      
      // Calculer la position de scroll actuelle
      const scrollY = window.scrollY;
      
      // Calculer la largeur de la scrollbar pour éviter le décalage du contenu
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      
      // Bloquer le scroll du body et html sans modifier la taille
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      // Ne pas forcer width: 100% pour éviter de réduire la page
      // document.body.style.width = '100%';
      
      // Ajouter un padding-right pour compenser la disparition de la scrollbar
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      
      // Sauvegarder la position de scroll pour la restaurer plus tard
      window.scrollYPosition = scrollY;

      // Gérer les événements wheel pour permettre le scroll uniquement sur les modals
      const handleWheel = (e) => {
        // Trouver l'élément modal le plus proche
        let element = e.target;
        const modalSelectors = [
          '.modal-content',
          '.fiche-detail-modal-content',
          '.templates-modal-content',
          '.history-modal-content',
          '.tester-modal-content',
          '.distance-modal-content',
          '.planning-modal-content'
        ];
        
        let isInsideModal = false;
        
        // Remonter dans le DOM pour vérifier si on est dans un modal
        while (element && element !== document.body && element !== document.documentElement) {
          // Vérifier si l'élément ou un de ses parents a une classe de modal
          if (element.classList) {
            for (const selector of modalSelectors) {
              if (element.matches(selector) || element.closest(selector)) {
                isInsideModal = true;
                break;
              }
            }
            if (isInsideModal) break;
            
            // Vérifier les classes directement
            if (
              element.classList.contains('modal-content') ||
              element.classList.contains('fiche-detail-modal-content') ||
              element.classList.contains('templates-modal-content') ||
              element.classList.contains('history-modal-content') ||
              element.classList.contains('tester-modal-content') ||
              element.classList.contains('distance-modal-content') ||
              element.classList.contains('planning-modal-content')
            ) {
              isInsideModal = true;
              break;
            }
          }
          element = element.parentElement;
        }
        
        // Si on n'est pas dans un modal, empêcher le scroll de la page
        if (!isInsideModal) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Sinon, laisser le comportement par défaut (scroll dans le modal)
      };

      // Gérer les flèches du clavier pour permettre le scroll uniquement sur les modals
      const handleKeyDown = (e) => {
        // Vérifier si c'est une flèche (ArrowUp, ArrowDown, PageUp, PageDown, Home, End)
        const isScrollKey = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key);
        
        if (!isScrollKey) return;
        
        // Vérifier si l'élément actif est un élément de formulaire
        const activeElement = document.activeElement;
        
        // Si c'est un input, textarea, select, ou un élément éditable, laisser passer
        if (
          activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.tagName === 'SELECT' ||
          activeElement?.isContentEditable
        ) {
          return; // Laisser le navigateur gérer normalement
        }
        
        // Trouver le modal content le plus proche
        const modalSelectors = [
          '.modal-content',
          '.fiche-detail-modal-content',
          '.templates-modal-content',
          '.history-modal-content',
          '.tester-modal-content',
          '.distance-modal-content',
          '.planning-modal-content'
        ];
        
        let modalContent = null;
        let element = activeElement || e.target;
        
        // Remonter dans le DOM pour trouver un modal
        while (element && element !== document.body && element !== document.documentElement) {
          for (const selector of modalSelectors) {
            if (element.matches && element.matches(selector)) {
              modalContent = element;
              break;
            }
            const found = element.querySelector ? element.querySelector(selector) : null;
            if (found) {
              modalContent = found;
              break;
            }
          }
          if (modalContent) break;
          
          if (element.classList) {
            if (
              element.classList.contains('modal-content') ||
              element.classList.contains('fiche-detail-modal-content') ||
              element.classList.contains('templates-modal-content') ||
              element.classList.contains('history-modal-content') ||
              element.classList.contains('tester-modal-content') ||
              element.classList.contains('distance-modal-content') ||
              element.classList.contains('planning-modal-content')
            ) {
              modalContent = element;
              break;
            }
          }
          element = element.parentElement;
        }
        
        // Si on est dans un modal, gérer le scroll avec les flèches
        if (modalContent) {
          const canScrollUp = modalContent.scrollTop > 0;
          const canScrollDown = modalContent.scrollHeight > modalContent.clientHeight + modalContent.scrollTop;
          
          // Déterminer le montant de scroll
          let scrollAmount = 0;
          if (e.key === 'ArrowUp' && canScrollUp) {
            scrollAmount = -50;
          } else if (e.key === 'ArrowDown' && canScrollDown) {
            scrollAmount = 50;
          } else if (e.key === 'PageUp' && canScrollUp) {
            scrollAmount = -modalContent.clientHeight * 0.9;
          } else if (e.key === 'PageDown' && canScrollDown) {
            scrollAmount = modalContent.clientHeight * 0.9;
          } else if (e.key === 'Home' && canScrollUp) {
            scrollAmount = -modalContent.scrollHeight;
          } else if (e.key === 'End' && canScrollDown) {
            scrollAmount = modalContent.scrollHeight;
          }
          
          if (scrollAmount !== 0) {
            e.preventDefault();
            modalContent.scrollBy({ top: scrollAmount, behavior: 'smooth' });
          }
        } else {
          // Si on n'est pas dans un modal, empêcher le scroll avec les flèches
          e.preventDefault();
          e.stopPropagation();
        }
      };

      // Ajouter les écouteurs d'événements
      document.addEventListener('wheel', handleWheel, { passive: false });
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        // Retirer les écouteurs d'événements
        document.removeEventListener('wheel', handleWheel);
        document.removeEventListener('keydown', handleKeyDown);
        
        // Restaurer les valeurs originales quand le modal se ferme
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.position = originalBodyPosition;
        document.body.style.top = originalBodyTop;
        // Restaurer la largeur seulement si elle était définie
        if (originalBodyWidth) {
          document.body.style.width = originalBodyWidth;
        } else {
          document.body.style.width = '';
        }
        document.body.style.paddingRight = originalBodyPaddingRight;
        
        // Restaurer la position de scroll
        if (window.scrollYPosition !== undefined) {
          window.scrollTo(0, window.scrollYPosition);
          delete window.scrollYPosition;
        }
      };
    }
  }, [isOpen]);
};

