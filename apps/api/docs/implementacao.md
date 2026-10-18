# Implementação

Registro do que foi construído nesta etapa, das decisões tomadas, do que **não** está pronto e dos próximos passos.

> Este documento registra a construção da base da **API** (`apps/api`). A base web já foi implementada posteriormente. O escopo e a ordem atuais do MVP estão no [checklist de módulos do MVP web](../../../docs/modulos-checklist.md); mobile fica para uma etapa posterior.

## Estado

| Área | Status |
|---|---|
| Infraestrutura local (MySQL + Mailpit) | ✅ |
| Migrations, models e enums do domínio | ✅ |
| Autenticação SPA (sessão) e mobile (token) | ✅ |
| Confirmação de e-mail | ✅ (API responde JSON; o e-mail aponta para a página web de confirmação) |
| Espaços, membros e papéis | ✅ |
| Convites e aceite | ✅ |
| Identidade e vínculos de instrutor | ✅ |
| Parceiros, alunos, matrículas | ✅ |
| Aulas: agenda, conflito, remarcação, status | ✅ |
| Agenda pessoal consolidada (`/me/lessons`) | ✅ |
| Seeder de demonstração | ✅ |
| Testes automatizados | ✅ 281 testes, 1.922 asserções (18/10/2026) |
| Documentação geral em `docs/` e técnica em `apps/api/docs/` | ✅ |
| **Fase 1 do MVP** (ver [lacunas-mvp-api.md](lacunas-mvp-api.md)) | ✅ |
| Processo de habilitação e checklist de liberação para a prática | ✅ |
| Documentos privados (upload, conferência, versões, download) | ✅ |
| Veículos, aula com veículo, conflito de veículo e de aluno | ✅ |
| Execução da aula (duração real, motivo, evolução, registro oficial) | ✅ |
| Fuso horário por espaço | ✅ |
| Pacotes/saldo, exames/taxas, desfecho, disponibilidade/frota, alertas, relatórios e financeiro | ✅ Implementados (módulos 1–8); homologação pendente |
| Frontend web | ✅ Base operacional implementada em `apps/web`; complementos no checklist principal |
| Aplicativo mobile | 📋 Etapa posterior ao web |

## Fase 1 do MVP — o que entrou

Detalhes dos endpoints em [api.md](api.md); tabelas em [modelo-de-dados.md](modelo-de-dados.md).

| Item | Resumo |
|---|---|
| 1.1 Processo de habilitação | `qualification_processes`: tipo, UF, Renach/protocolo, categorias atuais e pretendidas, situação local. Matrícula aponta para ele (opcional). |
| 1.2 Checklist de liberação | Itens criados por tipo de processo. Só `verified` (com origem confiável) ou `not_applicable` (com motivo) liberam a prática. |
| 1.3 Matrícula completa | Situação comercial, `contracted_minutes`, `price_cents`, vínculo com o processo. Preço só para a equipe. |
| 1.4 Documentos privados | Disco privado, nome aleatório, tipos PDF/imagem até 10 MB, conferência, versões por substituição, download autenticado só para a equipe. |
| 1.5 Veículos | Cadastro por espaço, categoria simples, CRLV, ativo/inativo, exclusão lógica. |
| 1.6 Aula com veículo | `vehicle_id`; conflito de veículo e de **aluno**; categoria do veículo × matrícula × instrutor; CRLV válido no dia; matrícula encerrada bloqueia. |
| 1.7 Execução da aula | Duração real, motivo, evolução, registro oficial (manual, com evidência). Concluir exige liberação. |
| 1.8 Fuso por espaço | `organizations.timezone`; `from`/`to` são dias locais convertidos para UTC. |

### Decisões da Fase 1

