/** The one number a view leads with, e.g. 'Time asleep / 5 h 57 min'. */
export function Headline({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <div className="text-sm text-ink-2">{label}</div>
      <div className={`mt-0.5 text-4xl font-semibold tracking-tight ${muted ? 'text-muted' : 'text-ink'}`}>{value}</div>
    </div>
  )
}
