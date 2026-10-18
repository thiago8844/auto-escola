import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { DocumentField } from '../../components/DocumentField'
import { FormField } from '../../components/FormField'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { SubmitButton } from '../../components/SubmitButton'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useCreatePartner, usePartner, useUpdatePartner } from '../../hooks/usePartners'
import { partnerSchema, type PartnerInput } from '../../schemas/partner'
import type { Partner } from '../../types/partner'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'

// Cadastro (/parceiros/novo) e edição (/parceiros/:partnerId)
export default function PartnerFormPage() {
  const { partnerId } = useParams()
  const organization = useActiveOrganization()
  const query = usePartner(organization.id, partnerId)

  if (!partnerId) return <PartnerForm />
  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(partner) => <PartnerForm partner={partner} />}
    </QueryState>
  )
}

function PartnerForm({ partner }: { partner?: Partner }) {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const navigate = useNavigate()
  const create = useCreatePartner(organization.id)
  const update = useUpdatePartner(organization.id, String(partner?.id ?? ''))
  const save = partner ? update : create

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PartnerInput>({
    resolver: zodResolver(partnerSchema),
    defaultValues: { name: partner?.name ?? '', document: partner?.document ?? '', email: partner?.email ?? '', phone: partner?.phone ?? '' },
  })

  const onSubmit = handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: () => navigate(links.partners),
      onError: (error) => applyFieldErrors(error, setError),
    }),
  )
  const alertMessage = formAlertMessage(save.error)

  return (
    <>
      <PageHeader title={partner ? partner.name : 'Novo parceiro'} />

      <div className="form-narrow">
        <Alert variant="secondary">Parceiro é só um cadastro: ele não ganha conta nem acesso ao sistema.</Alert>
        {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}

        <form onSubmit={onSubmit} noValidate>
          <FormField label="Nome" autoFocus={!partner} error={errors.name?.message} {...register('name')} />
          <DocumentField control={control} name="document" label="CPF ou CNPJ (opcional)" error={errors.document?.message} />
          <FormField label="E-mail (opcional)" type="email" error={errors.email?.message} {...register('email')} />
          <FormField label="Telefone (opcional)" type="tel" error={errors.phone?.message} {...register('phone')} />
          <SubmitButton loading={save.isPending}>{partner ? 'Salvar alterações' : 'Cadastrar parceiro'}</SubmitButton>
        </form>
      </div>
    </>
  )
}
