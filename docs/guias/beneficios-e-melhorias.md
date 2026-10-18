# Como o sistema ajuda — e como pode ficar muito mais ágil

**Rota Certa Gestão · benefícios atuais e melhorias propostas · 17/10/2026**

Este documento separa **o que já funciona na versão web** de **ideias para evoluir produto, UX e UI**. As melhorias são propostas, não recursos disponíveis hoje.

## 1. Valor atual para o instrutor autônomo

| Trabalho diário | Ajuda que já existe | Ganho prático |
| --- | --- | --- |
| Atender alunos particulares e de CFCs | Espaço particular, convites de CFCs e **Minha agenda** com origem de cada aula | Consultar compromissos em uma conta, sem duplicar aulas entre espaços. |
| Organizar alunos | Cadastro, busca, matrícula por categoria e parceiro opcional | Reduzir dispersão entre caderno, mensagens e planilhas. |
| Preparar a prática | Processo local, checklist e indicador de liberação na matrícula | Identificar pendências antes de concluir uma aula. |
| Planejar horários | Agenda por dia/semana; conflitos do instrutor entre espaços | Evitar duas aulas sobrepostas para o mesmo profissional. |
| Registrar trabalho feito | Situação da aula, duração real, observações e evolução | Preservar um histórico útil para acompanhar o aluno. |

## 2. Valor atual para a autoescola

| Trabalho diário | Ajuda que já existe | Ganho prático |
| --- | --- | --- |
| Distribuir tarefas | Papéis Proprietário, Gestor, Equipe e Instrutor; convites por e-mail | Cada pessoa acessa apenas a operação pertinente. |
| Organizar pessoas e frota | Cadastro de instrutores, vínculos ativos, veículos e validade do CRLV | Agendar com recursos cadastrados e detectar impedimentos básicos. |
| Acompanhar atendimento | Aluno, matrícula, processo, checklist e documento privado no mesmo espaço | Dar continuidade ao atendimento sem reconstruir o contexto a cada etapa. |
| Coordenar aulas | Agenda, remarcação e checagem de conflitos de aluno, veículo e instrutor | Reduzir erros de marcação e retrabalho da secretaria. |
| Fechar a execução | Realização/falta/cancelamento, evolução e referência do registro oficial | Distinguir aula dada de lançamento confirmado fora do sistema. |

Esses ganhos são **qualitativos**; ainda não há medição de tempo economizado no produto. O painel inicial, o financeiro e o saldo automático de aulas ainda não fornecem indicadores para quantificar economia.

## 3. O que mais atrasa o usuário hoje

1. **Dados espalhados por telas e excesso de cliques:** criar aluno, processo, matrícula, documento e aula exige alternar páginas; falta uma linha de progresso do atendimento.
2. **Cadastro de instrutor e convite separados:** a interface não associa um convite a um perfil sem conta já cadastrado, criando risco de duplicidade.
3. **Correções limitadas:** depois de salvar, a matrícula permite mudar basicamente a situação; alguns dados de processo e documento não têm edição completa na web.
4. **Ausência de saldo e financeiro:** minutos e valor são anotados, mas não mostram consumo, parcelas, recebimento nem pendência de cobrança.
5. **Pendências pouco visíveis:** o painel mostra “—” e o sino não representa uma fila persistente de trabalho real.
6. **Agenda grande pode ser truncada:** telas mostram aviso quando parte dos registros não foi carregada, mas o usuário precisa filtrar para obter uma visão completa.

## 4. Melhorias propostas, por prioridade

### Prioridade 1 — Tornar a rotina principal realmente rápida

**Fluxo guiado “Novo atendimento”.** Em uma sequência curta: buscar ou criar aluno → abrir processo (quando necessário) → anexar documentos → criar matrícula → conferir liberação → agendar primeira aula. Salvar rascunho e permitir retomar. Evitar repetir campos e preservar contexto quando o usuário volta uma etapa.

**Resumo operacional do aluno.** Uma página com próxima aula, matrícula, saldo de minutos, pendências de checklist/documentos, histórico recente e próxima ação. Cada cartão deve abrir diretamente o item editável. Esse resumo só deve mostrar saldo quando existir um livro de créditos confiável.

**Agenda orientada à ação.** Mostrar disponibilidade antes de escolher horário; oferecer o primeiro horário livre por instrutor/veículo; indicar conflito no campo correspondente e sugerir alternativas. Permitir remarcação em poucos passos e mostrar o impacto em aluno, instrutor e veículo.

**Vínculo de instrutor sem duplicação.** No convite com papel Instrutor, permitir selecionar o perfil profissional sem conta já cadastrado, com confirmação explícita da identidade. Apresentar uma checagem de duplicados e um caminho seguro de resolução antes de criar perfil novo.

