import { Badge, OverlayTrigger, ProgressBar, Tooltip } from 'react-bootstrap'
import type { BalanceRow } from '../types/balance'
import { formatMinutes } from '../utils/formatMinutes'

type BalanceBarProps = { balance: BalanceRow; height?: number }

// Barra segmentada: consumido, reservado e disponível, na proporção do que foi contratado
export function BalanceBar({ balance, height = 12 }: BalanceBarProps) {
  const total = Math.max(balance.contracted, balance.consumed + balance.reserved, 1)
  const pct = (value: number) => (Math.max(value, 0) / total) * 100
  const description = `${formatMinutes(balance.consumed)} consumidos, ${formatMinutes(balance.reserved)} reservados, ${formatMinutes(Math.max(balance.available, 0))} disponíveis de ${formatMinutes(balance.contracted)} contratados`

  return (
    <ProgressBar style={{ height }} className="balance-bar" role="img" aria-label={description}>
      <ProgressBar variant="primary" now={pct(balance.consumed)} key="consumed" />
      <ProgressBar variant="info" now={pct(balance.reserved)} key="reserved" />
      <ProgressBar variant="success" now={pct(balance.available)} key="available" />
    </ProgressBar>
  )
}

const STATS: Array<{ key: keyof BalanceRow; label: string; hint: string; dot: string }> = [
  { key: 'contracted', label: 'Contratado', hint: 'Soma de contratações, acréscimos e ajustes no extrato.', dot: 'bg-secondary' },
  { key: 'reserved', label: 'Reservado', hint: 'Minutos de aulas agendadas que ainda não aconteceram.', dot: 'bg-info' },
  { key: 'realized', label: 'Realizado', hint: 'Tempo de instrução efetivamente dado em aulas concluídas. Falta cobrada não entra aqui.', dot: 'bg-body-secondary border' },
  { key: 'consumed', label: 'Consumido', hint: 'Minutos descontados do pacote (aulas concluídas e faltas ou cancelamentos cobrados em contrato).', dot: 'bg-primary' },
  { key: 'available', label: 'Minutos para agendar', hint: 'Contratado − reservado − consumido: o que ainda pode ser agendado.', dot: 'bg-success' },
]

export function BalanceStats({ balance, reference }: { balance: BalanceRow; reference?: number | null }) {
  return (
    <dl className="balance-stats mb-0">
      {STATS.map(({ key, label, hint, dot }) => (
        <div key={key} className={`balance-stat ${key === 'available' ? 'balance-stat-main' : ''}`}>
          <dt>
            <span className={`balance-dot ${dot}`} aria-hidden="true" />
            {label}
            <OverlayTrigger placement="top" overlay={<Tooltip id={`hint-${key}`}>{hint}</Tooltip>}>
              <button type="button" className="balance-hint" aria-label={`O que é ${label.toLowerCase()}`}>
                <i className="bi bi-info-circle" aria-hidden="true" />
              </button>
            </OverlayTrigger>
          </dt>
          <dd className="tabular-nums" data-negative={balance[key] < 0 || undefined}>
            {formatMinutes(balance[key])}
            {reference ? <span className="balance-eq">≈ {Math.round((balance[key] / reference) * 100) / 100} aula(s)</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// Selo compacto para listas e formulários
export function BalanceBadge({ available, hasPackage }: { available: number; hasPackage: boolean }) {
  if (!hasPackage) return <Badge bg="secondary">Sem pacote</Badge>
  if (available <= 0) {
    return (
      <Badge bg={available < 0 ? 'danger' : 'warning'}>
        <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true" />
        {available < 0 ? `Excedido em ${formatMinutes(-available)}` : 'Sem minutos para agendar'}
      </Badge>
    )
  }
  return (
    <Badge bg="success">
      <i className="bi bi-hourglass-split me-1" aria-hidden="true" />
      {formatMinutes(available)} disponíveis
    </Badge>
  )
}
