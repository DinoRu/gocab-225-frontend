"use client";

import { useMemo, useState } from "react";
import { api, ApiError, downloadWithAuth } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatFCFA, formatNumber } from "@/lib/format";
import type {
  SalesClient,
  SalesOrder,
  DeliveryNote,
  DeliveryItemInput,
  DeliverableSale,
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
import {
  DocumentPreview,
  type DocumentModel,
} from "@/components/DocumentPreview";
import { formatQtyUnit } from "@/lib/units";

const LIMIT = 20;

export default function DeliveriesPage() {
  const toast = useToast();
  const [clientId, setClientId] = useState("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DeliveryNote | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const clients = useAsync(() => api.listSalesClients({ limit: 500 }), []);
  const deliveries = useAsync(
    () =>
      api.listDeliveries({
        client_id: clientId || undefined,
        page,
        limit: LIMIT,
      }),
    [clientId, page],
  );

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteDelivery(deleting.id);
      toast.push(
        `Bon de livraison ${deleting.delivery_number} supprimé.`,
        "success",
      );
      setDeleting(null);
      deliveries.reload();
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
          <h1>Bons de livraison</h1>
          <div className="sub">
            Livraisons aux clients, rattachées aux ventes
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouveau BL
        </button>
      </div>

      <div className="toolbar">
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

      {deliveries.error && <ErrorBox message={deliveries.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N° BL</th>
              <th>Date</th>
              <th>Client</th>
              <th>Vente liée</th>
              <th className="num">Total livré</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.loading && !deliveries.data ? (
              <tr>
                <td colSpan={6}>
                  <Loading />
                </td>
              </tr>
            ) : deliveries.data && deliveries.data.items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    message="Aucun bon de livraison"
                    hint="Créez un BL depuis une vente."
                  />
                </td>
              </tr>
            ) : (
              deliveries.data?.items.map((d) => (
                <tr
                  key={d.id}
                  className="clickable"
                  onClick={() => setViewing(d.id)}
                >
                  <td className="mono">{d.delivery_number}</td>
                  <td>{formatDate(d.delivery_date)}</td>
                  <td>{d.client_name}</td>
                  <td className="mono" style={{ color: "var(--accent)" }}>
                    {d.sale_number}
                  </td>
                  <td className="num">{formatFCFA(d.total)}</td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-link"
                      onClick={() => setViewing(d.id)}
                    >
                      Détails
                    </button>
                    <button
                      className="btn-link"
                      onClick={() =>
                        downloadWithAuth(
                          api.deliveryPdfUrl(d.id),
                          `BL_${d.delivery_number}.pdf`,
                        ).catch(() =>
                          toast.push("Téléchargement impossible.", "error"),
                        )
                      }
                    >
                      PDF
                    </button>
                    <button
                      className="btn-link danger"
                      onClick={() => setDeleting(d)}
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

      {deliveries.data && deliveries.data.total > 0 && (
        <Pagination
          page={deliveries.data.page}
          pages={deliveries.data.pages}
          total={deliveries.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {creating && (
        <DeliveryForm
          clients={clients.data?.items ?? []}
          onClose={() => setCreating(false)}
          onSaved={(num) => {
            setCreating(false);
            deliveries.reload();
            toast.push(`Bon de livraison ${num} créé.`, "success");
          }}
        />
      )}

      {viewing && (
        <DeliveryDetail id={viewing} onClose={() => setViewing(null)} />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer le bon de livraison"
          message={`Supprimer ${deleting.delivery_number} ? Les quantités redeviendront à livrer.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

// ---------- Détail ----------
function DeliveryDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const dn = useAsync(() => api.getDelivery(id), [id]);
  const data = dn.data;

  const [preview, setPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);

  function buildModel(): DocumentModel {
    return {
      title: "BON DE LIVRAISON",
      number: data!.delivery_number,
      date: data!.delivery_date,
      client_name: data!.client_name,
      meta: [{ label: "Vente liée", value: data!.sale_number }],
      columns: { qty: "Qté livrée", unit_price: "Prix unitaire" },
      lines: data!.items.map((it) => ({
        designation: it.designation,
        quantity: it.quantity,
        unit_price: it.sale_price,
        total: it.line_total,
      })),
      totals: { simple: data!.total }, // un seul total, pas de TVA
    };
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      await downloadWithAuth(
        api.deliveryPdfUrl(data!.id),
        `BL_${data!.delivery_number}.pdf`,
      );
    } catch {
      toast.push("Téléchargement impossible.", "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal
      title={
        data ? `Bon de livraison ${data.delivery_number}` : "Bon de livraison"
      }
      onClose={onClose}
      wide
      footer={
        <>
          {data && (
            <button className="btn" onClick={() => setPreview(true)}>
              Aperçu &amp; PDF
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Fermer
          </button>
        </>
      }
    >
      {dn.loading && <Loading />}
      {dn.error && <ErrorBox message={dn.error} />}
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
            <Field label="Date" value={formatDate(data.delivery_date)} />
            <Field label="Vente liée" value={data.sale_number} />
            <Field label="Total livré" value={formatFCFA(data.total)} />
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th className="num">Qté livrée</th>
                  <th className="num">Prix unitaire</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.designation}</td>
                    <td className="num">{formatNumber(it.quantity)}</td>
                    <td className="num">{formatFCFA(it.sale_price)}</td>
                    <td className="num">{formatFCFA(it.line_total)}</td>
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
          {preview && data && (
            <DocumentPreview
              model={buildModel()}
              onClose={() => setPreview(false)}
              onDownload={downloadPdf}
              downloading={downloading}
            />
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

// ---------- Formulaire de création ----------
type DeliveryLine = {
  sales_order_item_id: string;
  designation: string;
  unit: string;
  sale_price: string;
  ordered: number;
  delivered: number;
  remaining: number;
  toDeliver: string; // saisi, pré-rempli avec le reste
};

function DeliveryForm({
  clients,
  onClose,
  onSaved,
}: {
  clients: SalesClient[];
  onClose: () => void;
  onSaved: (num: string) => void;
}) {
  const toast = useToast();
  const [clientId, setClientId] = useState("");
  const [saleId, setSaleId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DeliveryLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ventes du client sélectionné (pour choisir laquelle livrer)
  const sales = useAsync(
    () =>
      clientId
        ? api.listSalesOrders({ client_id: clientId, limit: 200 })
        : Promise.resolve(null),
    [clientId],
  );

  // Quand on choisit une vente : on charge son "reste à livrer" et on pré-remplit.
  async function pickSale(id: string) {
    setSaleId(id);
    setLines([]);
    if (!id) return;
    try {
      const d: DeliverableSale = await api.deliverableSale(id);
      setLines(
        d.lines.map((l) => ({
          sales_order_item_id: l.sales_order_item_id,
          designation: l.designation,
          unit: l.unit,
          sale_price: l.sale_price,
          ordered: l.quantity_ordered,
          delivered: l.quantity_delivered,
          remaining: l.quantity_remaining,
          toDeliver: String(l.quantity_remaining), // pré-rempli avec le reste
        })),
      );
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Chargement impossible.",
        "error",
      );
    }
  }

  function updateLine(itemId: string, toDeliver: string) {
    setLines((ls) =>
      ls.map((l) =>
        l.sales_order_item_id === itemId ? { ...l, toDeliver } : l,
      ),
    );
  }

  const totalToDeliver = useMemo(
    () =>
      lines.reduce(
        (s, l) => s + (Number(l.toDeliver) || 0) * Number(l.sale_price),
        0,
      ),
    [lines],
  );

  async function submit() {
    setError(null);
    if (!saleId) {
      setError("Choisissez une vente à livrer.");
      return;
    }

    // On ne garde que les lignes avec une quantité > 0, et on plafonne au reste.
    const kept = lines.filter((l) => Number(l.toDeliver) > 0);
    if (kept.length === 0) {
      setError("Indiquez au moins une quantité à livrer.");
      return;
    }
    for (const l of kept) {
      const q = Number(l.toDeliver);
      if (!Number.isInteger(q) || q <= 0) {
        setError(`Quantité invalide pour « ${l.designation} ».`);
        return;
      }
      if (q > l.remaining) {
        setError(
          `« ${l.designation} » : ${q} dépasse le reste à livrer (${l.remaining}).`,
        );
        return;
      }
    }

    const items: DeliveryItemInput[] = kept.map((l) => ({
      sales_order_item_id: l.sales_order_item_id,
      designation: l.designation,
      quantity: Number(l.toDeliver),
      unit: l.unit,
      sale_price: l.sale_price,
    }));

    setBusy(true);
    try {
      const created = await api.createDelivery({
        sales_order_id: saleId,
        delivery_date: deliveryDate,
        notes: notes.trim() || null,
        items,
      });
      onSaved(created.delivery_number);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  const nothingLeft =
    saleId && lines.length > 0 && lines.every((l) => l.remaining <= 0);

  return (
    <Modal
      title="Nouveau bon de livraison"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || !saleId}
          >
            {busy ? "Création…" : "Créer le bon de livraison"}
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
            Client <span className="required">*</span>
          </label>
          <select
            className="select"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setSaleId("");
              setLines([]);
            }}
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
            Vente à livrer <span className="required">*</span>
          </label>
          <select
            className="select"
            value={saleId}
            onChange={(e) => pickSale(e.target.value)}
            disabled={!clientId}
          >
            <option value="">Choisir…</option>
            {sales.data?.items.map((s: SalesOrder) => (
              <option key={s.id} value={s.id}>
                {s.sale_number} — {formatDate(s.sale_date)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>
            Date de livraison <span className="required">*</span>
          </label>
          <input
            className="input"
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </div>
      </div>

      {sales.loading && <Loading />}

      {saleId && lines.length > 0 && (
        <>
          {nothingLeft && (
            <div className="warn-banner">
              Cette vente est déjà entièrement livrée. Rien à livrer.
            </div>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Les quantités sont pré-remplies avec le reste à livrer. Ajustez si
            vous livrez partiellement.
          </p>
          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table className="lines-table">
              <thead>
                <tr>
                  <th>Pièce</th>
                  <th className="num" style={{ width: 80 }}>
                    Vendu
                  </th>
                  <th className="num" style={{ width: 90 }}>
                    Déjà livré
                  </th>
                  <th className="num" style={{ width: 70 }}>
                    Reste
                  </th>
                  <th className="num" style={{ width: 110 }}>
                    À livrer
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr
                    key={l.sales_order_item_id}
                    style={l.remaining <= 0 ? { opacity: 0.5 } : undefined}
                  >
                    <td>
                      {l.designation}{" "}
                      <span className="muted" style={{ fontSize: 11 }}>
                        / {l.unit}
                      </span>
                    </td>
                    <td className="num">{formatNumber(l.ordered)}</td>
                    <td className="num">{formatNumber(l.delivered)}</td>
                    <td
                      className="num"
                      style={{
                        fontWeight: 600,
                        color:
                          l.remaining > 0
                            ? "var(--accent)"
                            : "var(--text-muted)",
                      }}
                    >
                      {formatNumber(l.remaining)}
                    </td>
                    <td>
                      <input
                        className="input num"
                        type="number"
                        min={0}
                        max={l.remaining}
                        value={l.toDeliver}
                        disabled={l.remaining <= 0}
                        onChange={(e) =>
                          updateLine(l.sales_order_item_id, e.target.value)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="row-flex"
            style={{ justifyContent: "flex-end", marginBottom: 12 }}
          >
            <div style={{ fontWeight: 600 }}>
              Total à livrer :{" "}
              <span style={{ color: "var(--accent)" }}>
                {formatFCFA(totalToDeliver)}
              </span>
            </div>
          </div>
        </>
      )}

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
