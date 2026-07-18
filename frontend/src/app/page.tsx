import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// A raiz do site só decide para onde mandar o visitante
export default async function Home() {
  const temToken = (await cookies()).has("token");
  redirect(temToken ? "/dashboard" : "/login");
}
