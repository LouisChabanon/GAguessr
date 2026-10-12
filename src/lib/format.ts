const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatDistance(km: number): string {
  if (km === 0) return "Spot on";
  if (km < 1) return "< 1 km";
  return `${numberFormat.format(km)} km`;
}

export function formatScore(score: number): string {
  return numberFormat.format(score);
}
