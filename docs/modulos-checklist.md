# Checklist de módulos — MVP web

Análise da base em **17/10/2026**. Este é o checklist principal do produto até o lançamento do MVP **web**, atendendo CFCs e instrutores autônomos. Cada entrega inclui a API necessária e a experiência completa em `apps/web`.

**Próximo módulo recomendado: Disponibilidade e frota (módulo 4).** Os módulos 1 a 3 (saldo, exames/taxas e desfecho/histórico) foram implementados na API e no web em 17/10/2026. A concorrência real com processos simultâneos e a homologação por papel no navegador continuam nos critérios de lançamento da seção 12.

**Ordem definida:** saldo → exames e taxas → desfecho e histórico → disponibilidade e frota → alertas → acesso e acabamento → relatórios → financeiro básico. **O financeiro é o último módulo do MVP.** Depois do MVP entram **Vendas e atendimento** e, em uma etapa própria posterior, o aplicativo mobile.

Os antigos checklists de telas web foram concluídos e removidos. A existência dessas telas compõe a base abaixo; a homologação completa para lançamento continua sendo um critério próprio.

## 1. O que significa MVP completo

O gestor deve conseguir receber um aluno pronto para a prática, cadastrar sua contratação, conferir pendências, controlar aulas e saldo, acompanhar exames por categoria e a emissão do documento, consultar relatórios e registrar entradas e saídas reais. O autônomo deve conseguir fazer isso no seu espaço, com visão por CFC parceiro quando necessário.

O primeiro lançamento cobre a **gestão da etapa prática e seu desfecho**. Não promete executar serviços oficiais do Detran, ministrar teoria nem gerenciar todos os serviços possíveis de habilitação. O acompanhamento oficial continua manual, com origem e evidência.

Legenda:

- `[x]`: capacidade existente no código, com a ressalva indicada quando parcial.
- `[ ]`: TODO necessário para concluir o módulo ou validar o lançamento.
- **Fora do MVP**: planejamento posterior; não bloqueia o lançamento web.

Um módulo só fica concluído quando seus itens pendentes tiverem implementação na API e no web, permissões, validações, estados de carregamento/vazio/erro e verificação do fluxo completo. Tela criada ou endpoint isolado não concluem o módulo.

## 2. Diagnóstico do sistema atual

Foram analisados rotas, páginas, clientes HTTP e hooks do web; models, migrations, requests, policies, actions, services e testes da API; infraestrutura local e documentação.

### Base já implementada

- [x] Conta: cadastro, login, logout, sessão por cookie, confirmação e reenvio de e-mail, rotas protegidas e tratamento de sessão expirada.
- [x] Espaços CFC e particular: criação, seleção, dados, endereço e fuso horário.
- [x] Equipe: papéis `owner`, `admin`, `staff`, `instructor`, membros, convites, aceite e proteção do último proprietário.
- [x] Instrutor: identidade global, cadastro sem conta, perfil próprio e vínculo profissional por espaço.
- [x] Alunos e parceiros: cadastro, listagem, busca, edição e isolamento por espaço.
- [x] Matrículas: categoria, parceiro, processo opcional, situação comercial, minutos contratados e preço; no web a alteração posterior se concentra na situação.
- [x] Processos: cadastro, listagem, situação e checklist de liberação para a prática; há complementos de edição e evidência previstos no módulo 6.
- [x] Documentos: upload, consulta, conferência e download privados no web; a API também oferece substituição com histórico de versões e vínculo a processo/veículo.
- [x] Veículos: cadastro, edição, categoria, adaptações, ativo/inativo e vencimento do CRLV.
- [x] Agenda: dia/semana, agendamento, remarcação e conflitos de instrutor, aluno e veículo.
- [x] Execução: realização/falta/cancelamento, duração real, evolução e registro oficial manual com referência ou documento.
- [x] Minha agenda: aulas do próprio instrutor nos espaços aos quais tem acesso, sem duplicação.
- [x] Interface: tema claro/escuro, formulários, tabelas responsivas, paginação nas listagens principais e estados de consulta.
- [x] Avisos visuais: toasts, sino e alerta máximo; preferências locais por usuário. Os alertas operacionais persistentes ainda não existem.
- [x] Infraestrutura local e dados de demonstração; suíte automatizada da API.

### Lacunas encontradas no código