**Saldo de aulas confiável.** Separar minutos contratados, reservados, realizados, faltas conforme política e ajustes autorizados. Mostrar extrato na matrícula e no resumo do aluno. Não calcular saldo com base apenas nas primeiras 100 aulas carregadas pela tela.

### Prioridade 2 — Dar visibilidade para a equipe e para o instrutor

**Painel inicial real por papel.** Para instrutor: próximas aulas, aulas pendentes de conclusão e evolução não registrada. Para secretaria: alunos com documentos ou checklist pendentes, aulas sem lançamento oficial, conflitos e vencimentos de CRLV. Para gestor: volume de aulas, ocupação da frota e da equipe; depois do financeiro, indicadores financeiros. Cada número deve levar a uma lista filtrada.

**Caixa de pendências persistente.** Gerar tarefas a partir de fatos do sistema, com responsável, prazo, estado e link direto. Exemplos: convite prestes a expirar, documento rejeitado, prática não liberada, aula realizada sem registro oficial, CRLV perto do vencimento. O sino deve refletir essa caixa, não apenas mensagens temporárias.

**Confirmação e lembrete de aula.** Oferecer lembrete configurável para instrutor e equipe e, quando houver canal consentido, confirmação para o aluno. Mostrar claramente se a mensagem foi enviada, entregue e respondida; não prometer confirmação enquanto não existir integração.

**Correção com histórico.** Permitir editar matrícula, processo, vínculo e documentos pelo web, mostrando quem mudou o quê e quando. Alterações sensíveis, como saldo e status final, pedem motivo e trilha de auditoria.

### Prioridade 3 — Polir UX e UI para uso intenso

**Tela inicial de tarefa, não de navegação.** Na entrada, mostrar “o que fazer agora” com no máximo 3–5 ações relevantes ao papel e ao horário. Priorizar o próximo compromisso e pendências bloqueantes.

**Formulários mais fáceis.** Campos na ordem do trabalho real; preenchimento automático de dados conhecidos; máscaras discretas; exemplos curtos; erro junto ao campo com instrução de correção; salvamento de rascunho; confirmação visível após salvar. Preservar dados digitados em falhas de rede.

**Busca global com atalhos.** Encontrar aluno por nome/CPF, matrícula, placa ou instrutor sem trocar de módulo. Resultados devem indicar o espaço e respeitar permissões.

**Navegação consistente.** Breadcrumbs e botão de voltar para a lista filtrada; nomes de ação uniformes; estados vazio/carregando/erro claros; ações importantes sempre no mesmo lugar. No celular, manter botões primários acessíveis sem esconder informação crítica.

**Visual de agenda mais legível.** Diferenciar aula agendada, realizada, falta e cancelada por texto e ícone além de cor; exibir duração e fuso; destacar sobreposições, lacunas e aulas que exigem ação. Permitir zoom útil em telas pequenas.

**Acessibilidade e confiança.** Contraste adequado, foco visível, navegação por teclado, rótulos compreensíveis, feedback para leitores de tela, alvo de toque confortável e mensagens que expliquem o efeito das ações. Confirmar apenas mudanças com consequência relevante; não interromper tarefas comuns com modais desnecessários.

## 5. Critérios para saber se a melhoria funcionou

| Métrica | Como medir | Meta inicial sugerida |
| --- | --- | --- |
| Tempo para cadastrar aluno e agendar primeira aula | Teste com usuários reais, do início até a aula salva | Reduzir pela metade frente ao fluxo atual medido. |
| Erros de agendamento | Tentativas recusadas por conflito / tentativas totais | Queda contínua após sugestões de horários. |
| Aulas com evolução registrada no mesmo dia | Aulas realizadas com evolução até o fim do dia / realizadas | Aumentar sem exigir preenchimento artificial. |
| Pendências resolvidas no prazo | Pendências fechadas dentro do prazo / pendências geradas | Melhorar por tipo e por papel. |
| Retrabalho em cadastros | Perfis de instrutor duplicados e correções manuais por mês | Aproximar de zero com associação no convite. |
| Satisfação e facilidade | Teste de tarefas e entrevista breve com instrutores/secretaria | Observar menos dúvidas e cliques antes de lançar. |

Essas metas são **sugestões**, não resultados do sistema. Faça testes com um instrutor autônomo, uma pessoa da secretaria e um gestor antes de fixar a interface. Priorize sempre o fluxo que reduz uma tarefa real sem esconder controles ou dados necessários.

**Guias de uso:** [Instrutor autônomo](guia-instrutor-autonomo.md) · [Autoescola](guia-autoescola.md) · [Todos os módulos](guia-modulos.md).
