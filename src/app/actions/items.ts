"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { StatusProcesso, PrioridadeItem, CategoriaItem, CriticidadeItem, StatusInstalacao, StatusTreinamento } from "@prisma/client";
import {
  emailItemAprovado,
  emailItemPausado,
  emailNovoContrato,
} from "@/lib/email";
import * as XLSX from "xlsx";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads");

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autorizado");
  return session.user;
}

function parseDecimal(val: string | null | undefined): number | undefined {
  if (!val) return undefined;
  const n = parseFloat(val.replace(/[^0-9.,]/g, "").replace(",", "."));
  return isNaN(n) ? undefined : n;
}

export async function publicarObservacao(itemId: string, texto: string) {
  const user = await requireAuth();
  if (!texto.trim()) return { error: "Texto obrigatório" };
  await prisma.observacao.create({ data: { itemId, autorId: user.id, texto: texto.trim() } });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "OBSERVACAO_ADICIONADA" } });
  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

export async function atualizarStatus(itemId: string, novoStatus: StatusProcesso) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };
  await prisma.item.update({ where: { id: itemId }, data: { statusProcesso: novoStatus } });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "STATUS_ALTERADO" } });
  revalidatePath(`/itens/${itemId}`);
  revalidatePath("/itens");
  return { success: true };
}

export async function registrarCotacao(itemId: string, formData: FormData) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  const dataInicio = formData.get("dataInicio") as string;
  const dataConclusao = formData.get("dataConclusao") as string;
  const observacao = formData.get("observacao") as string;

  const existing = await prisma.cotacao.findUnique({ where: { itemId } });
  const payload = {
    dataInicio: dataInicio ? new Date(dataInicio) : null,
    dataConclusao: dataConclusao ? new Date(dataConclusao) : null,
    observacao: observacao || null,
  };

  if (existing) {
    await prisma.cotacao.update({ where: { itemId }, data: payload });
  } else {
    await prisma.cotacao.create({ data: { itemId, ...payload } });
  }

  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { statusProcesso: true } });
  if (item?.statusProcesso === "PENDENTE") {
    await prisma.item.update({ where: { id: itemId }, data: { statusProcesso: "COTACAO_EM_ANDAMENTO" } });
  }
  if (dataConclusao) {
    await prisma.item.update({ where: { id: itemId }, data: { statusProcesso: "COTACAO_CONCLUIDA" } });
  }

  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "COTACAO_REGISTRADA" } });
  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

export async function registrarContrato(itemId: string, formData: FormData) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  if (user.role !== "ADMIN") {
    const item = await prisma.item.findUnique({ where: { id: itemId }, select: { aprovado: true } });
    if (!item?.aprovado) return { error: "Item precisa ser aprovado pelo administrador antes da contratação" };
  }

  const fornecedorNome = (formData.get("fornecedor") as string)?.trim();
  const numeroContrato = formData.get("numeroContrato") as string;
  const dataAssinatura = formData.get("dataAssinatura") as string;
  const dataVigencia = formData.get("dataVigencia") as string;
  const valor = parseDecimal(formData.get("valor") as string);

  if (!fornecedorNome) return { error: "Fornecedor obrigatório" };

  const fornecedor = await prisma.fornecedor.findFirst({
    where: { nome: { equals: fornecedorNome, mode: "insensitive" } },
  });
  if (!fornecedor) {
    const partial = await prisma.fornecedor.findFirst({
      where: { nome: { contains: fornecedorNome, mode: "insensitive" } },
    });
    if (!partial) return { error: `Fornecedor "${fornecedorNome}" não encontrado` };
  }

  const forn = fornecedor ?? await prisma.fornecedor.findFirst({
    where: { nome: { contains: fornecedorNome, mode: "insensitive" } },
  });

  const existing = await prisma.contratacao.findUnique({ where: { itemId } });
  const payload = {
    fornecedorId: forn!.id,
    numeroContrato: numeroContrato || null,
    valorContratado: valor ?? undefined,
    dataAssinatura: dataAssinatura ? new Date(dataAssinatura) : null,
    dataVigencia: dataVigencia ? new Date(dataVigencia) : null,
  };

  if (existing) {
    await prisma.contratacao.update({ where: { itemId }, data: payload });
  } else {
    await prisma.contratacao.create({ data: { itemId, ...payload } });
  }

  const itemData = await prisma.item.update({ where: { id: itemId }, data: { statusProcesso: "CONTRATADO" }, select: { numero: true, equipamento: true } });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "CONTRATO_REGISTRADO" } });

  // Notificar admins sobre novo contrato
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
  const adminEmails = admins.map((u) => u.email).filter(Boolean) as string[];
  if (adminEmails.length > 0 && valor) {
    emailNovoContrato({
      to: adminEmails,
      itemNumero: itemData.numero,
      equipamento: itemData.equipamento,
      fornecedor: forn!.nome,
      valor,
    }).catch(() => {});
  }

  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

