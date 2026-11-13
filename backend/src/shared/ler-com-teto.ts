/**
 * Lê o corpo de uma resposta HTTP em pedaços e desiste assim que passar de
 * `maxBytes`. `res.arrayBuffer()` e `res.text()` só deixam conferir o tamanho
 * depois de tudo estar na memória, e o `content-length` pode não vir: no Render
 * gratuito (512 MB), uma resposta grande demais derrubaria o processo antes do
 * teto ser conferido.
 *
 * Devolve null quando passa do teto; o corpo restante é cancelado.
 */
export async function lerCorpoComTeto(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (Number(res.headers.get("content-length")) > maxBytes) {
    await res.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!res.body) return new Uint8Array(0);

  const leitor = res.body.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await leitor.cancel().catch(() => undefined);
      return null;
    }
    pedacos.push(value);
  }

  const corpo = new Uint8Array(total);
  let posicao = 0;
  for (const pedaco of pedacos) {
    corpo.set(pedaco, posicao);
    posicao += pedaco.byteLength;
  }
  return corpo;
}
