import { Alert, Button } from 'react-bootstrap'
import { Link, Navigate } from 'react-router-dom'
import { SubmitButton } from '../../components/SubmitButton'
import { paths } from '../../config/paths'
import { useLogout, useRefreshUser, useResendVerification } from '../../hooks/useAuthMutations'
import { useAuthStore } from '../../stores/authStore'

export default function VerifyEmailNoticePage() {
  const user = useAuthStore((state) => state.user)
  const resend = useResendVerification()
  const refresh = useRefreshUser()
  const logout = useLogout()

  if (user?.email_verified) return <Navigate to={paths.home} replace />

  return (
    <>
      <h2 className="h4 mb-3">Verifique seu e-mail</h2>
      <p>
        Enviamos um link de confirmação para <strong>{user?.email}</strong>. Abra a mensagem e clique no link para ativar sua conta.
      </p>

      {resend.isSuccess && <Alert variant="success">{resend.data.message}</Alert>}
      {resend.isError && <Alert variant="danger" role="alert">{resend.error.message}</Alert>}
      {refresh.isSuccess && !refresh.data.email_verified && <Alert variant="info">Ainda não identificamos a confirmação. Clique no link do e-mail primeiro.</Alert>}

      <form onSubmit={(event) => { event.preventDefault(); resend.mutate() }} className="mb-2">
        <SubmitButton loading={resend.isPending}>Reenviar e-mail</SubmitButton>
      </form>
      <Button variant="outline-primary" className="w-100 mb-3" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
        Já confirmei
      </Button>

      <p className="text-center small mb-0">
        <Link to={paths.home}>Continuar sem confirmar</Link>
        {' · '}
        <Button variant="link" size="sm" className="p-0 align-baseline" onClick={() => logout.mutate()}>
          Sair
        </Button>
      </p>
    </>
  )
}
