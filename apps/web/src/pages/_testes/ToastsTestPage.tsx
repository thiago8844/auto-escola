import { Button, Card, Col, Row } from 'react-bootstrap'
import { PageHeader } from '../../components/PageHeader'
import { NOTICE_TYPES } from '../../config/notices'
import { notices } from '../../lib/notices'
import { useNotificationStore } from '../../stores/notificationStore'
import { usePreferencesStore } from '../../stores/preferencesStore'
import type { NoticeType } from '../../types/notice'

// PÁGINA DE TESTE (temporária): serve só para ver os avisos funcionando.
// Para remover: apague src/pages/_testes e src/config/testRoutes.tsx, e a linha de testRoutes em config/routes.tsx.

const types = Object.keys(NOTICE_TYPES) as NoticeType[]

const sampleText: Record<NoticeType, string> = {
  success: 'Aluno cadastrado com sucesso.',
  info: 'A agenda de amanhã já está disponível.',
  reminder: 'Você tem 3 aulas agendadas para amanhã.',
  warning: 'O CRLV do veículo ABC1D23 vence em 7 dias.',
  error: 'Não foi possível salvar. Tente novamente.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <Card.Body>
        <Card.Title as="h2" className="h5">
          {title}
        </Card.Title>
        {children}
      </Card.Body>
    </Card>
  )
}