export async function registrarEntrega(itemId: string, formData: FormData) {
  const user = await requireAuth();

  const qtd = parseInt(formData.get("qtd") as string) || 0;
  const dataEntrega = formData.get("dataEntrega") as string;
  const dataPrevisao = formData.get("dataPrevisao") as string;
  const responsavel = formData.get("responsavel") as string;
  const local = formData.get("local") as string;
  const observacao = formData.get("observacao") as string;

  await prisma.entrega.create({
    data: {
      itemId, qtdEntregue: qtd,
      dataEntrega: dataEntrega ? new Date(dataEntrega) : null,
      dataPrevisao: dataPrevisao ? new Date(dataPrevisao) : null,
      responsavel: responsavel || null,
      local: local || null,
      observacao: observacao || null,
    },
  });

  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { statusProcesso: true, faseUnicaQtd: true } });
  const totalEntregue = await prisma.entrega.aggregate({ where: { itemId }, _sum: { qtdEntregue: true } });
  const totalQtd = totalEntregue._sum.qtdEntregue ?? 0;
  const qtdTotal = item?.faseUnicaQtd ?? 0;

  if (qtdTotal > 0 && totalQtd >= qtdTotal) {
    await prisma.item.update({ where: { id: itemId }, data: { statusProcesso: "ENTREGUE" } });
  } else if (totalQtd > 0) {
    await prisma.item.update({ where: { id: itemId }, data: { statusProcesso: "ENTREGA_PARCIAL" } });
  }

  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "ENTREGA_REGISTRADA" } });
  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

export async function registrarNF(itemId: string, formData: FormData) {
  const user = await requireAuth();

  const numero = formData.get("numero") as string;
  const serie = formData.get("serie") as string;
  const emissora = formData.get("emissora") as string;
  const dataEmissao = formData.get("dataEmissao") as string;
  const dataEntrada = formData.get("dataEntrada") as string;
  const valor = parseDecimal(formData.get("valor") as string);
  const chaveNfe = formData.get("chaveNfe") as string;

  if (!numero) return { error: "Número da NF obrigatório" };

  await prisma.notaFiscal.create({
    data: {
      itemId, numero,
      serie: serie || null,
      emissora: emissora || null,
      dataEmissao: dataEmissao ? new Date(dataEmissao) : null,
      dataEntrada: dataEntrada ? new Date(dataEntrada) : null,
      valor: valor ?? undefined,
      chaveNfe: chaveNfe || null,
    },
  });

  await prisma.item.update({ where: { id: itemId }, data: { statusProcesso: "NF_RECEBIDA" } });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "NF_REGISTRADA" } });
  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

export async function registrarTeste(itemId: string, formData: FormData) {
  const user = await requireAuth();

  const dataRealizado = formData.get("dataRealizado") as string;
  const responsavel = formData.get("responsavel") as string;
  const resultado = formData.get("resultado") as string;
  const observacao = formData.get("observacao") as string;

  await prisma.testeInicial.create({
    data: {
      itemId,
      dataRealizado: dataRealizado ? new Date(dataRealizado) : null,
      responsavel: responsavel || null,
      resultado: resultado || null,
      observacao: observacao || null,
    },
  });

  if (resultado === "APROVADO") {
    await prisma.item.update({ where: { id: itemId }, data: { statusProcesso: "CONCLUIDO" } });
  } else {
    await prisma.item.update({ where: { id: itemId }, data: { statusProcesso: "EM_TESTE" } });
  }

  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "TESTE_REGISTRADO" } });
  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

export async function criarUsuario(formData: FormData) {
  const user = await requireAuth();
  if (user.role !== "ADMIN") return { error: "Sem permissão" };

  const nome = formData.get("nome") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as string;
  const password = formData.get("password") as string;
  const fornecedorNome = formData.get("fornecedorNome") as string;

  if (!nome || !email || !password) return { error: "Preencha todos os campos obrigatórios" };

  const bcrypt = await import("bcryptjs");
  const hashed = await bcrypt.hash(password, 12);

  let fornecedorId: string | undefined;
  if (role === "FORNECEDOR" && fornecedorNome) {
    const f = await prisma.fornecedor.findFirst({ where: { nome: { contains: fornecedorNome, mode: "insensitive" } } });
    if (f) fornecedorId = f.id;
  }

  try {
    await prisma.user.create({ data: { name: nome, email, role: role as any, password: hashed, fornecedorId } });
  } catch (e: any) {
    if (e.code === "P2002") return { error: "E-mail já cadastrado" };
    throw e;
  }

  revalidatePath("/usuarios");
  return { success: true };
}

export async function marcarOrcamentoVencedor(itemId: string, orcamentoId: string | null) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  // Unmark all orcamentos for this item, then mark the winner
  await prisma.orcamento.updateMany({ where: { itemId }, data: { vencedor: false } });
  if (orcamentoId) {
    await prisma.orcamento.update({ where: { id: orcamentoId }, data: { vencedor: true } });
    // Also link to contratacao if exists
    await prisma.contratacao.updateMany({
      where: { itemId },
      data: { orcamentoVencedorId: orcamentoId },
    });
  }
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "ORCAMENTO_VENCEDOR_MARCADO" } });
  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

