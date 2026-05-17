"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { StatusProcesso, PrioridadeItem } from "@prisma/client";
import {
  emailItemAprovado,
  emailItemPausado,
  emailNovoContrato,
} from "@/lib/email";

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

  const qtd     = parseInt(formData.get("qtd") as string) || 1;
  const siaf    = parseInt(formData.get("siafisico") as string) || null;
  const valRef  = parseDecimal(formData.get("valorRef") as string);
  const setorId = (formData.get("setorId") as string) || null;
  const faseId  = (formData.get("faseId") as string) || null;
  const especif = (formData.get("especificacao") as string)?.trim() || null;

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

  const qtd    = parseInt(formData.get("qtd") as string) || undefined;
  const siaf   = parseInt(formData.get("siafisico") as string) || null;
  const valRef = parseDecimal(formData.get("valorRef") as string);
  const setorId  = (formData.get("setorId") as string) || null;
  const faseId   = (formData.get("faseId") as string) || null;
  const especif  = (formData.get("especificacao") as string)?.trim() || null;
  const ata      = formData.get("presencaEmAta") === "true";

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
    },
  });
  await prisma.log.create({ data: { itemId, autorId: user.id, acao: "ITEM_EDITADO" } });
  revalidatePath(`/itens/${itemId}`);
  revalidatePath("/itens");
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
