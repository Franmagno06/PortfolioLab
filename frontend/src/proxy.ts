import { NextResponse, type NextRequest } from "next/server";

// Proteção de rotas no Next (arquivo "proxy" é a convenção do Next 16,
// antes chamado "middleware"): verifica a PRESENÇA do cookie de sessão.
// A validação real do token (assinatura, expiração) acontece no backend —
// o frontend não tem (nem deve ter) o segredo do JWT.
//
// Aqui também nascem os cabeçalhos de segurança que variam por requisição.
// Os fixos ficam no next.config.ts.

const rotasPublicas = ["/login", "/registro"];

/**
 * Content-Security-Policy da aplicação.
 *
 * Sem nonce, de propósito. O caminho com nonce está nos docs do Next, mas
 * exige renderização dinâmica: o nonce precisa entrar nas tags <script> no
 * momento do render. As páginas deste app são prerenderizadas (`○ Static` no
 * build) — são cascas "use client" que buscam dados depois —, então o HTML sai
 * sem nonce nenhum. Um `'strict-dynamic'` com nonce faria o navegador recusar
 * justamente os scripts do Next e a página não hidrataria. Verificado servindo
 * o build e olhando as tags: nenhuma trazia o atributo.
 *
 * O que esta política entrega, então: `'self'` em script e connect fecha
 * origem externa — um script injetado não consegue carregar código de fora nem
 * enviar a carteira do usuário para outro host. `frame-ancestors 'none'` mata
 * clickjacking. Não impede script inline, e é por isso que `'unsafe-inline'`
 * está declarado em script-src: sem ele o Next não hidrata (ele injeta o
 * payload do RSC inline). Trocar isso por nonce de verdade exige tornar as
 * páginas dinâmicas — vale a pena, mas é outra mudança.
 *
 * `style-src` também aceita inline por necessidade: o Recharts escreve
 * `style=""` nos elementos do SVG. Sem isso os gráficos somem.
 */
function montarCsp(dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // O app fala só com o próprio /api/*, que o next.config reescreve para o
    // backend. Em dev, o HMR do Next usa websocket.
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const CSP = montarCsp(process.env.NODE_ENV === "development");

export function proxy(request: NextRequest) {
  const temToken = request.cookies.has("token");
  const { pathname } = request.nextUrl;
  const ehRotaPublica = rotasPublicas.some((rota) => pathname.startsWith(rota));
  // O site institucional na raiz é aberto a todos, logado ou não. Comparação
  // exata: um startsWith("/") liberaria o app inteiro sem sessão.
  const ehSite = pathname === "/";

  // Saída de emergência. Este proxy só sabe se o cookie EXISTE — validar a
  // assinatura exigiria o segredo do JWT no frontend, que não deve estar lá.
  // Com um cookie expirado, "existe" e "vale" divergem: o usuário era mandado
  // para /dashboard, tudo ali devolvia 401, e /login o trazia de volta para o
  // dashboard. Travamento sem saída, a não ser apagar o cookie no DevTools.
  //
  // Quem chega com este marcador foi mandado por lib/api.ts depois de um 401,
  // então já sabemos que o cookie não vale, ainda que esteja lá. O redireciona-
  // mento "já logado → dashboard" é o que trava, e é só ele que se suspende.
  const sessaoExpirada = request.nextUrl.searchParams.has("expirada");

  const resposta = (() => {
    // sem sessão tentando acessar área logada → vai para o login
    if (!temToken && !ehRotaPublica && !ehSite) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // já logado tentando ver login/registro → vai para o dashboard
    if (temToken && ehRotaPublica && !sessaoExpirada) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  })();

  resposta.headers.set("Content-Security-Policy", CSP);
  return resposta;
}

export const config = {
  // Roda em todas as rotas de página, menos API, build do Next e os SVGs que
  // sobraram do create-next-app.
  //
  // O padrão anterior era `/((?!api|_next|favicon.ico|.*\..*).*)`. A
  // alternativa `.*\..*` — "qualquer caminho com um ponto" — fazia o Next
  // descartar o matcher inteiro em silêncio: o proxy não rodava em rota
  // nenhuma e a área logada respondia 200 sem cookie de sessão. Não havia erro
  // no build, que seguia listando "ƒ Proxy (Middleware)".
  //
  // Esta é a forma dos docs do Next 16 (extensão literal ancorada em $), a
  // única de três variantes testadas que de fato casa. Ao mexer aqui, confirme:
  //   curl -o /dev/null -w "%{http_code}" localhost:3000/dashboard
  // sem cookie tem de dar 307, não 200.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\.svg$).*)"],
};
