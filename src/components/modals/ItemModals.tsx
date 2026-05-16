"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Icons } from "@/components/Icons";
import {
  registrarCotacao,
  registrarContrato,
  registrarEntrega,
  registrarNF,
  registrarTeste,
} from "@/app/actions/items";

const inputStyle: React.CSSProperties = {
  width: "100%", height: 32, padding: "0 10px", border: "1px solid var(--line)",
  borderRadius: 6, background: "var(--bg-soft)", color: "var(--fg)", fontSize: 12.5,
  outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, color: "var(--fg-dim)",
  textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4,
};
const gridTwo: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function ModalShell({
  open, onOpenChange, title, children, pending, triggerLabel, triggerIcon,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  title: string; children: React.ReactNode;
  pending: boolean; triggerLabel: string; triggerIcon?: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button className="btn primary sm">
          {triggerIcon}
          {triggerLabel}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog" aria-describedby={undefined}>
          <div className="dialog-head">
            <Dialog.Title style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn ghost sm" style={{ padding: "0 6px", height: 24 }}>✕</button>
            </Dialog.Close>
          </div>
          {children}
          <div className="dialog-foot">
            <Dialog.Close asChild>
              <button type="button" className="btn ghost sm">Cancelar</button>
            </Dialog.Close>
            <button type="submit" form="modal-form" className="btn primary sm" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function RegistrarCotacaoModal({
  itemId, existing,
}: { itemId: string; existing: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await registrarCotacao(itemId, fd);
      if ("error" in res) { setError(String(res.error ?? "")); } else { setOpen(false); setError(""); }
    });
  }

  return (
    <ModalShell
      open={open} onOpenChange={setOpen}
      title={existing ? "Atualizar cotação" : "Iniciar cotação"}
      triggerLabel={existing ? "Atualizar cotação" : "Iniciar cotação"}
      triggerIcon={<Icons.Spark style={{ width: 11, height: 11 }} />}
      pending={pending}
    >
      <form id="modal-form" onSubmit={handleSubmit}>
        <div className="dialog-body">
          <div style={gridTwo}>
            <Field label="Data de início">
              <input style={inputStyle} type="date" name="dataInicio" />
            </Field>
            <Field label="Data de conclusão">
              <input style={inputStyle} type="date" name="dataConclusao" />
            </Field>
          </div>
          <Field label="Observação">
            <textarea name="observacao" style={{ ...inputStyle, height: 72, padding: "8px 10px", resize: "vertical" }} />
          </Field>
          {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>}
        </div>
      </form>
    </ModalShell>
  );
}

export function RegistrarContratoModal({
  itemId, existing, fornecedores,
}: { itemId: string; existing: boolean; fornecedores: string[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await registrarContrato(itemId, fd);
      if ("error" in res) { setError(String(res.error ?? "")); } else { setOpen(false); setError(""); }
    });
  }

  return (
    <ModalShell
      open={open} onOpenChange={setOpen}
      title={existing ? "Atualizar contrato" : "Registrar contrato"}
      triggerLabel={existing ? "Atualizar contrato" : "Registrar contrato"}
      triggerIcon={<Icons.Pin style={{ width: 11, height: 11 }} />}
      pending={pending}
    >
      <form id="modal-form" onSubmit={handleSubmit}>
        <div className="dialog-body">
          <Field label="Fornecedor *">
            <input
              style={inputStyle} name="fornecedor" required
              list="forn-list" placeholder="Digite ou selecione…"
              defaultValue={fornecedores[0] ?? ""}
            />
            <datalist id="forn-list">
              {fornecedores.map((f) => <option key={f} value={f} />)}
            </datalist>
          </Field>
          <div style={gridTwo}>
            <Field label="Número do contrato">
              <input style={inputStyle} name="numeroContrato" placeholder="Nº 001/2026" />
            </Field>
            <Field label="Valor contratado (R$)">
              <input style={inputStyle} name="valor" placeholder="0,00" inputMode="decimal" />
            </Field>
          </div>
          <div style={gridTwo}>
            <Field label="Data de assinatura">
              <input style={inputStyle} type="date" name="dataAssinatura" />
            </Field>
            <Field label="Vigência">
              <input style={inputStyle} type="date" name="dataVigencia" />
            </Field>
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>}
        </div>
      </form>
    </ModalShell>
  );
}

