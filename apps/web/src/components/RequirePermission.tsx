import { Outlet } from 'react-router-dom'
import { useActiveOrganization } from '../hooks/useActiveOrganization'
import type { Role } from '../types/organization'
import { ForbiddenNotice } from './ForbiddenNotice'

// Bloqueia a página sem chamar a API quando o papel não permite
export function RequirePermission({ allow }: { allow: (role: Role) => boolean }) {
  const organization = useActiveOrganization()
  if (!allow(organization.role)) return <ForbiddenNotice />
  return <Outlet context={organization} />
}
