import type { ReactNode } from 'react'
import { Button, Container, Nav, Navbar, Offcanvas } from 'react-bootstrap'
import { Outlet } from 'react-router-dom'
import { NavItem, type NavItemProps } from '../components/NavItem'
import { APP_NAME } from '../config'
import { useLogout } from '../hooks/useAuthMutations'
import { useAuthStore } from '../stores/authStore'

type AppLayoutProps = {
  navItems: NavItemProps[]
  // Bloco acima do menu (ex.: espaço ativo)
  sidebarHeader?: ReactNode
  // Conteúdo no lugar do <Outlet /> (ex.: carregando o espaço)
  children?: ReactNode
}

// Menu lateral fixo em telas grandes; no mobile vira uma barra com menu deslizante
export function AppLayout({ navItems, sidebarHeader, children }: AppLayoutProps) {
  const user = useAuthStore((state) => state.user)
  const logout = useLogout()

  return (
    <div className="app-shell d-lg-flex">
      <Navbar expand="lg" className="app-sidebar flex-lg-column align-items-lg-stretch bg-white border-bottom">
        <Container fluid className="flex-lg-column align-items-lg-stretch flex-lg-grow-1">
          <Navbar.Brand className="fw-semibold">{APP_NAME}</Navbar.Brand>
          <Navbar.Toggle aria-controls="app-menu" aria-label="Abrir menu" />
          <Navbar.Offcanvas id="app-menu" placement="start" responsive="lg" className="flex-lg-grow-1">
            <Offcanvas.Header closeButton>
              <Offcanvas.Title>{APP_NAME}</Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body className="flex-column">
              {sidebarHeader && <div className="border-bottom pb-3 mb-3">{sidebarHeader}</div>}
              <Nav as="nav" className="flex-column flex-grow-1" aria-label="Principal">
                {navItems.map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </Nav>
              <div className="border-top pt-3 mt-3">
                <p className="small text-secondary mb-2 text-truncate" title={user?.email}>
                  <i className="bi bi-person-circle me-2" aria-hidden="true" />
                  {user?.name}
                </p>
                <Button variant="outline-secondary" size="sm" className="w-100" onClick={() => logout.mutate()} disabled={logout.isPending}>
                  <i className="bi bi-box-arrow-right me-2" aria-hidden="true" />
                  Sair
                </Button>
              </div>
            </Offcanvas.Body>
          </Navbar.Offcanvas>
        </Container>
      </Navbar>
      <main className="app-content flex-grow-1 p-3 p-lg-4">{children ?? <Outlet />}</main>
    </div>
  )
}
