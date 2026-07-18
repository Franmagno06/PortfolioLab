import { NextResponse, type NextRequest } from "next/server";

// Proteção de rotas no Next (arquivo "proxy" é a convenção do Next 16,
// antes chamado "middleware"): verifica a PRESENÇA do cookie de sessão.
// A validação real do token (assinatura, expiração) acontece no backend —
// o frontend não tem (nem deve ter) o segredo do JWT.

const rotasPublicas = ["/login", "/registro"];

export function proxy(request: NextRequest) {
  const temToken = request.cookies.has("token");
  const { pathname } = request.nextUrl;
  const ehRotaPublica = rotasPublicas.some((rota) => pathname.startsWith(rota));

  // sem sessão tentando acessar área logada → vai para o login
  if (!temToken && !ehRotaPublica) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // já logado tentando ver login/registro → vai para o dashboard
  if (temToken && ehRotaPublica) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // roda em todas as rotas de página (ignora /api, arquivos estáticos e assets)
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