| Constatação                                                                                                                      | Evidência                                                                                                                                                              | Consequência para o MVP                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Minutos e preço são campos de cadastro; não há movimentação de créditos                                                          | [EnrollmentController](../apps/api/app/Http/Controllers/Api/V1/EnrollmentController.php), [ChangeLessonStatus](../apps/api/app/Actions/Lessons/ChangeLessonStatus.php) | Construir pacotes, saldo e consumo antes de cobrar por eles.                               |
| Não há modelos/rotas de exames, taxas externas, caixa ou relatórios                                                              | [Rotas da API](../apps/api/routes/api.php), [rotas web](../apps/web/src/config/routes.tsx)                                                                             | Exigem entregas completas de API e web.                                                    |
| A página inicial ainda é um protótipo, com contadores `—`                                                                        | [OrganizationHomePage](../apps/web/src/pages/organization/OrganizationHomePage.tsx)                                                                                    | Entregar painel com dados reais no módulo de relatórios.                                   |
| O sino guarda dados apenas em memória e não recebe eventos reais da operação                                                     | [notificationStore](../apps/web/src/stores/notificationStore.ts), [documentação dos avisos](notificacoes.md)                                                           | Persistir notificações, gerar pendências e resolver sua leitura por usuário/espaço.        |
| Agenda do espaço, agenda pessoal e histórico de aulas consultam até 100 registros; há consultas auxiliares só da primeira página | [lessons.ts](../apps/web/src/api/lessons.ts), [me.ts](../apps/web/src/api/me.ts), [useStudentHistory](../apps/web/src/hooks/useStudentHistory.ts)                      | Evitar agenda/histórico incompletos; nunca calcular total ou saldo a partir de uma página. |
| A API edita dados de matrícula/processo e substitui documentos; o web expõe apenas parte dessas operações                        | [enrollments.ts](../apps/web/src/api/enrollments.ts), [processes.ts](../apps/web/src/api/processes.ts), [documents.ts](../apps/web/src/api/documents.ts)               | Completar correções e anexação de evidências na interface.                                 |
| CRLV e situação do veículo são conferidos ao agendar/remarcar; aulas existentes não são reavaliadas na conclusão                 | [SchedulingConstraints](../apps/api/app/Services/SchedulingConstraints.php), [ChangeLessonStatus](../apps/api/app/Actions/Lessons/ChangeLessonStatus.php)              | Mostrar compromissos afetados e tratar impedimentos sem apagar histórico.                  |
| Liberação verifica a situação dos itens, sem checar a validade dos documentos associados                                         | [PracticeRelease](../apps/api/app/Services/PracticeRelease.php), [QualificationProcess](../apps/api/app/Models/QualificationProcess.php)                               | Definir validade e revalidação operacional; upload não equivale a liberação.               |
| Não há recuperação de senha, trilha geral de auditoria nem teste de concorrência real                                            | [Rotas da API](../apps/api/routes/api.php), [implementação da API](../apps/api/docs/implementacao.md)                                                                  | Tratar acesso, rastreabilidade e concorrência antes do lançamento.                         |
| Infraestrutura disponível é local; faltam procedimentos versionados de produção e recuperação                                    | [docker-compose](../infra/docker-compose.yml)                                                                                                                          | Preparar implantação, backups, restauração e monitoramento em paralelo aos módulos.        |

### Verificação desta análise

| Verificação executada                                        | Resultado em 17/10/2026                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `php artisan test --compact` em `apps/api`                   | **152 testes, 584 asserções, aprovados**                                   |
| `pnpm --dir apps/web lint`                                   | Aprovado                                                                   |
| `pnpm --dir apps/web build`                                  | Aprovado; avisos de depreciação Sass/Bootstrap e pacote JS acima de 500 kB |
| Homologação por papel no navegador e implantação de produção | Não executadas nesta análise; permanecem no checklist de lançamento        |

Esses resultados verificam a base atual. Não significam que os módulos planejados estejam implementados nem que o MVP já esteja pronto. Não há script de testes automatizados do web no `package.json` atual.

## 3. Sequência de entrega

| Ordem           | Módulo                                       | Estado atual                                      | Entrega que fecha a etapa                                                                                          |
| --------------- | -------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 0               | Base operacional web + API                   | Implementada, com lacunas listadas acima          | Preservar o que existe durante as próximas entregas.                                                               |
| 1               | **Pacotes e saldo de aulas**                 | Falta                                             | Contratação, reserva, consumo e extrato confiáveis por matrícula/percurso.                                         |
| 2               | **Exames práticos e taxas externas**         | Falta                                             | Agendamento, tentativas, resultado e evidências de taxas.                                                          |
| 3               | **Desfecho do processo e histórico**         | Parcial: situação editável e marca de conferência | Acompanhar aprovação, emissão e encerramento com rastreabilidade.                                                  |
| 4               | **Disponibilidade e frota**                  | Parcial: conflitos, CRLV e ativo/inativo          | Bloqueios de horário, manutenção e tratamento dos compromissos afetados.                                           |
| 5               | **Pendências e alertas reais**               | Parcial: componentes visuais                      | Central persistente com alertas úteis e acesso ao item que precisa de ação.                                        |
| 6               | **Acesso, correções e acabamento web**       | Parcial                                           | Recuperação de conta, fluxos de edição completos e consultas sem truncamento.                                      |
| 7               | **Relatórios e painel de gestão**            | Falta; início ainda é protótipo                   | Dados reais, filtros, totais consistentes e exportação operacional.                                                |
| 8               | **Financeiro básico — último módulo do MVP** | Falta                                             | Receitas/despesas, parcelas, formas de pagamento, contas bancárias/caixa, transferências e relatórios financeiros. |
| Após o MVP      | **Vendas e atendimento**                     | Futuro                                            | Organizar interessados, próximos contatos, propostas e conversão em matrícula.                                     |
| Etapa posterior | **Aplicativo mobile**                        | Fora deste checklist                              | Planejamento próprio após a conclusão do web.                                                                      |

A preparação de produção e os testes de lançamento acontecem ao longo das entregas. A conferência final após o financeiro não é um novo módulo. Relatórios operacionais vêm antes dele; os indicadores financeiros entram junto com o módulo 8, quando houver dados reais.

## 4. Módulo 1 — Pacotes e saldo de aulas

