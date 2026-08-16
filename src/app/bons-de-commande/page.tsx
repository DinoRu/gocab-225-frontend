"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, downloadWithAuth } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatFCFA } from "@/lib/format";
import type {
  BcStatus,
  PurchaseRequest,
  PurchaseRequestItemInput,
  PartDetail,
  Supplier,
  SupplyRequest,
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

const STATUS_LABEL: Record<BcStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  received: "Reçu",
};

const STATUS_CLASS: Record<BcStatus, string> = {
  draft: "bc-draft",
  sent: "bc-sent",
  received: "bc-received",
};

export default function PurchaseRequestsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<"" | BcStatus>("");
  const [supplierId, setSupplierId] = useState("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [pickingNeed, setPickingNeed] = useState(false);
  const [fromNeed, setFromNeed] = useState<SupplyRequest | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PurchaseRequest | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const suppliers = useAsync(() => api.listSuppliers(), []);
  const bcs = useAsync(
    () =>
      api.listPurchaseRequests({
        search: debounced || undefined,
        status: status || undefined,
        supplier_id: supplierId || undefined,
        page,
        limit: LIMIT,
      }),
    [debounced, status, supplierId, page],
  );

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deletePurchaseRequest(deleting.id);
      toast.push(`Bon ${deleting.bc_number} supprimé.`, "success");
      setDeleting(null);
      bcs.reload();
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
          <h1>Bons de commande</h1>
          <div className="sub">
            Demandes d'approvisionnement à envoyer aux fournisseurs
          </div>
        </div>
        <div className="row-flex">
          <button className="btn" onClick={() => setPickingNeed(true)}>
            Depuis un besoin
          </button>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Nouveau bon
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Recherche</label>
          <input
            className="input"
            placeholder="N° de bon…"
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
              setStatus(e.target.value as "" | BcStatus);
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            <option value="draft">Brouillon</option>
            <option value="sent">Envoyé</option>
            <option value="received">Reçu</option>
          </select>
        </div>
        <div className="field">
          <label>Fournisseur</label>
          <select
            className="select"
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            {suppliers.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {bcs.error && <ErrorBox message={bcs.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N° bon</th>
              <th>Fournisseur</th>
              <th>Date</th>
              <th>Statut</th>
              <th className="num">Montant</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bcs.loading && !bcs.data ? (
              <tr>
                <td colSpan={6}>
                  <Loading />
                </td>
              </tr>
            ) : bcs.data && bcs.data.items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    message="Aucun bon de commande"
                    hint="Créez un bon pour exprimer un besoin d'approvisionnement."
                  />
                </td>
              </tr>
            ) : (
              bcs.data?.items.map((bc) => (
                <tr
                  key={bc.id}
                  className="clickable"
                  onClick={() => setViewing(bc.id)}
                >
                  <td className="mono">{bc.bc_number}</td>
                  <td>{bc.supplier.name}</td>
                  <td>{formatDate(bc.request_date)}</td>
                  <td>
                    <span className={"bc-badge " + STATUS_CLASS[bc.status]}>
                      {STATUS_LABEL[bc.status]}
                    </span>
                  </td>
                  <td className="num">
                    {bc.total_amount === null ? (
                      <span className="muted">—</span>
                    ) : (
                      formatFCFA(bc.total_amount)
                    )}
                  </td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-link"
                      onClick={() => setViewing(bc.id)}
                    >
                      Détails
                    </button>
                    <button
                      className="btn-link"
                      onClick={() =>
                        downloadWithAuth(
                          api.bcPdfUrl(bc.id),
                          `bon_commande_${bc.bc_number}.pdf`,
                        ).catch(() =>
                          toast.push("Téléchargement impossible.", "error"),
                        )
                      }
                    >
                      PDF
                    </button>
                    <button
                      className="btn-link"
                      onClick={() =>
                        downloadWithAuth(
                          api.bcExcelUrl(bc.id),
                          `bon_commande_${bc.bc_number}.xlsx`,
                        ).catch(() =>
                          toast.push("Téléchargement impossible.", "error"),
                        )
                      }
                    >
                      Excel
                    </button>
                    <button
                      className="btn-link danger"
                      onClick={() => setDeleting(bc)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {bcs.data && bcs.data.total > 0 && (
        <Pagination
          page={bcs.data.page}
          pages={bcs.data.pages}
          total={bcs.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {creating && (
        <BcForm
          suppliers={suppliers.data?.items ?? []}
          onClose={() => setCreating(false)}
          onSaved={(num) => {
            setCreating(false);
            bcs.reload();
            toast.push(`Bon ${num} créé.`, "success");
          }}
        />
      )}

      {pickingNeed && (
        <PickNeedModal
          onClose={() => setPickingNeed(false)}
          onPick={(need) => {
            setPickingNeed(false);
            setFromNeed(need);
          }}
        />
      )}

      {fromNeed && (
        <BonFromSupplyForm
          supply={fromNeed}
          onClose={() => setFromNeed(null)}
          onCreated={(num) => {
            setFromNeed(null);
            bcs.reload();
            toast.push(`Bon ${num} créé depuis le besoin.`, "success");
          }}
        />
      )}

      {viewing && (
        <BcDetail
          id={viewing}
          onClose={() => setViewing(null)}
          onChanged={() => bcs.reload()}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer le bon"
          message={`Supprimer le bon ${deleting.bc_number} ? Cette action est définitive.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

// ---------- Détail d'un bon (avec actions cycle de vie) ----------
function BcDetail({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const bc = useAsync(() => api.getPurchaseRequest(id), [id]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  async function act(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast.push(msg, "success");
      bc.reload();
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

  const data = bc.data;
  // Un bon issu d'un besoin : on n'édite pas ses lignes ici (cohérence de la
  // consommation du besoin). On le modifie via le besoin d'origine.
  const fromNeed = !!data?.supply_request_id;

  return (
    <>
      <Modal
        title={data ? `Bon ${data.bc_number}` : "Bon de commande"}
        onClose={onClose}
        wide
        footer={
          <>
            {data && (
              <>
                <button
                  className="btn"
                  onClick={() =>
                    downloadWithAuth(
                      api.bcPdfUrl(data.id),
                      `bon_commande_${data.bc_number}.pdf`,
                    ).catch(() =>
                      toast.push("Téléchargement impossible.", "error"),
                    )
                  }
                >
                  PDF
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    downloadWithAuth(
                      api.bcExcelUrl(data.id),
                      `bon_commande_${data.bc_number}.xlsx`,
                    ).catch(() =>
                      toast.push("Téléchargement impossible.", "error"),
                    )
                  }
                >
                  Excel
                </button>
                {data.status === "draft" && !fromNeed && (
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => setEditing(true)}
                  >
                    Modifier les lignes
                  </button>
                )}
                {data.status === "draft" && (
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      act(() => api.sendPurchaseRequest(data.id), "Bon envoyé.")
                    }
                  >
                    Marquer envoyé
                  </button>
                )}
                {data.status === "sent" && (
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => api.receivePurchaseRequest(data.id),
                        "Bon reçu.",
                      )
                    }
                  >
                    Marquer reçu
                  </button>
                )}
                {data.status !== "draft" && (
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      act(
                        () => api.reopenPurchaseRequest(data.id),
                        "Bon rouvert.",
                      )
                    }
                  >
                    Rouvrir
                  </button>
                )}
              </>
            )}
            <button className="btn" onClick={onClose}>
              Fermer
            </button>
          </>
        }
      >
        {bc.loading && <Loading />}
        {bc.error && <ErrorBox message={bc.error} />}
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
              <DetailField label="Fournisseur" value={data.supplier.name} />
              <DetailField
                label="Date du bon"
                value={formatDate(data.request_date)}
              />
              {data.expected_date && (
                <DetailField
                  label="Livraison souhaitée"
                  value={formatDate(data.expected_date)}
                />
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
                  className={"bc-badge " + STATUS_CLASS[data.status]}
                  style={{ marginTop: 2 }}
                >
                  {STATUS_LABEL[data.status]}
                </span>
              </div>
              {data.order_number && (
                <DetailField label="Commande liée" value={data.order_number} />
              )}
            </div>

            {fromNeed && data.status === "draft" && (
              <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
                Ce bon a été généré depuis un besoin. Pour ajuster ses lignes,
                supprimez-le et recréez-le depuis le besoin (cela préserve le
                suivi du reste à commander).
              </p>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Désignation</th>
                    <th className="num">Quantité</th>
                    <th className="num">Prix unitaire</th>
                    <th className="num">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.id}>
                      <td className="mono">{it.reference}</td>
                      <td>{it.designation}</td>
                      <td className="num">{it.quantity}</td>
                      <td className="num">
                        {it.unit_price === null ? (
                          <span className="muted">—</span>
                        ) : (
                          formatFCFA(it.unit_price)
                        )}
                      </td>
                      <td className="num">
                        {it.line_total === null ? (
                          <span className="muted">—</span>
                        ) : (
                          formatFCFA(it.line_total)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {data.total_amount !== null && (
                  <tfoot>
                    <tr style={{ background: "var(--bg)", fontWeight: 700 }}>
                      <td
                        colSpan={4}
                        style={{ textAlign: "right", padding: "8px 12px" }}
                      >
                        TOTAL
                      </td>
                      <td className="num" style={{ padding: "8px 12px" }}>
                        {formatFCFA(data.total_amount)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {data.notes && (
              <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
                <strong>Notes :</strong> {data.notes}
              </p>
            )}
          </>
        )}
      </Modal>

      {editing && data && (
        <BcLinesEditForm
          bc={data}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            bc.reload();
            onChanged();
            toast.push("Bon mis à jour.", "success");
          }}
        />
      )}
    </>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
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

// ---------- Choisir un besoin source pour créer un bon ----------
function PickNeedModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (need: SupplyRequest) => void;
}) {
  const toast = useToast();
  // On ne propose que les besoins encore ouverts ou en cours (pas les traités).
  const openNeeds = useAsync(
    () => api.listSupplyRequests({ status: "open", limit: 50 }),
    [],
  );
  const inProgress = useAsync(
    () => api.listSupplyRequests({ status: "in_progress", limit: 50 }),
    [],
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const rows = [
    ...(openNeeds.data?.items ?? []),
    ...(inProgress.data?.items ?? []),
  ];

  async function choose(id: string) {
    setLoadingId(id);
    try {
      const full = await api.getSupplyRequest(id); // détail avec reste par ligne
      onPick(full);
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Chargement impossible.",
        "error",
      );
    } finally {
      setLoadingId(null);
    }
  }

  const loading = openNeeds.loading || inProgress.loading;

  return (
    <Modal
      title="Choisir un besoin"
      onClose={onClose}
      footer={
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
      }
    >
      {loading && <Loading />}
      {rows.length === 0 && !loading ? (
        <EmptyState
          message="Aucun besoin à traiter"
          hint="Tous les besoins sont soit traités, soit inexistants."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N° besoin</th>
                <th>Date</th>
                <th className="num">Pièces</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id}>
                  <td className="mono">{n.sr_number}</td>
                  <td>{formatDate(n.request_date)}</td>
                  <td className="num">{n.items.length}</td>
                  <td className="num">
                    <button
                      className="btn-link"
                      disabled={loadingId === n.id}
                      onClick={() => choose(n.id)}
                    >
                      {loadingId === n.id ? "…" : "Choisir"}
                    </button>
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

// ---------- Formulaire de création ----------
type BcLine = {
  key: number;
  part_id: string;
  quantity: string;
  unit_price: string;
};

let lineCounter = 0;
function newLine(): BcLine {
  return { key: ++lineCounter, part_id: "", quantity: "1", unit_price: "" };
}

function BcForm({
  suppliers,
  onClose,
  onSaved,
}: {
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: (bcNumber: string) => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BcLine[]>([newLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parts = useAsync(() => api.listParts({ limit: 2000 }), []);

  function updateLine(key: number, patch: Partial<BcLine>) {
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
    if (!supplierId) {
      setError("Le fournisseur est obligatoire.");
      return;
    }
    const filled = lines.filter((l) => l.part_id);
    if (filled.length === 0) {
      setError("Ajoutez au moins une pièce.");
      return;
    }
    const ids = filled.map((l) => l.part_id);
    if (new Set(ids).size !== ids.length) {
      setError("Une même pièce ne peut apparaître qu'une seule fois.");
      return;
    }
    for (const l of filled) {
      const q = Number(l.quantity);
      if (!Number.isInteger(q) || q <= 0) {
        setError("Chaque quantité doit être un entier supérieur à zéro.");
        return;
      }
      if (l.unit_price !== "") {
        const p = Number(l.unit_price);
        if (Number.isNaN(p) || p < 0) {
          setError("Un prix unitaire renseigné doit être positif ou nul.");
          return;
        }
      }
    }

    const items: PurchaseRequestItemInput[] = filled.map((l) => ({
      part_id: l.part_id,
      quantity: Number(l.quantity),
      unit_price: l.unit_price === "" ? null : String(Number(l.unit_price)),
    }));

    setBusy(true);
    try {
      const created = await api.createPurchaseRequest({
        supplier_id: supplierId,
        request_date: requestDate,
        expected_date: expectedDate || null,
        notes: notes.trim() || null,
        items,
      });
      onSaved(created.bc_number);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nouveau bon de commande"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Création…" : "Créer le bon"}
          </button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      <div
        className="form-grid"
        style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 16 }}
      >
        <div className="field">
          <label>
            Fournisseur <span className="required">*</span>
          </label>
          <select
            className="select"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">Choisir…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>
            Date du bon <span className="required">*</span>
          </label>
          <input
            className="input"
            type="date"
            value={requestDate}
            onChange={(e) => setRequestDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Livraison souhaitée</label>
          <input
            className="input"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="lines-table">
          <thead>
            <tr>
              <th>Pièce</th>
              <th style={{ width: 110 }} className="num">
                Quantité
              </th>
              <th style={{ width: 140 }} className="num">
                Prix unit. (opt.)
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
                      updateLine(l.key, { quantity: e.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    className="input num"
                    type="number"
                    min={0}
                    value={l.unit_price}
                    onChange={(e) =>
                      updateLine(l.key, { unit_price: e.target.value })
                    }
                    placeholder="—"
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
          {filledCount} pièce(s)
        </span>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>Notes</label>
        <input
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informations pour le fournisseur (facultatif)"
        />
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Le prix unitaire est facultatif. Le total ne s'affiche que si au moins
        un prix est renseigné.
      </p>
    </Modal>
  );
}

// ---------- Édition des lignes d'un bon (brouillon uniquement) ----------
type BcEditLine = {
  key: number;
  part_id: string;
  reference: string;
  designation: string;
  quantity: string;
  unit_price: string;
  isNew: boolean;
};
let bcEditCounter = 0;

function BcLinesEditForm({
  bc,
  onClose,
  onSaved,
}: {
  bc: PurchaseRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const parts = useAsync(() => api.listParts({ limit: 1000 }), []);
  const [lines, setLines] = useState<BcEditLine[]>(() =>
    bc.items.map((it) => ({
      key: ++bcEditCounter,
      part_id: it.part_id,
      reference: it.reference,
      designation: it.designation,
      quantity: String(it.quantity),
      unit_price: it.unit_price != null ? String(it.unit_price) : "",
      isNew: false,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const q = Number(l.quantity) || 0;
        const p = Number(l.unit_price) || 0;
        return sum + q * p;
      }, 0),
    [lines],
  );

  function update(key: number, patch: Partial<BcEditLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    const filled = lines.filter((l) => l.part_id);
    if (filled.length === 0) {
      setError("Le bon doit contenir au moins une ligne.");
      return;
    }
    const ids = filled.map((l) => l.part_id);
    if (new Set(ids).size !== ids.length) {
      setError("Une même pièce ne peut apparaître qu'une seule fois.");
      return;
    }
    for (const l of filled) {
      const q = Number(l.quantity);
      if (!Number.isInteger(q) || q <= 0) {
        setError(`Quantité invalide pour « ${l.reference || "?"} ».`);
        return;
      }
      if (l.unit_price !== "" && Number(l.unit_price) < 0) {
        setError(`Prix invalide pour « ${l.reference || "?"} ».`);
        return;
      }
    }

    const items: PurchaseRequestItemInput[] = filled.map((l) => ({
      part_id: l.part_id,
      quantity: Number(l.quantity),
      unit_price: l.unit_price === "" ? null : String(Number(l.unit_price)),
    }));

    setBusy(true);
    try {
      await api.updatePurchaseRequest(bc.id, { items });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Modifier les lignes — ${bc.bc_number}`}
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

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="lines-table">
          <thead>
            <tr>
              <th>Pièce</th>
              <th className="num" style={{ width: 100 }}>
                Quantité
              </th>
              <th className="num" style={{ width: 140 }}>
                Prix unit. (FCFA)
              </th>
              <th className="num" style={{ width: 110 }}>
                Total
              </th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const q = Number(l.quantity) || 0;
              const p = Number(l.unit_price) || 0;
              const lineTotal = q * p;
              return (
                <tr key={l.key}>
                  <td>
                    {l.isNew ? (
                      <PartCombobox
                        parts={parts.data?.items ?? []}
                        value={l.part_id}
                        onChange={(partId) => {
                          const pt = parts.data?.items.find(
                            (x: PartDetail) => x.id === partId,
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
                  <td>
                    <input
                      className="input num"
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) =>
                        update(l.key, { quantity: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="input num"
                      type="number"
                      min={0}
                      placeholder="—"
                      value={l.unit_price}
                      onChange={(e) =>
                        update(l.key, { unit_price: e.target.value })
                      }
                    />
                  </td>
                  <td className="num line-total">
                    {lineTotal > 0 ? formatFCFA(lineTotal) : "—"}
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
                      disabled={lines.length <= 1}
                      title="Retirer la ligne"
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

      <div className="row-flex" style={{ justifyContent: "space-between" }}>
        <button
          className="btn btn-sm"
          onClick={() =>
            setLines((ls) => [
              ...ls,
              {
                key: ++bcEditCounter,
                part_id: "",
                reference: "",
                designation: "",
                quantity: "1",
                unit_price: "",
                isNew: true,
              },
            ])
          }
        >
          + Ajouter une ligne
        </button>
        <div style={{ fontWeight: 600 }}>
          Total :{" "}
          <span style={{ color: "var(--accent)" }}>{formatFCFA(total)}</span>
        </div>
      </div>
    </Modal>
  );
}
