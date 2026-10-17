import { Alert } from 'react-bootstrap'
import { Link, useSearchParams } from 'react-router-dom'
import { SubmitButton } from '../../components/SubmitButton'
import { organizationPaths, paths } from '../../config/paths'
import { useAcceptInvitation } from '../../hooks/useInvitations'
import { useAuthStore } from '../../stores/authStore'
import { ROLE_LABELS } from '../../config/organization'

// Destino do link do e-mail de convite. O aceite é uma ação explícita, não automática.
export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const user = useAuthStore((state) => state.user)
  const accept = useAcceptInvitation()

  if (accept.isSuccess) {
    const invitation = accept.data
    return (
      <>
        <h2 className="h4 mb-3">Convite aceito</h2>
        <Alert variant="success">
          Você agora tem acesso{invitation.organization ? ` a ${invitation.organization.name}` : ''} como {ROLE_LABELS[invitation.role].toLowerCase()}.
        </Alert>
        <Link
          to={invitation.organization ? organizationPaths(invitation.organization.id).home : paths.organizations}
          className="btn btn-primary w-100"
        >
          Abrir espaço
        </Link>
      </>
    )
  }

  if (token.length !== 64) {
    return (
      <>
        <h2 className="h4 mb-3">Convite inválido</h2>
        <Alert variant="danger" role="alert">
          O link do convite está incompleto. Use o link recebido por e-mail.
        </Alert>
        <Link to={paths.organizations}>Ir para meus espaços</Link>
      </>
    )
  }

  return (
    <>
      <h2 className="h4 mb-3">Aceitar convite</h2>
      <p>
        Você está conectado como <strong>{user?.email}</strong>. O convite só vale para a conta do e-mail que o recebeu.
      </p>

      {accept.isError && (
        <Alert variant="danger" role="alert">
          {accept.error.message}
          {accept.error.code === 'email_not_verified' && (
            <>
              {' '}
              <Link to={paths.verifyEmailNotice}>Confirmar e-mail</Link>
            </>
          )}
        </Alert>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          accept.mutate(token)
        }}
      >
        <SubmitButton loading={accept.isPending}>Aceitar convite</SubmitButton>
      </form>
      <p className="text-center small mt-3 mb-0">
        <Link to={paths.organizations}>Agora não</Link>
      </p>
    </>
  )
}
