import { useState } from 'react'
import { Badge, Button, Form, Modal } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { arrangeNavigation, organizationNavigation } from '../config/navigation'
import { usePreferencesStore } from '../stores/preferencesStore'
import type { Organization } from '../types/organization'

export function NavigationSettings({ organization }: { organization: Organization }) {
  const [open, setOpen] = useState(false)
  const preference = usePreferencesStore((s) => s.navigation[String(organization.id)])
  const setNavigation = usePreferencesStore((s) => s.setNavigation)
  const { ordered, hidden, primary } = arrangeNavigation(organizationNavigation(organization), organization.role, preference)
  const save = (order: string[], hiddenIds = [...hidden]) => setNavigation(String(organization.id), { order, hidden: hiddenIds })
  const move = (id: string, direction: number) => {
    const ids = ordered.map((m) => m.id)
    const index = ids.indexOf(id)
    const next = index + direction
    if (next < 0 || next >= ids.length) return
    ;[ids[index], ids[next]] = [ids[next], ids[index]]
    save(ids)
  }

  return <>
    <Button size="sm" variant="link" className="text-start px-2 mt-2" onClick={() => setOpen(true)}><i className="bi bi-sliders me-2" aria-hidden="true" />Organizar meu menu</Button>
    <Modal show={open} onHide={() => setOpen(false)} size="lg" fullscreen="sm-down">
      <Modal.Header closeButton><Modal.Title as="h2" className="h5">Meu menu · {organization.name}</Modal.Title></Modal.Header>
      <Modal.Body>
        <p>Os cinco primeiros módulos visíveis são seus atalhos. Use as setas para ordenar ou o botão de estrela para fixar no início.</p>
        <p className="small text-secondary">Ajustes pessoais neste navegador. Ocultar só muda seu menu; seus acessos e pendências continuam iguais. Todos os módulos permitidos estão nesta lista.</p>
        <ul className="list-unstyled mb-0">
          {ordered.map((module, index) => <li key={module.id} className="d-flex flex-wrap align-items-center gap-2 border-bottom py-2">
            <div className="flex-grow-1 min-w-0"><Link to={module.to} onClick={() => setOpen(false)}><i className={`bi ${module.icon} me-2`} aria-hidden="true" />{module.label}</Link>{primary.some((m) => m.id === module.id) && <Badge bg="light" text="body" className="border ms-2">Atalho</Badge>}</div>
            <Form.Check id={`show-${module.id}`} label="Visível" checked={!hidden.has(module.id)} disabled={module.id === 'home' || module.id === 'alerts'} onChange={(e) => save(ordered.map((m) => m.id), e.target.checked ? [...hidden].filter((id) => id !== module.id) : [...hidden, module.id])} />
            <div className="d-flex gap-1">
              <Button variant="outline-secondary" size="sm" aria-label={`Fixar ${module.label}`} onClick={() => save([module.id, ...ordered.filter((m) => m.id !== module.id).map((m) => m.id)], [...hidden].filter((id) => id !== module.id))}><i className="bi bi-star" /></Button>
              <Button variant="outline-secondary" size="sm" aria-label={`Subir ${module.label}`} disabled={index === 0} onClick={() => move(module.id, -1)}><i className="bi bi-arrow-up" /></Button>
              <Button variant="outline-secondary" size="sm" aria-label={`Descer ${module.label}`} disabled={index === ordered.length - 1} onClick={() => move(module.id, 1)}><i className="bi bi-arrow-down" /></Button>
            </div>
          </li>)}
        </ul>
      </Modal.Body>
      <Modal.Footer className="justify-content-between"><Button variant="outline-secondary" onClick={() => setNavigation(String(organization.id), undefined)}>Restaurar padrão do perfil</Button><Button onClick={() => setOpen(false)}>Concluir</Button></Modal.Footer>
    </Modal>
  </>
}
