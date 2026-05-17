import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   ?? "smtp.gmail.com",
  port:   parseInt(process.env.SMTP_PORT ?? "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM ?? "AION 3Colinas <noreply@aion.com.br>";
const BASE = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function layout(title: string, body: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f5f5f5; margin:0; padding:24px; color:#111; }
  .card { background:#fff; border-radius:10px; padding:32px; max-width:560px; margin:0 auto; box-shadow:0 1px 4px rgba(0,0,0,.08); }
  .logo { font-size:13px; font-weight:700; letter-spacing:-.01em; color:#555; margin-bottom:24px; }
  h1 { font-size:20px; font-weight:700; margin:0 0 12px; letter-spacing:-.02em; }
  p { font-size:14px; line-height:1.6; color:#444; margin:0 0 14px; }
  .btn { display:inline-block; background:#111; color:#fff; padding:10px 20px; border-radius:7px;
         text-decoration:none; font-size:13px; font-weight:600; margin-top:8px; }
  .meta { font-size:12px; color:#999; margin-top:24px; padding-top:16px; border-top:1px solid #eee; }
  .pill { display:inline-block; background:#f0fdf4; color:#15803d; border-radius:4px;
          padding:2px 8px; font-size:12px; font-weight:600; }
  .pill.warn { background:#fffbeb; color:#92400e; }
  .pill.danger { background:#fef2f2; color:#b91c1c; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">AION · Hospital 3 Colinas</div>
    <h1>${title}</h1>
    ${body}
    <div class="meta">Este e-mail foi gerado automaticamente pela plataforma AION. Não responda.</div>
  </div>
</body>
</html>`;
}

async function send(to: string | string[], subject: string, html: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[email] SMTP não configurado — pulando envio para ${to}: ${subject}`);
    return;
  }
  try {
    await transport.sendMail({ from: FROM, to: Array.isArray(to) ? to.join(",") : to, subject, html });
  } catch (err) {
    console.error("[email] Falha ao enviar:", err);
  }
}

export async function emailItemAprovado(opts: {
  to: string | string[];
  itemNumero: string;
  equipamento: string;
  aprovadoPor: string;
}) {
  const url = `${BASE}/itens`;
  const html = layout("Item aprovado para contratação", `
    <p>O item <strong>${opts.itemNumero} — ${opts.equipamento}</strong> foi aprovado para contratação por <strong>${opts.aprovadoPor}</strong>.</p>
    <p>Você já pode registrar o contrato na plataforma.</p>
    <a class="btn" href="${url}">Ver itens</a>
  `);
  await send(opts.to, `[AION] Item aprovado: ${opts.itemNumero}`, html);
}

export async function emailItemPausado(opts: {
  to: string | string[];
  itemNumero: string;
  equipamento: string;
  motivo: string;
  pausadoPor: string;
}) {
  const url = `${BASE}/itens`;
  const html = layout("Processo pausado", `
    <p>O processo do item <strong>${opts.itemNumero} — ${opts.equipamento}</strong> foi pausado por <strong>${opts.pausadoPor}</strong>.</p>
    <p><strong>Motivo:</strong> ${opts.motivo || "Não informado"}</p>
    <a class="btn" href="${url}">Ver itens</a>
  `);
  await send(opts.to, `[AION] Processo pausado: ${opts.itemNumero}`, html);
}

export async function emailEntregaAtrasada(opts: {
  to: string | string[];
  itens: { numero: string; equipamento: string; diasAtraso: number }[];
}) {
  if (opts.itens.length === 0) return;
  const linhas = opts.itens
    .map((i) => `<li><strong>${i.numero}</strong> — ${i.equipamento} (<span class="pill warn">${i.diasAtraso} dias de atraso</span>)</li>`)
    .join("\n");
  const html = layout("Alerta: entregas atrasadas", `
    <p>${opts.itens.length} ${opts.itens.length === 1 ? "entrega está" : "entregas estão"} com prazo vencido:</p>
    <ul style="font-size:13px;line-height:2;padding-left:18px;color:#333;">${linhas}</ul>
    <a class="btn" href="${BASE}/itens?status=CONTRATADO">Ver itens contratados</a>
  `);
  await send(opts.to, `[AION] ${opts.itens.length} entrega(s) atrasada(s)`, html);
}

export async function emailPropostaVencida(opts: {
  to: string | string[];
  itens: { numero: string; equipamento: string; fornecedor: string }[];
}) {
  if (opts.itens.length === 0) return;
  const linhas = opts.itens
    .map((i) => `<li><strong>${i.numero}</strong> — ${i.equipamento} · proposta de <em>${i.fornecedor}</em></li>`)
    .join("\n");
  const html = layout("Propostas de orçamento vencidas", `
    <p>${opts.itens.length} ${opts.itens.length === 1 ? "orçamento tem proposta vencida" : "orçamentos têm propostas vencidas"}. Solicite atualizações aos fornecedores:</p>
    <ul style="font-size:13px;line-height:2;padding-left:18px;color:#333;">${linhas}</ul>
    <a class="btn" href="${BASE}/itens">Ver itens</a>
  `);
  await send(opts.to, `[AION] ${opts.itens.length} proposta(s) vencida(s)`, html);
}

export async function emailNovoContrato(opts: {
  to: string | string[];
  itemNumero: string;
  equipamento: string;
  fornecedor: string;
  valor: number;
}) {
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(opts.valor);
  const html = layout("Contrato registrado", `
    <p>Um novo contrato foi registrado na plataforma:</p>
    <p>
      <strong>Item:</strong> ${opts.itemNumero} — ${opts.equipamento}<br>
      <strong>Fornecedor:</strong> ${opts.fornecedor}<br>
      <strong>Valor:</strong> ${brl}
    </p>
    <a class="btn" href="${BASE}/itens">Ver itens</a>
  `);
  await send(opts.to, `[AION] Contrato registrado: ${opts.itemNumero}`, html);
}
