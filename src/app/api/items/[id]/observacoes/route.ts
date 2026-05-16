import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({ texto: z.string().min(1) });

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const obs = await prisma.observacao.findMany({
    where: { itemId: params.id },
    include: { autor: { select: { name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(obs);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const obs = await prisma.observacao.create({
    data: { itemId: params.id, autorId: session.user.id, texto: parsed.data.texto },
    include: { autor: { select: { name: true, role: true } } },
  });

  await prisma.log.create({
    data: { itemId: params.id, autorId: session.user.id, acao: "OBSERVACAO_ADICIONADA" },
  });

  return NextResponse.json(obs, { status: 201 });
}
