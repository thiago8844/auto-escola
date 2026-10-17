# Lacunas do MVP na API

Comparação entre o fluxo de habilitação ([fluxo-habilitacao-brasil-mg.md](fluxo-habilitacao-brasil-mg.md)) e o que a API tem hoje. Foco: **receber o aluno já pronto para a prática** e acompanhá-lo até a CNH.

Legenda: ✅ existe · 🟡 existe parcialmente · 📋 falta · 🔮 futuro (fora do MVP)

## 1. Escopo do MVP

**Entra:** alunos, processo em andamento, aulas, agenda, exames práticos (tentativas, taxa, comprovante, resultado), veículos (cadastro, disponibilidade, manutenção) e financeiro simples (contas a pagar/receber, receitas e despesas).

**Não entra (🔮):** teoria, turmas, professores, clínicas, abertura oficial do processo e integrações com Detran. Ficam no rascunho da seção 6.

**CFC × autônomo:** o autônomo atende vários CFCs. Hoje isso já é possível: `Partner` (parceiro) por espaço e `enrollments.partner_id` ligam o aluno a cada auto escola.

## 2. O que já existe

| Área | Estado |
|---|---|
| Espaços CFC/particular, membros, papéis, convites | ✅ |
| Instrutor com vínculo em vários espaços e conflito entre espaços | ✅ |
| Parceiros (auto escolas do autônomo) | ✅ |
| Alunos (nome, CPF, contato, nascimento) | ✅ |
| Matrícula: situação, minutos contratados, preço, processo (Fase 1) | ✅ |
| Processo de habilitação, checklist, documentos, veículos (Fase 1) | ✅ |
| Aulas: veículo, conflito de aluno e veículo, duração real, evolução, registro oficial (Fase 1) | ✅ |

## 3. Lacunas, em ordem de implementação

### Fase 1 — Dar para começar a dar aula ✅ Implementada

