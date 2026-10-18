import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthGate } from '../components/AuthGate'
import { GuestOnly } from '../components/GuestOnly'
import { RequireAuth } from '../components/RequireAuth'
import { RequirePermission } from '../components/RequirePermission'
import SettingsPage from '../pages/settings/SettingsPage'
import { AccountLayout } from '../layouts/AccountLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { OrganizationLayout } from '../layouts/OrganizationLayout'
import AcceptInvitationPage from '../pages/invitations/AcceptInvitationPage'
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import VerifyEmailNoticePage from '../pages/auth/VerifyEmailNoticePage'
import VerifyEmailPage from '../pages/auth/VerifyEmailPage'
import EnrollmentDetailPage from '../pages/enrollments/EnrollmentDetailPage'
import EnrollmentFormPage from '../pages/enrollments/EnrollmentFormPage'
import EnrollmentsPage from '../pages/enrollments/EnrollmentsPage'
import ProcessDetailPage from '../pages/processes/ProcessDetailPage'
import ProcessesPage from '../pages/processes/ProcessesPage'
import ProcessFormPage from '../pages/processes/ProcessFormPage'
import StudentDetailPage from '../pages/students/StudentDetailPage'
import StudentFormPage from '../pages/students/StudentFormPage'
import StudentsPage from '../pages/students/StudentsPage'
import InstructorFormPage from '../pages/instructors/InstructorFormPage'
import InstructorsPage from '../pages/instructors/InstructorsPage'
import LessonDetailPage from '../pages/schedule/LessonDetailPage'
import LessonFormPage from '../pages/schedule/LessonFormPage'
import SchedulePage from '../pages/schedule/SchedulePage'
import VehicleFormPage from '../pages/vehicles/VehicleFormPage'
import VehiclesPage from '../pages/vehicles/VehiclesPage'
import InvitationsPage from '../pages/organization/InvitationsPage'
import MembersPage from '../pages/organization/MembersPage'
import OrganizationHomePage from '../pages/organization/OrganizationHomePage'
import OrganizationSettingsPage from '../pages/organization/OrganizationSettingsPage'
import OrganizationCreatePage from '../pages/organizations/OrganizationCreatePage'
import OrganizationsPage from '../pages/organizations/OrganizationsPage'
import { canManageMembers, canOperate } from '../utils/permissions'
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
              { path: paths.settings, element: <SettingsPage /> },
            ],
          },
          {
            // O espaço ativo fica sempre na URL
            path: paths.organization,
            element: <OrganizationLayout />,
            children: [
              { index: true, element: <OrganizationHomePage /> },
              { path: organizationSections.settings, element: <OrganizationSettingsPage /> },
              { path: organizationSections.students, element: <StudentsPage /> },
              { path: `${organizationSections.students}/:studentId`, element: <StudentDetailPage /> },
              // Agenda: a equipe vê tudo; o instrutor, só as próprias aulas (a API filtra)
              { path: organizationSections.schedule, element: <SchedulePage /> },
              { path: `${organizationSections.schedule}/:lessonId`, element: <LessonDetailPage /> },
              // Veículos: todos os membros veem; só a equipe altera (a tela trava os campos)
              { path: organizationSections.vehicles, element: <VehiclesPage /> },
              { path: `${organizationSections.vehicles}/:vehicleId`, element: <VehicleFormPage /> },
              { path: organizationSections.enrollments, element: <EnrollmentsPage /> },
              { path: `${organizationSections.enrollments}/:enrollmentId`, element: <EnrollmentDetailPage /> },
              {
                element: <RequirePermission allow={canOperate} />,
                children: [
                  { path: `${organizationSections.schedule}/nova`, element: <LessonFormPage /> },
                  { path: `${organizationSections.vehicles}/novo`, element: <VehicleFormPage /> },
                  { path: organizationSections.instructors, element: <InstructorsPage /> },
                  { path: `${organizationSections.instructors}/novo`, element: <InstructorFormPage /> },
                  { path: `${organizationSections.instructors}/:instructorId`, element: <InstructorFormPage /> },
                  { path: `${organizationSections.students}/novo`, element: <StudentFormPage /> },
                  { path: `${organizationSections.students}/:studentId/editar`, element: <StudentFormPage /> },
                  { path: `${organizationSections.students}/:studentId/matriculas/nova`, element: <EnrollmentFormPage /> },
                  { path: `${organizationSections.students}/:studentId/processos/novo`, element: <ProcessFormPage /> },
                  // Processo e checklist têm dados de saúde: só a equipe
                  { path: organizationSections.processes, element: <ProcessesPage /> },
                  { path: `${organizationSections.processes}/:processId`, element: <ProcessDetailPage /> },
                ],
              },
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
