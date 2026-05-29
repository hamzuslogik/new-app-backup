import { exportToCSV, exportToExcel, exportToPDF } from './exportUtils';
import { TAUX_FIXED_COLUMNS } from './statistiquesColumnUtils';

function calcTauxExport(pos, neg) {
  const sum = (pos || 0) + (neg || 0);
  return sum > 0 ? `${(((pos || 0) / sum) * 100).toFixed(1)}%` : '—';
}

export function buildStatsTableExport(statsData, statType, visibleEtats, visibleTauxCols) {
  const { name_stat, data, total } = statsData;
  const entityLabel = name_stat || 'Entité';

  if (statType === 'taux') {
    const cols = [
      { key: 'num', label: 'N°' },
      { key: 'name', label: entityLabel },
      ...visibleTauxCols.map((c) => ({ key: c.id, label: c.label })),
      { key: 'taux', label: 'TAUX %' },
    ];
    const rows = (data || []).map((item, idx) => {
      const row = { num: idx + 1, name: item.name };
      visibleTauxCols.forEach((c) => {
        row[c.id] = c.getValue(item);
      });
      row.taux = calcTauxExport(item.totals?.positive, item.totals?.negative);
      return row;
    });
    const totalPos = data.reduce((s, i) => s + (i.totals?.positive || 0), 0);
    const totalNeg = data.reduce((s, i) => s + (i.totals?.negative || 0), 0);
    const totalRow = { num: '—', name: 'TOTAL' };
    visibleTauxCols.forEach((c) => {
      totalRow[c.id] = data.reduce((s, i) => s + (Number(c.getValue(i)) || 0), 0);
    });
    totalRow.taux = calcTauxExport(totalPos, totalNeg);
    rows.push(totalRow);
    return { columns: cols, rows, title: `Statistiques ${entityLabel} — Taux` };
  }

  if (statType === 'repartition' || statType === 'part_total') {
    const cols = [
      { key: 'num', label: 'N°' },
      { key: 'name', label: entityLabel },
      ...visibleEtats.map((e) => ({
        key: `etat_${e.id}`,
        label: `${e.abbreviation} %`,
      })),
      { key: 'total', label: 'TOTAL' },
    ];
    const rows = (data || []).map((item, idx) => {
      const row = { num: idx + 1, name: item.name };
      visibleEtats.forEach((e) => {
        const count = item.stats?.[e.id] || 0;
        if (statType === 'repartition') {
          row[`etat_${e.id}`] = item.total > 0 ? `${((count * 100) / item.total).toFixed(1)}%` : '0%';
        } else {
          row[`etat_${e.id}`] = total > 0 ? `${((count * 100) / total).toFixed(1)}%` : '0%';
        }
      });
      row.total = statType === 'part_total' && total > 0
        ? `${((item.total * 100) / total).toFixed(1)}%`
        : item.total;
      return row;
    });
    const totalRow = { num: '—', name: 'TOTAL' };
    visibleEtats.forEach((e) => {
      const colTotal = data.reduce((s, i) => s + (i.stats?.[e.id] || 0), 0);
      totalRow[`etat_${e.id}`] = total > 0 ? `${((colTotal * 100) / total).toFixed(1)}%` : '0%';
    });
    totalRow.total = statType === 'part_total' ? '100%' : total;
    rows.push(totalRow);
    return {
      columns: cols,
      rows,
      title: `Statistiques ${entityLabel} — ${statType === 'repartition' ? 'Répartition' : 'Part du total'}`,
    };
  }

  if (statType === 'net' || !['barres', 'camembert'].includes(statType)) {
    const cols = [
      { key: 'num', label: 'N°' },
      { key: 'name', label: entityLabel },
      ...visibleEtats.map((e) => ({ key: `etat_${e.id}`, label: e.abbreviation })),
      { key: 'total', label: 'TOTAL' },
    ];
    const rows = (data || []).map((item, idx) => {
      const row = { num: idx + 1, name: item.name };
      visibleEtats.forEach((e) => {
        row[`etat_${e.id}`] = item.stats?.[e.id] || 0;
      });
      row.total = item.total;
      return row;
    });
    const totalRow = { num: '—', name: 'TOTAL' };
    visibleEtats.forEach((e) => {
      totalRow[`etat_${e.id}`] = data.reduce((s, i) => s + (i.stats?.[e.id] || 0), 0);
    });
    totalRow.total = total;
    rows.push(totalRow);
    return { columns: cols, rows, title: `Statistiques ${entityLabel} — Chiffres` };
  }

  if (statType === 'barres' || statType === 'camembert') {
    const cols = [
      { key: 'name', label: entityLabel },
      ...visibleEtats.map((e) => ({ key: `etat_${e.id}`, label: e.abbreviation })),
      { key: 'total', label: 'TOTAL' },
    ];
    const rows = (data || []).map((item) => {
      const row = { name: item.name };
      visibleEtats.forEach((e) => {
        row[`etat_${e.id}`] = item.stats?.[e.id] || 0;
      });
      row.total = item.total;
      return row;
    });
    if (statType === 'camembert') {
      const totalRow = { name: 'TOTAL par état' };
      visibleEtats.forEach((e) => {
        totalRow[`etat_${e.id}`] = data.reduce((s, i) => s + (i.stats?.[e.id] || 0), 0);
      });
      totalRow.total = total;
      rows.push(totalRow);
    }
    return {
      columns: cols,
      rows,
      title: `Statistiques ${entityLabel} — ${statType === 'barres' ? 'Barres' : 'Camembert'}`,
    };
  }

  return { columns: [], rows: [], title: 'Statistiques' };
}