**Objetivo:** a equipe saber o que foi contratado, o que já foi utilizado e o que ainda está disponível, sem depender de planilha. Não implementar recebimentos ou caixa nesta etapa.

- [x] Registrar contratações e acréscimos de aulas/minutos por matrícula, com descrição, quantidade, duração de referência e valor em centavos quando houver.
- [x] Separar minutos contratados, reservados em aulas agendadas, realizados, consumidos comercialmente e disponíveis. Apresentar a equivalência em aulas somente com duração explícita.
- [x] Manter extrato de créditos, reservas, consumo, liberação e ajustes, com origem, data, responsável e motivo. Saldo deve ser calculado pela API sobre todos os movimentos.
- [x] Concluir uma aula gerar um único consumo transacional. Repetição, duplo clique e duas requisições concorrentes nunca podem descontar duas vezes.
- [x] Definir por contratação a política de falta e cancelamento, inclusive aviso prévio quando usado. Falta cobrada pode consumir crédito, mas nunca soma minutos de instrução realizada.
- [x] Cancelamento liberar a reserva; remarcação transferir a reserva sem duplicá-la. Estorno de consumo existente deve gerar movimento compensatório, preservando o original.
- [x] Ajuste de duração de aula já realizada recalcular o consumo conforme a política acordada, com diferença rastreável; proibir alteração silenciosa do extrato.
- [x] Definir o comportamento para saldo insuficiente, aula avulsa e matrícula sem pacote: aviso, bloqueio ou exceção autorizada com motivo. Pendência comercial não dispensa liberação para prática.
- [x] Tratar A/B separadamente em contratações simultâneas, compatibilizando matrículas AB existentes sem duplicar o processo nem transferir créditos entre categorias sem registro.
- [x] Preparar a entrada dos dados atuais: como aproveitar `contracted_minutes`, aulas realizadas/faltas e agendamentos existentes sem conceder ou consumir créditos em duplicidade; registrar saldo inicial conciliado.
- [x] Entregar no web contratação/acréscimo, resumo e extrato na matrícula, saldo no aluno e informação de disponibilidade ao agendar/concluir; limitar ajustes à equipe autorizada.
- [x] Verificar consumo, falta conforme contrato, cancelamento, acréscimo, ajuste, concorrência e isolamento entre espaços; conferir o mesmo saldo na API, aluno e matrícula.

**Implementação:** livro-razão append-only (`enrollment_credit_entries`) com chave de deduplicação por aula, pacotes com política de consumo/falta/cancelamento, saldo por categoria em matrículas AB, conciliação dos dados antigos na migration `500005` e estorno/ajuste só para proprietário e gestor. Testes: `CreditBalanceTest`.

**Aceite:** contratar 500 minutos, reservar 100 e realizar uma aula de 50 deve explicar cada parcela do saldo e manter o mesmo resultado após recarregar a página ou repetir a requisição.

## 5. Módulo 2 — Exames práticos e taxas externas

**Objetivo:** acompanhar cada tentativa e seus documentos, sem tratar aprovação como emissão nem comprovante como confirmação automática.

- [x] Criar tentativas por processo, percurso/categoria e matrícula quando aplicável, com número, data/hora no fuso do espaço, local, protocolo, observações e anexos privados.
- [x] Separar agendado, cancelado/remarcado, aprovado, reprovado, ausente e não concluído. Definir transições e resultado por tentativa; ausência não é reprovação.
- [x] Remarcar preservando data/local anteriores; nova tentativa de exame não pode sobrescrever a tentativa anterior nem duplicar a numeração por concorrência.
- [x] Registrar veículo e instrutor responsáveis quando houver; reservar sua janela de indisponibilidade e considerar conflitos com aulas e outros exames, inclusive entre espaços para o instrutor, sem revelar dados externos.
- [x] Exibir pendências para exame conforme processo e conferência aplicável. Não inventar mínimo nacional de aulas, prazo de reteste ou reconhecimento oficial automático.
- [x] Criar taxas externas por processo e/ou tentativa: tipo, guia, valor emitido, emissão, vencimento, pagador, referência e comprovante; permitir várias taxas por tentativa sem contar duas vezes uma taxa compartilhada.
- [x] Diferenciar situação desconhecida, pendente, pagamento informado, confirmado, isenta com motivo e cancelada. Registrar quem conferiu, quando e a fonte da confirmação.
- [x] Separar responsável pela obrigação, quem efetivamente pagou e eventual adiantamento/reembolso a acertar no financeiro. Pagamento direto pelo aluno ao órgão não entra no caixa do CFC.
- [x] Entregar agenda/lista de exames, cadastro, remarcação, resultado, histórico de tentativas e taxas no aluno/processo, com busca e filtros de período, categoria e situação.
- [x] Restringir taxas e documentos à equipe; definir o resumo operacional necessário ao instrutor responsável, sem expor laudos, caixa ou exames de colegas.
- [x] Verificar processo AB com resultados diferentes em A/B, remarcação, ausência, taxa compartilhada, comprovante sem confirmação e isolamento por espaço.

**Implementação:** tentativas numeradas por processo+categoria (`practical_exams`), remarcação com histórico, conflitos de instrutor/veículo/aluno com aulas e exames (inclusive entre espaços), taxas externas (`external_fees`) sem efeito em caixa, anexos privados e resumo restrito ao instrutor. Testes: `PracticalExamTest`.