// ─── Helpers para seleção automática de vencedor ──────────────────────────────

// Fases que ainda estão na cotação — única janela em que podemos mexer no status
const FASES_COTACAO = new Set<string>(["PENDENTE", "COTACAO_EM_ANDAMENTO", "COTACAO_CONCLUIDA"]);

async function aplicarVencedorAutomatico(itemId: string) {
  const [orcamentos, item] = await Promise.all([
    prisma.orcamento.findMany({
      where: { itemId },
      select: { id: true, valor: true },
      orderBy: { valor: "asc" },
    }),
    prisma.item.findUnique({ where: { id: itemId }, select: { statusProcesso: true } }),
  ]);

  if (!item) return null;

  // Limpa flags de vencedor
  await prisma.orcamento.updateMany({ where: { itemId }, data: { vencedor: false } });

  if (orcamentos.length >= 3) {
    const vencedor = orcamentos[0]; // menor valor (ordenado asc)
    await prisma.orcamento.update({ where: { id: vencedor.id }, data: { vencedor: true } });
    // Só atualiza status se o item ainda está na fase de cotação
    if (FASES_COTACAO.has(item.statusProcesso)) {
      await prisma.item.update({ where: { id: itemId }, data: { statusProcesso: "COTACAO_CONCLUIDA" } });
    }
    // Atualiza link na contratação se ela existir
    await prisma.contratacao.updateMany({ where: { itemId }, data: { orcamentoVencedorId: vencedor.id } });
    return vencedor.id;
  } else if (FASES_COTACAO.has(item.statusProcesso)) {
    // < 3 cotações: mantém ou regride para EM_ANDAMENTO (só dentro da janela de cotação)
    const novoStatus = orcamentos.length > 0 ? "COTACAO_EM_ANDAMENTO" : "PENDENTE";
    await prisma.item.update({ where: { id: itemId }, data: { statusProcesso: novoStatus } });
  }
  return null;
}

export async function adicionarOrcamento(itemId: string, formData: FormData) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  const fornecedorId = (formData.get("fornecedorId") as string)?.trim();
  const valorStr     = (formData.get("valor") as string)?.trim().replace(",", ".");
  const data         = formData.get("data") as string | null;
  const cotacaoUrl   = (formData.get("cotacaoUrl") as string | null) || null;

  if (!fornecedorId || !valorStr) return { error: "Fornecedor e valor são obrigatórios" };
  const valor = parseFloat(valorStr);
  if (isNaN(valor) || valor <= 0) return { error: "Valor inválido" };

  // Verificar se esse fornecedor já tem orçamento nesse item
  const existe = await prisma.orcamento.findFirst({ where: { itemId, fornecedorId } });
  if (existe) return { error: "Esse fornecedor já enviou um orçamento para este item" };

  const count = await prisma.orcamento.count({ where: { itemId } });

  const orcamento = await prisma.orcamento.create({
    data: {
      itemId,
      fornecedorId,
      valor,
      numero: count + 1,
      dataOrcamento: data ? new Date(data) : null,
      cotacaoUrl,
    },
    select: { id: true, item: { select: { numero: true } } },
  });

  // ── Auto-importar o arquivo da cotação para o filesystem ──────────────────
  if (cotacaoUrl) {
    try {
      await _baixarESalvar({
        dbUserId:    user.id,
        itemId,
        itemNumero:  orcamento.item.numero,
        externalUrl: cotacaoUrl,
        category:    "cotacao",
        orcamentoId: orcamento.id,
      });
    } catch {
      // Falha silenciosa — orçamento já foi salvo, arquivo pode ser importado depois
    }
  }

  await aplicarVencedorAutomatico(itemId);
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "COTACAO_REGISTRADA" } });
  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

export async function removerOrcamento(orcamentoId: string, itemId: string) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  // Desvincular da contratação ANTES de deletar (evita foreign key constraint)
  await prisma.contratacao.updateMany({
    where: { itemId, orcamentoVencedorId: orcamentoId },
    data: { orcamentoVencedorId: null },
  });

  await prisma.orcamento.delete({ where: { id: orcamentoId } });

  // Renumerar os restantes
  const restantes = await prisma.orcamento.findMany({ where: { itemId }, orderBy: { numero: "asc" } });
  for (let i = 0; i < restantes.length; i++) {
    await prisma.orcamento.update({ where: { id: restantes[i].id }, data: { numero: i + 1 } });
  }

  await aplicarVencedorAutomatico(itemId);
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "COTACAO_REGISTRADA" } });
  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

export async function salvarPatrimonio(
  itemId: string,
  data: { numeroSerie?: string; localizacaoFisica?: string; patrimonioHospital?: string }
) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  await prisma.item.update({
    where: { id: itemId },
    data: {
      numeroSerie:        data.numeroSerie        ?? undefined,
      localizacaoFisica:  data.localizacaoFisica  ?? undefined,
      patrimonioHospital: data.patrimonioHospital ?? undefined,
    },
  });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "PATRIMONIO_ATUALIZADO" } });
  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