export function buildKpiExport(kpiData, visibleKpiBlocks) {
  const rows = kpiData.rows || [];
  const cols = [
    { key: 'commercial', label: 'COMMERCIAL' },
    { key: 'honore_a_suivre', label: 'HONORÉ À SUIVRE' },
    { key: 'rdv_refuse', label: 'RDV REFUSÉ' },
    { key: 'signatures', label: 'SIGNATURES' },
    { key: 'total_rdv_honores', label: 'TOTAL RDV HONORÉS' },
    { key: 'taux_r2', label: 'TAUX R2 %' },
    { key: 'taux_refuses', label: 'TAUX REFUSÉS %' },
    { key: 'taux_signes', label: 'TAUX SIGNÉS %' },
  ];
  const exportRows = rows.map((r) => ({
    commercial: String(r.commercial || '').toUpperCase(),
    honore_a_suivre: visibleKpiBlocks.honore ? r.honore_a_suivre : '',
    rdv_refuse: visibleKpiBlocks.refuse ? r.rdv_refuse : '',
    signatures: visibleKpiBlocks.signatures ? r.signatures : '',
    total_rdv_honores: r.total_rdv_honores,
    taux_r2: visibleKpiBlocks.honore ? `${r.taux_r2}%` : '',
    taux_refuses: visibleKpiBlocks.refuse ? `${r.taux_refuses}%` : '',
    taux_signes: visibleKpiBlocks.signatures ? `${r.taux_signes}%` : '',
  }));
  const activeCols = cols.filter((c) => {
    if (c.key === 'commercial' || c.key === 'total_rdv_honores') return true;
    if (c.key.startsWith('taux_')) {
      const base = c.key.replace('taux_', '');
      if (base === 'r2') return visibleKpiBlocks.honore;
      if (base === 'refuses') return visibleKpiBlocks.refuse;
      if (base === 'signes') return visibleKpiBlocks.signatures;
    }
    if (c.key === 'honore_a_suivre') return visibleKpiBlocks.honore;
    if (c.key === 'rdv_refuse') return visibleKpiBlocks.refuse;
    if (c.key === 'signatures') return visibleKpiBlocks.signatures;
    return true;
  });
  return { columns: activeCols, rows: exportRows, title: 'KPI Commerciaux' };
}

export function runStatsExport(format, payload, filenameBase) {
  const { columns, rows, title } = payload;
  if (!rows?.length) {
    alert('Aucune donnée à exporter');
    return;
  }
  const name = filenameBase || 'statistiques';
  if (format === 'csv') exportToCSV(rows, columns, name);
  else if (format === 'excel') exportToExcel(rows, columns, name);
  else if (format === 'pdf') exportToPDF(rows, columns, name, title);
}

export function printStatsArea(element) {
  if (!element) {
    window.print();
    return;
  }
  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!printWindow) {
    alert('Impossible d\'ouvrir la fenêtre d\'impression. Autorisez les pop-ups.');
    return;
  }
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('');
  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Statistiques</title>${styles}
    <style>
      body { padding: 16px; background: #fff !important; }
      .stats-context-menu, .stats-results-toolbar, .stats-column-filter-panel { display: none !important; }
      @page { size: landscape; margin: 12mm; }
    </style></head><body>${element.innerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 400);
}

export { TAUX_FIXED_COLUMNS };
