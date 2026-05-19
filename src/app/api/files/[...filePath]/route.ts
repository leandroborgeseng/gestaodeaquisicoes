import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads");

const MIME: Record<string, string> = {
  pdf:  "application/pdf",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
  gif:  "image/gif",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls:  "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc:  "application/msword",
  csv:  "text/csv",
};

export async function GET(
  req: NextRequest,
  { params }: { params: { filePath: string[] } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Prevent path traversal
  const joined  = params.filePath.join("/").replace(/\.\./g, "");
  const absPath = path.join(UPLOAD_ROOT, "uploads", joined);

  if (!absPath.startsWith(path.join(UPLOAD_ROOT, "uploads"))) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  let buffer: Uint8Array;
  try {
    buffer = await readFile(absPath);
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const ext      = absPath.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = MIME[ext] ?? "application/octet-stream";
  const inline   = ["pdf", "jpg", "jpeg", "png", "webp", "gif", "csv"].includes(ext);
  const fileName = absPath.split("/").pop() ?? "arquivo";

  return new NextResponse(buffer.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
