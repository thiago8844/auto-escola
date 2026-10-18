import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Card } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { FormField } from '../../components/FormField'
import { SubmitButton } from '../../components/SubmitButton'
import { PASSWORD_MIN } from '../../config'
import { useChangePassword } from '../../hooks/useAuthMutations'
import { changePasswordSchema, type ChangePasswordInput } from '../../schemas/auth'
import { notify } from '../../stores/toastStore'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'

// Troca de senha com a atual. Os outros dispositivos são desconectados; este continua.
export function ChangePasswordCard() {
  const change = useChangePassword()
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), defaultValues: { current_password: '', password: '', password_confirmation: '' } })

  const onSubmit = handleSubmit((values) =>
    change.mutate(values, {
      onSuccess: (data) => {
        notify.success(data.message)
        reset()
      },
      onError: (error) => applyFieldErrors(error, setError),
    }),
  )
  const alertMessage = formAlertMessage(change.error)

  return (
    <Card className="mb-4">
      <Card.Body>
        <Card.Title as="h2" className="h5">
          Alterar senha
        </Card.Title>
        <p className="small text-secondary">Ao trocar a senha, os outros dispositivos conectados à sua conta são desconectados.</p>
        {alertMessage && (
          <Alert variant="danger" role="alert">
            {alertMessage}
          </Alert>
        )}
        <form onSubmit={onSubmit} noValidate>
          <FormField label="Senha atual" type="password" autoComplete="current-password" error={errors.current_password?.message} {...register('current_password')} />
          <FormField label="Nova senha" type="password" autoComplete="new-password" hint={`Mínimo de ${PASSWORD_MIN} caracteres.`} error={errors.password?.message} {...register('password')} />
          <FormField label="Confirmar nova senha" type="password" autoComplete="new-password" error={errors.password_confirmation?.message} {...register('password_confirmation')} />
          <SubmitButton loading={change.isPending}>Alterar senha</SubmitButton>
        </form>
      </Card.Body>
    </Card>
  )
}
