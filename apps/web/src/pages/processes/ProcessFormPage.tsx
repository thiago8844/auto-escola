import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Alert, Form } from 'react-bootstrap'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { LICENSE_CATEGORIES, PROCESS_TYPE_LABELS, UFS } from '../../config/domain'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useCreateProcess } from '../../hooks/useProcesses'
import { useStudent } from '../../hooks/useStudents'
import { processSchema, type ProcessInput } from '../../schemas/process'
import type { Student } from '../../types/student'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'

// Criado a partir do aluno: /alunos/:studentId/processos/novo
export default function ProcessFormPage() {
  const { studentId = '' } = useParams()
  const organization = useActiveOrganization()
  const query = useStudent(organization.id, studentId)

  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(student) => <ProcessForm student={student} />}
    </QueryState>
  )
}

function CategoryChecks({ legend, error, field, register }: { legend: string; error?: string; field: 'current_categories' | 'target_categories'; register: ReturnType<typeof useForm<ProcessInput>>['register'] }) {
  return (
    <fieldset className="mb-3">
      <legend className="form-label fs-6">{legend}</legend>
      <div className="d-flex flex-wrap gap-3">
        {LICENSE_CATEGORIES.map((category) => (
          <Form.Check key={category} type="checkbox" id={`${field}-${category}`} label={category} value={category} {...register(field)} />
        ))}
      </div>
      {error && <div className="text-danger small mt-1">{error}</div>}
    </fieldset>
  )
}

function ProcessForm({ student }: { student: Student }) {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const navigate = useNavigate()
  const create = useCreateProcess(organization.id, student.id)

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<ProcessInput>({
    resolver: zodResolver(processSchema),
    defaultValues: {
      type: 'first_license',
      uf: 'MG',
      municipality: '',
      renach: '',
      protocol: '',
      opened_at: '',
      current_categories: [],
      target_categories: [],
      notes: '',
    },
  })

  // Primeira habilitação não tem categoria atual (regra da API)
  const type = useWatch({ control, name: 'type' })
  const firstLicense = type === 'first_license'
  useEffect(() => {
    if (firstLicense) setValue('current_categories', [])
  }, [firstLicense, setValue])

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (process) => navigate(links.process(process.id)),
      onError: (error) => applyFieldErrors(error, setError),
    }),
  )
  const alertMessage = formAlertMessage(create.error)

  return (
    <>
      <PageHeader title="Novo processo" subtitle={<Link to={links.student(student.id)}>{student.name}</Link>} />

      <div className="form-narrow">
        <Alert variant="secondary">O processo é o acompanhamento local do atendimento. O deferimento e a elegibilidade são do órgão oficial.</Alert>
        {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}

        <form onSubmit={onSubmit} noValidate>
          <SelectField label="Tipo" error={errors.type?.message} {...register('type')}>
            {Object.entries(PROCESS_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <SelectField label="UF" error={errors.uf?.message} {...register('uf')}>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </SelectField>
          <FormField label="Município (opcional)" error={errors.municipality?.message} {...register('municipality')} />
          <FormField label="RENACH (opcional)" autoCapitalize="characters" error={errors.renach?.message} {...register('renach')} />
          <FormField label="Protocolo (opcional)" error={errors.protocol?.message} {...register('protocol')} />
          <FormField label="Data de abertura (opcional)" type="date" error={errors.opened_at?.message} {...register('opened_at')} />

          {!firstLicense && <CategoryChecks legend="Categorias atuais" field="current_categories" error={errors.current_categories?.message} register={register} />}
          <CategoryChecks legend="Categorias pretendidas" field="target_categories" error={errors.target_categories?.message} register={register} />

          <TextAreaField label="Observações (opcional)" error={errors.notes?.message} {...register('notes')} />
          <SubmitButton loading={create.isPending}>Criar processo</SubmitButton>
        </form>
      </div>
    </>
  )
}
