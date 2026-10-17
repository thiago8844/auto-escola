# Rota Certa Gestão (web)

Painel web do gestor da auto escola. React + Vite + TypeScript.

## Configuração

```bash
cp .env.example .env
```

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | URL base da API Laravel. |
| `VITE_APP_NAME` | `Rota Certa Gestão` | Nome exibido no app. |

Na máquina de desenvolvimento onde a porta 8000 está ocupada, suba a API na 8010 (`php artisan serve --port=8010`) e ajuste `VITE_API_URL=http://localhost:8010`.

## Rodar

```bash
pnpm install
pnpm dev     # http://localhost:5173
pnpm build
pnpm lint
```

A tela inicial mostra a URL configurada e o status de conexão com a API (`GET /up`).
