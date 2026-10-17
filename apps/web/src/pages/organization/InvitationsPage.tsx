import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Alert, Badge, Button, Card, Form, Spinner, Table } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { ConfirmModal } from '../../components/ConfirmModal'
import { FormField } from '../../components/FormField'
import { QueryErrorAlert } from '../../components/QueryErrorAlert'
import { SubmitButton } from '../../components/SubmitButton'
import { INVITATION_STATUS, ROLE_LABELS } from '../../config/organization'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useCreateInvitation, useInvitations, useRevokeInvitation } from '../../hooks/useInvitations'
import { invitationSchema, type InvitationInput } from '../../schemas/invitation'
import type { Invitation } from '../../types/organization'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { formatDate } from '../../utils/formatDate'
import { assignableRoles } from '../../utils/permissions'

export default function InvitationsPage() {
  const organization = useActiveOrganization()
  const roleOptions = assignableRoles(organization.role)
  const invitations = useInvitations(organization.id)
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
      <h1 className="mb-4">Convites</h1>

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

      {invitations.isPending && !invitations.error && <Spinner animation="border" role="status" variant="primary" />}
      {invitations.error && <QueryErrorAlert error={invitations.error} onRetry={() => void invitations.refetch()} />}

      {invitations.data && (
        <>
          {invitations.data.meta.total > invitations.data.data.length && (
            <Alert variant="info">Mostrando {invitations.data.data.length} de {invitations.data.meta.total} convites.</Alert>
          )}
          {invitations.data.data.length === 0 ? (
            <p className="text-secondary">Nenhum convite enviado ainda.</p>
          ) : (
            <Table responsive hover className="align-middle bg-white">
              <thead>
                <tr>
                  <th scope="col">E-mail</th>
                  <th scope="col">Papel</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Validade</th>
                  <th scope="col" className="text-end">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.data.data.map((invitation) => {
                  const status = INVITATION_STATUS[invitation.status]
                  return (
                    <tr key={invitation.id}>
                      <td className="text-break">{invitation.email}</td>
                      <td>{ROLE_LABELS[invitation.role]}</td>
                      <td>
                        <Badge bg={status.bg} text={status.bg === 'warning' ? 'dark' : undefined}>
                          <i className={`bi ${status.icon} me-1`} aria-hidden="true" />
                          {status.label}
                        </Badge>
                      </td>
                      <td className="tabular-nums">{formatDate(invitation.expires_at)}</td>
                      <td className="text-end">
                        {invitation.status === 'pending' && (
                          <Button variant="outline-danger" size="sm" onClick={() => setToRevoke(invitation)}>
                            Cancelar
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </>
      )}

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
