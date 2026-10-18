# Guia de uso — autoescola

**Rota Certa Gestão · versão web · 17/10/2026**

Este manual organiza a implantação e a rotina de um CFC no sistema atual. Ele inclui o cadastro de funcionários, instrutores, veículos e alunos, a agenda e o acompanhamento da prática. O sistema não substitui os lançamentos no órgão oficial.

## 1. Crie o espaço e defina quem fará o quê

1. O responsável cria uma conta em **Criar conta**, confirma o e-mail recebido e entra.
2. Em **Meus espaços → Novo espaço**, escolhe **CFC (autoescola)**, informa o nome e confere o fuso horário. Documento, e-mail de contato, telefone e endereço podem ser preenchidos agora ou em **Dados do espaço**.
3. Quem criou o espaço recebe o papel **Proprietário**. Ele pode administrar dados, equipe e operação. O espaço pode ter mais de um proprietário, mas nunca ficar sem nenhum.

| Papel no espaço | Uso típico | Acesso principal |
| --- | --- | --- |
| **Proprietário** | Responsável pelo CFC | Dados do espaço, membros, convites e toda a operação. |
| **Gestor** | Coordenação | Dados do espaço e operação; administra apenas acessos de **Equipe** e **Instrutor**. |
| **Equipe** | Secretaria/recepção | Cadastros, documentos, processos, agenda e registros; não administra membros nem convites. |
| **Instrutor** | Profissional que ministra aulas | Suas aulas e alunos/matrículas atribuídos; não agenda nem remarca. |

O papel é por espaço: uma pessoa pode ser instrutora neste CFC e proprietária do próprio espaço particular.

## 2. Cadastre funcionários e dê acesso

O sistema não possui uma tela separada chamada “Funcionários”. **Funcionário com login é um membro do espaço.** Faça assim:

1. Abra **Convites → Convidar por e-mail**.
2. Informe o e-mail individual da pessoa e escolha **Equipe** para recepção/secretaria, **Gestor** para coordenação ou **Instrutor** para quem só deve operar as próprias aulas. O **Proprietário** pode convidar qualquer papel; o **Gestor** só pode convidar **Equipe** e **Instrutor**.
3. Clique **Enviar convite** e acompanhe a situação em **Convites**: pendente, aceito, cancelado ou expirado.
4. A pessoa abre o link recebido, cria ou acessa sua conta com aquele **mesmo e-mail**, confirma o e-mail e clica **Aceitar convite**. O aceite não é automático.
5. Confira a pessoa em **Membros**. Ali é possível mudar o papel dentro das permissões do seu próprio papel ou **Remover** o acesso. O último proprietário não pode ser removido/rebaixado.

**Regra prática:** cadastre cada pessoa com seu e-mail. A tela **Membros** gerencia acesso; ela não cria um perfil profissional de instrutor para um funcionário da secretaria.

## 3. Cadastre instrutores e entenda os vínculos

Há dois elementos diferentes:

1. **Instrutores → Novo instrutor** registra a identidade profissional para uso na agenda: nome, credencial opcional e categorias. O vínculo precisa estar **Ativo** para receber novas aulas. Um instrutor cadastrado assim pode existir **sem conta** e sem login.
2. **Convites → papel Instrutor** dá acesso ao espaço. Ao aceitar, a conta da pessoa usa seu perfil profissional existente ou recebe um perfil novo, que é vinculado ao CFC. Ela passa a aparecer como membro e instrutor do espaço.

O formulário web de convite **não permite escolher um instrutor já cadastrado sem conta**. Assim, convidar depois alguém que foi cadastrado manualmente pode criar outro perfil para a conta. Antes de operar, confira a lista **Instrutores** e o vínculo correto; se precisar aproveitar exatamente o cadastro antigo, a interface atual não oferece essa associação manual. Evite registrar aulas em perfis duplicados.

Quando o instrutor tem conta, **só ele** altera nome, credencial e categorias em **Perfil profissional**. A equipe pode ativar ou desativar o vínculo com o CFC na ficha do instrutor. Desativar impede novas atribuições, mas preserva aulas existentes. Revogar o membro em **Membros** tira o acesso; são ações distintas.

## 4. Cadastre veículos

Em **Veículos → Novo veículo**, informe placa, modelo e categoria; complete marca, ano, validade do CRLV, adaptações e observações se houver. Defina a **Situação** como **Ativo** para disponibilizá-lo no agendamento. A ficha permite editar ou inativar mais tarde.

Na nova aula, o veículo é opcional. Se for selecionado, o sistema verifica compatibilidade de categoria, situação, CRLV e conflito de horário. O cadastro atual **não** tem bloqueios de manutenção por período nem gestão completa de frota; acompanhe essas ocorrências também no procedimento interno.

## 5. Organize alunos, processos e documentos

