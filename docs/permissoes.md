# Permissões

Quem pode fazer o quê dentro de um espaço de trabalho. A decisão tem três etapas, nesta ordem:

1. **Pertencimento**: o usuário tem acesso ativo ao espaço? Se não, **404** (o espaço nem é revelado).
2. **Papel**: o papel dele permite a ação? Se não, **403**.
3. **Recurso**: o registro pertence ao espaço e, para instrutor, está atribuído a ele? Se não, **404** (registro de outro espaço) ou **403** (registro do espaço, mas não atribuído).

> Status: ✅ implementado e coberto por testes.

## Papéis

| Papel | Quem é | Pode gerenciar membros e convites | Pode operar cadastros e agenda | Visão |
|---|---|---|---|---|
| `owner` | Proprietário | Sim, sem restrição | Sim | Espaço inteiro |
| `admin` | Gestor operacional | Sim, **só `staff` e `instructor`** | Sim | Espaço inteiro |
| `staff` | Equipe (recepção, secretaria) | Não | Sim | Espaço inteiro |
| `instructor` | Instrutor com acesso ao espaço | Não | Não | **Somente o que está atribuído a ele** |

O papel vale **por espaço**. A mesma pessoa pode ser `owner` num espaço e `instructor` em outro.

## Matriz de ações

Legenda: ✅ permitido · ❌ negado · 🔒 permitido com restrição (detalhada abaixo)

### Espaço e membros

| Ação | owner | admin | staff | instructor |
|---|---|---|---|---|
| Ver o espaço | ✅ | ✅ | ✅ | ✅ |
| Alterar nome, documento, contato | ✅ | ✅ | ❌ | ❌ |
| Listar membros | ✅ | ✅ | ❌ | ❌ |
| Alterar papel de membro | ✅ | 🔒 | ❌ | ❌ |
| Revogar acesso de membro | ✅ | 🔒 | ❌ | ❌ |
| Criar convite | ✅ | 🔒 | ❌ | ❌ |
| Listar convites | ✅ | ✅ | ❌ | ❌ |
| Revogar convite | ✅ | ✅ | ❌ | ❌ |

### Cadastros operacionais

| Ação | owner | admin | staff | instructor |
|---|---|---|---|---|
| Listar e ver parceiros | ✅ | ✅ | ✅ | ❌ |
| Criar, editar, excluir parceiro | ✅ | ✅ | ✅ | ❌ |
| Listar instrutores do espaço | ✅ | ✅ | ✅ | ❌ |
| Cadastrar instrutor sem conta | ✅ | ✅ | ✅ | ❌ |
| Alterar identidade de instrutor **sem** conta | ✅ | ✅ | ✅ | ❌ |
| Alterar identidade de instrutor **com** conta | ❌ | ❌ | ❌ | ❌ (só o próprio, em `/me`) |
| Ativar/desativar vínculo de instrutor | ✅ | ✅ | ✅ | ❌ |
| Listar alunos | ✅ | ✅ | ✅ | 🔒 só os atribuídos |
| Ver aluno (com CPF, e-mail, nascimento) | ✅ | ✅ | ✅ | ❌ |
| Ver aluno atribuído (nome e telefone) | ✅ | ✅ | ✅ | ✅ |
| Criar, editar, excluir aluno | ✅ | ✅ | ✅ | ❌ |
| Listar e ver matrículas | ✅ | ✅ | ✅ | 🔒 só as atribuídas |
| Criar e editar matrícula | ✅ | ✅ | ✅ | ❌ |

### Veículos, processos e documentos

| Ação | owner | admin | staff | instructor |
|---|---|---|---|---|
| Listar e ver veículos | ✅ | ✅ | ✅ | ✅ |
| Criar, editar, excluir veículo | ✅ | ✅ | ✅ | ❌ |
| Listar, ver, criar e editar processos de habilitação | ✅ | ✅ | ✅ | ❌ |
| Atualizar e acrescentar itens do checklist | ✅ | ✅ | ✅ | ❌ |
| Ver se a matrícula está liberada para a prática (só os tipos pendentes) | ✅ | ✅ | ✅ | 🔒 só as matrículas atribuídas |
| Ver preço e observações do contrato da matrícula | ✅ | ✅ | ✅ | ❌ |
| Listar, ver, enviar, conferir e baixar documentos | ✅ | ✅ | ✅ | ❌ |

### Agenda

| Ação | owner | admin | staff | instructor |
|---|---|---|---|---|
| Listar aulas do espaço | ✅ | ✅ | ✅ | 🔒 só as próprias |
| Ver aula | ✅ | ✅ | ✅ | 🔒 só as próprias |
| Agendar aula | ✅ | ✅ | ✅ | ❌ |
| Remarcar aula | ✅ | ✅ | ✅ | ❌ |
| Marcar como **realizada** ou **falta** | ✅ | ✅ | ✅ | 🔒 só as próprias |
| **Cancelar** aula | ✅ | ✅ | ✅ | ❌ |
| Editar observações, evolução e duração real | ✅ | ✅ | ✅ | 🔒 só as próprias |
| Registrar o registro oficial da aula | ✅ | ✅ | ✅ | ❌ |
| Agenda pessoal (`/me/lessons`) | ✅ | ✅ | ✅ | ✅ (ver seção 4) |

## Regras detalhadas

### 1. Quem administra acessos

