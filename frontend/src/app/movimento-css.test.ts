import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");
const css = readFileSync(join(__dirname, "globals.css"), "utf8");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    if (nome === "node_modules") return [];
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(css|ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

/** Corpo da primeira regra cujo seletor casa com `seletor` (texto cru). */
function regra(seletor: string): { seletores: string; corpo: string } {
  const re = new RegExp(`(?:^|\\})\\s*([^{}]*${seletor}[^{}]*)\\{([^}]*)\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`regra não encontrada: ${seletor}`);
  return { seletores: m[1]!, corpo: m[2]! };
}

describe("globals.css: movimento", () => {
  it("nenhum arquivo de src trata reduzir movimento (decisão do dono)", () => {
    const proibidos = ["prefers-reduced-motion", "motion-reduce:", "motion-safe:"];
    const esteArquivo = join(__dirname, "movimento-css.test.ts");
    const achados: string[] = [];
    for (const f of arquivos(SRC)) {
      if (f === esteArquivo) continue;
      const texto = readFileSync(f, "utf8");
      for (const p of proibidos) if (texto.includes(p)) achados.push(`${f}: ${p}`);
    }
    expect(achados).toEqual([]);
  });

  it("declara os tokens exatos de movimento", () => {
    for (const t of [
      "--duracao-rapida: 160ms",
      "--duracao-media: 260ms",
      "--duracao-lenta: 900ms",
      "--duracao-grafico: 1100ms",
      "--duracao-entrada: 600ms",
      "--curva: cubic-bezier(.2,.8,.2,1)",
    ]) {
      expect(css).toContain(t);
    }
  });

  it("nenhuma duração ou curva escrita à mão fora dos tokens", () => {
    const linhas = css
      .split("\n")
      .filter((l) => !/^\s*--(duracao|curva)/.test(l)) // definição dos tokens
      .filter((l) => !/^\s*(\/\*|\*)/.test(l)) // comentários
      .filter((l) => !/animation-delay|--atraso/.test(l)); // escalonamento
    const sobras = linhas.filter((l) => /\d(ms|s)\b|cubic-bezier|\bease/.test(l));
    expect(sobras).toEqual([]);
  });

  it(".interativo reage a hover e foco juntos, com o deslocamento certo", () => {
    const { seletores, corpo } = regra("\\.interativo:hover");
    expect(seletores).toContain(".interativo:focus-visible");
    expect(seletores).toContain(".interativo:has(:focus-visible)");
    expect(corpo).toContain("translateY(-3px)");
    expect(css).toMatch(/\.interativo:active\s*\{[^}]*translateY\(-1px\) scale\(\.995\)/);
    const seta = regra("\\.interativo:hover \\.seta");
    expect(seta.seletores).toContain(".interativo:focus-visible .seta");
    expect(seta.seletores).toContain(".interativo:has(:focus-visible) .seta");
    expect(seta.corpo).toContain("translateX(4px)");
  });

  it(".revelar parte deslocado e escondido; .visivel e sem-JS mostram", () => {
    const base = css.match(/\n\.revelar\s*\{([^}]*)\}/);
    expect(base?.[1]).toContain("translateY(16px)");
    expect(base?.[1]).toContain("opacity: 0");
    expect(css).toMatch(/\.revelar\.visivel\s*\{[^}]*opacity:\s*1/);
    expect(css).toMatch(/@media \(scripting: none\)\s*\{\s*\.revelar\s*\{[^}]*opacity:\s*1/);
  });

  it("scroll suave e abrir-menu valem sempre", () => {
    expect(css).toMatch(/scroll-behavior:\s*smooth/);
    expect(css).toMatch(/\.abrir-menu\s*\{/);
  });
});
