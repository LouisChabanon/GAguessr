export function MapLoading() {
  return (
    <div className="absolute inset-0 grid place-items-center" role="status">
      <p className="animate-pulse text-sm text-muted">Chargement de la carte…</p>
    </div>
  );
}
