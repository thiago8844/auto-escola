import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import { SubmitButton } from '../../components/SubmitButton'
import { paths } from '../../config/paths'
import { useLogin } from '../../hooks/useAuthMutations'
import { loginSchema, type LoginInput } from '../../schemas/auth'
import { useAuthStore } from '../../stores/authStore'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'

export default function LoginPage() {
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const sessionExpired = useAuthStore((state) => state.sessionExpired)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const login = useLogin()

  const onSubmit = handleSubmit((values) => login.mutate(values, { onError: (error) => applyFieldErrors(error, setError) }))
  const alertMessage = formAlertMessage(login.error)

  return (
    <>
      <h2 className="h4 mb-4">Entrar</h2>

      {notice && <Alert variant="success">{notice}</Alert>}
      {sessionExpired && <Alert variant="warning">Sua sessão expirou. Entre novamente para continuar.</Alert>}
      {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}

      <form onSubmit={onSubmit} noValidate>
        <FormField label="E-mail" type="email" autoComplete="email" autoFocus error={errors.email?.message} {...register('email')} />
        <FormField label="Senha" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <SubmitButton loading={login.isPending}>Entrar</SubmitButton>
      </form>

      <p className="text-center small mt-4 mb-0">
        Ainda não tem conta? <Link to={paths.register}>Cadastre-se</Link>
      </p>
    </>
  )
}
