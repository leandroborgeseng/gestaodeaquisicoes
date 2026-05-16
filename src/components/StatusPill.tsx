import { STATUS_LABELS, STATUS_PILL_CLASS } from "@/lib/utils";

interface StatusPillProps {
  status: string;
  mini?: boolean;
}

export function StatusPill({ status, mini = false }: StatusPillProps) {
  const cls = STATUS_PILL_CLASS[status] ?? "pill-pendente";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`pill ${cls}`}>
      <span className="dot" />
      {!mini && label}
    </span>
  );
}
