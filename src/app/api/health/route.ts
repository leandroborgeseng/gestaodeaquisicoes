import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbStatus = "unknown";
  let itemCount = 0;
  try {
    itemCount = await prisma.item.count();
    dbStatus = "ok";
  } catch (e) {
    dbStatus = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  const ok = dbStatus === "ok";
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      db: dbStatus,
      items: itemCount,
      time: new Date().toISOString(),
      node: process.version,
      env: process.env.NODE_ENV,
    },
    { status: ok ? 200 : 503 }
  );
}
