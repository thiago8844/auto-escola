import { Form, Nav } from 'react-bootstrap'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'

// Moldura do financeiro: abas simples e o mesmo espaço ativo em todas as telas
export default function FinanceLayout() {
  const organization = useActiveOrganization()
  const location = useLocation()
  const navigate = useNavigate()
  const links = organizationPaths(organization.id)
  const tabs = [
    [links.finance, 'Visão geral', true],
    [links.financeReceivables, 'Receitas', false],
    [links.financePayables, 'Despesas', false],
    [links.financeAccounts, 'Contas e movimentações', false],
    [links.financeSetup, 'Cadastros', false],
  ] as const

  return (
    <>
      <Form.Group className="d-md-none mb-3" controlId="finance-section">
        <Form.Label className="small">Financeiro · seção atual</Form.Label>
        <Form.Select value={tabs.find(([to, , end]) => end ? location.pathname === to : location.pathname.startsWith(to))?.[0] ?? links.finance} onChange={(event) => navigate(event.target.value)}>
          {tabs.map(([to, label]) => <option key={to} value={to}>{label}</option>)}
        </Form.Select>
      </Form.Group>
      <Nav variant="tabs" className="mb-4 d-none d-md-flex flex-wrap" aria-label="Financeiro">
        {tabs.map(([to, label, end]) => (
          <Nav.Item key={to}>
            <Nav.Link as={NavLink} to={to} end={end} className="text-nowrap">
              {label}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>
      <Outlet context={organization} />
    </>
  )
}
