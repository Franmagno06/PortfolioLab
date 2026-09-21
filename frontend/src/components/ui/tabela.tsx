type Coluna = { rotulo: string; direita?: boolean };

/**
 * Cabeçalho de tabela em peso e tamanho, sem versalete espaçado.
 * O caixa-alta tracked-out era o mesmo rótulo genérico em toda tela;
 * a hierarquia aqui vem do peso e da cor, que é o que a tipografia já faz.
 */
export function CabecalhoTabela({ colunas }: { colunas: Coluna[] }) {
  return (
    <thead>
      <tr className="border-b border-line text-left text-xs text-mute">
        {colunas.map((c, i) => (
          <th
            key={c.rotulo}
            scope="col"
            className={`py-3 font-semibold ${c.direita ? "text-right" : ""} ${
              i === 0 ? "pl-5 pr-3" : i === colunas.length - 1 ? "pr-5 pl-3" : "px-3"
            }`}
          >
            {c.rotulo}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** Card de tabela com rolagem horizontal própria abaixo do breakpoint. */
export function CardTabela({
  children,
  larguraMinima,
}: {
  children: React.ReactNode;
  larguraMinima: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className={`w-full text-sm ${larguraMinima}`}>{children}</table>
    </div>
  );
}
