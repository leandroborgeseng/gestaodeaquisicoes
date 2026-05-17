"use client";

import { useTransition } from "react";
import { moverParaFase } from "@/app/actions/items";

interface Props {
  itemId: string;
  faseAtualId: string | null;
  fases: { id: string; nome: string }[];
}

export function FaseMover({ itemId, faseAtualId, fases }: Props) {
  const [pending, start] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    start(async () => { await moverParaFase(itemId, val || null); });
  }

  return (
    <select
      value={faseAtualId ?? ""}
      onChange={handleChange}
      disabled={pending}
      style={{
        height: 24, padding: "0 6px",
        border: "1px solid var(--line)", borderRadius: 5,
        background: "var(--bg-panel)", fontSize: 11.5, color: "var(--fg)",
        outline: "none", cursor: "pointer", width: "100%",
      }}
    >
      <option value="">— Sem fase —</option>
      {fases.map((f) => (
        <option key={f.id} value={f.id}>{f.nome}</option>
      ))}
    </select>
  );
}