export function RegistrarEntregaModal({
  itemId, qtdTotal,
}: { itemId: string; qtdTotal: number }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await registrarEntrega(itemId, fd);
      if ("error" in res) { setError(String(res.error ?? "")); } else { setOpen(false); setError(""); }
    });
  }

  return (
    <ModalShell
      open={open} onOpenChange={setOpen}
      title="Registrar entrega"
      triggerLabel="Registrar entrega"
      triggerIcon={<Icons.Plus style={{ width: 11, height: 11 }} />}
      pending={pending}
    >
      <form id="modal-form" onSubmit={handleSubmit}>
        <div className="dialog-body">
          <div style={gridTwo}>
            <Field label={`Qtd entregue (total: ${qtdTotal})`}>
              <input style={inputStyle} type="number" name="qtd" min={1} max={qtdTotal} required />
            </Field>
            <Field label="Data de entrega">
              <input style={inputStyle} type="date" name="dataEntrega" />
            </Field>
          </div>
          <div style={gridTwo}>
            <Field label="Previsão">
              <input style={inputStyle} type="date" name="dataPrevisao" />
            </Field>
            <Field label="Local de entrega">
              <input style={inputStyle} name="local" placeholder="Ex: Almoxarifado" />
            </Field>
          </div>
          <Field label="Responsável pelo recebimento">
            <input style={inputStyle} name="responsavel" />
          </Field>
          <Field label="Observação">
            <textarea name="observacao" style={{ ...inputStyle, height: 60, padding: "8px 10px", resize: "vertical" }} />
          </Field>
          {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>}
        </div>
      </form>
    </ModalShell>
  );
}

export function RegistrarNFModal({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await registrarNF(itemId, fd);
      if ("error" in res) { setError(String(res.error ?? "")); } else { setOpen(false); setError(""); }
    });
  }

  return (
    <ModalShell
      open={open} onOpenChange={setOpen}
      title="Registrar nota fiscal"
      triggerLabel="Registrar NF"
      triggerIcon={<Icons.Plus style={{ width: 11, height: 11 }} />}
      pending={pending}
    >
      <form id="modal-form" onSubmit={handleSubmit}>
        <div className="dialog-body">
          <div style={gridTwo}>
            <Field label="Número da NF *">
              <input style={inputStyle} name="numero" required />
            </Field>
            <Field label="Série">
              <input style={inputStyle} name="serie" />
            </Field>
          </div>
          <div style={gridTwo}>
            <Field label="Emitente">
              <input style={inputStyle} name="emissora" />
            </Field>
            <Field label="Valor (R$)">
              <input style={inputStyle} name="valor" placeholder="0,00" inputMode="decimal" />
            </Field>
          </div>
          <div style={gridTwo}>
            <Field label="Data de emissão">
              <input style={inputStyle} type="date" name="dataEmissao" />
            </Field>
            <Field label="Data de entrada">
              <input style={inputStyle} type="date" name="dataEntrada" />
            </Field>
          </div>
          <Field label="Chave NFe (44 dígitos)">
            <input style={inputStyle} name="chaveNfe" maxLength={44} placeholder="00000000…" className="mono" />
          </Field>
          {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>}
        </div>
      </form>
    </ModalShell>
  );
}

export function RegistrarTesteModal({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await registrarTeste(itemId, fd);
      if ("error" in res) { setError(String(res.error ?? "")); } else { setOpen(false); setError(""); }
    });
  }

  return (
    <ModalShell
      open={open} onOpenChange={setOpen}
      title="Registrar teste inicial"
      triggerLabel="Registrar teste"
      triggerIcon={<Icons.Plus style={{ width: 11, height: 11 }} />}
      pending={pending}
    >
      <form id="modal-form" onSubmit={handleSubmit}>
        <div className="dialog-body">
          <div style={gridTwo}>
            <Field label="Data de realização">
              <input style={inputStyle} type="date" name="dataRealizado" />
            </Field>
            <Field label="Resultado *">
              <select name="resultado" required style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">Selecione…</option>
                <option value="APROVADO">Aprovado</option>
                <option value="REPROVADO">Reprovado</option>
                <option value="PARCIAL">Aprovado parcialmente</option>
              </select>
            </Field>
          </div>
          <Field label="Responsável técnico">
            <input style={inputStyle} name="responsavel" />
          </Field>
          <Field label="Observações / laudo resumido">
            <textarea name="observacao" style={{ ...inputStyle, height: 80, padding: "8px 10px", resize: "vertical" }} />
          </Field>
          {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{error}</p>}
        </div>
      </form>
    </ModalShell>
  );
}
