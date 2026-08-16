"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";

export function AuditHistory({ entries }: { entries: AuditEntry[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="audit-box">
      <div className="audit-head" onClick={() => setOpen((v) => !v)}>
        <span>Historique des modifications</span>
        <span className="audit-toggle">
          {entries.length} modification{entries.length > 1 ? "s" : ""}{" "}
          {open ? "▴" : "▾"}
        </span>
      </div>
      {open &&
        (entries.length === 0 ? (
          <div className="audit-empty">Aucune modification enregistrée.</div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="audit-entry">
              <div className="audit-meta">
                <span className="audit-user">{e.username || "—"}</span>
                <span className="audit-date">{formatDate(e.created_at)}</span>
              </div>
              <ul className="audit-changes">
                {e.changes.map((c, i) => (
                  <li key={i} className={lineClass(c)}>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ))}
    </div>
  );
}

// Colore les lignes d'ajout (＋) et de suppression (－).
function lineClass(change: string): string {
  if (change.startsWith("＋")) return "audit-add";
  if (change.startsWith("－")) return "audit-del";
  return "";
}
