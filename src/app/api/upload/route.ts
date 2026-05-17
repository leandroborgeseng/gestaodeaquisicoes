import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Railway volume is mounted at /data; fallback to .uploads in dev
const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads");

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const form = await req.formData();
  const file        = form.get("file") as File | null;
  const itemId      = form.get("itemId") as string | null;
  const orcamentoId = (form.get("orcamentoId") as string | null) || null;
  const category    = (form.get("category") as string | null) ?? "geral"; // nf | entrega | teste | contrato | cotacao | especificacao | geral

  if (!file)   return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  if (!itemId) return NextResponse.json({ error: "itemId obrigatório" }, { status: 400 });

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Tipo de arquivo não permitido. Use PDF, JPEG ou PNG." }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Arquivo muito grande (máx 20 MB)" }, { status: 400 });

  // Validate item exists
  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true, numero: true } });
  if (!item) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  // Build path: /data/uploads/{itemNumero}/{category}/{timestamp}-{safename}.ext
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const ts       = Date.now();
  const fileName = `${ts}-${safeName}`;
  const dir      = path.join(UPLOAD_ROOT, "uploads", item.numero, category);
  const filePath = path.join(dir, fileName);

  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  // URL path used to serve the file via /api/files/[...path]
  const urlPath = `/api/files/${item.numero}/${category}/${fileName}`;

  const user = await prisma.user.findUnique({ where: { email: session.user.email! }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 401 });

  const anexo = await prisma.anexo.create({
    data: {
      nome: fileName,
      nomeOriginal: file.name,
      mimeType: file.type,
      tamanho: file.size,
      url: urlPath,
      bucket: "local",
      autorId: user.id,
      itemId: item.id,
      ...(orcamentoId ? { orcamentoId } : {}),
    },
  });

  return NextResponse.json({ id: anexo.id, url: urlPath, nome: file.name });
}
