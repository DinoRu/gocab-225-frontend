"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type { TariffBrand, TariffModel } from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Loading,
  useToast,
} from "@/components/ui";
import { TagInput } from "@/components/TagInput";

export default function TariffVehiclesPage() {
  const toast = useToast();
  const [brandId, setBrandId] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newBrandModels, setNewBrandModels] = useState<string[]>([]);
  const [newModels, setNewModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [deletingBrand, setDeletingBrand] = useState<TariffBrand | null>(null);
  const [deletingModel, setDeletingModel] = useState<TariffModel | null>(null);

  const brands = useAsync(() => api.listTariffBrands(), []);
  const models = useAsync(
    () => (brandId ? api.listTariffModels(brandId) : Promise.resolve([])),
    [brandId],
  );

  async function addBrand() {
    if (!newBrand.trim()) return;
    setBusy(true);
    try {
      const b = await api.createTariffBrand(newBrand.trim());
      if (newBrandModels.length > 0) {
        await api.createTariffModelsBulk(b.id, newBrandModels);
      }
      setNewBrand("");
      setNewBrandModels([]);
      brands.reload();
      setBrandId(b.id);
      models.reload();
      toast.push(
        `Marque ajoutée${newBrandModels.length ? " avec ses modèles" : ""}.`,
        "success",
      );
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Ajout impossible.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addModels() {
    if (!brandId || newModels.length === 0) return;
    setBusy(true);
    try {
      await api.createTariffModelsBulk(brandId, newModels);
      setNewModels([]);
      models.reload();
      toast.push("Modèles ajoutés.", "success");
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Ajout impossible.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteBrand() {
    if (!deletingBrand) return;
    try {
      await api.deleteTariffBrand(deletingBrand.id);
      if (brandId === deletingBrand.id) setBrandId("");
      setDeletingBrand(null);
      brands.reload();
      toast.push("Marque supprimée.", "success");
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Suppression impossible.",
        "error",
      );
    }
  }

  async function confirmDeleteModel() {
    if (!deletingModel) return;
    try {
      await api.deleteTariffModel(deletingModel.id);
      setDeletingModel(null);
      models.reload();
      toast.push("Modèle supprimé.", "success");
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Suppression impossible.",
        "error",
      );
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Marques &amp; modèles</h1>
          <div className="sub">
            Les véhicules auxquels vos articles se rattachent
          </div>
        </div>
      </div>

      <div className="tariff-supplier-layout">
        {/* Colonne gauche : marques + création */}
        <div className="tariff-supplier-list">
          <div style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11 }}>Nouvelle marque</label>
              <input
                className="input"
                placeholder="Ex : Suzuki"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11 }}>Modèles (optionnel)</label>
              <TagInput
                tags={newBrandModels}
                onChange={setNewBrandModels}
                placeholder="Dzire, Spresso… + Entrée"
              />
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={addBrand}
              disabled={busy}
              style={{ width: "100%" }}
            >
              Créer la marque
            </button>
          </div>

          {brands.loading && <Loading />}
          {brands.error && <ErrorBox message={brands.error} />}
          {brands.data?.map((b) => (
            <div
              key={b.id}
              className={
                "tariff-brand-item" + (b.id === brandId ? " active" : "")
              }
            >
              <button
                className="tariff-brand-btn"
                onClick={() => setBrandId(b.id)}
              >
                {b.name}
              </button>
              <button
                className="btn-link danger"
                style={{ fontSize: 11 }}
                onClick={() => setDeletingBrand(b)}
              >
                ✕
              </button>
            </div>
          ))}
          {brands.data && brands.data.length === 0 && (
            <p className="muted" style={{ fontSize: 12, padding: 12 }}>
              Aucune marque.
            </p>
          )}
        </div>

        {/* Colonne droite : modèles de la marque sélectionnée */}
        <div className="tariff-supplier-detail">
          {!brandId ? (
            <EmptyState
              message="Choisissez une marque"
              hint="Sélectionnez une marque pour gérer ses modèles."
            />
          ) : (
            <>
              <div className="tariff-supplier-head">
                Modèles — {brands.data?.find((b) => b.id === brandId)?.name}
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  <TagInput
                    tags={newModels}
                    onChange={setNewModels}
                    placeholder="Ajouter des modèles… + Entrée"
                  />
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={addModels}
                    disabled={busy || newModels.length === 0}
                    style={{ marginTop: 6 }}
                  >
                    Ajouter{" "}
                    {newModels.length > 0 ? `(${newModels.length})` : ""}
                  </button>
                </div>

                {models.loading && <Loading />}
                {models.data && models.data.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Aucun modèle pour cette marque.
                  </p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Modèle</th>
                          <th className="actions"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {models.data?.map((m) => (
                          <tr key={m.id}>
                            <td style={{ fontWeight: 600 }}>{m.name}</td>
                            <td className="actions">
                              <button
                                className="btn-link danger"
                                onClick={() => setDeletingModel(m)}
                              >
                                Supprimer
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {deletingBrand && (
        <ConfirmDialog
          title="Supprimer la marque"
          message={`Supprimer ${deletingBrand.name} et tous ses modèles ? (impossible si des articles y sont rattachés)`}
          onConfirm={confirmDeleteBrand}
          onCancel={() => setDeletingBrand(null)}
        />
      )}
      {deletingModel && (
        <ConfirmDialog
          title="Supprimer le modèle"
          message={`Supprimer ${deletingModel.name} ? (impossible s'il est utilisé par des articles)`}
          onConfirm={confirmDeleteModel}
          onCancel={() => setDeletingModel(null)}
        />
      )}
    </>
  );
}
