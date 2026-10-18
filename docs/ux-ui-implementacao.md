# Implementação de UX/UI — Rota Certa

**Data:** 18/10/2026. **Base:** `feat/shared-modulos-4-a-8` (`e9e95d7`). **Branch:** `feat/shared-ux-ui`.
Requisitos e diagnóstico de origem: [requisitos-ux-ui.md](requisitos-ux-ui.md). Commits separados por app, conforme `CLAUDE.md`. Este registro diferencia código entregue de aceite de lançamento.

## Entregas verificadas

- [x] API: totais completos de exames e matrículas, período explícito, liquidação pendente e origem/direção de recibo.
- [x] Web: cobrança do pacote selecionado e acesso ao lançamento exato; recibos e estornos conforme receita/despesa.
- [x] Web: até cinco atalhos por perfil, demais módulos agrupados, ordem/ocultação/restauração pessoais e espaço inicial configurável.
- [x] Web: resumo do aluno com próxima aula, realizadas e saldo; matrícula com saldo resumido; histórico, documentos, pacote e cobrança sob demanda. Checklist/liberação continuam visíveis.
- [x] Web: matrícula única selecionada automaticamente; filtros de instrutor/veículo reaproveitados ao agendar; processo auxiliar abre em outra aba e pode ser atualizado sem perder matrícula.
- [x] API e web: encaminhamento de matrícula a instrutor sem aula, reserva ou ampliação de dados sensíveis.
- [x] API e web: consulta explícita de até cinco horários no dia escolhido, por intervalos de 15 min, considerando regras existentes e sem gravar reserva.
- [x] Web: proteção contra descarte nos cadastros de aluno/matrícula/aula e modais de lançamento, cobrança, baixa e operações de conta; saída da conta também verifica alterações.
- [x] Web: recuperação em memória após expiração da sessão nos formulários de aluno/matrícula/aula, isolada por conta e contexto; mensagem pede conferência antes de salvar.
- [x] Web: filtros financeiros secundários recolhidos, parcelamento expandido só quando escolhido, favorecidos priorizados para secretaria e moeda brasileira nos valores de parcelas/baixas.
- [x] Web: pagamentos, fluxo de caixa e resumo do aluno legíveis no celular; seção financeira selecionável sem explorar abas horizontais.
- [x] Web: links explícitos entre aula/aluno/matrícula/veículo/instrutor, com retorno ao registro anterior nos percursos ajustados; pendências preservam filtros na URL.
- [x] Web: estados de atualização/falha de consulta, proteção contra ações em resultados provisórios e sugestões financeiras isoladas por usuário.
- [x] Web: páginas carregadas sob demanda e tela amigável para erro de rota; instruções de configuração financeira nos primeiros passos.
- [x] Verificação: API completa, testes web, lint, build e Chromium com respostas simuladas, em 360 px e 1366 px.
- [x] Documentação: referência da API, implementação, README web e índice de documentação atualizados.

## Decisões e limites

### Navegação e autorização

Preferências são pessoais e locais ao navegador, com chave da conta e configuração por espaço. Ocultar módulo não revoga acesso, não altera alertas e não concede capacidade. Início/Pendências permanecem disponíveis; “Organizar meu menu” permite acessar os módulos autorizados e restaurar o perfil. O espaço inicial precisa continuar entre os espaços acessíveis; a entrada volta à escolha quando ele deixa de estar disponível. Não há sincronização entre dispositivos nesta entrega.

### Encaminhamento

Um responsável atual por matrícula; `assigned_instructor_id` e `assigned_at` guardam o estado e `audit_events` guarda as alterações. A operação compara o responsável esperado sob lock e recusa sobrescrita desatualizada. Instrutor deve estar ativo no espaço e atender ao menos uma categoria simples da matrícula conjunta. Pode haver identidade profissional sem conta: a tela informa essa condição, e a atribuição não cria usuário nem acesso.

A secretaria pode encaminhar e trocar responsável sem administrar horário. Instrutor membro encontra o aluno/matrícula nas listas existentes, com nome, telefone e dados operacionais; CPF, documentos e financeiro permanecem restritos. Retirar o encaminhamento revoga essa visão quando não há aula dele na matrícula; histórico de aula continua consultável pela regra anterior. Não foi criado aceite obrigatório, chat ou notificação externa.

**Permissões atuais de agenda não foram redefinidas.** Atribuição não torna instrutor operador nem restringe o staff que já podia agendar. Uma capacidade separada para impedir agendamento pela secretaria exige decisão da CFC e revisão própria da matriz.

### Horários sugeridos

A consulta reutiliza os serviços de conflito de instrutor/aulas/exames entre espaços, aluno, veículo, documentos, manutenção/bloqueios, expediente e saldo. Compara datas em UTC e apresenta no fuso do espaço. Não revela detalhes de conflitos de outra CFC. A busca começa no horário preenchido (08:00 quando vazio), fica no dia escolhido e não usa exceção de saldo/expediente. Sem resultado, a tela mantém os dados e orienta alterar dia/recursos. Salvar confere tudo novamente; sugestão não é garantia ou reserva.

### Preenchimento e retorno

