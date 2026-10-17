# Documentação do sistema de auto escola

Sistema de gestão para CFCs (autoescolas) e instrutores autônomos. Um mesmo módulo atende os dois casos: o que muda são o tipo do espaço de trabalho e o papel de cada pessoa nele.

Esta pasta documenta **a API** (`apps/api`). Web (`apps/web`) e mobile (`apps/mobile`) ainda não foram desenvolvidos nesta etapa.

## Ordem sugerida de leitura

| # | Documento | Para quê |
|---|---|---|
| 1 | [arquitetura.md](arquitetura.md) | Entender o modelo: espaços, identidade do instrutor, vínculos, isolamento, agenda. Comece aqui. |
| 2 | [modelo-de-dados.md](modelo-de-dados.md) | Tabelas, campos, constraints e relações, com diagrama. |
| 3 | [permissoes.md](permissoes.md) | Quem pode fazer o quê, por papel. |
| 4 | [setup-api.md](setup-api.md) | Subir o MySQL, configurar, migrar, popular e rodar os testes. |
| 5 | [api.md](api.md) | Endpoints, autenticação (SPA e mobile), payloads, respostas, erros e exemplos. |
| 6 | [implementacao.md](implementacao.md) | O que foi feito, decisões, limitações e próximos passos. |
| 7 | [lacunas-mvp-api.md](lacunas-mvp-api.md) | O que falta na API para o MVP (aluno → aulas → exame → CNH) e o rascunho do futuro. |

Se você quer só **rodar o projeto**, vá direto para [setup-api.md](setup-api.md).

## Legenda de status

Cada documento indica o estado do que descreve:

- ✅ **Implementado e verificado**: há código e teste (ou verificação em HTTP real).
- 📋 **Planejado**: está na especificação ou nos próximos passos, mas **não existe** ainda.

Nada marcado como ✅ depende de funcionalidade planejada.

## Estado atual em uma tela

| Área | Status |
|---|---|
| Autenticação (SPA por sessão e mobile por token) | ✅ |
| Espaços (CFC e particular), membros e papéis | ✅ |
| Convites com token de uso único e expiração | ✅ |
| Perfil de instrutor global, com ou sem conta | ✅ |
| Vínculo profissional por espaço | ✅ |
| Parceiros, alunos, matrículas | ✅ |
| Aulas, conflito de agenda entre organizações, transições de status | ✅ |
| Agenda pessoal consolidada (`/me/lessons`) | ✅ |
| Processo de habilitação e checklist de liberação para a prática | ✅ |
| Documentos privados | ✅ |
| Veículos e aula com veículo (conflito de veículo e de aluno) | ✅ |
| Execução da aula: duração real, evolução, registro oficial | ✅ |
| Fuso horário por espaço | ✅ |
| Dados de demonstração | ✅ |
| Testes automatizados | ✅ 149 testes passando |
| Exames práticos, taxas, pacotes e saldo, financeiro | 📋 (Fases 2 a 4) |
| Frontend web e mobile | 📋 |

## Início rápido

```bash
# 1. Infraestrutura (MySQL e Mailpit)
cp infra/.env.example infra/.env   # e troque as senhas
docker-compose -f infra/docker-compose.yml --env-file infra/.env up -d

# 2. API
cd apps/api
composer install
cp .env.example .env && php artisan key:generate   # ajuste DB_PASSWORD
cp .env.testing.example .env.testing               # ajuste DB_PASSWORD e APP_KEY
php artisan migrate
php artisan db:seed --class=DemoSeeder             # dados de demonstração (dev)

# 3. Rodar e testar
php artisan serve --port=8010
php artisan test
```

Login de demonstração: `joao@autoescola.demo` / `demo-autoescola-123`. Detalhes em [setup-api.md](setup-api.md#5-dados-de-demonstração-seeder).

## Conceitos centrais em uma frase cada

- **Espaço de trabalho** (`organization`): uma autoescola (`cfc`) ou uma operação particular (`independent`).
- **Papel** (`owner`, `admin`, `staff`, `instructor`): o que uma pessoa pode fazer dentro de um espaço específico.
- **Instrutor**: uma pessoa, com identidade global. Pode ter conta ou não.
- **Vínculo de acesso**: permite entrar no espaço. **Vínculo profissional**: permite receber aulas nele. São separados.
- **Parceiro**: um CFC externo, cadastrado localmente, sem acesso ao sistema.
- **Aula**: existe uma única vez, na organização que a criou. A agenda pessoal do instrutor a mostra sem copiar.

## Convenções desta documentação

- Português claro, com exemplos concretos.
- Nomes de campos, endpoints e códigos de erro estão no formato exato da API (em inglês quando o código é em inglês).
- Exemplos de resposta foram capturados de uma execução real.
- Credenciais citadas são **somente de demonstração**.
