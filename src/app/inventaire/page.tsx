"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, downloadWithAuth } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AuditHistory } from "@/components/AuditHistory";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatNumber } from "@/lib/format";
import type {
  InventoryCount,
  InventoryCountItemInput,
  PartDetail,
  InventoryEditImpact,
} from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Loading,
  Modal,
  Pagination,
  useToast,
} from "@/components/ui";
import { PartSelect } from "../../components/PartSelect";
import { PartCombobox } from "../../components/PartCombobox";

const LIMIT = 20;

// Compte les anomalies d'un comptage (sorties négatives).
function anomalyCount(c: InventoryCount): number {
  return c.items.filter((i) => i.anomaly).length;
}

export default function InventoryPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<InventoryCount | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const counts = useAsync(
    () =>
      api.listInventoryCounts({
        search: debounced || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        limit: LIMIT,
      }),
    [debounced, startDate, endDate, page],
  );

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteInventoryCount(deleting.id);
      toast.push(`Comptage ${deleting.count_number} supprimé.`, "success");
      setDeleting(null);
      counts.reload();
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Suppression impossible.",
        "error",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inventaire</h1>
          <div className="sub">
            Comptage tournant — sorties calculées automatiquement entre deux
            comptages
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouveau comptage
        </button>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Recherche</label>
          <input
            className="input"
            placeholder="N° de comptage…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Du</label>
          <input
            className="input"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label>Au</label>
          <input
            className="input"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {counts.error && <ErrorBox message={counts.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N° comptage</th>
              <th>Date</th>
              <th className="num">Pièces comptées</th>
              <th>Anomalies</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {counts.loading && !counts.data ? (
              <tr>
                <td colSpan={5}>
                  <Loading />
                </td>
              </tr>
            ) : counts.data && counts.data.items.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    message="Aucun comptage"
                    hint="Créez votre premier comptage d'inventaire."
                  />
                </td>
              </tr>
            ) : (
              counts.data?.items.map((c) => {
                const anomalies = anomalyCount(c);
                return (
                  <tr
                    key={c.id}
                    className="clickable"
                    onClick={() => setViewing(c.id)}
                  >
                    <td className="mono">{c.count_number}</td>
                    <td>{formatDate(c.count_date)}</td>
                    <td className="num">{c.items.length}</td>
                    <td>
                      {anomalies > 0 ? (
                        <span
                          className="status-badge"
                          style={{
                            background: "var(--danger-soft)",
                            color: "var(--danger)",
                          }}
                        >
                          ⚠ {anomalies}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td
                      className="actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="btn-link"
                        onClick={() => setViewing(c.id)}
                      >
                        Détails
                      </button>
                      <button
                        className="btn-link"
                        onClick={() =>
                          downloadWithAuth(
                            api.inventoryExportUrl(c.id),
                            `inventaire_${c.count_number}.xlsx`,
                          ).catch(() =>
                            toast.push("Export impossible.", "error"),
                          )
                        }
                      >
                        Excel
                      </button>
                      <button
                        className="btn-link danger"
                        onClick={() => setDeleting(c)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {counts.data && counts.data.total > 0 && (
        <Pagination
          page={counts.data.page}
          pages={counts.data.pages}
          total={counts.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {creating && (
        <CountForm
          onClose={() => setCreating(false)}
          onSaved={(num) => {
            setCreating(false);
            counts.reload();
            toast.push(`Comptage ${num} créé.`, "success");
          }}
        />
      )}

      {viewing && (
        <CountDetail
          id={viewing}
          onClose={() => setViewing(null)}
          onChanged={() => counts.reload()}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer le comptage"
          message={`Supprimer le comptage ${deleting.count_number} ? Cette action est définitive.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

// ---------- Détail : comparaison + édition + audit ----------
function CountDetail({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const count = useAsync(() => api.getInventoryCount(id), [id]);
  const impact = useAsync(() => api.inventoryEditImpact(id), [id]);
  const audit = useAsync(
    () => (isAdmin ? api.inventoryCountAudit(id) : Promise.resolve([])),
    [id, isAdmin],
  );
  const [editing, setEditing] = useState(false);

  const isLeaf = impact.data?.is_leaf ?? true;
  // Magazinier : seulement si feuille. Admin : toujours.
  const canEdit = isAdmin || isLeaf;

  function reloadAll() {
    count.reload();
    impact.reload();
    audit.reload();
    onChanged();
  }

  return (
    <>
      <Modal
        title={count.data ? `Comptage ${count.data.count_number}` : "Comptage"}
        onClose={onClose}
        wide
        footer={
          <>
            {count.data && canEdit && (
              <button className="btn" onClick={() => setEditing(true)}>
                Modifier
              </button>
            )}
            {count.data && (
              <button
                className="btn"
                onClick={() =>
                  downloadWithAuth(
                    api.inventoryExportUrl(count.data!.id),
                    `inventaire_${count.data!.count_number}.xlsx`,
                  ).catch(() => toast.push("Export impossible.", "error"))
                }
              >
                Exporter en Excel
              </button>
            )}
            <button className="btn btn-primary" onClick={onClose}>
              Fermer
            </button>
          </>
        }
      >
        {count.loading && <Loading />}
        {count.error && <ErrorBox message={count.error} />}
        {count.data && (
          <>
            <div
              style={{
                display: "flex",
                gap: 24,
                marginBottom: 14,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  className="muted"
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  Date du comptage
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {formatDate(count.data.count_date)}
                </div>
              </div>
              {count.data.notes && (
                <div>
                  <div
                    className="muted"
                    style={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      fontWeight: 600,
                    }}
                  >
                    Notes
                  </div>
                  <div style={{ fontSize: 14 }}>{count.data.notes}</div>
                </div>
              )}
            </div>

            {/* Info : ce comptage a des comptages postérieurs (non modifiable par magazinier) */}
            {!isLeaf && (
              <div className="warn-banner">
                ⚠ Ce comptage a {impact.data?.posterior.length} comptage(s)
                postérieur(s) qui dépendent de lui
                {impact.data && impact.data.posterior.length > 0 && (
                  <>
                    {" "}
                    (
                    {impact.data.posterior
                      .map((p) => p.count_number)
                      .join(", ")}
                    )
                  </>
                )}
                .{" "}
                {isAdmin
                  ? "Le modifier recalculera aussi ces comptages."
                  : "Seul un administrateur peut le corriger."}
              </div>
            )}

            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
              Sorties = stock précédent + entrées (commandes) − stock compté.
              Une valeur négative (en rouge) signale une incohérence à vérifier.
            </p>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Désignation</th>
                    <th className="num">Stock préc.</th>
                    <th className="num">Entrées</th>
                    <th className="num">Compté</th>
                    <th className="num">Sorties</th>
                  </tr>
                </thead>
                <tbody>
                  {count.data.items.map((it) => {
                    const first = it.previous_quantity === null;
                    return (
                      <tr
                        key={it.id}
                        style={
                          it.anomaly
                            ? { background: "var(--danger-soft)" }
                            : undefined
                        }
                      >
                        <td className="mono">{it.reference}</td>
                        <td>{it.designation}</td>
                        <td className="num">
                          {first ? (
                            <span className="muted">—</span>
                          ) : (
                            formatNumber(it.previous_quantity)
                          )}
                        </td>
                        <td className="num">
                          {first ? (
                            <span className="muted">—</span>
                          ) : (
                            formatNumber(it.entries_between)
                          )}
                        </td>
                        <td className="num" style={{ fontWeight: 600 }}>
                          {formatNumber(it.counted_quantity)}
                        </td>
                        <td className="num">
                          {it.outflow === null ? (
                            <span className="badge">Base</span>
                          ) : (
                            <span
                              style={{
                                fontWeight: 700,
                                color: it.anomaly
                                  ? "var(--danger)"
                                  : "var(--text)",
                              }}
                            >
                              {formatNumber(it.outflow)}
                              {it.anomaly && " ⚠"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Historique des modifications : admin uniquement */}
            {isAdmin && audit.data && <AuditHistory entries={audit.data} />}
          </>
        )}
      </Modal>

      {editing && count.data && (
        <CountEditForm
          count={count.data}
          impact={impact.data ?? null}
          isAdmin={isAdmin}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reloadAll();
            toast.push("Comptage mis à jour.", "success");
          }}
        />
      )}
    </>
  );
}

// ---------- Formulaire d'édition d'un comptage ----------
type EditLine = {
  key: number;
  part_id: string;
  reference: string;
  designation: string;
  quantity: string;
  isNew: boolean;
};
let editLineCounter = 0;

function CountEditForm({
  count,
  impact,
  isAdmin,
  onClose,
  onSaved,
}: {
  count: InventoryCount;
  impact: InventoryEditImpact | null;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const parts = useAsync(() => api.listParts({ limit: 500 }), []);
  const [notes, setNotes] = useState(count.notes ?? "");
  const [lines, setLines] = useState<EditLine[]>(() =>
    count.items.map((it) => ({
      key: ++editLineCounter,
      part_id: it.part_id,
      reference: it.reference,
      designation: it.designation,
      quantity: String(it.counted_quantity),
      isNew: false,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: number, patch: Partial<EditLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    const kept = lines.filter((l) => l.part_id);
    if (kept.length === 0) {
      setError("Un comptage doit contenir au moins une pièce.");
      return;
    }
    const ids = kept.map((l) => l.part_id);
    if (new Set(ids).size !== ids.length) {
      setError("Une même pièce ne peut apparaître qu'une seule fois.");
      return;
    }
    for (const l of kept) {
      const q = Number(l.quantity);
      if (l.quantity === "" || !Number.isInteger(q) || q < 0) {
        setError("Chaque quantité comptée doit être un entier positif ou nul.");
        return;
      }
    }
    const items: InventoryCountItemInput[] = kept.map((l) => ({
      part_id: l.part_id,
      counted_quantity: Number(l.quantity),
    }));

    setBusy(true);
    try {
      await api.updateInventoryCount(count.id, {
        notes: notes.trim() || null,
        items,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  const posterior = impact?.posterior ?? [];

  return (
    <Modal
      title={`Modifier ${count.count_number}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      {/* Avertissement de propagation */}
      {posterior.length > 0 && (
        <div className="warn-banner">
          ⚠ Cette correction recalculera aussi {posterior.length} comptage(s)
          postérieur(s) : {posterior.map((p) => p.count_number).join(", ")}.
          Vérifiez ces comptages après enregistrement.
        </div>
      )}

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Notes</label>
        <input
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="lines-table">
          <thead>
            <tr>
              <th>Pièce</th>
              <th style={{ width: 140 }} className="num">
                Quantité comptée
              </th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key}>
                <td>
                  {/* pour les lignes isNew, on utilise le sélecteur avec recherche */}
                  {l.isNew ? (
                    <PartCombobox
                      parts={parts.data?.items ?? []}
                      value={l.part_id}
                      onChange={(partId) => {
                        const pt = parts.data?.items.find(
                          (p) => p.id === partId,
                        );
                        update(l.key, {
                          part_id: partId,
                          reference: pt?.reference ?? "",
                          designation: pt?.designation ?? "",
                        });
                      }}
                      // loading={parts.loading}
                      placeholder="Rechercher une pièce…"
                    />
                  ) : (
                    /* pour les lignes existantes, on garde l'affichage en texte */
                    <span>
                      <span className="mono">{l.reference}</span> —{" "}
                      {l.designation}
                    </span>
                  )}
                </td>
                <td>
                  <input
                    className="input num"
                    type="number"
                    min={0}
                    step={1}
                    value={l.quantity}
                    onChange={(e) =>
                      update(l.key, { quantity: e.target.value })
                    }
                  />
                </td>
                <td className="num">
                  <button
                    className="btn-link danger"
                    onClick={() =>
                      setLines((ls) =>
                        ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls,
                      )
                    }
                    disabled={lines.length <= 1}
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

      <button
        className="btn btn-sm"
        onClick={() =>
          setLines((ls) => [
            ...ls,
            {
              key: ++editLineCounter,
              part_id: "",
              reference: "",
              designation: "",
              quantity: "0",
              isNew: true,
            },
          ])
        }
      >
        + Ajouter une pièce
      </button>

      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Les sorties seront recalculées automatiquement après enregistrement.
      </p>
    </Modal>
  );
}

// ---------- Formulaire de saisie multi-pièces ----------
type CountLine = {
  key: number;
  part_id: string;
  quantity: string;
};

let lineCounter = 0;
function newLine(): CountLine {
  return { key: ++lineCounter, part_id: "", quantity: "" };
}

function CountForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (countNumber: string) => void;
}) {
  const [countDate, setCountDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<CountLine[]>([newLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Catalogue de pièces pour le sélecteur.
  const parts = useAsync(() => api.listParts({ limit: 2000 }), []);

  function updateLine(key: number, patch: Partial<CountLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLine(key: number) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  const filledCount = useMemo(
    () => lines.filter((l) => l.part_id).length,
    [lines],
  );

  async function submit() {
    setError(null);
    const filled = lines.filter((l) => l.part_id);
    if (filled.length === 0) {
      setError("Ajoutez au moins une pièce à compter.");
      return;
    }
    // Doublons
    const ids = filled.map((l) => l.part_id);
    if (new Set(ids).size !== ids.length) {
      setError("Une même pièce ne peut apparaître qu'une seule fois.");
      return;
    }
    // Quantités : >= 0 et entiers
    for (const l of filled) {
      const q = Number(l.quantity);
      if (
        l.quantity === "" ||
        Number.isNaN(q) ||
        q < 0 ||
        !Number.isInteger(q)
      ) {
        setError("Chaque quantité comptée doit être un entier positif ou nul.");
        return;
      }
    }

    const items: InventoryCountItemInput[] = filled.map((l) => ({
      part_id: l.part_id,
      counted_quantity: Number(l.quantity),
    }));

    setBusy(true);
    try {
      const created = await api.createInventoryCount({
        count_date: countDate,
        notes: notes.trim() || null,
        items,
      });
      onSaved(created.count_number);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nouveau comptage d'inventaire"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Création…" : "Créer le comptage"}
          </button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      <div
        className="form-grid"
        style={{ gridTemplateColumns: "1fr 2fr", marginBottom: 16 }}
      >
        <div className="field">
          <label>
            Date du comptage <span className="required">*</span>
          </label>
          <input
            className="input"
            type="date"
            value={countDate}
            onChange={(e) => setCountDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Notes</label>
          <input
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex : comptage hebdomadaire semaine 3 (facultatif)"
          />
        </div>
      </div>

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="lines-table">
          <thead>
            <tr>
              <th>Pièce</th>
              <th style={{ width: 140 }} className="num">
                Quantité comptée
              </th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key}>
                <td>
                  <PartCombobox
                    parts={parts.data?.items ?? []}
                    value={l.part_id}
                    onChange={(partId) =>
                      updateLine(l.key, { part_id: partId })
                    }
                    // loading={parts.loading}
                    placeholder="Choisir une pièce…"
                  />
                </td>

                <td>
                  <input
                    className="input num"
                    type="number"
                    min={0}
                    step={1}
                    value={l.quantity}
                    onChange={(e) =>
                      updateLine(l.key, { quantity: e.target.value })
                    }
                    placeholder="0"
                  />
                </td>
                <td className="num">
                  <button
                    className="btn-link danger"
                    onClick={() => removeLine(l.key)}
                    disabled={lines.length <= 1}
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

      <div className="row-flex" style={{ justifyContent: "space-between" }}>
        <button
          className="btn btn-sm"
          onClick={() => setLines((ls) => [...ls, newLine()])}
        >
          + Ajouter une pièce
        </button>
        <span className="muted" style={{ fontSize: 12 }}>
          {filledCount} pièce(s) à compter
        </span>
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Les sorties seront calculées automatiquement en comparant avec le
        comptage précédent de chaque pièce et les commandes reçues entre-temps.
      </p>
    </Modal>
  );
}