A proteção não é rascunho persistente. Recuperação após sessão expirada vale para aluno/matrícula/aula na mesma aba; fechar/recarregar o navegador perde essa memória, e outra conta não a recebe. Os modais financeiros preservam campos durante falhas e pedem confirmação para fechar alterados, mas ainda não têm recuperação após desmontagem por expiração de sessão. Cadastro auxiliar de processo abre em outra aba de forma explícita.

Links contextuais ajustados carregam origem na navegação dentro do mesmo espaço. A lista financeira lê `lancamento` da URL, inclusive ao voltar pelo navegador. O retorno contextual ainda não foi uniformizado em todos os vínculos de exame, manutenção e taxa; a navegação normal pelo histórico do navegador e filtros existentes permanece disponível.

## Verificações executadas

| Verificação | Resultado | Limite |
| --- | --- | --- |
| `php artisan test --compact` | **281 testes, 1.922 asserções aprovadas** | Banco de teste MySQL; não comprova concorrência entre processos reais |
| `vendor/bin/pint --dirty --format agent` | Aprovado | Formatação dos arquivos PHP alterados |
| `pnpm --dir apps/web test` | **15 testes aprovados** | Componentes/fluxos com dependências controladas |
| `pnpm --dir apps/web lint` | Aprovado | Análise estática |
| `pnpm --dir apps/web build` | Aprovado | Avisos de Sass/Bootstrap permanecem |
| Chromium 360 × 900 e 1366 × 900 | Aluno, encaminhamento, proteção de saída e pagamentos; sem overflow na página/modal verificados | Respostas simuladas conforme contratos, não integração completa com API |
| Build com carregamento por página | Arquivo JS principal: cerca de **1.110 KB → 437 KB**, **318 KB → 138 KB gzip** | Tamanho do arquivo; não é medição de tempo de interação ou tráfego total de uma sessão |
| Migração de encaminhamento | Aplicada no banco local de desenvolvimento | Em outros ambientes, executar `php artisan migrate` antes de usar os fluxos novos |
| GitNexus | Impacto antes das alterações e detecção antes dos commits | Trechos dinâmicos/rotas foram conferidos no código; riscos altos/críticos de componentes compartilhados foram informados |

Regressões da API cobrem pacote exato, total versus amostra, liquidação/recibo, autorização de encaminhamento, troca desatualizada, isolamento entre CFCs, ausência de reserva e sugestões com conflitos/bloqueios. Testes web cobrem navegação por papel, preferências, cobrança, atualização, descarte, moeda, isolamento de conta, recuperação de sessão, encaminhamento e escolha de sugestão.

## Commits por escopo

| Commit | Escopo | Entrega |
| --- | --- | --- |
| `5207fc0` | api | Bootstrap do ambiente Laravel exigido pelas instruções locais |
| `1de5ce3` | api | Totais e apresentação financeira |
| `5b2b1ff` | web | Cobrança, indicadores, recibos e atualização |
| `638fdb3` | web | Menu pessoal e espaço inicial |
| `cf9a5ae` | web | Resumos e proteção do preenchimento |
| `543029f` | api | Encaminhamento independente |
| `e9bbb5d` | web | Encaminhamento na matrícula |
| `263440e` | api | Sugestões de horários, primeiros passos e referência técnica |
| `39ea261` | web | Agenda assistida, retorno, recuperação de sessão e financeiro no celular |
| `fc5b660` | web | Carregamento das páginas sob demanda e erro de rota amigável |

O histórico completo, incluindo o commit desta documentação, pode ser consultado com `git log --oneline e9e95d7..HEAD`; todos permanecem na branch de trabalho, sem merge ou publicação.

## TODOs de homologação e evolução

### P0 — antes do lançamento

- [ ] Executar os casos T01–T15 dos requisitos com cinco usuários leigos por perfil; registrar tempos, ajuda necessária e erros. Os objetivos de rapidez/compreensão ainda não foram medidos.
- [ ] Testar envio duplicado, dois agendamentos e bloqueio simultâneos com processos reais e rede instável em homologação.
- [ ] Homologar celular real, teclado, zoom, leitor de tela e contraste nos temas; verificar também tabelas de consulta não incluídas na inspeção automatizada.
- [ ] Rodar integração real por papel com as migrations aplicadas e validar documentos, recibos, alertas e exportações com dados representativos.
- [ ] Conferir gates de produção já previstos no checklist principal: backups, ambiente, e-mail e operação assistida.

### P1 — complementos explícitos

- [ ] Estender proteção de descarte/retomada aos demais formulários auxiliares e recuperação após sessão expirada nos modais financeiros; evitar perda após qualquer desmontagem não coberta.
- [ ] Uniformizar retorno contextual nos demais vínculos de exames, taxas e manutenção e avaliar filtros úteis de encaminhamento no piloto.
- [ ] Validar com a CFC a capacidade específica de agenda da secretaria e eventual aceite/notificação de encaminhamento; não confundir preferência de menu com permissão.
- [ ] Medir a consulta de horários com grande volume, inclusive dias totalmente bloqueados; ajustar estratégia de leitura se necessário.

### P2 — futuras

- [ ] Preferências sincronizadas, rascunhos persistentes entre dispositivos, busca global e canais externos, conforme validação do produto.

As alterações preexistentes do usuário em `.gitignore`, `CLAUDE.md`, `AGENTS.md`, `.claude/skills/` e `docs/guias/` foram preservadas fora dos commits desta entrega.
