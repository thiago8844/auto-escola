# Preparação da API

Este guia leva do zero até a API rodando, com banco, dados de demonstração e testes.
Tudo aqui foi executado nesta máquina antes de ser escrito.

> Status: ✅ implementado e verificado.

## 1. Pré-requisitos

| Ferramenta | Versão usada | Observação |
|---|---|---|
| PHP | 8.4.1 | `composer.json` exige `^8.3`. Extensões: `pdo_mysql`, `mbstring`, `intl`. |
| Composer | 2.x | |
| Docker | 29.x | Para o MySQL e o Mailpit de desenvolvimento. |
| docker-compose | v2.35 | Nesta máquina só existe o binário `docker-compose`, não o plugin `docker compose`. Os comandos abaixo funcionam com os dois. |

## 2. Infraestrutura local (MySQL e Mailpit)

A infraestrutura fica em `infra/`, isolada de qualquer outro projeto:

- `infra/docker-compose.yml`: define os serviços `autoescola-mysql` e `autoescola-mailpit`.
- `infra/mysql-init/01-test-database.sql`: cria o banco `autoescola_test` na primeira inicialização.
- `infra/.env.example`: modelo das senhas. O arquivo `infra/.env` real é ignorado pelo git.

### Portas

O MySQL é publicado somente em `127.0.0.1:3322`. Esta máquina já tem outros MySQL publicados em `3306`, `3307`, `3309`, `3310`, `3312` e `3318`, então `3322` foi escolhida para não conflitar.

| Serviço | Endereço no host | Para quê |
|---|---|---|
| MySQL 8.4 | `127.0.0.1:3322` | Banco de desenvolvimento (`autoescola`) e de testes (`autoescola_test`). |
| Mailpit SMTP | `127.0.0.1:1025` | Recebe os e-mails da API. |
| Mailpit web | `http://127.0.0.1:8025` | Interface para ver os e-mails enviados. |

Nenhum e-mail sai da máquina: o Mailpit é um servidor SMTP local que apenas guarda as mensagens.

### Subir a infraestrutura

```bash
cd "apps/auto escola"
cp infra/.env.example infra/.env
# Edite infra/.env e troque as duas senhas (ou gere com: openssl rand -hex 24)

docker-compose -f infra/docker-compose.yml --env-file infra/.env up -d
# Com o plugin do Docker Compose v2, o equivalente é:
# docker compose -f infra/docker-compose.yml --env-file infra/.env up -d
```

Confira se o MySQL ficou saudável:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep autoescola
# autoescola-mysql    Up ... (healthy)   127.0.0.1:3322->3306/tcp
# autoescola-mailpit  Up ...             127.0.0.1:1025->1025/tcp, 127.0.0.1:8025->8025/tcp
```

Os dados do MySQL ficam no volume Docker `autoescola_autoescola-mysql-data`. Para desligar sem perder dados, use `docker-compose -f infra/docker-compose.yml down` (sem `-v`).

> **Não use `down -v` sem necessidade:** a flag apaga o volume e todos os dados de desenvolvimento.

## 3. Configurar a API

```bash
cd "apps/auto escola/apps/api"
composer install
```

### Arquivo `.env` (desenvolvimento)

O `.env.example` já está com as configurações de MySQL e Mailpit. Crie o `.env` e gere a chave:

```bash
cp .env.example .env
php artisan key:generate
```

Ajuste as variáveis de banco com a senha de `infra/.env`:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3322
DB_DATABASE=autoescola
DB_USERNAME=autoescola
DB_PASSWORD=<valor de AUTOESCOLA_DB_PASSWORD em infra/.env>

MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1
MAIL_PORT=1025
```

Variáveis específicas da aplicação:

| Variável | Padrão | Descrição |
|---|---|---|
| `SANCTUM_STATEFUL_DOMAINS` | `localhost:5173,127.0.0.1:5173` | Hosts (com porta) da SPA que recebem cookie de sessão. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Origens completas autorizadas a chamar a API com cookie. |
| `SANCTUM_TOKEN_EXPIRATION_MINUTES` | `43200` (30 dias) | Validade dos tokens do app mobile. |
| `FRONTEND_URL` | `http://localhost:5173` | Base dos links enviados por e-mail (convite). |
| `INVITATION_TTL_DAYS` | `7` | Validade dos convites. |

### Banco de testes (`.env.testing`)

Os testes usam **somente** o banco `autoescola_test`. Crie o arquivo a partir do modelo:

