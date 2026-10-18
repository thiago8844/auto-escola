# Arquitetura

Este documento explica **como o sistema pensa** o problema: espaços de trabalho, identidade de instrutor, vínculos, parceiros e isolamento.
Para os campos e constraints, veja [modelo-de-dados.md](../apps/api/docs/modelo-de-dados.md). Para os papéis, veja [permissoes.md](permissoes.md). Para os próximos módulos e critérios de lançamento, veja o [checklist do MVP web](modulos-checklist.md).

> Status: ✅ implementado e coberto por testes, salvo onde indicado como 📋.

## 1. Espaços de trabalho (`organizations`)

Toda operação acontece dentro de um **espaço de trabalho**, uma `organization`. Há dois tipos:

- `cfc`: uma autoescola.
- `independent`: a operação particular de um instrutor autônomo.

Não existe sistema separado para CFC e para autônomo. São **os mesmos módulos** (alunos, matrículas, aulas, parceiros). O que muda é o tipo do espaço e, principalmente, o **papel** de cada pessoa nele.

Não existe `user.type`. Uma mesma pessoa pode ser `owner` de um CFC, `instructor` de outro e dona do próprio espaço particular, ao mesmo tempo.

```
João (uma pessoa)
├── CFC Alfa          → papel: instructor   (vínculo de acesso)
├── CFC Beta          → papel: instructor   (vínculo de acesso)
└── João — Particular → papel: owner        (vínculo de acesso)

Perfil profissional de João: 1 registro em `instructors`,
vinculado a cada um dos três espaços em `organization_instructor`.
```

Cada usuário pode ser dono de **no máximo um** espaço `independent`. Essa regra está em `CreateOrganization` e evita duplicar o espaço particular.

## 2. Identidade profissional (`instructors`)

O instrutor é uma **pessoa**, não um tipo de espaço. Por isso o perfil profissional é **global**:

- `full_name`, `credential_number`, `categories`: dados profissionais.
- `user_id`: conta de acesso, opcional e única. Um instrutor **pode existir sem conta** (ex.: o CFC cadastra um instrutor que ainda não usa o sistema).

Não existe endpoint público de busca ou listagem de instrutores. Cada espaço só enxerga os instrutores **vinculados a ele** (ver seção 3).

### Quem altera a identidade

| Situação | Quem pode alterar nome, credencial e categorias |
|---|---|
| Instrutor com conta vinculada | Somente o próprio instrutor, em `PATCH /me/instructor`. |
| Instrutor sem conta | A equipe do espaço que o cadastrou (`owner`, `admin`, `staff`), em `PATCH /organizations/{id}/instructors/{instructor}`. |

Isso impede que um administrador de CFC altere livremente a identidade global de alguém que já tem conta. A regra é validada em duas camadas: `InstructorPolicy::updateIdentity` e o controller, que responde `403 instructor_identity_locked` com mensagem explícita.

## 3. Vínculos separados

Há **dois vínculos independentes** entre uma pessoa e um espaço:

| Vínculo | Tabela | Responde à pergunta | Exemplo |
|---|---|---|---|
| **De acesso** | `organization_user` | "Esta conta pode entrar no espaço e com qual papel?" | Recepcionista com papel `staff`. |
| **Profissional** | `organization_instructor` | "Este instrutor pode receber aulas neste espaço?" | Instrutor ativo ou desativado. |

Essa separação permite:

- Uma recepcionista ter acesso sem ser instrutora (só o vínculo de acesso).
- Um instrutor ser cadastrado para agenda sem ter login (só o vínculo profissional).
- Um instrutor ter conta e também vínculo profissional, como o João.

Revogar acesso **não** remove o vínculo profissional, e desativar o vínculo profissional **não** remove o acesso.

## 4. Parceiros (`partners`)

Um parceiro é um CFC **externo**, que não usa o sistema e para o qual o autônomo presta serviço.

- É um cadastro local, pertencente a um único espaço.
- Não cria acesso, não cria outra organização e não sincroniza nada.
- Uma matrícula pode indicar um parceiro (`partner_id`), e o parceiro precisa pertencer ao mesmo espaço da matrícula.

## 5. Alunos e matrículas

- **Alunos** pertencem a uma organização. Dois alunos com o mesmo CPF em CFCs diferentes são **dois registros distintos**. Não há unificação automática.
- **Matrículas** ligam um aluno a uma categoria (A, B, C, ...) dentro da mesma organização, com parceiro opcional.

## 6. Aulas e a agenda única

Uma aula existe **uma única vez**, na organização que a criou. Ela não é copiada para o espaço particular do instrutor.

Quando o instrutor consulta `GET /api/v1/me/lessons`, a API:

1. Lista os espaços em que o usuário tem **acesso de fato** (linha em `organization_user`).
2. Filtra as aulas cujo `instructor_id` é o perfil profissional do próprio usuário **e** cujo `organization_id` está nessa lista.
3. Devolve cada aula uma vez, identificando a organização de origem.

