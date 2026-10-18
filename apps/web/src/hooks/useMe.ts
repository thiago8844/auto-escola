import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createMyInstructor, getMyInstructor, listMyLessons, updateMyInstructor, type MyLessonsParams } from '../api/me'
import type { InstructorInput } from '../schemas/instructor'
import { notify } from '../stores/toastStore'

export function useMyLessons(params: MyLessonsParams) {
  return useQuery({ queryKey: ['me', 'lessons', params], queryFn: () => listMyLessons(params), placeholderData: keepPreviousData })
}

export function useMyInstructor() {
  return useQuery({ queryKey: ['me', 'instructor'], queryFn: getMyInstructor })
}

// Criar ou editar o perfil muda quem aparece como instrutor nos espaços e nas agendas
export function useSaveMyInstructor(exists: boolean) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: InstructorInput) => (exists ? updateMyInstructor(input) : createMyInstructor(input)),
    onSuccess: () => {
      notify.success(exists ? 'Perfil atualizado.' : 'Perfil criado.')
      return queryClient.invalidateQueries()
    },
  })
}
