import { http } from './client'

export type OnboardingStep = { key: string; label: string; hint: string; done: boolean }
export type Onboarding = { steps: OnboardingStep[]; done: number; total: number; support_email: string | null }

export async function getOnboarding(organizationId: number | string): Promise<Onboarding> {
  const { data } = await http.get<{ data: Onboarding }>(`/organizations/${organizationId}/onboarding`, { skipGlobalError: true })
  return data.data
}
