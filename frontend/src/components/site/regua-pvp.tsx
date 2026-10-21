import { numero } from "@/lib/format";

// Por que existe: o P/VP é o único indicador com uma referência neutra e verificável (1,0 = o patrimônio
// contábil); a régua mostra onde o número cai em relação a ela, sem dizer se é "bom" nem se é "caro".

/** A régua vai de 0 a 3 vezes o patrimônio; acima disso o marcador fica parado na ponta ("3+"). */
export const ESCALA_MAXIMA_PVP = 3;

/** Posição do marcador em % da barra: proporcional a pvp na escala 0–3, presa entre 0 e 100. */
export function posicaoNaReguaPvp(pvp: number): number {
  if (!Number.isFinite(pvp)) return 0;
  return Math.min(100, Math.max(0, (pvp / ESCALA_MAXIMA_PVP) * 100));
}

/**
 * P/VP zero, negativo ou ausente (patrimônio negativo ou dado faltando) não tem leitura "abaixo de 1":
 * nesses casos a régua não aparece, em vez de dizer algo errado.
 */
export function ReguaPvp({ pvp }: { pvp: number | null }) {
  if (pvp === null || !Number.isFinite(pvp) || pvp <= 0) return null;
  const posicao = posicaoNaReguaPvp(pvp);
  const referencia = (1 / ESCALA_MAXIMA_PVP) * 100;
  const lado = pvp < 1 ? "abaixo do" : pvp > 1 ? "acima do" : "igual ao";

  return (
    <div data-regua="pvp" className="mt-4">
      <div
        role="img"
        aria-label={`Régua do P/VP, de 0 a ${ESCALA_MAXIMA_PVP} ou mais: ${numero(pvp, 2)}, ${lado} patrimônio contábil (referência 1,0)`}
        className="relative h-6"
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-mute/40" />
        <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-ink-2" style={{ left: `${referencia}%` }} />
        <div
          data-marcador="pvp"
          className="absolute top-1/2 size-4 rounded-full border-2 border-card bg-ink shadow-folha"
          style={{ left: `${posicao}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>
      <div aria-hidden="true" className="relative mt-1 h-4 text-xs text-mute">
        <span className="tnum absolute left-0">0</span>
        <span className="tnum absolute -translate-x-1/2 font-semibold text-ink-2" style={{ left: `${referencia}%` }}>
          1,0
        </span>
        <span className="tnum absolute right-0">{ESCALA_MAXIMA_PVP}+</span>
      </div>
      <div aria-hidden="true" className="relative mt-1 flex text-xs leading-4 text-mute">
        <span className="pr-2 text-right" style={{ width: `${referencia}%` }}>
          abaixo do patrimônio contábil
        </span>
        <span className="pl-2" style={{ width: `${100 - referencia}%` }}>
          acima do patrimônio contábil
        </span>
      </div>
    </div>
  );
}
