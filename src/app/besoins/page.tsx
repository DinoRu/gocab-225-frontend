"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, downloadWithAuth } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type {
  PartDetail,
  SupplyRequest,
  SupplyRequestItemInput,
  SupplyStatus,
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
import { PartCombobox } from "../../components/PartCombobox";
import { BonFromSupplyForm } from "@/components/BonFromSupplyForm";

const LIMIT = 20;

const STATUS_LABEL: Record<SupplyStatus, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  fulfilled: "Traité",
};
const STATUS_CLASS: Record<SupplyStatus, string> = {
  open: "supply-open",
  in_progress: "supply-progress",
  fulfilled: "supply-fulfilled",
};

export default function SupplyRequestsPage() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<"" | SupplyStatus>("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SupplyRequest | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const needs = useAsync(
    () =>
      api.listSupplyRequests({
        search: debounced || undefined,
        status: status || undefined,
        page,
        limit: LIMIT,
      }),
    [debounced, status, page],
  );

  async function exportXlsx() {
    try {
      await downloadWithAuth(
        api.supplyExportUrl({ status: status || undefined }),
        "besoins_approvisionnement.xlsx",
      );
    } catch {
      toast.push("Export impossible.", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteSupplyRequest(deleting.id);
      toast.push(`Besoin ${deleting.sr_number} supprimé.`, "success");
      setDeleting(null);
      needs.reload();
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
          <h1>Besoins d'approvisionnement</h1>
          <div className="sub">
            {isAdmin
              ? "Besoins signalés — transformez-les en bons de commande"
              : "Signalez les pièces à réapprovisionner"}
          </div>
        </div>
        <div className="row-flex">
          <button className="btn" onClick={exportXlsx}>
            Exporter en Excel
          </button>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Nouveau besoin
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Recherche</label>
          <input
            className="input"
            placeholder="N° de besoin…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Statut</label>
          <select
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "" | SupplyStatus);
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            <option value="open">Ouvert</option>
            <option value="in_progress">En cours</option>
            <option value="fulfilled">Traité</option>
          </select>
        </div>
      </div>

      {needs.error && <ErrorBox message={needs.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N° besoin</th>
              <th>Date</th>
              {isAdmin && <th>Créé par</th>}
              <th className="num">Pièces</th>
              <th>Statut</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {needs.loading && !needs.data ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5}>
                  <Loading />
                </td>
              </tr>
            ) : needs.data && needs.data.items.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5}>
                  <EmptyState
                    message="Aucun besoin"
                    hint="Signalez les pièces qui manquent en stock."
                  />
                </td>
              </tr>
            ) : (
              needs.data?.items.map((n) => (
                <tr
                  key={n.id}
                  className="clickable"
                  onClick={() => setViewing(n.id)}
                >
                  <td className="mono">{n.sr_number}</td>
                  <td>{formatDate(n.request_date)}</td>
                  {isAdmin && (
                    <td>
                      {n.created_by_name || <span className="muted">—</span>}
                    </td>
                  )}
                  <td className="num">{n.items.length}</td>
                  <td>
                    <span className={"supply-badge " + STATUS_CLASS[n.status]}>
                      {STATUS_LABEL[n.status]}
                    </span>
                  </td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-link"
                      onClick={() => setViewing(n.id)}
                    >
                      Détails
                    </button>
                    {/* suppression : ses propres besoins non traités (le backend tranche) */}
                    {n.status !== "fulfilled" && (
                      <button
                        className="btn-link danger"
                        onClick={() => setDeleting(n)}
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {needs.data && needs.data.total > 0 && (
        <Pagination
          page={needs.data.page}
          pages={needs.data.pages}
          total={needs.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {creating && (
        <NeedForm
          onClose={() => setCreating(false)}
          onSaved={(num) => {
            setCreating(false);
            needs.reload();
            toast.push(`Besoin ${num} créé.`, "success");
          }}
        />
      )}

      {viewing && (
        <NeedDetail
          id={viewing}
          isAdmin={isAdmin}
          onClose={() => setViewing(null)}
          onChanged={() => needs.reload()}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer le besoin"
          message={`Supprimer le besoin ${deleting.sr_number} ?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

// ---------- Détail d'un besoin ----------
function NeedDetail({
  id,
  isAdmin,
  onClose,
  onChanged,
}: {
  id: string;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const need = useAsync(() => api.getSupplyRequest(id), [id]);
  const [busy, setBusy] = useState(false);
  const [makingBc, setMakingBc] = useState(false);
  const [editing, setEditing] = useState(false);

  async function act(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast.push(msg, "success");
      need.reload();
      onChanged();
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Action impossible.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  const data = need.data;

  return (
    <>
      <Modal
        title={data ? `Besoin ${data.sr_number}` : "Besoin"}
        onClose={onClose}
        wide
        footer={
          <>
            {isAdmin && data && data.status !== "fulfilled" && (
              <button
                className="btn btn-primary"
                onClick={() => setMakingBc(true)}
                disabled={busy}
              >
                Créer un bon de commande
              </button>
            )}
            {data && data.status !== "fulfilled" && (
              <button
                className="btn"
                onClick={() => setEditing(true)}
                disabled={busy}
              >
                Modifier
              </button>
            )}
            {isAdmin && data && data.status === "in_progress" && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  act(
                    () => api.markSupplyFulfilled(data.id),
                    "Besoin marqué traité.",
                  )
                }
              >
                Marquer traité
              </button>
            )}
            {isAdmin && data && data.status === "fulfilled" && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  act(() => api.reopenSupplyRequest(data.id), "Besoin rouvert.")
                }
              >
                Rouvrir
              </button>
            )}
            <button className="btn" onClick={onClose}>
              Fermer
            </button>
          </>
        }
      >
        {need.loading && <Loading />}
        {need.error && <ErrorBox message={need.error} />}
        {data && (
          <>
            <div
              style={{
                display: "flex",
                gap: 24,
                marginBottom: 14,
                flexWrap: "wrap",
              }}
            >
              <Field label="Date" value={formatDate(data.request_date)} />
              {data.created_by_name && (
                <Field label="Créé par" value={data.created_by_name} />
              )}
              <div>
                <div
                  className="muted"
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  Statut
                </div>
                <span
                  className={"supply-badge " + STATUS_CLASS[data.status]}
                  style={{ marginTop: 2 }}
                >
                  {STATUS_LABEL[data.status]}
                </span>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Désignation</th>
                    <th className="num">Demandé</th>
                    <th className="num">Commandé</th>
                    <th className="num">Reste</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => {
                    const ordered = it.ordered_quantity ?? 0;
                    const remaining = it.remaining_quantity ?? it.quantity;
                    const fully = remaining <= 0;
                    return (
                      <tr key={it.id}>
                        <td className="mono">{it.reference}</td>
                        <td>{it.designation}</td>
                        <td className="num">{it.quantity}</td>
                        <td className="num" style={{ color: "var(--accent)" }}>
                          {ordered > 0 ? (
                            ordered
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td
                          className="num"
                          style={{
                            fontWeight: 700,
                            color: fully ? "var(--success)" : undefined,
                          }}
                        >
                          {fully ? "✓ complet" : remaining}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data.notes && (
              <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
                <strong>Notes :</strong> {data.notes}
              </p>
            )}

            {/* Traçabilité : bons issus de ce besoin (admin) */}
            {isAdmin && data.linked_bcs.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Bons de commande générés
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>N° bon</th>
                        <th>Fournisseur</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.linked_bcs.map((bc) => (
                        <tr key={bc.id}>
                          <td className="mono">{bc.bc_number}</td>
                          <td>
                            {bc.supplier_name || (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td>{bc.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {makingBc && data && (
        <BonFromSupplyForm
          supply={data}
          onClose={() => setMakingBc(false)}
          onCreated={(num) => {
            setMakingBc(false);
            need.reload();
            onChanged();
            toast.push(`Bon ${num} créé depuis le besoin.`, "success");
          }}
        />
      )}

      {editing && data && (
        <NeedEditForm
          need={data}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            need.reload();
            onChanged();
            toast.push("Besoin mis à jour.", "success");
          }}
        />
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="muted"
        style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600 }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ---------- Formulaire de création d'un besoin (magazinier + admin) ----------
type NeedLine = { key: number; part_id: string; quantity: string };
let needLineCounter = 0;
const newNeedLine = (): NeedLine => ({
  key: ++needLineCounter,
  part_id: "",
  quantity: "1",
});

function NeedForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (num: string) => void;
}) {
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<NeedLine[]>([newNeedLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parts = useAsync(() => api.listParts({ limit: 2000 }), []);

  const filled = useMemo(() => lines.filter((l) => l.part_id).length, [lines]);

  function update(key: number, patch: Partial<NeedLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    const kept = lines.filter((l) => l.part_id);
    if (kept.length === 0) {
      setError("Ajoutez au moins une pièce.");
      return;
    }
    const ids = kept.map((l) => l.part_id);
    if (new Set(ids).size !== ids.length) {
      setError("Une même pièce ne peut apparaître qu'une seule fois.");
      return;
    }
    for (const l of kept) {
      const q = Number(l.quantity);
      if (!Number.isInteger(q) || q <= 0) {
        setError("Chaque quantité doit être un entier supérieur à zéro.");
        return;
      }
    }
    const items: SupplyRequestItemInput[] = kept.map((l) => ({
      part_id: l.part_id,
      quantity: Number(l.quantity),
    }));

    setBusy(true);
    try {
      const created = await api.createSupplyRequest({
        request_date: requestDate,
        notes: notes.trim() || null,
        items,
      });
      onSaved(created.sr_number);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nouveau besoin d'approvisionnement"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Création…" : "Créer le besoin"}
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
            Date <span className="required">*</span>
          </label>
          <input
            className="input"
            type="date"
            value={requestDate}
            onChange={(e) => setRequestDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Notes</label>
          <input
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex : stock filtres presque épuisé (facultatif)"
          />
        </div>
      </div>

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="lines-table">
          <thead>
            <tr>
              <th>Pièce</th>
              <th style={{ width: 130 }} className="num">
                Quantité
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
                    onChange={(partId) => update(l.key, { part_id: partId })}
                    placeholder="Choisir une pièce…"
                  />
                </td>
                <td>
                  <input
                    className="input num"
                    type="number"
                    min={1}
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
          onClick={() => setLines((ls) => [...ls, newNeedLine()])}
        >
          + Ajouter une pièce
        </button>
        <span className="muted" style={{ fontSize: 12 }}>
          {filled} pièce(s)
        </span>
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Indiquez simplement les pièces et quantités manquantes. Le choix du
        fournisseur et les prix seront gérés lors de la commande.
      </p>
    </Modal>
  );
}

// ---------- Édition d'un besoin (lignes consommées verrouillées) ----------
type EditNeedLine = {
  key: number;
  part_id: string;
  reference: string;
  designation: string;
  quantity: string;
  ordered: number; // déjà commandé sur cette ligne
  isNew: boolean;
};
let editNeedCounter = 0;

function NeedEditForm({
  need,
  onClose,
  onSaved,
}: {
  need: SupplyRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const parts = useAsync(() => api.listParts({ limit: 1000 }), []);
  const [notes, setNotes] = useState(need.notes ?? "");
  const [lines, setLines] = useState<EditNeedLine[]>(() =>
    need.items.map((it) => ({
      key: ++editNeedCounter,
      part_id: it.part_id,
      reference: it.reference,
      designation: it.designation,
      quantity: String(it.quantity),
      ordered: it.ordered_quantity ?? 0,
      isNew: false,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: number, patch: Partial<EditNeedLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    const kept = lines.filter((l) => l.part_id);
    if (kept.length === 0) {
      setError("Un besoin doit contenir au moins une pièce.");
      return;
    }
    const ids = kept.map((l) => l.part_id);
    if (new Set(ids).size !== ids.length) {
      setError("Une même pièce ne peut apparaître qu'une seule fois.");
      return;
    }
    for (const l of kept) {
      const q = Number(l.quantity);
      if (!Number.isInteger(q) || q <= 0) {
        setError(`Quantité invalide pour « ${l.reference || "?"} ».`);
        return;
      }
      // Garde-fou client : pas sous le commandé (le backend revérifie).
      if (l.ordered > 0 && q < l.ordered) {
        setError(
          `« ${l.reference} » a déjà ${l.ordered} en commande : la quantité ne peut pas être inférieure.`,
        );
        return;
      }
    }

    const items: SupplyRequestItemInput[] = kept.map((l) => ({
      part_id: l.part_id,
      quantity: Number(l.quantity),
    }));

    setBusy(true);
    try {
      await api.updateSupplyRequest(need.id, {
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

  return (
    <Modal
      title={`Modifier ${need.sr_number}`}
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
              <th className="num" style={{ width: 90 }}>
                Commandé
              </th>
              <th className="num" style={{ width: 120 }}>
                Quantité
              </th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const canRemove = l.ordered === 0; // seules les lignes non commandées peuvent partir
              return (
                <tr key={l.key}>
                  <td>
                    {l.isNew ? (
                      <PartCombobox
                        parts={parts.data?.items ?? []}
                        value={l.part_id}
                        onChange={(partId) => {
                          const pt = parts.data?.items.find(
                            (p: PartDetail) => p.id === partId,
                          );
                          update(l.key, {
                            part_id: partId,
                            reference: pt?.reference ?? "",
                            designation: pt?.designation ?? "",
                          });
                        }}
                        placeholder="Choisir une pièce…"
                      />
                    ) : (
                      <span>
                        <span className="mono">{l.reference}</span> —{" "}
                        {l.designation}
                      </span>
                    )}
                  </td>
                  <td
                    className="num"
                    style={{
                      color:
                        l.ordered > 0 ? "var(--accent)" : "var(--text-muted)",
                    }}
                  >
                    {l.ordered > 0 ? l.ordered : "—"}
                  </td>
                  <td className="num">
                    <input
                      className="input num"
                      type="number"
                      min={Math.max(1, l.ordered)}
                      value={l.quantity}
                      onChange={(e) =>
                        update(l.key, { quantity: e.target.value })
                      }
                      title={
                        l.ordered > 0
                          ? `Déjà ${l.ordered} en commande : minimum ${l.ordered}`
                          : undefined
                      }
                    />
                  </td>
                  <td className="num">
                    <button
                      className="btn-link danger"
                      onClick={() =>
                        setLines((ls) =>
                          ls.length > 1
                            ? ls.filter((x) => x.key !== l.key)
                            : ls,
                        )
                      }
                      disabled={!canRemove || lines.length <= 1}
                      title={
                        canRemove
                          ? "Retirer"
                          : "Ligne déjà commandée, non supprimable"
                      }
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        className="btn btn-sm"
        onClick={() =>
          setLines((ls) => [
            ...ls,
            {
              key: ++editNeedCounter,
              part_id: "",
              reference: "",
              designation: "",
              quantity: "1",
              ordered: 0,
              isNew: true,
            },
          ])
        }
      >
        + Ajouter une pièce
      </button>

      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Les lignes déjà commandées ne peuvent être ni supprimées, ni descendues
        sous la quantité commandée.
      </p>
    </Modal>
  );
}