Como a aula nunca é copiada, ela não pode ser duplicada. Revogar o acesso a um espaço faz as aulas daquele espaço desaparecerem da agenda pessoal, sem apagar nada no CFC.

## 7. Isolamento entre organizações

O isolamento não depende de uma única camada. São cinco barreiras, e cada uma sozinha já bloqueia o acesso indevido:

1. **Middleware `organization.member`** (`EnsureOrganizationMember`): se o usuário não tem acesso ativo ao espaço da rota, responde **404**. O 404 (e não 403) evita revelar que o espaço existe.
2. **Rotas com `scopeBindings()`**: `/organizations/{organization}/students/{student}` só encontra o aluno se ele pertencer àquela organização. Um ID de outro espaço resulta em 404.
3. **Policies**: cada ação passa por uma policy que recebe a organização como argumento. Um instrutor, por exemplo, só vê aluno se houver aula dele com esse aluno naquele espaço.
4. **Validação de relacionamentos**: `Rule::exists(...)->where('organization_id', ...)` garante que `student_id`, `partner_id`, `enrollment_id` e `instructor_id` pertençam ao espaço da rota. O `organization_id` **nunca** é aceito do body.
5. **Chaves estrangeiras compostas no banco**: `(organization_id, student_id)` referencia `students(organization_id, id)`, e assim por diante. Mesmo que o código da aplicação falhe, o MySQL recusa a gravação.

Global scopes não foram usados. Eles poderiam esconder bugs de autorização, e o isolamento precisa ser explícito e testado.

### Instrutor em várias organizações

Quando o instrutor atua em dois CFCs, o isolamento continua valendo para cada um:

- Ele enxerga os alunos de um CFC somente se tiver aula com eles **naquele** CFC.
- O CFC Alfa não consegue listar aulas do CFC Beta, mesmo que o instrutor seja o mesmo.
- A única informação compartilhada é a **disponibilidade do instrutor** (ver seção 8), e a resposta de conflito não revela de qual organização vem a aula.

## 8. Conflito de agenda e concorrência

Regra: um instrutor não pode ter duas aulas agendadas com horários sobrepostos, **considerando todas as organizações** onde ele atua.

### Como a verificação funciona

`ScheduleLesson`, `RescheduleLesson` e `ChangeLessonStatus` seguem o mesmo padrão:

1. Abrem uma transação.
2. Travam a linha do instrutor com `SELECT ... FOR UPDATE` (`InstructorAvailability::lockInstructor`).
3. Verificam o vínculo profissional ativo com a organização.
4. Procuram aulas `scheduled` do mesmo instrutor com `starts_at < novo_fim AND ends_at > novo_inicio`, em **qualquer** organização.
5. Se encontrarem, respondem `409 instructor_unavailable` com a mensagem "Instrutor indisponível nesse horário." e não informam de qual espaço vem o conflito.
6. Se não, gravam a aula e confirmam a transação.

### Por que bloquear o instrutor

Duas requisições concorrentes para o mesmo instrutor esperam uma pela outra no `FOR UPDATE`. A segunda só faz a checagem depois que a primeira confirmou, então vê a aula recém-gravada e é recusada. Sem o lock, as duas poderiam ler "nenhum conflito" ao mesmo tempo e gravar aulas sobrepostas.

O lock é por instrutor, não por tabela: agendas de instrutores diferentes não se bloqueiam entre si.

> 📋 **Limitação:** a concorrência está implementada e documentada, mas **não há teste automatizado de concorrência real** (duas conexões simultâneas). Os testes cobrem a regra de conflito em sequência. Um teste de carga com processos paralelos ainda precisa ser escrito.

## 9. Transições de status de aula

Estados: `scheduled` (agendada), `completed` (realizada), `missed` (falta), `cancelled` (cancelada).

```
scheduled ──► completed
    │
    ├───────► missed
    │
    └───────► cancelled
```

- Estados finais (`completed`, `missed`, `cancelled`) não mudam mais.
- Só aulas `scheduled` podem ser remarcadas.
- A transição é validada em `LessonStatus::canTransitionTo()`, e a própria transição roda com lock na linha da aula.

## 10. Convites e aceite

Fluxo:

1. A equipe cria o convite com e-mail, papel e (opcionalmente) um perfil de instrutor já vinculado ao espaço.
2. A API gera um token aleatório de 64 caracteres hexadecimais, grava **somente o SHA-256** e envia o token por e-mail.
3. O destinatário confirma o próprio e-mail (ver seção 11) e chama `POST /api/v1/invitations/accept` com o token.
4. A API localiza o convite pelo hash e aplica as validações.

Validações do aceite, em ordem:

| Verificação | Resultado se falhar |
|---|---|
| Token existe (busca por hash) | `404 invitation_not_found` |
| Convite não foi aceito antes | `409 invitation_already_used` |
| Convite não foi revogado | `410 invitation_revoked` |
| Convite não expirou | `410 invitation_expired` |
| Conta tem e-mail verificado | `403 email_not_verified` |
| E-mail da conta = e-mail do convite | `403 invitation_recipient_mismatch` |
| Conta ainda não tem acesso ao espaço | `409 already_member` |
| Conflito de perfil de instrutor (ver abaixo) | `409 instructor_profile_conflict` ou `instructor_profile_unavailable` |

