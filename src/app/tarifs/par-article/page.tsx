"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatFCFA, formatDate } from "@/lib/format";
import type {
  TariffArticle,
  TariffSupplier,
  ArticlePricesView,
  SupplierPriceRow,
  TariffPriceInput,
} from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Loading,
  Modal,
  useToast,
} from "@/components/ui";

export default function ParArticlePage() {
  const params = useSearchParams();
  const initialArticle = params.get("article") || "";

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [articleId, setArticleId] = useState(initialArticle);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Liste d'articles pour le sélecteur/recherche
  const articles = useAsync(
    () => api.listTariffArticles({ search: debounced || undefined, limit: 50 }),
    [debounced],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Prix par article</h1>
          <div className="sub">Comparez les fournisseurs pour un article</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="field" style={{ minWidth: 280 }}>
          <label>Rechercher un article</label>
          <input
            className="input"
            placeholder="Référence ou désignation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Résultats de recherche (si pas d'article sélectionné ou recherche active) */}
      {articles.data && articles.data.items.length > 0 && (
        <div className="tariff-article-picker">
          {articles.data.items.map((a: TariffArticle) => (
            <button
              key={a.id}
              className={"tariff-pick" + (a.id === articleId ? " active" : "")}
              onClick={() => setArticleId(a.id)}
            >
              <span className="tariff-pick-name">{a.designation}</span>
              {a.reference && (
                <span className="tariff-pick-ref">{a.reference}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {articleId ? (
        <ArticlePrices articleId={articleId} />
      ) : (
        <EmptyState
          message="Choisissez un article"
          hint="Recherchez et sélectionnez un article pour voir ses prix."
        />
      )}
    </>
  );
}

function ArticlePrices({ articleId }: { articleId: string }) {
  const toast = useToast();
  const view = useAsync(() => api.articlePrices(articleId), [articleId]);
  const [adding, setAdding] = useState(false);
  const data = view.data;

  return (
    <>
      {view.loading && <Loading />}
      {view.error && <ErrorBox message={view.error} />}
      {data && (
        <div className="tariff-article-panel">
          <div className="tariff-article-head">
            <div>
              <div className="tariff-article-title">{data.designation}</div>
              {data.reference && (
                <div className="muted mono" style={{ fontSize: 12 }}>
                  {data.reference}
                </div>
              )}
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setAdding(true)}
            >
              + Enregistrer un prix
            </button>
          </div>

          {data.suppliers.length === 0 ? (
            <EmptyState
              message="Aucun prix"
              hint="Enregistrez le premier prix d'un fournisseur pour cet article."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fournisseur</th>
                    <th className="num">Dernier prix</th>
                    <th>Mis à jour</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.suppliers.map((s, idx) => (
                    <SupplierRow
                      key={s.supplier_id}
                      row={s}
                      cheapest={idx === 0}
                      onDeleted={() => {
                        view.reload();
                        toast.push("Prix supprimé.", "success");
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {adding && data && (
        <AddPriceForm
          articleId={articleId}
          articleName={data.designation}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            view.reload();
            toast.push("Prix enregistré.", "success");
          }}
        />
      )}
    </>
  );
}

function SupplierRow({
  row,
  cheapest,
  onDeleted,
}: {
  row: SupplierPriceRow;
  cheapest: boolean;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deletingId) return;
    setBusy(true);
    try {
      await api.deleteTariffPrice(deletingId);
      setDeletingId(null);
      onDeleted();
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Suppression impossible.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr className={cheapest ? "tariff-cheapest" : undefined}>
        <td style={{ fontWeight: 600 }}>
          {row.supplier_name}
          {cheapest && <span className="tariff-badge-cheap">MOINS CHER</span>}
        </td>
        <td
          className="num"
          style={{
            fontWeight: 700,
            color: cheapest ? "var(--success)" : undefined,
          }}
        >
          {formatFCFA(row.last_price)}
        </td>
        <td>{formatDate(row.last_date)}</td>
        <td className="num">
          <button className="btn-link" onClick={() => setOpen((v) => !v)}>
            {open ? "▾ historique" : "▸ historique"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="tariff-history-row">
          <td colSpan={4}>
            <div className="tariff-history">
              {row.history.map((h) => (
                <div key={h.id} className="tariff-history-line">
                  <span>{formatDate(h.effective_date)}</span>
                  <span style={{ fontWeight: 600 }}>{formatFCFA(h.price)}</span>
                  {h.notes && <span className="muted">— {h.notes}</span>}
                  <button
                    className="btn-link danger"
                    style={{ fontSize: 11 }}
                    onClick={() => setDeletingId(h.id)}
                  >
                    supprimer
                  </button>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
      {deletingId && (
        <ConfirmDialog
          title="Supprimer ce prix"
          message="Supprimer cette ligne de prix de l'historique ? (à faire seulement pour une erreur de saisie)"
          onConfirm={confirmDelete}
          onCancel={() => setDeletingId(null)}
          busy={busy}
        />
      )}
    </>
  );
}

function AddPriceForm({
  articleId,
  articleName,
  onClose,
  onSaved,
}: {
  articleId: string;
  articleName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const suppliers = useAsync(() => api.listTariffSuppliers({ limit: 500 }), []);
  const [supplierId, setSupplierId] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!supplierId) {
      setError("Choisissez un fournisseur.");
      return;
    }
    if (price.trim() === "" || Number(price) < 0) {
      setError("Prix invalide.");
      return;
    }
    const body: TariffPriceInput = {
      article_id: articleId,
      supplier_id: supplierId,
      price: String(Number(price)),
      effective_date: date,
      notes: notes.trim() || null,
    };
    setBusy(true);
    try {
      await api.createTariffPrice(body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Enregistrer un prix — ${articleName}`}
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
      <div className="field" style={{ marginBottom: 12 }}>
        <label>
          Fournisseur <span className="required">*</span>
        </label>
        <select
          className="select"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        >
          <option value="">Choisir…</option>
          {suppliers.data?.items.map((s: TariffSupplier) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div
        className="form-grid"
        style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}
      >
        <div className="field">
          <label>
            Prix (FCFA) <span className="required">*</span>
          </label>
          <input
            className="input num"
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="field">
          <label>
            Date d'effet <span className="required">*</span>
          </label>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label>Note</label>
        <input
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex : promo, quantité minimale…"
        />
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Un nouveau prix s'ajoute à l'historique sans effacer les précédents. Le
        plus récent devient le « dernier prix ».
      </p>
    </Modal>
  );
}
