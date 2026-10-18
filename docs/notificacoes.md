# Avisos e notificações (web)

Como lançar avisos no `apps/web`: toasts, o sino (central de notificações) e o alerta máximo. Tudo aqui é para **quem usa o sistema** (gestor, equipe, instrutor), não para os clientes (alunos).

> Status: ✅ base implementada no web. ✅ Pendências reais: dentro de um espaço o sino lê da API (`/alerts`), com leitura e arquivo por usuário guardados no servidor. Veja a seção "Pendências reais" abaixo.

Os alertas financeiros entram junto com o financeiro, último módulo do MVP (o motor aceita novos detectores via `AlertEngine::register`).

## Os três tipos de aviso

| Tipo | Onde aparece | Quando usar |
|---|---|---|
| **Toast** | Balão no canto superior direito | Resultado de uma ação ou aviso rápido ("Salvo", "Falha ao enviar") |
| **Notificação (sino)** | Ícone de sino no topo, com contador de não lidas | Algo que o usuário precisa poder rever depois ("Aula amanhã às 9h", "Documento vencendo") |
| **Alerta máximo** | Modal que bloqueia a tela até o usuário confirmar | Situação grave que não pode passar batida (mensalidade vencida, bloqueio em 5 dias) |

Todos passam por um ponto único: `notices`, em [`lib/notices.ts`](../apps/web/src/lib/notices.ts).

## Lançando avisos

```ts
import { notices } from '../lib/notices'

// Toast que fecha sozinho (padrão por tipo)
notices.toast({ type: 'success', message: 'Aluno cadastrado.' })

// Toast que só fecha no X
notices.toast({ type: 'warning', title: 'CRLV vencendo', message: 'O veículo ABC1D23 vence em 7 dias.', mode: 'sticky' })

// Notificação no sino
notices.inbox({ id: 'lesson-123-tomorrow', type: 'reminder', title: 'Aula amanhã às 09:00', message: 'Maria Souza · Categoria B', action: { label: 'Ver aula', to: '/espacos/1/agenda/123' } })

// Sino + toast ao mesmo tempo
notices.notify({ id: 'doc-7-expiring', type: 'warning', title: 'Documento vencendo' })

// Alerta máximo
notices.critical({
  id: 'billing-overdue',
  title: 'Mensalidade vencida',
  message: 'Se não for regularizada, o acesso ao sistema será bloqueado.',
  details: ['Venceu em 10/10', 'Bloqueio em 5 dias'],
  action: { label: 'Ver pagamento', to: '/configuracoes' },
})
```

Para o caso comum (um texto, tipo padrão) existe o atalho `notify.success('...')`, `notify.error('...')`, `notify.warning('...')`, `notify.info('...')` e `notify.reminder('...')`, em [`stores/toastStore.ts`](../apps/web/src/stores/toastStore.ts). É o que o resto do app já usa.

## Tipos visuais

Definidos em [`config/notices.ts`](../apps/web/src/config/notices.ts), com ícone, cor e duração padrão. Cor sempre vem junto de ícone e texto.

| `type` | Uso | Duração padrão (modo auto) |
|---|---|---|
| `success` | Ação concluída | 4 s |
| `info` | Informação neutra | 5 s |
| `reminder` | Lembrete (aula, prazo) | 6 s |
| `warning` | Alerta: atenção, sem ser erro | 7 s |
| `error` | Algo falhou | 8 s |

Para um tipo novo: acrescente-o em `NoticeType` ([`types/notice.ts`](../apps/web/src/types/notice.ts)), em `NOTICE_TYPES` e uma cor em `$notice-colors` / `$notice-colors-dark` ([`styles/_notifications.scss`](../apps/web/src/styles/_notifications.scss)).

## Toasts

- **Posição e empilhamento:** canto superior direito. O aviso novo entra **embaixo** dos que já estão na tela. No máximo 5 ao mesmo tempo (`MAX_VISIBLE_TOASTS`); os demais esperam vaga e aparecem quando algum fecha.
- **`mode: 'auto'`** (padrão): fecha sozinho depois de `duration` ms, com uma barra de tempo. Passar o mouse ou focar pausa a contagem.
- **`mode: 'sticky'`**: só fecha no **X**. Se o usuário não passar o mouse (nem focar) em 5 segundos, o aviso fica mais transparente; ao passar o mouse volta ao normal. Serve para garantir que a pessoa viu.
- **`key`**: mesma chave substitui o toast antigo em vez de empilhar outro. Sem `key`, o mesmo tipo + texto repetido é ignorado (evita 5 avisos iguais quando várias requisições falham juntas).
- **`action`**: botão no aviso, com `to` (rota interna) ou `onClick`.
- **`muteKey`**: mostra "Não mostrar novamente" (ver abaixo).

## O sino

[`NotificationBell`](../apps/web/src/components/NotificationBell.tsx) fica no topo da área de trabalho (desktop) e na barra superior (celular). Mostra o contador de não lidas e abre um painel com a lista, "marcar como lida", "marcar todas como lidas" e remover. No celular o painel ocupa a largura da tela.

A lista vive em [`stores/notificationStore.ts`](../apps/web/src/stores/notificationStore.ts), em memória:

