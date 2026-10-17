import { Nav } from 'react-bootstrap'
import { NavLink } from 'react-router-dom'

type NavItemProps = {
  to: string
  icon: string
  label: string
}

export function NavItem({ to, icon, label }: NavItemProps) {
  return (
    <Nav.Link as={NavLink} to={to} end={to === '/'}>
      <i className={`bi ${icon} me-2`} aria-hidden="true" />
      {label}
    </Nav.Link>
  )
}
