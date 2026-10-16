"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import type { DuelSettings } from "@/game/duel/settings";
import type { UseDuel } from "@/hooks/useDuel";
import { useModeTargets } from "@/hooks/useModeTargets";
import { playerName } from "@/lib/duel/colors";
import { DUEL_ERROR_MESSAGES } from "@/lib/duel/messages";
import type { DuelView } from "@/lib/duel/types";
import type { GameMode } from "@/modes/types";
import { DuelRules } from "./DuelRules";
import { DuelScreen, Eyebrow } from "./DuelScreen";
import { DuelSettingsFields } from "./DuelSettingsFields";
import { PlayerList } from "./PlayerList";

const COPIED_FEEDBACK_MS = 2_000;

interface DuelWaitingRoomProps {
  duel: UseDuel;
  view: DuelView;
  mode: GameMode;
}

/**
 * A lobby, for those seated in it: the code to share and who has joined. The host can change the
 * settings and start early; the game starts on its own once the room is full.
 */
export function DuelWaitingRoom({ duel, view, mode }: DuelWaitingRoomProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const host = view.players.find((p) => p.isHost);
  const canStart = view.isHost && view.players.length >= 2;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch (error: unknown) {
      console.warn("[duel] clipboard unavailable", error);
    }
  };

  const handleLeave = async () => {
    if (await duel.leave()) router.push("/duel");
  };

  return (
    <DuelScreen labelledBy="waiting-heading" testId="duel-waiting">
      <Eyebrow>Duel · {mode.title}</Eyebrow>
      <h1 id="waiting-heading" className="mt-3 text-2xl font-semibold tracking-tight">
        {view.isHost ? "Invitez vos adversaires" : "Vous êtes dans la salle"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {view.isHost
          ? "Envoyez-leur ce code ou le lien de cette page."
          : `La partie démarre quand ${host ? playerName(host) : "l’hôte"} la lance ou quand la salle est pleine.`}
      </p>

      <div className="mt-5 flex items-stretch gap-2">
        <p
          className="flex-1 rounded-2xl border border-dashed border-line py-3 text-center font-mono text-3xl font-semibold tracking-[0.3em] select-all sm:text-4xl"
          data-testid="duel-code"
          aria-label={`Code du duel : ${view.code.split("").join(" ")}`}
        >
          {view.code}
        </p>
        <button type="button" className={buttonClass("secondary", "h-auto whitespace-nowrap")} onClick={copyLink}>
          {copied ? "Copié" : "Copier le lien"}
        </button>
      </div>

      <div className="mt-6">
        <PlayerList players={view.players} maxPlayers={view.maxPlayers} />
      </div>

      <div className="mt-6">{view.isHost ? <HostSettings duel={duel} view={view} mode={mode} /> : <DuelRules view={view} />}</div>

      {duel.error && (
        <p className="mt-3 text-sm text-poor" role="alert">
          {DUEL_ERROR_MESSAGES[duel.error]}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" className={buttonClass("ghost", "sm:-ml-3")} disabled={duel.isBusy} onClick={handleLeave}>
          {view.isHost ? "Annuler la partie" : "Quitter la salle"}
        </button>
        {view.isHost && (
          <button type="button" className={buttonClass("primary")} disabled={!canStart || duel.isBusy} onClick={() => void duel.start()}>
            {canStart ? `Lancer à ${view.players.length}` : "En attente de joueurs…"}
          </button>
        )}
      </div>
    </DuelScreen>
  );
}

/** The host's settings: a summary, editable until the game starts. */
function HostSettings({ duel, view, mode }: DuelWaitingRoomProps) {
  const available = useModeTargets(mode)?.size ?? null;
  const [isEditing, setIsEditing] = useState(false);
  // Shown while a change is being saved, so the chosen chip moves at once.
  const [saving, setSaving] = useState<DuelSettings | null>(null);
  const settings = saving ?? {
    maxPlayers: view.maxPlayers,
    rounds: view.roundCount,
    roundSeconds: view.roundSeconds,
    graceSeconds: view.graceSeconds,
  };

  const handleChange = async (next: DuelSettings) => {
    setSaving(next);
    try {
      await duel.configure(next);
    } finally {
      setSaving(null);
    }
  };

  return (
    <section aria-labelledby="waiting-settings-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="waiting-settings-heading" className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
          Réglages
        </h2>
        <button
          type="button"
          className={buttonClass("ghost", "-mr-3 h-8")}
          aria-expanded={isEditing}
          aria-controls="waiting-settings"
          onClick={() => setIsEditing((open) => !open)}
        >
          {isEditing ? "Terminé" : "Modifier"}
        </button>
      </div>
      <div id="waiting-settings" className="mt-2">
        {isEditing && available !== null ? (
          <DuelSettingsFields
            name="waiting"
            settings={settings}
            available={available}
            seated={view.players.length}
            disabled={saving !== null}
            onChange={handleChange}
          />
        ) : (
          <DuelRules view={{ maxPlayers: settings.maxPlayers, roundCount: settings.rounds, roundSeconds: settings.roundSeconds, graceSeconds: settings.graceSeconds }} />
        )}
      </div>
    </section>
  );
}