export async function atribuirSetor(itemId: string, setorId: string | null) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  await prisma.item.update({ where: { id: itemId }, data: { setorId } });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "SETOR_ATRIBUIDO" } });
  revalidatePath(`/itens/${itemId}`);
  revalidatePath("/itens");
  return { success: true };
}

export async function atualizarDescritivoTecnico(itemId: string, texto: string) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  await prisma.item.update({
    where: { id: itemId },
    data: { descritivoTecnico: texto.trim() || null },
  });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "DESCRITIVO_TECNICO_ATUALIZADO" } });
  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

export async function aprovarItem(itemId: string) {
  const user = await requireAuth();
  if (user.role !== "ADMIN") return { error: "Apenas administradores podem aprovar itens" };

  const item = await prisma.item.update({
    where: { id: itemId },
    data: { aprovado: true, aprovadoPor: user.name ?? user.email, aprovadoEm: new Date() },
    select: { numero: true, equipamento: true },
  });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "ITEM_APROVADO" } });

  // Notificar todos os usuários HOSPITAL por e-mail
  const hospitalUsers = await prisma.user.findMany({ where: { role: "HOSPITAL" }, select: { email: true } });
  const emails = hospitalUsers.map((u) => u.email).filter(Boolean) as string[];
  if (emails.length > 0) {
    emailItemAprovado({
      to: emails,
      itemNumero: item.numero,
      equipamento: item.equipamento,
      aprovadoPor: user.name ?? user.email ?? "Administrador",
    }).catch(() => {});
  }

  revalidatePath(`/itens/${itemId}`);
  revalidatePath("/itens");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function revogarAprovacao(itemId: string) {
  const user = await requireAuth();
  if (user.role !== "ADMIN") return { error: "Apenas administradores podem revogar aprovações" };

  await prisma.item.update({
    where: { id: itemId },
    data: { aprovado: false, aprovadoPor: null, aprovadoEm: null },
  });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "APROVACAO_REVOGADA" } });
  revalidatePath(`/itens/${itemId}`);
  revalidatePath("/itens");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function moverParaFase(itemId: string, faseId: string | null) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  await prisma.item.update({ where: { id: itemId }, data: { faseCompraId: faseId } });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "FASE_ALTERADA" } });
  revalidatePath(`/itens/${itemId}`);
  revalidatePath("/itens");
  revalidatePath("/fases");
  return { success: true };
}

export async function pausarItem(itemId: string, motivo: string) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  const item = await prisma.item.update({
    where: { id: itemId },
    data: { pausado: true, motivoPausa: motivo.trim() || null },
    select: { numero: true, equipamento: true },
  });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "ITEM_PAUSADO", detalhes: { motivo } } });

  // Notificar admins
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
  const emails = admins.map((u) => u.email).filter(Boolean) as string[];
  if (emails.length > 0) {
    emailItemPausado({
      to: emails,
      itemNumero: item.numero,
      equipamento: item.equipamento,
      motivo,
      pausadoPor: user.name ?? user.email ?? "Usuário",
    }).catch(() => {});
  }

  revalidatePath(`/itens/${itemId}`);
  revalidatePath("/itens");
  return { success: true };
}

export async function reativarItem(itemId: string) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  await prisma.item.update({
    where: { id: itemId },
    data: { pausado: false, motivoPausa: null },
  });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "ITEM_REATIVADO" } });
  revalidatePath(`/itens/${itemId}`);
  revalidatePath("/itens");
  return { success: true };
}

export async function definirPrioridade(itemId: string, prioridade: PrioridadeItem | null) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  await prisma.item.update({ where: { id: itemId }, data: { prioridade } });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "PRIORIDADE_DEFINIDA", detalhes: { prioridade } } });
  revalidatePath(`/itens/${itemId}`);
  revalidatePath("/itens");
  return { success: true };
}

export async function atualizarPrazoMulta(
  itemId: string,
  data: { prazoEntregaDias?: number | null; multaDiariaPct?: number | null }
) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  await prisma.contratacao.updateMany({
    where: { itemId },
    data: {
      prazoEntregaDias: data.prazoEntregaDias ?? undefined,
      multaDiariaPct:   data.multaDiariaPct   ?? undefined,
    },
  });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "PRAZO_MULTA_ATUALIZADO" } });
  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

export async function criarFornecedor(formData: FormData) {
  const user = await requireAuth();
  if (user.role !== "ADMIN") return { error: "Sem permissão" };

  const nome = (formData.get("nome") as string)?.trim();
  const cnpj = formData.get("cnpj") as string;
  const email = formData.get("email") as string;
  const telefone = formData.get("telefone") as string;

  if (!nome) return { error: "Nome obrigatório" };

  try {
    await prisma.fornecedor.create({ data: { nome, cnpj: cnpj || null, email: email || null, telefone: telefone || null } });
  } catch (e: any) {
    if (e.code === "P2002") return { error: "Fornecedor com este nome já existe" };
    throw e;
  }

  revalidatePath("/fornecedores");
  return { success: true };
}

