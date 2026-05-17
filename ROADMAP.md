# Roadmap — Sistema de Gestão de Aquisições AION
**Hospital Estadual Três Colinas · Fase Única 2026 · Gestão FAEPA**

> Última atualização: 2026-05-16
> Status: Fase 1 em andamento

---

## Estado atual do sistema (baseline)

### O que está funcionando
- [x] Autenticação (ADMIN / HOSPITAL / FORNECEDOR)
- [x] 236 itens importados da planilha com orçamentos, valores e status
- [x] 553 links de cotação (PDFs Google Drive) vinculados aos orçamentos
- [x] 171 links de especificação técnica (PDFs Google Drive)
- [x] Download automático dos PDFs no startup do servidor (`/data/uploads/`)
- [x] Painel de progresso do download em `/config`
- [x] Upload de evidências por categoria (NF, entrega, teste, contrato)
- [x] Fluxo completo: cotação → contrato → entrega → NF → teste → conclusão
- [x] Dashboard com KPIs reais (itens, valores, alertas)
- [x] Relatórios com funil de execução e desempenho por fornecedor
- [x] Identidade visual AION (azul + logo no sidebar e login)
- [x] Deploy no Railway com volume `/data` persistente

### Gaps críticos identificados
- [ ] Cotação vencedora não está explicitamente marcada no banco
- [ ] Saving em 3 camadas não calculado (FNS → melhor cotação → contratado)
- [ ] Descritivo técnico de compra separado do descritivo RENEM/FNS
- [ ] 39 itens sem especificação própria (link para FNS genérico)
- [ ] 26 itens sem nenhum descritivo ou link
- [ ] Equipamentos não organizados por setor hospitalar
- [ ] Sem faseamento (todos os 236 itens tratados como urgentes)
- [ ] Sem aprovação antes de contratar
- [ ] Sem PWA / interface mobile
- [ ] Garantia não rastreada após entrega

---

## Fase 1 — Controle de Compra e Descritivos
**Prioridade: CRÍTICA | Prazo estimado: 2 semanas**

### 1.1 Descritivos — dois níveis por equipamento

**Situação atual:**
| Tipo | Qtd | Estado |
|---|---|---|
| 171 itens | PDF de especificação própria no Drive | Link salvo, download automático |
| 39 itens | Link para `consultafns.saude.gov.br` | Sem spec dedicada — só descrição RENEM genérica |
| 26 itens | Sem link nem especificação | Móveis e infraestrutura |

**O que fazer:**
- Adicionar campo `descritivoTecnico String?` no schema — texto livre editável
- `descritivoRenem` = descritivo oficial FNS/RENEM → **referência imutável, base legal**
- `descritivoTecnico` = descritivo técnico da AION → **usado efetivamente no edital/contrato**
- UI: editar `descritivoTecnico` diretamente na aba "Especificação" do item
- Indicação visual quando `descritivoTecnico` está vazio (alerta)

**Extração dos descritivos FNS (39 itens):**
- O site `consultafns.saude.gov.br` tem busca por código SIAFÍSICO e por nome
- Script de scraping para extrair o descritivo completo dos 39 equipamentos que apontam para FNS
- Salvar como `descritivoFns String?` — campo separado para o texto completo oficial do FNS
- Campos por item: `descritivoRenem` (coluna B da planilha) + `descritivoFns` (extraído do site) + `descritivoTecnico` (elaborado pela equipe AION)

**Schema changes:**
```prisma
model Item {
  ...
  descritivoFns       String?   // texto completo extraído do consultafns
  descritivoTecnico   String?   // spec de compra elaborada pela AION
  versaoDescritivo    Int       @default(1)
  descritivoAtualizadoEm DateTime?
}
```

### 1.2 Cotação vencedora explícita

**Problema:** O banco sabe qual fornecedor foi contratado, mas não registra qual dos 3 orçamentos ganhou. Isso impede calcular o saving corretamente.

**O que fazer:**
- Adicionar `Contratacao.orcamentoVencedorId String?` → FK para `Orcamento`
- Na tela de contratação: selecionar qual orçamento ganhou (ou informar que foi negociação direta)
- `Orcamento.vencedor Boolean @default(false)` para flag rápida de consulta

