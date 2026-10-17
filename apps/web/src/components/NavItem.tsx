import { Nav } from 'react-bootstrap'
import { NavLink } from 'react-router-dom'

export type NavItemProps = {
  to: string
  icon: string
  label: string
  // Marca ativo só na rota exata (ex.: o "Início" de um espaço)
  end?: boolean
}

export function NavItem({ to, icon, label, end }: NavItemProps) {
  return (
    <Nav.Link as={NavLink} to={to} end={end}>
      <i className={`bi ${icon} me-2`} aria-hidden="true" />
      {label}
    </Nav.Link>
  )
}
