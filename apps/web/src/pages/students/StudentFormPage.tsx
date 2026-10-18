import { useFormProtection } from '../../hooks/useFormProtection'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { DocumentField } from '../../components/DocumentField'
import { FormField } from '../../components/FormField'
import { FormErrorAlert } from '../../components/FormErrorAlert'
import { QueryState } from '../../components/QueryState'
import { SubmitButton } from '../../components/SubmitButton'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useCreateStudent, useStudent, useUpdateStudent } from '../../hooks/useStudents'
import { studentSchema, type StudentInput } from '../../schemas/student'
import type { Student } from '../../types/student'
import { applyFieldErrors } from '../../utils/applyFieldErrors'

const emptyValues: StudentInput = { name: '', cpf: '', email: '', phone: '', birth_date: '' }

function toFormValues(student: Student): StudentInput {
  return {
    name: student.name,
    cpf: student.cpf ?? '',
    email: student.email ?? '',
    phone: student.phone ?? '',
    birth_date: student.birth_date ?? '',
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

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<StudentInput>({
    resolver: zodResolver(studentSchema),
    defaultValues: student ? toFormValues(student) : emptyValues,
  })

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
          <SubmitButton loading={save.isPending}>{student ? 'Salvar alterações' : 'Cadastrar aluno'}</SubmitButton>
        </form>
      </div>
    </>
  )
}
