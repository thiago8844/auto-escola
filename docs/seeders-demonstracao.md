# Seeders de demonstração

## Instrutor autônomo

No diretório `apps/api`, com as migrations aplicadas:

```bash
php artisan migrate --no-interaction
php artisan db:seed --class=InstrutorDemoSeeder --no-interaction
```

O comando só roda em `local` ou `testing`. Ele não é chamado por `DatabaseSeeder`. A autenticação usa e-mail, não há campo de login separado: entre com `instruteste@example.com` e senha `123`. O nome exibido é Rafael Andrade. A senha passa pelo cast `hashed` do modelo `User`; as regras globais de senha não são alteradas.

O espaço pessoal inclui 48 alunos com processos e matrículas em etapas diferentes, 2 veículos da categoria B, 2 CFCs fictícias cadastradas como parceiros locais, 40 pacotes de 20 aulas, cerca de 520 aulas (8 por dia útil, seg a sáb, das 08h às 12h e das 13h às 17h), 5 exames futuros com taxas externas, 5 documentos fictícios em disco privado, bloqueio de disponibilidade, receitas, despesas, pagamentos, parcelas em aberto, alertas e trilha de auditoria. A agenda tem aulas realizadas, faltas, cancelamentos, uma remarcação, compromisso de hoje e datas futuras. O pacote de um aluno tem saldo quase esgotado. Os documentos são amostras de texto identificadas como fictícias; nenhum documento oficial real é fabricado.

As datas são recalculadas a cada execução a partir da data local em `autoescola.default_timezone`. Aulas e bloqueios são gravados em UTC. O histórico cobre 45 dias anteriores e a agenda futura, 30 dias. Domingos ficam livres, e às 17h sobra um horário para remarcações. A geração é determinística, exceto pelos IDs e pelo diretório único dos arquivos.

## Limpeza e isolamento

A tabela `demo_datasets` marca explicitamente o espaço e sua conta principal; `demo_dataset_users` marca todas as contas pertencentes à demonstração. O seeder substitui somente a chave `instrutor` numa transação. A limpeza remove dependências do espaço na ordem das chaves estrangeiras, depois os vínculos, perfis e contas marcadas. Não procura registros por nomes ou datas e não usa `migrate:fresh`, truncamento geral ou desativação das chaves estrangeiras. Arquivos antigos da demonstração são removidos após a substituição bem-sucedida. Se o e-mail estiver ocupado por uma conta sem marcador, ou se membros/perfis externos estiverem associados ao espaço, ou se alguma conta/perfil marcado tiver vínculo com outro espaço, a operação falha e o banco mantém a demonstração anterior. Dados e contas externas não são excluídos.

## Próxima etapa: CFC

`DemoDataset::replace('cfc', 'cfcteste@example.com', ...)` é o ponto compartilhado preparado para o futuro `CfcDemoSeeder`. O callback devolverá a conta principal, o espaço e a lista de contas adicionais criadas; todas serão marcadas em `demo_dataset_users`. A chave `cfc` terá conta e espaço próprios. O seeder da CFC, seus perfis adicionais, credenciais e o comando combinado ainda não existem. O seeder legado `DemoSeeder` também permanece separado e não participa dessa limpeza.

## Limites dos dados atuais

Os parceiros representam apenas o cadastro local de CFCs externas; não criam contas CFC nem vínculo entre organizações, pois o fluxo existente não faz essa associação. Não são gerados convites nem documentos oficiais verdadeiros. Os anexos são exemplos de demonstração em texto simples, e a conferência do checklist é marcada como dado fictício. O `CfcDemoSeeder` deverá preencher seus módulos e perfis na próxima etapa, usando a mesma rotina de posse e limpeza.
