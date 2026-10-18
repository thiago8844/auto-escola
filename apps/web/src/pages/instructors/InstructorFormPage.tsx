import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Alert, Button, Card, Form } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { AffectedModal } from '../../components/AffectedModal'
import { ConfirmModal } from '../../components/ConfirmModal'
import { FormField } from '../../components/FormField'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { LinkStatusBadge } from '../../components/StatusBadges'
import { SubmitButton } from '../../components/SubmitButton'
import { LICENSE_CATEGORIES } from '../../config/domain'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useCreateInstructor, useInstructor, useSetInstructorLink, useUpdateInstructor } from '../../hooks/useInstructors'
import { instructorSchema, type InstructorInput } from '../../schemas/instructor'
import type { Commitment } from '../../types/availability'
import type { Instructor } from '../../types/instructor'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { InstructorAvailabilityPanel } from './InstructorAvailabilityPanel'

// Cadastro (/instrutores/novo) e detalhe/edição (/instrutores/:instructorId)
export default function InstructorFormPage() {
  const { instructorId } = useParams()
  const organization = useActiveOrganization()
  const query = useInstructor(organization.id, instructorId)

  if (!instructorId) return <InstructorForm />
  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(instructor) => <InstructorForm instructor={instructor} />}
    </QueryState>
  )
}

function InstructorForm({ instructor }: { instructor?: Instructor }) {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const navigate = useNavigate()
  const create = useCreateInstructor(organization.id)
  const update = useUpdateInstructor(organization.id, String(instructor?.id ?? ''))
  const link = useSetInstructorLink(organization.id, String(instructor?.id ?? ''))
  const save = instructor ? update : create
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [affected, setAffected] = useState<Commitment[] | null>(null)

  // Identidade de instrutor com conta só ele altera, em /me/instructor
  const identityLocked = instructor?.has_account === true
  const active = instructor?.active !== false

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<InstructorInput>({
    resolver: zodResolver(instructorSchema),
    defaultValues: {
      full_name: instructor?.full_name ?? '',
      credential_number: instructor?.credential_number ?? '',
      categories: instructor?.categories ?? [],
    },
  })

  const onSubmit = handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: (saved) => navigate(links.instructor(saved.id)),
      onError: (error) => applyFieldErrors(error, setError),
    }),
  )
  const alertMessage = formAlertMessage(save.error)

  return (
    <>
      <PageHeader title={instructor ? instructor.full_name : 'Novo instrutor'} />

      <div className="form-narrow">
        {identityLocked && (
          <Alert variant="info">
            <i className="bi bi-lock-fill me-2" aria-hidden="true" />
            Este instrutor tem conta própria. Só ele altera nome, credencial e categorias, no próprio perfil.
          </Alert>
        )}
        {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}

        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={identityLocked}>
            <FormField label="Nome completo" autoFocus={!instructor} error={errors.full_name?.message} {...register('full_name')} />
            <FormField label="Número da credencial (opcional)" error={errors.credential_number?.message} {...register('credential_number')} />
            <fieldset className="mb-3">
              <legend className="form-label fs-6">Categorias que habilita</legend>
              <div className="d-flex flex-wrap gap-3">
                {LICENSE_CATEGORIES.map((category) => (
                  <Form.Check key={category} type="checkbox" id={`category-${category}`} label={category} value={category} {...register('categories')} />
                ))}
              </div>
              <Form.Text muted>Sem categorias, o instrutor não é bloqueado por categoria de veículo.</Form.Text>
            </fieldset>
            {!identityLocked && <SubmitButton loading={save.isPending}>{instructor ? 'Salvar alterações' : 'Cadastrar instrutor'}</SubmitButton>}
          </fieldset>
        </form>

        {instructor && (
          <Card className="mt-4">
            <Card.Body>
              <Card.Title as="h2" className="h5 d-flex align-items-center gap-2">
                Vínculo com este espaço <LinkStatusBadge active={active} />
              </Card.Title>
              <p className="small text-secondary">
                {active
                  ? 'Desativar impede agendar novas aulas com este instrutor. As aulas já agendadas continuam.'
                  : 'Instrutor desativado não aparece nas opções de agendamento. As aulas antigas continuam visíveis.'}
              </p>
              <Button
                variant={active ? 'outline-danger' : 'outline-success'}
                className="w-100"
                disabled={link.isPending}
                onClick={() => (active ? setConfirmDeactivate(true) : link.mutate(true))}
              >
                {active ? 'Desativar vínculo' : 'Ativar vínculo'}
              </Button>
            </Card.Body>
          </Card>
        )}
      </div>

      {instructor && active && (
        <div className="mw-100">
          <InstructorAvailabilityPanel organization={organization} instructorId={instructor.id} />
        </div>
      )}

      <ConfirmModal
        show={confirmDeactivate}
        title="Desativar vínculo"
        confirmLabel="Desativar"
        pending={link.isPending}
        onConfirm={() =>
          link.mutate(false, {
            onSuccess: (saved) => saved.affected.length > 0 && setAffected(saved.affected),
            onSettled: () => setConfirmDeactivate(false),
          })
        }
        onCancel={() => setConfirmDeactivate(false)}
      >
        {instructor?.full_name} não poderá receber novas aulas neste espaço. As aulas já agendadas não são canceladas: se houver alguma, você verá a lista para escolher uma providência.
      </ConfirmModal>

      {affected && instructor && (
        <AffectedModal
          organizationId={organization.id}
          timezone={organization.timezone}
          title="Vínculo desativado"
          summary={`${instructor.full_name} não recebe mais novas aulas neste espaço.`}
          commitments={affected}
          onClose={() => setAffected(null)}
        />
      )}
    </>
  )
}
