# Checklist de telas do web (Rota Certa Gestão)

Lista das telas do `apps/web`, divididas por módulo e ordenadas por importância. A ordem segue a dependência: sem autenticação e sem espaço não há o que testar nos módulos seguintes.

> Status: ✅ V1 implementada (módulos 1 a 11) em `apps/web`. Falta a verificação manual no navegador, por papel de usuário: marque `[x]` item a item conforme for conferindo.
> Cada módulo termina com uma verificação de regra de acesso, porque o papel do usuário muda o que a tela pode fazer (ver [permissoes.md](permissoes.md)).

## Ordem de importância

| # | Módulo | Por que nessa posição | Endpoints base |
|---|---|---|---|
| 1 | Base e autenticação | Nada funciona sem login e sessão | `/auth/*` |
| 2 | Espaço, membros e convites | Define em que espaço o gestor trabalha e quem entra nele | `/organizations`, `/invitations/*`, `/members` |
| 3 | Alunos | Cadastro central do fluxo MVP (aluno → aulas → CNH) | `/students` |
| 4 | Matrículas e processo de habilitação | Liga o aluno ao contrato e ao processo que libera a prática | `/enrollments`, `/qualification-processes` |
| 5 | Aulas e agenda do espaço | Coração da operação; depende de alunos, instrutores e veículos | `/lessons` |
| 6 | Instrutores | Quem recebe as aulas; pré-requisito da agenda | `/organizations/{id}/instructors` |
| 7 | Veículos | Pré-requisito de aula com veículo | `/vehicles` |
| 8 | Minha agenda (instrutor) | Visão pessoal do instrutor logado | `/me/lessons`, `/me/instructor` |
| 9 | Documentos privados | Anexos do aluno, depende do cadastro de alunos | `/documents` |
| 10 | Parceiros | CFCs externos, uso pontual | `/partners` |
| 11 | Configurações do espaço | Fuso horário e dados do CFC; pode ser feito por último | `/organizations/{id}` |

Fora do escopo desta lista (📋 Fases 2 a 4 da API): exames práticos, taxas, pacotes, saldo e financeiro.

---

## 1. Base e autenticação

- [ ] Configuração base: lê `VITE_API_URL` e mostra erro claro se a API estiver offline
- [ ] Tela de login (e-mail e senha)
- [ ] Erro de login exibido sem vazar detalhes (credencial inválida, muitas tentativas)
- [ ] Cadastro de conta (`POST /auth/register`)
- [ ] Tela "verifique seu e-mail" após o cadastro, com reenvio (`POST /auth/email/verification-notification`)
- [ ] Rota `/auth/email/verify/{id}/{hash}` confirma o e-mail e volta ao login
- [ ] Logout limpa a sessão (`POST /auth/logout`)
- [ ] Sessão expirada (401) redireciona para o login
- [ ] Rotas protegidas bloqueiam acesso sem login
- [ ] Tratamento global de erros da API (422 mostra campos, 403 mostra mensagem, 5xx mostra aviso genérico)

**Verificar:** a SPA usa cookie de sessão do Sanctum. Nenhum token deve ir para `localStorage`.

## 2. Espaço, membros e convites

- [ ] Lista de espaços do usuário (`GET /organizations`)
- [ ] Seleção do espaço ativo, com o espaço presente em todas as URLs
- [ ] Criar espaço: CFC ou particular (`POST /organizations`), com a regra de um espaço particular por pessoa
- [ ] Editar dados do espaço (`PATCH /organizations/{id}`)
- [ ] Lista de membros com papel (`GET .../members`)
- [ ] Alterar papel de um membro (`PATCH .../members/{member}`)
- [ ] Remover membro (`DELETE .../members/{member}`)
- [ ] Criar convite por e-mail com papel (`POST .../invitations`)
- [ ] Lista de convites pendentes e expirados (`GET .../invitations`)
- [ ] Cancelar convite (`DELETE .../invitations/{invitation}`)
- [ ] Tela de aceite do convite, lendo o token da URL (`POST /invitations/accept`)

**Verificar:** papel `staff` não vê nem altera membros de `owner`/`admin`. Ver [permissoes.md](permissoes.md).

## 3. Alunos

