"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createDuel } from "@/app/actions/duel";
import { buttonClass } from "@/components/ui/button";
import { normalizeDuelCode } from "@/game/duel/code";
import { defaultDuelSettings, type DuelSettings } from "@/game/duel/settings";
import { useModeTargets } from "@/hooks/useModeTargets";
import { useOwnPseudo } from "@/hooks/useOwnPseudo";
import { usePlayerName } from "@/hooks/usePlayerName";
import { DUEL_ERROR_MESSAGES } from "@/lib/duel/messages";
import { DEFAULT_MODE, GAME_MODES, getMode } from "@/modes/registry";
import { DuelSettingsFields } from "./DuelSettingsFields";
import { PseudoField } from "./PseudoField";

/** Start page of duels: open a lobby on a mode, or join a friend's with their code. */
export function DuelLobby() {
  const router = useRouter();
  const name = usePlayerName(useOwnPseudo());
  const [modeId, setModeId] = useState(DEFAULT_MODE.id);
  const mode = getMode(modeId) ?? DEFAULT_MODE;
  const available = useModeTargets(mode)?.size ?? null;
  // Settings the host touched; the rest follow the mode's defaults, so switching mode keeps a sensible round count.
  const [chosen, setChosen] = useState<{ modeId: string; settings: DuelSettings } | null>(null);
  const settings =
    available === null ? null : chosen?.modeId === modeId ? chosen.settings : defaultDuelSettings(mode, available);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    try {
      if (!settings || !(await name.ready())) return;
      const result = await createDuel({ modeId, settings });
      if (result.ok) router.push(`/duel/${result.code}`);
      else setCreateError(DUEL_ERROR_MESSAGES[result.error]);
    } catch (error: unknown) {
      console.error("[duel] create failed", error);
      setCreateError(DUEL_ERROR_MESSAGES.unavailable);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeDuelCode(code);
    if (normalized) router.push(`/duel/${normalized}`);
    else setJoinError("Un code de duel compte 6 lettres et chiffres.");
  };

  return (
    <div className="mt-12 grid gap-12 sm:mt-16 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
      <form onSubmit={handleCreate} aria-labelledby="create-heading">
        <h2 id="create-heading" className="border-b border-line pb-3 text-xs font-medium tracking-[0.16em] text-muted uppercase">
          Lancer un duel
        </h2>
        <fieldset className="mt-2">
          <legend className="sr-only">Mode de jeu</legend>
          {GAME_MODES.map((m) => (
            <label
              key={m.id}
              data-checked={modeId === m.id}
              className="group -mx-3 flex cursor-pointer items-center gap-4 rounded-xl px-3 py-4 transition-colors duration-150 hover:bg-panel-solid data-[checked=true]:bg-panel-solid data-[checked=true]:shadow-panel"
            >
              <input
                type="radio"
                name="mode"
                value={m.id}
                checked={modeId === m.id}
                onChange={() => setModeId(m.id)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="grid size-5 shrink-0 place-items-center rounded-full border border-line transition-colors duration-150 group-hover:border-muted group-data-[checked=true]:border-accent group-data-[checked=true]:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-text"
              >
                <span className="size-1.5 rounded-full bg-accent-ink opacity-0 transition-opacity duration-150 group-data-[checked=true]:opacity-100" />
              </span>
              <span className="min-w-0 flex-1 text-xl font-semibold tracking-tight sm:text-2xl">{m.title}</span>
            </label>
          ))}
        </fieldset>

        <section aria-labelledby="settings-heading" className="mt-8 rounded-2xl border border-line p-4 sm:p-5">
          <h3 id="settings-heading" className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
            Réglages
          </h3>
          <div className="mt-4 min-h-48">
            {settings && available !== null ? (
              <DuelSettingsFields
                name="create"
                settings={settings}
                available={available}
                onChange={(next) => setChosen({ modeId, settings: next })}
              />
            ) : (
              <p className="animate-pulse text-sm text-muted">Chargement des sites…</p>
            )}
          </div>
        </section>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <PseudoField name={name} id="create-pseudo" />
          </div>
          <button type="submit" className={buttonClass("primary")} disabled={!settings || isCreating || name.draft.isPending}>
            Créer le duel
          </button>
        </div>
        {createError && (
          <p className="mt-3 text-sm text-poor" role="alert">
            {createError}
          </p>
        )}
      </form>

      <section aria-labelledby="join-heading" className="lg:pt-0">
        <h2 id="join-heading" className="border-b border-line pb-3 text-xs font-medium tracking-[0.16em] text-muted uppercase">
          Rejoindre
        </h2>
        <form onSubmit={handleJoin} className="mt-6">
          <label htmlFor="duel-code" className="text-sm font-medium">
            Code du duel
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="duel-code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setJoinError(null);
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="AB3XK9"
              aria-invalid={joinError !== null}
              aria-describedby={joinError ? "duel-code-error" : undefined}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-panel-solid px-3 font-mono text-lg tracking-[0.3em] uppercase transition-colors duration-150 placeholder:tracking-[0.3em] placeholder:text-muted/60 focus:border-accent-text focus:outline-none"
            />
            <button type="submit" className={buttonClass("secondary")}>
              Rejoindre
            </button>
          </div>
          {joinError && (
            <p id="duel-code-error" className="mt-1.5 text-sm text-poor" role="alert">
              {joinError}
            </p>
          )}
        </form>

        <ol className="mt-10 space-y-3 text-sm text-pretty text-muted">
          <li className="flex gap-3">
            <span className="font-mono text-xs text-ink tabular-nums">01</span>
            Jusqu’à {settings?.maxPlayers ?? "…"} joueurs cherchent les mêmes sites, dans le même ordre. La partie démarre quand la salle est pleine, ou quand vous la lancez.
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-xs text-ink tabular-nums">02</span>
            <span>
              Chaque manche dure au plus <span className="font-medium text-ink">{settings?.roundSeconds ?? "…"}&nbsp;s</span>. Dès que
              l’un valide, les autres n’ont plus que{" "}
              <span className="font-medium text-poor">{settings?.graceSeconds ?? "…"}&nbsp;s</span>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-xs text-ink tabular-nums">03</span>
            Le meilleur total l’emporte.
          </li>
        </ol>
      </section>
    </div>
  );
}
