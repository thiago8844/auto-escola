import type { ComponentProps } from 'react'
import { SelectField } from '../../components/SelectField'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { usePartners } from '../../hooks/usePartners'
import { SPACE_VALUE } from '../../utils/drivingSchool'

type DrivingSchoolFieldProps = Omit<ComponentProps<typeof SelectField>, 'label' | 'children'>

// Autoescola do exame: o próprio espaço (só em autoescola) ou uma parceira
export function DrivingSchoolField(props: DrivingSchoolFieldProps) {
  const organization = useActiveOrganization()
  const isIndependent = organization.type === 'independent'
  const partners = usePartners(organization.id, { page: 1, all: true })

  return (
    <SelectField label="Autoescola do exame" {...props}>
      {isIndependent ? <option value="">{partners.isPending ? 'Carregando…' : 'Escolha a autoescola'}</option> : <option value={SPACE_VALUE}>{organization.name} (este espaço)</option>}
      {partners.data?.data.map((partner) => (
        <option key={partner.id} value={partner.id}>
          {partner.name}
        </option>
      ))}
    </SelectField>
  )
}
