"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type {
  BulkResult,
  PartBulkRead,
  PartCreateInput,
  VehicleBrand,
  VehicleModel,
} from "@/lib/types";
import { ErrorBox, Modal } from "@/components/ui";

type GridRow = {
  key: number;
  reference: string;
  designation: string;
  category: string;
  brand_id: string;
  model_id: string;
};

let rowCounter = 0;
function emptyRow(): GridRow {
  return { key: ++rowCounter, reference: "", designation: "", category: "", brand_id: "", model_id: "" };
}

function blankRows(n: number): GridRow[] {
  return Array.from({ length: n }, emptyRow);
}

export function BulkPartsModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (createdCount: number) => void;
}) {
  const [rows, setRows] = useState<GridRow[]>(() => blankRows(5));
  const [error, setError] = useState<string | null>(null);
  const [askMode, setAskMode] = useState(false); // affiche le choix atomic/partiel
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResult<PartBulkRead, PartCreateInput> | null>(null);
  const [sentAtomic, setSentAtomic] = useState(true);

  const brands = useAsync(() => api.listBrands(), []);
  // Cache des modèles par marque (chargés à la demande, réutilisés entre lignes).
  const [modelsByBrand, setModelsByBrand] = useState<Record<string, VehicleModel[]>>({});

  async function ensureModels(brandId: string) {
    if (!brandId || modelsByBrand[brandId]) return;
    const models = await api.brandModels(brandId);
    setModelsByBrand((prev) => ({ ...prev, [brandId]: models }));
  }

  function update(key: number, patch: Partial<GridRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: number) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  }
  function addRows(n: number) {
    setRows((rs) => [...rs, ...blankRows(n)]);
  }

  // Coller depuis un tableur dans la 1re cellule d'une ligne :
  // remplit reference / designation / category en TSV, et déborde sur les lignes suivantes.
  function handlePaste(e: React.ClipboardEvent, startKey: number, startField: "reference" | "designation" | "category") {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return; // collage simple : comportement natif
    e.preventDefault();

    const fields: ("reference" | "designation" | "category")[] = ["reference", "designation", "category"];
    const startCol = fields.indexOf(startField);
    const lines = text.replace(/\r/g, "").split("\n").filter((l, i, arr) => l !== "" || i < arr.length - 1);

    setRows((current) => {
      const next = [...current];
      const startIdx = next.findIndex((r) => r.key === startKey);
      if (startIdx < 0) return current;

      lines.forEach((line, li) => {
        const cells = line.split("\t");
        const targetIdx = startIdx + li;
        // Étend la grille si le collage dépasse.
        while (next.length <= targetIdx) next.push(emptyRow());
        const row = { ...next[targetIdx] };
        cells.forEach((cell, ci) => {
          const col = startCol + ci;
          if (col === 0) row.reference = cell.trim();
          else if (col === 1) row.designation = cell.trim();
          else if (col === 2) row.category = cell.trim();
        });
        next[targetIdx] = row;
      });
      return next;
    });
  }

  // Lignes non vides = celles avec au moins une donnée saisie.
  const filledRows = useMemo(
    () => rows.filter((r) => r.reference.trim() || r.designation.trim() || r.model_id),
    [rows]
  );

  function validate(): PartCreateInput[] | null {
    setError(null);
    if (filledRows.length === 0) {
      setError("Ajoutez au moins une pièce.");
      return null;
    }
    const items: PartCreateInput[] = [];
    for (const r of filledRows) {
      // Le modèle est facultatif en saisie de masse : sans modèle = pièce universelle.
      if (!r.reference.trim() || !r.designation.trim()) {
        setError(
          `Ligne « ${r.reference || r.designation || "?"} » : référence et désignation sont obligatoires.`
        );
        return null;
      }
      items.push({
        reference: r.reference.trim(),
        designation: r.designation.trim(),
        vehicle_model_ids: r.model_id ? [r.model_id] : [],
        category: r.category.trim() || null,
      });
    }
    // Doublons de référence intra-grille (le backend rejette, autant prévenir tôt).
    const refs = items.map((i) => i.reference.toLowerCase());
    const dup = refs.find((r, i) => refs.indexOf(r) !== i);
    if (dup) {
      setError(`Référence en double dans la grille : « ${dup} ».`);
      return null;
    }
    return items;
  }

  function openModeChoice() {
    if (validate()) setAskMode(true);
  }

  async function send(atomic: boolean) {
    const items = validate();
    if (!items) {
      setAskMode(false);
      return;
    }
    setBusy(true);
    setSentAtomic(atomic);
    try {
      const res = await api.bulkCreateParts(atomic, items);
      setResult(res);
      setAskMode(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Envoi impossible.");
      setAskMode(false);
    } finally {
      setBusy(false);
    }
  }

  // Après un envoi partiel réussi partiellement, on peut retirer les lignes OK
  // et ne garder que les lignes en échec pour correction.
  function keepOnlyFailed() {
    if (!result) return;
    const failedIndexes = new Set(result.failed.map((f) => f.index));
    // Reconstruit la grille depuis les items envoyés (filledRows au moment de l'envoi).
    setRows((current) => {
      const filled = current.filter((r) => r.reference.trim() || r.designation.trim() || r.model_id);
      const kept = filled.filter((_, i) => failedIndexes.has(i));
      return kept.length ? kept : blankRows(3);
    });
    setResult(null);
  }

  // --- Rapport de résultat ---
  if (result) {
    const s = result.summary;
    const allOk = s.failed === 0;
    return (
      <Modal
        title="Résultat de l'import"
        onClose={() => {
          onDone(s.succeeded);
        }}
        wide
        footer={
          <>
            {!allOk && s.committed && (
              <button className="btn" onClick={keepOnlyFailed}>
                Corriger les lignes en échec
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => onDone(s.succeeded)}
            >
              Terminer
            </button>
          </>
        }
      >
        <div className="kpi-grid" style={{ marginBottom: 14 }}>
          <div className="kpi">
            <div className="label">Total envoyé</div>
            <div className="value">{s.total}</div>
          </div>
          <div className="kpi">
            <div className="label">Créées</div>
            <div className="value" style={{ color: "var(--success)" }}>{s.succeeded}</div>
          </div>
          <div className="kpi">
            <div className="label">En échec</div>
            <div className="value" style={{ color: s.failed ? "var(--danger)" : undefined }}>
              {s.failed}
            </div>
          </div>
        </div>

        <div className="mode-recap">
          Mode : <span className="badge accent">{s.atomic ? "Atomique" : "Partiel"}</span>{" "}
          {s.atomic && !s.committed && (
            <span className="badge" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
              Rien enregistré (annulé)
            </span>
          )}
          {s.committed && s.succeeded > 0 && (
            <span className="muted"> — {s.succeeded} pièce(s) enregistrée(s).</span>
          )}
        </div>

        {s.failed > 0 && (
          <div className="table-wrap mt-16">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 50 }} className="num">Ligne</th>
                  <th>Référence</th>
                  <th>Désignation</th>
                  <th>Erreur</th>
                </tr>
              </thead>
              <tbody>
                {result.failed.map((f) => (
                  <tr key={f.index}>
                    <td className="num muted">{f.index + 1}</td>
                    <td className="mono">{f.input.reference}</td>
                    <td>{f.input.designation}</td>
                    <td>
                      <span className="badge" style={{ marginRight: 6 }}>{errorLabel(f.error.type)}</span>
                      {f.error.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    );
  }

  // --- Choix du mode ---
  if (askMode) {
    return (
      <Modal
        title="Comment enregistrer ce lot ?"
        onClose={() => setAskMode(false)}
        footer={
          <button className="btn" onClick={() => setAskMode(false)} disabled={busy}>
            Retour
          </button>
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>
          {filledRows.length} pièce(s) à créer. Choisissez le comportement en cas d'erreur sur
          une ligne.
        </p>
        <div className="mode-cards">
          <button className="mode-card" onClick={() => send(true)} disabled={busy}>
            <div className="mode-card-title">Tout ou rien</div>
            <div className="mode-card-desc">
              Si une seule ligne échoue, aucune pièce n'est créée. Idéal pour un import
              « propre ou rien ».
            </div>
          </button>
          <button className="mode-card" onClick={() => send(false)} disabled={busy}>
            <div className="mode-card-title">Succès partiel</div>
            <div className="mode-card-desc">
              Les lignes valides sont créées, les autres sont listées avec leur erreur pour
              correction.
            </div>
          </button>
        </div>
        {busy && <p className="muted">Envoi en cours…</p>}
      </Modal>
    );
  }

  // --- Grille de saisie ---
  return (
    <Modal
      title="Import de pièces en lot"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={openModeChoice}>
            Enregistrer {filledRows.length > 0 ? `(${filledRows.length})` : ""}
          </button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}
      <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
        Saisissez une pièce par ligne. Vous pouvez coller depuis Excel dans la colonne Référence
        (colonnes attendues : Référence, Désignation, Catégorie). Laissez Marque/Modèle
        vides pour une pièce universelle.
      </p>

      <div className="table-wrap">
        <table className="lines-table">
          <thead>
            <tr>
              <th style={{ width: 30 }} className="num">#</th>
              <th style={{ width: 150 }}>Référence *</th>
              <th>Désignation *</th>
              <th style={{ width: 130 }}>Marque</th>
              <th style={{ width: 130 }}>Modèle</th>
              <th style={{ width: 120 }}>Catégorie</th>
              <th style={{ width: 34 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td className="num muted">{i + 1}</td>
                <td>
                  <input
                    className="input mono"
                    value={r.reference}
                    onChange={(e) => update(r.key, { reference: e.target.value })}
                    onPaste={(e) => handlePaste(e, r.key, "reference")}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    value={r.designation}
                    onChange={(e) => update(r.key, { designation: e.target.value })}
                    onPaste={(e) => handlePaste(e, r.key, "designation")}
                  />
                </td>
                <td>
                  <select
                    className="select"
                    value={r.brand_id}
                    onChange={(e) => {
                      update(r.key, { brand_id: e.target.value, model_id: "" });
                      ensureModels(e.target.value);
                    }}
                  >
                    <option value="">—</option>
                    {brands.data?.items.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="select"
                    value={r.model_id}
                    onChange={(e) => update(r.key, { model_id: e.target.value })}
                    disabled={!r.brand_id}
                  >
                    <option value="">—</option>
                    {(modelsByBrand[r.brand_id] ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="input"
                    value={r.category}
                    onChange={(e) => update(r.key, { category: e.target.value })}
                    onPaste={(e) => handlePaste(e, r.key, "category")}
                  />
                </td>
                <td className="num">
                  <button
                    className="btn-link danger"
                    onClick={() => removeRow(r.key)}
                    disabled={rows.length <= 1}
                    title="Retirer la ligne"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row-flex mt-8" style={{ gap: 8 }}>
        <button className="btn btn-sm" onClick={() => addRows(1)}>
          + 1 ligne
        </button>
        <button className="btn btn-sm" onClick={() => addRows(5)}>
          + 5 lignes
        </button>
        <div className="toolbar-spacer" />
        <span className="muted" style={{ fontSize: 12 }}>
          {filledRows.length} ligne(s) remplie(s)
        </span>
      </div>
    </Modal>
  );
}

function errorLabel(type: string): string {
  switch (type) {
    case "not_found":
      return "Introuvable";
    case "conflict":
      return "Doublon";
    case "business_rule":
      return "Règle";
    default:
      return "Erreur";
  }
}

// Petit hook utilitaire pour précharger les modèles si besoin depuis l'extérieur.
export function usePreloadBrands(): VehicleBrand[] {
  const brands = useAsync(() => api.listBrands(), []);
  const [list, setList] = useState<VehicleBrand[]>([]);
  useEffect(() => {
    if (brands.data) setList(brands.data.items);
  }, [brands.data]);
  return list;
}
