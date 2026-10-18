// Autoescola de aluno ou exame: o próprio espaço (só em autoescola) ou uma parceira. 'space' é o valor do próprio espaço.
export const SPACE_VALUE = 'space'

export function toPartnerId(value: string): number | null {
  return value === SPACE_VALUE || value === '' ? null : Number(value)
}

export function drivingSchoolValue(exam: { partner_id?: number | null }): string {
  return exam.partner_id ? String(exam.partner_id) : SPACE_VALUE
}