```bash
cp .env.testing.example .env.testing
# Preencha DB_PASSWORD e APP_KEY (copie a APP_KEY do seu .env)
```

`.env.testing` é ignorado pelo git. A suíte também aborta se `DB_DATABASE` não terminar em `_test`, então não há como os testes apagarem o banco de desenvolvimento por engano.

## 4. Migrations

```bash
php artisan migrate
```

O comando cria as tabelas do domínio (`instructors`, `organizations`, `organization_user`, `organization_instructor`, `partners`, `students`, `enrollments`, `lessons`, `invitations`) além das tabelas padrão do Laravel (`users`, `sessions`, `personal_access_tokens`, `cache`, `jobs`).

Para ver o estado:

```bash
php artisan migrate:status
```

> Em desenvolvimento, não use `php artisan migrate:fresh` sem saber o que ele apaga: ele derruba todas as tabelas do banco configurado.

## 5. Dados de demonstração (seeder)

```bash
php artisan db:seed --class=DemoSeeder
```

Cria:

- **CFC Alfa** (dona: `maria@cfc-alfa.demo`)
- **CFC Beta** (dono: `carlos@cfc-beta.demo`)
- **João — Particular** (espaço particular de `joao@autoescola.demo`)
- **João** como instrutor nos três espaços, com uma aula em cada um.

Senha de todas as contas: **`demo-autoescola-123`**. São credenciais **somente para desenvolvimento e teste**.

Regras do seeder:

- Não é chamado por `DatabaseSeeder`, então não roda junto com `php artisan migrate --seed` por acidente.
- Recusa rodar quando `APP_ENV=production`.
- É idempotente: rodar duas vezes não duplica organizações, aulas ou alunos.

> `DatabaseSeeder` (padrão do Laravel) ainda cria `test@example.com`. Isso não foi alterado.

## 6. Rodar a API

```bash
php artisan serve --port=8010
```

A API fica em `http://127.0.0.1:8010/api/v1`.

> **Porta:** o script `dev:api` do `package.json` raiz usa a porta padrão `8000`. Nesta máquina ela já está ocupada pelo container `gestao_empresarial`. Use `--port=8010` ou ajuste o script se a sua máquina estiver livre.

Teste rápido:

```bash
curl -s -X POST http://127.0.0.1:8010/api/v1/auth/token \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"email":"joao@autoescola.demo","password":"demo-autoescola-123","device_name":"teste"}'
```

## 7. Testes

```bash
php artisan test
# ou, com saída detalhada por teste:
vendor/bin/phpunit --testdox
```

Resultado da última execução: **85 testes, 280 asserções, todos aprovados**, contra o MySQL `autoescola_test`.

Os testes usam `RefreshDatabase`: a cada execução o banco de teste é recriado. Por isso o nome `_test` é obrigatório.

## 8. Como testar fluxos que dependem de e-mail

Convites e confirmação de e-mail geram mensagens. Em desenvolvimento elas vão para o Mailpit:

1. Abra `http://127.0.0.1:8025`.
2. Crie o convite pela API (ex.: como `maria@cfc-alfa.demo`, `POST /organizations/{id}/invitations`).
3. No Mailpit, abra o e-mail e copie o `token=` do link.
4. Aceite com a conta do destinatário: `POST /api/v1/invitations/accept` com `{"token": "..."}`.

O token **não aparece** na resposta da API nem é gravado em log. Ele existe somente no e-mail.

## 9. Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `SQLSTATE[HY000] [2002] Connection refused` na porta 3322 | Container MySQL parado. | `docker-compose -f infra/docker-compose.yml --env-file infra/.env up -d` |
| `Access denied for user 'autoescola'` | Senha no `.env` diferente de `infra/.env`. | Alinhe `DB_PASSWORD`. Se trocou a senha depois do primeiro `up`, o volume mantém a antiga. |
| `Testes recusados: DB_DATABASE=... não termina em '_test'` | Rodando com `.env` de desenvolvimento. | Confira `.env.testing` e `DB_DATABASE=autoescola_test` em `phpunit.xml`. |
| `Address already in use` ao subir a API | Porta 8000 ocupada. | Use `php artisan serve --port=8010`. |
| Convite não chega ao Mailpit | `MAIL_MAILER` diferente de `smtp` ou container parado. | Confira `MAIL_PORT=1025` e `docker ps`. |
| Login da SPA retorna 419 ou não cria sessão | Falta o CSRF cookie ou a origem não está em `SANCTUM_STATEFUL_DOMAINS`/`CORS_ALLOWED_ORIGINS`. | Veja [api.md](api.md#autenticação). |
