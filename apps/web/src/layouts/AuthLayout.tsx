import { Card, Container } from 'react-bootstrap'
import { Outlet } from 'react-router-dom'
import { APP_NAME } from '../config'

// Moldura das telas de login, cadastro e confirmação de e-mail
export function AuthLayout() {
  return (
    <Container as="main" className="min-vh-100 d-flex flex-column align-items-center justify-content-center py-5">
      <h1 className="h3 mb-4 text-primary">{APP_NAME}</h1>
      <Card className="w-100 auth-card">
        <Card.Body className="p-4">
          <Outlet />
        </Card.Body>
      </Card>
    </Container>
  )
}
