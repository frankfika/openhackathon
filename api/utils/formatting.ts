export function formatReceiptIssuedAt(issuedAtIso: string): string {
  const date = new Date(issuedAtIso);
  if (Number.isNaN(date.getTime())) return issuedAtIso;
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC');
}