**Aceite:** registrar reprovação em B, manter o histórico, contratar aula adicional e registrar nova tentativa aprovada, sem alterar o resultado de A nem gerar receita fictícia pelas taxas.

## 6. Módulo 3 — Desfecho do processo e histórico

**Objetivo:** responder em qual etapa o aluno está, o que falta e quem alterou informações importantes.

- [x] Separar situação comercial da matrícula, liberação para prática, resultado por categoria e situação da emissão. Cada uma precisa ter regra e apresentação próprias.
- [x] Acompanhar aprovado com emissão pendente, documento emitido/disponível e entrega quando aplicável, com datas, referências e evidências privadas. Distinguir PPD/CNH e modalidade do documento conforme o caso.
- [x] Tratar AB com A aprovada e B pendente/reprovada, sem encerrar o processo inteiro; registrar eventual renúncia e sua confirmação separadamente.
- [x] Definir regras para conclusão, encerramento, desistência e reabertura com motivo, permissões e tratamento de aulas futuras, créditos e obrigações ainda abertas.
- [x] Manter acompanhamento de futura definitiva como pendência quando aplicável, sem exigir que o aluno conclua esse prazo posterior para o sistema poder ser lançado.
- [x] Registrar eventos do processo: mudanças de situação, conferência, resultado, correção, referência de transferência e encerramento. Guardar autor, data, motivo e alterações relevantes.
- [x] Criar trilha de auditoria das ações críticas da base: papel/acesso, convite, vínculo, contratação/saldo, aula, registro oficial, documento e resultado. Incluir eventos financeiros quando o módulo 8 entrar.
- [x] Corrigir dados por operação explícita, preservando versões e movimentos anteriores; definir como mudanças de categoria, parceiro ou processo de matrícula com histórico afetam saldo e exames.
- [x] Oferecer no aluno/processo uma linha do tempo paginada e um resumo do próximo passo, com as informações filtradas conforme o papel.
- [x] Verificar aprovação sem emissão, AB parcial, correção de resultado, encerramento com pendências e consulta após revogar o acesso de um membro.

**Implementação:** resultado por categoria derivado dos exames, emissão (pendente/emitido/entregue, PPD/CNH), renúncia separada da confirmação, conclusão/encerramento/reabertura com conferência de pendências, trilha `audit_events` append-only com linha do tempo por aluno/processo e tela de auditoria (proprietário/gestor). Testes: `ProcessOutcomeTest`.

**Aceite:** conseguir reconstruir o percurso do aluno e explicar cada alteração importante sem consultar logs técnicos ou perder tentativas anteriores.

## 7. Módulo 4 — Disponibilidade e frota

**Objetivo:** a agenda respeitar indisponibilidades reais de instrutor e veículo, além dos conflitos entre aulas já existentes.

- [ ] Cadastrar bloqueios por período para veículo e instrutor, com início/fim, motivo e responsável: manutenção, ausência, férias ou indisponibilidade pontual.
- [ ] Distinguir bloqueio local do espaço e indisponibilidade pessoal do instrutor entre espaços; preservar acesso e privacidade ao consultar conflitos.
- [ ] Definir horário de atendimento e disponibilidade recorrente básica, ou uma regra explícita de agenda livre com bloqueios; mostrar essa regra no web.
- [ ] Aplicar bloqueios no agendamento e remarcação de aulas e exames, com proteção contra concorrência e mensagens que indiquem como resolver o problema.
- [ ] Ao bloquear recurso, desativar vínculo ou alterar validade documental, listar compromissos futuros afetados e permitir providências explícitas. Não cancelar silenciosamente.
- [ ] Revalidar impedimentos operacionais relevantes na execução, incluindo documento de liberação vencido e veículo impedido; distinguir pré-reserva de prática liberada.
- [ ] Registrar manutenção: tipo, data, oficina/fornecedor, quilometragem quando informada, custo estimado/real, documento e próxima revisão por data ou km.
- [ ] Associar manutenção a bloqueio de agenda quando necessário; registrar liberação após o serviço e alertar para próxima revisão sem exigir telemetria.
- [ ] Entregar detalhe do veículo com documentos/versões, bloqueios, manutenções e aulas/exames afetados, além de visão de disponibilidade do instrutor.
- [ ] Preparar referência única da manutenção para futura conta a pagar; somente no módulo 8 integrar despesas, impedindo lançamento duplicado.
- [ ] Verificar bloqueio sobre aula existente, documento vencendo após agendamento, manutenção encerrada, instrutor em dois CFCs e conflito de aula com exame.

**Aceite:** colocar um veículo em manutenção expor as aulas afetadas e impedir novas reservas conflitantes até sua liberação, mantendo o histórico.

## 8. Módulo 5 — Pendências e alertas reais

**Objetivo:** transformar o sino existente em uma ferramenta para acompanhar o que precisa de ação.

