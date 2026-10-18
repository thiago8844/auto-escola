import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Modal } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { assignEnrollment } from '../../api/assignments'
import { FormErrorMessage } from '../../components/FormErrorMessage'
import { organizationPaths } from '../../config/paths'
import { useDraftProtection } from '../../hooks/useFormProtection'
import { useInstructors } from '../../hooks/useInstructors'
import { queryKeys } from '../../lib/queryKeys'
import { notify } from '../../stores/toastStore'
import type { Enrollment, LicenseCategory } from '../../types/enrollment'
import { categoryComponents } from '../../utils/category'

export function AssignmentPanel({ organizationId, enrollment, operate }: { organizationId: number; enrollment: Enrollment; operate: boolean }) {
  const [editing, setEditing] = useState(false)
  const assigned = enrollment.assignment
  const links = organizationPaths(organizationId)
  return <section className="border rounded p-3 mb-4" aria-label="Encaminhamento ao instrutor">
    <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center">
      <div><h2 className="h6 mb-1">Instrutor responsável</h2>
        {assigned ? operate ? <Link to={links.instructor(assigned.instructor_id)}>{assigned.instructor_name}</Link> : <span>{assigned.instructor_name}</span> : <span className="text-secondary">Ainda não encaminhado</span>}
      </div>
      {operate && <Button size="sm" variant="outline-primary" onClick={() => setEditing(true)}>{assigned ? 'Alterar encaminhamento' : 'Encaminhar ao instrutor'}</Button>}
    </div>
    <p className="small text-secondary mt-2 mb-0">O encaminhamento permite acompanhar o aluno. Horários de aula são definidos separadamente.</p>
    {editing && <AssignmentModal organizationId={organizationId} enrollment={enrollment} onClose={() => setEditing(false)} />}
  </section>
}

function AssignmentModal({ organizationId, enrollment, onClose }: { organizationId: number; enrollment: Enrollment; onClose: () => void }) {
  const [instructorId, setInstructorId] = useState(String(enrollment.assignment?.instructor_id ?? ''))
  const instructors = useInstructors(organizationId, { page: 1, active: true, all: true })
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => assignEnrollment(organizationId, enrollment, instructorId ? Number(instructorId) : null),
    onSuccess: async () => { protection.saved(); await client.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }); notify.success(instructorId ? 'Aluno encaminhado ao instrutor.' : 'Encaminhamento removido.'); onClose() },
  })
  const protection = useDraftProtection(instructorId, onClose, mutation.isPending)
  const needed = categoryComponents(enrollment.category)
  const eligible = instructors.data?.data.filter((instructor) => instructor.categories.some((category: LicenseCategory) => categoryComponents(category).some((simple) => needed.includes(simple)))) ?? []
  const closed = enrollment.status === 'closed' || enrollment.status === 'terminated'
  return <Modal show onHide={protection.close} centered>
    <Modal.Header closeButton><Modal.Title as="h2" className="h5">Encaminhar ao instrutor</Modal.Title></Modal.Header>
    <Modal.Body>
      <FormErrorMessage message={mutation.error?.message ?? instructors.error?.message ?? null} />
      <Form.Label htmlFor="assignment-instructor">Responsável · categoria {enrollment.category}</Form.Label>
      <Form.Select id="assignment-instructor" value={instructorId} onChange={(event) => setInstructorId(event.target.value)} disabled={mutation.isPending || instructors.isPending}>
        <option value="">Sem encaminhamento</option>
        {eligible.map((instructor) => <option key={instructor.id} value={instructor.id} disabled={closed}>{instructor.full_name}{!instructor.has_account ? ' · sem conta de acesso' : ''}</option>)}
      </Form.Select>
      {closed && <p className="small mt-2">Reabra a matrícula para encaminhar a outro instrutor. Você pode remover o encaminhamento atual.</p>}
      <p className="small text-secondary mt-2 mb-0">O instrutor com acesso a este espaço verá nome, telefone e dados operacionais da matrícula. Esta ação não reserva horário nem altera o pacote de aulas.</p>
      {!instructors.isPending && eligible.length === 0 && <p className="small mt-2">Nenhum instrutor ativo atende esta categoria. Confira os vínculos em Instrutores.</p>}
    </Modal.Body>
    <Modal.Footer><Button variant="outline-secondary" onClick={protection.close}>Cancelar</Button><Button disabled={mutation.isPending || instructors.isPending || !!instructors.error || instructorId === String(enrollment.assignment?.instructor_id ?? '')} onClick={() => mutation.mutate()}>Salvar encaminhamento</Button></Modal.Footer>
  </Modal>
}
