import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Alert, Button, Col, Form, Modal, Row } from 'react-bootstrap'
import { useForm, useWatch } from 'react-hook-form'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { WindowFields } from '../../components/WindowFields'
import { PROCESS_TYPE_LABELS } from '../../config/domain'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useStudentEnrollments } from '../../hooks/useStudentHistory'
import { useCreateExam } from '../../hooks/useExams'
import { useInstructors } from '../../hooks/useInstructors'
import { useProcesses } from '../../hooks/useProcesses'
import { useStudents } from '../../hooks/useStudents'
import { useVehicles } from '../../hooks/useVehicles'
import { examSchema, type ExamFormInput } from '../../schemas/exam'
import type { QualificationProcess } from '../../types/process'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { todayInTimeZone, zonedTimeToIso } from '../../utils/timezone'

const SIMPLE: Record<string, string[]> = { A: ['A'], B: ['B'], AB: ['A', 'B'], AC: ['A', 'C'], AD: ['A', 'D'], AE: ['A', 'E'], C: ['C'], D: ['D'], E: ['E'], ACC: ['ACC'] }
const simpleCategories = (process: QualificationProcess | undefined) => [...new Set((process?.target_categories ?? []).flatMap((c) => SIMPLE[c] ?? [c]))]

type ExamFormModalProps = { organizationId: number; timezone: string; presetProcess?: QualificationProcess; onClose: () => void; onCreated?: (examId: number) => void }

// Agenda uma nova tentativa: aluno → processo → categoria. A numeração da tentativa é da API.
export function ExamFormModal({ organizationId, timezone, presetProcess, onClose, onCreated }: ExamFormModalProps) {
  const create = useCreateExam(organizationId)
  const [text, setText] = useState('')
  const [studentId, setStudentId] = useState(presetProcess ? String(presetProcess.student?.id ?? '') : '')
  const search = useDebouncedValue(text.trim())

  const students = useStudents(organizationId, { search, page: 1 })
  const processes = useProcesses(organizationId, { page: 1, studentId }, studentId !== '' && !presetProcess)
  const enrollments = useStudentEnrollments(organizationId, studentId)
  const instructors = useInstructors(organizationId, { page: 1, all: true, active: true })
  const vehicles = useVehicles(organizationId, { page: 1, all: true, status: 'active' })

  const openProcesses = (processes.data?.data ?? []).filter((p) => p.status !== 'completed' && p.status !== 'closed')

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ExamFormInput>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      process_id: presetProcess ? String(presetProcess.id) : '',
      category: simpleCategories(presetProcess).length === 1 ? simpleCategories(presetProcess)[0] : '',
      enrollment_id: '',
      date: todayInTimeZone(timezone),
      start_time: '',
      duration: '60',
      location: '',
      protocol: '',
      instructor_id: '',
      vehicle_id: '',
      notes: '',
    },
  })
  const [processId, category] = useWatch({ control, name: ['process_id', 'category'] })
  const process = presetProcess ?? openProcesses.find((p) => String(p.id) === processId)
  const categories = simpleCategories(process)
  const matchingEnrollments = (enrollments.data?.data ?? []).filter(
    (e) => String(e.qualification_process_id) === processId && (SIMPLE[e.category] ?? []).includes(category),
  )

  const onSubmit = handleSubmit((values) =>
    create.mutate(
      {
        qualification_process_id: Number(values.process_id),
        enrollment_id: values.enrollment_id ? Number(values.enrollment_id) : null,
        category: values.category,
        scheduled_at: zonedTimeToIso(values.date, values.start_time, timezone),
        duration_minutes: Number(values.duration),
        location: values.location || null,
        protocol: values.protocol || null,
        notes: values.notes || null,
        instructor_id: values.instructor_id ? Number(values.instructor_id) : null,
        vehicle_id: values.vehicle_id ? Number(values.vehicle_id) : null,
      },
      { onSuccess: (exam) => (onCreated ? onCreated(exam.id) : onClose()), onError: (error) => applyFieldErrors(error, setError) },
    ),
  )
  const alertMessage = formAlertMessage(create.error)

  return (
    <Modal show onHide={onClose} centered size="lg" fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Agendar exame prático
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}

          {presetProcess ? (
            <p>
              <strong>{presetProcess.student?.name}</strong> · {PROCESS_TYPE_LABELS[presetProcess.type]}
            </p>
          ) : (
            <>
              <Form.Group className="mb-3" controlId="exam-student-search">
                <Form.Label>Aluno</Form.Label>
                <Form.Control type="search" placeholder="Digite o nome para buscar" value={text} onChange={(event) => setText(event.target.value)} />
              </Form.Group>
              <Form.Group className="mb-3" controlId="exam-student">
                <Form.Label className="visually-hidden">Resultado da busca</Form.Label>
                <Form.Select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
                  <option value="">{students.isPending ? 'Buscando…' : 'Escolha o aluno'}</option>
                  {students.data?.data.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <SelectField label="Processo de habilitação" error={errors.process_id?.message} disabled={studentId === ''} {...register('process_id')}>
                <option value="">{studentId === '' ? 'Escolha o aluno primeiro' : processes.isPending ? 'Carregando…' : 'Escolha o processo'}</option>
                {openProcesses.map((p) => (
                  <option key={p.id} value={p.id}>
                    {PROCESS_TYPE_LABELS[p.type]} · {p.target_categories.join(', ')}
                  </option>
                ))}
              </SelectField>
              {studentId !== '' && processes.data && openProcesses.length === 0 && <p className="small text-secondary">Este aluno não tem processo em aberto.</p>}
            </>
          )}

          <Row>
            <Col sm={6}>
              <SelectField label="Categoria do exame" error={errors.category?.message} disabled={categories.length === 0} {...register('category')}>
                <option value="">Escolha a categoria</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
            </Col>
            <Col sm={6}>
              <SelectField label="Matrícula (opcional)" error={errors.enrollment_id?.message} {...register('enrollment_id')}>
                <option value="">Sem vínculo</option>
                {matchingEnrollments.map((e) => (
                  <option key={e.id} value={e.id}>
                    Categoria {e.category}
                  </option>
                ))}
              </SelectField>
            </Col>
          </Row>

          <WindowFields register={register} errors={errors} timeZone={timezone} />

          <FormField label="Local" error={errors.location?.message} {...register('location')} />
          <FormField label="Protocolo (opcional)" error={errors.protocol?.message} {...register('protocol')} />

          <Row>
            <Col sm={6}>
              <SelectField label="Instrutor responsável (opcional)" error={errors.instructor_id?.message} {...register('instructor_id')}>
                <option value="">Sem instrutor</option>
                {instructors.data?.data.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.full_name}
                  </option>
                ))}
              </SelectField>
            </Col>
            <Col sm={6}>
              <SelectField label="Veículo (opcional)" error={errors.vehicle_id?.message} {...register('vehicle_id')}>
                <option value="">Sem veículo</option>
                {vehicles.data?.data
                  .filter((v) => category === '' || v.category === category)
                  .map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate} · {vehicle.model}
                    </option>
                  ))}
              </SelectField>
            </Col>
          </Row>
          <p className="small text-secondary">Instrutor e veículo ficam reservados durante o exame e não podem ter aulas ou outros exames no mesmo horário.</p>
          <TextAreaField label="Observações (opcional)" error={errors.notes?.message} {...register('notes')} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={create.isPending}>Agendar exame</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
