import type { ReactNode } from 'react'

export function RecordSection({ title, children, defaultOpen = false, count }: { title: string; children: ReactNode; defaultOpen?: boolean; count?: number }) {
  return <details className="record-section mb-4" open={defaultOpen || undefined}>
    <summary><span className="fw-semibold">{title}</span>{count !== undefined && <span className="small text-secondary ms-2">{count}</span>}</summary>
    <div className="p-3 p-lg-4">{children}</div>
  </details>
}
