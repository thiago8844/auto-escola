import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Form, Modal } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { FormErrorAlert } from '../../components/FormErrorAlert'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { LICENSE_CATEGORIES, PROCESS_TYPE_LABELS, UFS } from '../../config/domain'
import { useUpdateProcessData } from '../../hooks/useProcesses'
import { processSchema, type ProcessInput } from '../../schemas/process'
import type { QualificationProcess } from '../../types/process'
import { applyFieldErrors } from '../../utils/applyFieldErrors'

type ProcessEditModalProps = { organizationId: number; process: QualificationProcess; onClose: () => void }

// Corrige os dados do processo. O tipo e o aluno não mudam (o checklist depende deles); cada mudança fica na linha do tempo.
export function ProcessEditModal({ organizationId, process, onClose }: ProcessEditModalProps) {
  const update = useUpdateProcessData(organizationId, String(process.id), process.updated_at)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProcessInput>({
    resolver: zodResolver(processSchema),
    defaultValues: {
      type: process.type,
      uf: process.uf as ProcessInput['uf'],
      municipality: process.municipality ?? '',
      renach: process.renach ?? '',
      protocol: process.protocol ?? '',
      opened_at: process.opened_at ?? '',
      current_categories: process.current_categories,
      target_categories: process.target_categories,
      notes: process.notes ?? '',
    },
  })
  const firstLicense = process.type === 'first_license'

  const onSubmit = handleSubmit((values) => update.mutate(values, { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) }))

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Corrigir dados do processo
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          <FormErrorAlert error={update.error} />
          <p className="small text-secondary">
            Tipo: <strong>{PROCESS_TYPE_LABELS[process.type]}</strong>. O tipo e o aluno não podem ser alterados; para outro tipo, crie um novo processo.
          </p>
          <input type="hidden" {...register('type')} />
          <SelectField label="UF" error={errors.uf?.message} {...register('uf')}>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </SelectField>
          <FormField label="Município (opcional)" error={errors.municipality?.message} {...register('municipality')} />
          <FormField label="RENACH (opcional)" autoCapitalize="characters" error={errors.renach?.message} {...register('renach')} />
          <FormField label="Protocolo (opcional)" error={errors.protocol?.message} {...register('protocol')} />
          <FormField label="Data de abertura (opcional)" type="date" error={errors.opened_at?.message} {...register('opened_at')} />
          {!firstLicense && <Categories legend="Categorias atuais" field="current_categories" error={errors.current_categories?.message} register={register} />}
          <Categories legend="Categorias pretendidas" field="target_categories" error={errors.target_categories?.message} register={register} />
          <TextAreaField label="Observações (opcional)" error={errors.notes?.message} {...register('notes')} />
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

function Categories({ legend, error, field, register }: { legend: string; error?: string; field: 'current_categories' | 'target_categories'; register: ReturnType<typeof useForm<ProcessInput>>['register'] }) {
  return (
    <fieldset className="mb-3">
      <legend className="form-label fs-6">{legend}</legend>
      <div className="d-flex flex-wrap gap-3">
        {LICENSE_CATEGORIES.map((category) => (
          <Form.Check key={category} type="checkbox" id={`edit-${field}-${category}`} label={category} value={category} {...register(field)} />
        ))}
      </div>
      {error && <div className="text-danger small mt-1">{error}</div>}
    </fieldset>
  )
}
