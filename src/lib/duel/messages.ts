import type { DuelError } from "./types";

/** What to tell the player when a duel action fails. */
export const DUEL_ERROR_MESSAGES: Readonly<Record<DuelError, string>> = {
  not_found: "Ce duel n’existe pas ou a été annulé.",
  full: "Ce duel a déjà ses deux joueurs.",
  expired: "Ce lien de duel a expiré : demandez-en un nouveau.",
  pseudo_required: "Choisissez un pseudo pour que votre adversaire sache qui il affronte.",
  too_late: "Trop tard pour cette manche.",
  invalid: "Le duel est momentanément indisponible, réessayez.",
  unauthenticated: "Le duel est momentanément indisponible, réessayez.",
  unavailable: "Le duel est momentanément indisponible, réessayez.",
};
