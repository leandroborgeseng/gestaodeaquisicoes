import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const take = 50;
  const skip = (page - 1) * take;
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const vsRef = searchParams.get("vsRef");

  const where: Record<string, unknown> = {};

  if (session.user.role === "FORNECEDOR" && session.user.fornecedorId) {
    where.contratacao = { fornecedorId: session.user.fornecedorId };
  }

  if (status && status !== "all") where.statusProcesso = status;
  if (vsRef && vsRef !== "all") where.statusVsReferenciaFns = vsRef;
  if (q) {
    where.OR = [
      { equipamento: { contains: q, mode: "insensitive" } },
      { numero: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      skip,
      take,
      orderBy: { numero: "asc" },
      include: {
        contratacao: { include: { fornecedor: { select: { nome: true } } } },
      },
    }),
    prisma.item.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pages: Math.ceil(total / take) });
}
