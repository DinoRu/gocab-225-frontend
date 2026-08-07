"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate } from "@/lib/format";
import type { VehicleBrand } from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Loading,
  Modal,
  useToast,
} from "@/components/ui";

export default function BrandsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VehicleBrand | null>(null);
  const [deleting, setDeleting] = useState<VehicleBrand | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const brands = useAsync(() => api.listBrands({ search: debounced || undefined }), [debounced]);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteBrand(deleting.id);
      toast.push(`Marque « ${deleting.name} » supprimée.`, "success");
      setDeleting(null);
      brands.reload();
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
          <h1>Marques</h1>
          <div className="sub">Marques de véhicules</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouvelle marque
        </button>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Recherche</label>
          <input
            className="input"
            placeholder="Nom de la marque…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 240 }}
          />
        </div>
      </div>

      {brands.error && <ErrorBox message={brands.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Créée le</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {brands.loading && !brands.data ? (
              <tr>
                <td colSpan={3}>
                  <Loading />
                </td>
              </tr>
            ) : brands.data && brands.data.items.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <EmptyState message="Aucune marque" hint="Créez votre première marque." />
                </td>
              </tr>
            ) : (
              brands.data?.items.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 500 }}>{b.name}</td>
                  <td className="muted">{formatDate(b.created_at)}</td>
                  <td className="actions">
                    <button className="btn-link" onClick={() => setEditing(b)}>
                      Modifier
                    </button>
                    <button className="btn-link danger" onClick={() => setDeleting(b)}>
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
        <BrandForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            brands.reload();
            toast.push("Marque créée.", "success");
          }}
        />
      )}
      {editing && (
        <BrandForm
          brand={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            brands.reload();
            toast.push("Marque mise à jour.", "success");
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Supprimer la marque"
          message={`Supprimer « ${deleting.name} » ? Impossible si des modèles y sont rattachés.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

function BrandForm({
  brand,
  onClose,
  onSaved,
}: {
  brand?: VehicleBrand;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!brand;
  const [name, setName] = useState(brand?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    setBusy(true);
    try {
      if (isEdit) await api.updateBrand(brand!.id, { name: name.trim() });
      else await api.createBrand({ name: name.trim() });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isEdit ? "Modifier la marque" : "Nouvelle marque"}
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
            Nom <span className="required">*</span>
          </label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bestune, Chery, Toyota…"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
      </div>
    </Modal>
  );
}
