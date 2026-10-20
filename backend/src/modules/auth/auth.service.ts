import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { ehEmailDaDemo } from "../../shared/conta-demo.js";
import { AppError } from "../../shared/errors/AppError.js";
import { authRepository } from "./auth.repository.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";

// 12 rodadas: ~250ms por hash num servidor modesto. É o piso recomendado hoje
// (OWASP) — com 10, uma GPU moderna testa candidatos rápido o bastante para
// que uma senha fraca vazada no banco caia em horas. O custo só pesa no
// registro e no login, uma vez cada.
//
// Hash já gravado com 10 continua válido: o bcrypt.compare lê o custo do
// próprio hash. Quem se registrou antes segue entrando; para migrar, seria
// preciso re-hashear no login bem-sucedido, o que não está feito aqui.
const CUSTO_BCRYPT = 12;

// Regra de negócio pura — não conhece HTTP (nem req, nem res, nem cookie)
export const authService = {
  async register(input: RegisterInput) {
    // O e-mail da demo (e qualquer variação de caixa dele) nunca é cadastrável:
    // a conta é do seed-demo, e uma "Carteira@..." viraria outra demo.
    const jaExiste =
      ehEmailDaDemo(input.email) || (await authRepository.findByEmail(input.email)) !== null;
    if (jaExiste) {
      throw new AppError("E-mail já cadastrado", 409);
    }

    const user = await authRepository.create({
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, CUSTO_BCRYPT),
    });

    // O hash da senha NUNCA sai do service
    return { id: user.id, name: user.name, email: user.email };
  },

  async login(input: LoginInput) {
    const user = await authRepository.findByEmail(input.email);

    // Mesma mensagem para e-mail inexistente e senha errada:
    // não dar pista de qual dos dois falhou (evita enumeração de contas)
    const senhaConfere =
      user !== null && (await bcrypt.compare(input.password, user.passwordHash));
    if (!user || !senhaConfere) {
      throw new AppError("E-mail ou senha incorretos", 401);
    }

    // A demo leva a claim demo: true (somente leitura, ver somente-leitura-na-demo.ts).
    // As outras contas seguem com o token de antes, sem a claim.
    const claims = ehEmailDaDemo(user.email) ? { sub: user.id, demo: true } : { sub: user.id };
    const token = jwt.sign(claims, env.JWT_SECRET, { expiresIn: "7d" });
    return { token, user: { id: user.id, name: user.name, email: user.email } };
  },

  async getProfile(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError("Usuário não encontrado", 404);
    }
    // demo vem do e-mail no banco, não do token: um token antigo, sem a claim,
    // ainda mostra a flag certa.
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      demo: ehEmailDaDemo(user.email),
    };
  },

  /** Usado pelo middleware somenteLeituraNaDemo em escrita sem a claim. */
  async ehContaDemo(userId: string): Promise<boolean> {
    const user = await authRepository.findById(userId);
    return user !== null && ehEmailDaDemo(user.email);
  },
};
