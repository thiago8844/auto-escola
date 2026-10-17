const dateFormatter = new Intl.DateTimeFormat('pt-BR')

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

// Aceita Date, timestamp ou texto ISO. Datas sem hora ('2026-10-17') são lidas como
// data local, para não recuar um dia por causa do fuso.
export function formatDate(value: Date | string | number): string {
  const match = typeof value === 'string' ? DATE_ONLY.exec(value) : null
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value)
  return dateFormatter.format(date)
}
