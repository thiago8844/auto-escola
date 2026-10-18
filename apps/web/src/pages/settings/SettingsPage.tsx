import { MutedNoticesSettings } from '../../components/MutedNoticesSettings'
import { PageHeader } from '../../components/PageHeader'
import { ChangePasswordCard } from './ChangePasswordCard'

// Configurações da conta e do aplicativo. Novas seções entram aqui.
export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" />
      <div className="form-narrow">
        <ChangePasswordCard />
        <MutedNoticesSettings />
      </div>
    </>
  )
}
