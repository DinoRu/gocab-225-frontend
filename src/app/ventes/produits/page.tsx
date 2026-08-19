"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatFCFA } from "@/lib/format";
import type { SalesProduct, SalesProductInput } from "@/lib/types";
import { SALES_UNITS, DEFAULT_UNIT } from "@/lib/units";

import {
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Loading,
  Modal,
  Pagination,
  useToast,
} from "@/components/ui";

const LIMIT = 50;

export default function SalesProductsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<SalesProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SalesProduct | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const products = useAsync(
    () =>
      api.listSalesProducts({
        search: debounced || undefined,
        page,
        limit: LIMIT,
      }),
    [debounced, page],
  );

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteSalesProduct(deleting.id);
      toast.push(`Produit ${deleting.designation} supprimé.`, "success");
      setDeleting(null);
      products.reload();
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
          <h1>Produits</h1>
          <div className="sub">
            Catalogue des articles revendus, avec prix habituels
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouveau produit
        </button>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Recherche</label>
          <input
            className="input"
            placeholder="Référence ou désignation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {products.error && <ErrorBox message={products.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th className="num">Prix d'achat</th>
              <th className="num">Prix de vente</th>
              <th className="num">Marge unit.</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.loading && !products.data ? (
              <tr>
                <td colSpan={6}>
                  <Loading />
                </td>
              </tr>
            ) : products.data && products.data.items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    message="Aucun produit"
                    hint="Ajoutez les articles que vous revendez."
                  />
                </td>
              </tr>
            ) : (
              products.data?.items.map((p) => {
                const pa = p.default_purchase_price;
                const pv = p.default_sale_price;
                const margin =
                  pa != null && pv != null ? Number(pv) - Number(pa) : null;
                return (
                  <tr key={p.id}>
                    <td className="mono">
                      {p.reference || <span className="muted">—</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {p.designation}
                      {p.default_unit && (
                        <span
                          className="muted"
                          style={{ fontWeight: 400, fontSize: 11 }}
                        >
                          {" "}
                          / {p.default_unit}
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {pa != null ? (
                        formatFCFA(pa)
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="num">
                      {pv != null ? (
                        formatFCFA(pv)
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td
                      className="num"
                      style={{
                        color:
                          margin != null && margin > 0
                            ? "var(--success)"
                            : undefined,
                        fontWeight: 600,
                      }}
                    >
                      {margin != null ? (
                        formatFCFA(margin)
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="actions">
                      <button
                        className="btn-link"
                        onClick={() => setEditing(p)}
                      >
                        Modifier
                      </button>
                      <button
                        className="btn-link danger"
                        onClick={() => setDeleting(p)}
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

      {products.data && products.data.total > 0 && (
        <Pagination
          page={products.data.page}
          pages={products.data.pages}
          total={products.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {(creating || editing) && (
        <ProductForm
          product={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            products.reload();
            toast.push("Produit enregistré.", "success");
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer le produit"
          message={`Supprimer ${deleting.designation} du catalogue ? Les ventes passées gardent leur désignation.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

function ProductForm({
  product,
  onClose,
  onSaved,
}: {
  product: SalesProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reference, setReference] = useState(product?.reference ?? "");
  const [designation, setDesignation] = useState(product?.designation ?? "");
  const [purchase, setPurchase] = useState(
    product?.default_purchase_price ?? "",
  );
  const [sale, setSale] = useState(product?.default_sale_price ?? "");
  const [notes, setNotes] = useState(product?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState(product?.default_unit ?? DEFAULT_UNIT);

  // Marge prévisionnelle en direct
  const margin =
    purchase.trim() && sale.trim() ? Number(sale) - Number(purchase) : null;

  async function submit() {
    setError(null);
    if (!designation.trim()) {
      setError("La désignation est obligatoire.");
      return;
    }
    if (purchase.trim() && Number(purchase) < 0) {
      setError("Le prix d'achat ne peut pas être négatif.");
      return;
    }
    if (sale.trim() && Number(sale) < 0) {
      setError("Le prix de vente ne peut pas être négatif.");
      return;
    }
    const body: SalesProductInput = {
      reference: reference.trim() || null,
      designation: designation.trim(),
      default_purchase_price: purchase.trim() ? String(Number(purchase)) : null,
      default_sale_price: sale.trim() ? String(Number(sale)) : null,
      default_unit: unit, // ← ajoute
      notes: notes.trim() || null,
    };
    setBusy(true);
    try {
      if (product) await api.updateSalesProduct(product.id, body);
      else await api.createSalesProduct(body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={product ? "Modifier le produit" : "Nouveau produit"}
      onClose={onClose}
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

      <div
        className="form-grid"
        style={{ gridTemplateColumns: "1fr 2fr 1fr", marginBottom: 12 }}
      >
        <div className="field">
          <label>Référence</label>
          <input
            className="input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Facultatif"
          />
        </div>
        <div className="field">
          <label>
            Désignation <span className="required">*</span>
          </label>
          <input
            className="input"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label>Unité</label>
          <select
            className="select"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            {SALES_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className="form-grid"
        style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}
      >
        <div className="field">
          <label>Prix d'achat habituel (FCFA)</label>
          <input
            className="input num"
            type="number"
            min={0}
            value={purchase}
            onChange={(e) => setPurchase(e.target.value)}
            placeholder="—"
          />
        </div>
        <div className="field">
          <label>Prix de vente habituel (FCFA)</label>
          <input
            className="input num"
            type="number"
            min={0}
            value={sale}
            onChange={(e) => setSale(e.target.value)}
            placeholder="—"
          />
        </div>
      </div>

      {margin != null && (
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          Marge prévisionnelle :{" "}
          <span
            style={{
              fontWeight: 700,
              color: margin > 0 ? "var(--success)" : "var(--danger)",
            }}
          >
            {formatFCFA(margin)}
          </span>
          <span className="muted"> par unité</span>
        </div>
      )}

      <div className="field">
        <label>Notes</label>
        <textarea
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Ces prix sont des valeurs par défaut, pré-remplies lors d'une vente et
        ajustables à chaque fois.
      </p>
    </Modal>
  );
}
