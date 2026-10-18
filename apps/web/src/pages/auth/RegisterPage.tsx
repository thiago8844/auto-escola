import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import { SubmitButton } from '../../components/SubmitButton'
import { PASSWORD_MIN } from '../../config'
import { paths } from '../../config/paths'
import { useRegister } from '../../hooks/useAuthMutations'
import { registerSchema, type RegisterInput } from '../../schemas/auth'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'

export default function RegisterPage() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', password_confirmation: '' },
  })
  const signUp = useRegister()

  const onSubmit = handleSubmit((values) =>
    signUp.mutate(values, {
      onSuccess: () => navigate(paths.verifyEmailNotice, { replace: true }),
      onError: (error) => applyFieldErrors(error, setError),
    }),
  )
  const alertMessage = formAlertMessage(signUp.error)

  return (
    <>
      <h2 className="h4 mb-4">Criar conta</h2>

      {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}

      <form onSubmit={onSubmit} noValidate>
        <FormField label="Nome" autoComplete="name" autoFocus error={errors.name?.message} {...register('name')} />
        <FormField label="E-mail" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <FormField
          label="Senha"
          type="password"
          autoComplete="new-password"
          hint={`Mínimo de ${PASSWORD_MIN} caracteres.`}
          error={errors.password?.message}
          {...register('password')}
        />
        <FormField
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          error={errors.password_confirmation?.message}
          {...register('password_confirmation')}
        />
        <SubmitButton loading={signUp.isPending}>Criar conta</SubmitButton>
      </form>

      <p className="text-center small mt-4 mb-0">
        Já tem conta? <Link to={paths.login}>Entrar</Link>
      </p>
    </>
  )
}
