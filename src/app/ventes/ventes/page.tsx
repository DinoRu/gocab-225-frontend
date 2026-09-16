"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatFCFA, formatNumber } from "@/lib/format";
import type { SalesClient, SalesOrder, SalesOrderItemInput } from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Loading,
  Modal,
  Pagination,
  useToast,
} from "@/components/ui";
import { ProductCombobox } from "@/components/ProductCombobox";
import { SALES_UNITS, DEFAULT_UNIT, formatQtyUnit } from "@/lib/units";

const LIMIT = 20;

const DELIVERY_LABEL: Record<string, string> = {
  non_livree: "Non livrée",
  partiellement_livree: "Partiellement livrée",
  livree: "Livrée",
};
const DELIVERY_CLASS: Record<string, string> = {
  non_livree: "dlv-none",
  partiellement_livree: "dlv-partial",
  livree: "dlv-full",
};
const PAY_LABEL: Record<string, string> = {
  impayee: "Impayée",
  partiellement_payee: "Partielle",
  payee: "Payée",
};
const PAY_CLASS: Record<string, string> = {
  impayee: "pay-none",
  partiellement_payee: "pay-partial",
  payee: "pay-full",
};

export default function SalesOrdersPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [clientId, setClientId] = useState("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SalesOrder | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [settling, setSettling] = useState<SalesOrder | null>(null);
  const [settleBusy, setSettleBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const clients = useAsync(() => api.listSalesClients({ limit: 500 }), []);
  const sales = useAsync(
    () =>
      api.listSalesOrders({
        search: debounced || undefined,
        client_id: clientId || undefined,
        page,
        limit: LIMIT,
      }),
    [debounced, clientId, page],
  );

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteSalesOrder(deleting.id);
      toast.push(`Vente ${deleting.sale_number} supprimée.`, "success");
      setDeleting(null);
      sales.reload();
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Suppression impossible.",
        "error",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  async function confirmSettle() {
    if (!settling) return;
    setSettleBusy(true);
    try {
      await api.settleSale(settling.id);
      toast.push(`Vente ${settling.sale_number} soldée.`, "success");
      setSettling(null);
      sales.reload();
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Impossible de solder.",
        "error",
      );
    } finally {
      setSettleBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ventes</h1>
          <div className="sub">Ventes aux entreprises, avec suivi de marge</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouvelle vente
        </button>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Recherche</label>
          <input
            className="input"
            placeholder="N° de vente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Client</label>
          <select
            className="select"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            {clients.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sales.error && <ErrorBox message={sales.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N° vente</th>
              <th>Date</th>
              <th>Client</th>
              <th className="num">Total vente</th>
              <th className="num">Marge</th>
              <th>Paiement</th>
              <th>Livraison</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.loading && !sales.data ? (
              <tr>
                <td colSpan={8}>
                  <Loading />
                </td>
              </tr>
            ) : sales.data && sales.data.items.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    message="Aucune vente"
                    hint="Enregistrez votre première vente."
                  />
                </td>
              </tr>
            ) : (
              sales.data?.items.map((s) => (
                <tr
                  key={s.id}
                  className="clickable"
                  onClick={() => setViewing(s.id)}
                >
                  <td className="mono">{s.sale_number}</td>
                  <td>{formatDate(s.sale_date)}</td>
                  <td>{s.client_name}</td>
                  <td className="num">{formatFCFA(s.total_ttc)}</td>
                  <td
                    className="num"
                    style={{ color: "var(--success)", fontWeight: 600 }}
                  >
                    {formatFCFA(s.total_margin)}
                  </td>
                  <td>
                    <span
                      className={
                        "pay-badge " +
                        (PAY_CLASS[s.payment_status] || "pay-none")
                      }
                    >
                      {PAY_LABEL[s.payment_status] || "—"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        "dlv-badge " +
                        (DELIVERY_CLASS[s.delivery_status] || "dlv-none")
                      }
                    >
                      {DELIVERY_LABEL[s.delivery_status] || "—"}
                    </span>
                  </td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-link"
                      onClick={() => setViewing(s.id)}
                    >
                      Détails
                    </button>
                    {s.payment_status !== "payee" && (
                      <button
                        className="btn-link"
                        onClick={() => setSettling(s)}
                      >
                        Solder
                      </button>
                    )}
                    <button
                      className="btn-link danger"
                      onClick={() => setDeleting(s)}
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

      {sales.data && sales.data.total > 0 && (
        <Pagination
          page={sales.data.page}
          pages={sales.data.pages}
          total={sales.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {creating && (
        <SaleForm
          clients={clients.data?.items ?? []}
          onClose={() => setCreating(false)}
          onSaved={(num) => {
            setCreating(false);
            sales.reload();
            toast.push(`Vente ${num} créée.`, "success");
          }}
        />
      )}

      {viewing && <SaleDetail id={viewing} onClose={() => setViewing(null)} />}

      {deleting && (
        <ConfirmDialog
          title="Supprimer la vente"
          message={`Supprimer la vente ${deleting.sale_number} ? Cette action est définitive.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}

      {settling && (
        <ConfirmDialog
          title="Solder la vente"
          message={`Enregistrer un paiement de ${formatFCFA(settling.amount_due)} pour solder ${settling.sale_number} ?`}
          onConfirm={confirmSettle}
          onCancel={() => setSettling(null)}
          busy={settleBusy}
        />
      )}
    </>
  );
}

// ---------- Détail d'une vente ----------
function SaleDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const sale = useAsync(() => api.getSalesOrder(id), [id]);
  const data = sale.data;

  return (
    <Modal
      title={data ? `Vente ${data.sale_number}` : "Vente"}
      onClose={onClose}
      wide
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Fermer
        </button>
      }
    >
      {sale.loading && <Loading />}
      {sale.error && <ErrorBox message={sale.error} />}
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
            <Field label="Client" value={data.client_name} />
            <Field label="Date" value={formatDate(data.sale_date)} />
          </div>

          {/* Récap financier : HT → TVA → TTC, + marge */}
          <div className="sale-totals-box">
            <div className="sale-totals-row">
              <span>Total HT</span>
              <span>{formatFCFA(data.total_sale)}</span>
            </div>
            <div className="sale-totals-row">
              <span>TVA (18%)</span>
              <span>{formatFCFA(data.vat_amount)}</span>
            </div>
            <div className="sale-totals-row sale-totals-ttc">
              <span>Total TTC (dû par le client)</span>
              <span>{formatFCFA(data.total_ttc)}</span>
            </div>
            <div className="sale-totals-row sale-totals-margin">
              <span>Marge (sur HT)</span>
              <span>{formatFCFA(data.total_margin)}</span>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th className="num">Qté</th>
                  <th className="num">Prix achat</th>
                  <th className="num">Prix vente</th>
                  <th className="num">Total</th>
                  <th className="num">Marge</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.designation}</td>
                    <td className="num">
                      {formatQtyUnit(it.quantity, it.unit)}
                    </td>
                    <td className="num">{formatFCFA(it.purchase_price)}</td>
                    <td className="num">{formatFCFA(it.sale_price)}</td>
                    <td className="num">{formatFCFA(it.line_total)}</td>
                    <td className="num" style={{ color: "var(--success)" }}>
                      {formatFCFA(it.line_margin)}
                    </td>
                  </tr>
                ))}
              </tbody>
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

// ---------- Formulaire de vente ----------
type SaleLine = {
  key: number;
  product_id: string | null;
  designation: string;
  quantity: string;
  unit: string;
  purchase_price: string;
  sale_price: string;
  add_to_catalog: boolean;
};
let saleLineCounter = 0;
const newSaleLine = (): SaleLine => ({
  key: ++saleLineCounter,
  product_id: null,
  designation: "",
  quantity: "1",
  unit: DEFAULT_UNIT,
  purchase_price: "",
  sale_price: "",
  add_to_catalog: true,
});

function SaleForm({
  clients,
  onClose,
  onSaved,
}: {
  clients: SalesClient[];
  onClose: () => void;
  onSaved: (num: string) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([newSaleLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = useAsync(() => api.listSalesProducts({ limit: 1000 }), []);

  function updateLine(key: number, patch: Partial<SaleLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  // Cherche le dernier prix pratiqué à ce client pour cet article.
  async function fetchClientPrice(
    key: number,
    designation: string,
    productId: string | null,
  ) {
    if (!clientId || !designation.trim()) return;
    try {
      const hint = await api.priceHint({
        client_id: clientId,
        designation: productId ? undefined : designation,
        product_id: productId || undefined,
      });
      if (hint) {
        setLines((ls) =>
          ls.map((l) => {
            if (l.key !== key) return l;
            // On ne pré-remplit que si les champs sont encore vides (ne pas écraser une saisie).
            return {
              ...l,
              purchase_price: l.purchase_price || (hint.purchase_price ?? ""),
              sale_price: l.sale_price || hint.sale_price,
            };
          }),
        );
      }
    } catch {
      // silencieux : pas de prix trouvé, on laisse vide
    }
  }

  const totals = useMemo(() => {
    let sale = 0,
      purchase = 0;
    for (const l of lines) {
      const q = Number(l.quantity) || 0;
      const pv = Number(l.sale_price) || 0;
      const pa = Number(l.purchase_price) || 0;
      sale += q * pv;
      purchase += q * pa;
    }
    return { sale, purchase, margin: sale - purchase };
  }, [lines]);

  async function submit() {
    setError(null);
    if (!clientId) {
      setError("Le client est obligatoire.");
      return;
    }

    const filled = lines.filter((l) => l.designation.trim());
    if (filled.length === 0) {
      setError("Ajoutez au moins une ligne.");
      return;
    }

    for (const l of filled) {
      const q = Number(l.quantity);
      if (!Number.isInteger(q) || q <= 0) {
        setError(`Quantité invalide pour « ${l.designation} ».`);
        return;
      }
      if (l.purchase_price.trim() === "" || Number(l.purchase_price) < 0) {
        setError(`Prix d'achat obligatoire (≥ 0) pour « ${l.designation} ».`);
        return;
      }
      if (l.sale_price.trim() === "" || Number(l.sale_price) < 0) {
        setError(`Prix de vente obligatoire (≥ 0) pour « ${l.designation} ».`);
        return;
      }
    }

    const items: SalesOrderItemInput[] = filled.map((l) => ({
      product_id: l.product_id,
      designation: l.designation.trim(),
      quantity: Number(l.quantity),
      unit: l.unit || DEFAULT_UNIT,
      purchase_price: String(Number(l.purchase_price)),
      sale_price: String(Number(l.sale_price)),
      add_to_catalog: !l.product_id && l.add_to_catalog, // seulement pour lignes libres
    }));

    setBusy(true);
    try {
      const created = await api.createSalesOrder({
        client_id: clientId,
        sale_date: saleDate,
        notes: notes.trim() || null,
        items,
      });
      onSaved(created.sale_number);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  // Déclenche la recherche de prix client quand une désignation se stabilise (debounce).
  // On mémorise la dernière désignation interrogée par ligne pour ne pas re-fetch inutilement.
  const lastQueried = useRef<Record<number, string>>({});

  useEffect(() => {
    if (!clientId) return;
    const t = setTimeout(() => {
      for (const l of lines) {
        const key = `${l.product_id ?? "free"}:${l.designation.trim().toLowerCase()}`;
        if (!l.designation.trim()) continue;
        if (lastQueried.current[l.key] === key) continue; // déjà interrogé
        lastQueried.current[l.key] = key;
        fetchClientPrice(l.key, l.designation, l.product_id);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [lines, clientId]);

  return (
    <Modal
      title="Nouvelle vente"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Création…" : "Créer la vente"}
          </button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      <div
        className="form-grid"
        style={{ gridTemplateColumns: "2fr 1fr", marginBottom: 16 }}
      >
        <div className="field">
          <label>
            Client <span className="required">*</span>
          </label>
          <select
            className="select"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Choisir…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="lines-table">
          <thead>
            <tr>
              <th style={{ minWidth: 220 }}>Produit / désignation</th>
              <th className="num" style={{ width: 70 }}>
                Qté
              </th>
              <th style={{ width: 100 }}>Unité</th>
              <th className="num" style={{ width: 120 }}>
                Prix achat
              </th>
              <th className="num" style={{ width: 120 }}>
                Prix vente
              </th>
              <th className="num" style={{ width: 110 }}>
                Marge ligne
              </th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const q = Number(l.quantity) || 0;
              const pa = Number(l.purchase_price) || 0;
              const pv = Number(l.sale_price) || 0;
              const lineMargin = q * (pv - pa);
              return (
                <tr key={l.key}>
                  <td>
                    <ProductCombobox
                      products={products.data?.items ?? []}
                      designation={l.designation}
                      onChangeText={(text) => {
                        updateLine(l.key, {
                          designation: text,
                          product_id: null,
                          purchase_price: "",
                          sale_price: "",
                        });
                      }}
                      onPickProduct={(p) => {
                        updateLine(l.key, {
                          product_id: p.id,
                          designation: p.designation,
                          unit: p.default_unit || DEFAULT_UNIT,
                          purchase_price:
                            p.default_purchase_price != null
                              ? String(p.default_purchase_price)
                              : "",
                          sale_price:
                            p.default_sale_price != null
                              ? String(p.default_sale_price)
                              : "",
                        });
                      }}
                      placeholder="Produit ou désignation libre…"
                    />
                    {!l.product_id && l.designation.trim() && (
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          marginTop: 4,
                          color: "var(--text-muted)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={l.add_to_catalog}
                          onChange={(e) =>
                            updateLine(l.key, {
                              add_to_catalog: e.target.checked,
                            })
                          }
                        />
                        Ajouter au catalogue
                      </label>
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
                    <select
                      className="select"
                      value={l.unit}
                      onChange={(e) =>
                        updateLine(l.key, { unit: e.target.value })
                      }
                    >
                      {SALES_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="input num"
                      type="number"
                      min={0}
                      value={l.purchase_price}
                      onChange={(e) =>
                        updateLine(l.key, { purchase_price: e.target.value })
                      }
                      placeholder="obligatoire"
                    />
                  </td>
                  <td>
                    <input
                      className="input num"
                      type="number"
                      min={0}
                      value={l.sale_price}
                      onChange={(e) =>
                        updateLine(l.key, { sale_price: e.target.value })
                      }
                      placeholder="obligatoire"
                    />
                  </td>
                  <td
                    className="num"
                    style={{
                      fontWeight: 600,
                      color:
                        lineMargin > 0
                          ? "var(--success)"
                          : lineMargin < 0
                            ? "var(--danger)"
                            : undefined,
                    }}
                  >
                    {q > 0 && (l.purchase_price || l.sale_price)
                      ? formatFCFA(lineMargin)
                      : "—"}
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
                      title="Retirer"
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
          onClick={() => setLines((ls) => [...ls, newSaleLine()])}
        >
          + Ajouter une ligne
        </button>
        <div
          style={{ display: "flex", gap: 20, fontSize: 13, flexWrap: "wrap" }}
        >
          <div>
            Total HT : <strong>{formatFCFA(totals.sale)}</strong>
          </div>
          <div>
            TVA 18% :{" "}
            <span className="muted">{formatFCFA(totals.sale * 0.18)}</span>
          </div>
          <div>
            TTC : <strong>{formatFCFA(totals.sale * 1.18)}</strong>
          </div>
          <div>
            Marge :{" "}
            <strong style={{ color: "var(--success)" }}>
              {formatFCFA(totals.margin)}
            </strong>
          </div>
        </div>
      </div>

      <div className="field">
        <label>Notes</label>
        <textarea
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Facultatif"
        />
      </div>
    </Modal>
  );
}
