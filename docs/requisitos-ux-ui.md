# Especificação de requisitos de UX/UI — Rota Certa Gestão

**Revisão:** 18/10/2026. **Base:** diretório de trabalho da branch `feat/shared-modulos-4-a-8`, commit `e9e95d7`. Esta revisão substitui o diagnóstico anterior e incorpora os módulos atuais, especialmente relatórios, painel, financeiro e suas integrações.

**Como ler:** **Fato** significa comportamento identificado no código; **problema identificado** é uma inconsistência observável na implementação ou uma dificuldade inferida da estrutura da interface; **requisito proposto** é comportamento desejado, ainda sujeito a implementação e aceite; **ponto em aberto** exige decisão ou validação. As dificuldades de uso são hipóteses a testar com usuários leigos. A análise foi de código, rotas, regras de acesso, documentação e cenários de testes existentes; não certifica a aparência no navegador, o desempenho real ou a prontidão de produção. O diagnóstico abaixo representa essa base anterior às mudanças de aplicação. A implementação posteriormente autorizada está registrada em [ux-ui-implementacao.md](ux-ui-implementacao.md); os problemas históricos não devem ser interpretados como falhas ainda presentes sem consultar esse registro.

## Acompanhamento da implementação — 18/10/2026

As melhorias foram implementadas na branch `feat/shared-ux-ui`, preservando este diagnóstico como rastreabilidade. Menu por perfil, personalização local, espaço inicial, cobrança do pacote exato, indicadores, recibos/liquidação, proteção dos formulários principais, resumos, navegação contextual, encaminhamento independente e consulta de horários possuem implementação. A API foi verificada com 281 testes; o web possui 15 testes automatizados. O aceite de rapidez/compreensão com pessoas leigas permanece pendente; não marcar P0 de lançamento como concluído só por haver código. Consulte entregas, limites e TODOs no registro vinculado acima.

## 1. Estado atual encontrado

### 1.1. Escopo e mudanças desde a análise anterior

**Fato:** o [checklist do produto](modulos-checklist.md) declara implementados os módulos 1 a 8 e mantém homologação, concorrência real e preparação de produção como etapas pendentes. O código contém saldo/pacotes, exames/taxas, desfecho, disponibilidade/frota, alertas, acesso/correções, relatórios e financeiro. Relatórios e resumo do aluno agora estão versionados; financeiro já possui telas, serviços, rotas e testes. A análise anterior não deve mais tratá-los como entregas ausentes ou apenas alterações locais.

**Fato:** ainda existem descrições históricas divergentes. O [README](README.md), partes do próprio [checklist](modulos-checklist.md) e a tabela de estado de [implementação da API](../apps/api/docs/implementacao.md) mencionam funcionalidades como ausentes apesar da implementação atual. O inventário abaixo se baseia nas rotas e no conteúdo dos arquivos, não somente nos marcadores de conclusão desses documentos.

**Fato:** o produto continua centrado na gestão da etapa prática. “Vendas e atendimento”, aplicativo mobile, portal do aluno, integrações oficiais e automações externas permanecem no planejamento posterior do checklist. Não foi encontrada uma tela atual de interessados, propostas ou encaminhamento operacional de aluno independente da aula. “Atendimento”, nesta especificação, também pode designar a rotina já existente de consultar aluno, matrícula, processo e pendências; isso não implica a existência de um módulo comercial.

### 1.2. Inventário de módulos, telas e componentes

| Área | Fato encontrado | Arquivos de referência |
| --- | --- | --- |
| Conta e acesso | Login, cadastro, confirmação de e-mail, recuperação/redefinição de senha e alteração de senha; layouts de conta e autenticação. | [rotas](../apps/web/src/config/routes.tsx), [Configurações](../apps/web/src/pages/settings/SettingsPage.tsx), [cliente HTTP](../apps/web/src/api/client.ts) |
| Espaços | Espaço CFC e particular; seleção por cartão; nome e papel no menu; espaço ativo identificado na URL. `/` ainda redireciona para “Meus espaços”. | [Meus espaços](../apps/web/src/pages/organizations/OrganizationsPage.tsx), [layout do espaço](../apps/web/src/layouts/OrganizationLayout.tsx), [arquitetura](arquitetura.md) |
| Equipe e instrutores | Membros, convites e auditoria para gerência; perfil profissional global, vínculo profissional e acesso ao espaço separados. | [rotas](../apps/web/src/config/routes.tsx), [permissões](permissoes.md), [disponibilidade do instrutor](../apps/web/src/pages/instructors/InstructorAvailabilityPanel.tsx) |
| Alunos | Cadastro com nome e dados opcionais; busca/listagem; edição; detalhe com matrículas, saldo, aulas, exames, histórico e documentos; resumo para impressão. | [cadastro](../apps/web/src/pages/students/StudentFormPage.tsx), [detalhe](../apps/web/src/pages/students/StudentDetailPage.tsx), [resumo](../apps/web/src/pages/students/StudentSummaryPage.tsx) |
| Matrículas e saldo | Matrícula por categoria, processo e parceiro opcionais; pacotes, acréscimos, reserva/consumo e saldo por categoria; ajustes e estornos de crédito com restrição à gerência. | [matrícula](../apps/web/src/pages/enrollments/EnrollmentDetailPage.tsx), [saldo](../apps/web/src/pages/enrollments/BalancePanel.tsx), [livro de créditos](../apps/api/app/Services/CreditLedger.php) |
| Agenda e execução | Dia/semana, filtros por instrutor/veículo, agendamento, remarcação, troca de recursos, realização/falta/cancelamento, evolução, duração real e registro oficial manual. | [agenda](../apps/web/src/pages/schedule/SchedulePage.tsx), [formulário](../apps/web/src/pages/schedule/LessonFormPage.tsx), [aula](../apps/web/src/pages/schedule/LessonDetailPage.tsx), [compromissos](../apps/web/src/components/CommitmentList.tsx) |
| Agenda pessoal | Reúne aulas do próprio instrutor nos espaços acessíveis; distingue organização e fuso; não duplica aulas no espaço particular. | [Minha agenda](../apps/web/src/pages/me/MyLessonsPage.tsx), [API pessoal](../apps/web/src/api/me.ts) |
| Processos e documentos | Checklist/liberação, evidências, documentos privados/versionados, resultado por categoria, renúncia, emissão, conclusão/encerramento e reabertura. | [processo](../apps/web/src/pages/processes/ProcessDetailPage.tsx), [desfecho](../apps/web/src/pages/processes/OutcomePanel.tsx), [documentos no aluno](../apps/web/src/pages/students/StudentDetailPage.tsx) |
| Exames e taxas | Busca/filtros, tentativa por categoria, agendamento, remarcação, resultado/correção, anexos e taxas externas; avisos operacionais não equivalem a validação oficial. | [lista](../apps/web/src/pages/exams/ExamsPage.tsx), [cadastro de exame](../apps/web/src/pages/exams/ExamFormModal.tsx), [detalhe](../apps/web/src/pages/exams/ExamDetailPage.tsx), [taxas](../apps/web/src/pages/exams/FeesPanel.tsx) |
| Disponibilidade e frota | Horário de atendimento do espaço/instrutor, bloqueios, indisponibilidade pessoal, manutenção, documentos do veículo e compromissos afetados com providências. | [bloqueios](../apps/web/src/pages/availability/AvailabilityPage.tsx), [frota](../apps/web/src/pages/vehicles/VehicleFleetPanel.tsx), [impacto operacional](../apps/web/src/components/AffectedModal.tsx) |
| Pendências | Lista persistente de abertas/resolvidas/arquivadas; leitura e arquivo pessoais; filtros por assunto/prioridade; link para registro; alertas financeiros integrados. | [central](../apps/web/src/pages/alerts/AlertsPage.tsx), [destinos](../apps/web/src/utils/alertPath.ts), [visibilidade](../apps/api/app/Models/Alert.php), [alertas financeiros](../apps/api/app/Services/Finance/FinanceAlerts.php) |
| Painel e relatórios | Painel real por escopo; relatórios de aulas, exames, utilização, processos e parceiros (aba de parceiros para espaço particular); filtros, detalhes, CSV e resumo imprimível do aluno. | [início](../apps/web/src/pages/organization/OrganizationHomePage.tsx), [painel na API](../apps/api/app/Services/Reports/Dashboard.php), [relatórios](../apps/web/src/pages/reports/ReportsPage.tsx), [testes de relatórios](../apps/api/tests/Feature/Api/ReportTest.php) |
| Financeiro | Visão geral; Receitas; Despesas; Contas e movimentações; Cadastros. Há parcelas, recebimento/pagamento parcial ou dividido, liquidação futura, recibo, anexos, transferências, ajustes, conferência manual e recorrência. | [layout financeiro](../apps/web/src/pages/finance/FinanceLayout.tsx), [lançamentos](../apps/web/src/pages/finance/EntriesPage.tsx), [contas](../apps/web/src/pages/finance/AccountsPage.tsx), [cadastros](../apps/web/src/pages/finance/SetupPage.tsx), [serviço financeiro](../apps/api/app/Services/Finance/FinanceService.php) |
| Integrações financeiras | Cobrança a partir de pacote, despesa de manutenção, adiantamento/reembolso de taxa e resumo financeiro do parceiro; geração é explícita, com referência de origem para impedir duplicação. | [financeiro na matrícula](../apps/web/src/pages/enrollments/EnrollmentFinancePanel.tsx), [geração contextual](../apps/web/src/pages/finance/ChargeModal.tsx), [integrações da API](../apps/api/app/Http/Controllers/Api/V1/Finance/IntegrationController.php), [parceiro](../apps/web/src/pages/partners/PartnerFormPage.tsx) |

