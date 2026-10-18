import { Card, Container } from 'react-bootstrap'
import { Outlet } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { APP_NAME } from '../config'

// Moldura das telas de login, cadastro e confirmação de e-mail
export function AuthLayout() {
  return (
    <Container as="main" className="min-vh-100 d-flex flex-column align-items-center justify-content-center px-3 py-5 position-relative">
      <div className="position-absolute top-0 end-0 p-3">
        <ThemeToggle compact />
      </div>
      <h1 className="visually-hidden">{APP_NAME}</h1>
      <Logo height={56} className="mb-4" />
      <Card className="w-100 auth-card">
        <Card.Body className="p-4">
          <Outlet />
        </Card.Body>
      </Card>
    </Container>
  )
}
