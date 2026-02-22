import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaArrowUp } from 'react-icons/fa';
import './ScrollToTopButton.css';

const ScrollToTopButton = () => {
  const [visible, setVisible] = useState(false);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    scrollContainerRef.current = document.querySelector('.content-wrapper');
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const win = window;

    const getScrollTop = () => {
      const elScroll = container?.scrollTop ?? 0;
      const winScroll = win.scrollY ?? document.documentElement.scrollTop ?? 0;
      return Math.max(elScroll, winScroll);
    };

    const handleScroll = () => setVisible(getScrollTop() > 150);

    handleScroll();
    if (container) container.addEventListener('scroll', handleScroll, { passive: true });
    win.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (container) container.removeEventListener('scroll', handleScroll);
      win.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    const container = scrollContainerRef.current;
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const buttonEl = (
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

  if (!visible) return null;
  return createPortal(buttonEl, document.body);
};

export default ScrollToTopButton;
