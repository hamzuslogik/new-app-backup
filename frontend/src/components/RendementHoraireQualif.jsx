import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from 'react-query';
import { FaImage, FaClock } from 'react-icons/fa';
import { toPng } from 'html-to-image';
import { toast } from 'react-toastify';
import api from '../config/api';
import { getTodayLocal } from '../utils/dateUtils';
import './RendementHoraireQualif.css';

function formatNum(n, digits = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(digits);
}

async function exportNodeToPng(node, filename) {
  if (!node) throw new Error('Zone à exporter introuvable');
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

const RendementTable = React.forwardRef(function RendementTable(
  { title, slot, rps },
  ref
) {
  const rpsWithSups = useMemo(
    () => (rps || []).filter((rp) => (rp.superviseurs || []).length > 0),
    [rps]
  );
  const superviseurs = useMemo(
    () => rpsWithSups.flatMap((rp) => rp.superviseurs || []),
    [rpsWithSups]
  );

  if (!superviseurs.length) {
    return (
      <div className="rhq-empty" ref={ref}>
        Aucun superviseur / RP à afficher.
      </div>
    );
  }

  return (
    <div className="rhq-table-card" ref={ref}>
      <table className="rhq-table">
        <colgroup>
          <col className="rhq-col-label" />
          {superviseurs.map((s) => (
            <col key={`col-${s.id}`} className="rhq-col-sup" />
          ))}
          <col className="rhq-col-total" />
        </colgroup>
        <thead>
          <tr>
            <th className="rhq-corner">{title}</th>
            {rpsWithSups.map((rp) =>
              (rp.superviseurs || []).map((s) => (
                <th
                  key={s.id}
                  className="rhq-sup-header"
                  style={{ backgroundColor: rp.color }}
                >
                  <div className="rhq-sup-name">{(s.pseudo || '').toUpperCase()}</div>
                  <div className="rhq-sup-sub">{rp.pseudo}</div>
                </th>
              ))
            )}
            <th className="rhq-total-header">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="rhq-row-label">Agents</td>
            {superviseurs.map((s) => (
              <td key={`a-${s.id}`}>
                {formatNum(slot?.by_superviseur?.[s.id]?.agents ?? s.agents_equipe ?? 0)}
              </td>
            ))}
            <td className="rhq-total-cell">{formatNum(slot?.total?.agents ?? 0)}</td>
          </tr>
          <tr className="rhq-row-fiches">
            <td className="rhq-row-label">Fiches</td>
            {superviseurs.map((s) => (
              <td key={`f-${s.id}`}>
                {slot?.by_superviseur?.[s.id]?.fiches ?? 0}
              </td>
            ))}
            <td className="rhq-total-cell">{slot?.total?.fiches ?? 0}</td>
          </tr>
          <tr>
            <td className="rhq-row-label">Ratio</td>
            {superviseurs.map((s) => (
              <td key={`r-${s.id}`}>
                {formatNum(slot?.by_superviseur?.[s.id]?.ratio ?? 0)}
              </td>
            ))}
            <td className="rhq-total-cell">{formatNum(slot?.total?.ratio ?? 0)}</td>
          </tr>
          <tr className="rhq-row-footer">
            <td className="rhq-row-label rhq-footer-label">Fiches / Ratio</td>
            {rpsWithSups.map((rp) => {
              const rpStats = slot?.by_rp?.[rp.id] || { fiches: 0, ratio: 0 };
              const colSpan = (rp.superviseurs || []).length;
              return (
                <td
                  key={`footer-${rp.id}`}
                  colSpan={colSpan}
                  className="rhq-rp-footer"
                >
                  <span className="rhq-rp-footer-fiches">{rpStats.fiches ?? 0}</span>
                  <span
                    className="rhq-rp-footer-ratio"
                    style={{ backgroundColor: rp.color }}
                  >
                    {formatNum(rpStats.ratio ?? 0)}
                  </span>
                </td>
              );
            })}
            <td className="rhq-total-cell rhq-footer-total" />
          </tr>
        </tbody>
      </table>
    </div>
  );
});

const RendementHoraireQualif = () => {
  const [date, setDate] = useState(getTodayLocal);
  const [exporting, setExporting] = useState(false);
  const hourRefs = useRef({});
  const totalRef = useRef(null);
  const allRef = useRef(null);

  const { data, isLoading, error } = useQuery(
    ['production-qualif-rendement-horaire', date],
    async () => {
      const res = await api.get('/statistiques/production-qualif-rendement-horaire', {
        params: { date, hour_start: 9, hour_end: 19 },
      });
      return res.data?.data || null;
    },
    { keepPreviousData: true }
  );

  const rps = data?.rps || [];
  const hours = data?.hours || [];
  const dayTotal = data?.day_total || null;

  const handleExport = async (kind, hour = null) => {
    setExporting(true);
    try {
      let node = null;
      let filename = `rendement-horaire-${date}`;
      if (kind === 'all') {
        node = allRef.current;
        filename += '-complet.png';
      } else if (kind === 'total') {
        node = totalRef.current;
        filename += '-total.png';
      } else {
        node = hourRefs.current[hour];
        filename += `-${hour}h.png`;
      }
      await exportNodeToPng(node, filename);
      toast.success('Image exportée');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de l\'export image');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="rhq-panel">
      <div className="rhq-toolbar noprint">
        <div className="rhq-toolbar-left">
          <FaClock />
          <label htmlFor="rhq-date">Date insertion</label>
          <input
            id="rhq-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="rhq-toolbar-right">
          <button
            type="button"
            className="rhq-export-btn"
            disabled={exporting || isLoading}
            onClick={() => handleExport('total')}
            title="Exporter le total journée en image"
          >
            <FaImage /> Image total
          </button>
          <button
            type="button"
            className="rhq-export-btn"
            disabled={exporting || isLoading}
            onClick={() => handleExport('all')}
            title="Exporter toute la période (tous les créneaux) en image"
          >
            <FaImage /> Image période
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rhq-loading">Chargement du rendement horaire…</div>
      ) : error ? (
        <div className="rhq-error">
          {error.response?.data?.message || error.message || 'Erreur de chargement'}
        </div>
      ) : (
        <div className="rhq-content" ref={allRef}>
          {hours.map((slot) => (
            <div key={slot.hour} className="rhq-slot-block">
              <div className="rhq-slot-actions noprint">
                <span className="rhq-slot-title">{slot.slot_label}</span>
                <button
                  type="button"
                  className="rhq-export-btn rhq-export-btn-sm"
                  disabled={exporting}
                  onClick={() => handleExport('hour', slot.hour)}
                >
                  <FaImage /> Image
                </button>
              </div>
              <RendementTable
                ref={(el) => {
                  hourRefs.current[slot.hour] = el;
                }}
                title={slot.label}
                slot={slot}
                rps={rps}
              />
            </div>
          ))}

          {dayTotal && (
            <div className="rhq-slot-block rhq-slot-total">
              <div className="rhq-slot-actions noprint">
                <span className="rhq-slot-title">Total journée</span>
              </div>
              <RendementTable
                ref={totalRef}
                title={dayTotal.label || 'TOTAL'}
                slot={dayTotal}
                rps={rps}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RendementHoraireQualif;
