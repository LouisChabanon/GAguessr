const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formatDistance(km: number): string {
  if (km === 0) return "Dans le mille";
  if (km < 1) return "<\u00a01\u00a0km";
  return `${numberFormat.format(km)}\u00a0km`;
}

export function formatScore(score: number): string {
  return numberFormat.format(score);
}

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/** Whole hours, minutes and seconds in `ms`, rounded down. */
function clockParts(ms: number): { hours: number; minutes: number; seconds: number } {
  const total = Math.floor(Math.max(0, ms) / MS_PER_SECOND);
  return {
    hours: Math.floor(total / SECONDS_PER_HOUR),
    minutes: Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    seconds: total % SECONDS_PER_MINUTE,
  };
}

/** Stopwatch display: "1:05", or "1:02:03" past an hour. */
export function formatClock(ms: number): string {
  const { hours, minutes, seconds } = clockParts(ms);
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${ss}` : `${minutes}:${ss}`;
}

/** Duration in words: "42 s", "3 min 12 s", "1 h 2 min 3 s". */
export function formatDuration(ms: number): string {
  const { hours, minutes, seconds } = clockParts(ms);
  const parts = [
    hours > 0 ? `${hours}\u00a0h` : null,
    minutes > 0 ? `${minutes}\u00a0min` : null,
    seconds > 0 || (hours === 0 && minutes === 0) ? `${seconds}\u00a0s` : null,
  ];
  return parts.filter(Boolean).join(" ");
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

const percentFormat = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

/** A 0–1 share as a whole percentage: "72 %". */
export function formatPercent(share: number): string {
  return percentFormat.format(share);
}

/** French ordinal: "1er", "2e", "13e". */
export function formatRank(rank: number): string {
  return rank === 1 ? "1er" : `${rank}e`;
}
