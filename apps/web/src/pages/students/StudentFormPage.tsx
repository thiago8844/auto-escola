import { useSessionFormRecovery } from '../../hooks/useSessionFormRecovery'
import { useFormProtection } from '../../hooks/useFormProtection'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Col, Row } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DocumentField } from '../../components/DocumentField'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { usePartners } from '../../hooks/usePartners'
import { FormErrorAlert } from '../../components/FormErrorAlert'
import { QueryState } from '../../components/QueryState'
import { SubmitButton } from '../../components/SubmitButton'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useCreateStudent, useStudent, useUpdateStudent } from '../../hooks/useStudents'
import { studentSchema, type StudentInput } from '../../schemas/student'
import type { Student } from '../../types/student'
import { applyFieldErrors } from '../../utils/applyFieldErrors'

const emptyValues: StudentInput = { name: '', cpf: '', email: '', phone: '', birth_date: '', identity_number: '', identity_issuer: '', partner_id: '' }

function toFormValues(student: Student): StudentInput {
  return {
    name: student.name,
    cpf: student.cpf ?? '',
    email: student.email ?? '',
    phone: student.phone ?? '',
    birth_date: student.birth_date ?? '',
    identity_number: student.identity_number ?? '',
    identity_issuer: student.identity_issuer ?? '',
    partner_id: student.partner_id ? String(student.partner_id) : 'space',
  }
}

// Cadastro (/alunos/novo) e edição (/alunos/:studentId/editar) usam o mesmo formulário
export default function StudentFormPage() {
  const { studentId } = useParams()
  const organization = useActiveOrganization()
  const query = useStudent(organization.id, studentId)

  if (!studentId) return <StudentForm />
  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(student) => <StudentForm student={student} />}
    </QueryState>
  )
}

function StudentForm({ student }: { student?: Student }) {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const navigate = useNavigate()
  const create = useCreateStudent(organization.id)
  const update = useUpdateStudent(organization.id, String(student?.id ?? ''), student?.updated_at)
  const save = student ? update : create
  // Em autoescola o padrão é o próprio espaço; no espaço particular é preciso escolher a parceira
  const isIndependent = organization.type === 'independent'
  const partners = usePartners(organization.id, { page: 1, all: true })

  const {
    register,
    getValues,
    reset,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<StudentInput>({
    resolver: zodResolver(studentSchema),
    defaultValues: student ? toFormValues(student) : { ...emptyValues, partner_id: isIndependent ? '' : 'space' },
  })

  useSessionFormRecovery(`student:${organization.id}:${student?.id ?? 'new'}`, getValues, reset)
  const protection = useFormProtection(isDirty)

  const onSubmit = handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: (saved) => { protection.saved(); navigate(links.student(saved.id)) },
      onError: (error) => applyFieldErrors(error, setError),
    }),
  )

  return (
    <>
      <h1 className="mb-4">{student ? 'Editar aluno' : 'Novo aluno'}</h1>

      <div className="form-narrow">
        <FormErrorAlert error={save.error} />

        <form onSubmit={onSubmit} noValidate>
          <FormField label="Nome" autoFocus error={errors.name?.message} {...register('name')} />
          <DocumentField control={control} name="cpf" label="CPF (opcional)" error={errors.cpf?.message} />
          <FormField label="E-mail (opcional)" type="email" error={errors.email?.message} {...register('email')} />
          <FormField label="Telefone (opcional)" type="tel" error={errors.phone?.message} {...register('phone')} />
          <FormField label="Data de nascimento (opcional)" type="date" error={errors.birth_date?.message} {...register('birth_date')} />
          <Row>
            <Col sm={7}>
              <FormField label="Identidade (RG, opcional)" hint="Pedida na inscrição do exame." error={errors.identity_number?.message} {...register('identity_number')} />
            </Col>
            <Col sm={5}>
              <FormField label="Órgão expedidor (opcional)" placeholder="SSP/MG" error={errors.identity_issuer?.message} {...register('identity_issuer')} />
            </Col>
          </Row>
          <SelectField label="Autoescola do aluno" error={errors.partner_id?.message} {...register('partner_id')}>
            {isIndependent ? <option value="">{partners.isPending ? 'Carregando…' : 'Escolha a autoescola'}</option> : <option value="space">{organization.name} (este espaço)</option>}
            {partners.data?.data.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </SelectField>
          {isIndependent && partners.data && partners.data.data.length === 0 && (
            <p className="small text-secondary">
              Nenhuma autoescola parceira cadastrada. <Link to={links.partnerNew}>Cadastre a parceira</Link> e volte aqui.
            </p>
          )}
          <SubmitButton loading={save.isPending}>{student ? 'Salvar alterações' : 'Cadastrar aluno'}</SubmitButton>
        </form>
      </div>
    </>
  )
}
