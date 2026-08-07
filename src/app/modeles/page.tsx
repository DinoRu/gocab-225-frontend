"use client";

import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type { VehicleBrand, VehicleModel } from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Loading,
  Modal,
  useToast,
} from "@/components/ui";

export default function ModelsPage() {
  const toast = useToast();
  const [brandFilter, setBrandFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VehicleModel | null>(null);
  const [deleting, setDeleting] = useState<VehicleModel | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const brands = useAsync(() => api.listBrands(), []);
  const models = useAsync(
    () => api.listModels({ brand_id: brandFilter || undefined }),
    [brandFilter]
  );

  const brandName = useMemo(() => {
    const map = new Map<string, string>();
    brands.data?.items.forEach((b) => map.set(b.id, b.name));
    return map;
  }, [brands.data]);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteModel(deleting.id);
      toast.push(`Modèle « ${deleting.name} » supprimé.`, "success");
      setDeleting(null);
      models.reload();
    } catch (e) {
      toast.push(e instanceof ApiError ? e.detail : "Suppression impossible.", "error");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Modèles</h1>
          <div className="sub">Modèles de véhicules par marque</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouveau modèle
        </button>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Marque</label>
          <select
            className="select"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            <option value="">Toutes les marques</option>
            {brands.data?.items.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {models.error && <ErrorBox message={models.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Modèle</th>
              <th>Marque</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {models.loading && !models.data ? (
              <tr>
                <td colSpan={3}>
                  <Loading />
                </td>
              </tr>
            ) : models.data && models.data.items.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <EmptyState
                    message="Aucun modèle"
                    hint="Créez un modèle et rattachez-le à une marque."
                  />
                </td>
              </tr>
            ) : (
              models.data?.items.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 500 }}>{m.name}</td>
                  <td>{brandName.get(m.brand_id) || <span className="muted">—</span>}</td>
                  <td className="actions">
                    <button className="btn-link" onClick={() => setEditing(m)}>
                      Modifier
                    </button>
                    <button className="btn-link danger" onClick={() => setDeleting(m)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <ModelForm
          brands={brands.data?.items ?? []}
          defaultBrandId={brandFilter}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            models.reload();
            toast.push("Modèle créé.", "success");
          }}
        />
      )}
      {editing && (
        <ModelForm
          model={editing}
          brands={brands.data?.items ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            models.reload();
            toast.push("Modèle mis à jour.", "success");
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Supprimer le modèle"
          message={`Supprimer « ${deleting.name} » ? Impossible si des pièces y sont rattachées.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

function ModelForm({
  model,
  brands,
  defaultBrandId,
  onClose,
  onSaved,
}: {
  model?: VehicleModel;
  brands: VehicleBrand[];
  defaultBrandId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!model;
  const [brandId, setBrandId] = useState(model?.brand_id ?? defaultBrandId ?? "");
  const [name, setName] = useState(model?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim() || (!isEdit && !brandId)) {
      setError("La marque et le nom sont obligatoires.");
      return;
    }
    setBusy(true);
    try {
      if (isEdit) {
        // Le rattachement à la marque est immuable côté API : on ne modifie que le nom.
        await api.updateModel(model!.id, { name: name.trim() });
      } else {
        await api.createModel({ brand_id: brandId, name: name.trim() });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isEdit ? "Modifier le modèle" : "Nouveau modèle"}
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
      <div className="form-grid">
        <div className="field">
          <label>
            Marque <span className="required">*</span>
          </label>
          <select
            className="select"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            disabled={isEdit}
          >
            <option value="">Choisir une marque…</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {isEdit && (
            <span className="muted" style={{ fontSize: 11 }}>
              La marque d'un modèle ne peut pas être changée.
            </span>
          )}
        </div>
        <div className="field">
          <label>
            Nom du modèle <span className="required">*</span>
          </label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="T55, Tiggo 2, B70…"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
      </div>
    </Modal>
  );
}
