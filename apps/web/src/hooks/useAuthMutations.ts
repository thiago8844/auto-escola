import { useMutation } from '@tanstack/react-query'
import * as authApi from '../api/auth'
import { resetServerCache } from '../lib/queryClient'
import { useAuthStore } from '../stores/authStore'

export function useLogin() {
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (user) => useAuthStore.getState().setUser(user),
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: authApi.register,
    onSuccess: (user) => useAuthStore.getState().setUser(user),
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: authApi.logout,
    // Mesmo se a chamada falhar (rede, 401), a sessão local é descartada
    onSettled: () => {
      useAuthStore.getState().setAnonymous()
      resetServerCache()
    },
  })
}

export function useResendVerification() {
  return useMutation({ mutationFn: authApi.resendVerification })
}

// Relê o usuário (ex.: depois de confirmar o e-mail em outra aba)
export function useRefreshUser() {
  return useMutation({
    mutationFn: authApi.getCurrentUser,
    onSuccess: (user) => useAuthStore.getState().setUser(user),
  })
}

export const useForgotPassword = () => useMutation({ mutationFn: authApi.forgotPassword })
export const useResetPassword = () => useMutation({ mutationFn: authApi.resetPassword })
export const useChangePassword = () => useMutation({ mutationFn: authApi.changePassword })
