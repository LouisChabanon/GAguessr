import type { DuelView } from "@/lib/duel/types";

type RulesInput = Pick<DuelView, "maxPlayers" | "roundCount" | "roundSeconds" | "graceSeconds">;

/** A lobby's settings at a glance. */
export function DuelRules({ view }: { view: RulesInput }) {
  const items = [
    { label: "Joueurs", value: view.maxPlayers, unit: "max" },
    { label: "Manches", value: view.roundCount, unit: "" },
    { label: "Par manche", value: view.roundSeconds, unit: "s" },
    { label: "Ensuite", value: view.graceSeconds, unit: "s", isUrgent: true },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px sm:grid-cols-4 overflow-hidden rounded-2xl border border-line bg-line" data-testid="duel-rules">
      {items.map((item) => (
        <div key={item.label} className="bg-panel-solid px-3 py-2.5">
          <dt className="truncate text-xs text-muted">{item.label}</dt>
          <dd className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${item.isUrgent ? "text-poor" : ""}`}>
            {item.value}
            {item.unit && <span className="ml-0.5 font-sans text-xs font-medium">{item.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