### 1.3. Bases existentes que devem ser aproveitadas

- **Responsividade:** [AppLayout](../apps/web/src/layouts/AppLayout.tsx) transforma a navegação lateral em menu deslizante; [DataTable](../apps/web/src/components/DataTable.tsx) usa cartões abaixo de 768 px. Os modais financeiros usam tela inteira em determinados tamanhos. Isso é implementação responsiva, ainda dependente de homologação.
- **Erros e envio:** [cliente HTTP](../apps/web/src/api/client.ts) envia chave de idempotência nas alterações de espaço, evita requisições simultâneas iguais e reutiliza a chave após falha de rede sem resposta. Isso não garante recuperação do formulário após fechar a página ou expirar a sessão.
- **Listas completas:** [lessons.ts](../apps/web/src/api/lessons.ts) e [me.ts](../apps/web/src/api/me.ts) já usam [fetchAllPages](../apps/web/src/api/paginate.ts). O diagnóstico antigo de “somente as primeiras 100 aulas” não descreve mais a agenda atual. Há um teto de 50 páginas no agregador, que continua exigindo indicação de cobertura e teste de volume.
- **Preferências:** [preferencesStorage](../apps/web/src/lib/preferencesStorage.ts) guarda avisos silenciados por usuário no navegador. O financeiro também lembra conta/forma usadas, em [financeLastUsed](../apps/web/src/utils/financeLastUsed.ts), com chave por espaço e tipo de operação, sem usuário. Não há personalização de módulos ou espaço padrão nos arquivos examinados.
- **Verificação existente:** há cenários de API em [FinanceTest](../apps/api/tests/Feature/Api/FinanceTest.php) e [ReportTest](../apps/api/tests/Feature/Api/ReportTest.php), inclusive permissões e conciliação de valores. Eles não substituem testar o percurso das telas. Esta revisão não executou essas suítes nem mediu tempo de uso.

## 2. Problemas de UI identificados e requisitos propostos

Os efeitos sobre rapidez e compreensão são hipóteses de usabilidade, salvo quando a própria apresentação contradiz o estado dos dados.

| ID | Problema e onde aparece | Requisito proposto | Prioridade |
| --- | --- | --- | --- |
| UI-01 | O [menu do espaço](../apps/web/src/layouts/OrganizationLayout.tsx) tem **18 destinos para owner/admin, 15 para staff e 10 para instructor**, sem contar os controles do rodapé. Todos ficam no mesmo nível; Agenda e Minha agenda convivem na lista. | Destacar até cinco destinos frequentes por perfil; agrupar os outros em operação, cadastros e gestão. Identificar o alcance de cada agenda. Oferecer acesso simples a todos os módulos permitidos. | P0 para hierarquia básica; P1 para personalização |
| UI-02 | [Aluno](../apps/web/src/pages/students/StudentDetailPage.tsx), [matrícula](../apps/web/src/pages/enrollments/EnrollmentDetailPage.tsx) e [processo](../apps/web/src/pages/processes/ProcessDetailPage.tsx) empilham seções extensas; a matrícula agora inclui saldo e financeiro. | No topo, nome/contexto, próxima ação e pendências bloqueantes. Resumir saldo, liberação e cobrança; abrir detalhes sob demanda, preservando dados e ações autorizados. | P0 |
| UI-03 | [Receitas/Despesas](../apps/web/src/pages/finance/EntriesPage.tsx) mostram busca, cinco campos adicionais de filtro, cinco situações, totais e ações; [Contas](../apps/web/src/pages/finance/AccountsPage.tsx) reúne cartões, extrato, consolidado e transferências. | Manter busca, situação e vencimento mais acessíveis; colocar filtros secundários em “Mais filtros” com contagem dos ativos. Separar visualmente consulta, lançamento e gestão de contas. | P1 |
| UI-04 | O [novo lançamento](../apps/web/src/pages/finance/EntryFormModal.tsx) expõe periodicidade, tabela de parcelas e outros detalhes mesmo no caso simples de uma parcela. [Cadastros](../apps/web/src/pages/finance/SetupPage.tsx) reúne quatro áreas no mesmo destino. | Começar por descrição, pessoa, valor e vencimento; expandir parcelamento e opções adicionais sob demanda. Para staff, priorizar favorecidos, que pode manter, e reduzir o destaque das configurações da gerência. | P1 |
| UI-05 | Parte do financeiro usa [DataTable](../apps/web/src/components/DataTable.tsx), mas o [resumo do aluno](../apps/web/src/pages/students/StudentSummaryPage.tsx), o [fluxo de caixa](../apps/web/src/pages/finance/OverviewPage.tsx) e pagamentos no [detalhe do lançamento](../apps/web/src/pages/finance/EntryDetailModal.tsx) usam tabelas com rolagem horizontal. | Permitir ler situação, valor e próxima ação em 360 px sem depender de rolagem horizontal; tabela detalhada pode permanecer na impressão/consulta ampliada. Homologar cada variante, não apenas o componente genérico. | P0 nas tarefas principais |
| UI-06 | [PayModal](../apps/web/src/pages/finance/PayModal.tsx) e parcelas de [EntryFormModal](../apps/web/src/pages/finance/EntryFormModal.tsx) usam campos monetários simples; [AccountModals](../apps/web/src/pages/finance/AccountModals.tsx) usa máscara brasileira. | Padronizar entrada e leitura de dinheiro em reais, vírgula decimal e duas casas, aceitando colagem sem alterar o valor. Exibir total, pago, restante e efeito líquido onde houver desconto/taxa. | P0 para valor correto; P1 para uniformização |
| UI-07 | No [financeiro](../apps/api/app/Services/Finance/FinanceService.php), pagamentos pendentes de liquidação já entram no cálculo da parcela paga; a [lista](../apps/web/src/pages/finance/EntriesPage.tsx) mostra “Paga”. O caso é explícito em [FinanceTest](../apps/api/tests/Feature/Api/FinanceTest.php), no teste de cartão. | Distinguir “parcela quitada, aguardando liquidação” de “dinheiro disponível”. Mostrar o estado pendente na lista e no contexto da matrícula, além do detalhe. Não alterar a regra financeira silenciosamente para resolver um problema de rótulo. | P0 |
| UI-08 | [FinanceLayout](../apps/web/src/pages/finance/FinanceLayout.tsx) mantém cinco abas em faixa horizontal rolável; [AppLayout](../apps/web/src/layouts/AppLayout.tsx) mantém menu principal extenso no celular. | Destino ativo, retorno e ação principal devem ser perceptíveis sem explorar rolagens; indicar opções adicionais da navegação. Manter nomes e ordem consistentes em celular e desktop. | P1 |

