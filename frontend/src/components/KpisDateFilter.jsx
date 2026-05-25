import React from 'react';
import { FaSearch } from 'react-icons/fa';

const KpisDateFilter = ({
  dateFilters,
  onDateChampChange,
  onDatetimeChange,
  onApplyNow,
  onApply,
  onReset,
  extraControls = null,
  fixedDateChamp = null,
  hideDateChamp = false,
}) => {
  const filterToDatetimeLocalValue = (dateValue, timeValue, defaultTime = '00:00:00') => {
    const d = String(dateValue || '').trim();
    if (!d) return '';
    const tRaw = String(timeValue || defaultTime || '').trim();
    const hhmm = tRaw.length >= 5 ? tRaw.slice(0, 5) : String(defaultTime || '00:00:00').slice(0, 5);
    return `${d}T${hhmm}`;
  };

  const showDateInputs = hideDateChamp || fixedDateChamp || dateFilters.date_champ;
  const fixedDateLabel =
    fixedDateChamp === 'date_rdv_time'
      ? 'Date planning'
      : fixedDateChamp === 'date_insert_time'
        ? 'Date insertion'
        : null;

  return (
    <div className="header-controls kpi-date-filter-panel">
      <div className="search-form kpi-date-filter-form">
        <div className="kpi-date-filter filters-row kpi-date-filter-row">
          {!hideDateChamp && (
            <div className="form-group">
              <label htmlFor="kpi-date-champ">Champ de date</label>
              {fixedDateChamp ? (
                <div className="month-select kpi-date-champ-static" id="kpi-date-champ">
                  {fixedDateLabel}
                </div>
              ) : (
                <select
                  id="kpi-date-champ"
                  className="month-select"
                  value={dateFilters.date_champ || ''}
                  onChange={(e) => onDateChampChange(e.target.value)}
                >
                  <option value="">Sélectionnez date</option>
                  <option value="date_insert_time">Date Insertion</option>
                  <option value="date_rdv_time">Date Planning</option>
                </select>
              )}
            </div>
          )}
          {showDateInputs && (
            <>
              <div className="form-group date-group">
                <label>Date début</label>
                <div className="date-time-inputs date-time-with-actuellement">
                  <input
                    type="datetime-local"
                    className="form-control"
                    step={60}
                    value={filterToDatetimeLocalValue(dateFilters.date_debut, dateFilters.time_debut, '00:00:00')}
                    onChange={(e) => onDatetimeChange('debut', e)}
                    aria-label="Date et heure début"
                  />
                  <button type="button" className="btn-datetime-actuellement" onClick={() => onApplyNow('debut')}>
                    Actuellement
                  </button>
                </div>
              </div>
              <div className="form-group date-group">
                <label>Date fin</label>
                <div className="date-time-inputs date-time-with-actuellement">
                  <input
                    type="datetime-local"
                    className="form-control"
                    step={60}
                    value={filterToDatetimeLocalValue(dateFilters.date_fin, dateFilters.time_fin, '23:59:59')}
                    onChange={(e) => onDatetimeChange('fin', e)}
                    aria-label="Date et heure fin"
                  />
                  <button type="button" className="btn-datetime-actuellement" onClick={() => onApplyNow('fin')}>
                    Actuellement
                  </button>
                </div>
              </div>
            </>
          )}
          {extraControls}
          <div className="search-form-actions-left kpi-date-filter-actions">
            <button type="button" className="btn-search" onClick={onApply}>
              <FaSearch /> Appliquer
            </button>
            <button type="button" className="btn-reset" onClick={onReset}>
              Réinitialiser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KpisDateFilter;
