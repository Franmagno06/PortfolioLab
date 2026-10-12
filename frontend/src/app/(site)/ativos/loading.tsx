import { Skeleton } from "@/components/ui/skeleton";

/** Enquanto a página de ativos carrega: a forma do que vem, sem texto inventado. */
export default function CarregandoAtivos() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <Skeleton className="h-5 w-48 rounded" />
      <div className="space-y-3">
        <Skeleton className="h-10 w-64 rounded" />
        <Skeleton className="h-5 w-full max-w-[640px] rounded" />
      </div>
      <Skeleton className="h-[386px] rounded-md" />
    </div>
  );
}
