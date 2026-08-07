"use client";

import { useEffect, useState } from "react";
import { api, ApiError, downloadWithAuth } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatFCFA } from "@/lib/format";
import type {
  PaymentPriority,
  PaymentRequest,
  PaymentStatus,
  Supplier,
} from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  Loading,
  Modal,
  Pagination,
  useToast,
} from "@/components/ui";

const LIMIT = 20;

const PRIORITY_LABEL: Record<PaymentPriority, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

const PRIORITY_CLASS: Record<PaymentPriority, string> = {
  low: "prio-low",
  normal: "prio-normal",
  high: "prio-high",
  urgent: "prio-urgent",
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  to_pay: "À payer",
  paid: "Payé",
};

export default function PaymentsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<"" | PaymentStatus>("");
  const [priority, setPriority] = useState<"" | PaymentPriority>("");
  const [supplierId, setSupplierId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PaymentRequest | null>(null);
  const [deleting, setDeleting] = useState<PaymentRequest | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const suppliers = useAsync(() => api.listSuppliers(), []);
  const requests = useAsync(
    () =>
      api.listPaymentRequests({
        search: debounced || undefined,
        status: status || undefined,
        priority: priority || undefined,
        supplier_id: supplierId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        limit: LIMIT,
      }),
    [debounced, status, priority, supplierId, startDate, endDate, page],
  );

  // Construit l'URL d'export en combinant les filtres actifs avec le périmètre choisi.
  // scope override le filtre statut de la page ("" = tous).
  function exportHrefFor(scope: "" | PaymentStatus): string {
    return api.paymentExportUrl({
      search: debounced || undefined,
      status: scope || undefined,
      priority: priority || undefined,
      supplier_id: supplierId || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    });
  }

  async function togglePaid(pr: PaymentRequest) {
    setActionBusy(pr.id);
    try {
      if (pr.status === "paid") {
        await api.markPaymentUnpaid(pr.id);
        toast.push(`${pr.request_number} remis à « à payer ».`, "success");
      } else {
        await api.markPaymentPaid(pr.id);
        toast.push(`${pr.request_number} marqué payé.`, "success");
      }
      requests.reload();
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Action impossible.",
        "error",
      );
    } finally {
      setActionBusy(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deletePaymentRequest(deleting.id);
      toast.push(`Demande ${deleting.request_number} supprimée.`, "success");
      setDeleting(null);
      requests.reload();
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
          <h1>Demandes de paiement</h1>
          <div className="sub">
            Registre des demandes à transmettre au service finance
          </div>
        </div>
        <div className="row-flex">
          <button className="btn" onClick={() => setExportOpen(true)}>
            Exporter en Excel
          </button>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Nouvelle demande
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Recherche</label>
          <input
            className="input"
            placeholder="Titre, n°, réf. Odoo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Statut</label>
          <select
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "" | PaymentStatus);
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            <option value="to_pay">À payer</option>
            <option value="paid">Payé</option>
          </select>
        </div>
        <div className="field">
          <label>Priorité</label>
          <select
            className="select"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value as "" | PaymentPriority);
              setPage(1);
            }}
          >
            <option value="">Toutes</option>
            <option value="urgent">Urgente</option>
            <option value="high">Haute</option>
            <option value="normal">Normale</option>
            <option value="low">Basse</option>
          </select>
        </div>
        <div className="field">
          <label>Fournisseur</label>
          <select
            className="select"
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            {suppliers.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Du</label>
          <input
            className="input"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label>Au</label>
          <input
            className="input"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {requests.error && <ErrorBox message={requests.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Titre</th>
              <th>Fournisseur</th>
              <th>Priorité</th>
              <th>Date</th>
              <th>Statut</th>
              <th className="num">Montant</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.loading && !requests.data ? (
              <tr>
                <td colSpan={8}>
                  <Loading />
                </td>
              </tr>
            ) : requests.data && requests.data.items.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    message="Aucune demande de paiement"
                    hint="Créez une demande ou ajustez les filtres."
                  />
                </td>
              </tr>
            ) : (
              requests.data?.items.map((pr) => (
                <tr key={pr.id}>
                  <td className="mono">{pr.request_number}</td>
                  <td>
                    {pr.title}
                    {pr.link && (
                      <>
                        {" "}
                        <a
                          href={pr.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-link"
                          style={{ padding: 0 }}
                          title="Ouvrir dans Odoo"
                        >
                          ↗
                        </a>
                      </>
                    )}
                    {pr.odoo_reference && (
                      <div className="muted" style={{ fontSize: 11 }}>
                        {pr.odoo_reference}
                      </div>
                    )}
                  </td>
                  <td>{pr.supplier.name}</td>
                  <td>
                    <span
                      className={"prio-badge " + PRIORITY_CLASS[pr.priority]}
                    >
                      {PRIORITY_LABEL[pr.priority]}
                    </span>
                  </td>
                  <td>{formatDate(pr.request_date)}</td>
                  <td>
                    <span
                      className={
                        "status-badge " +
                        (pr.status === "paid" ? "paid" : "to-pay")
                      }
                    >
                      {STATUS_LABEL[pr.status]}
                    </span>
                  </td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    {formatFCFA(pr.amount)}
                  </td>
                  <td className="actions">
                    <button
                      className="btn-link"
                      onClick={() => togglePaid(pr)}
                      disabled={actionBusy === pr.id}
                    >
                      {pr.status === "paid"
                        ? "Annuler paiement"
                        : "Marquer payé"}
                    </button>
                    {pr.status !== "paid" && (
                      <button
                        className="btn-link"
                        onClick={() => setEditing(pr)}
                      >
                        Modifier
                      </button>
                    )}
                    <button
                      className="btn-link danger"
                      onClick={() => setDeleting(pr)}
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

      {requests.data && requests.data.total > 0 && (
        <Pagination
          page={requests.data.page}
          pages={requests.data.pages}
          total={requests.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {creating && (
        <PaymentForm
          suppliers={suppliers.data?.items ?? []}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            requests.reload();
            toast.push("Demande créée.", "success");
          }}
        />
      )}

      {editing && (
        <PaymentForm
          request={editing}
          suppliers={suppliers.data?.items ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            requests.reload();
            toast.push("Demande mise à jour.", "success");
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer la demande"
          message={`Supprimer la demande ${deleting.request_number} — « ${deleting.title} » ? Cette action est définitive.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}

      {exportOpen && (
        <ExportChoice
          hrefFor={exportHrefFor}
          onClose={() => setExportOpen(false)}
          onError={() => toast.push("Export impossible.", "error")}
        />
      )}
    </>
  );
}

// ---------- Choix du périmètre d'export ----------
// ---------- Choix du périmètre d'export ----------
function ExportChoice({
  hrefFor,
  onClose,
  onError,
}: {
  hrefFor: (scope: "" | PaymentStatus) => string;
  onClose: () => void;
  onError: () => void;
}) {
  // Télécharge avec le token (le <a href>/window.open ne passe pas l'Authorization).
  async function download(scope: "" | PaymentStatus) {
    try {
      await downloadWithAuth(hrefFor(scope), "demandes_paiement.xlsx");
      onClose();
    } catch {
      onError();
    }
  }

  return (
    <Modal
      title="Exporter les demandes de paiement"
      onClose={onClose}
      footer={
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
      }
    >
      <p className="muted" style={{ marginTop: 0 }}>
        Choisissez les demandes à inclure dans le fichier Excel. Les autres
        filtres actifs (fournisseur, dates, recherche) restent appliqués.
      </p>
      <div className="mode-cards" style={{ gridTemplateColumns: "1fr" }}>
        <button className="mode-card" onClick={() => download("")}>
          <div className="mode-card-title">Toutes les demandes</div>
          <div className="mode-card-desc">
            À payer et déjà payées confondues.
          </div>
        </button>
        <button className="mode-card" onClick={() => download("to_pay")}>
          <div className="mode-card-title">En attente de paiement</div>
          <div className="mode-card-desc">
            Uniquement les demandes non encore réglées.
          </div>
        </button>
        <button className="mode-card" onClick={() => download("paid")}>
          <div className="mode-card-title">Déjà payées</div>
          <div className="mode-card-desc">Uniquement les demandes soldées.</div>
        </button>
      </div>
    </Modal>
  );
}
// ---------- Formulaire demande ----------
function PaymentForm({
  request,
  suppliers,
  onClose,
  onSaved,
}: {
  request?: PaymentRequest;
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!request;
  const [title, setTitle] = useState(request?.title ?? "");
  const [amount, setAmount] = useState(request?.amount ?? "");
  const [requestDate, setRequestDate] = useState(
    request?.request_date ?? new Date().toISOString().slice(0, 10),
  );
  const [supplierId, setSupplierId] = useState(request?.supplier.id ?? "");
  const [priority, setPriority] = useState<PaymentPriority>(
    request?.priority ?? "normal",
  );
  const [link, setLink] = useState(request?.link ?? "");
  const [odooRef, setOdooRef] = useState(request?.odoo_reference ?? "");
  const [notes, setNotes] = useState(request?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Le titre est obligatoire.");
      return;
    }
    const amountNum = Number(amount);
    if (!amount || Number.isNaN(amountNum) || amountNum <= 0) {
      setError("Le montant doit être supérieur à zéro.");
      return;
    }
    if (!isEdit && !supplierId) {
      setError("Le fournisseur est obligatoire.");
      return;
    }
    setBusy(true);
    try {
      if (isEdit) {
        await api.updatePaymentRequest(request!.id, {
          title: title.trim(),
          amount: String(amountNum),
          request_date: requestDate,
          priority,
          link: link.trim() || null,
          odoo_reference: odooRef.trim() || null,
          notes: notes.trim() || null,
        });
      } else {
        await api.createPaymentRequest({
          title: title.trim(),
          amount: String(amountNum),
          request_date: requestDate,
          supplier_id: supplierId,
          priority,
          link: link.trim() || null,
          odoo_reference: odooRef.trim() || null,
          notes: notes.trim() || null,
        });
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
      title={isEdit ? "Modifier la demande" : "Nouvelle demande de paiement"}
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
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>
            Titre <span className="required">*</span>
          </label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Paiement pièces Bestune — SEP-CI"
            autoFocus
          />
        </div>

        <div className="field">
          <label>
            Montant (FCFA) <span className="required">*</span>
          </label>
          <input
            className="input num"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="150000"
          />
        </div>
        <div className="field">
          <label>
            Date de la demande <span className="required">*</span>
          </label>
          <input
            className="input"
            type="date"
            value={requestDate}
            onChange={(e) => setRequestDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label>
            Fournisseur <span className="required">*</span>
          </label>
          <select
            className="select"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={isEdit}
          >
            <option value="">Choisir…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {isEdit && (
            <span className="muted" style={{ fontSize: 11 }}>
              Le fournisseur ne peut pas être changé.
            </span>
          )}
        </div>
        <div className="field">
          <label>Priorité</label>
          <select
            className="select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as PaymentPriority)}
          >
            <option value="low">Basse</option>
            <option value="normal">Normale</option>
            <option value="high">Haute</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>

        <div className="field">
          <label>Lien de la demande (Odoo)</label>
          <input
            className="input"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://odoo…"
          />
        </div>
        <div className="field">
          <label>Référence Odoo</label>
          <input
            className="input"
            value={odooRef}
            onChange={(e) => setOdooRef(e.target.value)}
            placeholder="ODOO-4412"
          />
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Notes</label>
          <textarea
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informations complémentaires (facultatif)"
          />
        </div>
      </div>
    </Modal>
  );
}
