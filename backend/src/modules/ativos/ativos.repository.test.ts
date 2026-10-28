import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../database/prisma.js";
import { indicatorsRepository } from "../indicators/indicators.repository.js";
import { ativosRepository } from "./ativos.repository.js";

// Estes testes escrevem no banco local (Docker), como todo teste que importa o prisma. Usam só
// tickers FICTÍCIOS (ZZAT1, ZZAT2): a tabela assets é global e guarda os ativos reais da carteira
// de demonstração, que nenhum teste pode tocar.
const TICKERS = ["ZZAT1", "ZZAT2"];

const novoAsset = (ticker: string, preco = 10) => ({
  ticker,
  name: `Ativo de teste ${ticker}`,
  type: "ACAO" as const,
  currentPrice: preco,
  cnpj: null,
});

async function limpar() {
  // o cascade apaga as fotografias e os indicadores junto
  await prisma.asset.deleteMany({ where: { ticker: { in: TICKERS } } });
}

beforeAll(limpar);
beforeEach(limpar);
afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("ativosRepository.ensureAsset", () => {
  it("cadastra o ativo na primeira chamada e devolve o mesmo nas seguintes", async () => {
    const primeiro = await ativosRepository.ensureAsset(novoAsset("ZZAT1", 10));
    const segundo = await ativosRepository.ensureAsset(novoAsset("ZZAT1", 99));

    expect(segundo.id).toBe(primeiro.id);
    expect(await prisma.asset.count({ where: { ticker: "ZZAT1" } })).toBe(1);
  });

  it("não sobrescreve o preço de um ativo que já existe (update vazio)", async () => {
    await ativosRepository.ensureAsset(novoAsset("ZZAT1", 10));
    const de_novo = await ativosRepository.ensureAsset(novoAsset("ZZAT1", 99));

    expect(de_novo.currentPrice.toNumber()).toBe(10);
  });

  it("visitas simultâneas à mesma ficha, ambas sem o ativo no banco, não disputam a unique de ticker", async () => {
    // várias rodadas: a corrida só aparece quando as inserções caem juntas, e uma rodada sozinha passa por sorte
    for (let rodada = 0; rodada < 10; rodada++) {
      await limpar();
      const resultados = await Promise.all(
        Array.from({ length: 8 }, () => ativosRepository.ensureAsset(novoAsset("ZZAT1"))),
      );

      expect(new Set(resultados.map((r) => r.id)).size, `rodada ${rodada}`).toBe(1);
      expect(await prisma.asset.count({ where: { ticker: "ZZAT1" } })).toBe(1);
    }
  });

  it("devolve o indicador junto (null quando ainda não foi calculado)", async () => {
    const criado = await ativosRepository.ensureAsset(novoAsset("ZZAT1"));

    expect(criado.indicator).toBeNull();
  });
});

describe("ativosRepository.updatePrice", () => {
  it("grava o preço e o momento", async () => {
    await ativosRepository.ensureAsset(novoAsset("ZZAT1", 10));
    const em = new Date("2026-10-12T15:00:00.000Z");

    await ativosRepository.updatePrice("ZZAT1", 12.34, em);
    const asset = await ativosRepository.findAssetWithIndicator("ZZAT1");

    expect(asset?.currentPrice.toNumber()).toBe(12.34);
    expect(asset?.priceUpdatedAt?.toISOString()).toBe(em.toISOString());
  });

  it("ticker que não existe: não lança (uma escrita oportunista não derruba a leitura)", async () => {
    const resultado = await ativosRepository.updatePrice("ZZAT2", 5, new Date());

    expect(resultado.count).toBe(0);
  });
});