**Requisito visual transversal:** preservar a [identidade visual existente](identidade-visual.md); usar texto e ícone junto da cor, foco visível, hierarquia de títulos, rótulos explícitos e ações de toque com área mínima proposta de 44 × 44 px. Conferir temas claro/escuro e zoom de 200% nos percursos críticos. Não interpretar classes responsivas como evidência de contraste ou acessibilidade já homologados.

## 3. Problemas de UX identificados e requisitos propostos

| ID | Fato ou inconsistência estática e localização | Consequência e requisito proposto | Prioridade |
| --- | --- | --- | --- |
| UX-01 | [EnrollmentFinancePanel](../apps/web/src/pages/enrollments/EnrollmentFinancePanel.tsx) guarda o pacote escolhido em `charging`, mas passa ao [ChargeModal](../apps/web/src/pages/finance/ChargeModal.tsx) apenas valor/contexto; o envio não inclui `package_id`. [chargeEnrollment](../apps/api/app/Http/Controllers/Api/V1/Finance/IntegrationController.php) usa o pacote mais recente quando o ID não vem. | Com dois pacotes, o botão pode gerar a referência de outro pacote ou apontar duplicidade indevida. A cobrança deve identificar exatamente o pacote escolhido, conservar origem e abrir o lançamento correto. Achado por leitura, ainda sem reprodução pelo navegador. | P0 |
| UX-02 | O [painel da API](../apps/api/app/Services/Reports/Dashboard.php) limita `upcoming_exams` a cinco; a [tela inicial](../apps/web/src/pages/organization/OrganizationHomePage.tsx) usa o tamanho dessa lista como indicador dos próximos 14 dias. “Saldo baixo” abre todas as pendências; “Alunos em atendimento” conta pessoas distintas e abre uma lista de matrículas. | Separar total de amostra e conciliar unidade/filtros entre número e destino. Clicar em um indicador deve explicar e reproduzir o conjunto que ele representa. | P0 |
| UX-03 | [AvailabilityPage](../apps/web/src/pages/availability/AvailabilityPage.tsx) cria link de instrutor mesmo quando o usuário é `instructor`; a rota de instrutores é protegida por `canOperate` nas [rotas](../apps/web/src/config/routes.tsx). | O próprio instrutor pode receber um atalho para destino negado. Oferecer texto ou destino permitido; validar links também por perfil e acesso ao registro. | P0 |
| UX-04 | [ReceiptPage](../apps/web/src/pages/finance/ReceiptPage.tsx) usa “Recebemos de”/“Total recebido” e retorno fixo a Receitas, inclusive para pagamentos de despesas. O texto de estorno em [EntryDetailModal](../apps/web/src/pages/finance/EntryDetailModal.tsx) diz sempre que o valor sai da conta. | Recibo e confirmação devem refletir recebimento ou pagamento e a direção real do estorno. Voltar deve retomar a origem, inclusive Despesas ou matrícula. | P0 para texto; P1 para retorno completo |
| UX-05 | [useFinance](../apps/web/src/hooks/useFinance.ts) mantém dados anteriores enquanto muda o filtro; [QueryState](../apps/web/src/components/QueryState.tsx) não apresenta erro de atualização quando já há dados, nem distingue atualização pendente. | Risco de interpretar valores antigos como resposta do novo filtro. Indicar “Atualizando”, falha e período efetivamente carregado; permitir tentar novamente sem apagar a consulta anterior. | P0 no financeiro/agenda |
| UX-06 | [EntryFormModal](../apps/web/src/pages/finance/EntryFormModal.tsx) e [PayModal](../apps/web/src/pages/finance/PayModal.tsx) usam estado local e `onHide` direto; mensagens de validação são gerais. [EnrollmentFormPage](../apps/web/src/pages/enrollments/EnrollmentFormPage.tsx) oferece “Criar processo” como navegação para outra página durante o preenchimento da matrícula. Os formulários de aluno/aula preservam valores durante falhas enquanto montados, mas não há recuperação geral após saída. | Preservar campos em erro e ao abrir cadastro auxiliar; apontar campo/linha e focar o primeiro problema. Fechar/Esc/sair com dados alterados exige decisão de descarte. Se a sessão expirar, permitir recuperar o preenchimento autorizado após login. Não prometer rascunho persistente já existente. | P0 para falha/descarte; P1 para retomada de sessão |
| UX-07 | Em [LessonFormPage](../apps/web/src/pages/schedule/LessonFormPage.tsx), o conflito aparece após envio; [EnrollmentPicker](../apps/web/src/components/EnrollmentPicker.tsx) separa busca, escolha do aluno e matrícula. Apenas matrícula e data chegam como pré-seleção. | Reaproveitar origem e filtros; seleção única deve poder ser confirmada rapidamente. Explicar o conflito no recurso/horário, manter dados e oferecer alternativa. Consulta antecipada de disponibilidade é evolução proposta. | P0 para recuperação; P1 para acelerar |
| UX-08 | [AssignmentScope](../apps/api/app/Services/AssignmentScope.php) depende de aula associada para mostrar aluno/matrícula ao instrutor; não há encaminhamento independente nas rotas examinadas. | A secretaria precisa vincular uma aula para dar contexto operacional ao instrutor. Propor encaminhamento independente, sem reservar horário, consumir saldo ou ampliar dados sensíveis; decisões em F3. | P1, funcionalidade nova |
| UX-09 | A entrada fixa em `/espacos` e as [Configurações](../apps/web/src/pages/settings/SettingsPage.tsx) não oferecem espaço padrão ou organização de módulos. [financeLastUsed](../apps/web/src/utils/financeLastUsed.ts) lembra escolhas por espaço, sem usuário. | Distinguir preferência pessoal, contexto e permissão; escolher entrada particular/CFC, restaurar menu e isolar sugestões entre contas no mesmo navegador. Nunca usar preferência como autorização. | P1 |
| UX-10 | Aula no [histórico do aluno](../apps/web/src/pages/students/StudentDetailPage.tsx) e recursos no [detalhe da aula](../apps/web/src/pages/schedule/LessonDetailPage.tsx) ainda aparecem parcialmente como texto. A integração de [ChargeModal](../apps/web/src/pages/finance/ChargeModal.tsx), no sucesso, aponta a lista financeira sem selecionar o lançamento criado. | Abrir o registro exato e conservar contexto de origem. Vínculos de manutenção/taxa/parceiro também precisam de retorno claro, não somente acesso à lista do módulo. | P1 |
| UX-11 | [AlertsPage](../apps/web/src/pages/alerts/AlertsPage.tsx) guarda aba, assunto e prioridade em estado local, embora página esteja na URL; “Marcar lida” e “Arquivar” convivem com resolução automática. | Voltar do registro deve recuperar filtros. Explicar que leitura/arquivo são pessoais e não resolvem a pendência da operação. Ocultar um módulo do menu não deve silenciar seus alertas necessários. | P1 |
| UX-12 | [README](README.md), [implementação](../apps/api/docs/implementacao.md) e trechos históricos do [checklist](modulos-checklist.md) conflitam com as telas atuais. O guia de [primeiros passos](../apps/web/src/components/OnboardingGuide.tsx) não orienta configurar conta financeira. | Atualizar orientação/documentação por módulo e apresentar configuração financeira à gerência quando necessária. Para staff sem conta disponível, indicar quem pode cadastrá-la. | P1 |

