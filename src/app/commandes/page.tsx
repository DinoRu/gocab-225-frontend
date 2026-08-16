"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, downloadWithAuth } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatFCFA, formatNumber } from "@/lib/format";
import type {
  OrderLineInput,
  PartDetail,
  PurchaseOrder,
  PurchaseOrderItemInput,
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
import { PartCombobox } from "@/components/PartCombobox";
import { AuditHistory } from "../../components/AuditHistory";
import { useAuth } from "../../lib/auth";

const LIMIT = 20;

export default function OrdersPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PurchaseOrder | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const suppliers = useAsync(() => api.listSuppliers(), []);
  const brands = useAsync(() => api.listBrands(), []);

  const orders = useAsync(
    () =>
      api.listOrders({
        search: debounced || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        supplier_id: supplierId || undefined,
        brand_id: brandId || undefined,
        page,
        limit: LIMIT,
        sort: "-order_date",
      }),
    [debounced, startDate, endDate, supplierId, brandId, page],
  );

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteOrder(deleting.id);
      toast.push(`Commande ${deleting.order_number} supprimée.`, "success");
      setDeleting(null);
      orders.reload();
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
          <h1>Commandes</h1>
          <div className="sub">Historique des commandes de pièces</div>
        </div>
        <div className="row-flex">
          <button
            className="btn"
            onClick={() =>
              downloadWithAuth(
                api.exportUrl({
                  start_date: startDate || undefined,
                  end_date: endDate || undefined,
                  supplier_id: supplierId || undefined,
                  brand_id: brandId || undefined,
                }),
                "commandes.xlsx",
              ).catch(() => toast.push("Export impossible.", "error"))
            }
          >
            Exporter en Excel
          </button>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Nouvelle commande
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Recherche</label>
          <input
            className="input"
            placeholder="N° de commande…"
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
        <div className="field">
          <label>Marque</label>
          <select
            className="select"
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Toutes</option>
            {brands.data?.items.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {orders.error && <ErrorBox message={orders.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N° commande</th>
              <th>Date</th>
              <th>Fournisseur</th>
              <th className="num">Lignes</th>
              <th className="num">Montant</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.loading && !orders.data ? (
              <tr>
                <td colSpan={6}>
                  <Loading />
                </td>
              </tr>
            ) : orders.data && orders.data.items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    message="Aucune commande trouvée"
                    hint="Ajustez les filtres ou créez une nouvelle commande."
                  />
                </td>
              </tr>
            ) : (
              orders.data?.items.map((o) => (
                <tr
                  key={o.id}
                  className="clickable"
                  onClick={() => setViewing(o.id)}
                >
                  <td className="mono">{o.order_number}</td>
                  <td>{formatDate(o.order_date)}</td>
                  <td>{o.supplier_name}</td>
                  <td className="num">{o.items.length}</td>
                  <td className="num">{formatFCFA(o.total_amount)}</td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-link"
                      onClick={() => setViewing(o.id)}
                    >
                      Détails
                    </button>
                    <button
                      className="btn-link danger"
                      onClick={() => setDeleting(o)}
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

      {orders.data && orders.data.total > 0 && (
        <Pagination
          page={orders.data.page}
          pages={orders.data.pages}
          total={orders.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {creating && (
        <OrderForm
          onClose={() => setCreating(false)}
          onSaved={(num) => {
            setCreating(false);
            orders.reload();
            toast.push(`Commande ${num} créée.`, "success");
          }}
        />
      )}

      {viewing && (
        <OrderDetail
          id={viewing}
          onClose={() => setViewing(null)}
          onChanged={() => orders.reload()}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer la commande"
          message={`Supprimer la commande ${deleting.order_number} et toutes ses lignes ? Cette action est définitive.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

// ---------- Détail commande : consultation + édition des lignes + audit ----------
function OrderDetail({
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
  const order = useAsync(() => api.getOrder(id), [id]);
  const impact = useAsync(
    () =>
      isAdmin
        ? api.orderInventoryImpact(id)
        : Promise.resolve({ used_by_inventory: false }),
    [id, isAdmin],
  );
  const audit = useAsync(
    () => (isAdmin ? api.orderAudit(id) : Promise.resolve([])),
    [id, isAdmin],
  );
  const [editing, setEditing] = useState(false);

  function reloadAll() {
    order.reload();
    impact.reload();
    audit.reload();
    onChanged();
  }

  return (
    <>
      <Modal
        title={order.data ? `Commande ${order.data.order_number}` : "Commande"}
        onClose={onClose}
        wide
        footer={
          <>
            {order.data && isAdmin && (
              <button className="btn" onClick={() => setEditing(true)}>
                Modifier les lignes
              </button>
            )}
            <button className="btn btn-primary" onClick={onClose}>
              Fermer
            </button>
          </>
        }
      >
        {order.loading && <Loading />}
        {order.error && <ErrorBox message={order.error} />}
        {order.data && (
          <>
            <div
              style={{
                display: "flex",
                gap: 24,
                marginBottom: 14,
                flexWrap: "wrap",
              }}
            >
              <DetailField
                label="Fournisseur"
                value={order.data.supplier_name}
              />
              <DetailField
                label="Date"
                value={formatDate(order.data.order_date)}
              />
              <DetailField
                label="Montant total"
                value={formatFCFA(order.data.total_amount)}
              />
            </div>

            {order.data.notes && (
              <div style={{ marginBottom: 14 }}>
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
                <div>{order.data.notes}</div>
              </div>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Désignation</th>
                    <th className="num">Quantité</th>
                    <th className="num">Prix unitaire</th>
                    <th className="num">Total ligne</th>
                  </tr>
                </thead>
                <tbody>
                  {order.data.items.map((it) => (
                    <tr key={it.id}>
                      <td className="mono">{it.reference}</td>
                      <td>{it.designation}</td>
                      <td className="num">{formatNumber(it.quantity)}</td>
                      <td className="num">{formatFCFA(it.unit_price)}</td>
                      <td className="num">{formatFCFA(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Historique des modifications : admin uniquement */}
            {isAdmin && audit.data && <AuditHistory entries={audit.data} />}
          </>
        )}
      </Modal>

      {editing && order.data && (
        <OrderLinesEditForm
          order={order.data}
          usedByInventory={impact.data?.used_by_inventory ?? false}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reloadAll();
            toast.push("Commande mise à jour.", "success");
          }}
        />
      )}
    </>
  );
}

// ---------- Formulaire d'édition des lignes d'une commande ----------
type EditLineDraft = {
  key: number;
  part_id: string;
  reference: string;
  designation: string;
  quantity: string;
  unit_price: string;
  isNew: boolean;
};
let editOrderLineCounter = 0;

function OrderLinesEditForm({
  order,
  usedByInventory,
  onClose,
  onSaved,
}: {
  order: PurchaseOrder;
  usedByInventory: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const parts = useAsync(() => api.listParts({ limit: 2000 }), []);
  const [lines, setLines] = useState<EditLineDraft[]>(() =>
    order.items.map((it) => ({
      key: ++editOrderLineCounter,
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

  function updateLine(key: number, patch: Partial<EditLineDraft>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    const filled = lines.filter((l) => l.part_id);
    if (filled.length === 0) {
      setError("Une commande doit contenir au moins une ligne.");
      return;
    }
    const ids = filled.map((l) => l.part_id);
    if (new Set(ids).size !== ids.length) {
      setError("Une même pièce ne peut apparaître qu'une seule fois.");
      return;
    }
    for (const l of filled) {
      if (!Number(l.quantity) || Number(l.quantity) <= 0) {
        setError("Chaque ligne doit avoir une quantité supérieure à zéro.");
        return;
      }
      if (l.unit_price.trim() && Number(l.unit_price) < 0) {
        setError("Un prix ne peut pas être négatif.");
        return;
      }
    }

    const items: OrderLineInput[] = filled.map((l) => ({
      part_id: l.part_id,
      quantity: Number(l.quantity),
      unit_price: l.unit_price.trim() ? String(Number(l.unit_price)) : null,
    }));

    setBusy(true);
    try {
      await api.editOrderLines(order.id, items);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Modifier les lignes — ${order.order_number}`}
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

      {/* Avertissement inventaire */}
      {usedByInventory && (
        <div className="warn-banner">
          ⚠ Cette commande a servi de base à un ou plusieurs comptages
          d'inventaire. La modifier peut affecter des calculs de sorties déjà
          effectués — vérifiez vos comptages concernés après enregistrement.
        </div>
      )}

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="lines-table">
          <thead>
            <tr>
              <th>Pièce</th>
              <th style={{ width: 90 }} className="num">
                Quantité
              </th>
              <th style={{ width: 130 }} className="num">
                Prix unit. (FCFA)
              </th>
              <th style={{ width: 110 }} className="num">
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
                      <select
                        className="select"
                        value={l.part_id}
                        onChange={(e) => {
                          const pt = parts.data?.items.find(
                            (x: PartDetail) => x.id === e.target.value,
                          );
                          updateLine(l.key, {
                            part_id: e.target.value,
                            reference: pt?.reference ?? "",
                            designation: pt?.designation ?? "",
                          });
                        }}
                      >
                        <option value="">Choisir une pièce…</option>
                        {parts.data?.items.map((pt: PartDetail) => (
                          <option key={pt.id} value={pt.id}>
                            {pt.reference} — {pt.designation}
                          </option>
                        ))}
                      </select>
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
                        updateLine(l.key, { quantity: e.target.value })
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
                        updateLine(l.key, { unit_price: e.target.value })
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
                key: ++editOrderLineCounter,
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

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="muted"
        style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600 }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

// ---------- Formulaire commande ----------
type LineDraft = {
  key: number;
  part_id: string;
  quantity: string;
  unit_price: string;
};

let lineCounter = 0;
function newLine(): LineDraft {
  return { key: ++lineCounter, part_id: "", quantity: "1", unit_price: "" };
}

function OrderForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (orderNumber: string) => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suppliers = useAsync(() => api.listSuppliers(), []);
  // On charge un catalogue de pièces large pour le sélecteur de lignes.
  const parts = useAsync(() => api.listParts({ limit: 100 }), []);

  const partsById = useMemo(() => {
    const map = new Map<string, PartDetail>();
    parts.data?.items.forEach((p) => map.set(p.id, p));
    return map;
  }, [parts.data]);

  const total = useMemo(() => {
    return lines.reduce((sum, l) => {
      const q = Number(l.quantity) || 0;
      const p = Number(l.unit_price) || 0;
      return sum + q * p;
    }, 0);
  }, [lines]);

  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLine(key: number) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  async function submit() {
    setError(null);

    if (!supplierId) {
      setError("Le fournisseur est obligatoire.");
      return;
    }
    const filled = lines.filter((l) => l.part_id);
    if (filled.length === 0) {
      setError("Ajoutez au moins une ligne avec une pièce.");
      return;
    }
    // Doublons de pièce
    const ids = filled.map((l) => l.part_id);
    if (new Set(ids).size !== ids.length) {
      setError("Une même pièce ne peut apparaître qu'une seule fois.");
      return;
    }
    // Quantités
    for (const l of filled) {
      if (!Number(l.quantity) || Number(l.quantity) <= 0) {
        setError("Chaque ligne doit avoir une quantité supérieure à zéro.");
        return;
      }
    }

    const items: PurchaseOrderItemInput[] = filled.map((l) => ({
      part_id: l.part_id,
      quantity: Number(l.quantity),
      unit_price: l.unit_price.trim() ? l.unit_price.trim() : null,
    }));

    setBusy(true);
    try {
      const created = await api.createOrder({
        supplier_id: supplierId,
        order_date: orderDate,
        notes: notes.trim() || null,
        items,
      });
      onSaved(created.order_number);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nouvelle commande"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Création…" : "Créer la commande"}
          </button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      <div
        className="form-grid"
        style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}
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
            {suppliers.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>
            Date <span className="required">*</span>
          </label>
          <input
            className="input"
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="lines-table">
          <thead>
            <tr>
              <th>Pièce</th>
              <th style={{ width: 90 }} className="num">
                Quantité
              </th>
              <th style={{ width: 130 }} className="num">
                Prix unit. (FCFA)
              </th>
              <th style={{ width: 110 }} className="num">
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
                    <PartCombobox
                      parts={parts.data?.items ?? []}
                      value={l.part_id}
                      onChange={(partId) =>
                        updateLine(l.key, { part_id: partId })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="input num"
                      type="number"
                      min={1}
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
                      placeholder="—"
                      value={l.unit_price}
                      onChange={(e) =>
                        updateLine(l.key, { unit_price: e.target.value })
                      }
                    />
                  </td>
                  <td className="num line-total">
                    {lineTotal > 0 ? formatFCFA(lineTotal) : "—"}
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
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="row-flex"
        style={{ justifyContent: "space-between", marginBottom: 16 }}
      >
        <button
          className="btn btn-sm"
          onClick={() => setLines((ls) => [...ls, newLine()])}
        >
          + Ajouter une ligne
        </button>
        <div style={{ fontWeight: 600 }}>
          Total :{" "}
          <span className="accent" style={{ color: "var(--accent)" }}>
            {formatFCFA(total)}
          </span>
        </div>
      </div>

      <div className="field">
        <label>Notes</label>
        <textarea
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informations complémentaires (facultatif)"
        />
      </div>
    </Modal>
  );
}
