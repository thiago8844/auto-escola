import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import { SubmitButton } from '../../components/SubmitButton'
import { PASSWORD_MIN } from '../../config'
import { paths } from '../../config/paths'
import { useResetPassword } from '../../hooks/useAuthMutations'
import { resetPasswordSchema, type ResetPasswordInput } from '../../schemas/auth'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'

// Define a nova senha a partir do link enviado por e-mail (token e e-mail vêm na URL; o link vale uma vez)
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''
  const navigate = useNavigate()
  const reset = useResetPassword()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', password_confirmation: '' } })

  if (token === '' || email === '') {
    return (
      <>
        <h2 className="h4 mb-3">Link inválido</h2>
        <Alert variant="warning">O link de redefinição está incompleto. Peça um novo.</Alert>
        <Link to={paths.forgotPassword}>Pedir novo link</Link>
      </>
    )
  }

  const onSubmit = handleSubmit((values) =>
    reset.mutate(
      { ...values, email, token },
      {
        onSuccess: (data) => navigate(paths.login, { replace: true, state: { notice: data.message } }),
        onError: (error) => applyFieldErrors(error, setError),
      },
    ),
  )
  const alertMessage = formAlertMessage(reset.error)

  return (
    <>
      <h2 className="h4 mb-1">Criar nova senha</h2>
      <p className="text-secondary small text-break">{email}</p>

      {alertMessage && (
        <Alert variant="danger" role="alert">
          {alertMessage}{' '}
          {reset.error?.code === 'invalid_reset_token' && <Link to={paths.forgotPassword}>Pedir novo link</Link>}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <FormField label="Nova senha" type="password" autoComplete="new-password" autoFocus hint={`Mínimo de ${PASSWORD_MIN} caracteres.`} error={errors.password?.message} {...register('password')} />
        <FormField label="Confirmar nova senha" type="password" autoComplete="new-password" error={errors.password_confirmation?.message} {...register('password_confirmation')} />
        <SubmitButton loading={reset.isPending}>Salvar nova senha</SubmitButton>
      </form>
    </>
  )
}
