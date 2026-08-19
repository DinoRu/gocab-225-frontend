"use client";

import { useMemo, useState } from "react";
import { api, ApiError, downloadWithAuth } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatFCFA, formatNumber } from "@/lib/format";
import type {
  SalesClient,
  SalesProduct,
  SalesProforma,
  ProformaItemInput,
  ProformaConvertItemInput,
  ProformaStatus,
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
import { ProductCombobox } from "@/components/ProductCombobox";
import { SALES_UNITS, DEFAULT_UNIT, formatQtyUnit } from "@/lib/units";

const LIMIT = 20;

const STATUS_LABEL: Record<ProformaStatus, string> = {
  en_cours: "En cours",
  convertie: "Convertie",
};
const STATUS_CLASS: Record<ProformaStatus, string> = {
  en_cours: "pf-encours",
  convertie: "pf-convertie",
};

export default function ProformasPage() {
  const toast = useToast();
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<"" | ProformaStatus>("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SalesProforma | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const clients = useAsync(() => api.listSalesClients({ limit: 500 }), []);
  const proformas = useAsync(
    () =>
      api.listSalesProformas({
        client_id: clientId || undefined,
        status: status || undefined,
        page,
        limit: LIMIT,
      }),
    [clientId, status, page],
  );

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteSalesProforma(deleting.id);
      toast.push(`Proforma ${deleting.proforma_number} supprimée.`, "success");
      setDeleting(null);
      proformas.reload();
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
          <h1>Proformas</h1>
          <div className="sub">Devis clients, convertibles en vente</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouvelle proforma
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
        <div className="field">
          <label>Statut</label>
          <select
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "" | ProformaStatus);
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            <option value="en_cours">En cours</option>
            <option value="convertie">Convertie</option>
          </select>
        </div>
      </div>

      {proformas.error && <ErrorBox message={proformas.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N° proforma</th>
              <th>Date</th>
              <th>Client</th>
              <th className="num">Total</th>
              <th>Statut</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {proformas.loading && !proformas.data ? (
              <tr>
                <td colSpan={6}>
                  <Loading />
                </td>
              </tr>
            ) : proformas.data && proformas.data.items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    message="Aucune proforma"
                    hint="Créez un devis pour un client."
                  />
                </td>
              </tr>
            ) : (
              proformas.data?.items.map((pf) => (
                <tr
                  key={pf.id}
                  className="clickable"
                  onClick={() => setViewing(pf.id)}
                >
                  <td className="mono">{pf.proforma_number}</td>
                  <td>{formatDate(pf.proforma_date)}</td>
                  <td>{pf.client_name}</td>
                  <td className="num">{formatFCFA(pf.total)}</td>
                  <td>
                    <span className={"pf-badge " + STATUS_CLASS[pf.status]}>
                      {STATUS_LABEL[pf.status]}
                      {pf.status === "convertie" &&
                        pf.converted_sale_number && (
                          <span
                            className="mono"
                            style={{ marginLeft: 4, opacity: 0.8 }}
                          >
                            → {pf.converted_sale_number}
                          </span>
                        )}
                    </span>
                  </td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-link"
                      onClick={() => setViewing(pf.id)}
                    >
                      Détails
                    </button>
                    <button
                      className="btn-link"
                      onClick={() =>
                        downloadWithAuth(
                          api.proformaPdfUrl(pf.id),
                          `proforma_${pf.proforma_number}.pdf`,
                        ).catch(() =>
                          toast.push("Téléchargement impossible.", "error"),
                        )
                      }
                    >
                      PDF
                    </button>
                    {pf.status === "en_cours" && (
                      <button
                        className="btn-link danger"
                        onClick={() => setDeleting(pf)}
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

      {proformas.data && proformas.data.total > 0 && (
        <Pagination
          page={proformas.data.page}
          pages={proformas.data.pages}
          total={proformas.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {creating && (
        <ProformaForm
          clients={clients.data?.items ?? []}
          onClose={() => setCreating(false)}
          onSaved={(num) => {
            setCreating(false);
            proformas.reload();
            toast.push(`Proforma ${num} créée.`, "success");
          }}
        />
      )}

      {viewing && (
        <ProformaDetail
          id={viewing}
          onClose={() => setViewing(null)}
          onChanged={() => proformas.reload()}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer la proforma"
          message={`Supprimer la proforma ${deleting.proforma_number} ?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

// ---------- Détail d'une proforma ----------
function ProformaDetail({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const pf = useAsync(() => api.getSalesProforma(id), [id]);
  const [converting, setConverting] = useState(false);
  const data = pf.data;

  return (
    <>
      <Modal
        title={data ? `Proforma ${data.proforma_number}` : "Proforma"}
        onClose={onClose}
        wide
        footer={
          <>
            {data && (
              <button
                className="btn"
                onClick={() =>
                  downloadWithAuth(
                    api.proformaPdfUrl(data.id),
                    `proforma_${data.proforma_number}.pdf`,
                  ).catch(() =>
                    toast.push("Téléchargement impossible.", "error"),
                  )
                }
              >
                Télécharger le PDF
              </button>
            )}
            {data && data.status === "en_cours" && (
              <button
                className="btn btn-primary"
                onClick={() => setConverting(true)}
              >
                Convertir en vente
              </button>
            )}
            <button className="btn" onClick={onClose}>
              Fermer
            </button>
          </>
        }
      >
        {pf.loading && <Loading />}
        {pf.error && <ErrorBox message={pf.error} />}
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
              <Field label="Date" value={formatDate(data.proforma_date)} />
              <Field label="Total" value={formatFCFA(data.total)} />
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
                  className={"pf-badge " + STATUS_CLASS[data.status]}
                  style={{ marginTop: 2 }}
                >
                  {STATUS_LABEL[data.status]}
                </span>
              </div>
            </div>

            {data.status === "convertie" && data.converted_sale_number && (
              <div
                className="warn-banner"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--text)",
                }}
              >
                Cette proforma a été convertie en vente{" "}
                <span className="mono" style={{ fontWeight: 600 }}>
                  {data.converted_sale_number}
                </span>
                .
              </div>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Désignation</th>
                    <th className="num" style={{ width: 100 }}>
                      Qté
                    </th>
                    <th className="num">Prix unitaire</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.designation}</td>
                      <td className="num">
                        {formatQtyUnit(it.quantity, it.unit)}
                      </td>
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
          </>
        )}
      </Modal>

      {converting && data && (
        <ConvertForm
          proforma={data}
          onClose={() => setConverting(false)}
          onConverted={(saleNum) => {
            setConverting(false);
            pf.reload();
            onChanged();
            toast.push(`Vente ${saleNum} créée depuis la proforma.`, "success");
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

// ---------- Conversion en vente (saisie des prix d'achat) ----------
function ConvertForm({
  proforma,
  onClose,
  onConverted,
}: {
  proforma: SalesProforma;
  onClose: () => void;
  onConverted: (saleNumber: string) => void;
}) {
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [purchases, setPurchases] = useState<Record<string, string>>(() =>
    Object.fromEntries(proforma.items.map((it) => [it.id, ""])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    let sale = 0,
      purchase = 0;
    for (const it of proforma.items) {
      const q = it.quantity;
      sale += Number(it.sale_price) * q;
      purchase += (Number(purchases[it.id]) || 0) * q;
    }
    return { sale, purchase, margin: sale - purchase };
  }, [proforma.items, purchases]);

  async function submit() {
    setError(null);
    for (const it of proforma.items) {
      const p = purchases[it.id];
      if (p.trim() === "" || Number(p) < 0 || Number.isNaN(Number(p))) {
        setError(
          `Saisissez un prix d'achat valide pour « ${it.designation} ».`,
        );
        return;
      }
    }
    const items: ProformaConvertItemInput[] = proforma.items.map((it) => ({
      proforma_item_id: it.id,
      purchase_price: String(Number(purchases[it.id])),
    }));

    setBusy(true);
    try {
      const sale = await api.convertSalesProforma(proforma.id, {
        sale_date: saleDate,
        items,
      });
      onConverted(sale.converted_sale_number ?? "");
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Conversion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Convertir ${proforma.proforma_number} en vente`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Conversion…" : "Créer la vente"}
          </button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        Saisissez le prix d'achat de chaque ligne (ce que vous payez au
        grossiste). Les prix de vente proviennent de la proforma. La marge se
        calcule automatiquement.
      </p>

      <div className="field" style={{ maxWidth: 200, marginBottom: 12 }}>
        <label>
          Date de la vente <span className="required">*</span>
        </label>
        <input
          className="input"
          type="date"
          value={saleDate}
          onChange={(e) => setSaleDate(e.target.value)}
        />
      </div>

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="lines-table">
          <thead>
            <tr>
              <th>Désignation</th>
              <th className="num" style={{ width: 60 }}>
                Qté
              </th>
              <th className="num" style={{ width: 120 }}>
                Prix vente
              </th>
              <th className="num" style={{ width: 130 }}>
                Prix achat
              </th>
              <th className="num" style={{ width: 110 }}>
                Marge ligne
              </th>
            </tr>
          </thead>
          <tbody>
            {proforma.items.map((it) => {
              const q = it.quantity;
              const pa = Number(purchases[it.id]) || 0;
              const pv = Number(it.sale_price);
              const lineMargin = q * (pv - pa);
              return (
                <tr key={it.id}>
                  <td>{it.designation}</td>
                  <td className="num">{formatQtyUnit(it.quantity, it.unit)}</td>
                  <td className="num">{formatFCFA(it.sale_price)}</td>
                  <td>
                    <input
                      className="input num"
                      type="number"
                      min={0}
                      value={purchases[it.id]}
                      onChange={(e) =>
                        setPurchases((p) => ({ ...p, [it.id]: e.target.value }))
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
                    {purchases[it.id].trim() ? formatFCFA(lineMargin) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="row-flex"
        style={{ justifyContent: "flex-end", gap: 20, fontSize: 13 }}
      >
        <div>
          Total vente : <strong>{formatFCFA(totals.sale)}</strong>
        </div>
        <div>
          Achat : <span className="muted">{formatFCFA(totals.purchase)}</span>
        </div>
        <div>
          Marge :{" "}
          <strong style={{ color: "var(--success)" }}>
            {formatFCFA(totals.margin)}
          </strong>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Formulaire de création de proforma ----------
type PfLine = {
  key: number;
  product_id: string | null;
  designation: string;
  quantity: string;
  unit: string;
  sale_price: string;
};
let pfLineCounter = 0;
const newPfLine = (): PfLine => ({
  key: ++pfLineCounter,
  product_id: null,
  designation: "",
  quantity: "1",
  unit: DEFAULT_UNIT,
  sale_price: "",
});

function ProformaForm({
  clients,
  onClose,
  onSaved,
}: {
  clients: SalesClient[];
  onClose: () => void;
  onSaved: (num: string) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [pfDate, setPfDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PfLine[]>([newPfLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = useAsync(() => api.listSalesProducts({ limit: 1000 }), []);

  function updateLine(key: number, patch: Partial<PfLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const total = useMemo(
    () =>
      lines.reduce(
        (s, l) => s + (Number(l.quantity) || 0) * (Number(l.sale_price) || 0),
        0,
      ),
    [lines],
  );

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
      if (l.sale_price.trim() === "" || Number(l.sale_price) < 0) {
        setError(`Prix de vente obligatoire (≥ 0) pour « ${l.designation} ».`);
        return;
      }
    }

    const items: ProformaItemInput[] = filled.map((l) => ({
      product_id: l.product_id,
      designation: l.designation.trim(),
      quantity: Number(l.quantity),
      unit: l.unit,
      sale_price: String(Number(l.sale_price)),
    }));

    setBusy(true);
    try {
      const created = await api.createSalesProforma({
        client_id: clientId,
        proforma_date: pfDate,
        notes: notes.trim() || null,
        items,
      });
      onSaved(created.proforma_number);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nouvelle proforma"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Création…" : "Créer la proforma"}
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
            value={pfDate}
            onChange={(e) => setPfDate(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="lines-table">
          <thead>
            <tr>
              <th style={{ minWidth: 240 }}>Produit / désignation</th>
              <th className="num" style={{ width: 70 }}>
                Qté
              </th>
              <th style={{ width: 100 }}>Unité</th>
              <th className="num" style={{ width: 130 }}>
                Prix vente
              </th>
              <th className="num" style={{ width: 110 }}>
                Total
              </th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const lineTotal =
                (Number(l.quantity) || 0) * (Number(l.sale_price) || 0);
              return (
                <tr key={l.key}>
                  <td>
                    <ProductCombobox
                      products={products.data?.items ?? []}
                      designation={l.designation}
                      onChangeText={(text) =>
                        updateLine(l.key, {
                          designation: text,
                          product_id: null,
                        })
                      }
                      onPickProduct={(p) =>
                        updateLine(l.key, {
                          product_id: p.id,
                          designation: p.designation,
                          unit: p.default_unit || DEFAULT_UNIT,
                          sale_price:
                            p.default_sale_price != null
                              ? String(p.default_sale_price)
                              : "",
                        })
                      }
                      placeholder="Produit ou désignation libre…"
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
                      value={l.sale_price}
                      onChange={(e) =>
                        updateLine(l.key, { sale_price: e.target.value })
                      }
                      placeholder="obligatoire"
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
          onClick={() => setLines((ls) => [...ls, newPfLine()])}
        >
          + Ajouter une ligne
        </button>
        <div style={{ fontWeight: 600 }}>
          Total :{" "}
          <span style={{ color: "var(--accent)" }}>{formatFCFA(total)}</span>
        </div>
      </div>

      <div className="field">
        <label>Notes</label>
        <textarea
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Conditions, validité du devis… (facultatif)"
        />
      </div>
    </Modal>
  );
}
