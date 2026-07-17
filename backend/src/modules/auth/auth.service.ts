import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import { authRepository } from "./auth.repository.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";

// Regra de negócio pura — não conhece HTTP (nem req, nem res, nem cookie)
export const authService = {
  async register(input: RegisterInput) {
    const jaExiste = await authRepository.findByEmail(input.email);
    if (jaExiste) {
      throw new AppError("E-mail já cadastrado", 409);
    }

    const user = await authRepository.create({
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 10),
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

    const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: "7d" });
    return { token, user: { id: user.id, name: user.name, email: user.email } };
  },

  async getProfile(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError("Usuário não encontrado", 404);
    }
    return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
  },
};
