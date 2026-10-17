import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Alert } from 'react-bootstrap'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { verifyEmail } from '../../api/auth'
import { FullPageSpinner } from '../../components/FullPageSpinner'
import { paths } from '../../config/paths'
import { useRefreshUser } from '../../hooks/useAuthMutations'
import { useAuthStore } from '../../stores/authStore'

// Destino do link do e-mail: confirma na API e volta ao login
export default function VerifyEmailPage() {
  const { id = '', hash = '' } = useParams()
  const { search } = useLocation()
  const authenticated = useAuthStore((state) => state.status === 'authenticated')
  const refreshUser = useRefreshUser()

  // A chave estável evita confirmar duas vezes (StrictMode monta o efeito duas vezes)
  const verification = useQuery({
    queryKey: ['email-verification', id, hash, search],
    queryFn: () => verifyEmail(id, hash, search),
    staleTime: Infinity,
    gcTime: 0,
  })

  const { mutate: refresh } = refreshUser
  useEffect(() => {
    // Quem está logado precisa ter o "e-mail confirmado" atualizado na sessão
    if (verification.isSuccess && authenticated) refresh()
  }, [verification.isSuccess, authenticated, refresh])

  if (verification.isPending) return <FullPageSpinner label="Confirmando e-mail…" />

  if (verification.isSuccess) {
    return <Navigate to={paths.login} replace state={{ notice: 'E-mail confirmado! Entre para continuar.' }} />
  }

  const temporaryFailure = verification.error.kind === 'network' || verification.error.kind === 'server'

  return (
    <>
      <h2 className="h4 mb-3">Não foi possível confirmar</h2>
      <Alert variant="danger" role="alert">
        {temporaryFailure ? verification.error.message : 'Link de confirmação inválido ou expirado.'}
      </Alert>
      <p className="small mb-0">
        {authenticated ? (
          <Link to={paths.verifyEmailNotice}>Reenviar e-mail de confirmação</Link>
        ) : (
          <>
            <Link to={paths.login}>Entre</Link> para pedir um novo link.
          </>
        )}
      </p>
    </>
  )
}
