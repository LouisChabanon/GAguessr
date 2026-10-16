/** Six characters from an alphabet without look-alikes (0/O, 1/I/L); mirrors the check on duels.code. */
export const DUEL_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/;

/** A typed or pasted code as stored, or null if it cannot be one: "ab3 xk9" → "AB3XK9". */
export function normalizeDuelCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  return DUEL_CODE_PATTERN.test(code) ? code : null;
}
