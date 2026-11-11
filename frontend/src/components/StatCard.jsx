export default function StatCard({ label, value, note, icon: Icon, muted = false }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-500 sm:text-sm">{label}</p>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pilot-50 text-pilot-600">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className={`mt-3 text-xl font-bold tracking-tight sm:text-2xl ${muted ? 'text-ink-300' : 'text-ink-950'}`}>
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-ink-400">{note}</p>}
    </div>
  );
}
