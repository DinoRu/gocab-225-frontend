"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import type { TariffSupplier, TariffSupplierInput } from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Loading,
  Modal,
  Pagination,
  useToast,
} from "@/components/ui";

const LIMIT = 100;

export default function TariffSuppliersPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<TariffSupplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TariffSupplier | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const suppliers = useAsync(
    () =>
      api.listTariffSuppliers({
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
      await api.deleteTariffSupplier(deleting.id);
      toast.push(`Fournisseur ${deleting.name} supprimé.`, "success");
      setDeleting(null);
      suppliers.reload();
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
          <h1>Fournisseurs</h1>
          <div className="sub">Ceux dont vous suivez les prix d'achat</div>
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
          />
        </div>
      </div>

      {suppliers.error && <ErrorBox message={suppliers.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Contact</th>
              <th>Téléphone</th>
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
                  <EmptyState
                    message="Aucun fournisseur"
                    hint="Ajoutez votre premier fournisseur."
                  />
                </td>
              </tr>
            ) : (
              suppliers.data?.items.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.contact_name || <span className="muted">—</span>}</td>
                  <td>{s.phone || <span className="muted">—</span>}</td>
                  <td className="actions">
                    <button className="btn-link" onClick={() => setEditing(s)}>
                      Modifier
                    </button>
                    <button
                      className="btn-link danger"
                      onClick={() => setDeleting(s)}
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

      {suppliers.data && suppliers.data.total > 0 && (
        <Pagination
          page={suppliers.data.page}
          pages={suppliers.data.pages}
          total={suppliers.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {(creating || editing) && (
        <SupplierForm
          supplier={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            suppliers.reload();
            toast.push("Fournisseur enregistré.", "success");
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer le fournisseur"
          message={`Supprimer ${deleting.name} ? Tous ses prix enregistrés seront aussi supprimés.`}
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
  supplier: TariffSupplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(supplier?.name ?? "");
  const [contact, setContact] = useState(supplier?.contact_name ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    const body: TariffSupplierInput = {
      name: name.trim(),
      contact_name: contact.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    };
    setBusy(true);
    try {
      if (supplier) await api.updateTariffSupplier(supplier.id, body);
      else await api.createTariffSupplier(body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={supplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}
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
          Nom <span className="required">*</span>
        </label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="Ex : Mohamed Freno"
        />
      </div>
      <div
        className="form-grid"
        style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}
      >
        <div className="field">
          <label>Personne contact</label>
          <input
            className="input"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Téléphone</label>
          <input
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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
