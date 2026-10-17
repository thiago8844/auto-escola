import { createBrowserRouter } from 'react-router-dom'
import { AuthGate } from '../components/AuthGate'
import { GuestOnly } from '../components/GuestOnly'
import { RequireAuth } from '../components/RequireAuth'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import HomePage from '../pages/HomePage'
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import VerifyEmailNoticePage from '../pages/auth/VerifyEmailNoticePage'
import VerifyEmailPage from '../pages/auth/VerifyEmailPage'
import { paths } from './paths'

export const router = createBrowserRouter([
  {
    // Raiz: descobre a sessão antes de decidir qualquer rota
    element: <AuthGate />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          // O link do e-mail funciona logado ou não
          { path: paths.verifyEmail, element: <VerifyEmailPage /> },
          {
            element: <GuestOnly />,
            children: [
              { path: paths.login, element: <LoginPage /> },
              { path: paths.register, element: <RegisterPage /> },
            ],
          },
          {
            element: <RequireAuth />,
            children: [{ path: paths.verifyEmailNotice, element: <VerifyEmailNoticePage /> }],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [{ path: paths.home, element: <HomePage /> }],
          },
        ],
      },
    ],
  },
])
