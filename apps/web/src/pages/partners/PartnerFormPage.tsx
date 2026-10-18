import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { DocumentField } from '../../components/DocumentField'
import { FormField } from '../../components/FormField'
import { PageHeader } from '../../components/PageHeader'
import { ArchiveCard } from '../../components/ArchiveCard'
import { FormErrorAlert } from '../../components/FormErrorAlert'
import { QueryState } from '../../components/QueryState'
import { SubmitButton } from '../../components/SubmitButton'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { Link } from 'react-router-dom'
import { Money } from '../finance/shared'
import { usePartnerFinance } from '../../hooks/useFinance'
import { canOperate } from '../../utils/permissions'
import { useArchive } from '../../hooks/useArchive'
import { useCreatePartner, usePartner, useUpdatePartner } from '../../hooks/usePartners'
import { partnerSchema, type PartnerInput } from '../../schemas/partner'
import type { Partner } from '../../types/partner'
import { applyFieldErrors } from '../../utils/applyFieldErrors'

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
  const update = useUpdatePartner(organization.id, String(partner?.id ?? ''), partner?.updated_at)
  const save = partner ? update : create
  const { archive } = useArchive(organization.id, 'partners')
  const finance = usePartnerFinance(organization.id, partner && canOperate(organization.role) ? partner.id : null)

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

  return (
    <>
      <PageHeader title={partner ? partner.name : 'Novo parceiro'} />

      <div className="form-narrow">
        <Alert variant="secondary">Parceiro é só um cadastro: ele não ganha conta nem acesso ao sistema.</Alert>
        <FormErrorAlert error={save.error} />

        <form onSubmit={onSubmit} noValidate>
          <FormField label="Nome" autoFocus={!partner} error={errors.name?.message} {...register('name')} />
          <DocumentField control={control} name="document" label="CPF ou CNPJ (opcional)" error={errors.document?.message} />
          <FormField label="E-mail (opcional)" type="email" error={errors.email?.message} {...register('email')} />
          <FormField label="Telefone (opcional)" type="tel" error={errors.phone?.message} {...register('phone')} />
          <SubmitButton loading={save.isPending}>{partner ? 'Salvar alterações' : 'Cadastrar parceiro'}</SubmitButton>
        </form>

        {partner && finance.data && (
          <Alert variant="light" className="border">
            <div className="fw-semibold mb-1">Financeiro com este parceiro</div>
            <div className="small">
              A receber (parceiro paga): <Money cents={finance.data.receivable.outstanding_cents} strong /> de <Money cents={finance.data.receivable.total_cents} /> · repasses a pagar: <Money cents={finance.data.payable.outstanding_cents} strong />
            </div>
            <Link to={`${organizationPaths(organization.id).financeReceivables}?q=${encodeURIComponent(partner.name)}`} className="small">Ver cobranças deste parceiro</Link>
          </Alert>
        )}

        {partner && (
          <ArchiveCard
            noun="parceiro"
            name={partner.name}
            consequences="As matrículas e aulas já registradas continuam com o histórico. Ele deixa de aparecer nas opções de novas matrículas e pode ser restaurado em Parceiros > Mostrar arquivados."
            pending={archive.isPending}
            onArchive={() => archive.mutate(partner.id, { onSuccess: () => navigate(links.partners) })}
          />
        )}
      </div>
    </>
  )
}
