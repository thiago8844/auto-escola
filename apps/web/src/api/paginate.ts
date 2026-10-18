import type { Paginated } from '../types/organization'

const MAX_PAGES = 50

// Junta todas as páginas de uma consulta. Serve às telas que precisam do conjunto completo (agenda, histórico,
// seletores): uma lista acima de 100 itens continua inteira, sem truncar em silêncio.
export async function fetchAllPages<T>(getPage: (page: number) => Promise<Paginated<T>>): Promise<Paginated<T>> {
  const first = await getPage(1)
  const data = [...first.data]

  for (let page = 2; page <= Math.min(first.meta.last_page, MAX_PAGES); page++) {
    data.push(...(await getPage(page)).data)
  }

  return { data, meta: { ...first.meta, current_page: 1, last_page: 1, per_page: data.length, total: first.meta.total } }
}