- [ ] Persistir notificações e leitura por usuário, com organização, assunto, referência do recurso, data, prioridade e link para a ação.
- [ ] Gerar alertas de documento/CRLV a vencer ou vencido, manutenção próxima, recurso bloqueado com compromisso futuro e pendência de liberação.
- [ ] Incluir exames próximos, resultado ainda não informado, taxa pendente e emissão aguardando conferência.
- [ ] Incluir saldo baixo/esgotado, aulas agendadas no passado sem desfecho e aluno em atendimento sem aula há prazo configurado.
- [ ] Definir antecedência, destinatários e deduplicação por evento/prazo; resolver ou atualizar o alerta quando a pendência mudar.
- [ ] Integrar a API ao sino: paginação, não lidas, marcar uma/todas como lidas e arquivar. Persistir o estado ao recarregar ou trocar de navegador.
- [ ] Preservar o isolamento por espaço e o escopo do instrutor; revogação de acesso também deve retirar acesso às notificações e aos links correspondentes.
- [ ] Executar geração periódica com agendador/fila e rotina de reprocessamento, sem depender de alguém abrir a tela para descobrir vencimentos.
- [ ] Definir preferências e uso de toast/alerta máximo com a base existente; lembretes comuns não devem bloquear a operação.
- [ ] Acrescentar contas vencidas/a vencer somente ao entregar o financeiro no módulo 8. Cobrança de assinatura do próprio sistema é outro assunto e fica fora deste MVP.
- [ ] Verificar persistência, evento repetido, mudança de prazo, pendência resolvida e leitura restrita aos destinatários autorizados.

**Aceite:** gerar uma pendência real, vê-la no sino após novo login, abrir o registro correto e resolver a pendência sem criar notificações repetidas.

Lembretes externos para alunos por WhatsApp, SMS, push e automações de e-mail ficam para depois. Convites e mensagens de acesso da conta continuam necessários.

## 9. Módulo 6 — Acesso, correções e acabamento web

**Objetivo:** fechar as lacunas dos fluxos existentes para que a equipe consiga operar sem intervenção no banco de dados.

- [ ] Entregar esqueci minha senha/redefinição: link temporário de uso único, formulário web, respostas que não revelem existência de conta, limitação de tentativas e verificação de expiração/reuso.
- [ ] Oferecer alteração da própria senha com confirmação da atual e definir invalidação de outras sessões. Revisar para produção a política de senha hoje configurada com mínimo de 3 caracteres, registrando a decisão de produto.
- [ ] Completar edição dos dados permitidos de matrícula e processo, com proteção do histórico prevista nos módulos 1 e 3 e mensagens claras para dados imutáveis.
- [ ] Permitir adicionar exigência de checklist e selecionar/anexar evidência privada no próprio fluxo. Conferência deve continuar sendo uma ação separada do upload.
- [ ] Oferecer substituição de documento e consulta de versões na interface; concluir vínculo a processo/veículo, validade e tratamento amigável de arquivo indisponível.
- [ ] Resolver paginação de agendas, histórico do aluno/matrícula, documentos e seletores auxiliares. Uma lista acima de 100 itens deve continuar acessível e o resumo deve considerar o conjunto completo.
- [ ] Completar filtros de situação, período, categoria e parceiro onde fizerem parte do trabalho diário; manter busca e página ao voltar do detalhe.
- [ ] Oferecer arquivamento e recuperação dos cadastros que precisam sair da operação sem perder histórico; explicitar o que acontece com CPF/placa já usados e compromissos existentes.
- [ ] Traduzir validações do backend para português e padronizar mensagens, máscaras, datas, valores, confirmações e retorno de ações.
- [ ] Conferir navegação por teclado, foco em modais/erros, rótulos, contraste, temas e estados de carregamento/vazio/erro nas telas novas e existentes.
- [ ] Validar uso do site em desktop, tablet e navegador de celular, incluindo tabelas e formulários longos. Isso é responsividade web, sem antecipar desenvolvimento do aplicativo mobile.
- [ ] Definir comportamento de alteração simultânea e falha de rede nas operações críticas, evitando sobrescrita silenciosa, duplo envio e perda de dados preenchidos.
- [ ] Guiar primeiro acesso: criar espaço, completar dados, cadastrar/vincular instrutor, veículo, aluno e contratação; oferecer instruções curtas nos estados vazios e um canal de suporte.
- [ ] Conferir matrizes de permissão no web e na API; preço, documentos e dados de saúde não podem aparecer por atalhos, erros ou mudança de espaço.

**Aceite:** uma equipe nova consegue começar, corrigir seus cadastros, recuperar acesso e encontrar todo o histórico pelo web, sem intervenção técnica.

## 10. Módulo 7 — Relatórios e painel de gestão

**Objetivo:** entregar números em que o gestor confie antes de adicionar o financeiro.

