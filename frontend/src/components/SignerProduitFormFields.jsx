import React from 'react';

const PAC_PUISSANCE_OPTIONS = [
  { value: '11 KW', label: '11 KW' },
  { value: '14 KW', label: '14 KW' },
  { value: '16 KW', label: '16 KW' },
];

/** Anciennes valeurs en base (ex. 11kw, KW 11) → libellé « 11 KW » */
const normalizePacPuissanceSelectValue = (raw) => {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const legacy = {
    '11kw': '11 KW',
    '14kw': '14 KW',
    '16kw': '16 KW',
    '11': '11 KW',
    '14': '14 KW',
    '16': '16 KW',
    kw11: '11 KW',
    kw14: '14 KW',
    kw16: '16 KW',
    'kw 11': '11 KW',
    'kw 14': '14 KW',
    'kw 16': '16 KW',
  };
  const key = s.replace(/\s+/g, ' ').trim().toLowerCase();
  const keyCompact = key.replace(/\s+/g, '');
  if (legacy[key] || legacy[keyCompact]) return legacy[key] || legacy[keyCompact];
  if (PAC_PUISSANCE_OPTIONS.some((o) => o.value === s)) return s;
  return s;
};

export function resolveSignerProduitKind(produitId, produitsList) {
  if (produitId == null || produitId === '') return null;
  const p = (produitsList || []).find((pr) => String(pr.id) === String(produitId));
  const nom = String(p?.nom || '').trim().toUpperCase();
  if (nom.includes('PV') || String(produitId) === '2') return 'pv';
  if (nom.includes('PAC') || String(produitId) === '1') return 'pac';
  return null;
}

export function SignerProduitPacPvFields({
  idPrefix,
  kind,
  etatFormData,
  setEtatFormData,
  disabled = false,
  useFormControlClass = true,
  required = false,
}) {
  if (!kind) return null;

  const inputClass = useFormControlClass ? 'form-control' : undefined;
  const patch = (fields) => setEtatFormData({ ...etatFormData, ...fields });

  if (kind === 'pac') {
    return (
      <>
        <div className="form-group">
          <label htmlFor={`${idPrefix}_ph3_rr_model_signer`}>Marque Pac :</label>
          <input
            type="text"
            id={`${idPrefix}_ph3_rr_model_signer`}
            className={inputClass}
            value={etatFormData.ph3_rr_model}
            onChange={(e) => patch({ ph3_rr_model: e.target.value })}
            disabled={disabled}
            required={required}
          />
        </div>

        <div className="form-group">
          <label htmlFor={`${idPrefix}_ph3_puissance_signer`}>Puissance :</label>
          <select
            id={`${idPrefix}_ph3_puissance_signer`}
            className={inputClass}
            value={normalizePacPuissanceSelectValue(etatFormData.ph3_puissance)}
            onChange={(e) => patch({ ph3_puissance: e.target.value })}
            disabled={disabled}
            required={required}
          >
            <option value="">Sélectionner</option>
            {PAC_PUISSANCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor={`${idPrefix}_ph3_ballon_signer`}>Ballon :</label>
          <select
            id={`${idPrefix}_ph3_ballon_signer`}
            className={inputClass}
            value={etatFormData.ph3_ballon}
            onChange={(e) => patch({ ph3_ballon: e.target.value })}
            disabled={disabled}
            required={required}
          >
            <option value="">Sélectionner</option>
            <option value="Avec Ballon">Avec Ballon</option>
            <option value="Sans Ballon">Sans Ballon</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor={`${idPrefix}_ph3_marque_ballon_signer`}>Marque ballon :</label>
          <input
            type="text"
            id={`${idPrefix}_ph3_marque_ballon_signer`}
            className={inputClass}
            value={etatFormData.ph3_marque_ballon}
            onChange={(e) => patch({ ph3_marque_ballon: e.target.value })}
            disabled={disabled}
            required={required}
          />
        </div>

        <div className="form-group">
          <label htmlFor={`${idPrefix}_ph3_alimentation_signer`}>Alimentation :</label>
          <select
            id={`${idPrefix}_ph3_alimentation_signer`}
            className={inputClass}
            value={etatFormData.ph3_alimentation}
            onChange={(e) => patch({ ph3_alimentation: e.target.value })}
            disabled={disabled}
            required={required}
          >
            <option value="">Sélectionner</option>
            <option value="mono">mono</option>
            <option value="triphase">triphase</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor={`${idPrefix}_ph3_type_signer`}>Type :</label>
          <select
            id={`${idPrefix}_ph3_type_signer`}
            className={inputClass}
            value={etatFormData.ph3_type}
            onChange={(e) => patch({ ph3_type: e.target.value })}
            disabled={disabled}
            required={required}
          >
            <option value="">Sélectionner</option>
            <option value="Bizonne">Bizonne</option>
            <option value="Basse">Basse</option>
            <option value="Haute">Haute</option>
          </select>
        </div>
      </>
    );
  }

  if (kind === 'pv') {
    return (
      <>
        <div className="form-group">
          <label htmlFor={`${idPrefix}_ph3_rr_model_signer`}>Marque PV :</label>
          <input
            type="text"
            id={`${idPrefix}_ph3_rr_model_signer`}
            className={inputClass}
            value={etatFormData.ph3_rr_model}
            onChange={(e) => patch({ ph3_rr_model: e.target.value })}
            disabled={disabled}
            required={required}
          />
        </div>

        <div className="form-group">
          <label htmlFor={`${idPrefix}_ph3_puissance_pv_signer`}>Puissance :</label>
          <select
            id={`${idPrefix}_ph3_puissance_pv_signer`}
            className={inputClass}
            value={etatFormData.ph3_puissance_pv}
            onChange={(e) => patch({ ph3_puissance_pv: e.target.value })}
            disabled={disabled}
            required={required}
          >
            <option value="">Sélectionner</option>
            <option value="4.5">4.5</option>
            <option value="6">6</option>
            <option value="9">9</option>
          </select>
        </div>
      </>
    );
  }

  return null;
}

export function SignerPacSelect({ idPrefix, value, onChange, disabled = false, useFormControlClass = true, required = false }) {
  const inputClass = useFormControlClass ? 'form-control' : undefined;
  return (
    <div className="form-group">
      <label htmlFor={`${idPrefix}_ph3_pac_signer`}>Pac :</label>
      <select
        id={`${idPrefix}_ph3_pac_signer`}
        className={inputClass}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
      >
        <option value="reau">R/EAU</option>
        <option value="rr">R/R</option>
      </select>
    </div>
  );
}

export function SignerBonusAnnonceSelect({
  idPrefix,
  kind,
  value,
  onChange,
  disabled = false,
  useFormControlClass = true,
  required = false,
}) {
  if (!kind) return null;

  const inputClass = useFormControlClass ? 'form-control' : undefined;

  return (
    <div className="form-group">
      <label htmlFor={`${idPrefix}_ph3_bonus_30_signer`}>Bonus annoncé :</label>
      <select
        id={`${idPrefix}_ph3_bonus_30_signer`}
        className={inputClass}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
      >
        <option value="">Sélectionner</option>
        {kind === 'pac' && (
          <>
            <option value="20">20</option>
            <option value="30">30</option>
            <option value="100">100</option>
          </>
        )}
        {kind === 'pv' && (
          <>
            <option value="100">100</option>
            <option value="150">150</option>
          </>
        )}
        <option value="SANS">SANS</option>
      </select>
    </div>
  );
}
