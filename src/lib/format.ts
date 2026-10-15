const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formatDistance(km: number): string {
  if (km === 0) return "Dans le mille";
  if (km < 1) return "<\u00a01\u00a0km";
  return `${numberFormat.format(km)}\u00a0km`;
}

export function formatScore(score: number): string {
  return numberFormat.format(score);
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatDate(date: Date): string {
  return dateFormat.format(date);
}
