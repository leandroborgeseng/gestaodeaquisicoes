# Sistema de Gestão de Aquisições — Hospital Três Colinas

Sistema web para gestão do ciclo completo de aquisição de equipamentos e mobiliário hospitalar.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **PostgreSQL** + **Prisma ORM**
- **NextAuth.js v5** (credentials)
- **shadcn-inspired UI** com design system próprio (CSS custom properties, Geist font)

## Perfis de acesso

| Role | Credenciais de teste |
|------|---------------------|
| ADMIN | admin@hospital3colinas.com.br / changeme123 |
| HOSPITAL | julia.tavares@3colinas.sp.gov.br / hospital123 |
| FORNECEDOR | carlos@medtechbr.com / fornecedor123 |

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com sua DATABASE_URL e NEXTAUTH_SECRET

# 3. Criar banco e rodar migrations
npx prisma migrate dev --name init

# 4. Popular com dados de exemplo (20 itens, 6 fornecedores, 3 usuários)
npx prisma db seed

# 5. Iniciar servidor de desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

## Estrutura do projeto

```
src/
├── app/
│   ├── (auth)/login/          # Página de login
│   ├── (dashboard)/           # Layout com sidebar
│   │   ├── dashboard/         # Visão geral, KPIs, alertas
│   │   ├── itens/             # Lista + detalhe com tabs
│   │   ├── relatorios/        # Financeiro, cronograma, fornecedores
│   │   ├── fornecedores/      # Grid de fornecedores
│   │   └── usuarios/          # Tabela de usuários
│   └── api/                   # API routes (REST)
├── components/                # Sidebar, Topbar, StatusPill, Icons
└── lib/                       # Prisma, Auth, Utils
```

## Deploy no Railway

1. Criar projeto no Railway com serviços: Next.js + PostgreSQL plugin
2. Adicionar variáveis de ambiente (ver `.env.example`)
3. Deploy automático via GitHub

## Modelo de dados

Entidades principais: `Item`, `Fornecedor`, `Orcamento`, `Cotacao`, `Contratacao`, `Entrega`, `NotaFiscal`, `TesteInicial`, `Observacao`, `Anexo`, `Log`, `User`

Fluxo de status: `PENDENTE → COTACAO_EM_ANDAMENTO → COTACAO_CONCLUIDA → CONTRATADO → ENTREGA_PARCIAL → ENTREGUE → NF_RECEBIDA → EM_TESTE → CONCLUIDO`
