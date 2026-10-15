import { z } from "zod";

export const PSEUDO_MIN = 2;
export const PSEUDO_MAX = 20;

/** Mirrors the check on profiles.pseudo: letters, digits, spaces and _ . - */
export const pseudoSchema = z
  .string()
  .trim()
  .min(PSEUDO_MIN, `Au moins ${PSEUDO_MIN} caractères.`)
  .max(PSEUDO_MAX, `Au plus ${PSEUDO_MAX} caractères.`)
  .regex(/^[\p{L}\p{N} _.-]+$/u, "Lettres, chiffres, espaces, _ . - uniquement.");
