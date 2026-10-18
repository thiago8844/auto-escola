import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Alert, Form } from 'react-bootstrap'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { AffectedModal } from '../../components/AffectedModal'
import { FormField } from '../../components/FormField'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { VEHICLE_CATEGORIES, VEHICLE_STATUS } from '../../config/domain'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useCreateVehicle, useUpdateVehicle, useVehicle } from '../../hooks/useVehicles'
import { vehicleSchema, type VehicleInput } from '../../schemas/vehicle'
import type { Commitment } from '../../types/availability'
import type { Vehicle } from '../../types/vehicle'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { canOperate } from '../../utils/permissions'
import { VehicleFleetPanel } from './VehicleFleetPanel'

const emptyValues: VehicleInput = {
  plate: '',
  brand: '',
  model: '',
  year: '',
  category: 'B',
  adapted: false,
  adaptations: '',
  crlv_expires_at: '',
  status: 'active',
  notes: '',
}

function toFormValues(vehicle: Vehicle): VehicleInput {
  return {
    plate: vehicle.plate,
    brand: vehicle.brand ?? '',
    model: vehicle.model,
    year: vehicle.year ? String(vehicle.year) : '',
    category: vehicle.category,
    adapted: vehicle.adapted,
    adaptations: vehicle.adaptations ?? '',
    crlv_expires_at: vehicle.crlv_expires_at ?? '',
    status: vehicle.status,
    notes: vehicle.notes ?? '',
  }
}

// Cadastro (/veiculos/novo) e detalhe/edição (/veiculos/:vehicleId)
export default function VehicleFormPage() {
  const { vehicleId } = useParams()
  const organization = useActiveOrganization()
  const query = useVehicle(organization.id, vehicleId)

  if (!vehicleId) return <VehicleForm />
  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(vehicle) => <VehicleForm vehicle={vehicle} />}
    </QueryState>
  )
}

function VehicleForm({ vehicle }: { vehicle?: Vehicle }) {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const navigate = useNavigate()
  const editable = canOperate(organization.role)
  const create = useCreateVehicle(organization.id)
  const update = useUpdateVehicle(organization.id, String(vehicle?.id ?? ''))
  const save = vehicle ? update : create
  const [affected, setAffected] = useState<Commitment[] | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<VehicleInput>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: vehicle ? toFormValues(vehicle) : emptyValues,
  })
  const adapted = useWatch({ control, name: 'adapted' })

  const onSubmit = handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: (saved) => {
        // Inativar ou antecipar o CRLV pode deixar aulas e exames sem veículo utilizável: mostra o que fazer
        if ('affected' in saved && saved.affected.length > 0) setAffected(saved.affected)
        else navigate(links.vehicles)
      },
      onError: (error) => applyFieldErrors(error, setError),
    }),
  )
  const alertMessage = formAlertMessage(save.error)

  return (
    <>
      <PageHeader title={vehicle ? `Veículo ${vehicle.plate}` : 'Novo veículo'} />

      <div className="form-narrow">
        {!editable && <Alert variant="info">Somente a equipe pode alterar veículos.</Alert>}
        {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}

        <form onSubmit={onSubmit} noValidate>
          <fieldset disabled={!editable}>
            <FormField
              label="Placa"
              autoFocus={!vehicle}
              autoCapitalize="characters"
              hint="7 caracteres, formato antigo ou Mercosul (ex.: ABC1D23)."
              error={errors.plate?.message}
              {...register('plate')}
            />
            <FormField label="Marca (opcional)" error={errors.brand?.message} {...register('brand')} />
            <FormField label="Modelo" error={errors.model?.message} {...register('model')} />
            <FormField label="Ano (opcional)" inputMode="numeric" error={errors.year?.message} {...register('year')} />
            <SelectField label="Categoria" error={errors.category?.message} {...register('category')}>
              {VEHICLE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </SelectField>
            <FormField
              label="Validade do CRLV (opcional)"
              type="date"
              hint="Depois dessa data o veículo não pode ser usado em aulas."
              error={errors.crlv_expires_at?.message}
              {...register('crlv_expires_at')}
            />
            <SelectField label="Situação" error={errors.status?.message} {...register('status')}>
              {Object.entries(VEHICLE_STATUS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <Form.Check type="checkbox" id="adapted" label="Veículo adaptado" className="mb-3" {...register('adapted')} />
            {adapted && <TextAreaField label="Adaptações" error={errors.adaptations?.message} {...register('adaptations')} />}
            <TextAreaField label="Observações (opcional)" error={errors.notes?.message} {...register('notes')} />
            {editable && <SubmitButton loading={save.isPending}>{vehicle ? 'Salvar alterações' : 'Cadastrar veículo'}</SubmitButton>}
          </fieldset>
        </form>
      </div>

      {vehicle && editable && (
        <div className="mw-100">
          <VehicleFleetPanel organization={organization} vehicleId={vehicle.id} />
        </div>
      )}

      {affected && vehicle && (
        <AffectedModal
          organizationId={organization.id}
          timezone={organization.timezone}
          title="Veículo atualizado"
          summary={`As alterações em ${vehicle.plate} foram salvas.`}
          commitments={affected}
          onClose={() => navigate(links.vehicles)}
        />
      )}
    </>
  )
}
