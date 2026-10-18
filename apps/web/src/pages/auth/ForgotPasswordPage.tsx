import { zodResolver } from '@hookform/resolvers/zod'
import { Alert } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import { SubmitButton } from '../../components/SubmitButton'
import { paths } from '../../config/paths'
import { useForgotPassword } from '../../hooks/useAuthMutations'
import { forgotPasswordSchema, type ForgotPasswordInput } from '../../schemas/auth'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'

// Pede o link de redefinição. A resposta é a mesma exista a conta ou não.
export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } })
  const request = useForgotPassword()

  const onSubmit = handleSubmit((values) => request.mutate(values.email, { onError: (error) => applyFieldErrors(error, setError) }))
  const alertMessage = formAlertMessage(request.error)

  return (
    <>
      <h2 className="h4 mb-3">Esqueci minha senha</h2>

      {request.isSuccess ? (
        <Alert variant="success" role="status">
          {request.data.message} Confira também a caixa de spam.
        </Alert>
      ) : (
        <>
          <p className="text-secondary">Informe o e-mail da sua conta. Se ele estiver cadastrado, enviamos um link para criar uma nova senha.</p>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}
          <form onSubmit={onSubmit} noValidate>
            <FormField label="E-mail" type="email" autoComplete="email" autoFocus error={errors.email?.message} {...register('email')} />
            <SubmitButton loading={request.isPending}>Enviar link</SubmitButton>
          </form>
        </>
      )}

      <p className="text-center small mt-4 mb-0">
        <Link to={paths.login}>Voltar para o login</Link>
      </p>
    </>
  )
}
