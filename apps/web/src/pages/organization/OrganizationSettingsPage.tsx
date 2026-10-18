import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { DocumentField } from '../../components/DocumentField'
import { FormField } from '../../components/FormField'
import { TimezoneField } from '../../components/TimezoneField'
import { SubmitButton } from '../../components/SubmitButton'
import { ORGANIZATION_TYPE_LABELS } from '../../config/organization'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useUpdateOrganization } from '../../hooks/useOrganizations'
import { organizationUpdateSchema, type OrganizationUpdateInput } from '../../schemas/organization'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { canEditOrganization } from '../../utils/permissions'

export default function OrganizationSettingsPage() {
  const organization = useActiveOrganization()
  const editable = canEditOrganization(organization.role)
  const update = useUpdateOrganization(organization.id)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<OrganizationUpdateInput>({
    resolver: zodResolver(organizationUpdateSchema),
    // `values` mantém o formulário em sincronia com o espaço salvo
    values: {
      name: organization.name,
      document: organization.document ?? '',
      email: organization.email ?? '',
      phone: organization.phone ?? '',
      timezone: organization.timezone,
    },
  })

  const onSubmit = handleSubmit((values) => update.mutate(values, { onError: (error) => applyFieldErrors(error, setError) }))
  const alertMessage = formAlertMessage(update.error)

  return (
    <>
      <h1 className="mb-1">Configurações</h1>
      <p className="text-secondary mb-4">{ORGANIZATION_TYPE_LABELS[organization.type]}</p>

      <div className="form-narrow">
        {!editable && <Alert variant="info">Somente proprietários e gestores podem alterar os dados do espaço.</Alert>}
        {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}
        {update.isSuccess && <Alert variant="success">Dados atualizados.</Alert>}

        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={!editable}>
            <FormField label="Nome" error={errors.name?.message} {...register('name')} />
            <DocumentField control={control} name="document" label="CPF ou CNPJ" error={errors.document?.message} />
            <FormField label="E-mail de contato" type="email" error={errors.email?.message} {...register('email')} />
            <FormField label="Telefone" type="tel" error={errors.phone?.message} {...register('phone')} />
            <TimezoneField current={organization.timezone} error={errors.timezone?.message} {...register('timezone')} />
            <p className="small text-secondary">O fuso define em que horário começa e termina cada dia da agenda. Todos os horários do espaço são exibidos nele.</p>
            {editable && <SubmitButton loading={update.isPending}>Salvar alterações</SubmitButton>}
          </fieldset>
        </form>
      </div>
    </>
  )
}
