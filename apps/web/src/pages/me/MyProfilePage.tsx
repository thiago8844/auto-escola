import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Form } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { FormField } from '../../components/FormField'
import { PageHeader } from '../../components/PageHeader'
import { QueryErrorAlert } from '../../components/QueryErrorAlert'
import { SubmitButton } from '../../components/SubmitButton'
import { LICENSE_CATEGORIES } from '../../config/domain'
import { useMyInstructor, useSaveMyInstructor } from '../../hooks/useMe'
import { instructorSchema, type InstructorInput } from '../../schemas/instructor'
import type { Instructor } from '../../types/instructor'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'

// Perfil profissional da própria conta: só o próprio instrutor altera a identidade (nome, credencial, categorias)
export default function MyProfilePage() {
  const query = useMyInstructor()
  const missing = query.error?.code === 'instructor_profile_missing'

  return (
    <>
      <PageHeader title="Perfil profissional" subtitle="Seus dados como instrutor. Só você altera nome, credencial e categorias." />

      {query.isPending && <p className="text-secondary">Carregando…</p>}
      {query.error && !missing && <QueryErrorAlert error={query.error} onRetry={() => void query.refetch()} />}
      {(missing || query.data) && <ProfileForm profile={query.data} />}
    </>
  )
}

function ProfileForm({ profile }: { profile?: Instructor }) {
  const save = useSaveMyInstructor(profile !== undefined)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<InstructorInput>({
    resolver: zodResolver(instructorSchema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      credential_number: profile?.credential_number ?? '',
      categories: profile?.categories ?? [],
    },
  })

  const onSubmit = handleSubmit((values) => save.mutate(values, { onError: (error) => applyFieldErrors(error, setError) }))
  const alertMessage = formAlertMessage(save.error)

  return (
    <div className="form-narrow">
      {!profile && <Alert variant="info">Você ainda não tem perfil profissional. Crie um para aparecer como instrutor nos espaços.</Alert>}
      {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}

      <form onSubmit={onSubmit} noValidate>
        <FormField label="Nome completo" autoFocus={!profile} error={errors.full_name?.message} {...register('full_name')} />
        <FormField label="Número da credencial (opcional)" error={errors.credential_number?.message} {...register('credential_number')} />
        <fieldset className="mb-3">
          <legend className="form-label fs-6">Categorias que habilita</legend>
          <div className="d-flex flex-wrap gap-3">
            {LICENSE_CATEGORIES.map((category) => (
              <Form.Check key={category} type="checkbox" id={`my-category-${category}`} label={category} value={category} {...register('categories')} />
            ))}
          </div>
        </fieldset>
        <SubmitButton loading={save.isPending}>{profile ? 'Salvar alterações' : 'Criar perfil'}</SubmitButton>
      </form>
    </div>
  )
}
