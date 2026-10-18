import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Alert, Badge, Button, Card, Form } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { ConfirmModal } from '../../components/ConfirmModal'
import { FormField } from '../../components/FormField'
import { Pagination } from '../../components/Pagination'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { SubmitButton } from '../../components/SubmitButton'
import { INVITATION_STATUS, PAGE_SIZE, ROLE_LABELS } from '../../config/organization'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { useCreateInvitation, useInvitations, useRevokeInvitation } from '../../hooks/useInvitations'
import { invitationSchema, type InvitationInput } from '../../schemas/invitation'
import type { Invitation } from '../../types/organization'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { formatDate } from '../../utils/formatDate'
import { assignableRoles } from '../../utils/permissions'

export default function InvitationsPage() {
  const organization = useActiveOrganization()
  const roleOptions = assignableRoles(organization.role)
  const [page, setPage] = usePageParam()
  const invitations = useInvitations(organization.id, page)
  useClampPage(page, invitations.data?.meta.last_page, setPage)
  const create = useCreateInvitation(organization.id)
  const revoke = useRevokeInvitation(organization.id)
  const [toRevoke, setToRevoke] = useState<Invitation | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<InvitationInput>({
    resolver: zodResolver(invitationSchema),
    defaultValues: { email: '', role: roleOptions.includes('staff') ? 'staff' : roleOptions[0] },
  })

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: () => reset({ email: '', role: values.role }),
      onError: (error) => applyFieldErrors(error, setError),
    }),
  )
  const alertMessage = formAlertMessage(create.error)

  function confirmRevoke() {
    if (!toRevoke) return
    revoke.mutate(toRevoke.id, { onSettled: () => setToRevoke(null) })
  }

  return (
    <>
      <PageHeader title="Convites" />

      <Card className="mb-4">
        <Card.Body>
          <Card.Title as="h2" className="h5">
            Convidar por e-mail
          </Card.Title>
          {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}
          {create.isSuccess && <Alert variant="success">Convite enviado.</Alert>}
          <form onSubmit={onSubmit} noValidate className="row g-3 align-items-start">
            <div className="col-md-6">
              <FormField label="E-mail" type="email" autoComplete="off" error={errors.email?.message} {...register('email')} />
            </div>
            <div className="col-md-3">
              <Form.Group controlId="role" className="mb-3">
                <Form.Label>Papel</Form.Label>
                <Form.Select isInvalid={!!errors.role} {...register('role')}>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">{errors.role?.message}</Form.Control.Feedback>
              </Form.Group>
            </div>
            <div className="col-md-3 pt-md-4 mt-md-2">
              <SubmitButton loading={create.isPending}>Enviar convite</SubmitButton>
            </div>
          </form>
        </Card.Body>
      </Card>

      <QueryState query={invitations} isEmpty={(data) => data.data.length === 0} empty="Nenhum convite enviado ainda.">
        {(data) => (
          <>
            <DataTable
              rows={data.data}
              getKey={(invitation) => invitation.id}
              columns={[
                { header: 'E-mail', primary: true, cell: (invitation) => <span className="text-break">{invitation.email}</span> },
                { header: 'Papel', cell: (invitation) => ROLE_LABELS[invitation.role] },
                {
                  header: 'Situação',
                  cell: (invitation) => {
                    const status = INVITATION_STATUS[invitation.status]
                    return (
                      <Badge bg={status.bg}>
                        <i className={`bi ${status.icon} me-1`} aria-hidden="true" />
                        {status.label}
                      </Badge>
                    )
                  },
                },
                { header: 'Validade', cell: (invitation) => <span className="tabular-nums">{formatDate(invitation.expires_at)}</span> },
                {
                  header: 'Ações',
                  actions: true,
                  cell: (invitation, { mobile }) =>
                    invitation.status === 'pending' && (
                      <Button variant="outline-danger" size={mobile ? undefined : 'sm'} className={mobile ? 'flex-fill' : undefined} onClick={() => setToRevoke(invitation)}>
                        Cancelar
                      </Button>
                    ),
                },
              ]}
            />
            <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </QueryState>

      <ConfirmModal
        show={toRevoke !== null}
        title="Cancelar convite"
        confirmLabel="Cancelar convite"
        pending={revoke.isPending}
        onConfirm={confirmRevoke}
        onCancel={() => setToRevoke(null)}
      >
        O convite para {toRevoke?.email} deixará de funcionar.
      </ConfirmModal>
    </>
  )
}
