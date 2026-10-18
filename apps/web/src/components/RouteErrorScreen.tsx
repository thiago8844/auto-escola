import { Alert, Button, Container } from 'react-bootstrap'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { paths } from '../config/paths'

export function RouteErrorScreen() {
  const error = useRouteError()
  const missing = isRouteErrorResponse(error) && error.status === 404
  return <Container className="py-5 form-narrow">
    <h1 className="h4">{missing ? 'Página não encontrada' : 'Não foi possível abrir esta tela'}</h1>
    <Alert variant="warning">{missing ? 'Confira o endereço ou volte para seus espaços.' : 'Tente abrir novamente. Se continuar, informe ao suporte qual tarefa você estava realizando.'}</Alert>
    <div className="d-flex flex-wrap gap-2"><Button onClick={() => window.location.reload()}>Tentar novamente</Button><a className="btn btn-outline-secondary" href={paths.organizations}>Meus espaços</a></div>
  </Container>
}
