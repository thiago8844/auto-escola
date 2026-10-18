import { useFormProtection } from '../../hooks/useFormProtection'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CurrencyField } from '../../components/CurrencyField'
import { FormField } from '../../components/FormField'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { ENROLLMENT_STATUS, LICENSE_CATEGORIES, PROCESS_TYPE_LABELS } from '../../config/domain'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useCreateEnrollment } from '../../hooks/useEnrollments'
import { usePartners } from '../../hooks/usePartners'
import { useProcesses } from '../../hooks/useProcesses'
import { useStudent } from '../../hooks/useStudents'
import { enrollmentSchema, type EnrollmentInput } from '../../schemas/enrollment'
import type { Student } from '../../types/student'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { TextAreaField } from '../../components/TextAreaField'

// Criada a partir do aluno: /alunos/:studentId/matriculas/nova
export default function EnrollmentFormPage() {
  const { studentId = '' } = useParams()
  const organization = useActiveOrganization()
  const query = useStudent(organization.id, studentId)

  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(student) => <EnrollmentForm student={student} />}
    </QueryState>
  )
}

function EnrollmentForm({ student }: { student: Student }) {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const navigate = useNavigate()
  const create = useCreateEnrollment(organization.id, student.id)
  const isIndependent = organization.type === 'independent'
  const partners = usePartners(organization.id, { page: 1, all: true }, isIndependent)
  const processes = useProcesses(organization.id, { page: 1, studentId: student.id })

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<EnrollmentInput>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: { category: 'B', status: 'contracted', contracted_minutes: '', price: '', qualification_process_id: '', partner_id: '', notes: '' },
  })

  const protection = useFormProtection(isDirty)

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (enrollment) => { protection.saved(); navigate(links.enrollment(enrollment.id)) },
      onError: (error) => applyFieldErrors(error, setError),
    }),
  )
  const alertMessage = formAlertMessage(create.error)

  return (
    <>
      <PageHeader title="Nova matrícula" subtitle={<Link to={links.student(student.id)}>{student.name}</Link>} />

      <div className="form-narrow">
        {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}

        <form onSubmit={onSubmit} noValidate>
          <SelectField label="Categoria" error={errors.category?.message} {...register('category')}>
            {LICENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </SelectField>

          <SelectField label="Situação" error={errors.status?.message} {...register('status')}>
            {Object.entries(ENROLLMENT_STATUS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>

          <FormField
            label="Serviço contratado (minutos)"
            inputMode="numeric"
            hint="Ex.: 1200 para 20 aulas de 60 minutos."
            error={errors.contracted_minutes?.message}
            {...register('contracted_minutes')}
          />
          <CurrencyField control={control} name="price" label="Valor do contrato" error={errors.price?.message} />

          <SelectField label="Processo de habilitação" error={errors.qualification_process_id?.message} {...register('qualification_process_id')}>
            <option value="">Sem processo (a prática não é bloqueada)</option>
            {processes.data?.data.map((process) => (
              <option key={process.id} value={process.id}>
                {PROCESS_TYPE_LABELS[process.type]} · {process.uf} · pretende {process.target_categories.join(', ')}
              </option>
            ))}
          </SelectField>
          {processes.error && <p className="small text-danger">Não foi possível carregar os processos do aluno: {processes.error.message}</p>}
          <p className="small mb-3">
            Ainda não tem processo? <Link to={links.processNew(student.id)} target="_blank" rel="noopener noreferrer">Criar processo em outra aba</Link> <Button variant="link" size="sm" onClick={() => void processes.refetch()}>Atualizar lista de processos</Button>
          </p>

          {isIndependent && (
            <SelectField label="Auto escola parceira (opcional)" error={errors.partner_id?.message} {...register('partner_id')}>
              <option value="">Nenhuma</option>
              {partners.data?.data.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </SelectField>
          )}

          <TextAreaField label="Observações do contrato (opcional)" error={errors.notes?.message} {...register('notes')} />
          <SubmitButton loading={create.isPending}>Criar matrícula</SubmitButton>
        </form>
      </div>
    </>
  )
}