- **Owner** altera e revoga qualquer papel, inclusive de outro owner, desde que reste **pelo menos um owner**.
- **Admin** só mexe em quem é `staff` ou `instructor`, e só concede `staff` ou `instructor`. Não pode:
  - promover ninguém a `admin` ou `owner`;
  - rebaixar ou remover `owner` ou outro `admin`;
  - convidar `owner` ou `admin`.
  
  Essas tentativas retornam `403 role_not_assignable_by_admin`.

### 2. Último proprietário

O espaço sempre tem ao menos um `owner`. Qualquer alteração que deixaria o espaço sem proprietário (rebaixar ou remover o último) retorna `422 last_owner`.

A verificação roda com `SELECT ... FOR UPDATE` no espaço. Duas requisições simultâneas que tentem remover os dois últimos owners não conseguem ambas.

### 3. Identidade do instrutor

- Quando o instrutor tem **conta vinculada**, só ele altera nome, credencial e categorias, em `PATCH /api/v1/me/instructor`.
- A equipe do espaço tenta alterar esses campos em um instrutor com conta: recebe `403 instructor_identity_locked`.
- Quando o instrutor **não tem conta**, a equipe (`owner`, `admin`, `staff`) pode alterar a identidade, pois ele foi cadastrado naquele espaço.
- Ativar ou desativar o vínculo com o espaço **sempre** é permitido à equipe, independentemente de haver conta.

### 4. Visão do instrutor

Um membro com papel `instructor` vê apenas o que está atribuído a ele:

| Recurso | O que vê |
|---|---|
| Aulas | Somente aulas em que `instructor_id` é o próprio perfil. |
| Alunos | Somente alunos com pelo menos uma aula dele naquele espaço (em qualquer status). |
| Matrículas | Somente matrículas com pelo menos uma aula dele naquele espaço. |
| Dados de aluno | Nome e telefone. CPF, e-mail e data de nascimento são omitidos. |
| Parceiros, instrutores, membros, convites | Nada. Respondem 403. |

Se o instrutor **não tem perfil profissional**, as listagens de alunos e matrículas voltam vazias, sem erro.

**Instrutor não pode filtrar a agenda por colega.** O parâmetro `instructor_id` é ignorado na listagem do espaço para quem não é da equipe. Testado em `test_instructor_in_organization_sees_only_own_lessons_even_when_filtering_by_colleague`.

### 5. Agenda pessoal (`/me/lessons`)

Retorna aulas em que o `instructor_id` é o perfil do usuário **e** o espaço está entre aqueles em que ele tem acesso (linha em `organization_user`), **qualquer que seja o papel**.

- Se o acesso for revogado, as aulas daquele espaço somem da agenda pessoal, sem apagar nada no espaço.
- Se o vínculo profissional estiver **desativado** mas o acesso ainda existir, as aulas antigas continuam aparecendo. Esta é uma decisão deliberada: desativar impede novas atribuições, não apaga o que já foi agendado.

### 6. Aulas e ações do instrutor

O instrutor só pode mudar o status das **próprias** aulas, e somente para `completed` (realizada) ou `missed` (falta). Cancelar, remarcar e agendar são da equipe.

### 7. Dados de saúde e documentos

O checklist do processo guarda o **resultado operacional** de avaliações médica, psicológica e toxicológica, e os documentos podem conter laudos. Por isso:

- Processos, checklist e documentos (inclusive o download) são **só da equipe**. O instrutor nunca os lista.
- O instrutor atribuído enxerga apenas `practice_release` na matrícula: se está liberada e **quais tipos** de item faltam, sem notas, laudos ou referências.
- O sistema não interpreta laudos nem decide aptidão. Uma restrição médica não deve ser contornada alterando a situação comercial.

### 8. Sobre 404 e 403

| Situação | Resposta | Por quê |
|---|---|---|
| Usuário sem acesso ao espaço | **404** | Não revela que o espaço existe. |
| ID de aula, aluno ou instrutor de **outro** espaço | **404** | O route binding é limitado ao espaço da rota. |
| Registro do próprio espaço, mas sem permissão | **403** | O usuário já sabe que o espaço existe. |

## Onde a regra está no código

| Regra | Arquivo |
|---|---|
| Acesso ao espaço (404) | `app/Http/Middleware/EnsureOrganizationMember.php` |
| Papéis e permissões de papel | `app/Enums/MembershipRole.php` |
| Matriz de espaço e membros | `app/Policies/OrganizationPolicy.php`, `InvitationPolicy.php` |
| Matriz operacional | `app/Policies/OperationalPolicy.php` e policies específicas (`StudentPolicy`, `LessonPolicy`, ...) |
| Admin não promove nem remove owner | `app/Actions/Memberships/ChangeMemberRole.php`, `RevokeMembership.php` |
| Último owner | Mesmas Actions acima |
| Identidade bloqueada | `app/Http/Controllers/Api/V1/OrganizationInstructorController.php` + `InstructorPolicy::updateIdentity` |
| Escopo de instrutor | `app/Services/AssignmentScope.php` |
| Campos sensíveis | `app/Http/Resources/StudentResource.php` |
| Transições de aula | `app/Enums/LessonStatus.php` |
| Liberação para a prática | `app/Services/PracticeRelease.php`, `app/Actions/Lessons/ChangeLessonStatus.php` |
| Conferência de checklist | `app/Actions/Processes/UpdateChecklistItem.php` |
| Veículo e aluno na agenda | `app/Services/SchedulingConstraints.php` |
| Documentos privados | `app/Policies/DocumentPolicy.php`, `app/Actions/Documents/StoreDocument.php` |
