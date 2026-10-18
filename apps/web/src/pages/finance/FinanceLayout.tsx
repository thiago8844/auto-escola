import { Nav } from 'react-bootstrap'
import { NavLink, Outlet } from 'react-router-dom'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'

// Moldura do financeiro: abas simples e o mesmo espaço ativo em todas as telas
export default function FinanceLayout() {
  const organization = useActiveOrganization()
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
      <Nav variant="tabs" className="mb-4 flex-nowrap overflow-auto" aria-label="Financeiro">
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
