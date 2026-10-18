import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Alert, Button, Col, Form, Modal, Row } from 'react-bootstrap'
import { useForm, useWatch } from 'react-hook-form'
import { CurrencyField } from '../../components/CurrencyField'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { FEE_PARTY_LABELS, FEE_STATUS } from '../../config/domain'
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_MB } from '../../schemas/document'
import { useFeeStatus, useSaveFee, useUploadExamDocument } from '../../hooks/useExams'
import { feeSchema, feeStatusSchema, type FeeFormInput, type FeeStatusInput } from '../../schemas/exam'
import type { Exam, ExternalFee, FeeParty, FeeStatus } from '../../types/exam'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { formatDate } from '../../utils/formatDate'

type FeeFormModalProps = { organizationId: number; processId: number; fee?: ExternalFee; exams: Exam[]; presetExamId?: number; onClose: () => void }

// Taxa externa: um registro por guia. Vincule a várias tentativas se a mesma guia vale para todas.
export function FeeFormModal({ organizationId, processId, fee, exams, presetExamId, onClose }: FeeFormModalProps) {
  const save = useSaveFee(organizationId, fee?.id ?? null)
  const upload = useUploadExamDocument(organizationId)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FeeFormInput>({
    resolver: zodResolver(feeSchema),
    defaultValues: {
      kind: fee?.kind ?? 'Taxa de exame prático',
      voucher_number: fee?.voucher_number ?? '',
      amount: fee?.amount_cents != null ? String(fee.amount_cents / 100) : '',
      issued_at: fee?.issued_at ?? '',
      due_date: fee?.due_date ?? '',
      reference: fee?.reference ?? '',
      obligor: fee?.obligor ?? 'student',
      notes: fee?.notes ?? '',
      exam_ids: (fee?.exam_ids ?? (presetExamId ? [presetExamId] : [])).map(String),
    },
  })
  const selected = useWatch({ control, name: 'exam_ids' })

  const onSubmit = handleSubmit(async (values) => {
    setFileError(null)
    let receiptId = fee?.receipt_document_id ?? null
    if (file) {
      if (file.size > DOCUMENT_MAX_MB * 1024 * 1024) return setFileError(`O arquivo deve ter no máximo ${DOCUMENT_MAX_MB} MB.`)
      try {
        receiptId = (await upload.mutateAsync({ file, type: 'payment_proof', processId })).id
      } catch {
        return setFileError('Não foi possível enviar o comprovante.')
      }
    }
    save.mutate(
      {
        ...(fee ? {} : { qualification_process_id: processId }),
        kind: values.kind,
        voucher_number: values.voucher_number || null,
        amount_cents: values.amount ? Math.round(Number(values.amount) * 100) : null,
        issued_at: values.issued_at || null,
        due_date: values.due_date || null,
        reference: values.reference || null,
        obligor: values.obligor,
        notes: values.notes || null,
        receipt_document_id: receiptId,
        exam_ids: values.exam_ids.map(Number),
      },
      { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) },
    )
  })
  const alertMessage = formAlertMessage(save.error)
  const busy = save.isPending || upload.isPending

  return (
    <Modal show onHide={onClose} centered size="lg" fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {fee ? 'Editar taxa externa' : 'Registrar taxa externa'}
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          <Alert variant="secondary" className="small">
            <i className="bi bi-info-circle me-2" aria-hidden="true" />
            Taxas de órgãos externos não são receita do espaço e não entram no caixa. Anexar o comprovante <strong>não confirma</strong> o pagamento: a confirmação é um passo separado.
          </Alert>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}
          <Row>
            <Col md={7}>
              <FormField label="Tipo da taxa" error={errors.kind?.message} {...register('kind')} />
            </Col>
            <Col md={5}>
              <FormField label="Número da guia" error={errors.voucher_number?.message} {...register('voucher_number')} />
            </Col>
          </Row>
          <Row>
            <Col md={4}>
              <CurrencyField control={control} name="amount" label="Valor emitido" error={errors.amount?.message} />
            </Col>
            <Col sm={6} md={4}>
              <FormField label="Emissão" type="date" error={errors.issued_at?.message} {...register('issued_at')} />
            </Col>
            <Col sm={6} md={4}>
              <FormField label="Vencimento" type="date" error={errors.due_date?.message} {...register('due_date')} />
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <SelectField label="Responsável pela obrigação" error={errors.obligor?.message} {...register('obligor')}>
                {Object.entries(FEE_PARTY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </Col>
            <Col md={6}>
              <FormField label="Referência" error={errors.reference?.message} {...register('reference')} />
            </Col>
          </Row>

          {exams.length > 0 && (
            <fieldset className="mb-3">
              <legend className="form-label fs-6">Tentativas de exame que esta guia cobre</legend>
              {exams.map((exam) => (
                <Form.Check
                  key={exam.id}
                  type="checkbox"
                  id={`fee-exam-${exam.id}`}
                  value={String(exam.id)}
                  label={`Categoria ${exam.category} · tentativa ${exam.attempt_number} · ${formatDate(exam.scheduled_at)}`}
                  checked={selected.includes(String(exam.id))}
                  {...register('exam_ids')}
                />
              ))}
              <Form.Text muted>Uma guia compartilhada é um único registro: não é contada duas vezes.</Form.Text>
            </fieldset>
          )}

          <Form.Group className="mb-3" controlId="fee-file">
            <Form.Label>Comprovante (opcional)</Form.Label>
            <Form.Control type="file" accept={DOCUMENT_ACCEPT} isInvalid={!!fileError} onChange={(event) => setFile((event.target as HTMLInputElement).files?.[0] ?? null)} />
            <Form.Control.Feedback type="invalid">{fileError}</Form.Control.Feedback>
            <Form.Text muted>PDF, JPG, PNG ou WebP, até {DOCUMENT_MAX_MB} MB. Fica privado, visível só à equipe.</Form.Text>
          </Form.Group>
          <TextAreaField label="Observações (opcional)" error={errors.notes?.message} {...register('notes')} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <SubmitButton loading={busy}>Salvar</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

const STATUS_HELP: Record<FeeStatus, string> = {
  unknown: 'Ainda não se sabe se a taxa foi paga.',
  pending: 'A guia existe e o pagamento ainda não foi feito.',
  payment_reported: 'O aluno ou alguém informou que pagou, mas ainda não houve conferência.',
  confirmed: 'A equipe conferiu o pagamento em uma fonte confiável. Fica registrado quem conferiu, quando e a fonte.',
  waived: 'A taxa não é devida. Informe o motivo da isenção.',
  cancelled: 'A guia foi cancelada. Esta situação é definitiva.',
}

export function FeeStatusModal({ organizationId, fee, onClose }: { organizationId: number; fee: ExternalFee; onClose: () => void }) {
  const change = useFeeStatus(organizationId, fee.id)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FeeStatusInput>({
    resolver: zodResolver(feeStatusSchema),
    defaultValues: { status: fee.status === 'unknown' ? 'pending' : fee.status, reason: '', confirmation_source: fee.confirmation_source ?? '', paid_by: fee.paid_by ?? '' },
  })
  const status = useWatch({ control, name: 'status' })

  const onSubmit = handleSubmit((values) =>
    change.mutate(
      { status: values.status, reason: values.reason || null, confirmation_source: values.confirmation_source || null, paid_by: (values.paid_by || null) as FeeParty | null },
      { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) },
    ),
  )
  const alertMessage = formAlertMessage(change.error)

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Situação da taxa
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}
          <SelectField label="Nova situação" error={errors.status?.message} {...register('status')}>
            {(Object.keys(FEE_STATUS) as FeeStatus[]).map((value) => (
              <option key={value} value={value}>
                {FEE_STATUS[value].label}
              </option>
            ))}
          </SelectField>
          <p className="small text-secondary">{STATUS_HELP[status]}</p>

          {status === 'confirmed' && (
            <>
              <FormField label="Fonte da confirmação" hint="Ex.: consulta ao portal do órgão, extrato bancário, recibo." error={errors.confirmation_source?.message} {...register('confirmation_source')} />
              <SelectField label="Quem pagou de fato" error={errors.paid_by?.message} {...register('paid_by')}>
                <option value="">Escolha</option>
                {Object.entries(FEE_PARTY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <p className="small text-secondary">
                Se o espaço pagou por conta de outra pessoa, o adiantamento fica marcado como “reembolso a acertar”. Pagamento direto pelo aluno ao órgão não entra no caixa.
              </p>
            </>
          )}
          {(status === 'waived' || status === 'cancelled') && <TextAreaField label="Motivo" error={errors.reason?.message} {...register('reason')} />}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={change.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={change.isPending}>Salvar</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
