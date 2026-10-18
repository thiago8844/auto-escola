import { Alert } from 'react-bootstrap'
import { PageHeader } from '../../components/PageHeader'
import { Timeline } from '../../components/Timeline'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'

// Trilha de auditoria do espaço: acesso, saldo, aulas, exames, taxas, documentos e processos
export default function AuditPage() {
  const organization = useActiveOrganization()

  return (
    <>
      <PageHeader title="Auditoria" subtitle="Registro das ações críticas do espaço: quem fez, quando e por quê. Os eventos não podem ser editados nem apagados." />
      <Alert variant="secondary" className="small">
        Visível apenas para proprietário e gestor. Correções entram como novos eventos e nunca sobrescrevem o histórico.
      </Alert>
      <Timeline organizationId={organization.id} timezone={organization.timezone} scope={{ kind: 'organization' }} emptyMessage="Nenhum evento registrado ainda." />
    </>
  )
}
