export function fmtBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

export function fmtNum(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR");
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtPct(v: number): string {
  return (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  COTACAO_EM_ANDAMENTO: "Cotação em andamento",
  COTACAO_CONCLUIDA: "Cotação concluída",
  CONTRATADO: "Contratado",
  ENTREGA_PARCIAL: "Entrega parcial",
  ENTREGUE: "Entregue",
  NF_RECEBIDA: "NF recebida",
  EM_TESTE: "Em teste",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export const STATUS_PILL_CLASS: Record<string, string> = {
  PENDENTE: "pill-pendente",
  COTACAO_EM_ANDAMENTO: "pill-cot-ini",
  COTACAO_CONCLUIDA: "pill-cot-fim",
  CONTRATADO: "pill-contratado",
  ENTREGA_PARCIAL: "pill-parcial",
  ENTREGUE: "pill-entregue",
  NF_RECEBIDA: "pill-nf",
  EM_TESTE: "pill-teste",
  CONCLUIDO: "pill-concluido",
  CANCELADO: "pill-cancelado",
};
