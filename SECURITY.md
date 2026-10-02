# Segurança

Este arquivo registra a postura de segurança do PortfolioLab e, principalmente,
as decisões de **não** corrigir algo agora — que é o tipo de informação que se
perde entre auditorias.

## Controles em vigor

| Superfície | Controle | Onde |
|---|---|---|
| Sessão | JWT em cookie `httpOnly` + `secure` + `SameSite=Strict`, 7 dias | `auth.controller.ts` |
| Senha | bcrypt com 12 rodadas | `auth.service.ts` |
| Força bruta | 10 tentativas / 15 min por IP | `rate-limit.ts` |
| Cota de IA | 20 análises / hora por usuário | `rate-limit.ts` |
| Autorização | todo `remove`/`get` por id filtra `userId` antes de agir | services |
| Entrada | Zod na borda HTTP; ticker restrito a `[A-Z0-9]{4,12}` | `shared/ticker.ts` |
| Upload | só `application/pdf`, teto de 25 MB, memória (nunca disco) | `reports.routes.ts` |
| URL de terceiro | link de RSS só passa com esquema `http`/`https` | `news/rss.ts` |
| Cabeçalhos (API) | helmet: nosniff, HSTS, Referrer-Policy, sem `X-Powered-By` | `app.ts` |
| Cabeçalhos (web) | HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy | `next.config.ts` |
| CSP | `default-src 'self'`, `frame-ancestors 'none'` | `frontend/src/proxy.ts` |
| Segredo | `JWT_SECRET` recusa placeholder e < 32 caracteres em produção | `config/env.ts` |

O isolamento entre usuários é feito **na aplicação**, não no banco: não há RLS.
Um `where` sem `userId` num repository vaza carteira de outro usuário sem que
nada no Postgres impeça. É por isso que `revisor-camadas` e
`auditar-calculo-financeiro` existem como skills deste projeto.

## Limitações conhecidas e aceitas

**CSP com `'unsafe-inline'` em `script-src`.** O caminho com nonce está nos docs
do Next, mas exige renderização dinâmica; as páginas deste app são
prerenderizadas e o HTML sai sem nonce, então `'strict-dynamic'` bloquearia os
próprios scripts do Next e a página não hidrataria (verificado). A política
ainda fecha origem externa em `script-src` e `connect-src`, o que impede um
script injetado de carregar código de fora ou exfiltrar dados. Subir para nonce
de verdade depende de tornar as páginas dinâmicas.

**Rate limit em memória.** `express-rate-limit` sem store compartilhado conta
por processo. Com uma instância só, funciona. No dia em que a API rodar em duas,
o teto real passa a ser `max × instâncias` — aí o limitador precisa de Redis.

## Deferrals

### `deepmerge-ts` (high) via `@prisma/config` → `prisma`

- **Advisory:** [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) — esgotamento de pilha ao mesclar grafos recursivos.
- **Por que não corrigido:** a correção exige Prisma 7 ou 8; o projeto está em `^6.5.0`. É major, com migração de schema e de API própria — não cabe dentro de uma auditoria de segurança.
- **Por que dá para esperar:** `prisma` é **devDependency** — é a CLI (`migrate`, `generate`, `studio`). O runtime é `@prisma/client`, que não está na cadeia. O caminho vulnerável só é alcançado pela CLI mesclando configuração local; nada de entrada não confiável chega lá em produção.
- **Revisar em:** março de 2027, ou antes se a cadeia passar a atingir `@prisma/client`.

## Como reauditar

```bash
cd backend  && npm audit   # e `npm audit fix` sem --force
cd frontend && npm audit
```

`npm audit fix --force` não deve ser usado sem ler o que ele atravessa: no
frontend ele resolvia tudo subindo o Next, o que aqui foi feito de propósito e
verificado, mas em outro momento pode arrastar um major.
