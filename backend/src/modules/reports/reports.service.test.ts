import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "../../shared/errors/AppError.js";
import { reportsRepository } from "./reports.repository.js";
import { COTA_RELATORIOS, reportsService } from "./reports.service.js";

// Achado 8: além do teto por requisição, uma cota de relatórios ARMAZENADOS por
// usuário. A cota é uma comparação de inteiro — não precisa de banco para ser
// provada, e neste repositório *.service.test.ts significa teste puro
// (cf. portfolio.service.test.ts). O que a suíte precisa saber é quantos
// relatórios o usuário tem; de onde esse número vem é problema do repository.
function comRelatoriosGuardados(quantidade: number) {
  return vi.spyOn(reportsRepository, "countByUser").mockResolvedValue(quantidade);
}

/** Buffer irrelevante: a cota é conferida antes de qualquer leitura dele. */
const arquivoQualquer = { originalname: "irrelevante.pdf", buffer: Buffer.from("") };

const statusDe = async (userId: string) =>
  reportsService
    .analisar(userId, arquivoQualquer)
    .then(() => undefined)
    .catch((e: AppError) => e.statusCode);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cota de relatórios por usuário", () => {
  it("recusa com 429 quem já está na cota", async () => {
    comRelatoriosGuardados(COTA_RELATORIOS);

    expect(await statusDe("usuario-qualquer")).toBe(429);
  });

  it("recusa também quem passou da cota", async () => {
    comRelatoriosGuardados(COTA_RELATORIOS + 10);

    expect(await statusDe("usuario-qualquer")).toBe(429);
  });

  it("a mensagem diz o que fazer para voltar a analisar", async () => {
    comRelatoriosGuardados(COTA_RELATORIOS);

    await expect(
      reportsService.analisar("usuario-qualquer", arquivoQualquer),
    ).rejects.toThrow(/apag/i);
  });

  it("quem está um abaixo da cota passa pela checagem", async () => {
    comRelatoriosGuardados(COTA_RELATORIOS - 1);

    // segue o fluxo e falha adiante, no PDF vazio — o que importa é não ser 429
    expect(await statusDe("usuario-qualquer")).not.toBe(429);
  });

  it("a cota é contada por usuário", async () => {
    const espia = comRelatoriosGuardados(0);

    await statusDe("usuario-especifico");

    expect(espia).toHaveBeenCalledWith("usuario-especifico");
  });
});