describe("ativosRepository: fotografias", () => {
  it("guarda e devolve o JSON como foi salvo", async () => {
    const asset = await ativosRepository.ensureAsset(novoAsset("ZZAT1"));
    const dados = [{ periodo: "2T26", lucroLiquido: 7_400_000_000, patrimonioLiquido: 190_000_000_000 }];
    const em = new Date("2026-10-12T15:00:00.000Z");

    await ativosRepository.saveSnapshot(asset.id, "CVM_RESULTS", dados, em);
    const lida = await ativosRepository.findSnapshot(asset.id, "CVM_RESULTS");

    expect(lida?.data).toEqual(dados);
    expect(lida?.updatedAt.toISOString()).toBe(em.toISOString());
  });

  it("salvar de novo atualiza a mesma linha: uma fotografia de cada tipo por ativo", async () => {
    const asset = await ativosRepository.ensureAsset(novoAsset("ZZAT1"));

    await ativosRepository.saveSnapshot(asset.id, "NEWS", [{ titulo: "antiga" }], new Date("2026-10-01"));
    await ativosRepository.saveSnapshot(asset.id, "NEWS", [{ titulo: "nova" }], new Date("2026-10-12"));

    expect(await prisma.assetSnapshot.count({ where: { assetId: asset.id } })).toBe(1);
    const lida = await ativosRepository.findSnapshot(asset.id, "NEWS");
    expect(lida?.data).toEqual([{ titulo: "nova" }]);
    expect(lida?.updatedAt.toISOString()).toBe(new Date("2026-10-12").toISOString());
  });

  it("tipos diferentes do mesmo ativo convivem", async () => {
    const asset = await ativosRepository.ensureAsset(novoAsset("ZZAT1"));

    await ativosRepository.saveSnapshot(asset.id, "NEWS", [], new Date());
    await ativosRepository.saveSnapshot(asset.id, "CVM_FUND_REPORT", { competencia: "2026-08" }, new Date());

    expect(await prisma.assetSnapshot.count({ where: { assetId: asset.id } })).toBe(2);
  });

  it("lista vazia é um dado válido, e não o mesmo que não haver fotografia", async () => {
    const asset = await ativosRepository.ensureAsset(novoAsset("ZZAT1"));

    await ativosRepository.saveSnapshot(asset.id, "NEWS", [], new Date());

    expect((await ativosRepository.findSnapshot(asset.id, "NEWS"))?.data).toEqual([]);
    expect(await ativosRepository.findSnapshot(asset.id, "CVM_RESULTS")).toBeNull();
  });

  it("findSnapshotsByType traz só o tipo pedido, dos ativos pedidos", async () => {
    const a = await ativosRepository.ensureAsset(novoAsset("ZZAT1"));
    const b = await ativosRepository.ensureAsset(novoAsset("ZZAT2"));
    await ativosRepository.saveSnapshot(a.id, "CVM_FUND_REPORT", { v: 1 }, new Date());
    await ativosRepository.saveSnapshot(b.id, "CVM_FUND_REPORT", { v: 2 }, new Date());
    await ativosRepository.saveSnapshot(a.id, "NEWS", [], new Date());

    const lidas = await ativosRepository.findSnapshotsByType([a.id, b.id], "CVM_FUND_REPORT");

    expect(lidas.map((s) => s.assetId).sort()).toEqual([a.id, b.id].sort());
    expect(lidas.every((s) => s.type === "CVM_FUND_REPORT")).toBe(true);
  });

  it("apagar o ativo apaga as fotografias dele (cascade)", async () => {
    const asset = await ativosRepository.ensureAsset(novoAsset("ZZAT1"));
    await ativosRepository.saveSnapshot(asset.id, "NEWS", [], new Date());

    await prisma.asset.delete({ where: { id: asset.id } });

    expect(await prisma.assetSnapshot.count({ where: { assetId: asset.id } })).toBe(0);
  });
});

describe("migration ativos_snapshots_e_divida_ebitda", () => {
  it("a tabela de fotografias tem o RLS ligado (a Data API do Supabase não a expõe)", async () => {
    const linhas = await prisma.$queryRaw<{ relrowsecurity: boolean }[]>`
      SELECT relrowsecurity FROM pg_class WHERE relname = 'asset_snapshots'
    `;

    expect(linhas[0]?.relrowsecurity).toBe(true);
  });

  it("a dívida/EBITDA grava e lê em duas casas decimais, e aceita null", async () => {
    const asset = await ativosRepository.ensureAsset(novoAsset("ZZAT1"));
    const dados = { pl: 5, pvp: 1, roe: 10, roa: 2, margemLiquida: 8, industria: null };

    await indicatorsRepository.upsert(asset.id, { ...dados, dividaEbitda: 1.0432 });
    const comValor = await prisma.assetIndicator.findUniqueOrThrow({ where: { assetId: asset.id } });
    await indicatorsRepository.upsert(asset.id, { ...dados, dividaEbitda: null });
    const semValor = await prisma.assetIndicator.findUniqueOrThrow({ where: { assetId: asset.id } });

    expect(comValor.dividaEbitda?.toNumber()).toBe(1.04);
    expect(semValor.dividaEbitda).toBeNull();
  });

  it("upsert sem dividendYield preserva o DY que já estava gravado (consulta de proventos que falhou)", async () => {
    const asset = await ativosRepository.ensureAsset(novoAsset("ZZAT1"));
    const dados = { pl: 5, pvp: 1, roe: 10, roa: 2, margemLiquida: 8, dividaEbitda: null, industria: null };

    await indicatorsRepository.upsert(asset.id, { ...dados, dividendYield: 7.5 });
    await indicatorsRepository.upsert(asset.id, { ...dados, pl: 6 }); // sem a chave dividendYield

    const lido = await prisma.assetIndicator.findUniqueOrThrow({ where: { assetId: asset.id } });
    expect(lido.pl?.toNumber()).toBe(6);
    expect(lido.dividendYield?.toNumber()).toBe(7.5);
  });
});
