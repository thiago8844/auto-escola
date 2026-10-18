import { Link, useLocation, type LinkProps } from 'react-router-dom'

export function RecordLink({ returnLabel = 'Voltar ao registro anterior', ...props }: LinkProps & { returnLabel?: string }) {
  const location = useLocation()
  return <Link {...props} state={{ returnTo: location.pathname + location.search, returnLabel }} />
}

export function RecordReturn({ organizationId }: { organizationId: number }) {
  const location = useLocation()
  const { returnTo, returnLabel } = (location.state ?? {}) as { returnTo?: string; returnLabel?: string }
  if (typeof returnTo !== 'string' || !returnTo.startsWith(`/espacos/${organizationId}/`) || returnTo === location.pathname + location.search) return null
  return <Link to={returnTo} className="d-inline-block mb-3 small"><i className="bi bi-arrow-left me-1" aria-hidden="true" />{returnLabel ?? 'Voltar ao registro anterior'}</Link>
}
