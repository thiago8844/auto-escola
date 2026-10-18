import { Alert } from 'react-bootstrap'
import { PageHeader } from '../../components/PageHeader'

// Configurações da conta e do aplicativo. Vazia por enquanto: as opções entram aqui depois.
export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" />
      <Alert variant="secondary">
        <i className="bi bi-tools me-2" aria-hidden="true" />
        Ainda não há configurações disponíveis.
      </Alert>
    </>
  )
}
