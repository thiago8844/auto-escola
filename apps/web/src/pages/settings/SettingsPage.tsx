import { useState } from 'react'
import { Card, Form } from 'react-bootstrap'
import { NavigationSettings } from '../../components/NavigationSettings'
import { DefaultSpaceSettings } from '../../components/DefaultSpaceSettings'
import { MutedNoticesSettings } from '../../components/MutedNoticesSettings'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { useOrganizations } from '../../hooks/useOrganizations'
import { ChangePasswordCard } from './ChangePasswordCard'

// Configurações da conta e do aplicativo. Novas seções entram aqui.
export default function SettingsPage() {
  const organizations = useOrganizations()
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('')

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="settings-grid">
        <div><DefaultSpaceSettings /></div>
        <Card className="mb-4"><Card.Body>
          <Card.Title as="h2" className="h5">Organizar meu menu</Card.Title>
          <p className="small text-secondary">Escolha um espaço para ordenar ou ocultar módulos no seu menu. Essa preferência é pessoal e não altera seus acessos.</p>
          <QueryState query={organizations} isEmpty={() => false} empty={null}>{(data) => {
            const selectedOrganization = data.data.find((organization) => String(organization.id) === selectedOrganizationId) ?? data.data[0]
            return <>
              {data.data.length > 1 && <Form.Group controlId="navigation-settings-space" className="mb-2">
                <Form.Label>Espaço</Form.Label>
                <Form.Select value={selectedOrganization?.id ?? ''} onChange={(event) => setSelectedOrganizationId(event.target.value)}>
                  {data.data.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · {organization.type === 'independent' ? 'Particular' : 'CFC'}</option>)}
                </Form.Select>
              </Form.Group>}
              {selectedOrganization && <NavigationSettings organization={selectedOrganization} />}
              {!selectedOrganization && <p className="mb-0 small text-secondary">Entre em um espaço para organizar os módulos do menu.</p>}
            </>
          }}</QueryState>
        </Card.Body></Card>
        <div><ChangePasswordCard /></div>
        <div><MutedNoticesSettings /></div>
      </div>
    </>
  )
}