export default function ToastsTestPage() {
  const muted = usePreferencesStore((state) => state.mutedNotices)
  const unmuteAll = usePreferencesStore((state) => state.unmuteAll)

  return (
    <>
      <PageHeader title="Teste de avisos" subtitle="Página temporária para testar toasts, o sino e o alerta máximo." />

      <Section title="1. Fecha sozinho (barra de tempo; passe o mouse para pausar)">
        <div className="d-flex flex-wrap gap-2">
          {types.map((type) => (
            <Button key={type} variant="outline-secondary" onClick={() => notices.toast({ type, message: sampleText[type] })}>
              {NOTICE_TYPES[type].label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="2. Só fecha no X (fica mais transparente após 5 s sem o mouse; passe o mouse para voltar ao normal)">
        <div className="d-flex flex-wrap gap-2">
          {types.map((type) => (
            <Button key={type} variant="outline-secondary" onClick={() => notices.toast({ type, message: sampleText[type], mode: 'sticky', key: `sticky-${type}` })}>
              {NOTICE_TYPES[type].label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="3. Empilhamento">
        <div className="d-flex flex-wrap gap-2">
          <Button
            variant="outline-primary"
            onClick={() => types.forEach((type, i) => setTimeout(() => notices.toast({ type, message: `${sampleText[type]} (${i + 1})`, key: `burst-${type}-${Date.now()}` }), i * 250))}
          >
            Disparar 5 de uma vez (um de cada tipo)
          </Button>
          <Button variant="outline-primary" onClick={() => Array.from({ length: 8 }, (_, i) => notices.toast({ type: 'info', message: `Aviso empilhado ${i + 1}`, mode: 'sticky', key: `many-${i}-${Date.now()}` }))}>
            Disparar 8 com X (só 5 aparecem; o resto espera vaga)
          </Button>
          <Button variant="outline-primary" onClick={() => notices.toast({ type: 'warning', message: `Mesma chave, atualizado às ${new Date().toLocaleTimeString('pt-BR')}`, key: 'mesma-chave' })}>
            Mesma chave (substitui em vez de empilhar)
          </Button>
        </div>
      </Section>

      <Section title="4. Com botão de ação e “Não mostrar novamente”">
        <div className="d-flex flex-wrap gap-2">
          <Button
            variant="outline-primary"
            onClick={() =>
              notices.toast({ type: 'reminder', title: 'Aulas de amanhã', message: 'Você tem 3 aulas agendadas.', action: { label: 'Abrir agenda', to: '/minha-agenda' } })
            }
          >
            Com ação (leva à Minha agenda)
          </Button>
          <Button
            variant="outline-primary"
            onClick={() =>
              notices.toast({ type: 'info', message: 'Dica: use a busca para achar alunos mais rápido.', mode: 'sticky', muteKey: 'teste.dica-busca', key: 'dica-busca' })
            }
          >
            Com “Não mostrar novamente” (com X)
          </Button>
          <Button
            variant="outline-primary"
            onClick={() => notices.toast({ type: 'warning', message: 'Seu navegador está desatualizado.', muteKey: 'teste.navegador', action: { label: 'Saiba mais', onClick: () => window.alert('Ação executada') } })}
          >
            Com ação + “Não mostrar novamente”
          </Button>
        </div>
        <p className="small text-secondary mt-3 mb-0">
          Silenciados agora: {Object.keys(muted).length === 0 ? 'nenhum' : Object.keys(muted).join(', ')}.{' '}
          <Button variant="link" size="sm" className="p-0 align-baseline" onClick={unmuteAll}>
            Reativar todos
          </Button>
          {' '}(ou use Configurações &gt; Avisos ocultos)
        </p>
      </Section>

      <Section title="5. Sino (central de notificações)">
        <div className="d-flex flex-wrap gap-2">
          <Button
            variant="outline-primary"
            onClick={() => notices.inbox({ id: `n-${Date.now()}`, type: 'info', title: 'Nova versão disponível', message: 'Veja o que mudou no sistema.' })}
          >
            Adicionar só no sino
          </Button>
          <Button
            variant="outline-primary"
            onClick={() =>
              notices.notify({ id: `n-${Date.now()}`, type: 'reminder', title: 'Aula amanhã às 09:00', message: 'Maria Souza · Categoria B', action: { label: 'Ver aula', to: '/minha-agenda' } })
            }
          >
            Sino + toast
          </Button>
          <Button
            variant="outline-primary"
            onClick={() => types.forEach((type) => notices.inbox({ id: `n-${type}-${Date.now()}`, type, title: NOTICE_TYPES[type].label, message: sampleText[type] }))}
          >
            Um de cada tipo no sino
          </Button>
          <Button variant="outline-secondary" onClick={() => useNotificationStore.getState().clear()}>
            Limpar o sino
          </Button>
        </div>
      </Section>

      <Section title="6. Alerta máximo (modal: só fecha confirmando)">
        <Row className="g-2">
          <Col xs={12} sm="auto">
            <Button
              variant="danger"
              className="w-100"
              onClick={() =>
                notices.critical({
                  id: 'teste-mensalidade',
                  title: 'Mensalidade vencida',
                  message: 'Sua mensalidade está em atraso. Se não for regularizada, o acesso ao sistema será bloqueado.',
                  details: ['Venceu em 10/10', 'Bloqueio em 5 dias'],
                  action: { label: 'Ver pagamento', to: '/configuracoes' },
                })
              }
            >
              Mensalidade vencida (vermelho)
            </Button>
          </Col>
          <Col xs={12} sm="auto">
            <Button
              variant="warning"
              className="w-100"
              onClick={() =>
                notices.critical({
                  id: 'teste-manutencao',
                  severity: 'warning',
                  title: 'Manutenção programada',
                  message: 'O sistema ficará indisponível amanhã entre 02:00 e 03:00.',
                  confirmLabel: 'Ok, anotei',
                  muteKey: 'teste.manutencao',
                })
              }
            >
              Manutenção (amarelo, com “não mostrar”)
            </Button>
          </Col>
          <Col xs={12} sm="auto">
            <Button
              variant="outline-danger"
              className="w-100"
              onClick={() => {
                notices.critical({ id: 'teste-fila-1', title: 'Primeiro alerta', message: 'Confirme para ver o próximo.' })
                notices.critical({ id: 'teste-fila-2', severity: 'warning', title: 'Segundo alerta', message: 'Os alertas aparecem um de cada vez.' })
              }}
            >
              Dois em fila
            </Button>
          </Col>
        </Row>
      </Section>
    </>
  )
}
