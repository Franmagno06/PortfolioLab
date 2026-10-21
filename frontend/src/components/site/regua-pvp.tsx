import { numero } from "@/lib/format";

// Por que existe: o P/VP é o único indicador com uma referência neutra e verificável (1,0 = o patrimônio
// contábil); a régua mostra onde o número cai em relação a ela, sem dizer se é "bom" nem se é "caro".

/** A régua vai de 0 a 3 vezes o patrimônio; acima disso o marcador fica parado na ponta. */
export const ESCALA_MAXIMA_PVP = 3;

/** Posição do marcador em % da barra: proporcional a pvp na escala 0–3, presa entre 0 e 100. */
export function posicaoNaReguaPvp(pvp: number): number {
  if (!Number.isFinite(pvp)) return 0;
  return Math.min(100, Math.max(0, (pvp / ESCALA_MAXIMA_PVP) * 100));
}

export function ReguaPvp({ pvp }: { pvp: number }) {
  const posicao = posicaoNaReguaPvp(pvp);
  const referencia = (1 / ESCALA_MAXIMA_PVP) * 100;
  const lado = pvp < 1 ? "abaixo do" : pvp > 1 ? "acima do" : "igual ao";

  return (
    <div data-regua="pvp" className="mt-4">
      <div
        role="img"
        aria-label={`Régua do P/VP: ${numero(pvp, 2)}, ${lado} patrimônio contábil (referência 1,0)`}
        className="relative h-6"
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-pauta" />
        <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-ink-2" style={{ left: `${referencia}%` }} />
        <div
          data-marcador="pvp"
          className="absolute top-1/2 size-4 rounded-full border-2 border-card bg-ink shadow-folha"
          style={{ left: `${posicao}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>
      <div aria-hidden="true" className="relative mt-1 h-14 text-xs text-mute">
        <span className="absolute left-0 max-w-[42%]">abaixo do patrimônio contábil</span>
        <span className="tnum absolute top-9 -translate-x-1/2 font-semibold text-ink-2" style={{ left: `${referencia}%` }}>
          1,0
        </span>
        <span className="absolute right-0 max-w-[42%] text-right">acima do patrimônio contábil</span>
      </div>
    </div>
  );
}
