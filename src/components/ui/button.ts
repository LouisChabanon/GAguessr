type ButtonVariant = "primary" | "secondary" | "ghost";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium select-none " +
  "transition-[background-color,color,transform,box-shadow] duration-150 active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-40";

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary: "h-11 px-5 bg-accent text-accent-ink shadow-panel hover:bg-accent-hover",
  secondary: "h-11 px-5 bg-panel-solid text-ink border border-line hover:border-muted/50",
  ghost: "h-9 px-3 text-muted hover:text-ink hover:bg-line/60",
};

export function buttonClass(variant: ButtonVariant, extra = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}