Os problemas UX-01 a UX-05 são demonstráveis na composição atual do código, mas o efeito final no navegador deve ser reproduzido antes de dar a correção como aceita. Falta de medição não autoriza afirmar que telas são rápidas ou que o usuário já perdeu dados em produção.

## 4. Requisitos por perfil e responsabilidades

### 4.1. Matriz atual verificada

| Capacidade | Instrutor no papel `instructor` | Secretaria `staff` | Gerência `owner`/`admin` |
| --- | --- | --- | --- |
| Consultar agenda | Só próprias aulas; agenda pessoal agrega espaços acessíveis | Todas do espaço | Todas do espaço |
| Criar/remarcar/cancelar aula | Não | Sim | Sim |
| Realizada/falta e evolução | Próprias aulas, conforme regras de execução | Sim | Sim |
| Alunos/matrículas | Só associados por aula; aluno com nome/telefone, sem dados completos ou preço | Cadastros e atendimento do espaço | Cadastros e atendimento do espaço |
| Processos, checklist, documentos privados | Não; somente resumo de liberação autorizado | Sim | Sim |
| Exames | Resumo dos exames sob sua responsabilidade | Operação; correção de resultado restrita à gerência | Operação e correção |
| Bloqueios/manutenção | Própria indisponibilidade pessoal | Operação do espaço | Operação do espaço |
| Relatórios de gestão | Não; API possui resumo próprio | Sim | Sim |
| Financeiro: consultar, lançar, corrigir parcela aberta, receber/pagar | Não | Sim, inclusive visão do financeiro do espaço | Sim |
| Favorecidos financeiros | Não | Pode cadastrar/alterar | Sim |
| Contas, categorias, formas e recorrências; estorno/cancelamento, transferências, ajuste/conferência | Não | Consulta permitida conforme endpoint, sem as ações de gestão | Sim |
| Membros e convites | Não | Não | Sim; `admin` só administra `staff`/`instructor`; último proprietário protegido |

Fontes: [permissões](permissoes.md), [FinanceAccess](../apps/api/app/Services/Finance/FinanceAccess.php), [CatalogController](../apps/api/app/Http/Controllers/Api/V1/Finance/CatalogController.php), [FinanceTest](../apps/api/tests/Feature/Api/FinanceTest.php), [ExamDetailPage](../apps/web/src/pages/exams/ExamDetailPage.tsx), [AssignmentScope](../apps/api/app/Services/AssignmentScope.php). O código de favorecidos permite operação a `staff`, mesmo que o comentário resumido de `FinanceAccess` agrupe favorecidos com cadastros gerenciais.

### 4.2. Experiência proposta por perfil

- **Instrutor:** entrada orientada à próxima aula, registro de execução/evolução e indisponibilidade. Destacar Agenda do espaço, Alunos atribuídos e Pendências. Rotular Minha agenda como visão entre espaços. Se for autônomo **proprietário do espaço particular**, deve ter acesso à própria operação, incluindo cadastro, agenda e financeiro; isso decorre do papel no espaço, não de uma exceção oculta para instrutores.
- **Secretaria:** busca de aluno, próximo passo do atendimento, agenda e pendências operacionais. Receber valores pelo contexto da matrícula/parcela já é possível e deve ser favorecido. Encaminhar ao instrutor deve ser ação independente, quando implementada. Cadastro de equipe e configuração de contas permanecem com a gerência.
- **Gerência:** alternar rotina diária e Gestão; acompanhar indicadores com origem verificável, financeiro, acessos, auditoria e configuração. Exceções e correções devem indicar consequência, responsável e motivo quando exigido.

**Recomendação de evolução de permissões:** validar se toda secretaria deve enxergar Despesas, saldos de todas as contas e relatórios completos. Hoje `staff` tem acesso amplo ao financeiro; esconder esses módulos é apenas preferência. Se a CFC precisar restringir por responsabilidade, será necessário definir e implementar permissões por capacidade, com aplicação na API, exportações e alertas. Não existe configuração granular por funcionário comprovada nesta revisão.

## 5. Fluxos prioritários e comportamento esperado

### F1. Cadastro de aluno e continuidade do atendimento — existente, simplificação proposta

**Hoje:** Alunos → Novo aluno → salvar → detalhe → Nova matrícula; dentro do formulário da matrícula há link para criar processo em outra página. Pacote e aula têm etapas próprias ([StudentFormPage](../apps/web/src/pages/students/StudentFormPage.tsx), [StudentDetailPage](../apps/web/src/pages/students/StudentDetailPage.tsx), [EnrollmentFormPage](../apps/web/src/pages/enrollments/EnrollmentFormPage.tsx), [BalancePanel](../apps/web/src/pages/enrollments/BalancePanel.tsx)).

**Requisitos:** buscar pessoa existente antes de duplicar; permitir iniciar com nome e completar campos opcionais depois; manter campos em erro; após salvar, mostrar confirmação e próximo passo contextual. Reutilizar aluno, categoria, matrícula e parceiro já conhecidos. Processo, pacote, cobrança e documentos devem aparecer quando pertinentes à regra, sem exigir todos para qualquer atendimento. Cada etapa salva deve ser retomável sem recadastrar a anterior. CPF igual em organizações diferentes não significa unificação de cadastros.

### F2. Agendamento de aula — existente, prioridade de agilidade

**Hoje:** Agenda ou matrícula → formulário com data/matrícula prévias quando informadas → instrutor, veículo opcional, categoria quando necessária, horário/duração → salvar ([LessonFormPage](../apps/web/src/pages/schedule/LessonFormPage.tsx)).

**Requisitos:** o caminho a partir da matrícula não pede novamente aluno/matrícula; a partir da agenda reaproveita data e, quando inequívoco, o filtro de instrutor/veículo. Confirmar sugestões com nome/placa visíveis. Mostrar duração e horário final, saldo/reserva e fuso. Indicar “Sem veículo” explicitamente quando permitido e distinguir pré-reserva de aula pronta para executar. Sem saldo, categoria adequada ou liberação, explicar a condição e a providência, respeitando as exceções reais da operação.

