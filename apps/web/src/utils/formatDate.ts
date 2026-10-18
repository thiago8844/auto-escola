const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

// Datas sem hora ('2026-10-17') são dias de calendário: não passam por fuso, para não recuar um dia.
// Instantes (ISO com hora, vindos em UTC) são mostrados no fuso informado, que é o do espaço.
export function formatDate(value: Date | string | number, timeZone?: string): string {
  const match = typeof value === 'string' ? DATE_ONLY.exec(value) : null
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  return new Intl.DateTimeFormat('pt-BR', { timeZone }).format(new Date(value))
}
