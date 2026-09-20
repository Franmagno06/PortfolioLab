// Uma definição só do campo de formulário. A string vivia copiada em
// simulação, nova-transação, proventos, login e registro.
// Sem largura nem padding: entre dois utilitários da mesma família (w-full vs
// w-20, px-3 vs px-2) quem vence é a ordem do CSS gerado, não a ordem na
// string. Quem usa a base escolhe explicitamente o tamanho.
const base =
  "rounded-lg border border-line bg-card text-sm text-ink placeholder:text-mute-soft focus:border-gain-ink";

/** Campo em tamanho normal. */
export const estiloCampo = `${base} px-3 py-2`;

/** Campo estreito de linha de lista (metas, filtros). */
export const estiloCampoCompacto = `${base} px-2 py-1.5`;

type PropsCampo = React.InputHTMLAttributes<HTMLInputElement> & { rotulo: string };

export function Campo({ rotulo, className = "", ...props }: PropsCampo) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{rotulo}</span>
      <input {...props} className={`${estiloCampo} w-full ${className}`} />
    </label>
  );
}

type PropsSelecao = React.SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string };

export function Selecao({ rotulo, className = "", children, ...props }: PropsSelecao) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{rotulo}</span>
      <select {...props} className={`${estiloCampo} w-full ${className}`}>
        {children}
      </select>
    </label>
  );
}