**Conflitos:** validar aluno entre matrículas, instrutor entre espaços, veículo, aulas, exames, bloqueios/manutenção, horário de atendimento e validade do veículo. A implementação já faz verificações na API com travas/transação ([ScheduleLesson](../apps/api/app/Actions/Lessons/ScheduleLesson.php), [SchedulingConstraints](../apps/api/app/Services/SchedulingConstraints.php), [InstructorAvailability](../apps/api/app/Services/InstructorAvailability.php), [AvailabilityGuard](../apps/api/app/Services/AvailabilityGuard.php)). Manter essa autoridade na gravação mesmo que a UI sugira horários. Recusa não apaga campos; mostrar recurso/intervalo afetado e permitir alterar só o necessário. Compromisso de outro espaço aparece apenas como indisponibilidade. Testar duas tentativas simultâneas e horários adjacentes sem sobreposição.

### F3. Encaminhamento de aluno ao instrutor — requisito novo, pendente de decisão

**Hoje:** não há encaminhamento independente; atribuição deriva de aula em [AssignmentScope](../apps/api/app/Services/AssignmentScope.php).

**Proposta:** a secretaria abre aluno/matrícula, escolhe instrutor ativo e confirma o encaminhamento com contexto mínimo. O instrutor encontra o item e sabe qual providência cabe a ele; secretaria/gerência consultam responsável e andamento. Encaminhar não cria aula, reserva horário, altera saldo ou gera cobrança. Não deve ser necessário conceder à secretaria administração da agenda pessoal do instrutor para concluir o encaminhamento.

**Decisões em aberto antes de implementar:** vínculo por matrícula ou aluno; um ou vários instrutores; necessidade de aceite; quem pode reatribuir/encerrar; como lidar com instrutor sem conta e desvinculado; quais dados mínimos ficam visíveis antes da primeira aula. Uma fila e estados como “aguardando/recebido/encerrado” são possibilidades de desenho, não telas ou estados existentes. A política de aluno atribuído precisará de revisão; documentos, saúde, preço e demais dados sensíveis não devem ser liberados implicitamente. Esse fluxo operacional não pressupõe o módulo futuro de Vendas.

### F4. Contratação e cobrança de pacote — existente, corrigir identidade da origem

**Hoje:** matrícula → Contratar/Acrescentar aulas → pacote/saldo → Gerar cobrança → parcelas, com pagador aluno ou parceiro quando aplicável ([BalancePanel](../apps/web/src/pages/enrollments/BalancePanel.tsx), [EnrollmentFinancePanel](../apps/web/src/pages/enrollments/EnrollmentFinancePanel.tsx), [ChargeModal](../apps/web/src/pages/finance/ChargeModal.tsx)).

**Requisitos:** indicar qual pacote será cobrado; transmitir o ID escolhido; revisar valor, pagador, parcelas e vencimentos; mostrar “ainda sem cobrança”, “cobrança gerada” e pagamento separadamente. Concluir abre o lançamento exato e permite voltar à matrícula. Repetir envio ou consumir aula não gera outra cobrança. Caso já exista, abrir o existente. **Aceite essencial:** dois pacotes com valores diferentes, cobrança do mais antigo e posterior cobrança do mais recente sem troca de origem (UX-01).

### F5. Receber/pagar, liquidar e corrigir — existente, clareza obrigatória

**Hoje:** lista ou matrícula → Receber/Pagar → valor restante e última conta/forma sugeridos; pode dividir linhas e informar ajustes. Cartão/boleto com prazo ficam pendentes até confirmação; estorno é gerencial ([PayModal](../apps/web/src/pages/finance/PayModal.tsx), [EntryDetailModal](../apps/web/src/pages/finance/EntryDetailModal.tsx)).

**Requisitos:** caso comum deve exigir apenas conferência de valor, forma, conta e data; divisão e ajustes ficam sob demanda. Mostrar quanto quita a parcela, quanto permanece, quanto efetivamente entra/sai e se aguarda liquidação. Se a última conta/forma estiver inativa, exigir escolha válida. Em rede ruim, manter linhas e referências para evitar duplicação; conferir saldo atualizado antes de efetivar. Recibo distingue recebimento/pagamento e liquidação pendente. Estorno explica direção do dinheiro e reabertura da obrigação; preserva histórico e exige o motivo previsto.

### F6. Manutenção e indisponibilidade — existente, manter operação e financeiro coerentes

**Hoje:** veículo/bloqueios → manutenção e bloqueio opcional → compromissos afetados → trocar recurso ou abrir aula/exame; no veículo é possível gerar despesa ([VehicleFleetPanel](../apps/web/src/pages/vehicles/VehicleFleetPanel.tsx), [AffectedModal](../apps/web/src/components/AffectedModal.tsx), [CommitmentList](../apps/web/src/components/CommitmentList.tsx)).

**Requisitos:** identificar veículo, período e alcance antes de confirmar; apresentar aulas/exames afetados e providência, sem cancelamento silencioso. Quando houver possibilidade de prévia, informar impacto antes de salvar; depois, manter acesso aos itens pendentes. Concluir/cancelar manutenção explica o que acontece com o bloqueio. Criar despesa é ação explícita, com origem única, valor estimado/real e favorecido; pagamento da oficina não deve, por si só, liberar veículo.

### F7. Exame, taxa, resultado e desfecho — existente

**Hoje:** processo pode iniciar exame com contexto; exames possuem tentativas, taxas e anexos. Processo separa resultado por categoria, emissão e encerramento ([ExamFormModal](../apps/web/src/pages/exams/ExamFormModal.tsx), [FeesPanel](../apps/web/src/pages/exams/FeesPanel.tsx), [OutcomePanel](../apps/web/src/pages/processes/OutcomePanel.tsx)).

**Requisitos:** reaproveitar aluno/processo/categoria; diferenciar A/B em processo conjunto; mostrar próximo passo sem abrir todas as ações simultaneamente. Taxa paga diretamente pelo aluno, adiantamento do espaço e reembolso têm efeitos diferentes e devem indicar o que foi registrado e o que falta. Resultado de exame, liberação para prática, emissão do documento e situação comercial não se substituem. Mudança de resultado/renúncia/encerramento deve mostrar consequências; confirmação oficial permanece um registro de conferência, sem presumir integração externa.

### F8. Indicador → registros → exportação — existente

**Requisitos:** indicador informa unidade, período/fuso e base; abre os registros exatos; total, detalhe e CSV conciliam além de uma página. Separar dados completos de amostra de próximos itens e atualização pendente. Diferenciar gestão operacional de caixa; transferência, saldo inicial e reembolso não podem ser confundidos com faturamento. Referências: [ReportsPage](../apps/web/src/pages/reports/ReportsPage.tsx), [OverviewPage](../apps/web/src/pages/finance/OverviewPage.tsx), [AccountsPage](../apps/web/src/pages/finance/AccountsPage.tsx).

## 6. Navegação, espaço padrão, personalização, permissões e interligação

### 6.1. Navegação e espaço padrão — requisitos propostos

