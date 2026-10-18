import type { ReactNode } from 'react'
import { Button, Container, Nav, Navbar, Offcanvas } from 'react-bootstrap'
import { Outlet } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { NotificationBell } from '../components/NotificationBell'
import { Logo } from '../components/Logo'
import { NavItem, type NavItemProps } from '../components/NavItem'
import { ThemeToggle } from '../components/ThemeToggle'
import { APP_NAME, SUPPORT_EMAIL } from '../config'
import { paths } from '../config/paths'
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
      <a href="#conteudo" className="visually-hidden-focusable position-absolute p-2 bg-body" style={{ zIndex: 2000 }}>
        Pular para o conteúdo
      </a>
      <Navbar expand="lg" className="app-sidebar flex-lg-column align-items-lg-stretch bg-surface border-bottom">
        <Container fluid className="flex-lg-column align-items-lg-stretch flex-lg-grow-1">
          <Navbar.Brand as={Link} to={paths.home} aria-label={APP_NAME}>
            <Logo height={32} />
          </Navbar.Brand>
          <div className="ms-auto me-2 d-lg-none">
            <NotificationBell />
          </div>
          <Navbar.Toggle aria-controls="app-menu" aria-label="Abrir menu" />
          <Navbar.Offcanvas id="app-menu" placement="start" responsive="lg" className="flex-lg-grow-1">
            <Offcanvas.Header closeButton>
              <Offcanvas.Title as="div">
                <Logo height={28} />
              </Offcanvas.Title>
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
                {SUPPORT_EMAIL && (
                  <p className="small mb-2">
                    <a href={`mailto:${SUPPORT_EMAIL}`}>
                      <i className="bi bi-life-preserver me-2" aria-hidden="true" />
                      Falar com o suporte
                    </a>
                  </p>
                )}
                <div className="d-flex flex-wrap gap-2">
                  <Link to={paths.settings} className="btn btn-outline-secondary btn-sm flex-fill">
                    <i className="bi bi-gear me-2" aria-hidden="true" />
                    Configurações
                  </Link>
                  <ThemeToggle compact align="end" />
                  <Button variant="outline-secondary" size="sm" className="flex-fill" onClick={() => logout.mutate()} disabled={logout.isPending}>
                    <i className="bi bi-box-arrow-right me-2" aria-hidden="true" />
                    Sair
                  </Button>
                </div>
              </div>
            </Offcanvas.Body>
          </Navbar.Offcanvas>
        </Container>
      </Navbar>
      <main id="conteudo" tabIndex={-1} className="app-content flex-grow-1 p-3 p-lg-4">
        <div className="d-none d-lg-flex justify-content-end mb-3">
          <NotificationBell />
        </div>
        {children ?? <Outlet />}
      </main>
    </div>
  )
}
