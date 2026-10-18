export type Segment = { key: string; label: string; count: number; bg: string }

type Props = { segments: Segment[]; ariaLabel: string; onPick?: (key: string) => void; activeKey?: string }

// Barra empilhada com legenda clicável: a cor nunca vem sozinha, cada trecho tem nome e número
export function StackBar({ segments, ariaLabel, onPick, activeKey }: Props) {
  const total = segments.reduce((sum, s) => sum + s.count, 0)
  const visible = segments.filter((s) => s.count > 0)

  return (
    <div>
      <div className="progress" style={{ height: '1.25rem' }} role="img" aria-label={`${ariaLabel}: ${segments.map((s) => `${s.count} ${s.label}`).join(', ')}`}>
        {visible.map((s) => (
          <div key={s.key} className={`progress-bar bg-${s.bg}`} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.label}: ${s.count}`} />
        ))}
      </div>
      <ul className="list-unstyled d-flex flex-wrap gap-2 mt-2 mb-0">
        {segments.map((s) => {
          const body = (
            <>
              <span className={`d-inline-block rounded-circle bg-${s.bg} me-2`} style={{ width: '.7rem', height: '.7rem' }} aria-hidden="true" />
              {s.label} <strong className="tabular-nums ms-1">{s.count}</strong>
              {total > 0 && <span className="text-secondary ms-1 tabular-nums">({Math.round((s.count / total) * 100)}%)</span>}
            </>
          )
          return (
            <li key={s.key}>
              {onPick ? (
                <button type="button" className={`btn btn-sm ${activeKey === s.key ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => onPick(s.key)} disabled={s.count === 0}>
                  {body}
                </button>
              ) : (
                <span className="small">{body}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
