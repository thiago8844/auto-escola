import { useEffect, useState } from 'react'
import { Form } from 'react-bootstrap'
import { ENROLLMENT_STATUS } from '../config/domain'
import { useActiveOrganization } from '../hooks/useActiveOrganization'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useStudentEnrollments } from '../hooks/useStudentHistory'
import { useStudents } from '../hooks/useStudents'

type EnrollmentPickerProps = {
  value: string
  onChange: (enrollmentId: string) => void
  error?: string
}

// Escolhe a matrícula em dois passos: busca o aluno pelo nome e depois escolhe a matrícula dele
export function EnrollmentPicker({ value, onChange, error }: EnrollmentPickerProps) {
  const organization = useActiveOrganization()
  const [text, setText] = useState('')
  const [studentId, setStudentId] = useState('')
  const search = useDebouncedValue(text.trim())

  const students = useStudents(organization.id, { search, page: 1 })
  const enrollments = useStudentEnrollments(organization.id, studentId)
  // Matrícula encerrada ou rescindida não aceita aulas
  const open = enrollments.data?.data.filter((e) => e.status !== 'closed' && e.status !== 'terminated') ?? []

  useEffect(() => {
    const available = enrollments.data?.data.filter((e) => e.status !== 'closed' && e.status !== 'terminated') ?? []
    if (studentId && available.length === 1 && !value) onChange(String(available[0].id))
  }, [enrollments.data, studentId, value, onChange])

  return (
    <>
      <Form.Group className="mb-3" controlId="picker-student-search">
        <Form.Label>Aluno</Form.Label>
        <Form.Control type="search" placeholder="Digite o nome para buscar" value={text} onChange={(event) => setText(event.target.value)} />
      </Form.Group>

      <Form.Group className="mb-3" controlId="picker-student">
        <Form.Label className="visually-hidden">Resultado da busca</Form.Label>
        <Form.Select
          value={studentId}
          onChange={(event) => {
            setStudentId(event.target.value)
            onChange('')
          }}
        >
          <option value="">{students.isPending ? 'Buscando…' : 'Escolha o aluno'}</option>
          {students.data?.data.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </Form.Select>
        {students.error && <div className="text-danger small mt-1">{students.error.message}</div>}
        {students.data && students.data.meta.total > students.data.data.length && (
          <Form.Text muted>Mostrando os primeiros resultados: refine a busca para achar outros alunos.</Form.Text>
        )}
      </Form.Group>

      <Form.Group className="mb-3" controlId="enrollment_id">
        <Form.Label>Matrícula</Form.Label>
        <Form.Select value={value} onChange={(event) => onChange(event.target.value)} isInvalid={!!error} disabled={studentId === ''}>
          <option value="">{studentId === '' ? 'Escolha o aluno primeiro' : 'Escolha a matrícula'}</option>
          {open.map((enrollment) => (
            <option key={enrollment.id} value={enrollment.id}>
              Categoria {enrollment.category} · {ENROLLMENT_STATUS[enrollment.status].label}
            </option>
          ))}
        </Form.Select>
        <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
        {studentId !== '' && enrollments.data && open.length === 0 && <Form.Text muted>Este aluno não tem matrícula aberta.</Form.Text>}
        {enrollments.error && <div className="text-danger small mt-1">{enrollments.error.message}</div>}
      </Form.Group>
    </>
  )
}
