import { useEffect } from 'react'
import { useSessionFormRecovery } from '../../hooks/useSessionFormRecovery'
import { SlotSuggestions } from '../../components/SlotSuggestions'
import { useFormProtection } from '../../hooks/useFormProtection'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from 'react-bootstrap'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EnrollmentPicker } from '../../components/EnrollmentPicker'
import { LessonBalanceNotice } from '../../components/LessonBalanceNotice'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { WindowFields } from '../../components/WindowFields'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useEnrollment } from '../../hooks/useEnrollments'
import { useInstructors } from '../../hooks/useInstructors'
import { useMyInstructor } from '../../hooks/useMe'
import { canOperate } from '../../utils/permissions'
import { useCreateLesson } from '../../hooks/useLessons'
import { useVehicles } from '../../hooks/useVehicles'
import { scheduleSchema, type ScheduleInput } from '../../schemas/lesson'
import type { Enrollment } from '../../types/enrollment'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { notify } from '../../stores/toastStore'
import { isoToZonedParts, todayInTimeZone } from '../../utils/timezone'

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
  // Instrutor do espaço agenda só para si: a lista de instrutores é da equipe
  const operate = canOperate(organization.role)
  const allInstructors = useInstructors(organization.id, { page: 1, all: true, active: true }, operate)
  const mine = useMyInstructor()
  const instructors = operate ? allInstructors : { ...mine, data: mine.data ? { data: [mine.data] } : undefined }
  const vehicles = useVehicles(organization.id, { page: 1, all: true, status: 'active' })

  const dateParam = searchParams.get('data') ?? ''
  const {
    register,
    getValues,
    reset,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ScheduleInput>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      enrollment_id: presetEnrollment ? String(presetEnrollment.id) : '',
      instructor_id: searchParams.get('instrutor') ?? '',
      vehicle_id: searchParams.get('veiculo') ?? '',
      category: '',
      override_reason: '',
      hours_override_reason: '',
      date: /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayInTimeZone(organization.timezone),
      start_time: '',
      duration: '50',
      notes: '',
    },
  })

  const [enrollmentId, vehicleId, duration, overrideReason, chosenCategory, instructorId, selectedDate, startTime] = useWatch({
    control,
    name: ['enrollment_id', 'vehicle_id', 'duration', 'override_reason', 'category', 'instructor_id', 'date', 'start_time'],
  })
  const selected = useEnrollment(organization.id, enrollmentId, enrollmentId !== '')
  const enrollment = selected.data ?? (presetEnrollment && String(presetEnrollment.id) === enrollmentId ? presetEnrollment : undefined)
  const vehicle = vehicles.data?.data.find((v) => String(v.id) === vehicleId)
  // Matrícula conjunta (AB...): a categoria vem do veículo ou é escolhida aqui
  const composite = enrollment !== undefined && enrollment.category.length > 1 && enrollment.category !== 'ACC'
  const lessonCategory = !enrollment ? null : composite ? (vehicle?.category ?? (chosenCategory || null)) : enrollment.category
  const needed = /^\d+$/.test(duration) ? Number(duration) : 0

  useSessionFormRecovery(`lesson:${organization.id}:${presetEnrollment?.id ?? 'new'}`, getValues, reset)
  const protection = useFormProtection(isDirty)
  const myInstructorId = mine.data?.id
  useEffect(() => {
    if (!operate && myInstructorId !== undefined) setValue('instructor_id', String(myInstructorId))
  }, [operate, myInstructorId, setValue])

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (lesson) => {
        protection.saved()
        lesson.warnings.forEach((warning) => notify.warning(warning.message))
        navigate(links.lesson(lesson.id))
      },
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

          {composite && !vehicle && (
            <SelectField label="Categoria da aula" error={errors.category?.message} {...register('category')}>
              <option value="">Escolha A ou B (ou um veículo)</option>
              {enrollment!.category.split('').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
          )}

          <WindowFields register={register} errors={errors} timeZone={organization.timezone} />

          {enrollment?.balance && (
            <LessonBalanceNotice
              balance={enrollment.balance}
              category={composite ? lessonCategory : null}
              needed={needed}
              overrideReason={overrideReason}
              onOverrideReasonChange={(value) => setValue('override_reason', value)}
              overrideError={errors.override_reason?.message}
            />
          )}
          {create.error?.code === 'outside_business_hours' && (
            <FormField
              label="Motivo da exceção"
              hint="Fora do horário de atendimento. Escreva o motivo e envie de novo para agendar mesmo assim; ele fica registrado."
              error={errors.hours_override_reason?.message}
              {...register('hours_override_reason')}
            />
          )}
          <TextAreaField label="Observações (opcional)" error={errors.notes?.message} {...register('notes')} />
          <SlotSuggestions organizationId={organization.id} timezone={organization.timezone} enrollmentId={enrollmentId} instructorId={instructorId} vehicleId={vehicleId} date={selectedDate} duration={duration} category={chosenCategory} fromTime={startTime} onChoose={(slot) => {
            const parts = isoToZonedParts(slot.starts_at, organization.timezone)
            setValue('date', parts.date, { shouldDirty: true })
            setValue('start_time', parts.time, { shouldDirty: true, shouldValidate: true })
          }} />
          <SubmitButton loading={create.isPending}>Agendar aula</SubmitButton>
        </form>
      </div>
    </>
  )
}
