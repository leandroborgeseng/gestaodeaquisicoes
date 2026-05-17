import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailEntregaAtrasada, emailPropostaVencida } from "@/lib/email";

// Protegido por token de cron — chame com Authorization: Bearer $CRON_SECRET
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const now = new Date();
  const results: Record<string, number> = {};

  // ── 1. Entregas atrasadas ─────────────────────────────────────────────────
  const entregasAtrasadas = await prisma.entrega.findMany({
    where: { dataPrevisao: { lt: now }, dataEntrega: null },
    include: { item: { select: { numero: true, equipamento: true } } },
  });

  if (entregasAtrasadas.length > 0) {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
    const emails = admins.map((u) => u.email).filter(Boolean) as string[];
    if (emails.length > 0) {
      await emailEntregaAtrasada({
        to: emails,
        itens: entregasAtrasadas.map((e) => ({
          numero: e.item.numero,
          equipamento: e.item.equipamento,
          diasAtraso: Math.floor((now.getTime() - new Date(e.dataPrevisao!).getTime()) / 86_400_000),
        })),
      });
    }
  }
  results.entregasAtrasadas = entregasAtrasadas.length;

  // ── 2. Propostas vencidas ─────────────────────────────────────────────────
  const propostasVencidas = await prisma.orcamento.findMany({
    where: { validadeAte: { lt: now }, vencedor: false },
    include: {
      item:       { select: { numero: true, equipamento: true } },
      fornecedor: { select: { nome: true } },
    },
  });

  if (propostasVencidas.length > 0) {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
    const emails = admins.map((u) => u.email).filter(Boolean) as string[];
    if (emails.length > 0) {
      await emailPropostaVencida({
        to: emails,
        itens: propostasVencidas.map((o) => ({
          numero: o.item.numero,
          equipamento: o.item.equipamento,
          fornecedor: o.fornecedor.nome,
        })),
      });
    }
  }
  results.propostasVencidas = propostasVencidas.length;

  return NextResponse.json({ ok: true, results });
}
