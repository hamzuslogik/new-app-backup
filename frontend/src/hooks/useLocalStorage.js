import { useState, useEffect } from 'react';

/**
 * Hook pour persister une valeur dans localStorage
 * @param {string} key - Clé dans localStorage
 * @param {any} initialValue - Valeur initiale
 * @returns {[any, Function]} - [value, setValue]
 */
export const useLocalStorage = (key, initialValue) => {
  // État pour stocker la valeur
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Erreur lors de la lecture de localStorage pour la clé "${key}":`, error);
      return initialValue;
    }
  });

  // Fonction pour mettre à jour la valeur
  const setValue = (value) => {
    try {
      // Permettre à value d'être une fonction pour avoir la même API que useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Erreur lors de l'écriture dans localStorage pour la clé "${key}":`, error);
    }
  };

  return [storedValue, setValue];
};

export default useLocalStorage;

