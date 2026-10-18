import { useState } from 'react'
import { Button, Form } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { ConfirmModal } from '../../components/ConfirmModal'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { RoleBadge } from '../../components/RoleBadge'
import { PAGE_SIZE, ROLE_LABELS } from '../../config/organization'
import { paths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useChangeMemberRole, useMembers, useRemoveMember } from '../../hooks/useMembers'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { useAuthStore } from '../../stores/authStore'
import type { Member, Role } from '../../types/organization'
import { formatDate } from '../../utils/formatDate'
import { assignableRoles, canManageMember } from '../../utils/permissions'

export default function MembersPage() {
  const organization = useActiveOrganization()
  const navigate = useNavigate()
  const currentUserId = useAuthStore((state) => state.user?.id)
  const [page, setPage] = usePageParam()
  const members = useMembers(organization.id, page)
  useClampPage(page, members.data?.meta.last_page, setPage)
  const changeRole = useChangeMemberRole(organization.id)
  const remove = useRemoveMember(organization.id)
  const [toRemove, setToRemove] = useState<Member | null>(null)

  const roleOptions = assignableRoles(organization.role)
  const removingSelf = toRemove?.id === currentUserId

  function confirmRemove() {
    if (!toRemove) return
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
      <PageHeader title="Membros" />

      <QueryState query={members} isEmpty={(data) => data.data.length === 0} empty="Nenhum membro encontrado.">
        {(data) => (
          <>
            <DataTable
              rows={data.data}
              getKey={(member) => member.id}
              columns={[
                {
                  header: 'Nome',
                  primary: true,
                  cell: (member) => (
                    <>
                      {member.name} {member.id === currentUserId && <span className="text-secondary small fw-normal">(você)</span>}
                    </>
                  ),
                },
                { header: 'E-mail', cell: (member) => <span className="text-break">{member.email}</span> },
                {
                  header: 'Papel',
                  cell: (member, { mobile }) =>
                    canManageMember(organization.role, member.role) ? (
                      <Form.Select
                        size={mobile ? undefined : 'sm'}
                        className="role-select"
                        aria-label={`Papel de ${member.name}`}
                        value={member.role}
                        disabled={changeRole.isPending && changeRole.variables.userId === member.id}
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
                    ),
                },
                { header: 'Desde', cell: (member) => <span className="tabular-nums">{formatDate(member.joined_at)}</span> },
                {
                  header: 'Ações',
                  actions: true,
                  cell: (member, { mobile }) =>
                    canManageMember(organization.role, member.role) && (
                      <Button variant="outline-danger" size={mobile ? undefined : 'sm'} className={mobile ? 'flex-fill' : undefined} onClick={() => setToRemove(member)}>
                        {member.id === currentUserId ? 'Sair do espaço' : 'Remover'}
                      </Button>
                    ),
                },
              ]}
            />
            <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
            {organization.role === 'admin' && <p className="small text-secondary mt-3">Gestores só alteram membros com papel de equipe ou instrutor.</p>}
          </>
        )}
      </QueryState>

      <ConfirmModal
        show={toRemove !== null}
        title={removingSelf ? 'Sair do espaço' : 'Remover acesso'}
        confirmLabel={removingSelf ? 'Sair' : 'Remover'}
        pending={remove.isPending}
        onConfirm={confirmRemove}
        onCancel={() => setToRemove(null)}
      >
        {removingSelf ? 'Você perderá o acesso a este espaço.' : `${toRemove?.name} perderá o acesso a este espaço. Alunos e aulas continuam cadastrados.`}
      </ConfirmModal>
    </>
  )
}
