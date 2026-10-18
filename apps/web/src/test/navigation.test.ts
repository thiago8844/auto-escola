import { beforeEach, describe, expect, it } from 'vitest'
import { arrangeNavigation, organizationNavigation } from '../config/navigation'
import { preferencesStorage } from '../lib/preferencesStorage'
import { usePreferencesStore } from '../stores/preferencesStore'
import type { Organization } from '../types/organization'

const organization = { id: 1, role: 'instructor', type: 'cfc' } as Organization

beforeEach(() => { localStorage.clear(); usePreferencesStore.getState().loadFor(null) })

describe('preferências pessoais de navegação', () => {
  it('nunca oferece módulos proibidos mesmo que a preferência tente fixá-los', () => {
    const menu = arrangeNavigation(organizationNavigation(organization), 'instructor', { order: ['finance', 'members', 'schedule'], hidden: [] })
    expect(menu.ordered.some((m) => m.id === 'finance' || m.id === 'members')).toBe(false)
    expect(menu.primary[0].id).toBe('schedule')
  })
  it('mantém notificações acessíveis e remove módulos ocultos dos atalhos', () => {
    const menu = arrangeNavigation(organizationNavigation(organization), 'instructor', { order: ['vehicles', 'home'], hidden: ['vehicles', 'alerts'] })
    expect(menu.primary.some((m) => m.id === 'vehicles')).toBe(false)
    expect(menu.ordered.filter((m) => !menu.hidden.has(m.id)).some((m) => m.id === 'alerts')).toBe(true)
  })
  it('isola usuários e espaços sem apagar os avisos já silenciados', () => {
    const store = usePreferencesStore
    store.getState().loadFor(10)
    store.getState().mute('ajuda')
    store.getState().setDefaultSpace('1')
    store.getState().setNavigation('1', { order: ['vehicles'], hidden: ['exams'] })
    store.getState().loadFor(20)
    expect(store.getState().defaultSpace).toBeNull()
    expect(store.getState().navigation).toEqual({})
    store.getState().loadFor(10)
    expect(store.getState().defaultSpace).toBe('1')
    expect(store.getState().isMuted('ajuda')).toBe(true)
    expect(store.getState().navigation['2']).toBeUndefined()
    expect(store.getState().navigation['1'].hidden).toEqual(['exams'])
  })
  it('recupera preferências antigas e ignora armazenamento inválido', () => {
    localStorage.setItem('rc-prefs:10', JSON.stringify({ mutedNotices: { ajuda: 'ontem' } }))
    expect(preferencesStorage.load(10)).toEqual({ mutedNotices: { ajuda: 'ontem' }, navigation: {}, defaultSpace: null })
    localStorage.setItem('rc-prefs:10', 'inválido')
    expect(preferencesStorage.load(10).defaultSpace).toBeNull()
  })
})
