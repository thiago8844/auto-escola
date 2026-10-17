# Convenções do projeto

Comitar somente quando eu pedir

## Commits
- Seguir Conventional Commits: `tipo(escopo): descrição`
- Tipos permitidos: feat, fix, refactor, docs, test, chore, ci, perf
- Escopo é o app ou pacote alterado: api, web, shared, infra
- Descrição no imperativo, em português, até ~72 caracteres
- Se a mudança afetar mais de um escopo, criar commits separados
- Nunca incluir linha "Co-Authored-By" ou "Generated with Claude Code"

## Branches
- Nunca commitar direto na master
- Nome: `feat/<escopo>-<assunto>` ou `fix/<escopo>-<assunto>`
- Exemplo: `feat/api-pedidos`

## Monorepo
- Apps ficam em `apps/` e pacotes compartilhados em `packages/`
- Antes de commitar, rodar os testes do app alterado

