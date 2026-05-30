export function isFicheAuditeeQualiteConfirmation(fiche) {
  if (fiche?.auditee === true) return true;
  const id = fiche?.id_qualite_confirmation;
  return id != null && id !== '' && Number(id) > 0;
}