| ID | Requisito |
| --- | --- |
| NAV-01 | Tornar visíveis nome/tipo do espaço e papel; separar configurações pessoais de Dados do espaço. O usuário deve saber onde uma gravação ocorrerá. |
| NAV-02 | Oferecer entrada padrão em **Meus espaços**, **meu espaço particular existente** ou **uma CFC acessível**, exibindo nome/tipo. Não confundir espaço particular com Minha agenda, que agrega compromissos de vários espaços. |
| NAV-03 | Na entrada normal, validar o destino padrão antes de abrir. Link de convite, recuperação ou registro específico conserva o destino solicitado. Se perder acesso ao padrão, voltar a Meus espaços com explicação simples. Não criar automaticamente um espaço particular. |
| NAV-04 | Trocar espaço não leva IDs de aluno, matrícula, veículo ou lançamento ao novo contexto. Confirmar descarte de formulário; preservar preferências pessoais próprias de cada espaço. |
| NAV-05 | No menu diário, destacar até cinco destinos permitidos. Proposta inicial: instrutor — Início/Agenda/Alunos/Pendências/Indisponibilidade; secretaria — Início/Alunos/Agenda/Pendências e tarefa financeira frequente; gerência — Início/Pendências/Financeiro/Relatórios/Agenda. Validar ordem no piloto; os demais módulos seguem acessíveis por agrupamento curto. |
| NAV-06 | Oferecer caminho de retorno previsível para lista com busca, filtros, período, página e posição quando viável; usar rótulos como “Voltar à matrícula” e “Voltar às despesas”. |

### 6.2. Personalização pessoal e permissões da CFC

| Camada | Regra proposta | Base atual |
| --- | --- | --- |
| Permissão | Define o que pode consultar/executar; validada pela API, também em exportação, documento, alerta e URL direta. Apenas pessoas autorizadas alteram acessos. | Papéis por espaço e controles específicos; financeiro distingue operar/gerenciar. |
| Preferência de menu | Usuário pode fixar, ocultar e ordenar **módulos permitidos**, por usuário e espaço. Deve haver “Todos os módulos” e “Restaurar padrão”. Ocultar não altera permissão, registro ou alerta operacional. | Menu fixo; essa preferência ainda não existe. |
| Entrada padrão | Escolha da conta sobre onde iniciar; não concede acesso nem troca papel. | Redirecionamento fixo a Meus espaços. |
| Sugestões de formulário | Última conta/forma e padrões de tarefa devem pertencer ao usuário e contexto, ser revisáveis e revalidados se inativos. | Conta/forma financeira atualmente lembradas por espaço/tipo no navegador. |
| Alertas | Ler/arquivar é pessoal; antecedência e destinatários configurados pela gerência são regras do espaço. Resolver depende do fato de origem. | Estados pessoais persistidos e visibilidade por papel/configuração. |

**Requisitos adicionais:** rótulo “Organizar meu menu” separado de “Acessos da equipe”; revogação/promoção recalcula destinos sem reutilizar conteúdo de outro usuário; permissão negada remove a ação e explica alternativa quando cabível. Preferências em navegador devem informar seu alcance. Sincronização entre dispositivos é evolução proposta. Ocultar Financeiro por preferência não protege caixa de um `staff` que já possui acesso à API.

### 6.3. Ligações entre registros e preservação de contexto

| Origem → destino | Requisito de navegação |
| --- | --- |
| Aluno ↔ matrícula/processo/documento/aula/exame | Links com identidade do registro; distinguir matrículas/categorias e versões; preservar aluno e filtros de origem. Mostrar só destinos autorizados. |
| Matrícula ↔ pacote/cobrança/parcela/recibo | Identificar a origem e abrir o lançamento exato; voltar ao ponto de atendimento. Saldo de aulas e saldo financeiro recebem nomes/unidades diferentes. |
| Aula/exame ↔ instrutor/veículo/aluno | Nome/placa com link específico quando permitido; não tornar o cartão inteiro clicável junto a ações de execução. |
| Veículo ↔ manutenção/bloqueio/compromissos/despesa | Preservar veículo e item selecionado; separar ação de manutenção da ação financeira e explicitar se bloqueio já foi salvo. |
| Taxa ↔ adiantamento/reembolso/pagamento | Mostrar quem pagou/adiantou, o que falta acertar e o lançamento correspondente. |
| Parceiro ↔ matrículas/relatórios/cobranças | Preferir vínculo estável ao registro; busca por nome não deve ser o único meio de manter o contexto. Parceiro cadastrado não ganha acesso ao sistema. |
| Pendência/indicador ↔ registro/lista filtrada | Recuperar aba/filtros ao voltar; mostrar resolução após a mudança de origem e período de atualização. |

**Prevenção de clique acidental:** link navega, botão executa ação; não sobrepor alvos em cartões com várias ações, incluindo futuro botão de espaço padrão nos cartões de [Meus espaços](../apps/web/src/pages/organizations/OrganizationsPage.tsx). Links normais devem permitir abrir em outra aba; ações de concluir, receber, estornar e arquivar não devem disparar ao tentar abrir um detalhe.

## 7. Checklist de lançamento por prioridade

As caixas representam **aceite ainda a verificar**, não uma declaração de que toda capacidade está ausente. Este checklist cobre UX/UI e deve ser usado com os critérios técnicos de lançamento do [checklist principal](modulos-checklist.md).

### P0 — obrigatório para o MVP ir ao ar

- [ ] Validar os percursos F1/F2/F4/F5 com os papéis atuais, incluindo autônomo proprietário; hierarquia básica do menu e próxima ação são compreensíveis (UI-01/UI-02).
- [ ] Garantir cobrança do pacote exato com dois pacotes na mesma matrícula e duplicidade tratada pelo lançamento existente (UX-01).
- [ ] Corrigir indicador de exames limitado à amostra e conciliar os demais indicadores com unidade/filtro do destino (UX-02).
- [ ] Eliminar atalhos negados ao instrutor e vazamento por links, documento, recibo, alerta e exportação (UX-03 e matriz atual).
- [ ] Distinguir parcela quitada, liquidação pendente e valor disponível; corrigir texto de recibo/estorno conforme a direção (UI-07/UX-04).
- [ ] Informar atualização/falha de dados financeiros e de agenda sem exibir silenciosamente resultado anterior como novo (UX-05).
- [ ] Preservar dados após erro; confirmar descarte em formulários; validar dinheiro e apontar campos/linhas incorretos (UI-06/UX-06).
- [ ] Homologar conflitos e concorrência de aula/exame/aluno/instrutor/veículo, inclusive manutenção, com recuperação do formulário e nenhuma dupla reserva.
- [ ] Homologar consulta do aluno, aula e baixa em celular/desktop, teclado, foco e temas; informação essencial não depende de rolagem horizontal (UI-05).
- [ ] Executar o teste ponta a ponta de quatro parcelas, baixa dividida, despesa, transferência e estorno com saldos conciliados e permissões reais, além dos testes da API.

### P1 — importante para a próxima etapa

- [ ] Espaço padrão, ordem/ocultação/fixação pessoal de módulos e restauração com perda de acesso tratada (NAV-02/03 e UX-09).
- [ ] Pré-seleções úteis e consulta antecipada de disponibilidade no agendamento, com validação final da API (UX-07).
- [ ] Encaminhamento independente de aluno ao instrutor após decidir escopo, responsabilidades e dados (F3/UX-08).
- [ ] Divulgação progressiva de filtros, parcelamento e cadastros; navegação financeira no celular (UI-03/UI-04/UI-08).
- [ ] Retorno ao contexto exato em recibos, cobrança, manutenção e pendências; filtros preservados (UX-10/UX-11).
- [ ] Retomar formulários após reautenticação e isolar preferências/sugestões entre usuários do mesmo navegador.
- [ ] Revisar amplitude do acesso financeiro da secretaria; se houver restrição, especificar e implementar capacidades reais na API.
- [ ] Atualizar documentação e primeiros passos para refletir os módulos entregues (UX-12).

