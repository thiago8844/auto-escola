# API

Referência dos endpoints implementados, com autenticação, payloads, respostas, filtros, erros e exemplos.

> Status: ✅ todos os endpoints desta página estão implementados e cobertos por testes. Os exemplos de resposta foram capturados de uma execução real (dados de demonstração).

**Base:** `http://127.0.0.1:8010/api/v1` (em desenvolvimento; ver [setup-api.md](setup-api.md#6-rodar-a-api)).

**Convenções**

- Requisições e respostas em JSON. Envie `Accept: application/json`.
- Respostas de sucesso de recursos ficam em `data`. Listagens trazem `links` e `meta` (paginação do Laravel).
- IDs são inteiros.
- Datas em ISO 8601 com fuso (`2026-10-19T09:00:00+00:00`). A API armazena e devolve em UTC.
- Permissões e papéis: ver [permissoes.md](../../../docs/permissoes.md).

---

## Autenticação

A API aceita dois tipos de cliente, com mecanismos diferentes. Ambos usam o mesmo cadastro de contas.

| Cliente | Mecanismo | Como funciona |
|---|---|---|
| **SPA (web)** | Sessão com cookie (Sanctum, *stateful*) | Cookie HTTP-only de sessão e token CSRF (`XSRF-TOKEN`). Nenhum token é guardado pelo JavaScript. |
| **Mobile** | Token Bearer (Sanctum) | `Authorization: Bearer <token>`, emitido uma vez por `POST /auth/token`. |

> **Não guarde o token da SPA em `localStorage` ou `sessionStorage`.** A SPA usa o cookie de sessão; o JavaScript não precisa (nem deve) ver nenhum token.

### Fluxo da SPA

A SPA roda em outra origem (ex.: `http://localhost:5173`). Para isso funcionar:

- o domínio precisa estar em `SANCTUM_STATEFUL_DOMAINS`;
- a origem precisa estar em `CORS_ALLOWED_ORIGINS`;
- as requisições precisam enviar credenciais (`credentials: 'include'`).

**1. Pegar o cookie CSRF** (fora de `/api/v1`):

```http
GET /sanctum/csrf-cookie
```

Resposta: `204 No Content`, com o cookie `XSRF-TOKEN` definido.

**2. Login.** Envie o valor de `XSRF-TOKEN` (decodificado) no header `X-XSRF-TOKEN`:

```javascript
// Exemplo em fetch (SPA em outra origem)
await fetch('http://127.0.0.1:8010/sanctum/csrf-cookie', { credentials: 'include' });

const xsrf = decodeURIComponent(
  document.cookie.split('; ').find((c) => c.startsWith('XSRF-TOKEN=')).split('=')[1]
);

const res = await fetch('http://127.0.0.1:8010/api/v1/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-XSRF-TOKEN': xsrf,
  },
  body: JSON.stringify({ email: 'joao@autoescola.demo', password: 'demo-autoescola-123' }),
});
```

Observação: o cookie `XSRF-TOKEN` é **trocado após o login**. Sempre leia o valor atual antes de cada requisição que altera dados.

**Testado:** sem o header `X-XSRF-TOKEN`, o login responde **`419`**. Com o header, responde **`200`**.

**3. Chamadas autenticadas:** basta manter `credentials: 'include'`. Para `POST`, `PATCH` e `DELETE`, envie o `X-XSRF-TOKEN` atual.

**4. Logout:**

```http
POST /api/v1/auth/logout
X-XSRF-TOKEN: <valor atual>
```

Resposta: `204`. Depois disso, `GET /api/v1/auth/user` responde `401`.

### Fluxo mobile

**1. Emitir token:**

```bash
curl -s -X POST http://127.0.0.1:8010/api/v1/auth/token \
  -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d '{"email":"joao@autoescola.demo","password":"demo-autoescola-123","device_name":"celular-do-joao"}'
```

Resposta `201` (token truncado para exibição):

```json
{
  "token": "3|L16CEM1V6k…",
  "token_type": "Bearer",
  "expires_at": "2026-11-16T20:39:48+00:00",
  "user": {
    "id": 3,
    "name": "João Silva",
    "email": "joao@autoescola.demo",
    "email_verified": true,
    "has_instructor_profile": true
  }
}
```

O token é mostrado **uma única vez**. Guarde-o no armazenamento seguro do dispositivo (Keychain/Keystore). Validade padrão: 30 dias (`SANCTUM_TOKEN_EXPIRATION_MINUTES`).

**2. Usar:**

```bash
curl -s http://127.0.0.1:8010/api/v1/me/lessons \
  -H 'Accept: application/json' -H 'Authorization: Bearer 3|L16CEM1V6k…'
```

**3. Encerrar o token atual:** `POST /api/v1/auth/logout` com o mesmo header. Resposta `204`; o token deixa de funcionar.

> Não existe refresh token nesta versão. Quando o token expira, é preciso emitir outro com `/auth/token`.

---

## Paginação, filtros e erros

### Paginação

Todas as listagens são paginadas.

| Parâmetro | Padrão | Limite |
|---|---|---|
| `per_page` | 15 | 100 (valores acima são limitados a 100; valores abaixo de 1 viram 1) |
| `page` | 1 | |

Formato:

```json
{
  "data": [ ... ],
  "links": {
    "first": "http://127.0.0.1:8010/api/v1/me/lessons?page=1",
    "last": "http://127.0.0.1:8010/api/v1/me/lessons?page=3",
    "prev": null,
    "next": "http://127.0.0.1:8010/api/v1/me/lessons?page=2"
  },
  "meta": { "current_page": 1, "from": 1, "last_page": 3, "per_page": 1, "to": 1, "total": 3, "...": "..." }
}
```

### Erros

Todos os erros de regra de negócio seguem o formato:

```json
{
  "message": "Instrutor indisponível nesse horário.",
  "error": "instructor_unavailable"
}
```

Erros de validação (`422` do Laravel) usam o formato padrão:

```json
{
  "message": "The name field is required.",
  "errors": { "name": ["The name field is required."] }
}
```

> **Limitação:** as mensagens de validação do Laravel estão em **inglês**. Apenas as mensagens de regra de negócio do sistema estão em português. Traduzir exige publicar `lang/pt_BR` (ver [implementacao.md](implementacao.md#limitações)).

### Códigos de erro

| HTTP | `error` | Quando acontece |
|---|---|---|
| 401 | `unauthenticated` | Sem sessão ou token válido. |
| 401 | `invalid_credentials` | E-mail ou senha incorretos. |
| 403 | `forbidden` | Papel sem permissão para a ação. |
| 403 | `role_not_assignable_by_admin` | Admin tentando gerenciar owner/admin ou conceder papel acima do seu. |
| 403 | `instructor_identity_locked` | Equipe tentando alterar identidade de instrutor que tem conta. |
| 403 | `email_not_verified` | Aceite de convite com e-mail ainda não confirmado. |
| 403 | `invitation_recipient_mismatch` | Conta com e-mail diferente do destinatário do convite. |
| 403 | `invalid_verification_link` | Link de confirmação com hash inválido. |
| 404 | `not_found` | Espaço ou registro inexistente, ou de outra organização (sem acesso). |
| 404 | `invitation_not_found` | Token de convite desconhecido. |
| 404 | `instructor_profile_missing` | Usuário sem perfil de instrutor em `/me/instructor`. |
| 409 | `already_member` | Pessoa já tem acesso ao espaço. |
| 409 | `instructor_profile_exists` | Já existe perfil de instrutor para a conta. |
| 409 | `instructor_unavailable` | Conflito de horário do instrutor (qualquer organização). |
| 409 | `vehicle_unavailable` | Veículo já ocupado por outra aula agendada no horário. |
| 409 | `student_unavailable` | O aluno já tem aula agendada no horário (em qualquer matrícula). |
| 409 | `invitation_already_used` | Convite já aceito (ou tentativa de revogar convite aceito). |
| 409 | `invitation_already_pending` | Já existe convite pendente para o e-mail neste espaço. |
| 409 | `instructor_profile_conflict` | Conta já tem outro perfil de instrutor diferente do indicado no convite. |
| 409 | `instructor_profile_unavailable` | Perfil indicado já tem conta, ou não está vinculado ao espaço. |
| 410 | `invitation_expired` | Convite passou da validade. |
| 410 | `invitation_revoked` | Convite revogado pela equipe. |
| 422 | `last_owner` | Operação deixaria o espaço sem proprietário. |
| 422 | `independent_space_exists` | Usuário já é dono de um espaço particular. |
| 422 | `invalid_status_transition` | Transição de status ou remarcação não permitida para o estado atual. |
| 422 | `instructor_inactive` | Vínculo do instrutor desativado (na prática, a validação de `instructor_id` barra antes). |
| 422 | `enrollment_closed` | Matrícula encerrada ou rescindida não aceita novas aulas. |
| 422 | `vehicle_inactive` | Veículo inativo. |
| 422 | `vehicle_document_expired` | CRLV do veículo vence antes do dia da aula. |
| 422 | `vehicle_category_mismatch` | Categoria do veículo não é coberta pela categoria da matrícula. |
| 422 | `instructor_category_mismatch` | Instrutor com categorias cadastradas que não incluem a do veículo. |
| 422 | `practice_not_released` | Concluir aula de matrícula cujo checklist obrigatório não está conferido. |
| 422 | `lesson_not_completed` | Evolução, duração real ou registro oficial em aula que não está realizada. |
| 422 | `registry_evidence_required` | Confirmar registro oficial sem protocolo/referência nem documento. |
| 422 | `reason_required` | Item de checklist "não aplicável" ou "bloqueado" sem motivo em `notes`. |
| 422 | `verification_source_required` | Conferir item de checklist sem origem confiável (a declaração do aluno não basta). |
| 422 | `document_not_replaceable` | Substituir documento que não é a versão vigente, ou de outro tipo/titular. |
| 422 | `document_replaced` | Alterar documento que já foi substituído. |
| 422 | `already_verified` | Reenvio de confirmação para e-mail já confirmado. |
| 422 | (sem `error`) | Validação de campos (formato com `errors`). |

---

## Autenticação e conta

Prefixo: `/api/v1/auth`.

### `POST /auth/register`

Cria a conta. Envia e-mail de confirmação (em desenvolvimento, para o Mailpit). Não faz login.

Limite: 10 requisições por minuto por IP.

Body:

```json
{
  "name": "Ana Souza",
  "email": "ana@example.com",
  "password": "senha-forte-123",
  "password_confirmation": "senha-forte-123"
}
```

Resposta `201`:

```json
{
  "data": {
    "id": 9,
    "name": "Ana Souza",
    "email": "ana@example.com",
    "email_verified": false,
    "has_instructor_profile": false
  }
}
```

Erros: `422` (e-mail já cadastrado, senha curta ou confirmação diferente).

### `POST /auth/login` — SPA

Cria a sessão. Requer o fluxo CSRF descrito acima.

Body: `{"email": "...", "password": "..."}`

Resposta `200`: `{"data": { ...usuário... }}`. Erro `401 invalid_credentials`. Limite: 10/min por IP.

### `POST /auth/token` — mobile

Body: `{"email": "...", "password": "...", "device_name": "celular"}`

Resposta `201`: `{token, token_type, expires_at, user}`. Erro `401 invalid_credentials`. Limite: 10/min por IP.

### `POST /auth/logout`

Autenticado. Encerra a forma usada na requisição: apaga o token (mobile) ou a sessão (SPA). Resposta `204`.

### `GET /auth/user`

Autenticado. Resposta `200`: `{"data": {id, name, email, email_verified, has_instructor_profile}}`.

### `GET /auth/email/verify/{id}/{hash}`

Link enviado por e-mail. Protegido por assinatura (`signed`), então não pode ser alterado. Responde `200` com `{"message": "E-mail confirmado."}`.

Erros: `403 invalid_verification_link` (hash não confere). Link expirado ou com assinatura inválida responde `403` do próprio middleware de assinatura.

> **Limitação:** a resposta é JSON. Ainda não há página do frontend para esse link.

### `POST /auth/email/verification-notification`

Autenticado. Reenvia o e-mail de confirmação. Limite: 6/min. Resposta `200`. Erro `422 already_verified` se já confirmado.

---

## Perfil profissional da própria conta

Prefixo: `/api/v1/me`. Só a própria conta altera a identidade do próprio instrutor.

### `GET /me/instructor`

Resposta `200`:

```json
{
  "data": {
    "id": 1,
    "full_name": "João Silva",
    "credential_number": "12345",
    "categories": ["A", "B"],
    "has_account": true
  }
}
```

Erro `404 instructor_profile_missing` se a conta não tiver perfil.

### `POST /me/instructor`

Cria o perfil. Se o usuário já for dono de um espaço particular, o perfil é vinculado a ele automaticamente.

Body (`full_name` obrigatório):

```json
{ "full_name": "João Silva", "credential_number": "12345", "categories": ["A", "B"] }
```

Resposta `201` (mesmo formato do GET). Erro `409 instructor_profile_exists` se já houver perfil.

### `PATCH /me/instructor`

Atualiza `full_name`, `credential_number` e/ou `categories` (todos opcionais).

Categorias válidas: `A`, `AB`, `AC`, `AD`, `AE`, `B`, `C`, `D`, `E`. Lista vazia é aceita.

---

## Agenda pessoal

### `GET /me/lessons`

Aulas em que você é o instrutor, em **todos** os espaços aos quais tem acesso. Cada aula aparece uma única vez.

Filtros (query string):

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `from` | data `YYYY-MM-DD` | Aulas a partir deste dia (início do dia no fuso informado). |
| `to` | data `YYYY-MM-DD` | Aulas até este dia (fim do dia). Deve ser `>= from`. |
| `timezone` | fuso IANA | Fuso para interpretar `from`/`to`. Padrão: `America/Sao_Paulo` (`AUTOESCOLA_TIMEZONE`). |
| `vehicle_id` | id | Aulas com este veículo. |
| `status` | `scheduled`, `completed`, `missed`, `cancelled` | |
| `per_page` | 1 a 100 | |

Exemplo:

```bash
curl -s "http://127.0.0.1:8010/api/v1/me/lessons?from=2026-10-19&to=2026-10-20&status=scheduled" \
  -H 'Accept: application/json' -H 'Authorization: Bearer <token>'
```

Resposta `200` (exemplo real, uma aula de três):

```json
{
  "data": [
    {
      "id": 1,
      "status": "scheduled",
      "starts_at": "2026-10-19T09:00:00+00:00",
      "ends_at": "2026-10-19T10:00:00+00:00",
      "notes": "Aula de demonstração",
      "organization": { "id": 1, "name": "CFC Alfa", "type": "cfc", "timezone": "America/Sao_Paulo" },
      "instructor": { "id": 1, "full_name": "João Silva" },
      "enrollment": {
        "id": 1,
        "category": "B",
        "student": { "id": 1, "name": "Aluno Alfa Demo", "phone": "71999990000", "created_at": "2026-10-17T20:37:09+00:00" }
      },
      "created_at": "2026-10-17T20:37:09+00:00"
    }
  ],
  "links": { "...": "..." },
  "meta": { "...": "..." }
}
```

Observações:

- Aluno aparece com nome e telefone, **sem CPF, e-mail ou data de nascimento**.
- Sem perfil de instrutor, a lista volta vazia.
- Se o acesso a um espaço for revogado, as aulas desse espaço somem daqui.

---

## Espaços (organizações)

### `GET /organizations`

Lista os espaços a que você tem acesso, com seu papel em cada um.

Resposta `200`: `{"data": [{id, name, type, document, email, phone, address, city, state, timezone, role, created_at}], ...}`

### `POST /organizations`

Cria um espaço. Você vira `owner`. Se o tipo for `independent`, seu perfil de instrutor é criado (se não existir) e vinculado ao espaço.

Body:

```json
{ "name": "CFC Alfa", "type": "cfc", "document": "12.345.678/0001-90", "email": "contato@cfcalfa.example", "phone": "7133334444", "address": "Rua das Flores, 100", "city": "Belo Horizonte", "state": "MG" }
```

- `type`: `cfc` ou `independent`. Obrigatório.
- `document`: aceita máscara; a API guarda só os dígitos. Único entre organizações.
- `address` (até 255), `city` (até 100) e `state` (sigla de UF, aceita minúscula): opcionais.
- `timezone`: opcional, fuso IANA (ex.: `America/Manaus`). Padrão `America/Sao_Paulo`. Define o "dia" dos filtros de agenda; os horários seguem em UTC.

Resposta `201` com `"role": "owner"`. Erro `422 independent_space_exists` se você já for dono de um espaço particular.

### `GET /organizations/{organization}`

Resposta `200` com `role` do usuário. `404` se você não tiver acesso.

### `PATCH /organizations/{organization}`

Owner e admin. Campos: `name`, `document`, `email`, `phone`, `address`, `city`, `state`, `timezone`. Enviar `type` retorna `422`.

---

## Convites

Prefixo: `/api/v1/organizations/{organization}/invitations` (membros) e `/api/v1/invitations/accept` (aceite).

### `POST /organizations/{organization}/invitations`

Owner e admin. Envia o convite por e-mail.

Body:

```json
{ "email": "Nova.Pessoa@Example.com", "role": "staff" }
```

Para convidar um instrutor já cadastrado no espaço (sem conta), indique o perfil:

```json
{ "email": "joana@example.com", "role": "instructor", "instructor_id": 4 }
```

- `role`: `owner`, `admin`, `staff` ou `instructor`. Admin só pode `staff` e `instructor`.
- `instructor_id`: somente com `role = instructor`. O perfil precisa estar vinculado ao espaço e **sem conta**.

Resposta `201` (**sem token**):

```json
{
  "data": {
    "id": 1,
    "email": "nova.pessoa@example.com",
    "role": "staff",
    "instructor_id": null,
    "status": "pending",
    "expires_at": "2026-10-24T20:37:19+00:00",
    "accepted_at": null,
    "revoked_at": null,
    "created_at": "2026-10-17T20:37:19+00:00"
  }
}
```

O e-mail é normalizado em minúsculas. Erros: `409 already_member`, `409 invitation_already_pending`, `403 role_not_assignable_by_admin`, `422 instructor_profile_unavailable`.

### `GET /organizations/{organization}/invitations`

Owner e admin. Lista **metadados** dos convites (inclusive aceitos e revogados). Nunca inclui token.

### `DELETE /organizations/{organization}/invitations/{invitation}`

Owner e admin. Revoga um convite pendente. Resposta `200` com `status: "revoked"`. Erro `409 invitation_already_used` se já aceito.

### `POST /invitations/accept`

Autenticado. **Único dado enviado é o token.**

Body:

```json
{ "token": "9f2c…64 caracteres hexadecimais…" }
```

Resposta `200`:

```json
{
  "data": {
    "id": 1,
    "email": "nova.pessoa@example.com",
    "role": "staff",
    "status": "accepted",
    "organization": { "id": 1, "name": "CFC Alfa" },
    "...": "..."
  },
  "message": "Convite aceito."
}
```

Erros (ver tabela de códigos): `404 invitation_not_found`, `409 invitation_already_used`, `410 invitation_revoked`, `410 invitation_expired`, `403 email_not_verified`, `403 invitation_recipient_mismatch`, `409 already_member`, `409 instructor_profile_conflict`, `409 instructor_profile_unavailable`.

Limite: 20/min por usuário.

---

## Membros

Prefixo: `/api/v1/organizations/{organization}/members`. Owner e admin.

### `GET /organizations/{organization}/members`

Lista paginada: `{id, name, email, role, joined_at}`.

### `PATCH /organizations/{organization}/members/{member}`

Body: `{"role": "staff"}`. `member` é o **ID do usuário**.

- Admin só altera `staff` e `instructor`, e só concede esses dois papéis.
- Rebaixar o último `owner` retorna `422 last_owner`.

### `DELETE /organizations/{organization}/members/{member}`

Revoga o acesso (resposta `204`). Mesmas regras de papel e de último proprietário. As aulas e alunos do espaço permanecem.

---

## Instrutores do espaço

Prefixo: `/api/v1/organizations/{organization}/instructors`. Acesso: owner, admin e staff.

### `GET /organizations/{organization}/instructors`

Filtro: `active=1` ou `active=0`. Lista paginada.

```json
{
  "data": [
    { "id": 2, "full_name": "Maria Instrutora", "credential_number": "98765", "categories": ["A", "B"], "has_account": false, "active": true }
  ]
}
```

Note que **não há e-mail nem ID de conta** na resposta.

### `POST /organizations/{organization}/instructors`

Cadastra um instrutor **sem conta** e já o vincula ao espaço.

Body: `{"full_name": "Maria Instrutora", "credential_number": "98765", "categories": ["A", "B"]}`

Resposta `201`.

### `GET /organizations/{organization}/instructors/{instructor}`

Resposta `200`. `404` se o instrutor não estiver vinculado ao espaço.

### `PATCH /organizations/{organization}/instructors/{instructor}`

Altera `full_name`, `credential_number` e/ou `categories`.

**Só para instrutor sem conta.** Com conta vinculada, responde `403 instructor_identity_locked`. O próprio instrutor altera seus dados em `/me/instructor`.

### `PATCH /organizations/{organization}/instructors/{instructor}/link`

Ativa ou desativa o **vínculo com o espaço** (não a identidade). Body: `{"active": false}`.

Desativar impede agendar **novas** aulas com este instrutor neste espaço. Aulas já agendadas continuam. Resposta `200` com `active` atualizado.

---

## Parceiros

Prefixo: `/api/v1/organizations/{organization}/partners`. Acesso: owner, admin, staff.

| Método | Caminho | Descrição |
|---|---|---|
| `GET` | `/partners` | Lista. Filtro: `search` (busca por nome). |
| `POST` | `/partners` | Cria. `name` obrigatório. |
| `GET` | `/partners/{partner}` | Consulta. |
| `PUT`/`PATCH` | `/partners/{partner}` | Atualiza. |
| `DELETE` | `/partners/{partner}` | Exclusão lógica (`204`). |

Campos: `name`, `document` (dígitos), `email`, `phone`.

---

## Alunos

Prefixo: `/api/v1/organizations/{organization}/students`.

| Método | Caminho | Quem |
|---|---|---|
| `GET` | `/students` | Equipe: todos. Instrutor: só os atribuídos a ele. Filtro: `search`. |
| `POST` | `/students` | Equipe. |
| `GET` | `/students/{student}` | Equipe: todos. Instrutor: só se atribuído (senão `403`). |
| `PUT`/`PATCH` | `/students/{student}` | Equipe. |
| `DELETE` | `/students/{student}` | Equipe. Exclusão lógica (`204`). |

Body de criação:

```json
{
  "name": "Carla Aluna",
  "cpf": "123.456.789-09",
  "email": "carla@example.com",
  "phone": "71999990000",
  "birth_date": "2000-01-15"
}
```

- `cpf`: aceita máscara; a API guarda só os dígitos (11). Único **dentro do espaço**.
- `birth_date`: anterior a hoje.

Resposta para a equipe (com CPF):

```json
{ "data": { "id": 1, "name": "Carla Aluna", "phone": "71999990000", "cpf": "12345678909", "email": "carla@example.com", "birth_date": "2000-01-15", "created_at": "..." } }
```

Resposta para o instrutor: sem `cpf`, `email` e `birth_date`.

---

## Matrículas

Prefixo: `/api/v1/organizations/{organization}/enrollments`. Sem exclusão (matrícula é histórico).

| Método | Caminho | Quem |
|---|---|---|
| `GET` | `/enrollments` | Equipe: todas. Instrutor: só as atribuídas. Filtro: `student_id`. |
| `POST` | `/enrollments` | Equipe. |
| `GET` | `/enrollments/{enrollment}` | Equipe ou instrutor atribuído. |
| `PUT`/`PATCH` | `/enrollments/{enrollment}` | Equipe. Não troca o aluno. |

Criação:

```json
{
  "student_id": 1,
  "partner_id": null,
  "category": "B",
  "qualification_process_id": 3,
  "status": "contracted",
  "contracted_minutes": 1200,
  "price_cents": 250000,
  "notes": "Pacote de 20 aulas de 60 min"
}
```

- `student_id`: obrigatório, do **mesmo espaço**.
- `partner_id`: opcional, do **mesmo espaço** e não excluído (a auto escola em nome da qual o autônomo atende).
- `category`: uma de `A`, `AB`, `AC`, `AD`, `AE`, `B`, `C`, `D`, `E`, `ACC`.
- `qualification_process_id`: opcional. O processo precisa ser **do mesmo aluno** e a categoria da matrícula precisa estar entre as categorias pretendidas dele (`422` caso contrário). Matrícula sem processo não tem checklist a conferir.
- `status`: `prospect`, `contracted` (padrão), `in_service`, `closed`, `terminated`. `closed` e `terminated` impedem novas aulas.
- `contracted_minutes`: serviço contratado **em minutos**. O sistema não presume "hora" nem "hora-aula".
- `price_cents`: preço em centavos. `price_cents` e `notes` só aparecem para a equipe.
- Na atualização, `student_id` é proibido (`422`): a matrícula não troca de aluno.

Resposta:

```json
{
  "data": {
    "id": 1,
    "category": "B",
    "status": "contracted",
    "contracted_minutes": 1200,
    "price_cents": 250000,
    "notes": null,
    "qualification_process_id": 3,
    "practice_release": { "released": false, "pending": ["learning_license", "medical_exam"] },
    "student": { "id": 1, "name": "Carla Aluna", "phone": "71999990000" },
    "created_at": "..."
  }
}
```

`practice_release` só aparece quando a matrícula tem processo. Lista apenas os **tipos** pendentes (sem laudos nem notas), por isso o instrutor atribuído também a vê.

---

## Veículos

Prefixo: `/api/v1/organizations/{organization}/vehicles`. Exclusão lógica.

| Método | Caminho | Quem |
|---|---|---|
| `GET` | `/vehicles` | Qualquer membro. Filtros: `status`, `category`, `search` (placa ou modelo). |
| `GET` | `/vehicles/{vehicle}` | Qualquer membro. |
| `POST`, `PATCH`, `DELETE` | `/vehicles`, `/vehicles/{vehicle}` | Equipe. |

```json
{
  "plate": "abc-1d23",
  "brand": "Fiat",
  "model": "Argo",
  "year": 2023,
  "category": "B",
  "adapted": false,
  "adaptations": null,
  "crlv_expires_at": "2027-03-31",
  "status": "active",
  "notes": null
}
```

- `plate`: normalizada para maiúsculas, 7 caracteres alfanuméricos (formato antigo ou Mercosul), **única no espaço** (inclusive entre excluídos).
- `category`: **simples** (`A`, `B`, `C`, `D`, `E`, `ACC`). `AB` não existe para veículo: uma matrícula AB usa um veículo `A` ou `B`.
- `status`: `active` ou `inactive`.
- `crlv_expires_at`: opcional. Quando existe, o veículo não pode ser usado em aulas **depois** dessa data.

---

## Processos de habilitação

Prefixo: `/api/v1/organizations/{organization}/qualification-processes`. **Só a equipe** (o checklist contém resultados de saúde). Sem exclusão.

É o **acompanhamento local** de um atendimento, não o sistema oficial: guarda referências (Renach, protocolo) e o checklist de liberação para a prática. Um processo AB é **um** processo com duas categorias pretendidas.

| Método | Caminho | Nota |
|---|---|---|
| `GET` | `/qualification-processes` | Filtros: `status`, `type`, `student_id`. Traz o resumo `practice_release`. |
| `POST` | `/qualification-processes` | Cria o processo **e** o checklist inicial. |
| `GET` | `/qualification-processes/{process}` | Traz o checklist completo. |
| `PATCH` | `/qualification-processes/{process}` | `type` e `student_id` não mudam. |
| `POST` | `/qualification-processes/{process}/checklist-items` | Acrescenta uma exigência. |
| `PATCH` | `/qualification-processes/{process}/checklist-items/{item}` | Atualiza situação, origem, referência, notas, documento. |

Criação:

```json
{
  "student_id": 1,
  "type": "first_license",
  "uf": "MG",
  "municipality": "Belo Horizonte",
  "renach": "MG123456789",
  "protocol": null,
  "opened_at": "2026-09-01",
  "current_categories": [],
  "target_categories": ["B"],
  "notes": null
}
```

- `type`: `first_license`, `category_addition`, `category_change`, `refresher`.
- `uf`: sigla de uma UF.
- `current_categories`: **obrigatória** (mínimo 1) para adição, mudança e aperfeiçoamento; **vazia** na primeira habilitação.
- `target_categories`: obrigatória.
- `status`: `preparing` (padrão), `active`, `pending`, `awaiting_issuance`, `completed`, `closed`. É a situação do **acompanhamento local**.
- Nenhuma regra de elegibilidade (idade, tempo de CNH) é calculada: o deferimento é do órgão.

### Checklist de liberação

Itens criados por tipo de processo (padrões do produto, não verdade legal; ver [fluxo-habilitacao-brasil-mg.md](../../../docs/fluxo-habilitacao-brasil-mg.md), V03 e V11):

| Tipo do processo | Obrigatórios | Opcionais (situação `unknown`) |
|---|---|---|
| `first_license` | `theory_completion`, `learning_license`, `medical_exam`, `psychological_exam` | `toxicological_exam` (em MG é após a aprovação prática) |
| `category_addition` | `current_license`, `learning_license`, `medical_exam` | `psychological_exam` |
| `category_change` | `current_license`, `learning_license`, `medical_exam`, `toxicological_exam` | `psychological_exam` |
| `refresher` | `current_license` | — |

Situações do item: `unknown`, `pending`, `in_progress`, `done`, `verified`, `not_applicable`, `blocked`. Origem (`source`): `student_declared`, `document`, `official_system`, `imported`.

Regras:

- **Libera a prática** apenas `verified` (conferido) ou `not_applicable` (com motivo). `done` é o que foi declarado/realizado, ainda sem conferência.
- `verified` exige `source` diferente de `student_declared` (`422 verification_source_required`) e registra `checked_by` e `checked_at`. Sair de `verified` limpa essa marca.
- `not_applicable` e `blocked` exigem `notes` com o motivo (`422 reason_required`).
- `required` **não é editável**: a equipe pode acrescentar exigências (`POST`, sempre obrigatórias, tipo único por processo), nunca ocultá-las.
- `document_id` precisa ser do mesmo espaço e do mesmo aluno/processo. Anexar o documento **não** muda a situação do item.

Atualização de item:

```json
{ "status": "verified", "source": "document", "reference": "LA-2026-1234", "occurred_on": "2026-09-20", "document_id": 7 }
```

### Onde a liberação é exigida

- **Agendar** aula: permitido antes da liberação (pré-reserva).
- **Concluir** aula (`status: completed`): exige liberação, senão `422 practice_not_released` com os itens pendentes na mensagem. Falta e cancelamento não exigem.
- Matrícula **sem** processo não é bloqueada.

---

## Documentos

Prefixo: `/api/v1/organizations/{organization}/documents`. **Só a equipe**, inclusive o download (podem conter dados de saúde).

| Método | Caminho | Nota |
|---|---|---|
| `GET` | `/documents` | Filtros: `student_id`, `qualification_process_id`, `vehicle_id`, `type`, `status`. |
| `POST` | `/documents` | `multipart/form-data`. |
| `GET` | `/documents/{document}` | Metadados. |
| `PATCH` | `/documents/{document}` | `status` (`attached`, `verified`, `rejected`), `issuer`, `issued_at`, `expires_at`, `notes`. |
| `GET` | `/documents/{document}/download` | Devolve o arquivo original (autenticado). |

Upload (campos do formulário):

| Campo | Regra |
|---|---|
| `file` | Obrigatório. PDF, JPG, PNG ou WebP, até 10 MB (`DOCUMENT_MAX_KB`). |
| `type` | `identity`, `current_license`, `proof_of_residence`, `process_protocol`, `learning_license`, `theory_completion`, `assessment_result`, `payment_guide`, `payment_proof`, `exam_scheduling`, `exam_result`, `contract`, `receipt`, `official_request`, `vehicle_registration`, `official_lesson_record`, `other`. |
| `student_id`, `qualification_process_id`, `vehicle_id` | Ao menos um, do mesmo espaço. Informando só o processo, o aluno é preenchido a partir dele. |
| `replaces_document_id` | Cria a próxima versão e marca a anterior como `replaced`. Só a versão vigente, do mesmo tipo e titular. |
| `issuer`, `issued_at`, `expires_at`, `notes` | Opcionais. `expires_at` nulo = validade indeterminada. |

- O arquivo fica em disco **privado** (`storage/app/private`), com nome aleatório. O caminho nunca aparece na API.
- `verified` registra quem conferiu e quando; é conferência interna, não prova autenticidade.
- Documento `replaced` não pode mais ser alterado (`422 document_replaced`).

---

## Aulas

Prefixo: `/api/v1/organizations/{organization}/lessons`.

| Método | Caminho | Quem |
|---|---|---|
| `GET` | `/lessons` | Equipe: todas. Instrutor: só as próprias. |
| `POST` | `/lessons` | Equipe. |
| `GET` | `/lessons/{lesson}` | Equipe ou instrutor dono da aula. |
| `POST` | `/lessons/{lesson}/reschedule` | Equipe. |
| `PATCH` | `/lessons/{lesson}/status` | Equipe (qualquer transição). Instrutor dono: só `completed` e `missed`. |

### Listagem

Filtros: `from`, `to`, `status`, `enrollment_id`, `vehicle_id`, `instructor_id` (ignorado para instrutor), `per_page`.

`from` e `to` são **dias no fuso do espaço** (`timezone` da organização, padrão `America/Sao_Paulo`). Os horários continuam em UTC na resposta; o fuso só define onde o dia começa e termina. Na agenda pessoal (`/me/lessons`, que mistura espaços) vale o fuso padrão da aplicação ou o informado em `?timezone=`.

### Agendar

```json
{
  "enrollment_id": 1,
  "instructor_id": 1,
  "vehicle_id": 2,
  "starts_at": "2026-10-19T09:00:00Z",
  "ends_at": "2026-10-19T10:00:00Z",
  "notes": "Primeira aula prática"
}
```

Regras:

- `ends_at` depois de `starts_at`.
- Duração de no máximo **240 minutos**.
- A matrícula não pode estar `closed` nem `terminated` (`422 enrollment_closed`).
- O instrutor precisa ter vínculo **ativo** com o espaço.
- O instrutor não pode ter outra aula `scheduled` sobreposta, em **nenhuma** organização.
- `vehicle_id` é opcional. Quando informado:
  - veículo do mesmo espaço, ativo, e com CRLV válido no dia da aula (fuso do espaço);
  - a categoria do veículo precisa ser **coberta** pela matrícula (matrícula `AB` aceita veículo `A` ou `B`; matrícula `B` não aceita veículo `A`);
  - se o instrutor tem categorias cadastradas, uma delas precisa cobrir a do veículo (instrutor sem categorias não é bloqueado);
  - o veículo não pode ter outra aula `scheduled` sobreposta.
- O **aluno** não pode ter outra aula `scheduled` sobreposta, em nenhuma de suas matrículas.
- Agendar não exige a liberação para a prática; concluir exige (ver *Processos*).

Resposta `201` com a aula.

Conflito de instrutor (`409`), mesmo que a sobreposição seja com aula de **outro espaço**:

```json
{
  "message": "Instrutor indisponível nesse horário.",
  "error": "instructor_unavailable"
}
```

A mensagem não revela em qual organização está a aula que conflita. Conflitos de veículo e de aluno são sempre do próprio espaço e usam `vehicle_unavailable` e `student_unavailable`.

Se `enrollment_id`, `instructor_id` ou `vehicle_id` não pertencer a este espaço, a resposta é `422` de validação, antes de qualquer verificação de horário.

### Resposta da aula

```json
{
  "data": {
    "id": 5,
    "status": "completed",
    "starts_at": "2026-10-19T09:00:00+00:00",
    "ends_at": "2026-10-19T09:50:00+00:00",
    "scheduled_minutes": 50,
    "actual_minutes": 45,
    "status_reason": null,
    "notes": null,
    "evolution": "Treinou baliza; precisa melhorar embreagem.",
    "registry": { "status": "not_informed", "reference": null, "document_id": null },
    "vehicle": { "id": 2, "plate": "ABC1D23", "model": "Argo", "category": "B" },
    "instructor": { "id": 1, "full_name": "João Silva" },
    "enrollment": { "id": 1, "category": "B", "student": { "id": 1, "name": "Carla Aluna" } }
  }
}
```

Duração agendada (`scheduled_minutes`) e duração real (`actual_minutes`) são separadas.

### Remarcar

```http
POST /organizations/1/lessons/5/reschedule
{ "starts_at": "2026-10-20T14:00:00Z", "ends_at": "2026-10-20T15:00:00Z" }
```

- Só aulas `scheduled`. Outra situação: `422 invalid_status_transition`.
- A própria aula não conta como conflito (remarcar para o mesmo horário é permitido).
- Instrutor, veículo e aluno são conferidos no novo horário: `409 instructor_unavailable`, `vehicle_unavailable` ou `student_unavailable`; CRLV é conferido na nova data.

### Alterar status

```http
PATCH /organizations/1/lessons/5/status
{ "status": "completed", "actual_minutes": 45, "evolution": "Aluna foi bem na baliza", "notes": "..." }
```

Transições:

| De | Para |
|---|---|
| `scheduled` | `completed`, `missed`, `cancelled` |
| `completed`, `missed`, `cancelled` | (nenhuma) |

Outra transição: `422 invalid_status_transition`. Como estados finais não mudam, **concluir duas vezes é rejeitado** e nada é contado em dobro.

Campos por status:

| Campo | `completed` | `missed` / `cancelled` |
|---|---|---|
| `actual_minutes` | Opcional (padrão: duração agendada) | Proibido |
| `evolution` | Opcional | Proibido |
| `reason` | Proibido | Opcional (motivo da falta/cancelamento) |
| `notes` | Opcional | Opcional |

`completed` exige a matrícula liberada para a prática (`422 practice_not_released`), se ela tiver processo.

### Observações, evolução e duração real

```http
PATCH /organizations/1/lessons/5
{ "notes": "...", "evolution": "...", "actual_minutes": 48 }
```

Equipe ou instrutor dono da aula. `evolution` e `actual_minutes` só em aula `completed` (`422 lesson_not_completed`).

### Registro oficial

```http
PATCH /organizations/1/lessons/5/registry
{ "registry_status": "confirmed", "registry_reference": "PROT-2026-123", "registry_document_id": 9 }
```

Só a equipe. É o registro do lançamento **oficial** da aula (feito fora do sistema), separado do status operacional: concluir a aula **não** o preenche.

- `registry_status`: `not_informed`, `pending`, `confirmed`, `rejected`.
- Qualquer valor diferente de `not_informed` exige aula `completed`.
- `confirmed` exige `registry_reference` **ou** `registry_document_id` (evidência).

---

## Resumo de endpoints

| Método | Caminho | Autenticação | Nota |
|---|---|---|---|
| POST | `/auth/register` | Não | |
| POST | `/auth/login` | Não (cria sessão) | SPA |
| POST | `/auth/token` | Não | Mobile |
| POST | `/auth/logout` | Sim | |
| GET | `/auth/user` | Sim | |
| GET | `/auth/email/verify/{id}/{hash}` | Não (assinado) | |
| POST | `/auth/email/verification-notification` | Sim | |
| GET, POST | `/me/instructor` | Sim | |
| PATCH | `/me/instructor` | Sim | |
| GET | `/me/lessons` | Sim | Agenda pessoal |
| GET, POST | `/organizations` | Sim | |
| GET, PATCH | `/organizations/{organization}` | Sim + membro | |
| GET | `/organizations/{organization}/members` | Owner, admin | |
| PATCH, DELETE | `/organizations/{organization}/members/{member}` | Owner, admin | |
| GET, POST | `/organizations/{organization}/invitations` | Owner, admin | |
| DELETE | `/organizations/{organization}/invitations/{invitation}` | Owner, admin | |
| POST | `/invitations/accept` | Sim | Só token |
| GET, POST | `/organizations/{organization}/instructors` | Equipe | |
| GET, PATCH | `/organizations/{organization}/instructors/{instructor}` | Equipe (PATCH: sem conta) | |
| PATCH | `/organizations/{organization}/instructors/{instructor}/link` | Equipe | |
| CRUD | `/organizations/{organization}/partners` | Equipe | DELETE lógico |
| CRUD | `/organizations/{organization}/students` | Equipe; instrutor parcial | DELETE lógico |
| GET, POST, GET, PATCH | `/organizations/{organization}/enrollments` | Equipe; instrutor parcial | Sem DELETE |
| CRUD | `/organizations/{organization}/vehicles` | Qualquer membro lê; equipe altera | DELETE lógico |
| GET, POST, GET, PATCH | `/organizations/{organization}/qualification-processes` | Equipe | Sem DELETE |
| POST | `/organizations/{organization}/qualification-processes/{process}/checklist-items` | Equipe | |
| PATCH | `/organizations/{organization}/qualification-processes/{process}/checklist-items/{item}` | Equipe | |
| GET, POST | `/organizations/{organization}/documents` | Equipe | Upload multipart |
| GET, PATCH | `/organizations/{organization}/documents/{document}` | Equipe | |
| GET | `/organizations/{organization}/documents/{document}/download` | Equipe | Arquivo privado |
| GET, POST | `/organizations/{organization}/lessons` | Equipe; instrutor parcial | |
| GET | `/organizations/{organization}/lessons/{lesson}` | Equipe; instrutor dono | |
| PATCH | `/organizations/{organization}/lessons/{lesson}` | Equipe; instrutor dono | Notas, evolução, duração real |
| PATCH | `/organizations/{organization}/lessons/{lesson}/registry` | Equipe | Registro oficial |
| POST | `/organizations/{organization}/lessons/{lesson}/reschedule` | Equipe | |
| PATCH | `/organizations/{organization}/lessons/{lesson}/status` | Equipe; instrutor dono (parcial) | |

*Equipe* = owner, admin ou staff. *Parcial* = instrutor, só o atribuído a ele.

Para o detalhamento de cada permissão, veja [permissoes.md](../../../docs/permissoes.md).

## Saldo de aulas, exames, taxas e desfecho

Todas as rotas ficam sob `/api/v1/organizations/{organization}`. Erros de regra de negócio trazem `error` (código estável) e `message` em português.

### Pacotes e saldo (`enrollments/{enrollment}`)

| Método | Rota | Quem | Descrição |
|---|---|---|---|
| `GET` | `/balance` | Equipe | Saldo calculado sobre todo o extrato: `contracted`, `reserved`, `realized`, `consumed`, `available`, `by_category` (AB), `policy`, `packages`. |
| `GET` | `/credit-entries` | Equipe | Extrato paginado (origem, data, responsável, motivo). |
| `POST` | `/packages` | Equipe | Contratação/acréscimo com política (`consume_basis`, `absence_charge`, `late_cancel_charge`, `cancel_notice_hours`). |
| `POST` | `/credit-adjustments` | Proprietário/gestor | Ajuste manual (`minutes` ≠ 0, `reason`). Nunca deixa o saldo negativo. |
| `POST` | `/credit-entries/{id}/reversal` | Proprietário/gestor | Estorno por movimento compensatório (`reason`); o original é preservado. |

`POST /lessons` aceita `category` (matrícula AB sem veículo) e `override_reason` (exceção com saldo insuficiente) e devolve `warnings`. Reserva, liberação e consumo de cada aula são idempotentes (`lesson:ID:tipo`). `contracted_minutes`/`price_cents` não mudam mais por `PATCH` da matrícula.

### Exames e taxas

| Método | Rota | Quem | Descrição |
|---|---|---|---|
| `GET`/`POST` | `/exams` | Equipe (instrutor: lista resumida dos próprios) | Filtros `from`, `to`, `category`, `status`, `q`, `student_id`, `qualification_process_id`. |
| `GET`/`PATCH` | `/exams/{exam}` | Equipe / instrutor responsável (resumo) | Protocolo, local e observações. |
| `POST` | `/exams/{exam}/reschedule` | Equipe | Mantém a tentativa; data/local anteriores vão para `schedule_history`. |
| `POST` | `/exams/{exam}/result` | Equipe | `approved`, `failed`, `absent`, `incomplete` ou `cancelled`. |
| `POST` | `/exams/{exam}/result-correction` | Proprietário/gestor | Corrige resultado com `reason`; o anterior fica na auditoria. |
| `*` | `/external-fees` (+ `/{id}/status`, `/{id}/reimbursement`) | Equipe | Taxas sem efeito em caixa; confirmação exige `confirmation_source` e `paid_by`. |

### Desfecho e histórico (`qualification-processes/{process}`)

`GET /closure-check`, `POST /issuance`, `POST /close`, `POST /reopen` (proprietário/gestor), `POST /categories/{cat}/renunciation[/confirm|/revert]`, `GET /timeline`. O recurso do processo traz `outcome` (resultado por categoria, emissão, encerramento e `next_step`). Também: `GET /students/{student}/timeline` (equipe) e `GET /audit-events` (proprietário/gestor).

## Disponibilidade e frota (módulo 4)

Rotas sob `/api/v1/organizations/{organization}`. Bloqueios, manutenção e disponibilidade nunca cancelam compromissos: devolvem a lista dos afetados (`meta.affected`) para a equipe decidir.

| Método | Rota | Quem | Descrição |
|---|---|---|---|
| `GET` | `/availability-blocks` | Membro (instrutor: só os próprios) | Filtros `resource_type`, `vehicle_id`, `instructor_id`, `status`, `current=1`. Indisponibilidade pessoal criada em outro espaço aparece só como janela (`external: true`, sem motivo nem responsável). |
| `POST` | `/availability-blocks` | Equipe (veículo e instrutor do espaço); o próprio instrutor (`scope: personal`) | `resource_type`, `vehicle_id`/`instructor_id`, `scope` (`organization`\|`personal`), `kind` (`maintenance`, `absence`, `vacation`, `other`), `starts_at`, `ends_at`, `reason`. Resposta: `meta.affected` e `meta.external_affected` (só a contagem de outros espaços). |
| `PATCH` | `/availability-blocks/{id}` | Equipe / instrutor dono (pessoal) | Tipo, período e motivo. Recalcula `meta.affected`. |
| `POST` | `/availability-blocks/{id}/release` | Equipe / instrutor dono (pessoal) | `note` opcional. O bloqueio vira `released` e permanece no histórico. |
| `GET` | `/availability-blocks/impact` | Equipe | Prévia (`vehicle_id` ou `instructor_id`, `starts_at`, `ends_at`) sem gravar. |
| `GET`/`POST` | `/maintenances` | Equipe | `vehicle_id`, `type`, `scheduled_on`, `provider`, `odometer_km`, `estimated_cost_cents`, `notes` e `block: {starts_at, ends_at}` opcional (bloqueia a agenda na mesma transação). Cada manutenção recebe `finance_ref` (uuid único) para a futura conta a pagar. |
| `PATCH` | `/maintenances/{id}` | Equipe | Só enquanto `scheduled`. |
| `POST` | `/maintenances/{id}/complete` | Equipe | Registra realizado (`performed_on`, `actual_cost_cents`, `odometer_km`, `next_due_date`, `next_due_km`, `document_id`) e libera o bloqueio ligado. |
| `POST` | `/maintenances/{id}/cancel` | Equipe | `reason` opcional; libera o bloqueio ligado. |
| `GET` | `/vehicles/{vehicle}/overview` | Equipe | Veículo, documentos e versões, bloqueios, manutenções, próximas revisões (`maintenance_due`) e compromissos futuros com `issues` (`blocked`, `crlv_expired`, `inactive`). |
| `GET` | `/vehicles/{vehicle}/commitments`, `/instructors/{instructor}/commitments` | Equipe | Aulas e exames futuros do recurso. |
| `GET` | `/instructors/{instructor}/availability` | Equipe / o próprio instrutor | Regra (`free`\|`restricted`), horários, bloqueios e próximos compromissos. |
| `PUT` | `/instructors/{instructor}/weekly-hours` | Equipe | `weekly_hours` (`{"1":[{"start":"08:00","end":"12:00"}]}`, 1 = segunda) ou `null`. |
| `POST` | `/lessons/{lesson}/reassign` | Equipe | Troca `vehicle_id` e/ou `instructor_id` mantendo horário e saldo; confere bloqueios e conflitos. |

- `PATCH /organizations/{id}` aceita `business_hours` (mesmo formato; `null` = agenda livre). A aula precisa caber no horário do espaço e no do instrutor, se definidos; fora dele, envie `hours_override_reason` em `POST /lessons` ou `/lessons/{id}/reschedule` (fica na auditoria).
- Agendar ou remarcar aula/exame responde `409` com `vehicle_blocked` ou `instructor_blocked` (mensagem indica como resolver). Indisponibilidade pessoal de outro espaço responde o genérico `instructor_unavailable`.
- `PATCH /vehicles/{id}` (inativar ou antecipar o CRLV) e `PATCH /instructors/{id}/link` (desativar) devolvem `meta.affected`. `DELETE /vehicles/{id}` com compromissos futuros responde `422 vehicle_has_commitments`.
- `GET /lessons/{id}` (equipe, aula agendada) traz `meta.blockers`: o que impediria a execução hoje. Concluir a aula revalida liberação, validade dos documentos do checklist, veículo ativo, sem bloqueio e CRLV vigente (`practice_document_expired`, `vehicle_inactive`, `vehicle_blocked`, `vehicle_document_expired`).

## Pendências e alertas (módulo 5)

Rotas sob `/api/v1/organizations/{organization}`. O alerta pertence ao espaço (uma linha por pendência, deduplicada por `dedup_key`); leitura e arquivamento são **por usuário** e ficam no servidor. Quem enxerga cada alerta é calculado a cada consulta pelo papel atual: proprietário e gestor veem os alertas de equipe; `staff` também, se `staff_receives` estiver ligado; o instrutor vê só os atribuídos a ele (ex.: aula dele sem desfecho, exame em que é responsável). Revogar o acesso encerra tudo (a rota passa a responder 404).

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/alerts` | Filtros: `status` (`open` padrão, `resolved`, `all`), `unread=1`, `archived=1`, `category`, `priority`. Ordem: prioridade e mais recentes. `meta` traz paginação e os contadores `unread`, `critical_unread`, `open`. |
| `GET` | `/alerts/summary` | Só os contadores (usado pelo sino). |
| `POST` | `/alerts/{id}/read`, `/alerts/read-all` | Marca como lida para o usuário atual. |
| `POST` | `/alerts/{id}/archive`, `/alerts/{id}/unarchive` | Arquiva/restaura (arquivar também marca como lida). |
| `POST` | `/alerts/refresh` | Recalcula as pendências do espaço agora. |
| `GET`/`PATCH` | `/alert-settings` | Antecedência e destinatários; só proprietário e gestor alteram. |

**Geração.** `AlertEngine` calcula o conjunto completo de pendências do espaço e o reconcilia com o gravado: cria o que é novo, atualiza texto/prioridade/prazo, resolve o que deixou de existir e reabre (como não lido) o que voltou. É idempotente e trava o espaço durante a rodada. O prazo faz parte da chave nos alertas por vencimento (mudar o prazo resolve o antigo e cria o novo). Detectores: CRLV (a vencer/vencido, crítico com aulas depois da data), documentos do aluno/veículo, revisão de manutenção por data/km, bloqueios com compromissos afetados, aula próxima sem liberação para a prática, exame próximo, resultado de exame não informado, taxa externa (a vencer, vencida, pagamento aguardando confirmação, pendente com exame próximo), emissão pendente/não entregue, saldo baixo/esgotado, aula agendada no passado sem desfecho e aluno em atendimento sem aula.

**Agendador.** `php artisan alerts:generate` enfileira um `GenerateOrganizationAlerts` por espaço (`--now` executa na hora; `--organization=ID` reprocessa um espaço). Está agendado a cada 10 minutos em `routes/console.php`: em produção rode `schedule:run` (cron) e um worker de fila.

**Configurações** (`alert-settings`): `crlv_lead_days` (30), `document_lead_days` (30), `exam_lead_days` (3), `fee_lead_days` (5), `release_lead_days` (7), `low_balance_minutes` (100), `inactive_days` (14), `lesson_grace_hours` (2), `staff_receives` (true).

## Acesso, correções e acabamento (módulo 6)

**Recuperação e troca de senha** (decisão registrada em `config/autoescola.php`):

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/forgot-password` | `email`. Responde sempre igual, exista a conta ou não, e é limitado a 5 pedidos por minuto por IP. O e-mail leva a `FRONTEND_URL/redefinir-senha?token=…&email=…`. |
| `POST` | `/auth/reset-password` | `email`, `token`, `password`, `password_confirmation`. Link de uso único que expira em 60 minutos; link inválido, expirado ou já usado responde `422 invalid_reset_token`. Encerra todos os tokens e sessões da conta. |
| `POST` | `/auth/password` | Autenticado: `current_password`, `password`, `password_confirmation` (a nova precisa ser diferente). Mantém a sessão/token atual e encerra os demais. |

- **Política de senha:** mínimo vigente em `autoescola.password_min` — **8 em produção**, 3 em desenvolvimento/testes (`AUTOESCOLA_PASSWORD_MIN` sobrescreve). Sem exigência de símbolos. O web lê a mesma regra (`VITE_PASSWORD_MIN`; em build de produção, 8).
- **Mensagens em português:** `lang/pt_BR` (validação, senhas, autenticação); `APP_LOCALE=pt_BR` por padrão.
- **Duplo envio e falha de rede:** `Idempotency-Key` (8–100 caracteres) em qualquer POST/PUT/PATCH/DELETE de `/organizations/{id}/…`. A primeira resposta 2xx é guardada por 24 h e devolvida (`Idempotent-Replay: true`) em repetições; duas requisições simultâneas com a mesma chave não rodam juntas (`409 request_in_progress`); mesma chave com outro conteúdo é recusada (`422 idempotency_key_reused`). Erros não são guardados.
- **Edição simultânea:** `PATCH` de aluno, parceiro, veículo, matrícula, processo e espaço aceita `expected_updated_at` (o `updated_at` recebido ao abrir a tela). Se o registro mudou, responde `409 stale_record` em vez de sobrescrever. Sem o campo, nada muda.
- **Arquivar e restaurar:** `DELETE` arquiva (aluno, parceiro, veículo); `POST …/restore` restaura; `?archived=1` lista os arquivados. Aluno com aula/exame agendado (`student_has_commitments`) ou matrícula em andamento (`student_has_open_enrollments`) não é arquivado; veículo com compromissos futuros também não (`vehicle_has_commitments`). CPF e placa continuam reservados ao cadastro arquivado, e o erro orienta a restaurar. Todo arquivamento e restauração entra na auditoria.
- **Documentos:** `GET /documents/{id}/versions` devolve a cadeia de substituições; `download` de arquivo ausente responde `404 document_file_missing` com orientação para anexar de novo.
- **Filtros:** `GET /enrollments` aceita `status`, `category`, `partner_id`, `search` (nome do aluno); `GET /qualification-processes` aceita `category` e `search`.
- **Primeiros passos:** `GET /onboarding` (equipe) devolve os 7 passos com `done`, `done`/`total` e `support_email`.

## Relatórios e painel de gestão (módulo 7)

Rotas sob `/api/v1/organizations/{organization}/reports`. Exceto `dashboard` e `my-summary`, são **só da equipe de operação** (o instrutor recebe 403). Os filtros são aplicados na API sobre todos os registros elegíveis; totais, detalhe paginado e exportação usam a mesma consulta, então conciliam em qualquer página. `from`/`to` são **dias no fuso do espaço** (do início do primeiro ao fim do último); a data de referência é o início da aula ou do exame.

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/reports/dashboard` | Equipe: aulas de hoje e da semana, alunos em atendimento, pendências (abertas/urgentes), saldo baixo, próximos exames e aulas. Instrutor: só as próprias aulas e pendências. |
| `GET` | `/reports/lessons` | Filtros: `from`, `to`, `instructor_id`, `vehicle_id`, `category`, `status`, `partner_id`, `include_cancelled`. `group_by`: `status` (padrão), `instructor`, `vehicle`, `category`, `partner`, `day`. Devolve `totals` e `groups` com duração agendada, real (aulas realizadas) e com registro oficial confirmado. |
| `GET` | `/reports/lessons/detail` | Mesmos filtros, paginado (`per_page`/`page`), com `totals` idênticos aos do resumo. |
| `GET` | `/reports/lessons/export` | CSV completo dos mesmos filtros (UTF-8 com BOM, separador `;`, datas `dd/mm/aaaa hh:mm`). Gera um evento `report.exported` na auditoria. |
| `GET` | `/reports/exams`, `/exams/detail`, `/exams/export` | Por categoria e tentativa: agendados, aprovados, reprovados, ausentes, não concluídos, cancelados e sem resultado. `approval_rate` traz `numerator`, `denominator` e `percent`; denominador = aprovados + reprovados (ausência não é reprovação). |
| `GET` | `/reports/utilization` | Instrutores e veículos ativos: horas disponíveis, bloqueadas e utilizadas, com a base de cálculo no campo `basis`. Período máximo de 93 dias. |
| `GET` | `/reports/processes` | Processos por situação e emissão, sem movimentação há `stalled_days` (padrão 15), documentos vencidos/a vencer e taxas externas por situação (cada guia conta uma vez). |
| `GET` | `/reports/partners` | Operação por CFC parceiro: alunos (distintos), aulas, minutos realizados e exames. Sem receita/repasse. |
| `GET` | `/reports/my-summary` | O instrutor vê só as próprias aulas no período (contagens e minutos; sem alunos, preço ou saúde). |
| `GET` | `/students/{student}/summary` | Resumo do aluno (equipe): minutos por matrícula (contratado, reservado, realizado, consumido, disponível), faltas, cancelamentos, evolução, exames e processo/emissão. |

**Definições:** duração agendada = fim − início; duração real = minutos informados (ou a agendada) das aulas **realizadas**; AB conta cada aula uma vez, na categoria da aula (`lessons.category`, ou a da matrícula); cancelamentos aparecem como situação própria (`include_cancelled=0` os exclui); alunos de parceiro são contados uma vez por parceiro.

## Financeiro básico (módulo 8)

Rotas sob `/api/v1/organizations/{organization}`. **Tudo em centavos (inteiros).** Permissões: ver, lançar, editar parcelas abertas e dar baixa = proprietário, gestor e equipe; contas, categorias, formas de pagamento, recorrências, estornos, cancelamentos, transferências, ajustes e conciliação = proprietário e gestor; o instrutor nunca acessa o caixa. Categorias e formas de pagamento comuns são criadas na primeira consulta.

**Modelo.** *Lançamento* (`finance_entries`: a receber ou a pagar) → *parcelas* (`finance_installments`, soma sempre igual ao total) → *pagamentos* (`finance_payments`, uma parcela pode ter vários: forma/conta/data diferentes). O dinheiro vive no livro-razão `finance_movements`, só com inserções: estorno gera o movimento oposto e mantém o original. Saldo da conta = saldo inicial + entradas − saídas. Parcela tem uma situação derivada: `forecast` (prevista), `overdue` (vencida), `partial` (parcialmente paga), `paid` (paga) e `cancelled`.

| Método | Rota | Quem | Descrição |
|---|---|---|---|
| `GET` | `/finance/overview` | Equipe | Painel: a receber/a pagar, vencidos, próximos 30 dias, realizado no período (`from`/`to`), saldos por conta e consolidado, liquidações aguardando. |
| `GET` | `/finance/cash-flow`, `/finance/breakdown?by=`, `/finance/statement`, `/finance/movements` | Equipe | Fluxo previsto × realizado (`by=day\|month`), quebra por `category`, `student`, `partner`, `method` ou `account`, extrato consolidado e movimentações paginadas. |
| `GET` | `/finance/installments` | Equipe | Lista de parcelas com `totals` (por situação). Filtros: `type`, `situation` (vários, separados por vírgula), `from`/`to` + `date_field` (`due`\|`paid`), `student_id`, `partner_id`, `party_id`, `category_id`, `method_id`, `account_id`, `enrollment_id`, `q`. |
| `POST` | `/finance/entries/preview`, `/finance/entries` | Equipe | Prévia das parcelas e criação. `plan` (`count`, `first_due`, `periodicity` `monthly`\|`biweekly`\|`weekly`) ou `installments` revisadas (a soma precisa fechar o total); `paid` quita tudo no ato (lançamento avulso já pago). Receita exige `student_id` ou `partner_id` (o parceiro como pagador é uma escolha do lançamento). |
| `GET`/`PATCH` | `/finance/entries/{id}` | Equipe | Detalhe com parcelas e pagamentos; correção de descrição, categoria, pessoa e observação. |
| `POST` | `/finance/entries/{id}/cancel`, `/finance/installments/{id}/cancel` | Gestor | `reason`. Recusa se houver pagamentos: estorne antes. |
| `PATCH` | `/finance/installments/{id}` | Equipe | Vencimento/valor só de parcela sem pagamentos (`installment_has_payments`). |
| `POST` | `/finance/installments/{id}/payments` | Equipe | `payments[]` (várias linhas = pagamento dividido). Cada linha: `account_id`, `method_id`, `paid_on` (não futura), `applied_cents`, `discount_cents`, `interest_cents`, `fine_cents`, `fee_cents` (qualquer um desses exige `adjust_reason`), `reference`, `client_ref`. `client_ref` repetido devolve a baixa já feita; a parcela é travada, então baixas simultâneas se enfileiram. Forma com `settlement_days > 0` (cartão, boleto) fica `pending` e **não** entra no caixa. |
| `POST` | `/finance/payments/{id}/confirm` | Equipe | Confirma a liquidação (`settled_on`): só então nasce o movimento. |
| `POST` | `/finance/payments/{id}/reverse` | Gestor | Estorno com `reason`; reabre a parcela. |
| `GET` | `/finance/payments/{id}/receipt` | Equipe | Comprovante interno com número (`RC-AAAA-000001`); não é documento fiscal. |
| `GET`/`POST` | `/finance/accounts`, `PATCH /finance/accounts/{id}` | Equipe lê; gestor altera | Conta/caixa com saldo inicial e data (não é receita); inativar preserva o histórico; saldo inicial só muda antes de haver movimento. |
| `GET` | `/finance/accounts/{id}/statement` | Equipe | Saldo de abertura, entradas, saídas, transferências, ajustes, estornos e saldo final, linha a linha. |
| `POST` | `/finance/accounts/{id}/adjustments`, `/reconciliations` | Gestor | Ajuste de saldo (motivo obrigatório) e conferência manual com o extrato externo (diferença registrada). |
| `GET`/`POST` | `/finance/transfers`, `POST /finance/transfers/{id}/reverse` | Gestor | Transferência entre contas do espaço: débito e crédito vinculados; estorna as duas pontas juntas. Não é receita nem despesa. |
| `*` | `/finance/categories`, `/finance/payment-methods`, `/finance/parties`, `/finance/recurrences` | Equipe lê; gestor altera (favorecidos: equipe) | Cadastros simples; recorrência mensal gera um lançamento por mês (`recurrence:ID:AAAA-MM`). |
| `GET` | `/finance/export/installments`, `/finance/export/movements` | Equipe | CSV (UTF-8 com BOM, `;`, valores em reais com vírgula) com os mesmos filtros da lista. |
| `GET` | `/finance/partners/{partner}` | Equipe | Recebíveis e repasses do parceiro. |
| `GET` | `/finance/fee-advances` | Equipe | Taxas externas adiantadas: quem adiantou, valor a acertar e baixa. |
| `GET`/`POST` | `/enrollments/{id}/finance`, `/enrollments/{id}/finance/charge` | Equipe | Cobrança da contratação (`package:ID`); `payer` = `student` ou `partner`. |
| `POST` | `/maintenances/{id}/finance/expense` | Equipe | Despesa da manutenção (`maintenance:UUID`). |
| `POST` | `/external-fees/{id}/finance/reimbursement`, `/advance` | Equipe | Cobrança de reembolso e saída do adiantamento (`fee:ID:reimbursement\|advance`); categorias de repasse, fora do faturamento. |

**Sem duplicidade.** Cobrança de contratação, despesa de manutenção e taxa têm referência única (`source_ref`); repetir a ação responde `409 entry_already_exists` com `existing_entry_id`. Aulas consumidas, edições e reenvios nunca geram título novo. Documentos privados (`/documents`) aceitam `finance_entry_id` e `finance_payment_id`.

**Realizado × previsto.** O realizado usa a data em que o dinheiro entrou ou saiu; o previsto usa o vencimento. Parcelas em aberto nunca alteram o realizado. *Faturamento* = recebimentos líquidos de estorno, fora de categorias de repasse/reembolso; transferências e saldo inicial nunca entram.

**Alertas.** `AlertEngine` recebe os alertas financeiros (parcela a vencer/em atraso e liquidação sem confirmação) pelo público `finance` (proprietário, gestor e equipe; nunca o instrutor). Antecedência: `finance_lead_days` em `/alert-settings`.
