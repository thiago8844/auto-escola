import { Dropdown } from 'react-bootstrap'
import type { ThemeMode } from '../lib/theme'
import { useThemeStore } from '../stores/themeStore'

const options: Array<{ mode: ThemeMode; label: string; icon: string }> = [
  { mode: 'light', label: 'Claro', icon: 'bi-sun' },
  { mode: 'dark', label: 'Escuro', icon: 'bi-moon-stars' },
  { mode: 'system', label: 'Automático', icon: 'bi-circle-half' },
]

type ThemeToggleProps = {
  // Variante compacta (só o ícone) para cantos de tela
  compact?: boolean
  align?: 'start' | 'end'
}

export function ThemeToggle({ compact, align = 'end' }: ThemeToggleProps) {
  const mode = useThemeStore((state) => state.mode)
  const setMode = useThemeStore((state) => state.setMode)
  const current = options.find((option) => option.mode === mode) ?? options[2]

  return (
    <Dropdown align={align}>
      <Dropdown.Toggle variant="outline-secondary" size="sm" id="theme-toggle" aria-label={`Tema: ${current.label}`}>
        <i className={`bi ${current.icon}`} aria-hidden="true" />
        {!compact && <span className="ms-2">Tema: {current.label}</span>}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {options.map((option) => (
          <Dropdown.Item key={option.mode} active={option.mode === mode} onClick={() => setMode(option.mode)}>
            <i className={`bi ${option.icon} me-2`} aria-hidden="true" />
            {option.label}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  )
}
