// Dinheiro sempre em centavos inteiros na API; aqui só convertemos para exibir e digitar.
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatCents(cents: number): string {
  return brl.format(cents / 100)
}

// "1250.5" (reais digitados com a máscara) -> 125050 centavos, sem erro de ponto flutuante
export function toCents(reais: string | number): number {
  const number = typeof reais === 'number' ? reais : Number(reais)
  return Number.isFinite(number) ? Math.round(number * 100) : 0
}

// 125050 -> "1250.5" (valor inicial dos campos de moeda)
export function toReais(cents: number): string {
  return String(cents / 100)
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