**Nada de identidade vem do payload.** O aceite só recebe `token`. Um `email` ou `cpf` enviado junto é ignorado, e o teste `test_accept_ignores_identity_sent_in_payload` cobre isso.

### Perfil de instrutor no convite

| Situação da conta que aceita | Resultado |
|---|---|
| Convite sem perfil indicado, conta sem perfil | Cria o perfil com o nome da conta e vincula ao espaço. |
| Convite sem perfil indicado, conta com perfil | Usa o perfil da conta e vincula ao espaço. |
| Convite com perfil indicado (sem conta), conta sem perfil | Associa o perfil indicado à conta e vincula. |
| Convite com perfil indicado, conta já tem **outro** perfil | **Conflito explícito** (`409 instructor_profile_conflict`). Nada é mesclado. |
| Convite com perfil indicado já vinculado a **outra** conta | `409 instructor_profile_unavailable`. |

Um perfil só pode ser indicado num convite se estiver **vinculado ao espaço** e **sem conta**. Essa checagem é feita ao criar o convite e de novo ao aceitar (dentro de transação com lock).

### Papel

Administradores só convidam `staff` e `instructor`. Convidar `owner` ou `admin` exige ser `owner`.

## 11. Autenticação

Dois fluxos independentes, mesmo backend:

- **SPA (web):** sessão com cookie do Sanctum. Não há token guardado no navegador. Detalhes em [api.md](../apps/api/docs/api.md#autenticação).
- **Mobile:** token Bearer do Sanctum, emitido por `POST /auth/token`.

Confirmação de e-mail: o cadastro dispara um e-mail com link assinado (`signed`) para `GET /api/v1/auth/email/verify/{id}/{hash}`. Não bloqueia o login, mas **é exigida para aceitar convites**.

O link de confirmação enviado por e-mail aponta para uma página web, que repassa a assinatura à API e apresenta o resultado. A API responde JSON.

> 📋 **Limitação:** ainda não existe fluxo de redefinição de senha. Está previsto no módulo de acesso e acabamento do [checklist do MVP web](modulos-checklist.md).

## 12. Exclusão lógica e histórico

| Recurso | Como remove | Por quê |
|---|---|---|
| Parceiro | Exclusão lógica (`deleted_at`) | Matrículas antigas continuam referenciando o parceiro. |
| Aluno | Exclusão lógica | Preserva histórico de matrículas e aulas. |
| Membro (acesso) | Remove a linha em `organization_user` | Não há registro operacional que dependa do vínculo de acesso. |
| Instrutor no espaço | Desativa o vínculo (`active = false`) | Aulas já agendadas continuam válidas, e o histórico é preservado. O instrutor não é apagado. |
| Convite | Revogação (`revoked_at`) | Mantém o registro de que o convite existiu. |
| Aula | Cancelamento (status `cancelled`) | Aula é histórico. |
| Matrícula | Não há exclusão | Matrícula é histórico. |

Nenhum registro operacional é apagado fisicamente pela API.

## 13. Camadas do código

```
routes/api.php                      → rotas, middlewares, prefixo /api/v1
  └─ Middleware EnsureOrganizationMember   → acesso ao espaço (404 se não houver)
      └─ Controller (app/Http/Controllers/Api/V1)
          ├─ Form Request (app/Http/Requests)   → validação e exists() por organização
          ├─ Policy (app/Policies)              → permissão por papel
          ├─ Action (app/Actions)               → regra de negócio transacional
          │    └─ Service (app/Services)        → disponibilidade de instrutor, escopo de atribuição
          └─ API Resource (app/Http/Resources)  → resposta, com campos sensíveis filtrados
```

Por que **Actions** só onde há regra: criação de espaço, mudança de papel, convite, aceite e agenda têm várias verificações e transações. Já "listar alunos" é um `query` direto no controller.

Por que **sem repository**: o Eloquent já é a camada de acesso. Um repository genérico repetiria os métodos do Eloquent sem ganho, e tornaria o isolamento menos visível.

## 14. Segurança em resumo

- Tokens de convite: aleatórios, com hash no banco, nunca em listagens, respostas de criação ou logs. E-mail de convite não é enfileirado, para o token não ir para a tabela `jobs`.
- Senhas: hash com `bcrypt` (via cast `hashed`).
- Respostas de erro não expõem nomes de classes nem detalhes de outros espaços.
- Paginação com limite máximo de 100 itens.
- Limite de requisições (`throttle`) em cadastro, login, emissão de token, reenvio de confirmação e aceite de convite. Nas rotas públicas o limite é por IP; nas autenticadas, por usuário.
- Campos sensíveis de aluno (CPF, e-mail, data de nascimento) são omitidos para o instrutor, mesmo quando ele está atribuído ao aluno.