Detalhes em [implementacao.md](implementacao.md#fase-1-do-mvp--o-que-entrou) e [api.md](api.md).

| # | Lacuna | Detalhe | Status |
|---|---|---|---|
| 1.1 | **Processo de habilitação** (`qualification_processes`) | Tipo (primeira, adição, mudança, aperfeiçoamento), UF, município, Renach/protocolo, data de abertura, categorias atuais e pretendidas, situação (em preparação, ativo, com pendência, aguardando emissão, concluído, encerrado). A matrícula passa a referenciá-lo. Seção 3 e 21 do fluxo. | ✅ |
| 1.2 | **Checklist de liberação para prática** | Teoria aprovada, licença de aprendizagem, exame médico/psicológico (só o resultado operacional), toxicológico quando aplicável. Cada item: situação, origem, quem conferiu, data. Upload **não** conclui etapa. | ✅ |
| 1.3 | **Matrícula completa** | Hoje só tem categoria. Falta: situação (interessado, contratado, em atendimento, encerrado, rescindido), vínculo com o processo, serviço contratado, aulas/minutos contratados, preço. | ✅ |
| 1.4 | **Documentos privados** (`documents`) | Upload em disco privado, tipo, titular, validade nullable, situação (anexado, conferido, rejeitado, substituído), versão, download autorizado. Serve à licença, comprovantes, guias, "papelzinho" do exame, CRLV. | ✅ |
| 1.5 | **Veículos** (`vehicles`) | Placa, modelo, categoria atendida, adaptações, CRLV/validade, situação, dono (espaço). | ✅ |
| 1.6 | **Aula com veículo** | `lessons.vehicle_id`, conflito de veículo, conflito de **aluno** (hoje aceita duas aulas ao mesmo tempo), compatibilidade categoria × veículo × instrutor. | ✅ |
| 1.7 | **Execução da aula** | Duração real × contratada, evolução/observação pedagógica, motivo de falta/cancelamento, situação do registro oficial (não informado, pendente, confirmado, rejeitado) com evidência manual. | ✅ |
| 1.8 | **Fuso horário por espaço** | Já listado como limitação: o dia local do CFC sai deslocado 3 h. Afeta agenda e relatórios. | ✅ |

### Fase 2 — Ciclo completo até a CNH

| # | Lacuna | Detalhe | Status |
|---|---|---|---|
| 2.1 | **Exames práticos** (`exam_attempts`) | Por categoria (AB tem dois percursos). Agendamento (data, local, comprovante), resultado (aprovado, reprovado, ausente, não concluído), número da tentativa, remarcação preservando histórico. Falta ≠ reprovação. | 📋 |
| 2.2 | **Taxas externas** (`process_fees`) | Guia, valor emitido, vencimento, quem pagou (aluno, CFC, instrutor), situação (desconhecida, pendente, paga informada, confirmada, isenta com motivo, cancelada), comprovante. Vários por tentativa; compartilhadas por processo. Nada de `exam_paid` booleano. | 📋 |
| 2.3 | **Desfecho do exame** | Aprovou → "aprovado — emissão pendente" → PPD → definitiva. Reprovou → registrar, oferecer **nova aula** (contratar mais) ou novo exame. Resultado fica na tentativa, nunca em `student.status`. | 📋 |
| 2.4 | **Pacotes e saldo** | Pacote de aulas, saldo por matrícula. Regras explícitas: concluir consome, falta consome conforme contrato, cancelamento estorna, conclusão repetida não desconta duas vezes (idempotência). | 📋 |
| 2.5 | **Histórico do processo** (`process_events`) | Decisões, renúncia de categoria, troca de CFC, retificação de resultado, com antes/depois e responsável. | 📋 |
| 2.6 | **Alertas de pendência** | Licença/CRLV a vencer, manutenção, taxa não paga antes do exame, aluno sem aula há X dias, exame sem taxa. | 📋 |

### Fase 3 — Veículos e financeiro

| # | Lacuna | Detalhe | Status |
|---|---|---|---|
| 3.1 | **Disponibilidade do veículo** | Bloqueios (manutenção, documentos vencidos, indisponível), usados pela agenda. | 📋 |
| 3.2 | **Manutenções** | Data, tipo, custo, oficina, km, próxima revisão. Gera despesa no financeiro. | 📋 |
| 3.3 | **Plano de contas simples** | Categorias de receita/despesa (aula, taxa repassada, combustível, manutenção, aluguel...). | 📋 |
| 3.4 | **Contas a receber** | Cobrança por matrícula/pacote, parcelas, vencimento, situação, pagamento real (forma, data, recibo). | 📋 |
| 3.5 | **Contas a pagar** | Fornecedor, vencimento, pagamento, vínculo opcional (veículo, manutenção). | 📋 |
| 3.6 | **Lançamentos** | Receitas e despesas avulsas, fluxo de caixa por período. | 📋 |
| 3.7 | **Adiantamento de taxa** | Se o CFC/instrutor paga a taxa do Detran, controlar adiantamento e reembolso, sem contá-la como receita. | 📋 |
| 3.8 | **Visão por parceiro (autônomo)** | Receita, aulas e repasses por auto escola associada. | 📋 |
| 3.9 | **Papel financeiro** | Hoje instrutor não vê financeiro; definir quem lê/edita (owner, admin, financeiro). | 📋 |

### Fase 4 — Relatórios e infraestrutura

| # | Lacuna | Status |
|---|---|---|
| 4.1 | Resumo do aluno: aulas feitas, saldo, agenda, exames, taxas, situação (o "foram feitas x aulas") | 📋 |
| 4.2 | Painel: aulas da semana, exames próximos, aprovados/reprovados, contas vencendo | 📋 |
| 4.3 | Auditoria (quem alterou o quê) | 📋 |
| 4.4 | Mensagens de validação em pt_BR; redefinição de senha | 📋 |
| 4.5 | Teste de concorrência real; decisão sobre aulas futuras ao desativar instrutor | 📋 |

## 4. Regras que a IA não pode quebrar (resumo do fluxo)

1. Resultado pertence à tentativa, não ao aluno.
2. AB = um processo, dois percursos; aprovar A não encerra AB.
3. Upload, pagamento interno ou aula concluída **não** implicam etapa, taxa reconhecida ou registro oficial.
4. Aprovação prática ≠ documento emitido.
5. Não fixar mínimos de horas, limite de tentativas, intervalo de reteste nem preço nacional: tudo configurável, com fonte e data (V01, V04, V07, V09 do fluxo).
6. Compartilhar CPF/Renach não dá acesso entre espaços.
7. Pendência regulatória não se resolve mudando situação comercial.

## 5. Modelo proposto (resumo)

```
students ─┬─ qualification_processes ─┬─ process_steps (checklist)
          │                           ├─ process_events
          │                           ├─ process_fees ── documents
          │                           └─ enrollments ─┬─ package/saldo
          │                                           ├─ lessons ── vehicles
          │                                           ├─ exam_attempts ── process_fees
          │                                           └─ receivables ── payments
vehicles ── vehicle_blocks, vehicle_maintenances ── payables
financial_categories ── payables / receivables / transactions
```

`enrollments` mantém a semântica atual (percurso/contratação por categoria); apenas ganha `qualification_process_id` nullable, para não quebrar o que existe.

## 6. 🔮 Rascunho do futuro (fora do MVP)

- [ ] Teoria: catálogo de cursos, turmas, calendário, salas, professores, presença, avaliações, certificado interno, prova teórica oficial separada de simulados.
- [ ] Abertura e acompanhamento integral do processo (biometria, médico, psicológico, toxicológico como fluxo, não só resultado).
- [ ] Regras por UF/município versionadas (`uf`, vigência, fonte, data de conferência, `confirmed`/`needs_review`); processos antigos não são recalculados.
- [ ] Clínicas e laboratórios: encaminhamento e retorno.
- [ ] Reavaliação, recurso e contestação de resultado.
- [ ] PCD: adaptações, Junta Médica, veículo adaptado, Libras.
- [ ] Transferência de UF e troca de CFC com importação de horas reconhecidas.
- [ ] Contratos, aditivos, recibos em PDF, assinatura eletrônica, NFS-e.
- [ ] Integrações oficiais (Renach, agendamento), só com documentação técnica e autorização.
- [ ] Credenciais de instrutor e validade; cursos profissionais (transporte escolar, produtos perigosos).
- [ ] Conversão horas × horas-aula e carga mínima oficial por categoria (V09).
- [ ] Notificações e lembretes ao aluno (e-mail, push, WhatsApp).
- [ ] Web e mobile.

## 7. Perguntas abertas

1. Pagamento do aluno ao autônomo: por aula, por pacote ou misto? Há repasse para a auto escola parceira? (define 3.4 e 3.8)
2. Instrutor autônomo cobra o aluno ou a auto escola paga o instrutor? Os dois cenários existem?
3. Falta consome crédito por padrão ou depende de aviso prévio?
4. Aluno pode ter processo em um CFC e aulas com o autônomo no mesmo processo?
5. Quem paga a taxa do exame no dia a dia: aluno direto ao Detran ou o CFC adianta?
