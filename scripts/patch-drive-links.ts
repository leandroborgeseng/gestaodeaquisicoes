/**
 * One-time script: populate especificacaoUrl on existing items from drive_links.json
 * Run: railway run npx ts-node --project tsconfig.json scripts/patch-drive-links.ts
 * Or locally: npx ts-node --project tsconfig.json scripts/patch-drive-links.ts
 */
import { PrismaClient } from "@prisma/client";
import links from "../seed/drive_links.json";

const prisma = new PrismaClient();

async function main() {
  const map = new Map<string, string>(
    (links as { drive_links: { equipamento: string; url: string }[] })
      .drive_links.map((d) => [d.equipamento, d.url])
  );

  let updated = 0;
  let skipped = 0;

  const items = await prisma.item.findMany({ select: { id: true, equipamento: true, especificacaoUrl: true } });

  for (const item of items) {
    const url = map.get(item.equipamento);
    if (!url) { skipped++; continue; }
    if (item.especificacaoUrl === url) { skipped++; continue; }

    await prisma.item.update({ where: { id: item.id }, data: { especificacaoUrl: url } });
    updated++;
    console.log(`  ✓ ${item.equipamento.slice(0, 50)}`);
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped (${items.length} total items)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
