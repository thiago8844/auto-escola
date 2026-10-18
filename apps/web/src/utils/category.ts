import type { LicenseCategory } from '../types/enrollment'

export function categoryComponents(category: LicenseCategory): string[] {
  return ['AB', 'AC', 'AD', 'AE'].includes(category) ? category.split('') : [category]
}
