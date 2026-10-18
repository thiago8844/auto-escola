# Rota Certa Gestão (web)

Painel web do gestor da auto escola. React + Vite + TypeScript.

A base operacional já inclui conta, espaços, equipe, alunos, matrículas, processos/checklist, documentos, instrutores, veículos, parceiros, agenda e execução de aulas. A agenda pessoal atende instrutores em vários espaços.

O planejamento até o lançamento está no **[checklist de módulos do MVP web](../../docs/modulos-checklist.md)**. Os checklists antigos de telas foram concluídos e removidos. Os módulos 1 a 8 já incluem pacotes/saldo, exames/taxas, disponibilidade/frota, alertas, relatórios e financeiro. A etapa atual é homologação. Vendas e atendimento e o aplicativo mobile ficam para depois.

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

O painel usa indicadores reais. Pendências operacionais são persistentes. O menu apresenta até cinco atalhos por perfil, agrupa os demais e permite ocultar/ordenar módulos e definir um espaço inicial. Preferências são pessoais, isoladas por conta e armazenadas neste navegador; autorização continua na API.

A matrícula permite encaminhar um aluno ao instrutor sem agendar aula. A agenda consulta horários livres a pedido e revalida a disponibilidade ao salvar. Formulários de aluno, matrícula e aula avisam antes do descarte e recuperam preenchimento após expiração da sessão na mesma aba/conta; os dados dessa recuperação ficam apenas em memória. Modais financeiros principais também avisam antes de descartar alterações.

## Verificação

```bash
pnpm test
pnpm lint
pnpm build
```

Vitest cobre preferências/perfis, cobrança do pacote exato, atualização de consultas, proteção de preenchimento, isolamento de contas, retomada de sessão, encaminhamento e escolha de horário. As páginas são carregadas por demanda. Build e testes não substituem homologação com usuários leigos, aparelhos reais e leitor de tela; veja os [requisitos](../../docs/requisitos-ux-ui.md) e o [registro de implementação](../../docs/ux-ui-implementacao.md).
