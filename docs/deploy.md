# Guia de Deploy

Como o PortfolioLab é dividido em três peças, o deploy tem três partes:

| Peça | Onde já está / vai |
|------|--------------------|
| Banco de dados | **Supabase** (já em produção) |
| Backend (API Express) | a definir — Render, Railway ou Fly.io |
| Frontend (Next.js) | a definir — Vercel é o encaixe natural |

## Por que o frontend faz proxy do backend

O `next.config.ts` reescreve `/api/*` para o endereço do backend. O navegador
enxerga tudo na **mesma origem**, então:

- não há CORS para configurar;
- o cookie de sessão continua com `SameSite=Strict`, a opção mais segura.

Se em vez disso o frontend chamasse o backend direto em outro domínio, seria
preciso `SameSite=None` + `Secure` + configuração de CORS com credenciais — mais
peças para errar. Por isso o proxy foi mantido em produção.

## Variáveis de ambiente

### Backend

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `DATABASE_URL` | ✅ | String do Supabase (use o **Session pooler**) |
| `JWT_SECRET` | ✅ | Gere um valor forte: `openssl rand -base64 32` |
| `NODE_ENV` | ✅ | `production` — é o que liga o `secure` no cookie |
| `PORT` | — | A maioria das plataformas injeta sozinha |
| `GEMINI_API_KEY` | — | Sem ela, só o módulo de relatórios fica indisponível |
| `GEMINI_MODEL` | — | Padrão: `gemini-3.6-flash` |

> ⚠️ **Nunca reaproveite o `JWT_SECRET` de desenvolvimento em produção.** Quem
> tem o segredo consegue forjar sessão de qualquer usuário.

### Frontend

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `API_URL` | ✅ | URL pública do backend, sem barra no fim |

## Passo a passo

### 1. Backend

Comandos que a plataforma precisa rodar:

```bash
# build
npm ci && npx prisma generate && npm run build

# start
npm start
```

O `prisma generate` é obrigatório no build — o Prisma Client é gerado a partir
do schema e não vai versionado.

Health check: `GET /health` responde `{"status":"ok"}`.

### 2. Frontend

```bash
# build
npm ci && npm run build

# start
npm start
```

Defina `API_URL` apontando para o backend **antes** do build.

### 3. Banco

O schema já está aplicado no Supabase. Para mudanças futuras:

```bash
npx prisma db push
```

> O plano gratuito do Supabase **hiberna o projeto após ~1 semana sem uso**.
> Com o app publicado e recebendo acessos isso deixa de acontecer, mas se ficar
> parado, reative pelo painel (ver "Problemas comuns" no README).

## Checklist antes de publicar

- [ ] `JWT_SECRET` novo, gerado para produção
- [ ] `NODE_ENV=production` no backend
- [ ] `API_URL` no frontend apontando para a URL pública do backend
- [ ] `npm test` passando localmente
- [ ] `.env` **não** commitado (já está no `.gitignore`)
- [ ] Trocar a senha do usuário demo, ou removê-lo do seed de produção

## Custos

Todas as opções abaixo têm plano gratuito suficiente para um projeto de
portfólio. O ponto de atenção é que planos gratuitos costumam **hibernar** o
serviço após inatividade — a primeira requisição depois disso demora alguns
segundos (cold start).
