import { Container, Nav, Navbar, Offcanvas } from 'react-bootstrap'
import { Outlet } from 'react-router-dom'
import { NavItem } from '../components/NavItem'
import { APP_NAME } from '../config'

const navItems = [{ to: '/', icon: 'bi-house', label: 'Início' }]

// Menu lateral fixo em telas grandes; no mobile vira uma barra com menu deslizante
export function AppLayout() {
  return (
    <div className="app-shell d-lg-flex">
      <Navbar expand="lg" className="app-sidebar flex-lg-column align-items-lg-stretch bg-white border-bottom">
        <Container fluid className="flex-lg-column align-items-lg-stretch">
          <Navbar.Brand className="fw-semibold">{APP_NAME}</Navbar.Brand>
          <Navbar.Toggle aria-controls="app-menu" aria-label="Abrir menu" />
          <Navbar.Offcanvas id="app-menu" placement="start" responsive="lg">
            <Offcanvas.Header closeButton>
              <Offcanvas.Title>{APP_NAME}</Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body>
              <Nav as="nav" className="flex-column flex-grow-1" aria-label="Principal">
                {navItems.map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </Nav>
            </Offcanvas.Body>
          </Navbar.Offcanvas>
        </Container>
      </Navbar>
      <main className="app-content flex-grow-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
