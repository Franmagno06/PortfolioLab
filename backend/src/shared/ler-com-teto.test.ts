import { describe, expect, it } from "vitest";
import { lerCorpoComTeto } from "./ler-com-teto.js";

function respostaEmPedacos(pedacos: number[], cabecalhos: Record<string, string> = {}) {
  const corpo = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const tamanho of pedacos) controller.enqueue(new Uint8Array(tamanho).fill(65));
      controller.close();
    },
  });
  return new Response(corpo, { headers: cabecalhos });
}

describe("lerCorpoComTeto", () => {
  it("devolve o corpo inteiro quando cabe no teto", async () => {
    const corpo = await lerCorpoComTeto(respostaEmPedacos([3, 4]), 10);
    expect(corpo?.byteLength).toBe(7);
    expect(new TextDecoder().decode(corpo!)).toBe("AAAAAAA");
  });

  it("desiste no meio da leitura quando passa do teto, mesmo sem content-length", async () => {
    expect(await lerCorpoComTeto(respostaEmPedacos([6, 6]), 10)).toBeNull();
  });

  it("recusa antes de ler quando o content-length já passa do teto", async () => {
    const res = respostaEmPedacos([1], { "content-length": "999" });
    expect(await lerCorpoComTeto(res, 10)).toBeNull();
  });
});