| # | Decisão | Motivo |
|---|---|---|
| 24 | **Agendar não exige liberação; concluir exige** | O fluxo prevê pré-reserva, mas não registrar instrução sem pré-requisitos conferidos. Falta e cancelamento não exigem. |
| 25 | **Só `verified` e `not_applicable` liberam; `done` não** | "O aluno disse que fez" não basta. `verified` exige origem diferente de declaração do aluno. |
| 26 | **`required` do checklist não é editável** | A equipe pode acrescentar exigências, nunca ocultá-las. Dispensar = `not_applicable` com motivo. |
| 27 | **Matrícula sem processo não é bloqueada** | Evita travar quem não usa o processo (e matrículas anteriores à Fase 1). |
| 28 | **Modelos de checklist são padrões do produto** | Pontos sem confirmação oficial (V03, V11) ficam opcionais em `unknown`. Ajustar em `ChecklistTemplate` quando confirmados. |
| 29 | **Toxicológico de primeira habilitação não bloqueia o início** | Em MG é exigido após a aprovação prática; segue como opcional. Em mudança de categoria é obrigatório. |
| 30 | **Veículo tem categoria simples; matrícula AB aceita A ou B** | AB é um processo com dois percursos; cada aula acontece em um veículo de uma categoria. |
| 31 | **Instrutor sem categorias cadastradas não é bloqueado** | O cadastro do perfil pode estar incompleto (`categories` pode ser `[]`). |
| 32 | **Ordem de locks: instrutor → veículo → aluno** | Mesma estratégia de concorrência de antes, sem deadlock entre agendamentos. |
| 33 | **Conflito de veículo e aluno revela o conflito** | São sempre do próprio espaço; só o conflito de instrutor atravessa organizações e esconde a origem. |
| 34 | **Duração contratada em minutos** | Evita presumir "hora" ou "hora-aula" (V09). |
| 35 | **Processo e documentos só para a equipe** | Podem conter resultado de saúde. O instrutor vê apenas `practice_release` (tipos pendentes). |
| 36 | **Arquivos em disco privado com nome aleatório** | Nunca em URL pública; download passa por autenticação, papel e escopo do espaço. |
| 37 | **Fuso padrão `America/Sao_Paulo`** | Cobre a maior parte dos casos; configurável por espaço e por `AUTOESCOLA_TIMEZONE`. |
| 38 | **`ACC` entrou em `LicenseCategory`** | Faz parte do fluxo (seção 9). Não é tratada como `A` nem como `C`. |

### Limitações da Fase 1

- **Sem exame prático, taxas, pacotes/saldo e financeiro.** `contracted_minutes` e `price_cents` são só registro; nenhum saldo é calculado. A ordem de entrega está no checklist principal.
- **Sem alerta** de CRLV a vencer nem de documento vencido; só o bloqueio no agendamento.
- **Aulas já agendadas não são reavaliadas** se o veículo ficar inativo ou o CRLV vencer depois. O bloqueio vale ao agendar e ao remarcar.
- **Sem exclusão de documento.** Para corrigir, rejeite (`rejected`) ou substitua por nova versão.
- **Download de arquivo ausente no disco** (ex.: apagado manualmente) não tem tratamento amigável.
- **Elegibilidade oficial não é calculada** (idade, tempo de CNH, prontuário); o sistema só guarda o que foi conferido.
- **Processo e matrícula**: trocar `qualification_process_id` de uma matrícula que já tem aulas é permitido; o efeito é reavaliar a liberação na próxima conclusão.
- **Teste de concorrência real** para veículo e aluno ainda não existe (como já ocorria para instrutor).
- **Antes de usar** em um banco existente: `php artisan migrate` (7 migrations novas, aditivas).

## Verificação realizada

### Testes

```bash
php artisan test
```

Execução em **17/10/2026**: **152 testes, 584 asserções, todos aprovados**, contra o MySQL `autoescola_test`, com código de saída 0.

Os testes cobrem os cenários exigidos na especificação:

| Cenário exigido | Onde está |
|---|---|
| Isolamento entre organizações | `OrganizationAccessTest` |
| Mesmo instrutor em dois CFCs e espaço particular | `SharedInstructorAgendaTest` |
| Agenda pessoal consolidada sem duplicar aulas | `SharedInstructorAgendaTest` |
| CFC vê apenas seus registros | `OrganizationAccessTest` |
| Instrutor sem acesso a alunos não atribuídos | `InstructorPrivacyTest` |
| IDs de outro espaço rejeitados | `OrganizationAccessTest` |
| Convite expirado, reutilizado, aceito por destinatário incorreto | `InvitationTest` |
| Proteção do último proprietário | `MembershipRulesTest` |
| Revogação retira registros da visão pessoal | `SharedInstructorAgendaTest` |
| Conflitos de agenda e transições inválidas | `LessonSchedulingTest` |
| Seeder de demonstração | `DemoSeederTest` |
| Veículos (CRUD, placa por espaço, permissões, isolamento) | `VehicleTest` |
| Processo, checklist e liberação para a prática | `QualificationProcessTest` |
| Conclusão de aula condicionada à liberação; duração real, evolução, registro oficial | `LessonExecutionTest` |
| Conflito de veículo e de aluno, categorias, CRLV, matrícula encerrada | `LessonConstraintsTest` |
| Documentos privados, versões, download e permissões | `DocumentTest` |
| Fuso horário do espaço | `OrganizationTimezoneTest` |

