"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type { Supplier } from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Loading,
  Modal,
  useToast,
} from "@/components/ui";

export default function SuppliersPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const suppliers = useAsync(
    () => api.listSuppliers({ search: debounced || undefined }),
    [debounced]
  );

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteSupplier(deleting.id);
      toast.push(`Fournisseur « ${deleting.name} » supprimé.`, "success");
      setDeleting(null);
      suppliers.reload();
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
          <h1>Fournisseurs</h1>
          <div className="sub">Fournisseurs de pièces détachées</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouveau fournisseur
        </button>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Recherche</label>
          <input
            className="input"
            placeholder="Nom du fournisseur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 240 }}
          />
        </div>
      </div>

      {suppliers.error && <ErrorBox message={suppliers.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Téléphone</th>
              <th>Email</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.loading && !suppliers.data ? (
              <tr>
                <td colSpan={4}>
                  <Loading />
                </td>
              </tr>
            ) : suppliers.data && suppliers.data.items.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState message="Aucun fournisseur" hint="Créez votre premier fournisseur." />
                </td>
              </tr>
            ) : (
              suppliers.data?.items.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td>{s.phone || <span className="muted">—</span>}</td>
                  <td>{s.email || <span className="muted">—</span>}</td>
                  <td className="actions">
                    <button className="btn-link" onClick={() => setEditing(s)}>
                      Modifier
                    </button>
                    <button className="btn-link danger" onClick={() => setDeleting(s)}>
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
        <SupplierForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            suppliers.reload();
            toast.push("Fournisseur créé.", "success");
          }}
        />
      )}
      {editing && (
        <SupplierForm
          supplier={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            suppliers.reload();
            toast.push("Fournisseur mis à jour.", "success");
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Supprimer le fournisseur"
          message={`Supprimer « ${deleting.name} » ? Impossible si des commandes lui sont rattachées.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

function SupplierForm({
  supplier,
  onClose,
  onSaved,
}: {
  supplier?: Supplier;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!supplier;
  const [name, setName] = useState(supplier?.name ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
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
      const body = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
      };
      if (isEdit) await api.updateSupplier(supplier!.id, body);
      else await api.createSupplier(body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isEdit ? "Modifier le fournisseur" : "Nouveau fournisseur"}
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
            placeholder="SEP-CI, Hainan Yabanqu…"
            autoFocus
          />
        </div>
        <div className="field">
          <label>Téléphone</label>
          <input
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+225 27 21 00 00 00"
          />
        </div>
        <div className="field">
          <label>Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@fournisseur.ci"
          />
        </div>
      </div>
    </Modal>
  );
}
