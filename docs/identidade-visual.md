# Identidade visual (Rota Certa Gestão)

Referência para o `apps/web`. Os valores estão em [apps/web/src/styles/_brand.scss](../apps/web/src/styles/_brand.scss) e são aplicados ao Bootstrap em [apps/web/src/styles/theme.scss](../apps/web/src/styles/theme.scss). Se mudar uma cor, mude nos dois lugares só se for alterar o tema; as telas devem usar sempre os papéis abaixo, nunca cores soltas.

> Status: ✅ definida e aplicada ao Bootstrap, nos modos claro e escuro.

## Conceito

Azul-petróleo com âmbar, fundos claros e bastante espaço entre os elementos. O azul dá aparência profissional à gestão; o âmbar remete à sinalização de trânsito e destaca as ações importantes.

## Cores

| Papel | Cor | Uso | Variável Sass |
|---|---|---|---|
| Primária | Azul-petróleo `#123B4A` | Botões principais, navegação e seleção | `$brand-primary` |
| Destaque | Âmbar `#F5B942` | Detalhes da marca e destaques pontuais | `$brand-accent` |
| Fundo | Cinza-claro `#F5F7FA` | Fundo das páginas | `$brand-bg` |
| Superfície | Branco `#FFFFFF` | Cards, tabelas e formulários | `$brand-surface` |
| Texto principal | Grafite `#172B36` | Títulos e conteúdo | `$brand-text` |
| Texto secundário | Cinza-azulado `#526574` | Legendas e informações auxiliares | `$brand-text-muted` |
| Bordas | Cinza `#DCE3E9` | Separação de componentes | `$brand-border` |

Regras:

- Botão principal: fundo azul-petróleo com texto branco (`variant="primary"`).
- Elementos em âmbar: texto azul-petróleo por cima (`variant="accent"`). Nunca texto branco sobre âmbar.

### Estados

As cores de estado ficam separadas da identidade. **Sempre acompanhe a cor de texto ou ícone**: "Concluída", "Agendada", "Cancelada".

| Estado | Cor | Exemplo | Variável Sass |
|---|---|---|---|
| Sucesso | Verde `#15803D` | Aula concluída, pagamento recebido | `$status-success` |
| Atenção | Marrom-âmbar `#92400E` | Documento próximo do vencimento | `$status-warning` |
| Erro | Vermelho `#B91C1C` | Documento vencido, falha no cadastro | `$status-danger` |
| Informação | Azul `#1D4ED8` | Aula agendada | `$status-info` |

## Aparência

- **Fonte:** Inter em todo o app. Horários e valores usam números tabulares (classe `tabular-nums`), sem segunda fonte.
- **Tamanhos:** 14 px para informações auxiliares (`small`), 16 px para conteúdo e formulários, 20 a 28 px para títulos (`h3` a `h1`).
- **Espaçamento:** escala de 4, 8, 12, 16, 24 e 32 px. Use as classes de espaçamento do Bootstrap (`m-1` a `m-6`, `p-1` a `p-6`), que seguem essa escala.
- **Bordas:** 8 px em campos e botões; 12 px em cards.
- **Sombras:** leves. A principal separação é a borda discreta.
- **Web:** menu lateral azul-petróleo, área de trabalho clara e tabelas fáceis de ler.
- **Mobile:** fundo claro, navegação simples e ação "Agendar aula" bem visível.
- **Tema:** claro, escuro ou automático (segue o sistema). O app troca o atributo `data-bs-theme` do `<html>`; a escolha fica só no navegador (`localStorage`, chave `rc-theme`) e é aplicada por um script em `index.html` antes da primeira pintura. O seletor está no menu lateral e nas telas de login.

## Modo escuro

| Papel | Cor | Variável Sass |
|---|---|---|
| Primária (botões, links, seleção) | Azul `#5BB8D4`, texto `#0B2530` por cima | `$dark-primary`, `$dark-primary-contrast` |
| Fundo | `#0F1A21` | `$dark-bg` |
| Superfície (cards, tabelas, menu) | `#16242D` | `$dark-surface` |
| Texto principal / secundário | `#E6EDF2` / `#A3B5C2` | `$dark-text`, `$dark-text-muted` |
| Bordas | `#2B3E4A` | `$dark-border` |

O âmbar e as cores de estado são os mesmos nos dois modos. Use `bg-surface` (e não `bg-white`) para superfícies e variáveis `--rc-*` em estilos próprios.

## Logos

Em `apps/web/src/assets/images/`. Os originais (`logo-horizontal.png`, `logo-symbol.png`, `app-icon.png`) são as fontes; o app usa as versões otimizadas `-light` e `-dark` (a escura troca o azul-petróleo por branco-gelo e mantém o âmbar), mostradas pelo componente `Logo` conforme o tema. `app-icon-512.png` e `apple-touch-icon.png` são o favicon.

## Como usar no código

```tsx
<Button variant="primary">Salvar</Button>
<Button variant="accent">Agendar aula</Button>
<Badge bg="success"><i className="bi bi-check-circle-fill me-1" aria-hidden="true" />Concluída</Badge>
<span className="tabular-nums">08:30</span>
```

Variantes do Bootstrap disponíveis como tema: `primary`, `secondary`, `accent`, `success`, `info`, `warning`, `danger`, `light`, `dark`.
