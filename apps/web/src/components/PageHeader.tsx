import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  subtitle?: ReactNode
  // Botões da página; quebram de linha no mobile em vez de estourar a tela
  actions?: ReactNode
  as?: 'h1' | 'h2'
}

export function PageHeader({ title, subtitle, actions, as: Heading = 'h1' }: PageHeaderProps) {
  const headingClass = Heading === 'h1' ? 'mb-0 text-break' : 'h4 mb-0'
  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
      <div className="min-w-0">
        <Heading className={headingClass}>{title}</Heading>
        {subtitle && <div className="text-secondary mt-1">{subtitle}</div>}
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
