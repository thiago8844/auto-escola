import { useOutletContext } from 'react-router-dom'
import type { Organization } from '../types/organization'

// Espaço da URL (/espacos/:organizationId), já carregado pelo OrganizationLayout
export function useActiveOrganization(): Organization {
  return useOutletContext<Organization>()
}
