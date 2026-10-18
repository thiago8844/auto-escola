import {
  MyLessonsPage,
  MyProfilePage,
  SettingsPage,
  AcceptInvitationPage,
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailNoticePage,
  VerifyEmailPage,
  AccountsPage,
  EntriesPage,
  FinanceLayout,
  FinanceOverviewPage,
  ReceiptPage,
  FinanceSetupPage,
  ReportsPage,
  StudentSummaryPage,
  AlertsPage,
  AvailabilityPage,
  ExamDetailPage,
  ExamsPage,
  AuditPage,
  EnrollmentDetailPage,
  EnrollmentFormPage,
  EnrollmentsPage,
  ProcessDetailPage,
  ProcessesPage,
  ProcessFormPage,
  StudentDetailPage,
  StudentFormPage,
  StudentsPage,
  PartnerFormPage,
  PartnersPage,
  InstructorFormPage,
  InstructorsPage,
  LessonDetailPage,
  LessonFormPage,
  SchedulePage,
  VehicleFormPage,
  VehiclesPage,
  InvitationsPage,
  MembersPage,
  OrganizationHomePage,
  OrganizationSettingsPage,
  OrganizationCreatePage,
  OrganizationsPage,
} from './pageComponents'
import { RouteErrorScreen } from '../components/RouteErrorScreen'
import { createBrowserRouter } from 'react-router-dom'
import { DefaultSpaceRedirect } from '../components/DefaultSpaceRedirect'
import { RootLayout } from '../components/RootLayout'
import { GuestOnly } from '../components/GuestOnly'
import { RequireAuth } from '../components/RequireAuth'
import { RequirePermission } from '../components/RequirePermission'

import { AccountLayout } from '../layouts/AccountLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { OrganizationLayout } from '../layouts/OrganizationLayout'

import { canManageMembers, canOperate } from '../utils/permissions'
import { testRoutes } from './testRoutes'
import { organizationSections, paths } from './paths'

export const router = createBrowserRouter([
  {
    // Raiz: descobre a sessão antes de decidir qualquer rota
    element: <RootLayout />,
    errorElement: <RouteErrorScreen />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          // O link do e-mail funciona logado ou não
          { path: paths.verifyEmail, element: <VerifyEmailPage /> },
          // Recuperação de senha: o link do e-mail abre logado ou não
          { path: paths.forgotPassword, element: <ForgotPasswordPage /> },
          { path: paths.resetPassword, element: <ResetPasswordPage /> },
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
          { path: paths.home, element: <DefaultSpaceRedirect /> },
          {
            element: <AccountLayout />,
            children: [
              { path: paths.organizations, element: <OrganizationsPage /> },
              { path: paths.organizationNew, element: <OrganizationCreatePage /> },
              { path: paths.settings, element: <SettingsPage /> },
              { path: paths.myLessons, element: <MyLessonsPage /> },
              { path: paths.myProfile, element: <MyProfilePage /> },
              // Área de testes (só em desenvolvimento; ver testRoutes.tsx)
              ...testRoutes,
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
              // Exames: a equipe vê todos; o instrutor, só os que acompanha (a API filtra)
              // Disponibilidade: a equipe gerencia bloqueios; o instrutor registra a própria indisponibilidade
              { path: organizationSections.availability, element: <AvailabilityPage /> },
              { path: organizationSections.alerts, element: <AlertsPage /> },
              { path: organizationSections.exams, element: <ExamsPage /> },
              { path: `${organizationSections.exams}/:examId`, element: <ExamDetailPage /> },
              { path: organizationSections.enrollments, element: <EnrollmentsPage /> },
              { path: `${organizationSections.enrollments}/:enrollmentId`, element: <EnrollmentDetailPage /> },
              {
                element: <RequirePermission allow={canOperate} />,
                children: [
                  { path: `${organizationSections.schedule}/nova`, element: <LessonFormPage /> },
                  { path: `${organizationSections.vehicles}/novo`, element: <VehicleFormPage /> },
                  { path: organizationSections.reports, element: <ReportsPage /> },
                  // Financeiro: equipe; o instrutor nunca acessa o caixa
                  {
                    path: organizationSections.finance,
                    element: <FinanceLayout />,
                    children: [
                      { index: true, element: <FinanceOverviewPage /> },
                      { path: 'receitas', element: <EntriesPage type="receivable" /> },
                      { path: 'despesas', element: <EntriesPage type="payable" /> },
                      { path: 'contas', element: <AccountsPage /> },
                      { path: 'cadastros', element: <FinanceSetupPage /> },
                      { path: 'recibo/:paymentId', element: <ReceiptPage /> },
                    ],
                  },
                  { path: `${organizationSections.students}/:studentId/resumo`, element: <StudentSummaryPage /> },
                  { path: organizationSections.partners, element: <PartnersPage /> },
                  { path: `${organizationSections.partners}/novo`, element: <PartnerFormPage /> },
                  { path: `${organizationSections.partners}/:partnerId`, element: <PartnerFormPage /> },
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
                  { path: organizationSections.audit, element: <AuditPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])
