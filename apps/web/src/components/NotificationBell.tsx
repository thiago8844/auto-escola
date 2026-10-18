import { Dropdown } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { NOTICE_TYPES } from '../config/notices'
import { selectUnreadCount, useNotificationStore } from '../stores/notificationStore'
import { formatRelativeTime } from '../utils/formatRelativeTime'

// O sino: central de notificações do usuário (para quem usa o sistema, não para os clientes)
export function NotificationBell() {
  const items = useNotificationStore((state) => state.items)
  const unread = useNotificationStore(selectUnreadCount)
  const { markRead, markAllRead, remove } = useNotificationStore.getState()
  const navigate = useNavigate()

  const label = unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'

  return (
    <Dropdown align="end" autoClose="outside">
      <Dropdown.Toggle variant="outline-secondary" className="bell-toggle position-relative" id="notification-bell" aria-label={label}>
        <i className={`bi ${unread > 0 ? 'bi-bell-fill' : 'bi-bell'}`} aria-hidden="true" />
        {unread > 0 && (
          <span className="bell-badge" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Dropdown.Toggle>

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
            Nenhuma notificação por enquanto.
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
