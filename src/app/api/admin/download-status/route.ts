import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads");
  const logPath   = path.join(uploadDir, "download.log");

  // Read last 60 lines of the log
  let logLines: string[] = [];
  try {
    const raw   = await readFile(logPath, "utf-8");
    logLines = raw.trim().split("\n").slice(-60);
  } catch {
    logLines = ["Log não encontrado — download ainda não iniciado ou rodando localmente."];
  }

  // Count Anexo records by category (as proxy for download progress)
  const [totalSpecs, totalCotacoes, totalItens, totalOrcamentos] = await Promise.all([
    prisma.anexo.count({ where: { url: { contains: "/especificacao/" } } }),
    prisma.anexo.count({ where: { url: { contains: "/cotacao/" } } }),
    prisma.item.count({ where: { especificacaoUrl: { not: null } } }),
    prisma.orcamento.count({ where: { cotacaoUrl: { not: null } } }),
  ]);

  return NextResponse.json({
    specs:    { downloaded: totalSpecs,    total: totalItens },
    cotacoes: { downloaded: totalCotacoes, total: totalOrcamentos },
    log:      logLines,
    logPath,
  });
}
