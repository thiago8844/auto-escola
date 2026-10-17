// Helper de baixo nível: junta classes CSS ignorando valores falsos.
// Ex.: classNames('btn', ativo && 'active', undefined) -> 'btn active'
export function classNames(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