| Função | O que faz |
|---|---|
| `add(notification)` | Adiciona (ou atualiza, pelo `id`). `createdAt` e `readAt` são opcionais |
| `setAll(items)` | Troca a lista inteira (ex.: resposta da API) |
| `markRead(id)`, `markAllRead()` | Marcam como lida |
| `remove(id)`, `clear()` | Removem |

Para gerar uma notificação **no front** (ex.: a partir de dados que o app já tem), basta `notices.inbox(...)` ou `notices.notify(...)` com um `id` estável, para não duplicar.

## Pendências reais (módulo 5)

Dentro de um espaço, o sino mostra as **pendências** geradas pela API ([detalhes em `apps/api/docs/api.md`](../apps/api/docs/api.md#pendências-e-alertas-módulo-5)): documentos e CRLV vencendo, revisão de veículo, bloqueios com compromissos afetados, exames próximos e sem resultado, taxas, saldo baixo, aulas sem desfecho e outras. O servidor recalcula tudo a cada 10 minutos e a pendência some sozinha quando é resolvida.

- **Sino e página Pendências:** `NotificationBell` e `pages/alerts/AlertsPage`. Ler, marcar todas e arquivar ficam salvos por usuário: valem em outro navegador ou depois de um novo login. "Abrir" leva ao registro de origem (`utils/alertPath.ts`).
- **Como avisam sem atrapalhar:** `hooks/useAlertWatcher.ts` recalcula ao entrar, a cada 5 minutos e 3 s depois de qualquer alteração. Pendência **urgente** (`critical`) não lida abre o **alerta máximo** (confirmar marca como lida); as demais novas viram um **balão** (até 3), com "Não mostrar novamente" (`alerts.toast`). Lembretes comuns nunca bloqueiam a tela.
- **Fora de um espaço** (ex.: Minha agenda) o sino mostra só os avisos da sessão (`notices.inbox`/`notices.notify`).
- **Antecedência e destinatários:** *Dados do espaço* > Pendências e alertas.

## Alerta máximo

[`CriticalAlertHost`](../apps/web/src/components/CriticalAlertHost.tsx): modal sem X, que não fecha ao clicar fora nem com Esc. Só some quando o usuário clica em **confirmar** (`confirmLabel`, padrão "Entendi"). Opções: `severity` (`danger` ou `warning`), `details` (lista de pontos), `action` (botão extra, como "Ver pagamento") e `muteKey`. Vários alertas entram em **fila**, um de cada vez; o mesmo `id` não entra duas vezes.

Use só para o que realmente exige atenção. Não coloque `muteKey` em avisos que o usuário não pode ignorar (ex.: bloqueio iminente).

## "Não mostrar novamente"

Passe `muteKey` em um toast ou alerta máximo e o aviso passa a oferecer a opção. Ao escolher, a chave é gravada nas preferências do usuário e `notices.toast`/`notices.critical` com essa chave deixam de mostrar o aviso.

- **Preferências por usuário:** [`stores/preferencesStore.ts`](../apps/web/src/stores/preferencesStore.ts) (`isMuted`, `mute`, `unmute`, `unmuteAll`). Carregadas ao entrar e zeradas ao sair ([`lib/initNotices.ts`](../apps/web/src/lib/initNotices.ts)).
- **Onde ficam gravadas:** [`lib/preferencesStorage.ts`](../apps/web/src/lib/preferencesStorage.ts), hoje no `localStorage` do navegador (`rc-prefs:<id do usuário>`). **Quando a API tiver preferências, troque só `load`/`save` desse arquivo por chamadas HTTP.** O formato (`UserPreferences`) já está pensado para isso, e novos tipos de preferência entram nele.
- **Tela de configuração:** Configurações > **Avisos ocultos** lista o que foi silenciado e permite reativar. Cadastre cada chave em `MUTABLE_NOTICES` ([`config/notices.ts`](../apps/web/src/config/notices.ts)) com um nome legível; sem cadastro, a tela mostra a própria chave.

Convenção de chave: `área.assunto`, ex.: `billing.due-soon`, `agenda.tip-filters`.

## Ao sair da conta

`initNotices` limpa toasts, notificações e alertas e recarrega as preferências do próximo usuário. Nada de um usuário aparece para outro no mesmo navegador.

## Página de teste

Em desenvolvimento (`npm run dev`) existe `/_testes/toasts` (precisa estar logado): botões para todos os tipos, empilhamento, ação, "não mostrar novamente", sino e alerta máximo. É **temporária**. Para remover: apague `src/pages/_testes`, `src/config/testRoutes.tsx` e as duas linhas de `testRoutes` em `config/routes.tsx`. Ela nunca entra no build de produção.

## Mapa dos arquivos

| Arquivo | Papel |
|---|---|
| `lib/notices.ts` | Ponto único para lançar avisos |
| `stores/toastStore.ts`, `components/ToastHost.tsx`, `ToastItem.tsx` | Toasts |
| `stores/notificationStore.ts`, `components/NotificationBell.tsx` | Sino |
| `stores/criticalStore.ts`, `components/CriticalAlertHost.tsx` | Alerta máximo |
| `stores/preferencesStore.ts`, `lib/preferencesStorage.ts`, `components/MutedNoticesSettings.tsx` | "Não mostrar novamente" |
| `config/notices.ts`, `types/notice.ts`, `styles/_notifications.scss` | Tipos, configuração e aparência |
| `components/RootLayout.tsx` | Monta a camada de avisos acima de todas as telas |