### Verificação histórica em HTTP real (fora da suíte)

Na construção da base, estes fluxos foram verificados contra um `php artisan serve` real, com dados de demonstração. A análise atual do MVP repetiu a suíte automatizada, sem repetir esta homologação HTTP:

- **Login mobile:** `POST /auth/token` emite token; `GET /me/lessons` com `Bearer` retorna 3 aulas, uma em cada espaço, sem CPF do aluno.
- **Login SPA:** preflight CORS com credenciais; `GET /sanctum/csrf-cookie`; login sem `X-XSRF-TOKEN` retorna **419**; com o header, **200**; `GET /auth/user` reconhece a sessão; logout retorna **204** e depois a sessão é recusada com **401**.
- **Convite com e-mail:** convite criado via API retorna **sem token**; o e-mail chegou ao Mailpit com o assunto e destinatário corretos.
- **Isolamento via HTTP:** organização de outro usuário retorna **404**; tentativa de agendar aula com matrícula de outro espaço retorna **422**.
- **Erro de permissão:** instrutor listando colegas recebe **403** em JSON com mensagem em português (um bug aqui foi encontrado e corrigido nesta verificação; ver "Problemas encontrados").

## O que foi feito

### Infraestrutura
- `infra/docker-compose.yml`: MySQL 8.4 em `127.0.0.1:3322` e Mailpit (SMTP `1025`, web `8025`).
- Script de inicialização que cria `autoescola_test`.
- Senhas em `infra/.env` (ignorado pelo git). Nenhuma credencial real está versionada.

### Domínio
- 9 migrations (`instructors`, `organizations`, `organization_user`, `organization_instructor`, `partners`, `students`, `enrollments`, `lessons`, `invitations`).
- Enums: `MembershipRole`, `OrganizationType`, `LicenseCategory`, `LessonStatus` (com transições).
- Models com relações usadas no route binding (`scopeBindings`).
- Factories para todos os modelos.

### Regras de negócio (Actions e Services)
- `CreateOrganization`: cria o espaço e o owner em transação; espaço particular também cria/vincula o perfil.
- `CreateInstructorProfile`, `LinkInstructorToOrganization`.
- `ChangeMemberRole`, `RevokeMembership`: com regras de admin e último proprietário.
- `CreateInvitation`, `AcceptInvitation`.
- `ScheduleLesson`, `RescheduleLesson`, `ChangeLessonStatus`.
- `InstructorAvailability` (lock e conflito entre organizações), `AssignmentScope` (visão do instrutor).

