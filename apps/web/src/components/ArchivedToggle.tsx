import { Form } from 'react-bootstrap'

type ArchivedToggleProps = { id: string; checked: boolean; onChange: (checked: boolean) => void }

export function ArchivedToggle({ id, checked, onChange }: ArchivedToggleProps) {
  return <Form.Check type="switch" id={id} label="Mostrar arquivados" checked={checked} onChange={(event) => onChange(event.target.checked)} />
}
