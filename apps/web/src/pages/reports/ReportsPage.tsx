import { Button, Nav } from 'react-bootstrap'
import { PageHeader } from '../../components/PageHeader'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { usePageParam } from '../../hooks/usePageParam'
import { useUrlFilters } from '../../hooks/useUrlFilters'
import { addDays, todayInTimeZone } from '../../utils/timezone'
import { LessonsTab } from './LessonsTab'
import { ExamsTab, PartnersTab, ProcessesTab, UtilizationTab } from './OtherTabs'
import { PeriodFilter } from './ReportFilters'

const TABS = [
  ['aulas', 'Aulas'],
  ['exames', 'Exames'],
  ['utilizacao', 'Utilização'],
  ['processos', 'Processos'],
  ['parceiros', 'Parceiros'],
] as const

// Relatórios de gestão. Aba, período e filtros ficam na URL: o link reproduz exatamente o que você está vendo.
export default function ReportsPage() {
  const organization = useActiveOrganization()
  const [page, setPage] = usePageParam()
  const { values, set, setMany, clear, active } = useUrlFilters(['aba', 'de', 'ate', 'instrutor', 'veiculo', 'categoria', 'situacao', 'parceiro', 'agrupar', 'cancelamentos'] as const)
  const today = todayInTimeZone(organization.timezone)
  const tab = values.aba || 'aulas'
  const from = values.de || addDays(today, -29)
  const to = values.ate || today
  const tabs = TABS.filter(([key]) => key !== 'parceiros' || organization.type === 'independent')
  const filtersValues = { ...values, de: from, ate: to }

  const setPeriod = (start: string, end: string) => setMany({ de: start, ate: end })
  // Trocar de aba mantém o período e zera os demais filtros
  const goTo = (key: string) =>
    setMany({ aba: key === 'aulas' ? '' : key, de: from, ate: to, instrutor: '', veiculo: '', categoria: '', situacao: '', parceiro: '', agrupar: '', cancelamentos: '' })

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Escolha o período, clique em um indicador para ver as aulas ou exames que o compõem e exporte o mesmo conjunto em CSV."
        actions={
          active && (
            <Button variant="outline-secondary" onClick={() => clear()}>
              Limpar filtros
            </Button>
          )
        }
      />

      <Nav variant="tabs" className="mb-3" activeKey={tab} onSelect={(key) => goTo(key ?? 'aulas')}>
        {tabs.map(([key, label]) => (
          <Nav.Item key={key}>
            <Nav.Link eventKey={key}>{label}</Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {tab !== 'processos' && <PeriodFilter timezone={organization.timezone} from={from} to={to} onChange={setPeriod} />}

      {tab === 'aulas' && <LessonsTab organization={organization} values={filtersValues} set={set} setMany={setMany} page={page} setPage={setPage} />}
      {tab === 'exames' && <ExamsTab organization={organization} from={from} to={to} values={filtersValues} set={set} page={page} setPage={setPage} />}
      {tab === 'utilizacao' && <UtilizationTab organization={organization} from={from} to={to} />}
      {tab === 'processos' && <ProcessesTab organization={organization} />}
      {tab === 'parceiros' && <PartnersTab organization={organization} from={from} to={to} />}
    </>
  )
}
