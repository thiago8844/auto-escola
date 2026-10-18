import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Modal } from 'react-bootstrap'
import { useForm, useWatch } from 'react-hook-form'
import { FormField } from '../../components/FormField'
import { ReleasePanel } from '../../components/ReleasePanel'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { useChangeLessonStatus } from '../../hooks/useLessons'
import { lessonStatusSchema, type LessonStatusInput } from '../../schemas/lesson'
import type { PracticeRelease } from '../../types/enrollment'
import type { Lesson } from '../../types/lesson'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'

type StatusModalProps = {
  organizationId: number
  lesson: Lesson
  // Instrutor só marca realizada ou falta; cancelar é da equipe
  canCancel: boolean
  release?: PracticeRelease
  onClose: () => void
}

export function StatusModal({ organizationId, lesson, canCancel, release, onClose }: StatusModalProps) {
  const change = useChangeLessonStatus(organizationId, String(lesson.id))
  const practiceBlocked = release !== undefined && !release.released

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LessonStatusInput>({
    resolver: zodResolver(lessonStatusSchema),
    defaultValues: { status: practiceBlocked ? 'missed' : 'completed', reason: '', actual_minutes: '', evolution: '', notes: '' },
  })
  const status = useWatch({ control, name: 'status' })

  const onSubmit = handleSubmit((values) =>
    change.mutate(values, { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) }),
  )
  const alertMessage = formAlertMessage(change.error)

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Alterar situação da aula
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}

          {practiceBlocked && release && (
            <div className="mb-3">
              <ReleasePanel release={release} />
            </div>
          )}

          <SelectField label="Nova situação" error={errors.status?.message} {...register('status')}>
            <option value="completed" disabled={practiceBlocked}>
              Realizada{practiceBlocked ? ' (bloqueada: prática não liberada)' : ''}
            </option>
            <option value="missed">Falta do aluno</option>
            {canCancel && <option value="cancelled">Cancelada</option>}
          </SelectField>

          {status === 'completed' ? (
            <>
              <FormField label="Duração real em minutos (opcional)" inputMode="numeric" hint="Se vazio, vale a duração agendada." error={errors.actual_minutes?.message} {...register('actual_minutes')} />
              <TextAreaField label="Evolução do aluno (opcional)" error={errors.evolution?.message} {...register('evolution')} />
            </>
          ) : (
            <FormField label="Motivo (opcional)" error={errors.reason?.message} {...register('reason')} />
          )}
          <TextAreaField label="Observações (opcional)" error={errors.notes?.message} {...register('notes')} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={change.isPending}>
            Voltar
          </Button>
          <SubmitButton loading={change.isPending}>Confirmar</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
