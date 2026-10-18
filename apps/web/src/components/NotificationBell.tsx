import { Dropdown } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PRIORITY_NOTICE } from '../config/alerts'
import { NOTICE_TYPES } from '../config/notices'
import { organizationPaths } from '../config/paths'
import { useAlertSummary, useAlerts, useArchiveAlert, useMarkAlertRead, useMarkAllAlertsRead, useRefreshAlerts } from '../hooks/useAlerts'
import { selectUnreadCount, useNotificationStore } from '../stores/notificationStore'
import { alertPath } from '../utils/alertPath'
import { formatRelativeTime } from '../utils/formatRelativeTime'

// O sino: dentro de um espaço mostra as notificações reais (guardadas no servidor); fora dele, avisos da sessão.
export function NotificationBell() {
  const { organizationId } = useParams()
  return organizationId ? <OrganizationBell organizationId={Number(organizationId)} /> : <SessionBell />
}

function BellToggle({ unread }: { unread: number }) {
  const label = unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'
  return (
    <Dropdown.Toggle variant="outline-secondary" className="bell-toggle position-relative" id="notification-bell" aria-label={label}>
      <i className={`bi ${unread > 0 ? 'bi-bell-fill' : 'bi-bell'}`} aria-hidden="true" />
      {unread > 0 && (
        <span className="bell-badge" aria-hidden="true">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Dropdown.Toggle>
  )
}

function OrganizationBell({ organizationId }: { organizationId: number }) {
  const navigate = useNavigate()
  const links = organizationPaths(organizationId)
  const summary = useAlertSummary(organizationId)
  const list = useAlerts(organizationId, { page: 1, perPage: 8, status: 'open' })
  const markRead = useMarkAlertRead(organizationId)
  const markAll = useMarkAllAlertsRead(organizationId)
  const archive = useArchiveAlert(organizationId)
  const refresh = useRefreshAlerts(organizationId)
  const sessionItems = useNotificationStore((state) => state.items)
  const { markRead: markSessionRead, remove } = useNotificationStore.getState()

  const unread = (summary.data?.unread ?? 0) + sessionItems.filter((n) => !n.readAt).length
  const alerts = list.data?.data ?? []

  return (
    <Dropdown align="end" autoClose="outside" onToggle={(open) => open && !refresh.isPending && refresh.mutate(undefined)}>
      <BellToggle unread={unread} />

      <Dropdown.Menu className="notification-menu p-0">
        <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
          <h2 className="h6 mb-0">Notificações</h2>
          <button type="button" className="btn btn-link btn-sm p-0" disabled={(summary.data?.unread ?? 0) === 0 || markAll.isPending} onClick={() => markAll.mutate(undefined)}>
            Marcar todas como lidas
          </button>
        </div>

        {list.error && !list.data ? (
          <div className="px-3 py-4 text-center text-secondary small">
            Não foi possível carregar as notificações.{' '}
            <button type="button" className="btn btn-link btn-sm p-0" onClick={() => void list.refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : alerts.length === 0 && sessionItems.length === 0 ? (
          <div className="text-center text-secondary px-3 py-5">
            <i className="bi bi-check2-circle fs-2 d-block mb-2" aria-hidden="true" />
            Tudo em dia. Nenhuma notificação no momento.
          </div>
        ) : (
          <ul className="list-unstyled mb-0 notification-list">
            {alerts.map((alert) => {
              const type = NOTICE_TYPES[PRIORITY_NOTICE[alert.priority]]
              return (
                <li key={alert.id} className={`notification-item notice-${PRIORITY_NOTICE[alert.priority]}${alert.read_at ? '' : ' is-unread'}`}>
                  <span className="notification-icon" aria-hidden="true">
                    <i className={`bi ${type.icon}`} />
                  </span>
                  <div className="min-w-0 flex-grow-1">
                    <p className="notification-title">
                      {!alert.read_at && <span className="visually-hidden">Não lida: </span>}
                      {alert.priority === 'critical' && <span className="visually-hidden">Urgente: </span>}
                      {alert.title}
                    </p>
                    {alert.message && <p className="notification-message">{alert.message}</p>}
                    <div className="d-flex flex-wrap align-items-center gap-3">
                      <span className="small text-secondary">{formatRelativeTime(alert.first_seen_at)}</span>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0"
                        onClick={() => {
                          if (!alert.read_at) markRead.mutate(alert.id)
                          navigate(alertPath(organizationId, alert))
                        }}
                      >
                        Abrir
                      </button>
                      {!alert.read_at && (
                        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => markRead.mutate(alert.id)}>
                          Marcar como lida
                        </button>
                      )}
                    </div>
                  </div>
                  <button type="button" className="btn-close notification-remove" aria-label={`Arquivar: ${alert.title}`} onClick={() => archive.mutate(alert.id)} />
                </li>
              )
            })}
            {sessionItems.map((item) => (
              <li key={item.id} className={`notification-item notice-${item.type}${item.readAt ? '' : ' is-unread'}`}>
                <span className="notification-icon" aria-hidden="true">
                  <i className={`bi ${NOTICE_TYPES[item.type].icon}`} />
                </span>
                <div className="min-w-0 flex-grow-1">
                  <p className="notification-title">{item.title}</p>
                  {item.message && <p className="notification-message">{item.message}</p>}
                  {!item.readAt && (
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={() => markSessionRead(item.id)}>
                      Marcar como lida
                    </button>
                  )}
                </div>
                <button type="button" className="btn-close notification-remove" aria-label={`Remover: ${item.title}`} onClick={() => remove(item.id)} />
              </li>
            ))}
          </ul>
        )}

        <div className="border-top px-3 py-2 d-flex justify-content-between align-items-center">
          <Link to={links.alerts} className="small">
            Ver todas as notificações{summary.data && summary.data.open > alerts.length ? ` (${summary.data.open})` : ''}
          </Link>
        </div>
      </Dropdown.Menu>
    </Dropdown>
  )
}

// Fora de um espaço (ex.: Minha agenda) não há notificações do espaço: só avisos da sessão
function SessionBell() {
  const items = useNotificationStore((state) => state.items)
  const unread = useNotificationStore(selectUnreadCount)
  const { markRead, markAllRead, remove } = useNotificationStore.getState()
  const navigate = useNavigate()

  return (
    <Dropdown align="end" autoClose="outside">
      <BellToggle unread={unread} />

      <Dropdown.Menu className="notification-menu p-0">
        <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
          <h2 className="h6 mb-0">Notificações</h2>
          <button type="button" className="btn btn-link btn-sm p-0" disabled={unread === 0} onClick={() => markAllRead()}>
            Marcar todas como lidas
          </button>
        </div>

        {items.length === 0 ? (
          <div className="text-center text-secondary px-3 py-5">
            <i className="bi bi-bell-slash fs-2 d-block mb-2" aria-hidden="true" />
            Nenhuma notificação por enquanto. As notificações aparecem aqui dentro de cada espaço.
          </div>
        ) : (
          <ul className="list-unstyled mb-0 notification-list">
            {items.map((item) => {
              const type = NOTICE_TYPES[item.type]
              return (
                <li key={item.id} className={`notification-item notice-${item.type}${item.readAt ? '' : ' is-unread'}`}>
                  <span className="notification-icon" aria-hidden="true">
                    <i className={`bi ${type.icon}`} />
                  </span>
                  <div className="min-w-0 flex-grow-1">
                    <p className="notification-title">
                      {!item.readAt && <span className="visually-hidden">Não lida: </span>}
                      {item.title}
                    </p>
                    {item.message && <p className="notification-message">{item.message}</p>}
                    <div className="d-flex flex-wrap align-items-center gap-3">
                      <span className="small text-secondary">{formatRelativeTime(item.createdAt)}</span>
                      {item.action && (
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0"
                          onClick={() => {
                            markRead(item.id)
                            item.action?.onClick?.()
                            if (item.action?.to) navigate(item.action.to)
                          }}
                        >
                          {item.action.label}
                        </button>
                      )}
                      {!item.readAt && (
                        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => markRead(item.id)}>
                          Marcar como lida
                        </button>
                      )}
                    </div>
                  </div>
                  <button type="button" className="btn-close notification-remove" aria-label={`Remover: ${item.title}`} onClick={() => remove(item.id)} />
                </li>
              )
            })}
          </ul>
        )}
      </Dropdown.Menu>
    </Dropdown>
  )
}
