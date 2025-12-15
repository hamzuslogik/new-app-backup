import React from 'react';
import { FaChevronLeft, FaChevronRight, FaAngleDoubleLeft, FaAngleDoubleRight } from 'react-icons/fa';
import './Pagination.css';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  totalItems, 
  itemsPerPage, 
  onPageChange,
  onItemsPerPageChange 
}) => {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (totalPages <= 1 && !onItemsPerPageChange) return null;

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        <span>
          Affichage de {startItem} à {endItem} sur {totalItems} résultat(s)
        </span>
        {onItemsPerPageChange && (
          <div className="items-per-page-selector">
            <label>Par page :</label>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(parseInt(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            className="pagination-btn"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            title="Première page"
          >
            <FaAngleDoubleLeft />
          </button>
          <button
            className="pagination-btn"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title="Page précédente"
          >
            <FaChevronLeft />
          </button>

          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {page === '...' ? (
                <span className="pagination-ellipsis">...</span>
              ) : (
                <button
                  className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </button>
              )}
            </React.Fragment>
          ))}

          <button
            className="pagination-btn"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Page suivante"
          >
            <FaChevronRight />
          </button>
          <button
            className="pagination-btn"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            title="Dernière page"
          >
            <FaAngleDoubleRight />
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;