**Schema changes:**
```prisma
model Contratacao {
  ...
  orcamentoVencedorId String?
  orcamentoVencedor   Orcamento? @relation(fields: [orcamentoVencedorId], references: [id])
  negociacaoDireta    Boolean   @default(false)  // ganhou sem orçamento formal
}

model Orcamento {
  ...
  vencedor      Boolean   @default(false)
  validadeAte   DateTime? // proposta expira quando?
}
```

### 1.3 Saving em 3 camadas

**Modelo de cálculo:**
```
Referência FNS      = Item.valorReferenciaFns × Item.faseUnicaQtd
Melhor cotação      = MIN(Orcamento.valor) × Item.faseUnicaQtd
Valor contratado    = Contratacao.valorContratado

Saving mercado      = FNS - Melhor cotação        (quanto o mercado cobrou menos)
Saving negociação   = Melhor cotação - Contratado  (quanto foi negociado além)
Saving total        = FNS - Contratado             (economia total para FNS)
```

**Onde mostrar:**
- Aba "Orçamentos" do item: linha de resumo com os 3 savings
- Dashboard: KPI "Saving acumulado" por camada
- Relatórios: gráfico saving mercado vs saving negociação por fornecedor

### 1.4 Setor hospitalar

**O que fazer:**
- Novo model `Setor` com setores do hospital
- `Item.setorId String?` → FK para `Setor`
- Preencher setor via planilha (importação) ou manualmente na UI
- Filtro por setor na lista de itens
- KPIs de setor no dashboard (orçamento, % entregue, saving)

**Setores iniciais:**
UTI Adulto, UTI Neonatal, Centro Cirúrgico, CME, Emergência, Maternidade, Neonatologia, Diagnóstico por Imagem, Laboratório, Farmácia, Recepção/Administração, Infraestrutura

**Schema changes:**
```prisma
model Setor {
  id        String  @id @default(cuid())
  nome      String  @unique
  sigla     String?
  cor       String? // cor para o dashboard
  itens     Item[]
  createdAt DateTime @default(now())
}

model Item {
  ...
  setor     Setor?  @relation(fields: [setorId], references: [id])
  setorId   String?
}
```

### 1.5 Número de série e localização física

**O que fazer:**
- Campos preenchidos no momento da entrega ou teste inicial
- `Item.numeroSerie String?` — número de série do equipamento entregue
- `Item.localizacaoFisica String?` — "Bloco B - Sala 203 - UTI Adulto"
- `Item.patrimonioHospital String?` — número de patrimônio dado pelo hospital
- Mostrar na aba "Geral" do item

---

## Fase 2 — Faseamento e Governança
**Prioridade: ALTA | Prazo estimado: 2 semanas após Fase 1**

### 2.1 Fases de compra

**Contexto:** Nem todos os 236 itens precisam ser comprados agora. Alguns podem ser deferidos, cancelados ou aguardar condição clínica.

**O que fazer:**
- Novo model `FaseCompra` com nome, descrição e ordem
- `Item.faseCompraId` → FK para `FaseCompra`
- `Item.prioridade` enum: `CRITICA | ALTA | MEDIA | BAIXA`
- `Item.pausado Boolean @default(false)`
- `Item.motivoPausa String?`
- Aba "Fase 2" na lista de itens com itens pausados/diferidos
- Ação bulk: mover vários itens entre fases

**Fases iniciais sugeridas:**
1. **Fase Única 2026** — compra imediata (baseline atual)
2. **Fase 2 / Aguardando** — necessário mas sem urgência imediata
3. **Reserva Técnica** — comprar só se necessário clinicamente
4. **Cancelado** — não será comprado nesta etapa

### 2.2 Workflow de aprovação

**Contexto:** Atualmente é possível contratar sem aprovação formal. Isso é um risco de governança para o FNS.

**O que fazer:**
- `Item.aprovadoParaContratacao Boolean @default(false)`
- `Item.aprovadoPor String?` + `Item.aprovadoEm DateTime?`
- Ação de aprovação disponível só para ADMIN
- Contratação bloqueada enquanto item não aprovado (com override para ADMIN)
- Log de auditoria: quem aprovou, quando, com qual justificativa

### 2.3 Alertas de validade de proposta

**Problema:** Uma cotação de 90 dias atrás pode não ter mais o preço válido.

**O que fazer:**
- `Orcamento.validadeAte DateTime?` — data de validade da proposta
- Alert no item: "X orçamentos com proposta vencida"
- Alert no dashboard: total de propostas vencidas
- Filtro na lista: "com proposta vencida"

