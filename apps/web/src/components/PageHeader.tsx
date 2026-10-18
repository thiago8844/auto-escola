import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

type PageHeaderProps = {
  title: string
  subtitle?: ReactNode
  // Botões da página; quebram de linha no mobile em vez de estourar a tela
  actions?: ReactNode
  as?: 'h1' | 'h2'
}

// Telas de detalhe (ex.: /espacos/1/agenda/12) ganham o botão voltar ao lado do título
const DETAIL_SEGMENTS = 3

export function PageHeader({ title, subtitle, actions, as: Heading = 'h1' }: PageHeaderProps) {
  const headingClass = Heading === 'h1' ? 'mb-0 text-break' : 'h4 mb-0'
  const navigate = useNavigate()
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)
  const isDetail = segments[0] === 'espacos' && segments.length > DETAIL_SEGMENTS
  // Com histórico do app, volta de onde veio; em link direto, sobe um nível da rota
  const hasHistory = location.key !== 'default'
  const goBack = () => (hasHistory ? navigate(-1) : navigate(`/${segments.slice(0, -1).join('/')}`))

  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
      <div className="d-flex align-items-start gap-2 min-w-0">
        {isDetail && (
          <button type="button" className="btn btn-link p-1 text-body flex-shrink-0 lh-1 mt-1" aria-label="Voltar" title="Voltar" onClick={goBack}>
            <i className="bi bi-arrow-left fs-4" aria-hidden="true" />
          </button>
        )}
        <div className="min-w-0">
          <Heading className={headingClass}>{title}</Heading>
          {subtitle && <div className="text-secondary mt-1">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