- [ ] Listagem com paginação, busca e filtros (ver [api.md](api.md#paginação-filtros-e-erros))
- [ ] Cadastro de aluno com validação de campos obrigatórios
- [ ] Detalhe do aluno com histórico de matrículas, aulas e documentos
- [ ] Edição de dados do aluno
- [ ] Estados vazios e erros de carregamento em cada lista

**Verificar:** aluno de um espaço não aparece em outro espaço.

## 4. Matrículas e processo de habilitação

- [ ] Criar matrícula a partir do aluno (vincula contrato e processo)
- [ ] Lista e detalhe de matrículas com status
- [ ] Processo de habilitação: etapas e status
- [ ] Checklist de liberação para a prática (exibe o que falta; ver [fluxo-habilitacao-brasil-mg.md](fluxo-habilitacao-brasil-mg.md))
- [ ] Mensagem clara quando a aula prática está bloqueada pela liberação (`403` com o motivo)

**Verificar:** a liberação exigida na aula prática também bloqueia na tela, não só na API.

## 5. Aulas e agenda do espaço

- [ ] Agenda do espaço por dia e por semana, com instrutor e veículo
- [ ] Agendar aula (`POST .../lessons`), escolhendo aluno, instrutor, veículo e horário
- [ ] Mensagem de conflito de agenda entre organizações e de veículo ou aluno ocupado
- [ ] Remarcar aula (`POST .../lessons/{lesson}/reschedule`)
- [ ] Alterar status da aula (`PATCH .../lessons/{lesson}/status`)
- [ ] Detalhe da aula com observações, evolução e duração real
- [ ] Registro oficial da aula (`PATCH .../lessons/{lesson}/registry`)
- [ ] Fuso horário do espaço aplicado a todos os horários exibidos

**Verificar:** a aula aparece uma única vez, na organização que a criou, mesmo com o instrutor em vários espaços.

## 6. Instrutores

- [ ] Lista de instrutores vinculados ao espaço (`GET .../instructors`)
- [ ] Cadastrar instrutor sem conta (`POST .../instructors`)
- [ ] Detalhe e edição de instrutor sem conta (`PATCH .../instructors/{instructor}`)
- [ ] Campos de identidade bloqueados quando o instrutor tem conta, com a mensagem `instructor_identity_locked`
- [ ] Ativar ou desativar o vínculo profissional (`PATCH .../link`)

**Verificar:** instrutor desativado some das opções de agendamento, mas as aulas antigas continuam visíveis.

## 7. Veículos

- [ ] Lista de veículos do espaço
- [ ] Cadastro e edição de veículo (`/vehicles`)

**Verificar:** conflito de veículo aparece no agendamento, com mensagem clara.

## 8. Minha agenda (instrutor)

- [ ] Agenda pessoal consolidada de todos os espaços (`GET /me/lessons`)
- [ ] Indicação do espaço de cada aula
- [ ] Ver e editar meu perfil profissional (`GET`, `PATCH /me/instructor`)
- [ ] Criar meu perfil profissional, se ainda não existir (`POST /me/instructor`)
- [ ] Campos de identidade editáveis só pelo próprio instrutor

**Verificar:** o instrutor vê apenas as próprias aulas, mesmo em espaços onde o papel dele é `owner`.

## 9. Documentos privados

- [ ] Lista de documentos do aluno (`GET .../documents`)
- [ ] Upload de PDF, JPG, PNG ou WebP até 10 MB, com erro de tamanho e tipo
- [ ] Visualização e download protegidos (`GET .../documents/{document}/download`, só quem tem permissão)

**Verificar:** documento de um espaço não pode ser acessado por URL direta em outro espaço.

## 10. Parceiros

- [ ] Lista de parceiros (CFCs externos)
- [ ] Cadastro e edição de parceiro
- [ ] Parceiro não ganha acesso ao sistema (sem tela de login)

## 11. Configurações do espaço

- [ ] Dados do espaço (nome, documento, endereço)
- [ ] Fuso horário do espaço

---

## Checks transversais (rodar em todos os módulos)

- [ ] Layout funciona em celular (16px de margem, sem scroll horizontal)
- [ ] Tema claro e escuro legíveis
- [ ] Cada lista tem estado de carregando, vazio e erro
- [ ] Formulários mostram erros de validação da API em cada campo
- [ ] Datas e horários exibidos no fuso do espaço
- [ ] Botões de ação somem ou ficam desabilitados para papéis sem permissão
