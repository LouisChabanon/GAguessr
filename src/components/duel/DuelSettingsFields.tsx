"use client";

import {
  GRACE_SECONDS_PRESETS,
  PLAYER_PRESETS,
  ROUND_SECONDS_PRESETS,
  roundCountChoices,
  withRoundSeconds,
  type DuelSettings,
} from "@/game/duel/settings";

interface DuelSettingsFieldsProps {
  /** Prefix for the radio groups' names, unique on the page. */
  name: string;
  settings: DuelSettings;
  /** Size of the mode's target pool: the most rounds a duel can have. */
  available: number;
  /** Players already seated: the room cannot shrink below them. */
  seated?: number;
  disabled?: boolean;
  onChange: (settings: DuelSettings) => void;
}

/** The host's choices for a duel: room size, how many rounds, how long each lasts, how long is left after the first lock. */
export function DuelSettingsFields({ name, settings, available, seated = 1, disabled = false, onChange }: DuelSettingsFieldsProps) {
  const roundChoices = roundCountChoices(available);
  const graceChoices = GRACE_SECONDS_PRESETS.filter((s) => s <= settings.roundSeconds);

  return (
    <div className="grid gap-5">
      <Segmented
        name={`${name}-players`}
        legend="Joueurs"
        value={settings.maxPlayers}
        choices={PLAYER_PRESETS.filter((n) => n >= seated).map((n) => ({ value: n, label: n === 2 ? "1 contre 1" : `${n}` }))}
        disabled={disabled}
        onChange={(maxPlayers) => onChange({ ...settings, maxPlayers })}
      />
      <Segmented
        name={`${name}-rounds`}
        legend="Manches"
        value={settings.rounds}
        choices={roundChoices.map((n) => ({ value: n, label: n === available && n > 1 ? `Toutes · ${n}` : String(n) }))}
        disabled={disabled}
        onChange={(rounds) => onChange({ ...settings, rounds })}
      />
      <Segmented
        name={`${name}-round`}
        legend="Temps par manche"
        value={settings.roundSeconds}
        choices={ROUND_SECONDS_PRESETS.map((s) => ({ value: s, label: `${s} s` }))}
        disabled={disabled}
        onChange={(roundSeconds) => onChange(withRoundSeconds(settings, roundSeconds))}
      />
      <Segmented
        name={`${name}-grace`}
        legend="Après la première validation"
        value={settings.graceSeconds}
        choices={graceChoices.map((s) => ({ value: s, label: `${s} s` }))}
        disabled={disabled}
        urgent
        onChange={(graceSeconds) => onChange({ ...settings, graceSeconds })}
      />
    </div>
  );
}

interface SegmentedProps {
  name: string;
  legend: string;
  value: number;
  choices: readonly { value: number; label: string }[];
  disabled: boolean;
  /** Tints the chosen chip with the "hurry" color, like the grace countdown in game. */
  urgent?: boolean;
  onChange: (value: number) => void;
}

function Segmented({ name, legend, value, choices, disabled, urgent = false, onChange }: SegmentedProps) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {choices.map((choice) => {
          const isChecked = choice.value === value;
          return (
            <label
              key={choice.value}
              data-checked={isChecked}
              data-urgent={urgent}
              className="relative cursor-pointer rounded-lg border border-line px-3 py-1.5 font-mono text-sm tabular-nums transition-[background-color,border-color,color,transform] duration-150 select-none hover:border-muted/60 active:scale-[0.97] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-text has-disabled:cursor-default has-disabled:opacity-50 data-[checked=true]:border-accent data-[checked=true]:bg-accent data-[checked=true]:font-semibold data-[checked=true]:text-accent-ink data-[urgent=true]:data-[checked=true]:border-poor data-[urgent=true]:data-[checked=true]:bg-poor data-[urgent=true]:data-[checked=true]:text-panel-solid"
            >
              <input
                type="radio"
                name={name}
                value={choice.value}
                checked={isChecked}
                onChange={() => onChange(choice.value)}
                className="sr-only"
              />
              {choice.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
