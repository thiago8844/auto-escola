import { useState } from 'react'
import { Alert, Button, Form, Spinner, Table } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { ConfirmModal } from '../../components/ConfirmModal'
import { QueryErrorAlert } from '../../components/QueryErrorAlert'
import { RoleBadge } from '../../components/RoleBadge'
import { ROLE_LABELS } from '../../config/organization'
import { paths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useChangeMemberRole, useMembers, useRemoveMember } from '../../hooks/useMembers'
import { useAuthStore } from '../../stores/authStore'
import type { Member, Role } from '../../types/organization'
import { formatDate } from '../../utils/formatDate'
import { assignableRoles, canManageMember } from '../../utils/permissions'

export default function MembersPage() {
  const organization = useActiveOrganization()
  const navigate = useNavigate()
  const currentUserId = useAuthStore((state) => state.user?.id)
  const members = useMembers(organization.id)
  const changeRole = useChangeMemberRole(organization.id)
  const remove = useRemoveMember(organization.id)
  const [toRemove, setToRemove] = useState<Member | null>(null)

  const roleOptions = assignableRoles(organization.role)

  function confirmRemove() {
    if (!toRemove) return
    const removingSelf = toRemove.id === currentUserId
    remove.mutate(toRemove.id, {
      onSuccess: () => {
        setToRemove(null)
        if (removingSelf) navigate(paths.organizations)
      },
      onError: () => setToRemove(null),
    })
  }

  return (
    <>
      <h1 className="mb-4">Membros</h1>

      {members.isPending && !members.error && <Spinner animation="border" role="status" variant="primary" />}
      {members.error && <QueryErrorAlert error={members.error} onRetry={() => void members.refetch()} />}

      {members.data && (
        <>
          {members.data.meta.total > members.data.data.length && (
            <Alert variant="info">Mostrando {members.data.data.length} de {members.data.meta.total} membros.</Alert>
          )}
          <Table responsive hover className="align-middle bg-white">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">E-mail</th>
                <th scope="col">Papel</th>
                <th scope="col">Desde</th>
                <th scope="col" className="text-end">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {members.data.data.map((member) => {
                const manageable = canManageMember(organization.role, member.role)
                const isSelf = member.id === currentUserId
                const changing = changeRole.isPending && changeRole.variables.userId === member.id

                return (
                  <tr key={member.id}>
                    <td>
                      {member.name} {isSelf && <span className="text-secondary small">(você)</span>}
                    </td>
                    <td className="text-break">{member.email}</td>
                    <td>
                      {manageable ? (
                        <Form.Select
                          size="sm"
                          className="role-select"
                          aria-label={`Papel de ${member.name}`}
                          value={member.role}
                          disabled={changing}
                          onChange={(event) => changeRole.mutate({ userId: member.id, role: event.target.value as Role })}
                        >
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </Form.Select>
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </td>
                    <td className="tabular-nums">{formatDate(member.joined_at)}</td>
                    <td className="text-end">
                      {manageable && (
                        <Button variant="outline-danger" size="sm" onClick={() => setToRemove(member)}>
                          {isSelf ? 'Sair do espaço' : 'Remover'}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
          {organization.role === 'admin' && (
            <p className="small text-secondary">Gestores só alteram membros com papel de equipe ou instrutor.</p>
          )}
        </>
      )}

      <ConfirmModal
        show={toRemove !== null}
        title={toRemove?.id === currentUserId ? 'Sair do espaço' : 'Remover acesso'}
        confirmLabel={toRemove?.id === currentUserId ? 'Sair' : 'Remover'}
        pending={remove.isPending}
        onConfirm={confirmRemove}
        onCancel={() => setToRemove(null)}
      >
        {toRemove?.id === currentUserId
          ? 'Você perderá o acesso a este espaço.'
          : `${toRemove?.name} perderá o acesso a este espaço. Alunos e aulas continuam cadastrados.`}
      </ConfirmModal>
    </>
  )
}
