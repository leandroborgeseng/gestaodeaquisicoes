"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Icons } from "@/components/Icons";
import { criarUsuario, criarFornecedor } from "@/app/actions/items";

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
