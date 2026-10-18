import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Form } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { DocumentField } from '../../components/DocumentField'
import { FormField } from '../../components/FormField'
import { TimezoneField } from '../../components/TimezoneField'
import { SubmitButton } from '../../components/SubmitButton'
import { ORGANIZATION_TYPE_LABELS } from '../../config/organization'
import { organizationPaths } from '../../config/paths'
import { useCreateOrganization, useOrganizations } from '../../hooks/useOrganizations'
import { organizationSchema, type OrganizationInput } from '../../schemas/organization'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'

export default function OrganizationCreatePage() {
  const navigate = useNavigate()
  const { data: organizations } = useOrganizations()
  const create = useCreateOrganization()

  // Regra da API: um espaço particular por pessoa (aqui só evitamos oferecer a opção)
  const hasIndependentSpace = organizations?.data.some((o) => o.type === 'independent' && o.role === 'owner') ?? false

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<OrganizationInput>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { name: '', type: 'cfc', document: '', email: '', phone: '', timezone: 'America/Sao_Paulo' },
  })

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (organization) => navigate(organizationPaths(organization.id).home),
      onError: (error) => applyFieldErrors(error, setError),
    }),
  )
  const alertMessage = formAlertMessage(create.error)

  return (
    <>
      <h1 className="mb-4">Novo espaço</h1>

      <div className="form-narrow">
        {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}

        <form onSubmit={onSubmit} noValidate>
          <fieldset className="mb-3">
            <legend className="form-label fs-6">Tipo de espaço</legend>
            {(['cfc', 'independent'] as const).map((type) => (
              <Form.Check
                key={type}
                type="radio"
                id={`type-${type}`}
                value={type}
                label={ORGANIZATION_TYPE_LABELS[type]}
                disabled={type === 'independent' && hasIndependentSpace}
                isInvalid={!!errors.type}
                {...register('type')}
              />
            ))}
            {hasIndependentSpace && <Form.Text muted>Você já tem um espaço particular; só é possível ter um.</Form.Text>}
            {errors.type && <div className="text-danger small">{errors.type.message}</div>}
          </fieldset>

          <FormField label="Nome" autoFocus error={errors.name?.message} {...register('name')} />
          <DocumentField control={control} name="document" label="CPF ou CNPJ (opcional)" error={errors.document?.message} />
          <FormField label="E-mail de contato (opcional)" type="email" error={errors.email?.message} {...register('email')} />
          <FormField label="Telefone (opcional)" type="tel" error={errors.phone?.message} {...register('phone')} />
          <TimezoneField error={errors.timezone?.message} {...register('timezone')} />

          <SubmitButton loading={create.isPending}>Criar espaço</SubmitButton>
        </form>
      </div>
    </>
  )
}
