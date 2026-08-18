"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate } from "@/lib/format";
import type { SalesClient, SalesClientInput } from "@/lib/types";
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

export default function SalesClientsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<SalesClient | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SalesClient | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const clients = useAsync(
    () =>
      api.listSalesClients({
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
      await api.deleteSalesClient(deleting.id);
      toast.push(`Client ${deleting.name} supprimé.`, "success");
      setDeleting(null);
      clients.reload();
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
          <h1>Clients</h1>
          <div className="sub">Entreprises auxquelles vous vendez</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouveau client
        </button>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Recherche</label>
          <input
            className="input"
            placeholder="Nom du client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {clients.error && <ErrorBox message={clients.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Contact</th>
              <th>Téléphone</th>
              <th>Email</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.loading && !clients.data ? (
              <tr>
                <td colSpan={5}>
                  <Loading />
                </td>
              </tr>
            ) : clients.data && clients.data.items.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    message="Aucun client"
                    hint="Ajoutez votre première entreprise cliente."
                  />
                </td>
              </tr>
            ) : (
              clients.data?.items.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.contact_name || <span className="muted">—</span>}</td>
                  <td>{c.phone || <span className="muted">—</span>}</td>
                  <td>{c.email || <span className="muted">—</span>}</td>
                  <td className="actions">
                    <Link className="btn-link" href={`/ventes/clients/${c.id}`}>
                      Grand livre
                    </Link>
                    <button className="btn-link" onClick={() => setEditing(c)}>
                      Modifier
                    </button>
                    <button
                      className="btn-link danger"
                      onClick={() => setDeleting(c)}
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

      {clients.data && clients.data.total > 0 && (
        <Pagination
          page={clients.data.page}
          pages={clients.data.pages}
          total={clients.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {(creating || editing) && (
        <ClientForm
          client={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            clients.reload();
            toast.push("Client enregistré.", "success");
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer le client"
          message={`Supprimer ${deleting.name} ? (impossible s'il a des ventes)`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

function ClientForm({
  client,
  onClose,
  onSaved,
}: {
  client: SalesClient | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(client?.name ?? "");
  const [contact, setContact] = useState(client?.contact_name ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    const body: SalesClientInput = {
      name: name.trim(),
      contact_name: contact.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
    };
    setBusy(true);
    try {
      if (client) await api.updateSalesClient(client.id, body);
      else await api.createSalesClient(body);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={client ? "Modifier le client" : "Nouveau client"}
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
          Nom de l'entreprise <span className="required">*</span>
        </label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
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
      <div className="field" style={{ marginBottom: 12 }}>
        <label>Email</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
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
