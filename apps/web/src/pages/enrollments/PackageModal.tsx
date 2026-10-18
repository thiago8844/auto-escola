import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Col, Modal, Row } from 'react-bootstrap'
import { useForm, useWatch } from 'react-hook-form'
import { CurrencyField } from '../../components/CurrencyField'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { useCreatePackage } from '../../hooks/useBalance'
import { packageSchema, type PackageFormInput } from '../../schemas/balance'
import type { Enrollment } from '../../types/enrollment'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { formatMinutes } from '../../utils/formatMinutes'

type PackageModalProps = { organizationId: number; enrollment: Enrollment; hasPackage: boolean; onClose: () => void }

// Contratação inicial ou acréscimo. A política (consumo, falta, cancelamento) vale a partir deste pacote.
export function PackageModal({ organizationId, enrollment, hasPackage, onClose }: PackageModalProps) {
  const create = useCreatePackage(organizationId, enrollment.id)
  const components = enrollment.category === 'AB' ? ['A', 'B'] : []
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PackageFormInput>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      kind: hasPackage ? 'addition' : 'contract',
      description: hasPackage ? 'Acréscimo de aulas' : 'Pacote de aulas',
      minutes: '',
      reference_minutes: '50',
      price: '',
      category: '',
      consume_basis: 'actual',
      absence_charge: 'none',
      late_cancel_charge: 'none',
      cancel_notice_hours: '24',
    },
  })
  const [minutes, reference, lateCancel] = useWatch({ control, name: ['minutes', 'reference_minutes', 'late_cancel_charge'] })
  const equivalent = Number(minutes) > 0 && Number(reference) > 0 ? Math.round((Number(minutes) / Number(reference)) * 100) / 100 : null

  const onSubmit = handleSubmit((values) =>
    create.mutate(
      {
        kind: values.kind,
        description: values.description,
        minutes: Number(values.minutes),
        reference_minutes: values.reference_minutes ? Number(values.reference_minutes) : null,
        price_cents: values.price ? Math.round(Number(values.price) * 100) : null,
        category: values.category || null,
        consume_basis: values.consume_basis,
        absence_charge: values.absence_charge,
        late_cancel_charge: values.late_cancel_charge,
        cancel_notice_hours: values.late_cancel_charge === 'full' ? Number(values.cancel_notice_hours) : null,
      },
      { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) },
    ),
  )
  const alertMessage = formAlertMessage(create.error)

  return (
    <Modal show onHide={onClose} centered size="lg" fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {hasPackage ? 'Acrescentar aulas' : 'Contratar aulas'}
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}

          <Row>
            <Col md={5}>
              <SelectField label="Tipo" error={errors.kind?.message} {...register('kind')}>
                <option value="contract">Contratação</option>
                <option value="addition">Acréscimo</option>
              </SelectField>
            </Col>
            <Col md={7}>
              <FormField label="Descrição" error={errors.description?.message} {...register('description')} />
            </Col>
          </Row>

          <Row>
            <Col sm={6}>
              <FormField
                label="Minutos contratados"
                inputMode="numeric"
                error={errors.minutes?.message}
                hint={equivalent ? `≈ ${equivalent} aula(s) de ${reference} min` : 'Ex.: 500'}
                {...register('minutes')}
              />
            </Col>
            <Col sm={6}>
              <FormField
                label="Duração de referência da aula (min)"
                inputMode="numeric"
                error={errors.reference_minutes?.message}
                hint="Opcional. Só com ela o sistema mostra o saldo em aulas."
                {...register('reference_minutes')}
              />
            </Col>
          </Row>

          <Row>
            <Col sm={6}>
              <CurrencyField control={control} name="price" label="Valor (opcional)" error={errors.price?.message} />
            </Col>
            {components.length > 0 && (
              <Col sm={6}>
                <SelectField label="Categoria do crédito" error={errors.category?.message} {...register('category')}>
                  <option value="">A distribuir depois</option>
                  {components.map((c) => (
                    <option key={c} value={c}>
                      Somente {c}
                    </option>
                  ))}
                </SelectField>
              </Col>
            )}
          </Row>

          <fieldset className="border rounded p-3">
            <legend className="h6 float-none w-auto px-2 mb-0">Política do contrato</legend>
            <Row>
              <Col md={4}>
                <SelectField label="Consumo da aula" error={errors.consume_basis?.message} {...register('consume_basis')}>
                  <option value="actual">Pelo tempo realizado</option>
                  <option value="scheduled">Pelo tempo agendado</option>
                </SelectField>
              </Col>
              <Col md={4}>
                <SelectField label="Falta do aluno" error={errors.absence_charge?.message} {...register('absence_charge')}>
                  <option value="none">Não consome</option>
                  <option value="full">Consome a aula inteira</option>
                </SelectField>
              </Col>
              <Col md={4}>
                <SelectField label="Cancelamento tardio" error={errors.late_cancel_charge?.message} {...register('late_cancel_charge')}>
                  <option value="none">Não consome</option>
                  <option value="full">Consome se fora do aviso</option>
                </SelectField>
              </Col>
            </Row>
            {lateCancel === 'full' && (
              <FormField label="Aviso prévio mínimo (horas)" inputMode="numeric" error={errors.cancel_notice_hours?.message} {...register('cancel_notice_hours')} />
            )}
            <p className="small text-secondary mb-0">
              Falta ou cancelamento cobrado consome crédito, mas nunca conta como instrução realizada.
              {Number(minutes) > 0 && ` Esta ${hasPackage ? 'inclusão' : 'contratação'} soma ${formatMinutes(Number(minutes))}.`}
            </p>
          </fieldset>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={create.isPending}>Registrar</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