### P2 — melhorias futuras

- [ ] Rascunho persistente e sincronizado de tarefas longas, com retenção/limpeza definidas e sem recuperar dados de acesso revogado.
- [ ] Busca global com resultados por registro/espaço e permissão aplicada.
- [ ] Sincronização de preferências entre dispositivos e refinamento de atalhos a partir do piloto, com alteração explícita pelo usuário.
- [ ] Planejar UX de Vendas e atendimento, app mobile e canais externos somente em suas etapas próprias; não usá-los como telas atuais nem bloqueadores deste MVP.

## 8. Critérios verificáveis de rapidez, compreensão e recuperação

### 8.1. Protocolo de teste proposto

Testar com cinco participantes de cada perfil, incluindo instrutores autônomos e pessoas com pouca familiaridade digital; cada tarefa é avaliada somente por perfis autorizados. Usar instrução em linguagem cotidiana, sem indicar onde clicar. Registrar sucesso sem ajuda, tempo, ações, erros, desistências e explicação do participante sobre o resultado. Para cada tarefa, comparar a nova experiência com a versão atual e, quando comparável, papel/planilha; as metas abaixo são propostas, não resultados medidos.

Usar os mesmos dados e condições em 360 px e desktop, com teclado virtual e físico. Contar interação principal como abrir etapa/selecionar registro/confirmar ação; digitação de um campo conta como um preenchimento, independentemente do número de caracteres. Não aumentar passos só para atingir um número artificial de telas ou confirmações.

| Caso | Tarefa/cenário | Critério de aceite proposto |
| --- | --- | --- |
| T01 | Identificar espaço, papel e próxima aula | 5/5 identificam corretamente; até 30 s após entrar, sem ajuda. |
| T02 | Cadastrar aluno com nome/telefone e seguir atendimento | Pelo menos 4/5 dos operadores autorizados concluem em até 90 s; ninguém duplica aluno já identificado; erro de envio preserva o preenchimento. |
| T03 | Agendar aula por matrícula já existente | Pelo menos 4/5 em até 90 s e até seis interações principais após abrir o formulário; dados corretos no detalhe salvo. |
| T04 | Agendar a partir da agenda com aluno ainda não escolhido | Pelo menos 4/5 em até 150 s; caso com duas matrículas não induz categoria errada. |
| T05 | Duas pessoas tentam reservar recurso no mesmo intervalo | Uma gravação no máximo quando houver sobreposição; recusada mantém dados e explica providência; intervalos adjacentes válidos continuam permitidos. Incluir aula versus exame e manutenção. |
| T06 | Consultar aluno: aulas feitas, saldo de minutos, liberação, documentos e pendências | Pelo menos 4/5 encontram cada dado permitido em até 45 s e distinguem saldo de aulas de dinheiro a receber. Instrutor não acessa documentos/preço/CPF por atalho ou URL. |
| T07 | Encaminhar sem marcar aula, quando F3 existir | Pelo menos 4/5 da secretaria em até 60 s; todos entendem que nenhum horário foi reservado; instrutor encontra encaminhamento e próxima ação em até 30 s. |
| T08 | Dois pacotes, cobrar o mais antigo e depois o recente | Origem, valor e pagador corretos em 100% dos casos; repetir envio não duplica; o primeiro pacote não usa referência do segundo (UX-01). |
| T09 | Receber parcela de R$ 250 com R$ 100 em dinheiro e R$ 150 em Pix | Pelo menos 4/5 em até 120 s; contas e formas corretas, restante zero e uma baixa por linha. Caso simples integral: até 60 s. |
| T10 | Registrar cartão/boleto com liquidação futura | 5/5 distinguem parcela quitada de dinheiro disponível; extrato só mostra movimento na confirmação; repetição não duplica. |
| T11 | Pagar despesa, imprimir recibo e estornar com papel autorizado | Texto identifica saída e fornecedor; estorno explica retorno à conta; histórico preservado; staff não estorna nem por URL; retorno abre Despesas/origem. |
| T12 | Indicador com oito exames futuros | Indicador mostra oito; amostra pode mostrar cinco, identificada como amostra; destino filtrado e total são coerentes. Verificar também saldo baixo e unidade aluno/matrícula. |
| T13 | Colocar veículo em manutenção e tratar aula afetada | Todos identificam bloqueio e aula/exame; trocar recurso revalida conflito; gerar despesa não duplica e não libera a agenda automaticamente. |
| T14 | Personalizar menu, definir padrão e perder acesso | Pelo menos 4/5 restauram menu e alteram padrão sem ajuda; todos distinguem preferência de permissão; acesso revogado leva a destino válido sem expor dados. |
| T15 | Falha 422, conflito 409, rede sem resposta, 403 e sessão expirada | Nenhum reenvio duplica aula/cobrança/baixa; erro informa correção; dados não são descartados sem decisão; reautenticação recupera só o que continuar autorizado. |

### 8.2. Volume, acessibilidade e desempenho

**Cenários de dados propostos:** semana com mais de 100 aulas, aluno com várias matrículas e histórico longo, mais de uma página financeira, oito exames futuros, dois pacotes não cobrados, processos AB com desfechos diferentes e quatro papéis em CFC/espaço particular. Confirmar com o piloto qual volume representa a operação real antes de assumir capacidade de produção.

**Metas iniciais propostas para homologação:** resposta visual de clique/digitação em até 200 ms; conteúdo principal de lista/agenda e resultado de gravação em até 2 s no percentil 95, sob rede de teste documentada (por exemplo, 10 Mb/s e latência de 100 ms). Medir antes de fixar esses limites como compromisso de produto. Carregamentos maiores exigem estado perceptível, preservação de dados e prevenção de envio repetido; atualização não deve parecer tela vazia ou resultado definitivo antigo.

**Aceites adicionais:** percurso inteiro por teclado, foco no modal/erro e retorno ao disparador; anúncio de sucesso/erro e estado pendente por leitor de tela; nenhum controle principal cortado em 360 px ou com zoom de 200%; conferência em aparelho real. [fetchAllPages](../apps/web/src/api/paginate.ts) é sequencial e tem teto: medir espera e cobertura em volume, sem calcular saldo ou disponibilidade a partir de conjunto incompleto. [QueryState](../apps/web/src/components/QueryState.tsx) deve diferenciar vazio, falta de acesso, falha inicial e falha de atualização.

## 9. Melhorias priorizadas por impacto e esforço

Estimativas qualitativas para planejamento, sem compromisso de prazo. **Baixo:** ajuste localizado; **médio:** várias telas/estado compartilhado; **alto:** novo fluxo, regra de acesso ou consulta de disponibilidade. Prioridade considera erro operacional e confiança, além de cliques economizados.

