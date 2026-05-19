"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Icons } from "@/components/Icons";
import { criarUsuario, criarFornecedor, criarItem, editarItem } from "@/app/actions/items";

const inputStyle: React.CSSProperties = {
  width: "100%", height: 32, padding: "0 10px", border: "1px solid var(--line)",
  borderRadius: 6, background: "var(--bg-soft)", color: "var(--fg)", fontSize: 12.5,
  outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, color: "var(--fg-dim)",
  textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>;
}

export function NovoUsuarioModal() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState("HOSPITAL");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await criarUsuario(fd);
      if ("error" in res) { setError(String(res.error ?? "")); } else { setOpen(false); setError(""); }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="btn primary sm">
          <Icons.Plus style={{ width: 12, height: 12 }} /> Novo usuário
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog" aria-describedby={undefined}>
          <div className="dialog-head">
            <Dialog.Title style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Novo usuário</Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn ghost sm" style={{ padding: "0 6px", height: 24 }}>✕</button>
            </Dialog.Close>
          </div>
          <form id="modal-form" onSubmit={handleSubmit}>
            <div className="dialog-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Nome completo *">
                  <input style={inputStyle} name="nome" required />
                </Field>
                <Field label="E-mail *">
                  <input style={inputStyle} name="email" type="email" required />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Perfil *">
                  <select
                    name="role" required
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    <option value="HOSPITAL">Hospital</option>
                    <option value="ADMIN">Administrador</option>
                    <option value="FORNECEDOR">Fornecedor</option>
                  </select>
                </Field>
                <Field label="Senha provisória *">
                  <input style={inputStyle} name="password" type="password" required minLength={6} />
                </Field>
              </div>
              {role === "FORNECEDOR" && (
                <Field label="Empresa (nome do fornecedor)">
                  <input style={inputStyle} name="fornecedorNome" placeholder="Ex: IMEX" />
                </Field>
              )}
              {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>}
            </div>
            <div className="dialog-foot">
              <Dialog.Close asChild>
                <button type="button" className="btn ghost sm">Cancelar</button>
              </Dialog.Close>
              <button type="submit" className="btn primary sm" disabled={pending}>
                {pending ? "Criando…" : "Criar usuário"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface SetorOpt { id: string; nome: string; sigla: string | null }
interface FaseOpt  { id: string; nome: string }

interface ItemFormProps {
  setores: SetorOpt[];
  fases:   FaseOpt[];
  initial?: {
    id: string; numero: string; equipamento: string; especificacao: string | null;
    qtd: number; siafisico: number | null; valorRef: number | null;
    setorId: string | null; faseId: string | null; presencaEmAta: boolean;
    categoria?: string;
  };
  defaultCategoria?: string;
  onClose: () => void;
}

function ItemForm({ setores, fases, initial, defaultCategoria, onClose }: ItemFormProps) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const editing = !!initial;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = editing
        ? await editarItem(initial!.id, fd)
        : await criarItem(fd);
      if ("error" in res) { setError(String(res.error ?? "")); }
      else { onClose(); setError(""); }
    });
  }

  const CAT_OPTS = [
    { v: "MEDICO_HOSPITALAR", l: "🏥 Equipamento Médico-Hospitalar" },
    { v: "TI",                l: "💻 Tecnologia da Informação" },
    { v: "MOBILIARIO",        l: "🪑 Mobiliário" },
  ];

  return (
    <form onSubmit={handleSubmit}>
      <div className="dialog-body">
        {/* Categoria — always first and prominent */}
        <Field label="Categoria *">
          <select
            name="categoria"
            defaultValue={initial?.categoria ?? defaultCategoria ?? "MEDICO_HOSPITALAR"}
            style={{ ...inputStyle, cursor: "pointer", fontWeight: 500 }}
          >
            {CAT_OPTS.map((o) => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12 }}>
          <Field label="Nº do item *">
            <input
              style={{ ...inputStyle, background: editing ? "var(--bg-soft)" : undefined }}
              name="numero" required defaultValue={initial?.numero ?? ""}
              readOnly={editing}
            />
          </Field>
          <Field label="Equipamento *">
            <input style={inputStyle} name="equipamento" required defaultValue={initial?.equipamento ?? ""} />
          </Field>
        </div>

        <Field label="Especificação técnica resumida">
          <textarea name="especificacao" defaultValue={initial?.especificacao ?? ""}
            style={{ ...inputStyle, height: 72, padding: "8px 10px", resize: "vertical" }} />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Quantidade">
            <input style={inputStyle} name="qtd" type="number" min={1} defaultValue={initial?.qtd ?? 1} />
          </Field>
          <Field label="SIAFÍSICO">
            <input style={inputStyle} name="siafisico" type="number" defaultValue={initial?.siafisico ?? ""} placeholder="ex: 531" />
          </Field>
          <Field label="Ref. FNS (unit, R$)">
            <input style={inputStyle} name="valorRef" defaultValue={
              initial?.valorRef != null ? String(initial.valorRef).replace(".", ",") : ""
            } placeholder="0,00" />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Setor hospitalar">
            <select name="setorId" defaultValue={initial?.setorId ?? ""} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">— Sem setor —</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>{s.sigla ? `${s.sigla} – ` : ""}{s.nome}</option>
              ))}
            </select>
          </Field>
          <Field label="Fase de compra">
            <select name="faseId" defaultValue={initial?.faseId ?? ""} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">— Sem fase —</option>
              {fases.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" name="presencaEmAta" value="true" id="ata-check"
            defaultChecked={initial?.presencaEmAta ?? false} style={{ width: 14, height: 14 }} />
          <label htmlFor="ata-check" style={{ fontSize: 12.5, color: "var(--fg-mid)", cursor: "pointer" }}>
            Presente em ATA de registro de preço
          </label>
        </div>

        {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>}
      </div>
      <div className="dialog-foot">
        <button type="button" className="btn ghost sm" onClick={onClose} disabled={pending}>Cancelar</button>
        <button type="submit" className="btn primary sm" disabled={pending}>
          {pending ? (editing ? "Salvando…" : "Criando…") : (editing ? "Salvar alterações" : "Criar item")}
        </button>
      </div>
    </form>
  );
}

