import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.item.findUnique({
    where: { id: params.id },
    include: {
      orcamentos: { include: { fornecedor: { select: { nome: true } } }, orderBy: { numero: "asc" } },
      cotacao: true,
      contratacao: { include: { fornecedor: true } },
      entregas: { orderBy: { createdAt: "desc" } },
      notasFiscais: { orderBy: { createdAt: "desc" } },
      testes: { orderBy: { createdAt: "desc" } },
      observacoes: { include: { autor: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
      anexos: { include: { autor: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      logs: { include: { autor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role === "FORNECEDOR" && session.user.fornecedorId) {
    if (item.contratacao?.fornecedorId !== session.user.fornecedorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(item);
}