### API
- 46 rotas em `/api/v1` (lista completa em [api.md](api.md#resumo-de-endpoints)).
- Form Requests com `Rule::exists(...)->where('organization_id', ...)`.
- API Resources com filtro de campos sensíveis.
- Policies por recurso, com o espaço sempre como argumento.
- Middleware `organization.member` (404 sem acesso).
- Erros de regra de negócio com código estável em `error`.

### Configuração
- `config/sanctum.php`: expiração de token por variável de ambiente.
- `config/cors.php`: origens da SPA com credenciais.
- `config/autoescola.php`: URL do frontend e validade de convite.
- `bootstrap/app.php`: `statefulApi()`, alias do middleware, respostas JSON em português para 401/403/404.
- `phpunit.xml`: MySQL e banco `autoescola_test`.
- `.env.example` e `.env.testing.example` atualizados, sem credenciais.

## Decisões tomadas

Cada decisão tem motivo. Se algo não fizer sentido para você, é o ponto para revisar.

| # | Decisão | Motivo |
|---|---|---|
| 1 | **FKs compostas** `(organization_id, X_id)` em matrículas, aulas e convites | Garante no banco que os relacionamentos ficam no mesmo espaço, mesmo se o código da aplicação falhar. |
| 2 | **Lock pessimista no instrutor** (`SELECT ... FOR UPDATE`) antes de checar conflito | Serializa agendamentos concorrentes do mesmo instrutor. Escolhido em vez de restrição de exclusão (que o MySQL não oferece para intervalos). |
| 3 | **404 para quem não tem acesso ao espaço**, 403 só dentro do espaço | Não revela a existência de outros espaços. |
| 4 | **Escopo de instrutor por aula**: aluno e matrícula são visíveis se houver aula dele (qualquer status) | Simples de entender e de testar. Aula cancelada ainda vincula o aluno ao instrutor. |
| 5 | **Token de convite com hash SHA-256**, enviado só por e-mail, não enfileirado | Token nunca aparece em resposta, listagem ou tabela de jobs. |
| 6 | **Aceite de convite só recebe o token** | Identidade (nome, CPF, e-mail) não pode ser enviada para associar conta. |
| 7 | **Perfil indicado no convite precisa estar vinculado ao espaço e sem conta** | Evita que um convite sirva para tomar um perfil de outra pessoa. |
| 8 | **Conflito de perfil no aceite retorna 409** explícito | Não há merge silencioso. |
| 9 | **E-mail verificado só é exigido para aceitar convite** | Cadastro não fica travado; a confirmação protege o que realmente dá acesso. |
| 10 | **Exclusão lógica** para parceiros e alunos; **revogação** para membros, convites e vínculos de instrutor | Preserva histórico de aulas e matrículas. Matrícula, aula e instrutor não têm exclusão na API. |
| 11 | **Membro revogado = linha apagada** em `organization_user` | Nenhum registro operacional depende do vínculo de acesso. |
| 12 | **Um espaço particular por usuário** | Espelha "o próprio espaço particular" no singular. |
| 13 | **Criar espaço particular cria o perfil de instrutor, se faltar, e vincula** | Cumpre o fluxo 2–4 da especificação em uma operação. |
| 14 | **Agenda pessoal independe do vínculo profissional ativo** | Desativar impede novas aulas, mas não apaga o que já foi agendado. |
| 15 | **Sem `global scope`** | Isolamento explícito e testável, sem esconder falhas de autorização. |
| 16 | **Actions só onde há regra** (criação, papéis, convites, agenda). Listagens simples ficam no controller | Evita camada desnecessária. |
| 17 | **Sem repository** | O Eloquent já é a camada de acesso. |
| 18 | **Duração máxima de aula: 240 minutos** | Limite de sanidade, não vem da especificação. Fácil de ajustar. |
| 19 | **Status de aula: `scheduled`, `completed`, `missed`, `cancelled`** | Nomes em inglês no código, correspondendo ao português da especificação (agendada, realizada, falta, cancelada). |
| 20 | **Instrutor agenda, remarca, cancela e conclui as próprias aulas**; trocar o veículo também; passar a aula a outro instrutor e o registro oficial ficam com a equipe | Na prática, quem presta a aula também controla a própria agenda; a equipe continua podendo operar tudo. |
| 21 | **Mailpit como transporte de e-mail em desenvolvimento** | Atende "sem enviar e-mails reais" e não grava tokens em log (o `log` do Laravel gravaria o link com o token). |
| 22 | **Porta 3322 para o MySQL** | Outros MySQL desta máquina usam 3306, 3307, 3309, 3310, 3312 e 3318. |
| 23 | **Sem Laravel Boost** | O `CLAUDE.md` do projeto pede a instalação, mas a tarefa pediu não atualizar dependências desnecessariamente. Pode ser instalado depois, se você quiser. |

## Problemas encontrados e corrigidos

Estes foram achados pela execução, não só pela leitura:

| Problema | Como apareceu | Correção |
|---|---|---|
| `User` sem `HasApiTokens` | Erro em todos os testes com token e no próprio fluxo mobile. | Trait adicionado. |
| `status` fora de `$fillable` de `Lesson` | `create()` descartava o status silenciosamente. | Adicionado; o teste de aula cancelada passou a valer. |
| `studentsFor` retornava relação, não Builder | `TypeError` em listagem do instrutor. | Uso de `getQuery()`. |
| `wherePivot` dentro de `when()` | SQL com coluna `pivot` inexistente. | Filtro aplicado na relação. |
| Categorias vazias rejeitadas | `required` não aceita array vazio. | Categorias opcionais (`sometimes`). |
| **Instrutor podia ver aulas de colegas** via `?instructor_id=` na listagem do espaço | Revisão do código. | Filtro ignorado para quem não é da equipe. Teste criado. |
| **Campos sensíveis de aluno apareceriam em `/me/lessons`** se o papel fosse ausente | Revisão do código. | Padrão restritivo: só `owner`, `admin` e `staff` veem CPF, e-mail e nascimento. |
| Resposta de erro 403 em inglês com trace | Verificação HTTP real. | Handler para `AccessDeniedHttpException` e `AuthenticationException`. |
| **Arquivo de teste zerado acidentalmente** (`OrganizationAccessTest.php`) | Um comando de edição truncou o arquivo antes de ler. | Arquivo recriado; a suíte passou de 71 para 86 testes. |
| `sessions` duplicada | A migration padrão de `users` já cria essa tabela. | Migration própria removida. |

## Limitações

Estas coisas **não estão resolvidas**. Não considere que estão prontas.

### Funcionais
- ~~Datas em UTC~~ ✅ Resolvido na Fase 1: `from`/`to` usam o fuso do espaço.
- **Desativar vínculo do instrutor não cancela aulas futuras.** As aulas continuam agendadas com ele. Pode ser o comportamento desejado ou não; hoje é o comportamento.
- **Conflito de horário considera só aulas `scheduled`.** Aula `completed` ou `missed` não bloqueia o horário.
- **Agenda pessoal inclui aulas de vínculo profissional desativado**, desde que o acesso ao espaço exista (decisão 14).
- ~~Conflito de horário do aluno~~ ✅ Resolvido na Fase 1.
- **Não há restauração** de alunos e parceiros excluídos logicamente. O CPF de um aluno excluído continua reservado no espaço.
- **Não há histórico de auditoria** (quem alterou o quê).
- **Sem fluxo de redefinição de senha.**
- **Sem refresh token** para o mobile. Quando expira, emite-se outro.

### Técnicas
- **Concorrência não tem teste automatizado de concorrência real.** A solução (lock por instrutor) está implementada e documentada, e os testes cobrem a regra em sequência. Falta um teste com requisições paralelas de verdade.
- **Mensagens de validação do Laravel estão em inglês.** Apenas mensagens de regra de negócio estão em português. Para traduzir: publicar `lang/pt_BR` e definir `APP_LOCALE=pt_BR`.
- **Link de confirmação de e-mail:** a resposta da API é JSON, mas a página web e o direcionamento do e-mail para ela já foram implementados.
- **`DatabaseSeeder` padrão** ainda cria `test@example.com`. Não foi alterado.
- **Sem limite de taxa** para `GET`s autenticados, só para login, cadastro, token, reenvio e aceite.
- **Produção:** o Mailpit é só para desenvolvimento. Não há configuração de SMTP real para produção.
- **Porta 8000** está ocupada nesta máquina; o script `dev:api` do `package.json` raiz a usa. Documentado em [setup-api.md](setup-api.md#6-rodar-a-api).

### Repositório
- A base da API e do web está versionada; consultar o histórico do git para as entregas.
- Os arquivos `apps/api/.env`, `.env.testing` e `infra/.env` são locais e ignorados pelo git.

## Próximos passos

A fonte principal de TODOs e prioridades é o **[checklist de módulos do MVP web](../../../docs/modulos-checklist.md)**. O [mapa de lacunas da API](lacunas-mvp-api.md) relaciona as entregas de backend à mesma sequência.

Os módulos 1 a 8 estão implementados. A etapa atual é homologar os fluxos por perfil, concorrência e preparação de produção. Vendas e atendimento e o aplicativo mobile permanecem posteriores ao MVP.

Concorrência real, homologação e preparação de produção permanecem pendentes. Recuperação de senha, respostas de validação em português, impacto de desativação e auditoria já têm implementação e testes. A página de confirmação de e-mail e a base web já existem.


## UX/UI operacional — 18/10/2026

- Painel retorna total de exames separado da amostra e total de matrículas em atendimento separado de alunos distintos.
- Parcelas informam `awaiting_settlement_cents`; recibos informam direção e lançamento de origem.
- Encaminhamento explícito por matrícula: responsável atual em `enrollments.assigned_instructor_id`, data em `assigned_at` e histórico em `audit_events`. Migração `2026_10_18_120000_add_assignment_to_enrollments` é necessária.
- A secretaria encaminha sem agendar aula ou movimentar saldo. O instrutor recebe somente a visão operacional já filtrada pelos resources; documentos e financeiro continuam restritos. Retirar o encaminhamento revoga a visão quando não há histórico de aula.
- Consulta de horários livres reutiliza guards de agenda, veículo, aluno, expediente e saldo; usa UTC nas consultas, mantém locks na ordem existente e não grava reservas. Sugere até cinco horários no dia; salvar continua sendo a confirmação definitiva.
- Primeiros passos incluem a conta/caixa e distinguem orientação da gerência e da secretaria.

TODO: homologar concorrência com processos reais e medir latência da busca de horários com volume de produção. A suite automatizada não comprova essas condições.