export function NovoItemModal({ setores, fases, defaultCategoria }: { setores: SetorOpt[]; fases: FaseOpt[]; defaultCategoria?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="btn primary sm">
          <Icons.Plus style={{ width: 12, height: 12 }} /> Adicionar item
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog" aria-describedby={undefined} style={{ maxWidth: 600 }}>
          <div className="dialog-head">
            <Dialog.Title style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Novo item</Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn ghost sm" style={{ padding: "0 6px", height: 24 }}>✕</button>
            </Dialog.Close>
          </div>
          <ItemForm setores={setores} fases={fases} defaultCategoria={defaultCategoria} onClose={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function EditarItemModal({
  setores, fases, item,
}: {
  setores: SetorOpt[];
  fases: FaseOpt[];
  item: NonNullable<ItemFormProps["initial"]>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="btn ghost sm">
          <Icons.Settings style={{ width: 11, height: 11 }} /> Editar
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog" aria-describedby={undefined} style={{ maxWidth: 600 }}>
          <div className="dialog-head">
            <Dialog.Title style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Editar item</Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn ghost sm" style={{ padding: "0 6px", height: 24 }}>✕</button>
            </Dialog.Close>
          </div>
          <ItemForm setores={setores} fases={fases} initial={item} onClose={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CadastrarFornecedorModal() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await criarFornecedor(fd);
      if ("error" in res) { setError(String(res.error ?? "")); } else { setOpen(false); setError(""); }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="btn primary sm">
          <Icons.Plus style={{ width: 12, height: 12 }} /> Cadastrar fornecedor
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog" aria-describedby={undefined}>
          <div className="dialog-head">
            <Dialog.Title style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Cadastrar fornecedor</Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn ghost sm" style={{ padding: "0 6px", height: 24 }}>✕</button>
            </Dialog.Close>
          </div>
          <form id="modal-form" onSubmit={handleSubmit}>
            <div className="dialog-body">
              <Field label="Razão social / Nome *">
                <input style={inputStyle} name="nome" required />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="CNPJ">
                  <input style={inputStyle} name="cnpj" placeholder="00.000.000/0001-00" />
                </Field>
                <Field label="Telefone">
                  <input style={inputStyle} name="telefone" placeholder="(00) 0000-0000" />
                </Field>
              </div>
              <Field label="E-mail">
                <input style={inputStyle} name="email" type="email" />
              </Field>
              {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>}
            </div>
            <div className="dialog-foot">
              <Dialog.Close asChild>
                <button type="button" className="btn ghost sm">Cancelar</button>
              </Dialog.Close>
              <button type="submit" className="btn primary sm" disabled={pending}>
                {pending ? "Salvando…" : "Cadastrar"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
