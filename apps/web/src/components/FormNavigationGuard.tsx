import { Button, Modal } from 'react-bootstrap'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import { useFormChanges } from '../hooks/useFormProtection'

export function FormNavigationGuard() {
  const blocker = useBlocker(() => Object.keys(useFormChanges.getState().dirty).length > 0)
  useBeforeUnload((event) => {
    if (Object.keys(useFormChanges.getState().dirty).length === 0) return
    event.preventDefault()
    event.returnValue = ''
  })
  const stay = () => { if (blocker.state === 'blocked') blocker.reset() }
  const leave = () => {
    useFormChanges.getState().clear()
    if (blocker.state === 'blocked') blocker.proceed()
  }
  return <Modal show={blocker.state === 'blocked'} onHide={stay} centered>
    <Modal.Header closeButton><Modal.Title as="h2" className="h5">Continuar editando?</Modal.Title></Modal.Header>
    <Modal.Body>Você tem alterações que ainda não foram salvas. Ao sair, esse preenchimento será descartado.</Modal.Body>
    <Modal.Footer><Button variant="outline-danger" onClick={leave}>Descartar e sair</Button><Button onClick={stay}>Continuar editando</Button></Modal.Footer>
  </Modal>
}
