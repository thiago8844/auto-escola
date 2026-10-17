// 90 -> "1h30"; 45 -> "45 min". O contrato é em minutos, sem presumir "hora-aula".
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`
}