1. Em **Alunos → Novo aluno**, informe o nome, a autoescola do aluno (este espaço ou uma parceira) e, se disponível, CPF, telefone, e-mail, nascimento, identidade e órgão expedidor. Os dados de identidade são usados na inscrição do exame. Use a busca por nome para localizar depois.
2. Na ficha do aluno, clique **Nova matrícula → Criar processo para este aluno** se quiser acompanhar a etapa de habilitação e a liberação para a prática. Crie o processo antes de preencher a matrícula, pois a navegação não salva um rascunho dela. Informe tipo, UF, categorias pretendidas e, quando couber, categorias atuais. RENACH, protocolo e data de abertura são opcionais.
3. Em **Processos → [processo]**, atualize cada item do **Checklist de liberação para a prática**. Para **Conferido**, escolha uma origem confiável; a simples declaração do aluno não basta. **Não se aplica** e **Bloqueado** pedem motivo. Apenas **Conferido** e **Não se aplica** contam para liberar.
4. Na ficha do aluno, clique **Anexar documento**. Envie PDF/JPG/PNG/WebP de até 10 MB, escolha o tipo, validade e observações. Depois, marque **Conferido** ou **Rejeitado**. Os arquivos são privados para a equipe; o instrutor não acessa laudos e documentos.
5. Na ficha do aluno, clique **Nova matrícula**. Informe categoria, situação, minutos contratados, valor, observações e, se pertinente, o processo criado. A tela de detalhes permite mudar a situação comercial. Revise os demais campos antes de salvar, pois a edição completa ainda não está disponível no web.

**Importante:** o processo é um acompanhamento interno. A conferência local não altera o sistema oficial. Se a matrícula ficar sem processo, o web informa que não há checklist e a prática não será bloqueada por essa regra.

## 6. Agende, realize e registre aulas

1. Em **Agenda → Agendar aula**, selecione matrícula, instrutor com vínculo ativo, veículo opcional, data, horário de início e duração (máximo 240 minutos). Você também pode partir do detalhe da matrícula, que já a seleciona.
2. A API recusa sobreposições do instrutor, aluno ou veículo. Para o instrutor, a checagem considera os espaços em que ele trabalha, sem expor o outro CFC. Os horários exibidos usam o fuso do espaço.
3. Use a visão por **dia** ou **semana** e os filtros de instrutor e veículo. Clique no horário para abrir a aula.
4. Enquanto está **Agendada**, a equipe pode **Remarcar** data, início e duração, ou mudar a situação para **Realizada**, **Falta** ou **Cancelada**. Se o processo vinculado ainda não liberou a prática, **Realizada** fica bloqueada.
5. Ao realizar, registre duração real e evolução do aluno. O detalhe da aula também permite salvar observações depois. Estados finais não voltam a “Agendada”.
6. Depois da realização, a equipe preenche **Registro oficial** com situação, protocolo/referência ou documento. Esse campo acompanha o lançamento feito fora do Rota Certa; concluir a aula localmente não a lança no sistema oficial.

O instrutor com papel **Instrutor** vê somente as próprias aulas, agenda, remarca e cancela as próprias aulas (para alunos atribuídos a ele), marca **Realizada** ou **Falta** e preenche evolução, observações e duração real. Ele também troca o veículo das suas aulas, mas não passa a aula a outro instrutor nem altera o registro oficial. Em **Minha agenda**, vê aulas de todos os espaços aos quais ainda tem acesso.

## 7. Rotina de implantação e conferência

**Antes de começar:** crie o CFC, ajuste fuso, convide equipe, confira vínculos profissionais, cadastre frota ativa e teste o fluxo completo com um aluno de exemplo.

**Na recepção:** cadastre o aluno, abra o processo quando aplicável, anexe e confira documentos, crie a matrícula e verifique a liberação para a prática.

**Na coordenação:** confira disponibilidade, veículo e categoria antes de agendar; ajuste aulas futuras apenas enquanto estão agendadas.

**Após a prática:** instrutor registra execução e evolução; a equipe confere pendências e marca o registro oficial quando o lançamento externo for confirmado.

## 8. O que ainda não está pronto no web

- O **Início** ainda é um protótipo com indicadores “—”.
- Não há telas de **saldo automático/pacotes de aulas**, **exames práticos e taxas**, **financeiro**, **relatórios** nem **vendas/atendimento**. Minutos e preço na matrícula não equivalem a saldo ou cobrança.
- O sino e os avisos visuais existem, mas não há uma central persistente de alertas operacionais.
- Não existe recuperação de senha no web atual. O aplicativo mobile próprio está planejado para depois; a versão web é responsiva.
- Algumas consultas de agenda e histórico exibem até 100 registros por chamada. Quando a tela avisar que mostra apenas parte do total, filtre o período ou o recurso e não use o recorte como contagem geral.

**Leitura complementar:** [Guia do instrutor autônomo](guia-instrutor-autonomo.md) · [Guia de todos os módulos](guia-modulos.md) · [Benefícios e melhorias](beneficios-e-melhorias.md).
