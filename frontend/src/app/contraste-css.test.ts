import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");

function cor(token: string): string {
  const m = css.match(new RegExp(`--color-${token}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token não encontrado: --color-${token}`);
  return m[1]!;
}

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste do WCAG entre duas cores #rrggbb. */
function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (escuro + 0.05);
}

describe("globals.css: contraste dos tokens (WCAG AA)", () => {
  it("o cálculo confere com valores conhecidos", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contraste("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("texto de ganho e de perda sobre o navy (quadro escuro do bento) passa de 4,5:1", () => {
    const navy = cor("ink");
    expect(contraste(cor("gain"), navy)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cor("loss-on-dark"), navy)).toBeGreaterThanOrEqual(4.5);
  });

  it("o coral escuro de texto sobre claro (loss) continua para fundo claro: no navy ele não passa", () => {
    expect(contraste(cor("loss"), cor("ink"))).toBeLessThan(4.5);
  });

  it("o trilho das réguas e barras de escala passa de 3:1 sobre o branco e sobre o caderno (objeto gráfico, WCAG 1.4.11)", () => {
    expect(contraste(cor("trilho"), cor("card"))).toBeGreaterThanOrEqual(3);
    expect(contraste(cor("trilho"), cor("caderno"))).toBeGreaterThanOrEqual(3);
  });
});