- [ ] Substituir o início de protótipo por painel real: aulas do dia/semana, alunos em atendimento, pendências, saldo baixo e próximos exames, com atalhos para agir.
- [ ] Disponibilizar resumo do aluno: contratação, minutos reservados/realizados/consumidos/disponíveis, faltas, cancelamentos, evolução, exames e situação do processo/emissão.
- [ ] Relatar aulas por período, instrutor, veículo, categoria, situação e parceiro, distinguindo duração agendada, real e registro oficial confirmado.
- [ ] Relatar utilização e indisponibilidade de instrutores/veículos, incluindo manutenção e bloqueios, com definição explícita da base de cálculo.
- [ ] Relatar exames por categoria e tentativa: agendados, aprovados, reprovados, ausentes, não concluídos e resultado pendente; exibir numerador/denominador das taxas de aprovação.
- [ ] Relatar processos por etapa, pendência e tempo sem movimentação, além de documentos vencendo/vencidos e taxas externas por situação.
- [ ] Oferecer visão operacional por CFC parceiro para autônomos: alunos, aulas, minutos e exames. Receita/repasse só entram com o financeiro.
- [ ] Aplicar filtros na API, agregando todos os registros elegíveis; apresentar totais e detalhes que conciliem mesmo acima do limite de uma página.
- [ ] Padronizar período no fuso do espaço, data de referência, inclusão de cancelamentos e atualização dos dados; evitar contagem duplicada em AB e taxas compartilhadas.
- [ ] Exportar CSV completo conforme filtros e permissões, com texto acentuado, datas e valores utilizáveis em planilha; oferecer impressão legível do resumo do aluno pelo navegador.
- [ ] Restringir relatórios de gestão à equipe autorizada e dados pessoais ao necessário. Instrutor acessa somente o resumo próprio permitido; exportação não amplia acesso.
- [ ] Verificar totais com conjunto conhecido de dados, várias páginas, fronteira de dia/fuso, AB parcial, cancelamentos e isolamento entre espaços.

**Aceite:** partir de um indicador, abrir seus registros e exportar o mesmo conjunto com totais iguais. O painel deve mostrar dados reais, sem contadores ilustrativos.

## 11. Módulo 8 — Financeiro básico, último do MVP

**Objetivo:** um financeiro simples de usar e completo no básico: receitas, despesas, parcelas, várias formas de pagamento, contas bancárias e caixa, pagamentos parciais, transferências, estornos e relatórios. Controlar o que deve entrar/sair e o que efetivamente entrou/saiu, sem exigir conhecimento contábil. Relatórios e alertas financeiros são parte desta entrega final.

**Uso esperado no web:** visão geral, Receitas, Despesas, Contas e Movimentações, com ações diretas para lançar, parcelar, receber, pagar, transferir e consultar comprovantes. Forma de pagamento e conta são informações distintas: por exemplo, receber por Pix na conta bancária escolhida, ou em dinheiro no caixa.

- [ ] Definir permissões de leitura, lançamento, baixa e estorno. Proposta inicial: `owner`/`admin` gerenciam, `staff` recebe somente o acesso operacional decidido, `instructor` não acessa o caixa do espaço. Ser dono do espaço particular continua dando ao autônomo acesso à própria operação.
- [ ] Cadastrar categorias simples de receita e despesa, favorecidos/fornecedores e formas de pagamento, sem exigir módulos de compras ou contabilidade.
- [ ] Cadastrar várias contas bancárias e caixas por organização, com nome, instituição/dados de identificação opcionais, saldo inicial e sua data. Permitir inativar sem perder histórico; saldo inicial não é receita.
- [ ] Disponibilizar dinheiro, Pix, transferência, cartão de débito, cartão de crédito, boleto e outras formas cadastráveis. Registrar a forma e a conta de destino/origem em cada pagamento; não exigir integração bancária para lançar manualmente.
- [ ] Criar contas a receber de contratação, acréscimo ou serviço avulso, com descrição, categoria, pagador identificado, data, vencimento e vínculo à matrícula/parceiro quando aplicável.
- [ ] Parcelar receitas **e despesas**, informando total, quantidade, primeiro vencimento e periodicidade; permitir revisar datas/valores antes de salvar, numerar as parcelas e garantir que sua soma feche exatamente o total em centavos.
- [ ] Manter cada parcela com vencimento, situação e pagamentos próprios, ligada ao lançamento original; permitir consultar a contratação completa e localizar parcelas atrasadas ou futuras.
- [ ] Atender os dois modelos do autônomo: aluno paga diretamente ou CFC parceiro é o pagador. Separar quem recebe a aula de quem deve pagar.
- [ ] Registrar recebimentos reais por valor, data, forma, conta e referência; permitir baixa parcial, pagamento total e estorno, sem duplicar baixa por repetição ou concorrência.
- [ ] Permitir dividir o pagamento de uma parcela entre várias formas/contas, como parte em dinheiro e parte em Pix, e registrar pagamentos em datas diferentes; mostrar pago e restante sem contar duas vezes a mesma quitação.
- [ ] Registrar desconto, juros, multa e taxa de pagamento quando usados, com valor/motivo explícitos e totais bruto/líquido claros. No cartão ou boleto com liquidação futura, distinguir previsão de entrada efetiva; não lançar dinheiro disponível antes da confirmação.
- [ ] Criar contas a pagar com favorecido, categoria, valor, vencimento, situação e pagamento; vincular manutenção/veículo quando necessário.
- [ ] Registrar receitas e despesas avulsas, já pagas ou a vencer, com anexos privados, observação e identificação da pessoa que lançou; estender o vínculo dos documentos privados a lançamentos e pagamentos. Permitir repetir lançamento e configurar recorrência mensal simples, sem gerar duplicatas ao reprocessar.
- [ ] Transferir entre contas/caixas do mesmo espaço em uma única operação, com débito e crédito vinculados, data e motivo; não permitir uma ponta sem a outra. Transferência não é receita nem despesa.
- [ ] Corrigir, cancelar e estornar lançamentos conforme sua situação. Alterar parcelas ainda abertas não pode modificar pagamentos já confirmados; ajustes de saldo exigem motivo e preservam o extrato anterior.
- [ ] Manter separado previsto, vencido, parcialmente pago, pago e cancelado. Fluxo de caixa realizado usa a data do pagamento; previsão usa vencimento.
- [ ] Integrar contratação e manutenção por referência única, com opção explícita de gerar cobrança/despesa. Aulas já consumidas, edições e novas tentativas de envio não podem gerar títulos duplicados.
- [ ] Integrar adiantamentos/reembolsos de taxas externas: mostrar quem adiantou, valor a acertar e baixa; distinguir caixa próprio, reembolso e eventual remuneração do serviço, sem classificar automaticamente todo repasse como receita de aula.
- [ ] Controlar recebíveis e repasses por parceiro quando o modelo contratado exigir, sem criar compartilhamento de dados entre organizações.
- [ ] Emitir comprovante interno de recebimento para consulta/impressão, com identificação da operação. Documentos fiscais e assinatura eletrônica ficam fora do MVP.
- [ ] Entregar extrato por conta/caixa com saldo de abertura, entradas, saídas, transferências e saldo final; permitir conferência manual com extrato externo, identificando divergências sem integração bancária automática.
- [ ] Acrescentar ao painel e relatórios: a receber/a pagar, parcelas vencidas, entradas/saídas, fluxo previsto/realizado, saldo por conta/período e visão por aluno/parceiro/categoria/forma de pagamento; exportar CSV com os mesmos filtros.
- [ ] Acrescentar alertas de vencimento e atraso à central do módulo 5, respeitando as permissões financeiras.
- [ ] Usar valores monetários em centavos, transações e registros de auditoria; definir correção de pagamento errado sem excluir movimentação já efetivada.
- [ ] Entregar filtros de período, situação, pessoa/parceiro, conta, categoria e forma, com busca, totais e paginação; oferecer ações de recebimento/pagamento no contexto da matrícula e da manutenção.
- [ ] Verificar parcelamento de receita/despesa com arredondamento, recebimento parcial ou dividido em formas/contas, estorno, liquidação futura de cartão, recorrência, despesa de manutenção, taxa paga direto pelo aluno, reembolso, parceiro pagador, saldo inicial, transferência e duplicação concorrente.