export async function criarItem(formData: FormData) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  const equipamento = (formData.get("equipamento") as string)?.trim();
  const numero      = (formData.get("numero") as string)?.trim();
  if (!equipamento) return { error: "Nome do equipamento obrigatório" };
  if (!numero)      return { error: "Número do item obrigatório" };

  const qtd       = parseInt(formData.get("qtd") as string) || 1;
  const siaf      = parseInt(formData.get("siafisico") as string) || null;
  const valRef    = parseDecimal(formData.get("valorRef") as string);
  const setorId   = (formData.get("setorId") as string) || null;
  const faseId    = (formData.get("faseId") as string) || null;
  const especif   = (formData.get("especificacao") as string)?.trim() || null;
  const categoria = ((formData.get("categoria") as string) || "MEDICO_HOSPITALAR") as CategoriaItem;

  try {
    const item = await prisma.item.create({
      data: {
        numero,
        equipamento,
        especificacao: especif,
        faseUnicaQtd:       qtd,
        numeroSiafisico:    siaf,
        valorReferenciaFns: valRef ?? undefined,
        setorId:    setorId || undefined,
        faseCompraId: faseId || undefined,
        statusProcesso: "PENDENTE",
        categoria,
      },
    });
    await prisma.log.create({ data: { itemId: item.id, autorId: user.id, acao: "ITEM_CRIADO" } });
  } catch (e: any) {
    if (e.code === "P2002") return { error: `Número "${numero}" já está em uso` };
    throw e;
  }

  revalidatePath("/itens");
  return { success: true };
}

export async function editarItem(itemId: string, formData: FormData) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  const equipamento = (formData.get("equipamento") as string)?.trim();
  if (!equipamento) return { error: "Nome do equipamento obrigatório" };

  const qtd       = parseInt(formData.get("qtd") as string) || undefined;
  const siaf      = parseInt(formData.get("siafisico") as string) || null;
  const valRef    = parseDecimal(formData.get("valorRef") as string);
  const setorId   = (formData.get("setorId") as string) || null;
  const faseId    = (formData.get("faseId") as string) || null;
  const especif   = (formData.get("especificacao") as string)?.trim() || null;
  const ata       = formData.get("presencaEmAta") === "true";
  const catRaw    = formData.get("categoria") as string | null;
  const categoria = catRaw ? (catRaw as CategoriaItem) : undefined;

  await prisma.item.update({
    where: { id: itemId },
    data: {
      equipamento,
      especificacao:      especif,
      faseUnicaQtd:       qtd,
      numeroSiafisico:    siaf,
      valorReferenciaFns: valRef ?? undefined,
      setorId:     setorId || null,
      faseCompraId: faseId || null,
      presencaEmAta: ata,
      ...(categoria ? { categoria } : {}),
    },
  });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "ITEM_EDITADO" } });
  revalidatePath(`/itens/${itemId}`);
  revalidatePath("/itens");
  return { success: true };
}

// ─── Import em massa de itens via CSV / Excel ────────────────────────────────

type ImportResult = { created: number; skipped: number; errors: string[] };

interface RawRow {
  [key: string]: string | number | undefined | null;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pickField(row: RawRow, ...candidates: string[]): string | number | undefined | null {
  for (const c of candidates) {
    const normalized = normalizeHeader(c);
    for (const key of Object.keys(row)) {
      if (normalizeHeader(key) === normalized) return row[key];
    }
  }
  return undefined;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v));
  return isNaN(n) ? null : n;
}

function toDecimalOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/[^0-9.,]/g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

function parseCSV(text: string): RawRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Detect delimiter: prefer semicolon if present in header, else comma
  const delimiter = lines[0].includes(";") ? ";" : ",";

  const headers = lines[0].split(delimiter).map((h) => h.replace(/^"|"$/g, "").trim());

  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((v) => v.replace(/^"|"$/g, "").trim());
    const obj: RawRow = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? "";
    });
    return obj;
  });
}

