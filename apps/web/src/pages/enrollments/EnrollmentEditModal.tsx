import { Button, Form, Modal } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { FormErrorAlert } from '../../components/FormErrorAlert'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { LICENSE_CATEGORIES, PROCESS_TYPE_LABELS } from '../../config/domain'
import { useUpdateEnrollment } from '../../hooks/useEnrollments'
import { usePartners } from '../../hooks/usePartners'
import { useProcesses } from '../../hooks/useProcesses'
import type { Enrollment } from '../../types/enrollment'
import type { Organization } from '../../types/organization'
import { applyFieldErrors } from '../../utils/applyFieldErrors'

type FormValues = { category: string; partner_id: string; qualification_process_id: string; notes: string }

type EnrollmentEditModalProps = { organization: Organization; enrollment: Enrollment; onClose: () => void }

// Corrige categoria, processo, parceiro e observações. Preço e minutos contratados mudam só por acréscimo ou ajuste no saldo.
// A API recusa o que alteraria histórico (categoria com aulas, saldo ou exames) e explica o motivo.
export function EnrollmentEditModal({ organization, enrollment, onClose }: EnrollmentEditModalProps) {
  const update = useUpdateEnrollment(organization.id, String(enrollment.id), enrollment.updated_at)
  const independent = organization.type === 'independent'
  const partners = usePartners(organization.id, { page: 1, all: true }, independent)
  const processes = useProcesses(organization.id, { page: 1, studentId: enrollment.student?.id })

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      category: enrollment.category,
      partner_id: enrollment.partner ? String(enrollment.partner.id) : '',
      qualification_process_id: enrollment.qualification_process_id ? String(enrollment.qualification_process_id) : '',
      notes: enrollment.notes ?? '',
    },
  })

  const onSubmit = handleSubmit((values) =>
    update.mutate(
      {
        category: values.category !== enrollment.category ? values.category : undefined,
        partner_id: values.partner_id ? Number(values.partner_id) : null,
        qualification_process_id: values.qualification_process_id ? Number(values.qualification_process_id) : null,
        notes: values.notes.trim() || null,
      },
      { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) },
    ),
  )

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Corrigir matrícula
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          <FormErrorAlert error={update.error} />
          <SelectField label="Categoria" error={errors.category?.message} {...register('category')}>
            {LICENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </SelectField>
          <Form.Text className="d-block mb-3">A categoria só muda enquanto a matrícula não tem aulas, saldo nem exames. Depois disso, crie outra matrícula.</Form.Text>
          <SelectField label="Processo de habilitação" error={errors.qualification_process_id?.message} {...register('qualification_process_id')}>
            <option value="">Sem processo (a prática não é bloqueada)</option>
            {processes.data?.data.map((process) => (
              <option key={process.id} value={process.id}>
                {PROCESS_TYPE_LABELS[process.type]} · {process.uf} · pretende {process.target_categories.join(', ')}
              </option>
            ))}
          </SelectField>
          {independent && (
            <SelectField label="Auto escola parceira" error={errors.partner_id?.message} {...register('partner_id')}>
              <option value="">Nenhuma</option>
              {partners.data?.data.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </SelectField>
          )}
          <TextAreaField label="Observações do contrato" error={errors.notes?.message} {...register('notes')} />
          <p className="small text-secondary mb-0">Valor e minutos contratados não mudam aqui: use “Acréscimo” ou “Ajuste” no saldo, que ficam no extrato.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={update.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={update.isPending}>Salvar correção</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
