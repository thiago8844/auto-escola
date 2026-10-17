import 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    // A tela trata o erro sozinha; não mostrar o aviso global (toast)
    skipGlobalError?: boolean
  }
}
