import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [totalItems, byStatus, totalValue, acimaValor, atrasados] = await Promise.all([
    prisma.item.count(),
    prisma.item.groupBy({ by: ["statusProcesso"], _count: { id: true } }),
    prisma.item.aggregate({ _sum: { faseUnicaValorTotal: true } }),
    prisma.item.count({ where: { statusVsReferenciaFns: "ACIMA_DO_VALOR" } }),
    prisma.entrega.count({ where: { dataPrevisao: { lt: new Date() }, dataEntrega: null } }),
  ]);

  const contratadosTotal = byStatus
    .filter((s) => ["CONTRATADO","ENTREGA_PARCIAL","ENTREGUE","NF_RECEBIDA","EM_TESTE","CONCLUIDO"].includes(s.statusProcesso))
    .reduce((a, b) => a + b._count.id, 0);

  return NextResponse.json({
    totalItems,
    byStatus,
    totalValue: Number(totalValue._sum.faseUnicaValorTotal ?? 0),
    contratadosTotal,
    acimaValor,
    atrasados,
  });
}
