import { Link, Outlet, useParams } from 'react-router-dom'
import { Alert, Spinner } from 'react-bootstrap'
import { QueryErrorAlert } from '../components/QueryErrorAlert'
import { RoleBadge } from '../components/RoleBadge'
import { organizationPaths, paths } from '../config/paths'
import { useOrganization } from '../hooks/useOrganizations'
import { canManageMembers } from '../utils/permissions'
import { AppLayout } from './AppLayout'

// Layout de /espacos/:organizationId. Carrega o espaço e só mostra as páginas se ele existir.
export function OrganizationLayout() {
  const { organizationId = '' } = useParams()
  const { data: organization, error, refetch } = useOrganization(organizationId)
  const links = organizationPaths(organizationId)

  const navItems = [
    { to: links.home, icon: 'bi-speedometer2', label: 'Início', end: true },
    { to: links.students, icon: 'bi-mortarboard', label: 'Alunos' },
    ...(organization && canManageMembers(organization.role)
      ? [
          { to: links.members, icon: 'bi-people', label: 'Membros' },
          { to: links.invitations, icon: 'bi-envelope-plus', label: 'Convites' },
        ]
      : []),
    { to: links.settings, icon: 'bi-gear', label: 'Configurações' },
  ]

  const sidebarHeader = (
    <>
      <div className="fw-semibold text-truncate" title={organization?.name}>
        {organization?.name ?? 'Carregando…'}
      </div>
      {organization && (
        <div className="mt-1">
          <RoleBadge role={organization.role} />
        </div>
      )}
      <Link to={paths.organizations} className="small d-inline-block mt-2">
        <i className="bi bi-arrow-left-right me-1" aria-hidden="true" />
        Trocar espaço
      </Link>
    </>
  )

  let content
  if (organization) {
    content = <Outlet context={organization} />
  } else if (error?.kind === 'not_found') {
    content = (
      <Alert variant="warning" role="alert">
        Espaço não encontrado ou sem acesso. <Link to={paths.organizations}>Voltar para meus espaços</Link>
      </Alert>
    )
  } else if (error) {
    content = <QueryErrorAlert error={error} onRetry={() => void refetch()} />
  } else {
    content = (
      <div className="text-center py-5">
        <Spinner animation="border" role="status" variant="primary">
          <span className="visually-hidden">Carregando espaço…</span>
        </Spinner>
      </div>
    )
  }

  return (
    <AppLayout navItems={navItems} sidebarHeader={sidebarHeader}>
      {content}
    </AppLayout>
  )
}
