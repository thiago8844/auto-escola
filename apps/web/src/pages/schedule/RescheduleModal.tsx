import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Modal } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { SubmitButton } from '../../components/SubmitButton'
import { WindowFields } from '../../components/WindowFields'
import { useRescheduleLesson } from '../../hooks/useLessons'
import { rescheduleSchema, type RescheduleInput } from '../../schemas/lesson'
import type { Lesson } from '../../types/lesson'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { isoToZonedParts } from '../../utils/timezone'

type RescheduleModalProps = { organizationId: number; timeZone: string; lesson: Lesson; onClose: () => void }

export function RescheduleModal({ organizationId, timeZone, lesson, onClose }: RescheduleModalProps) {
  const reschedule = useRescheduleLesson(organizationId, String(lesson.id), timeZone)
  const start = isoToZonedParts(lesson.starts_at, timeZone)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RescheduleInput>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: { date: start.date, start_time: start.time, duration: String(lesson.scheduled_minutes) },
  })

  const onSubmit = handleSubmit((values) =>
    reschedule.mutate(values, { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) }),
  )
  const alertMessage = formAlertMessage(reschedule.error)

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Remarcar aula
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              <i className="bi bi-calendar-x me-2" aria-hidden="true" />
              {alertMessage}
            </Alert>
          )}
          <WindowFields register={register} errors={errors} timeZone={timeZone} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={reschedule.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={reschedule.isPending}>Remarcar</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
