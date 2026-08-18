"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type { PrepItem } from "@/lib/types";
import { ErrorBox, Loading, EmptyState } from "@/components/ui";

export default function PreparationPage() {
  const prep = useAsync(() => api.centerPreparationList(), []);
  const data = prep.data;

  return (
    <>
      <div className="page-head">
        <div>
          <div style={{ marginBottom: 4 }}>
            <Link href="/centres" className="btn-link">
              ← Retour aux demandes
            </Link>
          </div>
          <h1>Liste de préparation</h1>
          <div className="sub">
            Toutes les pièces à rassembler (demandes nouvelles et préparées)
          </div>
        </div>
        <button className="btn" onClick={() => window.print()}>
          Imprimer
        </button>
      </div>

      {prep.loading && <Loading />}
      {prep.error && <ErrorBox message={prep.error} />}

      {data && (
        <>
          <div className="prep-meta">
            {data.distinct_parts} pièce(s) distincte(s) · {data.request_count}{" "}
            demande(s)
          </div>

          {data.items.length === 0 ? (
            <EmptyState
              message="Rien à préparer"
              hint="Aucune demande en attente."
            />
          ) : (
            <div className="prep-list">
              {data.items.map((item, i) => (
                <PrepRow key={i} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function PrepRow({ item }: { item: PrepItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="prep-item">
      <button className="prep-head" onClick={() => setOpen((v) => !v)}>
        <span className="prep-caret">{open ? "▾" : "▸"}</span>
        <span className="prep-name">
          {item.designation}
          {!item.from_catalog && (
            <span className="prep-free">(hors catalogue)</span>
          )}
          <span className="prep-count-src">
            · {item.sources.length} véhicule(s)
          </span>
        </span>
        <span className="prep-qty">{item.total_quantity}</span>
      </button>
      {open && (
        <div className="prep-detail">
          {item.sources.map((s, i) => (
            <div key={i} className="prep-src">
              <span>
                <span className="mono">{s.request_number}</span> · {s.vehicle}
                {s.plate_number && (
                  <span className="mono"> ({s.plate_number})</span>
                )}
                {s.note && <span className="prep-note"> — {s.note}</span>}
              </span>
              <span className="prep-src-qty">{s.quantity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
