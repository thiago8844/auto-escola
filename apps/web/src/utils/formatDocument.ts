// Máscara progressiva de CPF (11 dígitos) ou CNPJ (14): troca sozinha conforme o que se digita
const CPF_GROUPS = [3, 3, 3, 2]
const CPF_SEPARATORS = ['.', '.', '-']
const CNPJ_GROUPS = [2, 3, 3, 4, 2]
const CNPJ_SEPARATORS = ['.', '.', '/', '-']

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 14)
}

export function formatDocument(value: string): string {
  const digits = onlyDigits(value)
  const isCpf = digits.length <= 11
  const groups = isCpf ? CPF_GROUPS : CNPJ_GROUPS
  const separators = isCpf ? CPF_SEPARATORS : CNPJ_SEPARATORS

  let result = ''
  let position = 0
  for (let i = 0; i < groups.length && position < digits.length; i++) {
    if (i > 0) result += separators[i - 1]
    result += digits.slice(position, position + groups[i])
    position += groups[i]
  }
  return result
}