export async function importarItens(formData: FormData): Promise<ImportResult> {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") throw new Error("Sem permissão");

  const file = formData.get("file") as File | null;
  if (!file) return { created: 0, skipped: 0, errors: ["Nenhum arquivo enviado"] };

  const MAX_ROWS = 500;
  const errors: string[] = [];
  let rows: RawRow[] = [];

  const fileName = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "" });
  } else if (fileName.endsWith(".csv")) {
    const text = buffer.toString("utf-8");
    rows = parseCSV(text);
  } else {
    return { created: 0, skipped: 0, errors: ["Formato não suportado. Use .csv, .xlsx ou .xls"] };
  }

  if (rows.length === 0) return { created: 0, skipped: 0, errors: ["Arquivo vazio ou sem dados"] };

  // Validate required columns exist
  const firstRow = rows[0];
  const hasNumero = toStr(pickField(firstRow, "Nº", "numero", "N°", "No")) !== "" ||
    Object.keys(firstRow).some((k) => ["nº", "numero", "n°", "no"].includes(normalizeHeader(k)));
  const hasEquip = Object.keys(firstRow).some((k) =>
    ["equipamento"].includes(normalizeHeader(k))
  );

  if (!hasNumero) errors.push("Coluna obrigatória não encontrada: 'Nº' ou 'numero'");
  if (!hasEquip) errors.push("Coluna obrigatória não encontrada: 'Equipamento' ou 'equipamento'");
  if (errors.length > 0) return { created: 0, skipped: 0, errors };

  if (rows.length > MAX_ROWS) {
    return { created: 0, skipped: 0, errors: [`Máximo de ${MAX_ROWS} linhas por upload (enviado: ${rows.length})`] };
  }

  // Build payload
  const toCreate: {
    numero: string;
    equipamento: string;
    especificacao: string | null;
    faseUnicaQtd: number;
    valorReferenciaFns: number | null;
    numeroSiafisico: number | null;
    statusProcesso: StatusProcesso;
  }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2; // 1-based + header

    const numero = toStr(pickField(row, "Nº", "numero", "N°", "No"));
    const equipamento = toStr(pickField(row, "Equipamento", "equipamento"));

    if (!numero) { errors.push(`Linha ${lineNum}: campo 'Nº' vazio`); continue; }
    if (!equipamento) { errors.push(`Linha ${lineNum}: campo 'Equipamento' vazio`); continue; }

    const especificacao = toStr(pickField(row, "Especificacao", "especificacao", "Especificação")) || null;
    const qtdRaw = pickField(row, "Qtd", "qtd", "Quantidade", "quantidade");
    const faseUnicaQtd = toIntOrNull(qtdRaw) ?? 1;
    const valorReferenciaFns = toDecimalOrNull(pickField(row, "ValorRef", "valor_ref", "Valor Ref", "ValorReferencia"));
    const numeroSiafisico = toIntOrNull(pickField(row, "SIAFISICO", "siafisico", "Siafisico"));

    toCreate.push({
      numero,
      equipamento,
      especificacao,
      faseUnicaQtd,
      valorReferenciaFns,
      numeroSiafisico,
      statusProcesso: "PENDENTE",
    });
  }

  if (toCreate.length === 0) {
    return { created: 0, skipped: 0, errors: errors.length > 0 ? errors : ["Nenhuma linha válida encontrada"] };
  }

  // Get existing numbers to compute skipped count
  const numbersToInsert = toCreate.map((r) => r.numero);
  const existing = await prisma.item.findMany({
    where: { numero: { in: numbersToInsert } },
    select: { numero: true },
  });
  const existingSet = new Set(existing.map((e) => e.numero));

  const result = await prisma.item.createMany({
    data: toCreate,
    skipDuplicates: true,
  });

  const created = result.count;
  const skipped = numbersToInsert.length - errors.length - created + existingSet.size - existingSet.size;
  // Simpler: skipped = rows that were valid but already existed
  const validCount = toCreate.length;
  const skippedCount = validCount - created;

  revalidatePath("/itens");
  return { created, skipped: skippedCount, errors };
}

// ─── Campos exclusivos de Equipamentos Médico-Hospitalares ───────────────────

export async function salvarCamposMedicos(
  itemId: string,
  data: {
    fabricante?:          string;
    modelo?:              string;
    registroAnvisa?:      string;
    criticidade?:         CriticidadeItem | null;
    precisaInstalacao?:   boolean;
    precisaTreinamento?:  boolean;
    precisaCalibracao?:   boolean;
    precisaTesteEletrico?: boolean;
    responsavelTecnico?:  string;
    statusInstalacao?:    StatusInstalacao | null;
    statusTreinamento?:   StatusTreinamento | null;
    dataAceiteTecnico?:   string | null;
  },
) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  await prisma.item.update({
    where: { id: itemId },
    data: {
      fabricante:          data.fabricante          ?? undefined,
      modelo:              data.modelo              ?? undefined,
      registroAnvisa:      data.registroAnvisa      ?? undefined,
      criticidade:         data.criticidade         ?? undefined,
      precisaInstalacao:   data.precisaInstalacao   ?? undefined,
      precisaTreinamento:  data.precisaTreinamento  ?? undefined,
      precisaCalibracao:   data.precisaCalibracao   ?? undefined,
      precisaTesteEletrico: data.precisaTesteEletrico ?? undefined,
      responsavelTecnico:  data.responsavelTecnico  ?? undefined,
      statusInstalacao:    data.statusInstalacao    ?? undefined,
      statusTreinamento:   data.statusTreinamento   ?? undefined,
      dataAceiteTecnico:   data.dataAceiteTecnico
        ? new Date(data.dataAceiteTecnico)
        : data.dataAceiteTecnico === null ? null : undefined,
    },
  });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "CAMPOS_MEDICOS_ATUALIZADOS" } });
  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

export async function marcarConcluido(itemId: string) {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  await prisma.item.update({ where: { id: itemId }, data: { statusProcesso: "CONCLUIDO" } });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "ITEM_CONCLUIDO" } });
  revalidatePath(`/itens/${itemId}`);
  revalidatePath("/itens");
  return { success: true };
}

// ─── Importar arquivo de URL externa ─────────────────────────────────────────
// Faz download de uma URL externa (Drive, etc.), salva no volume local e cria
// um registro Anexo vinculado ao item (e opcionalmente ao orçamento).

