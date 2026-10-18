# Documentação — Rota Certa Gestão

Sistema de gestão para CFCs e instrutores autônomos, com **API Laravel e base web React já implementadas**. O foco atual é completar o MVP web. O aplicativo mobile terá uma etapa própria posterior.

Para decidir o próximo trabalho, comece pelo **[checklist de módulos do MVP web](modulos-checklist.md)**. Ele reúne a análise do código, a base existente, os TODOs por módulo, os critérios de aceite e de lançamento e o planejamento posterior.

## Ordem de entrega do MVP

1. **Pacotes e saldo de aulas** — próximo módulo recomendado.
2. Exames práticos e taxas externas.
3. Desfecho do processo e histórico.
4. Disponibilidade e frota.
5. Pendências e alertas reais.
6. Acesso, correções e acabamento web.
7. Relatórios e painel de gestão.
8. **Financeiro básico — último módulo do MVP**: receitas, despesas, parcelas, várias formas de pagamento, contas bancárias/caixa, transferências, relatórios e alertas.

Após relatórios e financeiro: **Vendas e atendimento**, com interessados, próximos contatos e propostas, sem exigir que o usuário conheça os termos “CRM” ou “lead”. O mobile será planejado depois da conclusão do web.

## Documentos

| Documento | Conteúdo |
|---|---|
| [Checklist de módulos](modulos-checklist.md) | Fonte principal do escopo, sequência e pendências até o lançamento web. Substitui os checklists antigos de telas web. |
| [Arquitetura](arquitetura.md) | Espaços, identidade do instrutor, vínculos, isolamento e agenda. |
| [Modelo de dados](../apps/api/docs/modelo-de-dados.md) | Tabelas, campos, constraints e relações existentes. |
| [Permissões](permissoes.md) | Acesso por papel na base atual. As novas permissões serão definidas em cada módulo. |
| [Setup da API](../apps/api/docs/setup-api.md) | MySQL, e-mail local, configuração, migrations, demonstração e testes. |
| [Referência da API](../apps/api/docs/api.md) | Endpoints, autenticação, payloads, respostas e erros implementados. |
| [Implementação da API](../apps/api/docs/implementacao.md) | Decisões da base, verificações e limitações técnicas. |
| [Lacunas da API](../apps/api/docs/lacunas-mvp-api.md) | Mapa das entregas de backend para o checklist principal, sem sequência concorrente. |
| [Setup do web](../apps/web/README.md) | Configuração, execução, lint e build. |
| [Identidade visual](identidade-visual.md) | Cores, estados, tipografia e espaçamento. |
| [Avisos e notificações](notificacoes.md) | Toasts, sino e alerta máximo existentes; integração operacional ainda pendente. |
| [Fluxo de habilitação](fluxo-habilitacao-brasil-mg.md) | Referência de domínio e cenários, incluindo serviços fora do MVP. Não amplia o escopo por si só. |

## Estado atual

| Área | Situação |
|---|---|
| Conta, confirmação de e-mail, espaços, equipe e convites | Implementados na API e no web; recuperação de senha pendente. |
| Alunos, parceiros, instrutores, matrículas e processos | Base implementada; há complementos de edição e histórico no checklist. |
| Documentos privados, veículos, agenda e execução de aulas | Base implementada; saldo, bloqueios por período e manutenção pendentes. |
| Agenda pessoal do instrutor em vários espaços | Implementada. |
| Toasts, sino e alerta máximo | Componentes implementados; notificações operacionais persistentes pendentes. |
| Painel inicial | Protótipo com contadores sem dados. |
| Pacotes/saldo, exames/taxas, relatórios e financeiro | Planejados no checklist principal. |
| Vendas e atendimento | Depois do MVP. |
| Aplicativo mobile | Etapa posterior; não está desenvolvido. |

Verificação em **17/10/2026**: API com **152 testes e 584 asserções aprovados**; lint e build do web aprovados. O build registra avisos de Sass/Bootstrap e tamanho do JavaScript. Homologação no navegador e preparação de produção continuam pendentes; os resultados atuais não certificam o lançamento.

## Rodar o projeto

Siga o [setup da API](../apps/api/docs/setup-api.md) para infraestrutura, ambiente, migrations e demonstração. Para a interface, siga o [setup do web](../apps/web/README.md).

Com os ambientes preparados, a partir da raiz:

```bash
# Em terminais separados:
php apps/api/artisan serve --port=8010
pnpm dev:web
```

Configure `VITE_API_URL=http://localhost:8010` no web ao usar essa porta. Credenciais de demonstração e instruções do seeder estão no [setup da API](../apps/api/docs/setup-api.md#5-dados-de-demonstração-seeder).

## Conceitos centrais

- **Espaço de trabalho:** uma autoescola (`cfc`) ou operação particular (`independent`); os módulos são compartilhados.
- **Papel:** define o que a pessoa pode fazer naquele espaço. Uma pessoa pode ter papéis diferentes em espaços diferentes.
- **Instrutor:** identidade profissional global, com conta opcional. Acesso ao espaço e vínculo profissional são separados.
- **Parceiro:** CFC externo cadastrado localmente; não ganha acesso ao sistema.
- **Aluno e matrícula:** cadastro local da pessoa e sua contratação/percurso por categoria.
- **Processo:** acompanhamento interno com referências e evidências, separado do sistema oficial.
- **Aula:** um único registro na organização de origem; a agenda pessoal não cria cópias.

Ao concluir uma entrega, atualize o checklist principal e a referência técnica correspondente. Funcionalidade planejada deve continuar identificada como pendente até estar implementada e verificada.
