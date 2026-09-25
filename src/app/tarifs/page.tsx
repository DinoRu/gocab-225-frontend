"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatFCFA } from "@/lib/format";
import type { TariffArticle, TariffArticleInput } from "@/lib/types";
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

export default function TariffArticlesPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<TariffArticle | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TariffArticle | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const articles = useAsync(
    () =>
      api.listTariffArticles({
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
      await api.deleteTariffArticle(deleting.id);
      toast.push(`Article ${deleting.designation} supprimé.`, "success");
      setDeleting(null);
      articles.reload();
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
          <h1>Articles</h1>
          <div className="sub">
            Les pièces dont vous suivez les prix fournisseurs
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouvel article
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

      {articles.error && <ErrorBox message={articles.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th className="num">Fournisseurs</th>
              <th className="num">Meilleur prix</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.loading && !articles.data ? (
              <tr>
                <td colSpan={5}>
                  <Loading />
                </td>
              </tr>
            ) : articles.data && articles.data.items.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    message="Aucun article"
                    hint="Ajoutez les pièces dont vous suivez les prix."
                  />
                </td>
              </tr>
            ) : (
              articles.data?.items.map((a) => (
                <tr key={a.id}>
                  <td className="mono">
                    {a.reference || <span className="muted">—</span>}
                  </td>
                  <td style={{ fontWeight: 600 }}>{a.designation}</td>
                  <td className="num">
                    {a.supplier_count > 0 ? (
                      a.supplier_count
                    ) : (
                      <span className="muted">0</span>
                    )}
                  </td>
                  <td
                    className="num"
                    style={{
                      fontWeight: 600,
                      color: a.best_price ? "var(--success)" : undefined,
                    }}
                  >
                    {a.best_price ? (
                      formatFCFA(a.best_price)
                    ) : (
                      <span className="muted">— aucun prix</span>
                    )}
                  </td>
                  <td className="actions">
                    <Link
                      className="btn-link"
                      href={`/tarifs/par-article?article=${a.id}`}
                    >
                      Prix
                    </Link>
                    <button className="btn-link" onClick={() => setEditing(a)}>
                      Modifier
                    </button>
                    <button
                      className="btn-link danger"
                      onClick={() => setDeleting(a)}
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

      {articles.data && articles.data.total > 0 && (
        <Pagination
          page={articles.data.page}
          pages={articles.data.pages}
          total={articles.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {(creating || editing) && (
        <ArticleForm
          article={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            articles.reload();
            toast.push("Article enregistré.", "success");
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer l'article"
          message={`Supprimer ${deleting.designation} ? Tous ses prix enregistrés seront aussi supprimés.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

function ArticleForm({
  article,
  onClose,
  onSaved,
}: {
  article: TariffArticle | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reference, setReference] = useState(article?.reference ?? "");
  const [designation, setDesignation] = useState(article?.designation ?? "");
  const [notes, setNotes] = useState(article?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!designation.trim()) {
      setError("La désignation est obligatoire.");
      return;
    }
    const body: TariffArticleInput = {
      reference: reference.trim() || null,
      designation: designation.trim(),
      notes: notes.trim() || null,
    };
    setBusy(true);
    try {
      if (article) await api.updateTariffArticle(article.id, body);
      else await api.createTariffArticle(body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={article ? "Modifier l'article" : "Nouvel article"}
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
        style={{ gridTemplateColumns: "1fr 2fr", marginBottom: 12 }}
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
            placeholder="Ex : Compresseur Suzuki phase 1"
          />
        </div>
      </div>
      <div className="field">
        <label>Notes</label>
        <textarea
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}
