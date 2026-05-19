"use client";

import { useSearchParams } from "next/navigation";
import { Icons } from "./Icons";

export function ExportButton() {
  const sp = useSearchParams();

  function handleExport() {
    // Preserve all current filters
    const params = new URLSearchParams();
    sp.forEach((v, k) => {
      if (k !== "page") params.set(k, v);
    });
    window.open(`/api/export?${params.toString()}`, "_blank");
  }

  return (
    <button className="btn ghost sm" onClick={handleExport}>
      <Icons.Download style={{ width: 12, height: 12 }} /> Exportar Excel
    </button>
  );
}