const ALLOWED_DOWNLOAD_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  // Office / planilhas
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/csv": "csv",
  // Fallback genérico (Google Drive/octet-stream)
  "application/octet-stream": "bin",
};

/** Transforma URLs do Google Drive/Sheets/Docs em links de download direto */
function transformDriveUrl(url: string): string {
  // Google Drive file: .../file/d/{ID}/view
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFile) return `https://drive.google.com/uc?id=${driveFile[1]}&export=download`;

  // Google Drive open link: ...open?id={ID}
  const driveOpen = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveOpen) return `https://drive.google.com/uc?id=${driveOpen[1]}&export=download`;

  // Google Sheets → exportar como PDF
  const sheets = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheets) return `https://docs.google.com/spreadsheets/d/${sheets[1]}/export?format=pdf`;

  // Google Docs → exportar como PDF
  const docs = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docs) return `https://docs.google.com/document/d/${docs[1]}/export?format=pdf`;

  // Google Slides → exportar como PDF
  const slides = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slides) return `https://docs.google.com/presentation/d/${slides[1]}/export?format=pdf`;

  return url;
}

// ─── Núcleo de download (sem auth — chamado por funções com auth) ─────────────

async function _baixarESalvar({
  dbUserId, itemId, itemNumero, externalUrl, category, orcamentoId,
}: {
  dbUserId: string;
  itemId: string;
  itemNumero: string;
  externalUrl: string;
  category: string;
  orcamentoId?: string;
}): Promise<{ success: true; id: string; url: string; nome: string } | { error: string }> {
  const downloadUrl = transformDriveUrl(externalUrl);

  let response: Response;
  try {
    response = await fetch(downloadUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AION-Aquisicoes/1.0)",
        "Accept": "application/pdf,application/octet-stream,*/*",
      },
      redirect: "follow",
    });
  } catch {
    return { error: "Não foi possível acessar a URL" };
  }

  if (!response.ok) return { error: `HTTP ${response.status}` };

  const rawContentType = response.headers.get("content-type") ?? "application/octet-stream";
  if (rawContentType.includes("text/html")) {
    return { error: "Arquivo privado — compartilhe como 'qualquer pessoa com o link'" };
  }

  const contentType = rawContentType.split(";")[0].trim();
  let finalMime = contentType;
  let finalExt: string;

  if (ALLOWED_DOWNLOAD_TYPES[contentType] && ALLOWED_DOWNLOAD_TYPES[contentType] !== "bin") {
    finalExt = ALLOWED_DOWNLOAD_TYPES[contentType];
  } else {
    const urlPath = new URL(downloadUrl).pathname;
    const urlExt  = urlPath.split(".").pop()?.toLowerCase() ?? "";
    const extToMime: Record<string, string> = {
      pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg",
      png: "image/png", webp: "image/webp",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls:  "application/vnd.ms-excel",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword", csv: "text/csv",
    };
    if (extToMime[urlExt]) {
      finalMime = extToMime[urlExt];
      finalExt  = urlExt;
    } else if (downloadUrl.includes("/export?format=pdf") || contentType === "application/octet-stream") {
      finalMime = "application/pdf";
      finalExt  = "pdf";
    } else {
      return { error: `Tipo não suportado: ${contentType}` };
    }
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > 30 * 1024 * 1024) return { error: "Arquivo muito grande (máx 30 MB)" };

  const urlFilename = new URL(externalUrl).pathname.split("/").pop()?.replace(/[^a-zA-Z0-9._-]/g, "_") ?? "documento";
  const ts       = Date.now();
  const fileName = `${ts}-${urlFilename.slice(0, 60)}.${finalExt}`;
  const dir      = path.join(UPLOAD_ROOT, "uploads", itemNumero, category);
  const filePath = path.join(dir, fileName);

  await mkdir(dir, { recursive: true });
  await writeFile(filePath, buffer);

  const urlServePath = `/api/files/${itemNumero}/${category}/${fileName}`;
  const displayName  = urlFilename.includes(".") ? urlFilename : `${urlFilename}.${finalExt}`;

  const anexo = await prisma.anexo.create({
    data: {
      nome: fileName,
      nomeOriginal: displayName,
      mimeType: finalMime,
      tamanho: buffer.byteLength,
      url: urlServePath,
      bucket: "local",
      autorId: dbUserId,
      itemId,
      ...(orcamentoId ? { orcamentoId } : {}),
    },
  });

  await prisma.log.create({ data: { itemId, autorId: dbUserId, acao: "ANEXO_IMPORTADO" } });

  return { success: true, id: anexo.id, url: urlServePath, nome: displayName };
}

// ─── Importar um link externo individual ─────────────────────────────────────

