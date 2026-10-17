import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthGate } from '../components/AuthGate'
import { GuestOnly } from '../components/GuestOnly'
import { RequireAuth } from '../components/RequireAuth'
import { RequirePermission } from '../components/RequirePermission'
import { AccountLayout } from '../layouts/AccountLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { OrganizationLayout } from '../layouts/OrganizationLayout'
import AcceptInvitationPage from '../pages/invitations/AcceptInvitationPage'
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import VerifyEmailNoticePage from '../pages/auth/VerifyEmailNoticePage'
import VerifyEmailPage from '../pages/auth/VerifyEmailPage'
import InvitationsPage from '../pages/organization/InvitationsPage'
import MembersPage from '../pages/organization/MembersPage'
import OrganizationHomePage from '../pages/organization/OrganizationHomePage'
import OrganizationSettingsPage from '../pages/organization/OrganizationSettingsPage'
import OrganizationCreatePage from '../pages/organizations/OrganizationCreatePage'
import OrganizationsPage from '../pages/organizations/OrganizationsPage'
import { canManageMembers } from '../utils/permissions'
import { organizationSections, paths } from './paths'

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
            children: [
              { path: paths.verifyEmailNotice, element: <VerifyEmailNoticePage /> },
              // Sem login, RequireAuth leva ao login e volta para cá (com o token na query)
              { path: paths.acceptInvitation, element: <AcceptInvitationPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: paths.home, element: <Navigate to={paths.organizations} replace /> },
          {
            element: <AccountLayout />,
            children: [
              { path: paths.organizations, element: <OrganizationsPage /> },
              { path: paths.organizationNew, element: <OrganizationCreatePage /> },
            ],
          },
          {
            // O espaço ativo fica sempre na URL
            path: paths.organization,
            element: <OrganizationLayout />,
            children: [
              { index: true, element: <OrganizationHomePage /> },
              { path: organizationSections.settings, element: <OrganizationSettingsPage /> },
              {
                element: <RequirePermission allow={canManageMembers} />,
                children: [
                  { path: organizationSections.members, element: <MembersPage /> },
                  { path: organizationSections.invitations, element: <InvitationsPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])
