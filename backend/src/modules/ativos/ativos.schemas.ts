import { z } from "zod";
import { tickerSchema } from "../../shared/ticker.js";

// O ticker da rota é validado duas vezes: aqui, pelo formato (letras e números), e no
// controller, contra o catálogo curado. Só o segundo barra ticker válido que não é nosso.
export const tickerDaRotaSchema = z.object({ ticker: tickerSchema });
