# Lacunas do MVP na API

Atualizado em **17/10/2026**. O escopo e a ordem de implementação passaram a ser mantidos no **[checklist de módulos do MVP web](../../../docs/modulos-checklist.md)**. Este documento é um mapa técnico de backend; não mantém um segundo backlog com prioridades diferentes.

A base web já existe. As antigas Fases 2 a 4 foram reorganizadas: pacotes/saldo primeiro, relatórios antes do financeiro e **financeiro como último módulo do MVP**. Vendas e atendimento ficam após o MVP; mobile em etapa própria posterior.

## Base implementada

Espaços CFC/particular, membros, papéis, convites, instrutor global e vínculos, parceiros, alunos, matrículas, processos/checklist, documentos privados, veículos, agenda, conflitos, execução e registro oficial manual.

A antiga **Fase 1** descreve essa base em [implementacao.md](implementacao.md#fase-1-do-mvp--o-que-entrou). Endpoints atuais em [api.md](api.md); estrutura em [modelo-de-dados.md](modelo-de-dados.md).

## Entregas de API por módulo

Os nomes de entidades abaixo são propostas, não tabelas ou endpoints já disponíveis. As tarefas e critérios completos estão no checklist principal.

| Módulo | Complementos necessários no backend |
|---|---|
| 1. Pacotes e saldo | Contratações/acréscimos, movimentos de crédito/reserva/consumo/estorno, política de falta/cancelamento, transações, idempotência, migração dos dados existentes e agregação completa por matrícula/percurso. |
| 2. Exames e taxas | Tentativas por categoria (`exam_attempts`), remarcações e resultados, reservas de recursos, taxas externas (`process_fees`), comprovantes e conferência separada do pagamento informado. |
| 3. Desfecho e histórico | Situação por percurso, emissão/entrega, transições de encerramento/reabertura, eventos do processo (`process_events`), auditoria e correções rastreáveis. |
| 4. Disponibilidade e frota | Bloqueios de veículo/instrutor, manutenções, impacto em compromissos existentes, validade documental e revalidação operacional. |
| 5. Alertas | Notificações persistentes, leitura por destinatário, escopo por espaço, deduplicação, agendador/fila e geração por pendência. |
| 6. Acesso e acabamento | Recuperação/alteração de senha, validação em português, edição segura, paginação/consultas de histórico e recuperação de cadastros arquivados quando aplicável. |
| 7. Relatórios | Agregações e filtros operacionais por período/fuso/papel, painel real, resumo do aluno e exportação completa. |
| 8. Financeiro — último | Receitas/despesas, categorias, contas bancárias/caixas, formas de pagamento, parcelas a receber/pagar, pagamentos parciais/divididos, baixas/estornos, recorrência simples, transferências, extratos, adiantamentos/reembolsos, parceiro pagador, permissões e relatórios/alertas financeiros. |

Preparação de produção, backups/restauração, testes de concorrência real e homologação são critérios transversais do checklist principal.

## Regras que continuam valendo

1. Resultado pertence à tentativa e à categoria, nunca à situação global do aluno.
2. AB é um processo com dois percursos; aprovação em A não conclui automaticamente B.
3. Upload não conclui etapa; comprovante não confirma taxa; aula realizada não significa registro oficial confirmado.
4. Aprovação prática não significa documento emitido. O tipo de documento e a emissão dependem do percurso acompanhado.
5. Não fixar carga oficial, tentativas, reteste ou preço nacional sem conferência de aplicabilidade e fonte/data. Referência de domínio em [fluxo-habilitacao-brasil-mg.md](../../../docs/fluxo-habilitacao-brasil-mg.md).
6. CPF/Renach compartilhado não concede acesso entre espaços; conflitos de instrutor não revelam a origem externa.
7. Falta cobrada pode consumir crédito comercial, mas não soma minutos de instrução realizada.
8. Taxa paga diretamente ao órgão não gera entrada no caixa do CFC. Adiantamento e reembolso devem ser identificados separadamente.
9. Pendência comercial não dispensa liberação para a prática; conferência interna não equivale a confirmação oficial.

## Planejamento posterior

Vendas e atendimento, mobile, teoria/turmas, serviços oficiais completos, clínicas, integrações, emissão fiscal e demais expansões estão registrados nas seções finais do [checklist principal](../../../docs/modulos-checklist.md). Não precisam ser implementados para concluir o MVP web definido ali.
