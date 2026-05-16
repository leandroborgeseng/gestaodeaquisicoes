import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["PENDENTE","COTACAO_EM_ANDAMENTO","COTACAO_CONCLUIDA","CONTRATADO","ENTREGA_PARCIAL","ENTREGUE","NF_RECEBIDA","EM_TESTE","CONCLUIDO","CANCELADO"]),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "FORNECEDOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const userId = session.user.id;
  const [item] = await prisma.$transaction([
    prisma.item.update({
      where: { id: params.id },
      data: { statusProcesso: parsed.data.status },
    }),
    prisma.log.create({
      data: {
        itemId: params.id,
        autorId: userId,
        acao: "STATUS_ALTERADO",
        detalhes: { novoStatus: parsed.data.status },
      },
    }),
  ]);

  return NextResponse.json(item);
}
