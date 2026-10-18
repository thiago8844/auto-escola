# Rota Certa Gestão (web)

Painel web do gestor da auto escola. React + Vite + TypeScript.

A base operacional já inclui conta, espaços, equipe, alunos, matrículas, processos/checklist, documentos, instrutores, veículos, parceiros, agenda e execução de aulas. A agenda pessoal atende instrutores em vários espaços.

O planejamento até o lançamento está no **[checklist de módulos do MVP web](../../docs/modulos-checklist.md)**. Os checklists antigos de telas foram concluídos e removidos. Próxima entrega: **Pacotes e saldo de aulas**; relatórios vêm antes do financeiro, que será o último módulo do MVP. Vendas e atendimento e o aplicativo mobile ficam para depois.

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

A página inicial do espaço ainda é um protótipo com contadores sem dados. O painel real faz parte do módulo de relatórios. O sino de notificações já tem interface, mas ainda não recebe alertas operacionais persistentes.

Não há script de testes automatizados do web nesta base. Build e lint não substituem a homologação por papel e os testes dos fluxos críticos previstos no checklist.