| Ordem | Melhoria e referência | Impacto | Esforço | Prioridade |
| --- | --- | --- | --- | --- |
| 1 | Cobrar o pacote realmente selecionado (UX-01/F4) | Alto: evita origem/duplicidade incorreta | Baixo a médio | P0 |
| 2 | Mostrar liquidação pendente e direção correta de recibo/estorno (UI-07/UX-04) | Alto: evita interpretação errada do caixa | Médio | P0 |
| 3 | Consertar total/amostra e filtros dos indicadores (UX-02) | Alto: confiança nos números | Baixo a médio | P0 |
| 4 | Remover links negados ao instrutor e validar destinos por perfil (UX-03) | Alto: evita bloqueio no trabalho diário | Baixo | P0 |
| 5 | Informar atualização/erro e preservar formulários/valores (UX-05/UX-06/UI-06) | Alto: evita retrabalho e ação sobre contexto incorreto | Médio | P0 |
| 6 | Enxugar hierarquia diária e resumo de aluno/matrícula (UI-01/UI-02) | Alto: reduz procura e sobrecarga | Médio | P0 |
| 7 | Homologar operação crítica em celular e teclado (UI-05/T03/T09/T15) | Alto: viabiliza uso diário | Médio | P0 |
| 8 | Pré-seleções e busca de aluno/matrícula mais curta (UX-07/F1/F2) | Alto: acelera cadastro e agendamento | Médio | P1 |
| 9 | Espaço padrão e menu pessoal com isolamento por usuário (UX-09/NAV-02) | Médio a alto: reduz navegação recorrente | Médio | P1 |
| 10 | Retorno à origem e vínculo ao registro financeiro exato (UX-10/UX-11) | Médio a alto: mantém atendimento | Médio | P1 |
| 11 | Reduzir opções iniciais de filtros/parcelamento/cadastros (UI-03/UI-04/UI-08) | Médio: facilita trabalho leigo | Médio | P1 |
| 12 | Alinhar documentação e primeiros passos (UX-12) | Médio: reduz orientação contraditória | Baixo | P1 |
| 13 | Encaminhamento independente e revisão de capacidades da secretaria (UX-08/F3) | Alto: separa responsabilidades | Alto | P1 |
| 14 | Sugestões de disponibilidade com todas as restrições de agenda (F2) | Alto: reduz tentativas por conflito | Alto | P1 |
| 15 | Busca global, preferências sincronizadas e rascunho persistente | A validar no piloto | Alto | P2 |

## 10. Pontos em aberto e rastreabilidade da análise

### 10.1. Decisões que não podem ser presumidas

- Modelo de encaminhamento (F3) e quem efetivamente negocia/agenda depois que o instrutor recebe o aluno. O papel `instructor` hoje não agenda; não conceder essa capacidade implicitamente.
- Necessidade de restringir leitura/baixa de partes do financeiro para determinadas secretarias; hoje o papel permite operação ampla.
- Preferências apenas neste navegador ou sincronizadas; recuperação de formulários após sessão expirada, prazo de retenção e tratamento de dados sensíveis.
- Ordem de destinos por perfil e frequência real das tarefas; metas de tempo e volume precisam do piloto.
- Aparência, foco, contraste, comportamento com teclado virtual, desempenho e concorrência real: requerem execução/homologação, não foram comprovados por esta revisão estática.

### 10.2. Arquivos analisados

Os links nas seções anteriores localizam cada problema. Relação abaixo distingue leitura dos arquivos centrais de inspeção dirigida de trechos/declarações. Caminhos de `app/` são relativos a `apps/api/`; demais grupos abaixo são relativos a `apps/web/src/`, salvo indicação.

| Grupo | Arquivos lidos nesta revisão |
| --- | --- |
| Documentação e escopo | `AGENTS.md`, `.claude/skills/gitnexus-exploring/SKILL.md`, `docs/requisitos-ux-ui.md` anterior, `docs/README.md`, `docs/permissoes.md`, `docs/modulos-checklist.md`; trechos de `docs/notificacoes.md`, `apps/api/docs/implementacao.md`, `apps/api/docs/lacunas-mvp-api.md`. Identidade e arquitetura também foram consideradas a partir da leitura na análise anterior e das referências atuais. |
| Navegação e preferências | `config/routes.tsx`, `layouts/OrganizationLayout.tsx`, `pages/finance/FinanceLayout.tsx`, `pages/organizations/OrganizationsPage.tsx`, `pages/settings/SettingsPage.tsx`, `lib/preferencesStorage.ts`, `utils/financeLastUsed.ts`, `config/finance.ts`, `styles/_layout.scss`. |
| Cadastros e agenda | `pages/students/StudentFormPage.tsx`, trechos do detalhe/resumo do aluno; `pages/schedule/LessonFormPage.tsx`, `components/EnrollmentPicker.tsx`, `pages/enrollments/BalancePanel.tsx`, `pages/enrollments/EnrollmentFinancePanel.tsx`, `hooks/useStudentHistory.ts`, `api/{lessons.ts,me.ts,paginate.ts}`, `pages/partners/PartnerFormPage.tsx`. |
| Financeiro | `pages/finance/{EntriesPage.tsx,EntryFormModal.tsx,PayModal.tsx,EntryDetailModal.tsx,OverviewPage.tsx,AccountsPage.tsx,ChargeModal.tsx,ReceiptPage.tsx}`, trechos de `SetupPage.tsx` e `AccountModals.tsx`; `hooks/useFinance.ts`; `api/client.ts`, `api/errors.ts`, `lib/queryClient.ts`. |
| Operação e consultas | `pages/organization/OrganizationHomePage.tsx`, `pages/reports/ReportsPage.tsx`, `pages/alerts/AlertsPage.tsx`, `utils/alertPath.ts`, `pages/availability/AvailabilityPage.tsx`, `components/{AffectedModal.tsx,QueryState.tsx,QueryErrorAlert.tsx,OnboardingGuide.tsx}`, trechos de `CommitmentList.tsx`, `pages/instructors/InstructorAvailabilityPanel.tsx`, `pages/exams/{ExamsPage.tsx,ExamFormModal.tsx,ExamDetailPage.tsx,FeesPanel.tsx}`, `pages/processes/{ProcessDetailPage.tsx,OutcomePanel.tsx}`, `pages/vehicles/VehicleFleetPanel.tsx`. |
| API e cenários | `app/Services/{AssignmentScope.php,SchedulingConstraints.php,InstructorAvailability.php}`, trechos de `app/Actions/Lessons/ScheduleLesson.php`; `app/Services/Finance/{FinanceAccess.php,FinanceService.php,FinanceAlerts.php}`, `app/Services/Reports/Dashboard.php`, `app/Models/Alert.php`, `app/Http/Controllers/Api/V1/Finance/IntegrationController.php`, trechos de `CatalogController.php`; cenários/asserções pertinentes de `tests/Feature/Api/{FinanceTest.php,ReportTest.php}`. |
| Verificação de inventário | Lista de páginas, controllers, services, policies e documentação; alterações de arquivos desde `2f8baea`; manifesto `apps/web/package.json`. Arquivos citados como contexto da base (por exemplo, `AppLayout`, `DataTable`, `LessonDetailPage`, `AvailabilityGuard`) também foram inspecionados na análise anterior; não houve nova homologação de execução. |

**GitNexus:** repositório vinculado `auto escola`, atualizado com `node .gitnexus/run.cjs analyze --index-only`; recurso de contexto confirmou commit `e9e95d7`, 641 arquivos, 7.312 símbolos e 432 fluxos. Foram consultados conceitos e símbolos de financeiro, cobrança, relatórios, atribuição e disponibilidade, incluindo `FinanceAccess`, `FinanceService`, `EnrollmentFinancePanel` e `AssignmentScope`, e o fluxo `SetupPage → Base`. O analisador informou limites na enumeração de fluxos e resolução entre linguagens; por isso ausência no grafo não foi usada como prova de inexistência. As afirmações específicas foram conferidas no código e nas rotas. A atualização do índice não alterou fontes da aplicação.
