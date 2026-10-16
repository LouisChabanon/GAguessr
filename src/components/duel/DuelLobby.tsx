"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createDuel } from "@/app/actions/duel";
import { buttonClass } from "@/components/ui/button";
import { normalizeDuelCode } from "@/game/duel/code";
import { DUEL_GRACE_MS, DUEL_ROUND_MS } from "@/game/duel/rules";
import { useOwnPseudo } from "@/hooks/useOwnPseudo";
import { usePlayerName } from "@/hooks/usePlayerName";
import { DUEL_ERROR_MESSAGES } from "@/lib/duel/messages";
import { DEFAULT_MODE, GAME_MODES } from "@/modes/registry";
import { PseudoField } from "./PseudoField";

function roundsLabel(roundsPerGame: number | "all"): string {
  return roundsPerGame === "all" ? "Tous les sites" : `${roundsPerGame} manches`;
}

/** Start page of duels: open a lobby on a mode, or join a friend's with their code. */
export function DuelLobby() {
  const router = useRouter();
  const name = usePlayerName(useOwnPseudo());
  const [modeId, setModeId] = useState(DEFAULT_MODE.id);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    try {
      if (!(await name.ready())) return;
      const result = await createDuel(modeId);
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
          {GAME_MODES.map((mode) => (
            <label
              key={mode.id}
              data-checked={modeId === mode.id}
              className="group -mx-3 flex cursor-pointer items-center gap-4 rounded-xl px-3 py-4 transition-colors duration-150 hover:bg-panel-solid data-[checked=true]:bg-panel-solid data-[checked=true]:shadow-panel"
            >
              <input
                type="radio"
                name="mode"
                value={mode.id}
                checked={modeId === mode.id}
                onChange={() => setModeId(mode.id)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="grid size-5 shrink-0 place-items-center rounded-full border border-line transition-colors duration-150 group-hover:border-muted group-data-[checked=true]:border-accent group-data-[checked=true]:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-text"
              >
                <span className="size-1.5 rounded-full bg-accent-ink opacity-0 transition-opacity duration-150 group-data-[checked=true]:opacity-100" />
              </span>
              <span className="min-w-0 flex-1 text-xl font-semibold tracking-tight sm:text-2xl">{mode.title}</span>
              <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
                {roundsLabel(mode.roundsPerGame)}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <PseudoField name={name} id="create-pseudo" />
          </div>
          <button type="submit" className={buttonClass("primary")} disabled={isCreating || name.draft.isPending}>
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

        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm">
          <div className="bg-surface p-4">
            <dt className="text-muted">Par manche</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">
              {DUEL_ROUND_MS / 1000}
              <span className="ml-0.5 font-sans text-base font-medium text-muted">s</span>
            </dd>
          </div>
          <div className="bg-surface p-4">
            <dt className="text-muted">Après l’adversaire</dt>
            <dd className="mt-1 font-mono text-2xl font-semibold text-poor tabular-nums">
              {DUEL_GRACE_MS / 1000}
              <span className="ml-0.5 font-sans text-base font-medium">s</span>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-pretty text-muted">
          Mêmes sites pour les deux joueurs. Dès que l’un valide, l’autre n’a plus que {DUEL_GRACE_MS / 1000} secondes. Le
          meilleur total l’emporte.
        </p>
      </section>
    </div>
  );
}
