import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from 'react-bootstrap'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EnrollmentPicker } from '../../components/EnrollmentPicker'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { WindowFields } from '../../components/WindowFields'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useEnrollment } from '../../hooks/useEnrollments'
import { useInstructors } from '../../hooks/useInstructors'
import { useCreateLesson } from '../../hooks/useLessons'
import { useVehicles } from '../../hooks/useVehicles'
import { scheduleSchema, type ScheduleInput } from '../../schemas/lesson'
import type { Enrollment } from '../../types/enrollment'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { todayInTimeZone } from '../../utils/timezone'

// /agenda/nova, opcionalmente com ?matricula=ID (vem do detalhe da matrícula) e ?data=YYYY-MM-DD
export default function LessonFormPage() {
  const organization = useActiveOrganization()
  const [searchParams] = useSearchParams()
  const enrollmentId = searchParams.get('matricula') ?? ''
  const preset = useEnrollment(organization.id, enrollmentId, enrollmentId !== '')

  if (enrollmentId === '') return <LessonForm />
  return (
    <QueryState query={preset} isEmpty={() => false} empty={null}>
      {(enrollment) => <LessonForm presetEnrollment={enrollment} />}
    </QueryState>
  )
}

function LessonForm({ presetEnrollment }: { presetEnrollment?: Enrollment }) {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const create = useCreateLesson(organization.id, organization.timezone)

  // Só instrutor com vínculo ativo e veículo ativo aparecem nas opções
  const instructors = useInstructors(organization.id, { page: 1, all: true, active: true })
  const vehicles = useVehicles(organization.id, { page: 1, all: true, status: 'active' })

  const dateParam = searchParams.get('data') ?? ''
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ScheduleInput>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      enrollment_id: presetEnrollment ? String(presetEnrollment.id) : '',
      instructor_id: '',
      vehicle_id: '',
      date: /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayInTimeZone(organization.timezone),
      start_time: '',
      duration: '50',
      notes: '',
    },
  })

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (lesson) => navigate(links.lesson(lesson.id)),
      onError: (error) => applyFieldErrors(error, setError),
    }),
  )
  // Conflitos (instrutor, veículo ou aluno ocupados) chegam como mensagem do formulário
  const alertMessage = formAlertMessage(create.error)

  return (
    <>
      <PageHeader title="Agendar aula" />

      <div className="form-narrow">
        {alertMessage && (
          <Alert variant="danger" role="alert">
            <i className="bi bi-calendar-x me-2" aria-hidden="true" />
            {alertMessage}
          </Alert>
        )}

        <form onSubmit={onSubmit} noValidate>
          {presetEnrollment ? (
            <p>
              <strong>{presetEnrollment.student?.name}</strong> · Categoria {presetEnrollment.category}{' '}
              <Link to={links.scheduleNew()} className="small">
                trocar
              </Link>
            </p>
          ) : (
            <Controller
              control={control}
              name="enrollment_id"
              render={({ field }) => <EnrollmentPicker value={field.value} onChange={field.onChange} error={errors.enrollment_id?.message} />}
            />
          )}

          <SelectField label="Instrutor" error={errors.instructor_id?.message} {...register('instructor_id')}>
            <option value="">{instructors.isPending ? 'Carregando…' : 'Escolha o instrutor'}</option>
            {instructors.data?.data.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.full_name}
              </option>
            ))}
          </SelectField>
          {instructors.error && <p className="small text-danger">{instructors.error.message}</p>}

          <SelectField label="Veículo (opcional)" error={errors.vehicle_id?.message} {...register('vehicle_id')}>
            <option value="">Sem veículo</option>
            {vehicles.data?.data.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plate} · {vehicle.model} ({vehicle.category})
              </option>
            ))}
          </SelectField>
          {vehicles.error && <p className="small text-danger">{vehicles.error.message}</p>}

          <WindowFields register={register} errors={errors} timeZone={organization.timezone} />
          <TextAreaField label="Observações (opcional)" error={errors.notes?.message} {...register('notes')} />
          <SubmitButton loading={create.isPending}>Agendar aula</SubmitButton>
        </form>
      </div>
    </>
  )
}
