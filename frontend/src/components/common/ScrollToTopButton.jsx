import React, { useState, useEffect } from 'react';
import { FaArrowUp } from 'react-icons/fa';
import './ScrollToTopButton.css';

const ScrollToTopButton = () => {
  const [visible, setVisible] = useState(false);
  const [scrollContainer, setScrollContainer] = useState(null);

  useEffect(() => {
    // Le scroll se fait sur .content-wrapper (Layout)
    const container = document.querySelector('.content-wrapper') || window;
    setScrollContainer(container);
  }, []);

  useEffect(() => {
    if (!scrollContainer) return;

    const getScrollTop = () => scrollContainer === window
      ? window.scrollY || document.documentElement.scrollTop
      : scrollContainer.scrollTop;

    const handleScroll = () => setVisible(getScrollTop() > 300);

    handleScroll(); // Vérifier l'état initial (ex: retour navigateur)
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [scrollContainer]);

  const scrollToTop = () => {
    if (scrollContainer) {
      if (scrollContainer === window) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      className="scroll-to-top-btn"
      onClick={scrollToTop}
      title="Remonter en haut"
      aria-label="Remonter en haut"
    >
      <FaArrowUp />
    </button>
  );
};

export default ScrollToTopButton;
