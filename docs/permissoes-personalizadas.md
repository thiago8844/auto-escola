# Permissões personalizadas por usuário

> Status: **proposta, pós-MVP**. Não entra no lançamento. Hoje o acesso segue só os quatro papéis de [permissoes.md](permissoes.md).

## Problema

Os papéis são fixos. Em uma autoescola real, o proprietário quer dar acessos diferentes para pessoas com o mesmo papel. Exemplo:

- A Maria é da secretaria (`staff`). Ela precisa agendar, matricular e atender alunos, mas o dono não quer que ela veja o financeiro.
- Hoje, `staff` vê e lança no financeiro. Para tirar isso, o único caminho seria rebaixá-la a `instructor`, o que tira também a visão da autoescola inteira.

Também falta uma forma de liberar um recurso específico sem mudar o papel, por exemplo deixar um `staff` ver o caixa sem poder dar baixa.

## Proposta

Manter os quatro papéis como **predefinições** e permitir ajustar, por vínculo de usuário com o espaço, um conjunto pequeno de **capacidades**. O vínculo é a linha de `organization_user`, então o ajuste vale só para aquele espaço.

### Capacidades iniciais

Cada capacidade é uma permissão que pode ser concedida ou retirada em cima da predefinição do papel:

| Capacidade | Predefinição que a inclui | Libera |
|---|---|---|
| `finance.view` | owner, admin, staff | Ver o financeiro (caixa, parcelas, relatórios) |
| `finance.operate` | owner, admin, staff | Lançar e dar baixa em parcelas abertas |
| `finance.manage` | owner, admin | Contas, categorias, formas, recorrências, estorno, transferência, ajuste de saldo, conciliação |
| `students.sensitive` | owner, admin, staff | Ver CPF, e-mail e data de nascimento do aluno |
| `contracts.price` | owner, admin, staff | Ver preço e observações do contrato da matrícula |
| `reports.view` | owner, admin, staff | Relatórios de gestão e exportação CSV |

Um `instructor` pode receber capacidades pontuais (por exemplo `reports.view`), mas nunca `finance.manage`.

### Regras

1. **O papel continua sendo o teto.** Não existe capacidade que dê ao `instructor` o que é de `owner` e `admin`. Capacidade só restringe ou libera dentro da faixa do papel, nunca acima do que o papel pode por definição.
2. **Dono sempre tem tudo.** As capacidades do `owner` não podem ser retiradas, para o espaço não ficar sem quem administre o caixa.
3. **Gestor não concede o que não tem.** Um `admin` só marca capacidades que ele mesmo possui, e só para `staff` e `instructor`, seguindo a regra atual de [permissoes.md](permissoes.md).
4. **Mudança registrada.** Cada concessão ou retirada vai para a trilha de auditoria (quem fez, para quem, o que mudou, quando).
5. **Predefinição é o padrão.** Quem não tem ajuste segue exatamente a matriz atual. Isso evita regressão e faz a migração ser só adicionar a tabela de capacidades.

### Modelo de dados (rascunho)

- Tabela `organization_user_capabilities` com `organization_user_id`, `capability` e `granted` (booleano). Sem linha, vale a predefinição do papel.
- Ou uma coluna JSON `capabilities` em `organization_user`, se a lista ficar pequena. Decidir na implementação.

### Onde muda o código

- **API:** `MembershipRole` ganha uma consulta do tipo `can(User, Organization, Capability)`. As policies e o `FinanceAccess` passam a consultar capacidades em vez de checar só o papel. Um teste de matriz garante que o padrão não mudou.
- **Web:** na tela de membros, uma seção "Acessos" com as capacidades listadas em texto (ícone e rótulo, não só cor), e um aviso quando o ajuste estiver fora do padrão do papel.
- **Auditoria:** novo tipo de evento para alteração de capacidade.

## Fora desta proposta

- **Financeiro por instrutor (comissão ou repasse por aula):** é outra funcionalidade. Depende de uma regra de comissão por instrutor e de um relatório próprio. Pode ser proposta separadamente depois.
- **Permissões por recurso específico** (por exemplo, uma aluna só para um instrutor): hoje já existe a regra de atribuição. Não precisa de capacidade nova.

## Perguntas em aberto

- A capacidade `finance.view` deve incluir o saldo de cada aluno, ou só o caixa do espaço?
- O dono precisa poder dar acesso ao financeiro para um contador externo, sem vínculo como funcionário? Isso seria outro tipo de convite.
- Vale limitar o número de capacidades para manter a tela simples? A proposta começa com seis.

## Critério para entrar em desenvolvimento

- Pelo menos uma autoescola piloto pediu o ajuste fora do padrão do papel.
- O MVP está fechado e os critérios de lançamento da seção 12 de [modulos-checklist.md](modulos-checklist.md) estão cumpridos.
