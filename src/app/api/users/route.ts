import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "HOSPITAL", "FORNECEDOR"]),
  fornecedorId: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    include: { fornecedor: { select: { nome: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users.map((u) => ({ ...u, password: undefined })));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return NextResponse.json({ error: "Email já cadastrado." }, { status: 409 });

  const user = await prisma.user.create({
    data: {
      ...parsed.data,
      password: await bcrypt.hash(parsed.data.password, 12),
    },
  });

  return NextResponse.json({ ...user, password: undefined }, { status: 201 });
}
