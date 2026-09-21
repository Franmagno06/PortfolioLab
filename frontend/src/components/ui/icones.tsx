// Ícones em SVG stroke — nunca emoji: o emoji muda de forma e de cor em cada
// sistema operacional, e alguns são lidos em voz alta pelo leitor de tela.
type Props = { tamanho?: number };

const base = (t: number) => ({
  width: t,
  height: t,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconeGrade = ({ tamanho = 16 }: Props) => (
  <svg {...base(tamanho)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const IconePasta = ({ tamanho = 16 }: Props) => (
  <svg {...base(tamanho)}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M3 13h18" />
  </svg>
);

export const IconeCalculo = ({ tamanho = 16 }: Props) => (
  <svg {...base(tamanho)}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 7h8" />
    <path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
  </svg>
);

export const IconeDocumento = ({ tamanho = 16 }: Props) => (
  <svg {...base(tamanho)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);

export const IconeIndicadores = ({ tamanho = 16 }: Props) => (
  <svg {...base(tamanho)}>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-5 3 3 5-7" />
  </svg>
);

export const IconeJornal = ({ tamanho = 16 }: Props) => (
  <svg {...base(tamanho)}>
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9h4" />
    <path d="M10 6h8M10 10h8M10 14h5" />
  </svg>
);

export const IconeSair = ({ tamanho = 16 }: Props) => (
  <svg {...base(tamanho)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export const IconeMenu = ({ tamanho = 20 }: Props) => (
  <svg {...base(tamanho)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const IconeFechar = ({ tamanho = 16 }: Props) => (
  <svg {...base(tamanho)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const IconeCheck = ({ tamanho = 14 }: Props) => (
  <svg {...base(tamanho)}>
    <path d="m20 6-11 11-5-5" />
  </svg>
);

export const IconeMais = ({ tamanho = 16 }: Props) => (
  <svg {...base(tamanho)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconeSeta = ({ tamanho = 16 }: Props) => (
  <svg {...base(tamanho)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const IconeBalanca = ({ tamanho = 16 }: Props) => (
  <svg {...base(tamanho)}>
    <path d="M12 3v18M7 21h10" />
    <path d="M3 8h18M6 8l-3 6a3 3 0 0 0 6 0Zm12 0-3 6a3 3 0 0 0 6 0Z" />
  </svg>
);
