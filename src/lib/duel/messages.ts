import type { DuelError } from "./types";

/** What to tell the player when a duel action fails. */
export const DUEL_ERROR_MESSAGES: Readonly<Record<DuelError, string>> = {
  not_found: "Ce duel n’existe pas ou a été annulé.",
  full: "Ce duel est complet.",
  expired: "Ce lien de duel a expiré : demandez-en un nouveau.",
  started: "La partie a déjà commencé.",
  too_many_players: "Il y a déjà plus de joueurs dans la salle.",
  not_enough_players: "Il faut au moins deux joueurs pour lancer la partie.",
  pseudo_required: "Choisissez un pseudo pour que votre adversaire sache qui il affronte.",
  too_late: "Trop tard pour cette manche.",
  invalid: "Le duel est momentanément indisponible, réessayez.",
  unauthenticated: "Le duel est momentanément indisponible, réessayez.",
  unavailable: "Le duel est momentanément indisponible, réessayez.",
};