### 2.4 Penalidades contratuais

- `Contratacao.prazoEntregaDias Int?` — prazo prometido em dias corridos
- `Contratacao.multaDiaria Decimal?` — % de multa por dia de atraso
- Cálculo automático de multa acumulada quando prazo extrapolado
- Alert quando contrato está no prazo ou vencido

---

## Fase 3 — PWA e Mobile
**Prioridade: ALTA | Prazo estimado: 1 semana**

### 3.1 Progressive Web App (PWA)

**O que fazer:**
- Instalar `next-pwa` (wrapper de Workbox para Next.js)
- `public/manifest.json` com nome, ícones AION e `"display": "standalone"`
- Ícones em múltiplas resoluções: 192×192 e 512×512 (PNG com logo AION)
- Service worker: cache das páginas `/itens`, `/itens/[id]`, `/dashboard`
- Offline: exibir última versão em cache quando sem internet
- Meta tags para iOS: `apple-mobile-web-app-capable`, `apple-touch-icon`

**Resultado esperado:**
- No celular: "Adicionar à tela inicial" → abre como app nativo
- Sem barra de navegação do browser
- Ícone AION na tela inicial

### 3.2 Layout responsivo mobile

**Mudanças necessárias:**
- Sidebar → **Bottom Navigation** no mobile (≤768px)
- Cards em coluna única no mobile
- Touch targets mínimo 44px de altura
- Topbar simplificada no mobile (só título + ação principal)
- Tabela de itens → cards no mobile (scroll vertical)
- Filtros → bottom sheet no mobile

### 3.3 Câmera nativa para evidências

**O que fazer:**
- `<input type="file" accept="image/*" capture="environment">` para câmera traseira
- Compressão client-side: Canvas API reduz para máx 1200px e 80% qualidade antes do upload
- Categorias de foto direto da câmera:
  - 📷 Nota fiscal (foto do papel)
  - 📷 Equipamento na entrega (lacrado)
  - 📷 Equipamento instalado
  - 📷 Etiqueta de patrimônio
  - 📷 Dano ou irregularidade (com campo de texto obrigatório)
- Upload direto para `/api/upload` com indicador de progresso

### 3.4 QR Code por equipamento

**O que fazer:**
- Gerar QR Code com URL `https://{dominio}/itens/{id}` para cada item
- Biblioteca: `qrcode` (npm, sem dependências externas)
- Página de impressão: `/itens/qr-labels` — grid 3×4 por página A4
- Formato da etiqueta: QR + número EQ-XXX + nome do equipamento (truncado)
- Scan pelo celular → abre direto o registro do item
- Uso: colar no equipamento no momento da entrega

---

## Fase 4 — Garantia e Ciclo de Vida
**Prioridade: MÉDIA | Prazo estimado: 2 semanas após Fase 3**

### 4.1 Rastreamento de garantia

- `Item.garantiaMeses Int?` — prazo de garantia do fabricante
- `Item.garantiaInicio DateTime?` — data de início (geralmente data da entrega)
- `Item.garantiaVence DateTime?` — calculado automaticamente
- `Item.garantiaFornecedorContato String?` — quem acionar em caso de defeito
- Alert: 60 dias antes do vencimento da garantia
- Relatório de garantias vencendo nos próximos 90 dias

### 4.2 Registro de patrimônio e série

- `Item.numeroSerie String?`
- `Item.siafisicoDefinitivo Int?` — pode diferir do número da planilha original
- `Item.patrimonioHospital String?`
- `Item.localizacaoFisica String?`
- Esses campos preenchidos na conclusão do teste inicial

### 4.3 Integração com POPs de calibração

**Contexto:** Já existem PDFs de POP em `/Users/leandroborges/Desktop/POPs Aion/POPs 3/`

- `Item.popCalibracaoUrl String?` — link para o POP correspondente
- `Item.calibracaoRequerida Boolean @default(false)`
- `Item.proximaCalibracaoEm DateTime?`
- Matching automático: nome do equipamento → nome do POP (ex: "Monitor Fisiológico" → `POP.EC.CAL.003_MonitorFisiologicoMultiuso.pdf`)
- Upload dos POPs para o sistema como evidência do protocolo seguido

### 4.4 Registro ANVISA

