"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type { PartDetail, VehicleModel } from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Loading,
  Modal,
  Pagination,
  useToast,
} from "@/components/ui";
import { BulkPartsModal } from "@/components/BulkPartsModal";

const LIMIT = 20;

export default function PartsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<PartDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<PartDetail | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Import en lot
  const [bulkOpen, setBulkOpen] = useState(false);

  // Sélection multiple pour suppression en lot
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteAsk, setBulkDeleteAsk] = useState(false);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);

  // Debounce de la recherche
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const brands = useAsync(() => api.listBrands(), []);
  const filterModels = useAsync(
    () => (brandId ? api.brandModels(brandId) : Promise.resolve([])),
    [brandId]
  );

  const parts = useAsync(
    () =>
      api.listParts({
        search: debounced || undefined,
        brand_id: brandId || undefined,
        vehicle_model_id: modelId || undefined,
        page,
        limit: LIMIT,
      }),
    [debounced, brandId, modelId, page]
  );

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deletePart(deleting.id);
      toast.push(`Pièce « ${deleting.reference} » supprimée.`, "success");
      setDeleting(null);
      parts.reload();
    } catch (e) {
      toast.push(e instanceof ApiError ? e.detail : "Suppression impossible.", "error");
    } finally {
      setDeleteBusy(false);
    }
  }

  // La sélection ne porte que sur la page courante : on la vide à chaque
  // changement de filtre ou de page pour éviter de supprimer des lignes non visibles.
  useEffect(() => {
    setSelected(new Set());
  }, [debounced, brandId, modelId, page]);

  const pageIds = useMemo(
    () => (parts.data?.items ?? []).map((p) => p.id),
    [parts.data]
  );
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (pageIds.every((id) => prev.has(id))) return new Set();
      return new Set(pageIds);
    });
  }

  async function runBulkDelete(atomic: boolean) {
    setBulkDeleteBusy(true);
    try {
      const res = await api.bulkDeleteParts(atomic, Array.from(selected));
      const { succeeded, failed, committed } = res.summary;
      if (failed === 0) {
        toast.push(`${succeeded} pièce(s) supprimée(s).`, "success");
      } else if (!committed) {
        // atomique échoué : rien supprimé
        const first = res.failed[0]?.error.message ?? "";
        toast.push(`Suppression annulée : ${failed} en conflit. ${first}`, "error");
      } else {
        toast.push(`${succeeded} supprimée(s), ${failed} en échec (référencées ailleurs).`, "error");
      }
      setBulkDeleteAsk(false);
      setSelected(new Set());
      parts.reload();
    } catch (e) {
      toast.push(e instanceof ApiError ? e.detail : "Suppression impossible.", "error");
      setBulkDeleteAsk(false);
    } finally {
      setBulkDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pièces détachées</h1>
          <div className="sub">Catalogue des références par marque et modèle</div>
        </div>
        <div className="row-flex">
          <button className="btn" onClick={() => setBulkOpen(true)}>
            Import en lot
          </button>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Nouvelle pièce
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Recherche</label>
          <input
            className="input"
            placeholder="Référence ou désignation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 220 }}
          />
        </div>
        <div className="field">
          <label>Marque</label>
          <select
            className="select"
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value);
              setModelId("");
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
        <div className="field">
          <label>Modèle</label>
          <select
            className="select"
            value={modelId}
            onChange={(e) => {
              setModelId(e.target.value);
              setPage(1);
            }}
            disabled={!brandId}
          >
            <option value="">Tous</option>
            {filterModels.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {parts.error && <ErrorBox message={parts.error} />}

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="count">{selected.size} sélectionnée(s)</span>
          <button className="btn btn-sm btn-danger" onClick={() => setBulkDeleteAsk(true)}>
            Supprimer la sélection
          </button>
          <button className="btn btn-sm" onClick={() => setSelected(new Set())}>
            Tout désélectionner
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="select-cell">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Tout sélectionner"
                />
              </th>
              <th style={{ width: 160 }}>Référence</th>
              <th>Désignation</th>
              <th>Modèles compatibles</th>
              <th>Catégorie</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {parts.loading && !parts.data ? (
              <tr>
                <td colSpan={6}>
                  <Loading />
                </td>
              </tr>
            ) : parts.data && parts.data.items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    message="Aucune pièce trouvée"
                    hint="Ajustez les filtres ou créez une nouvelle pièce."
                  />
                </td>
              </tr>
            ) : (
              parts.data?.items.map((p) => (
                <tr
                  key={p.id}
                  style={selected.has(p.id) ? { background: "var(--accent-soft)" } : undefined}
                >
                  <td className="select-cell">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleOne(p.id)}
                      aria-label={`Sélectionner ${p.reference}`}
                    />
                  </td>
                  <td className="mono">
                    <Link href={`/pieces/${p.id}`} style={{ color: "var(--accent)" }}>
                      {p.reference}
                    </Link>
                  </td>
                  <td>{p.designation}</td>
                  <td>
                    {p.is_universal ? (
                      <span className="badge accent">Universel</span>
                    ) : (
                      <span>
                        {p.vehicle_models
                          .map((m) => `${m.brand_name} ${m.name}`)
                          .join(", ")}
                      </span>
                    )}
                  </td>
                  <td>{p.category || <span className="muted">—</span>}</td>
                  <td className="actions">
                    <button className="btn-link" onClick={() => setEditing(p)}>
                      Modifier
                    </button>
                    <button className="btn-link danger" onClick={() => setDeleting(p)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {parts.data && parts.data.total > 0 && (
        <Pagination
          page={parts.data.page}
          pages={parts.data.pages}
          total={parts.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {creating && (
        <PartForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            parts.reload();
            toast.push("Pièce créée.", "success");
          }}
        />
      )}

      {editing && (
        <PartForm
          part={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            parts.reload();
            toast.push("Pièce mise à jour.", "success");
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer la pièce"
          message={`Supprimer « ${deleting.reference} — ${deleting.designation} » ? Cette action est définitive.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}

      {bulkOpen && (
        <BulkPartsModal
          onClose={() => setBulkOpen(false)}
          onDone={(created) => {
            setBulkOpen(false);
            if (created > 0) parts.reload();
          }}
        />
      )}

      {bulkDeleteAsk && (
        <BulkDeleteChoice
          count={selected.size}
          busy={bulkDeleteBusy}
          onCancel={() => setBulkDeleteAsk(false)}
          onChoose={runBulkDelete}
        />
      )}
    </>
  );
}

// ---------- Choix de mode pour la suppression en lot ----------
function BulkDeleteChoice({
  count,
  busy,
  onCancel,
  onChoose,
}: {
  count: number;
  busy: boolean;
  onCancel: () => void;
  onChoose: (atomic: boolean) => void;
}) {
  return (
    <Modal
      title={`Supprimer ${count} pièce(s)`}
      onClose={onCancel}
      footer={
        <button className="btn" onClick={onCancel} disabled={busy}>
          Retour
        </button>
      }
    >
      <p className="muted" style={{ marginTop: 0 }}>
        Certaines pièces peuvent être référencées dans des commandes et refuser d'être
        supprimées. Choisissez le comportement.
      </p>
      <div className="mode-cards">
        <button className="mode-card" onClick={() => onChoose(true)} disabled={busy}>
          <div className="mode-card-title">Tout ou rien</div>
          <div className="mode-card-desc">
            Si une seule pièce refuse d'être supprimée, aucune n'est supprimée.
          </div>
        </button>
        <button className="mode-card" onClick={() => onChoose(false)} disabled={busy}>
          <div className="mode-card-title">Supprimer ce qui est possible</div>
          <div className="mode-card-desc">
            Supprime les pièces libres, conserve celles utilisées dans des commandes.
          </div>
        </button>
      </div>
      {busy && <p className="muted">Suppression en cours…</p>}
    </Modal>
  );
}

// ---------- Formulaire pièce (many-to-many) ----------
function PartForm({
  part,
  onClose,
  onSaved,
}: {
  part?: PartDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!part;
  const [reference, setReference] = useState(part?.reference ?? "");
  const [designation, setDesignation] = useState(part?.designation ?? "");
  const [category, setCategory] = useState(part?.category ?? "");
  const [universal, setUniversal] = useState(part ? part.is_universal : false);
  // Modèles compatibles sélectionnés (ids).
  const [selectedModels, setSelectedModels] = useState<Set<string>>(
    () => new Set(part?.vehicle_models.map((m) => m.id) ?? [])
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtre marque pour n'afficher que les modèles d'une marque à la fois.
  const [brandFilter, setBrandFilter] = useState("");
  const brands = useAsync(() => api.listBrands(), []);
  const models = useAsync(
    () => (brandFilter ? api.brandModels(brandFilter) : Promise.resolve<VehicleModel[]>([])),
    [brandFilter]
  );

  // Pour afficher les puces des modèles déjà sélectionnés, on garde leur libellé.
  const [labels, setLabels] = useState<Map<string, string>>(
    () =>
      new Map(
        (part?.vehicle_models ?? []).map((m) => [m.id, `${m.brand_name} ${m.name}`])
      )
  );

  function toggleModel(id: string, label: string) {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLabels((prev) => {
      const next = new Map(prev);
      next.set(id, label);
      return next;
    });
  }

  function removeModel(id: string) {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (!reference.trim() || !designation.trim()) {
      setError("Référence et désignation sont obligatoires.");
      return;
    }
    if (!universal && selectedModels.size === 0) {
      setError(
        "Sélectionnez au moins un modèle compatible, ou cochez « Pièce universelle »."
      );
      return;
    }
    const ids = universal ? [] : Array.from(selectedModels);
    setBusy(true);
    try {
      const body = {
        reference: reference.trim(),
        designation: designation.trim(),
        vehicle_model_ids: ids,
        category: category.trim() || null,
      };
      if (isEdit) await api.updatePart(part!.id, body);
      else await api.createPart(body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isEdit ? "Modifier la pièce" : "Nouvelle pièce"}
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
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="field">
          <label>
            Référence <span className="required">*</span>
          </label>
          <input
            className="input mono"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="5206050BF01A"
            autoFocus
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
            placeholder="Pare-brise"
          />
        </div>
        <div className="field">
          <label>Catégorie</label>
          <input
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Filtration, Freinage… (facultatif)"
          />
        </div>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <label className="row-flex" style={{ gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={universal}
              onChange={(e) => setUniversal(e.target.checked)}
            />
            Pièce universelle (aucun modèle)
          </label>
        </div>
      </div>

      {!universal && (
        <div className="mt-16">
          <label className="field" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              Modèles compatibles <span className="required">*</span>
            </span>
          </label>

          {/* Puces des modèles sélectionnés */}
          {selectedModels.size > 0 && (
            <div className="chips mt-8">
              {Array.from(selectedModels).map((id) => (
                <span key={id} className="chip">
                  {labels.get(id) ?? "…"}
                  <button
                    type="button"
                    className="chip-x"
                    onClick={() => removeModel(id)}
                    aria-label="Retirer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Sélecteur : marque puis cases à cocher des modèles */}
          <div className="row-flex mt-8" style={{ alignItems: "flex-start", gap: 12 }}>
            <div className="field" style={{ minWidth: 180 }}>
              <label>Marque</label>
              <select
                className="select"
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
              >
                <option value="">Choisir une marque…</option>
                {brands.data?.items.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label className="field">
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
                  Modèles de la marque
                </span>
              </label>
              {!brandFilter ? (
                <div className="muted" style={{ fontSize: 12, padding: "6px 0" }}>
                  Sélectionnez une marque pour voir ses modèles.
                </div>
              ) : (models.data ?? []).length === 0 ? (
                <div className="muted" style={{ fontSize: 12, padding: "6px 0" }}>
                  Aucun modèle pour cette marque.
                </div>
              ) : (
                <div className="checkbox-grid">
                  {models.data!.map((m) => {
                    const brandName =
                      brands.data?.items.find((b) => b.id === brandFilter)?.name ?? "";
                    const label = `${brandName} ${m.name}`;
                    return (
                      <label key={m.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedModels.has(m.id)}
                          onChange={() => toggleModel(m.id, label)}
                        />
                        {m.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
