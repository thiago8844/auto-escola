import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Alert, Button, Card } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { DocumentField } from '../../components/DocumentField'
import { FormField } from '../../components/FormField'
import { TimezoneField } from '../../components/TimezoneField'
import { SelectField } from '../../components/SelectField'
import { UFS } from '../../config/domain'
import { SubmitButton } from '../../components/SubmitButton'
import { ORGANIZATION_TYPE_LABELS } from '../../config/organization'
import { AlertSettingsCard } from './AlertSettingsCard'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { WeeklyHoursEditor } from '../../components/WeeklyHoursEditor'
import { useSaveBusinessHours, useUpdateOrganization } from '../../hooks/useOrganizations'
import { organizationUpdateSchema, type OrganizationUpdateInput } from '../../schemas/organization'
import { summarizeHours } from '../../utils/summarizeHours'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { canEditOrganization, canOperate } from '../../utils/permissions'

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
      address: organization.address ?? '',
      city: organization.city ?? '',
      state: organization.state ?? '',
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
            <FormField label="Endereço (opcional)" autoComplete="street-address" error={errors.address?.message} {...register('address')} />
            <FormField label="Cidade (opcional)" error={errors.city?.message} {...register('city')} />
            <SelectField label="UF (opcional)" error={errors.state?.message} {...register('state')}>
              <option value="">Não informada</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </SelectField>
            <TimezoneField current={organization.timezone} error={errors.timezone?.message} {...register('timezone')} />
            <p className="small text-secondary">O fuso define em que horário começa e termina cada dia da agenda. Todos os horários do espaço são exibidos nele.</p>
            {editable && <SubmitButton loading={update.isPending}>Salvar alterações</SubmitButton>}
          </fieldset>
        </form>

        {canOperate(organization.role) && <AlertSettingsCard organizationId={organization.id} editable={editable} />}

        <BusinessHoursCard organizationId={organization.id} hours={organization.business_hours} editable={editable} />
      </div>
    </>
  )
}

// Horário de atendimento do espaço. Sem regra, a agenda é livre e só os bloqueios restringem.
function BusinessHoursCard({ organizationId, hours, editable }: { organizationId: number; hours: Record<string, Array<{ start: string; end: string }>> | null; editable: boolean }) {
  const save = useSaveBusinessHours(organizationId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(hours ?? {})

  return (
    <Card className="mt-4">
      <Card.Body>
        <Card.Title as="h2" className="h5">
          Horário de atendimento
        </Card.Title>
        <p className="mb-2">{summarizeHours(hours)}</p>
        <p className="small text-secondary">
          {hours
            ? 'Aulas fora desse horário só entram com uma exceção justificada. Bloqueios de veículo e instrutor continuam valendo.'
            : 'Hoje a agenda é livre: qualquer horário pode receber aulas, exceto os bloqueados. Defina um horário se quiser que o sistema avise quando algo for marcado fora dele.'}
        </p>
        {editable && !editing && (
          <Button variant="outline-primary" onClick={() => { setDraft(hours ?? {}); setEditing(true) }}>
            {hours ? 'Alterar horário' : 'Definir horário de atendimento'}
          </Button>
        )}
        {editing && (
          <>
            <WeeklyHoursEditor value={draft} onChange={setDraft} />
            {save.error && (
              <Alert variant="danger" className="mt-2" role="alert">
                {save.error.message}
              </Alert>
            )}
            <div className="d-flex flex-wrap gap-2 mt-3">
              <Button disabled={save.isPending} onClick={() => save.mutate(Object.keys(draft).length ? draft : null, { onSuccess: () => setEditing(false) })}>
                Salvar horário
              </Button>
              <Button variant="outline-secondary" disabled={save.isPending} onClick={() => save.mutate(null, { onSuccess: () => { setDraft({}); setEditing(false) } })}>
                Agenda livre
              </Button>
              <Button variant="link" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  )
}