- `Item.registroAnvisa String?` — número do registro sanitário
- `Item.registroAnvisaVence DateTime?` — data de validade do registro
- Alert: equipamento sem registro ANVISA ou com registro vencido
- Link para consulta no portal ANVISA

---

## Fase 5 — Relatórios e Exportações
**Prioridade: MÉDIA | Prazo estimado: 2 semanas após Fase 4**

### 5.1 Relatório FNS — formato exigido

- Export Excel (`.xlsx`) com colunas exigidas pelo Ministério da Saúde
- Colunas: Item, Código SIAFÍSICO, Fornecedor, CNPJ, NF número, NF valor, Data NF, Status
- Filtrável por período, setor, status
- Biblioteca: `exceljs`

### 5.2 Relatório executivo PDF

- Resumo gerencial: saving total, % de entrega, fornecedores, alertas
- Cronograma previsto vs realizado
- Para apresentação à diretoria e ao FNS
- Biblioteca: `@react-pdf/renderer`

### 5.3 Dashboard de saving consolidado

- Saving por setor (qual área teve maior economia)
- Saving por fornecedor (quem dá mais desconto)
- Evolução temporal (saving acumulado por mês)
- Comparativo fornecedores: pontualidade × saving × qualidade

### 5.4 Notificações push (PWA)

- Entregas atrasadas → push notification
- Garantia vencendo em 60 dias → alerta
- Orçamento com proposta vencida → aviso
- NF sem teste há mais de 7 dias → lembrete
- Implementação via Web Push API (service worker + VAPID keys)

---

## Pontos em aberto — precisam de decisão

| # | Questão | Impacto | Decisão necessária |
|---|---|---|---|
| 1 | **Descritivo técnico (AION)**: Quem elabora? Existe template? | Alto | Definir responsável e template |
| 2 | **Setores**: Quais são os setores exatos do hospital? | Alto | Lista definitiva de setores |
| 3 | **Fases de compra**: Quais itens vão para Fase 2? | Alto | Revisão item a item |
| 4 | **Aprovação**: Quem aprova antes de contratar? Só ADMIN? | Médio | Definir fluxo de aprovação |
| 5 | **Registro ANVISA**: Será rastreado agora ou na Fase 4? | Médio | Priorização |
| 6 | **Multi-hospital**: FAEPA gerencia outros hospitais futuramente? | Alto | Definir arquitetura agora ou depois |
| 7 | **Assinatura digital**: Laudos de teste precisam de assinatura? | Médio | Definir requisito legal |
| 8 | **Domínio definitivo**: URL final do sistema para QR codes | Alto | Definir antes de imprimir etiquetas |

---

## Dívida técnica identificada

| Item | Descrição | Esforço |
|---|---|---|
| `especificacao` field | Campo tem textos curtos como "Radiodiagnóstico 630mA" — inconsistente com o novo modelo de descritivos | Baixo — migrar para `descritivoTecnico` |
| Valores hardcoded | Dashboard mostra "R$ 18,42M" e "R$ 1,28M" hardcoded — precisam vir do banco | Médio |
| `CronogramaStatic` | Cronograma do dashboard é completamente fictício (Sem 18 a Sem 25) | Médio — calcular da entrega.dataPrevisao |
| FNS scraping | 39 itens com link FNS genérico precisam ter o descritivo real extraído | Médio — script de scraping |
| `KnownIssue` | "Clique para detalhar" nos 39 itens aparece na interface como especificação | Baixo — tratar como vazio |

---

## Referências técnicas

- **Planilha original:** `Desktop/Hospital Estadual Três Colinas/20-03-26 EQUIPAMENTOS E MOBILIÁRIO HOSPITAL 3 COLINAS V2.0.xlsx`
- **POPs de calibração:** `Desktop/POPs Aion/POPs 3/*.pdf` (47 POPs disponíveis)
- **Logo AION:** `public/aion-engenharia.png`
- **Volume Railway:** `/data` (uploads, logs, PDFs)
- **Repositório:** `github.com/leandroborgeseng/gestaodeaquisicoes`
- **Deploy:** Railway — branch `main` → deploy automático
- **Banco:** PostgreSQL no Railway (DATABASE_URL)
- **FNS consulta:** `https://consultafns.saude.gov.br`
- **Download log:** `/data/download.log` (acessível via `/config` no sistema)
