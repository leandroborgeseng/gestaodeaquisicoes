import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  // Build a workbook with one sheet containing the template headers and one example row
  const wb = XLSX.utils.book_new();

  const data = [
    ["Nº", "Equipamento", "Especificacao", "Qtd", "ValorRef", "SIAFISICO"],
    ["001", "Monitor multiparâmetros", "12 polegadas, SpO2, ECG", 2, 8500.0, 123456],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths for readability
  ws["!cols"] = [
    { wch: 8 },
    { wch: 40 },
    { wch: 30 },
    { wch: 8 },
    { wch: 14 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Itens");

  const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(xlsxBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-importacao-itens.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