export async function importarAnexoExterno(
  itemId: string,
  externalUrl: string,
  category: "especificacao" | "cotacao" | "nf" | "entrega" | "teste" | "contrato" | "geral",
  orcamentoId?: string,
): Promise<{ success: true; id: string; url: string; nome: string } | { error: string }> {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };
  if (!externalUrl || !externalUrl.startsWith("http")) return { error: "URL inválida" };

  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true, numero: true } });
  if (!item) return { error: "Item não encontrado" };

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! }, select: { id: true } });
  if (!dbUser) return { error: "Usuário não encontrado" };

  const res = await _baixarESalvar({
    dbUserId: dbUser.id, itemId: item.id, itemNumero: item.numero,
    externalUrl, category, orcamentoId,
  });

  if ("success" in res) revalidatePath(`/itens/${itemId}`);
  return res;
}

// ─── Importar TODOS os links externos em massa ───────────────────────────────

export interface ResultadoImportacao {
  especificacoes: {
    total: number;
    importadas: number;
    jaExistiam: number;
    erros: { numero: string; equipamento: string; erro: string }[];
  };
  cotacoes: {
    total: number;
    importadas: number;
    jaExistiam: number;
    erros: { numero: string; fornecedor: string; erro: string }[];
  };
}

export async function importarTodosAnexosExternos(): Promise<ResultadoImportacao> {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") throw new Error("Sem permissão");

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! }, select: { id: true } });
  if (!dbUser) throw new Error("Usuário não encontrado");

  const espErros: ResultadoImportacao["especificacoes"]["erros"] = [];
  let espTotal = 0, espImportadas = 0, espJaExistiam = 0;

  const cotErros: ResultadoImportacao["cotacoes"]["erros"] = [];
  let cotTotal = 0, cotImportadas = 0, cotJaExistiam = 0;

  // ── 1. Especificações técnicas ──────────────────────────────────────────────
  const itens = await prisma.item.findMany({
    where: { especificacaoUrl: { not: null } },
    select: {
      id: true, numero: true, equipamento: true, especificacaoUrl: true,
      // Verificar se já tem arquivo de especificação importado
      anexos: { where: { url: { contains: "/especificacao/" } }, select: { id: true }, take: 1 },
    },
  });

  for (const item of itens) {
    if (!item.especificacaoUrl) continue;
    espTotal++;

    if (item.anexos.length > 0) {
      espJaExistiam++;
      continue;
    }

    const res = await _baixarESalvar({
      dbUserId: dbUser.id,
      itemId: item.id,
      itemNumero: item.numero,
      externalUrl: item.especificacaoUrl,
      category: "especificacao",
    });

    if ("error" in res) {
      espErros.push({ numero: item.numero, equipamento: item.equipamento, erro: res.error });
    } else {
      espImportadas++;
    }
  }

  // ── 2. Cotações (orcamentos) ────────────────────────────────────────────────
  const orcamentos = await prisma.orcamento.findMany({
    where: { cotacaoUrl: { not: null } },
    select: {
      id: true, cotacaoUrl: true,
      item:      { select: { id: true, numero: true } },
      fornecedor: { select: { nome: true } },
      // Verificar se este orçamento já tem arquivos
      anexos: { select: { id: true }, take: 1 },
    },
  });

  for (const orc of orcamentos) {
    if (!orc.cotacaoUrl) continue;
    cotTotal++;

    if (orc.anexos.length > 0) {
      cotJaExistiam++;
      continue;
    }

    const res = await _baixarESalvar({
      dbUserId: dbUser.id,
      itemId: orc.item.id,
      itemNumero: orc.item.numero,
      externalUrl: orc.cotacaoUrl,
      category: "cotacao",
      orcamentoId: orc.id,
    });

    if ("error" in res) {
      cotErros.push({ numero: orc.item.numero, fornecedor: orc.fornecedor.nome, erro: res.error });
    } else {
      cotImportadas++;
    }
  }

  revalidatePath("/itens");

  return {
    especificacoes: { total: espTotal, importadas: espImportadas, jaExistiam: espJaExistiam, erros: espErros },
    cotacoes:       { total: cotTotal, importadas: cotImportadas, jaExistiam: cotJaExistiam, erros: cotErros },
  };
}

// ─── Atualizar URL da cotação de um orçamento existente ──────────────────────

export async function atualizarCotacaoUrl(
  orcamentoId: string,
  itemId: string,
  url: string,
): Promise<{ success: true } | { error: string }> {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") return { error: "Sem permissão" };

  await prisma.orcamento.update({
    where: { id: orcamentoId },
    data: { cotacaoUrl: url.trim() || null },
  });

  await prisma.log.create({
    data: { itemId, autorId: user.id, acao: "COTACAO_URL_ATUALIZADA" },
  });

  revalidatePath(`/itens/${itemId}`);
  return { success: true };
}

// ─── Reclassificar item individualmente ───────────────────────────────────────

export async function reclassificarItem(id: string, categoria: string): Promise<void> {
  const user = await requireAuth();
  if (user.role === "FORNECEDOR") throw new Error("Sem permissão");

  await prisma.item.update({
    where: { id },
    data: { categoria: categoria as CategoriaItem },
  });

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! }, select: { id: true } });
  if (dbUser) {
    await prisma.log.create({
      data: { itemId: id, autorId: dbUser.id, acao: `RECLASSIFICADO: ${categoria}` },
    });
  }

  revalidatePath(`/itens/${id}`);
  revalidatePath("/itens");
}
