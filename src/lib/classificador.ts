/**
 * Engine de classificação automática de itens hospitalares.
 * Usa correspondência de palavras-chave em português sobre o nome
 * e descrição do item. Retorna categoria proposta + score de confiança.
 */

export type CatProposta = "MEDICO_HOSPITALAR" | "TI" | "MOBILIARIO";

export interface ClassificacaoResult {
  categoria: CatProposta;
  confianca: number;          // 0-100
  palavrasEncontradas: string[];
}

// ─── Normalização ─────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // remove acentos
    .replace(/[^a-z0-9 ]/g, " ")       // mantém só letras/números/espaço
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Listas de palavras-chave ─────────────────────────────────────────────────

// TI — termos de alta especificidade (baixo risco de falso positivo)
const TI_ALTO: string[] = [
  "servidor", "server", "switch", "roteador", "router", "firewall",
  "nobreak", "no break", "no-break", "ups ", "storage", "backup",
  "rack ", "dataswitch", "wifi", "wi-fi", "wireless", "access point",
  "ponto de acesso", "patch panel", "cabeamento estruturado", "fibra optica",
  "computador", "desktop", "notebook", "laptop", "microcomputador",
  "workstation", "thin client", "terminal de acesso",
  "impressora", "scanner ", "multifuncional",
  "monitor de video", "monitor lcd", "monitor led",
  "teclado ", "mouse ", "webcam",
  "projetor", "data show", "datashow",
  "pacs", " ris ", " his ", "prontuario eletronico", "sistema de informacao",
  "rede local", "lan ", "vlan", "cftv", "camera de seguranca", "nvr ", "dvr ",
  "tablet ", "smartphone", "celular corporativo",
  "totem ", "display digital", "televisao", " tv ",
  "hub ", "modem ", "gateway ", "placa de rede",
  "software ", "licenca de software", "antivirus",
  "cofre de senha", "ups rack",
];

// TI — termos de especificidade média (requerem confirmação por ausência de contexto médico)
const TI_MEDIO: string[] = [
  "estabilizador", "fonte de alimentacao", "cabos de rede",
  "central telefonica", "pabx", "ramal", "interfone",
  "ativo de rede", "infra de rede", "cabeamento",
  "caixa de som", "microfone", "audiovisual",
];

// MOBILIARIO — termos de alta especificidade
const MOB_ALTO: string[] = [
  "cadeira administrativa", "cadeira giratoria", "cadeira de escritorio",
  "cadeira fixa", "cadeira de espera",
  "mesa administrativa", "mesa de escritorio", "mesa de reuniao",
  "mesa de recepcao", "mesa de cozinha",
  "armario de aco", "armario de arquivo", "armario de escritorio",
  "estante de aco", "estante de livros", "prateleira de aco",
  "divisoria", "painel divisorio",
  "poltrona de espera", "sofa de espera", "sofa ",
  "locker ", "roupeiro ", "arquivo morto",
  "bancada administrativa", "bancada de recepcao",
  "cortina ", "persiana ", "persianas",
  "mesa de refeitorio", "banco de refeitorio",
  "rack para tv", "suporte de parede para tv",
  "espelho de parede", "moldura", "quadro decorativo",
  "cabideiro", "porta-objetos",
  "escrivaninha",
];

// MOBILIARIO — termos médios (ambíguos — só classifica se não tiver sinal médico)
const MOB_MEDIO: string[] = [
  "cadeira ", "mesa ", "armario ", "estante ", "prateleira ",
  "bancada ", "balcao ", "poltrona ", "lixeira ",
];

// Termos que indicam contexto MÉDICO mesmo em palavras ambíguas
// (se presentes, anulam classificação como mobiliário)
const MEDICO_OVERRIDE: string[] = [
  "hospitalar", "clinico", "cirurgico", "medico", "odontologico",
  "uti", "upa", "ue ", "unidade de terapia", "centro cirurgico",
  "esterilizacao", "cme ", "farmacia", "laboratorio", "radiologia",
  "rx", "raio-x", "ultrassom", "tomografia", "ressonancia", "endoscopia",
  "eletrocardiograma", "ecg", "oximetro", "esfigmomanometro", "desfibrilador",
  "ventilador", "respirador", "anestesia", "bercario", "neonatal",
  "obstetricia", "parto", "hemodinamica", "hemodialise",
  "curativo", "infusao", "bomba ", "seringa", "cateter", "sonda",
  "leito ", "maca ", "cama hospitalar", "cama eletrica",
  "suporte de soro", "suporte para soro",
  "carrinho de anestesia", "carrinho de curativo", "carrinho de medicamento",
  "cadeira de rodas", "cadeira de banho",
  "banheiro", "higienizacao do paciente",
  "autoclave", "estufa ", "lavadora",
  "foco cirurgico", "negatoscopio", "otoscopio",
  "bisturi", "pinça", "tesoura cirurgica",
  "anvisa", "registro anvisa",
];

// ─── Função principal ─────────────────────────────────────────────────────────

export function classificarItem(
  equipamento: string,
  descricao?: string | null,
): ClassificacaoResult {
  const texto = norm(`${equipamento} ${descricao ?? ""}`);

  // Verifica contexto médico explícito (anula ambiguidades)
  const temContextoMedico = MEDICO_OVERRIDE.some((w) => texto.includes(norm(w)));

  // ── Score TI ─────────────────────────────────────────────────────────────
  const tiAltoHits  = TI_ALTO .filter((w) => texto.includes(norm(w)));
  const tiMedioHits = TI_MEDIO.filter((w) => texto.includes(norm(w)));
  const tiScore     = tiAltoHits.length * 3 + tiMedioHits.length * 1;

  // ── Score Mobiliário ──────────────────────────────────────────────────────
  const mobAltoHits  = temContextoMedico ? [] : MOB_ALTO .filter((w) => texto.includes(norm(w)));
  const mobMedioHits = temContextoMedico ? [] : MOB_MEDIO.filter((w) => texto.includes(norm(w)));
  const mobScore     = mobAltoHits.length * 3 + mobMedioHits.length * 1;

  // ── Decisão ───────────────────────────────────────────────────────────────
  if (tiScore > 0 && tiScore >= mobScore) {
    const palavras = [...tiAltoHits, ...tiMedioHits];
    return {
      categoria: "TI",
      confianca: tiAltoHits.length > 0 ? Math.min(98, 60 + tiAltoHits.length * 15) : 45,
      palavrasEncontradas: palavras,
    };
  }

  if (mobScore > 0 && mobScore > tiScore) {
    const palavras = [...mobAltoHits, ...mobMedioHits];
    return {
      categoria: "MOBILIARIO",
      confianca: mobAltoHits.length > 0 ? Math.min(98, 60 + mobAltoHits.length * 15) : 40,
      palavrasEncontradas: palavras,
    };
  }

  // Default: Médico-Hospitalar
  return {
    categoria: "MEDICO_HOSPITALAR",
    // Alta confiança se tem sinal médico explícito, média se é só o default
    confianca: temContextoMedico ? 92 : 70,
    palavrasEncontradas: temContextoMedico
      ? MEDICO_OVERRIDE.filter((w) => texto.includes(norm(w)))
      : [],
  };
}
