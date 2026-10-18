import { paths } from '../config/paths'
import { AppLayout } from './AppLayout'

const navItems = [
  { to: paths.organizations, icon: 'bi-building', label: 'Meus espaços', end: true },
  { to: paths.organizationNew, icon: 'bi-plus-circle', label: 'Novo espaço' },
  { to: paths.myLessons, icon: 'bi-calendar-check', label: 'Minha agenda' },
  { to: paths.myProfile, icon: 'bi-person-badge', label: 'Perfil profissional' },
  { to: paths.settings, icon: 'bi-gear', label: 'Configurações' },
]

// Telas fora de um espaço: lista e criação
export function AccountLayout() {
  return <AppLayout navItems={navItems} />
}