**Aceite:** cadastrar banco e caixa; lançar uma contratação de R$ 1.000 em quatro parcelas de R$ 250; quitar uma com R$ 100 em dinheiro e R$ 150 em Pix, deixando as demais abertas; registrar uma despesa parcelada, transferir entre contas e estornar um pagamento errado. Por conta e no consolidado, saldo inicial + entradas reais − saídas reais deve fechar com o saldo final, sem somar transferências como faturamento. Contas em aberto não alteram o realizado, e nenhum pagamento/taxa entra duas vezes.

Ficam fora desta etapa: integração bancária, cobrança automática por Pix/cartão, emissão automática de boleto, conciliação bancária automática, contabilidade completa, folha/comissões complexas, NFS-e e cobrança de assinatura do próprio sistema. Pix, cartão e boleto continuam disponíveis como formas de pagamento registradas manualmente.

## 12. Critérios para lançar o MVP web

Estes TODOs são transversais. Preparar durante os módulos e concluir a conferência final após o financeiro.

- [ ] Concluir todos os itens dos módulos 1 a 8, incluindo os complementos financeiros de relatórios, alertas e auditoria; registrar evidência de aceite por entrega.
- [ ] Homologar o percurso aluno → contratação → liberação → agenda → execução/saldo → exame/reteste → emissão/encerramento → relatório → recebimento/despesa.
- [ ] Homologar CFC e espaço particular com parceiros, nos papéis proprietário, administrador, equipe e instrutor; verificar acesso por URL direta e revogação durante a sessão.
- [ ] Verificar os cenários de [referência do fluxo](fluxo-habilitacao-brasil-mg.md#22-cenários-de-referência-para-validar-o-produto) que se aplicam ao escopo prático. Os serviços fora do MVP não precisam ser implementados para satisfazer essa referência.
- [ ] Automatizar os fluxos críticos do web e as novas regras da API, incluindo exame AB parcial, saldo/pagamento idempotentes e proteção de documentos/exportações.
- [ ] Executar concorrência real com conexões/processos simultâneos para agenda de instrutor/aluno/veículo, reservas de exame, consumo de crédito e baixa financeira.
- [ ] Configurar verificação contínua de build/lint do web, testes da API e integridade das migrations; manter ambiente de homologação separado.
- [ ] Validar volume representativo da operação, inclusive mais de 100 aulas por período, listas extensas, consultas agregadas e exportações; medir e corrigir lentidão relevante.
- [ ] Avaliar os avisos atuais do build e o carregamento inicial; ajustar divisão de código/recursos quando a medição justificar, sem confundir aviso de build com falha funcional.
- [ ] Publicar procedimento de implantação: domínio/HTTPS, configuração de sessão/CSRF/CORS, segredos fora do git, debug desligado, migrations, arquivos privados e retorno à versão anterior.
- [ ] Configurar e verificar envio real de confirmação, convite e recuperação de senha em produção; não usar Mailpit como serviço de entrega.
- [ ] Configurar agendador, processamento de filas e acompanhamento de falhas para os alertas e demais tarefas periódicas.
- [ ] Fazer backup de banco **e documentos privados**, definir retenção e executar restauração em ambiente separado, verificando arquivos e relacionamentos.
- [ ] Configurar acompanhamento de erros, disponibilidade e falhas de jobs, com logs que não exponham senha, token, documento ou dado sensível.
- [ ] Documentar acesso, retenção e atendimento de solicitações sobre dados pessoais, além de termos/privacidade e canal de suporte do produto, com revisão adequada antes da publicação.
- [ ] Conferir fontes e aplicabilidade das regras do checklist na localidade atendida; manter referência/data da conferência e deixar clara a diferença entre acompanhamento interno e confirmação oficial.
- [ ] Garantir que o ambiente inicial não tenha dados/credenciais de demonstração e que o primeiro proprietário consiga entrar e configurar seu espaço.
- [ ] Fazer um piloto real no web com CFC e autônomo, registrar problemas, corrigir bloqueadores e preparar instruções de uso e suporte.

**MVP 100% pronto para lançamento:** módulos concluídos, critérios acima verificados e nenhum bloqueador conhecido de operação, acesso, saldo, financeiro ou recuperação de dados. Não atribuir uma porcentagem de conclusão só pela quantidade de telas ou checkboxes.

## 13. Depois do MVP — Vendas e atendimento

**Ordem:** somente depois dos relatórios e do financeiro básico. Este módulo não bloqueia o lançamento definido acima.

Nome sugerido no menu: **Vendas**. Dentro dele, usar **Interessados**, **Atendimentos**, **Próximo contato** e **Propostas**. Evitar “CRM” e “lead” na interface e nas instruções ao usuário.

- [ ] Cadastrar interessado com nome, contato, interesse/categoria, origem e responsável, sem exigir matrícula ou processo de habilitação.
- [ ] Organizar uma sequência visual de atendimento com etapas simples, como novo contato, em conversa, proposta enviada, aguardando decisão, contratado e não fechou.
- [ ] Registrar histórico de conversa/anotações, próximo contato, lembrete e tarefas de acompanhamento.
- [ ] Preparar proposta usando os serviços/pacotes existentes, com valor, condições e validade; evitar catálogo comercial duplicado.
- [ ] Ao fechar, criar/vincular aluno e matrícula preservando a origem do atendimento, sem duplicar CPF no espaço; gerar cobrança apenas pela operação explícita do financeiro.
- [ ] Marcar motivo de perda/desistência e permitir retomada do atendimento com histórico.
- [ ] Mostrar atendimentos sem retorno, propostas abertas, vendas por período/origem/responsável e conversão em contratação.
- [ ] Definir permissões, isolamento por espaço, preferências de contato e uso adequado dos dados pessoais antes de integrar canais externos.

## 14. Futuro fora do MVP web

- [ ] **Aplicativo mobile**, com checklist e homologação próprios após a conclusão do web; reutilizar a API sem presumir que emissão de token já seja um app pronto.
- [ ] Teoria, catálogo de cursos, turmas, salas, professores, frequência, avaliações e certificados internos.
- [ ] Gestão integral da abertura oficial, biometria, clínicas/laboratórios e encaminhamentos de saúde, além da conferência operacional existente.
- [ ] Regras versionadas por UF/município, importação de formação reconhecida, transferências formais, recursos, reavaliações e demais serviços de habilitação.
- [ ] Atendimento PCD completo, credenciais com validade e cursos especializados; não confundir o campo atual de veículo adaptado com esses módulos completos.
- [ ] Contratos/aditivos com assinatura, emissão fiscal e integrações financeiras.
- [ ] Integrações oficiais somente com documentação técnica e autorização; não pressupor API de Detran/Renach disponível.
- [ ] Portal do aluno, comunicação externa automatizada e integrações com WhatsApp, SMS ou push.
- [ ] Planos, assinatura e cobrança pelo uso do próprio sistema, caso esse modelo comercial seja adotado.

## 15. Decisões a fechar durante a especificação

As escolhas abaixo não impedem começar o próximo módulo. Cada uma deve ser registrada antes de implementar a regra que depende dela.

| Momento     | Decisão pendente                                                           | Direção proposta para o MVP                                                                |
| ----------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Módulo 1    | Consumo pelo tempo agendado ou efetivamente realizado? Falta consome?      | Política explícita por contratação, com minutos realizados separados do consumo comercial. |
| Módulo 1    | Reserva e saldo insuficiente; aulas avulsas e migração do contratado atual | Não conceder crédito implícito nem permitir consumo duplicado; exceção exige motivo.       |
| Módulos 1–3 | Como distribuir crédito/exame em matrícula AB existente?                   | Controlar percurso por categoria sem duplicar o processo, com migração compatível.         |
| Módulo 4    | O que fazer com aulas futuras ao desativar instrutor/veículo?              | Listar impacto e exigir providência explícita, preservando o histórico.                    |
| Módulo 6    | Política de senha e ações disponíveis à equipe                             | Registrar escolha para produção e refletir a mesma regra em API/web.                       |
| Módulo 8    | Aluno ou parceiro paga o autônomo? Há repasse?                             | Suportar pagador identificado, sem presumir que todo aluno paga diretamente.               |
| Módulo 8    | Quem adianta taxa, como reembolsa e o que `staff` pode fazer?              | Separar taxa externa, adiantamento e caixa; permissões por operação.                       |
| Lançamento  | Localidade inicial, volume esperado e processo de suporte                  | Confirmar no piloto e registrar as condições atendidas pelo primeiro lançamento.           |
