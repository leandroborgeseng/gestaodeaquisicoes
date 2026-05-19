"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { classificarItem, type CatProposta } from "@/lib/classificador";
export type { CatProposta } from "@/lib/classificador";
import { CategoriaItem } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
  if (session.user.role === "FORNECEDOR") throw new Error("Sem permissão");
  return session.user;
}

// ─── Propor classificações (sem salvar) ───────────────────────────────────────

export interface ItemProposicao {
  id: string;
  numero: string;
  equipamento: string;
  categoriaAtual: string;
  categoriaProosta: CatProposta;
  confianca: number;
  palavrasEncontradas: string[];
  muda: boolean;
}

export async function proporClassificacoes(): Promise<ItemProposicao[]> {
  await requireAdmin();

  const itens = await prisma.item.findMany({
    select: {
      id: true,
      numero: true,
      equipamento: true,
      categoria: true,
      descritivoRenem: true,
      descritivoFns: true,
      especificacao: true,
    },
    orderBy: { numero: "asc" },
  });

  return itens.map((item) => {
    const descricao = [item.descritivoRenem, item.descritivoFns, item.especificacao]
      .filter(Boolean)
      .join(" ");

    const resultado = classificarItem(item.equipamento, descricao);

    return {
      id: item.id,
      numero: item.numero,
      equipamento: item.equipamento,
      categoriaAtual: item.categoria,
      categoriaProosta: resultado.categoria,
      confianca: resultado.confianca,
      palavrasEncontradas: resultado.palavrasEncontradas,
      muda: item.categoria !== resultado.categoria,
    };
  });
}

// ─── Aplicar classificações selecionadas ──────────────────────────────────────

export async function aplicarClassificacoes(
  items: { id: string; categoria: CatProposta }[],
): Promise<{ aplicados: number }> {
  await requireAdmin();

  if (items.length === 0) return { aplicados: 0 };

  // Atualiza em batches de 50 para não sobrecarregar a DB
  const BATCH = 50;
  let aplicados = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    await Promise.all(
      batch.map((it) =>
        prisma.item.update({
          where: { id: it.id },
          data: { categoria: it.categoria as CategoriaItem },
        }),
      ),
    );
    aplicados += batch.length;
  }

  revalidatePath("/itens");
  revalidatePath("/dashboard");
  return { aplicados };
}
