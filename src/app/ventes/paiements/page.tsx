"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatFCFA } from "@/lib/format";
import type { SalesClient, SalesPayment, SalesPaymentInput } from "@/lib/types";
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

export default function SalesPaymentsPage() {
  const toast = useToast();
  const [clientId, setClientId] = useState("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SalesPayment | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const clients = useAsync(() => api.listSalesClients({ limit: 500 }), []);
  const payments = useAsync(
    () =>
      api.listSalesPayments({
        client_id: clientId || undefined,
        page,
        limit: LIMIT,
      }),
    [clientId, page],
  );

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteSalesPayment(deleting.id);
      toast.push(`Paiement ${deleting.payment_number} supprimé.`, "success");
      setDeleting(null);
      payments.reload();
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
          <h1>Paiements</h1>
          <div className="sub">
            Versements des clients, imputés sur leurs ventes
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouveau paiement
        </button>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Client</label>
          <select
            className="select"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            {clients.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {payments.error && <ErrorBox message={payments.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N° paiement</th>
              <th>Date</th>
              <th>Client</th>
              <th className="num">Montant</th>
              <th>Imputé sur</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.loading && !payments.data ? (
              <tr>
                <td colSpan={6}>
                  <Loading />
                </td>
              </tr>
            ) : payments.data && payments.data.items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    message="Aucun paiement"
                    hint="Enregistrez le premier versement d'un client."
                  />
                </td>
              </tr>
            ) : (
              payments.data?.items.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.payment_number}</td>
                  <td>{formatDate(p.payment_date)}</td>
                  <td>{p.client_name}</td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    {formatFCFA(p.amount)}
                  </td>
                  <td>
                    {p.allocations.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <span style={{ fontSize: 12 }}>
                        {p.allocations.map((a) => (
                          <span
                            key={a.sales_order_id}
                            className="mono"
                            style={{ marginRight: 6 }}
                          >
                            {a.sale_number} ({formatFCFA(a.amount)})
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="actions">
                    <button
                      className="btn-link danger"
                      onClick={() => setDeleting(p)}
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

      {payments.data && payments.data.total > 0 && (
        <Pagination
          page={payments.data.page}
          pages={payments.data.pages}
          total={payments.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {creating && (
        <PaymentForm
          clients={clients.data?.items ?? []}
          onClose={() => setCreating(false)}
          onSaved={(num) => {
            setCreating(false);
            payments.reload();
            toast.push(`Paiement ${num} enregistré.`, "success");
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer le paiement"
          message={`Supprimer ${deleting.payment_number} ? Les ventes qu'il soldait redeviendront impayées.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

function PaymentForm({
  clients,
  onClose,
  onSaved,
}: {
  clients: SalesClient[];
  onClose: () => void;
  onSaved: (num: string) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Grand livre du client sélectionné → montre ce qu'il doit + aperçu de l'imputation.
  const ledger = useAsync(
    () => (clientId ? api.clientLedger(clientId) : Promise.resolve(null)),
    [clientId],
  );

  // Aperçu de l'imputation automatique (plus ancien d'abord).
  const preview = useMemo(() => {
    const data = ledger.data;
    if (!data) return [];
    let left = Number(amount) || 0;
    const rows: { sale_number: string; take: number }[] = [];
    for (const s of data.unpaid_sales) {
      if (left <= 0) break;
      const rem = Number(s.remaining);
      const take = Math.min(left, rem);
      rows.push({ sale_number: s.sale_number, take });
      left -= take;
    }
    return rows;
  }, [ledger.data, amount]);

  const totalDue = ledger.data ? Number(ledger.data.balance) : 0;
  const over = Number(amount) > totalDue;

  async function submit() {
    setError(null);
    if (!clientId) {
      setError("Le client est obligatoire.");
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("Le montant doit être supérieur à zéro.");
      return;
    }
    if (over) {
      setError(
        `Le montant dépasse ce que le client doit (${formatFCFA(totalDue)}).`,
      );
      return;
    }

    const body: SalesPaymentInput = {
      client_id: clientId,
      payment_date: paymentDate,
      amount: String(amt),
      method: method.trim() || null,
      notes: notes.trim() || null,
    };
    setBusy(true);
    try {
      const created = await api.createSalesPayment(body);
      onSaved(created.payment_number);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nouveau paiement"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || over}
          >
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      <div
        className="form-grid"
        style={{ gridTemplateColumns: "2fr 1fr", marginBottom: 12 }}
      >
        <div className="field">
          <label>
            Client <span className="required">*</span>
          </label>
          <select
            className="select"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Choisir…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>
            Date <span className="required">*</span>
          </label>
          <input
            className="input"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />
        </div>
      </div>

      {/* Solde du client */}
      {clientId && (
        <div style={{ marginBottom: 12 }}>
          {ledger.loading ? (
            <Loading />
          ) : ledger.data ? (
            <div
              className="warn-banner"
              style={{ background: "var(--accent-soft)", color: "var(--text)" }}
            >
              Ce client doit actuellement{" "}
              <strong>{formatFCFA(ledger.data.balance)}</strong> sur{" "}
              {ledger.data.unpaid_sales.length} vente(s) impayée(s).
            </div>
          ) : null}
        </div>
      )}

      <div
        className="form-grid"
        style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}
      >
        <div className="field">
          <label>
            Montant (FCFA) <span className="required">*</span>
          </label>
          <input
            className="input num"
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={over ? { borderColor: "var(--danger)" } : undefined}
          />
          {over && (
            <span style={{ fontSize: 11, color: "var(--danger)" }}>
              Dépasse le total dû ({formatFCFA(totalDue)}).
            </span>
          )}
        </div>
        <div className="field">
          <label>Mode de paiement</label>
          <input
            className="input"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="Espèces, virement, mobile money…"
          />
        </div>
      </div>

      {/* Aperçu de l'imputation automatique */}
      {preview.length > 0 && !over && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Imputation automatique (des ventes les plus anciennes)
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vente</th>
                  <th className="num">Montant imputé</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.sale_number}>
                    <td className="mono">{r.sale_number}</td>
                    <td className="num">{formatFCFA(r.take)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
