import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");

describe("globals.css: movimento", () => {
  it("não trata prefers-reduced-motion (decisão do dono)", () => {
    expect(css).not.toMatch(/prefers-reduced-motion/);
  });

  it("declara os tokens exatos de movimento", () => {
    for (const t of [
      "--duracao-rapida: 160ms",
      "--duracao-media: 260ms",
      "--duracao-lenta: 900ms",
      "--duracao-grafico: 1100ms",
      "--curva: cubic-bezier(.2,.8,.2,1)",
    ]) {
      expect(css).toContain(t);
    }
  });

  it("tem o cartão interativo e o revelar", () => {
    expect(css).toMatch(/\.interativo:hover/);
    expect(css).toMatch(/\.interativo:focus-visible/);
    expect(css).toMatch(/\.interativo:active/);
    expect(css).toMatch(/\.revelar\.visivel/);
  });

  it("scroll suave e abrir-menu valem sempre", () => {
    expect(css).toMatch(/scroll-behavior:\s*smooth/);
    expect(css).toMatch(/\.abrir-menu\s*\{/);
  });
});
