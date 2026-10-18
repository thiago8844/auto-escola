import { Card, ProgressBar } from 'react-bootstrap'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getOnboarding, type OnboardingStep } from '../api/onboarding'
import { SUPPORT_EMAIL } from '../config'
import { organizationPaths } from '../config/paths'
import { queryKeys } from '../lib/queryKeys'

const TARGETS = (organizationId: number): Record<string, { to: string; label: string }> => {
  const links = organizationPaths(organizationId)
  return {
    profile: { to: links.settings, label: 'Completar dados' },
    instructor: { to: links.instructorNew, label: 'Cadastrar instrutor' },
    vehicle: { to: links.vehicleNew, label: 'Cadastrar veículo' },
    student: { to: links.studentNew, label: 'Cadastrar aluno' },
    enrollment: { to: links.students, label: 'Escolher o aluno' },
    package: { to: links.enrollments, label: 'Abrir matrículas' },
    lesson: { to: links.scheduleNew(), label: 'Agendar aula' },
  }
}

// Primeiros passos do espaço: mostra o que falta e leva direto à tela certa. Some quando tudo estiver feito.
export function OnboardingGuide({ organizationId }: { organizationId: number }) {
  const query = useQuery({ queryKey: [...queryKeys.organizations.detail(organizationId), 'onboarding'], queryFn: () => getOnboarding(organizationId) })
  const data = query.data
  if (!data || data.done === data.total) return null

  const targets = TARGETS(organizationId)
  const next = data.steps.find((step) => !step.done)
  const support = data.support_email ?? SUPPORT_EMAIL

  return (
    <Card className="mb-4 border-primary">
      <Card.Body>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <Card.Title as="h2" className="h5 mb-0">
            Primeiros passos
          </Card.Title>
          <span className="small text-secondary">
            {data.done} de {data.total} concluídos
          </span>
        </div>
        <ProgressBar now={(data.done / data.total) * 100} className="mb-3" aria-label="Progresso dos primeiros passos" />
        <ol className="list-unstyled d-grid gap-2 mb-3">
          {data.steps.map((step) => (
            <Step key={step.key} step={step} target={targets[step.key]} highlight={step === next} />
          ))}
        </ol>
        <p className="small text-secondary mb-0">
          Precisa de ajuda?{' '}
          {support ? <a href={`mailto:${support}`}>Fale com o suporte ({support})</a> : 'O canal de suporte será informado pela equipe do sistema.'}
        </p>
      </Card.Body>
    </Card>
  )
}

function Step({ step, target, highlight }: { step: OnboardingStep; target?: { to: string; label: string }; highlight: boolean }) {
  return (
    <li className="d-flex flex-wrap align-items-center gap-2">
      <i className={`bi ${step.done ? 'bi-check-circle-fill text-success' : 'bi-circle text-secondary'}`} aria-hidden="true" />
      <span className="visually-hidden">{step.done ? 'Feito: ' : 'Falta: '}</span>
      <div className="flex-grow-1">
        <span className={step.done ? 'text-secondary text-decoration-line-through' : 'fw-semibold'}>{step.label}</span>
        {!step.done && <div className="small text-secondary">{step.hint}</div>}
      </div>
      {!step.done && target && (
        <Link to={target.to} className={`btn btn-sm ${highlight ? 'btn-primary' : 'btn-outline-secondary'}`}>
          {target.label}
        </Link>
      )}
    </li>
  )
}

