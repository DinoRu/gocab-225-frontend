"use client";

import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatFCFA, formatNumber } from "@/lib/format";
import type {
  SupplyRequest,
  SupplyRequestItemRead,
  BcFromSupplyItemInput,
} from "@/lib/types";
import { ErrorBox, Loading, Modal } from "@/components/ui";

// Le backend renvoie des items de besoin sans les champs d'état de consommation,
// mais le composant les enrichit localement pour la création du bon.
type SupplyRowItem = SupplyRequestItemRead & {
  ordered_quantity: number;
  remaining_quantity: number;
};

// État de saisie par ligne de besoin : combien on met dans CE bon, à quel prix.
type Row = {
  item: SupplyRowItem;
  take: string; // quantité à mettre dans ce bon
  unit_price: string; // prix unitaire (FCFA)
};

export function BonFromSupplyForm({
  supply,
  onClose,
  onCreated,
}: {
  supply: SupplyRequest;
  onClose: () => void;
  onCreated: (bcNumber: string) => void;
}) {
  const suppliers = useAsync(() => api.listSuppliers(), []);
  const [supplierId, setSupplierId] = useState("");
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Une ligne par ligne de besoin ayant encore du reste (> 0).
  const [rows, setRows] = useState<Row[]>(() =>
    supply.items
      .filter((it) => it.remaining_quantity > 0)
      .map((it) => ({ item: it, take: "0", unit_price: "" })),
  );

  function update(idx: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  const total = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const q = Number(r.take) || 0;
        const p = Number(r.unit_price) || 0;
        return sum + q * p;
      }, 0),
    [rows],
  );

  async function submit() {
    setError(null);
    if (!supplierId) {
      setError("Le fournisseur est obligatoire.");
      return;
    }

    // Ne garder que les lignes où on prend quelque chose.
    const taken = rows.filter((r) => Number(r.take) > 0);
    if (taken.length === 0) {
      setError("Indiquez au moins une quantité à commander.");
      return;
    }

    // Validation : ne pas dépasser le reste de chaque ligne.
    for (const r of taken) {
      const q = Number(r.take);
      if (!Number.isInteger(q) || q <= 0) {
        setError(`Quantité invalide pour « ${r.item.reference} ».`);
        return;
      }
      if (q > r.item.remaining_quantity) {
        setError(
          `« ${r.item.reference} » : vous demandez ${q} mais il ne reste que ${r.item.remaining_quantity}.`,
        );
        return;
      }
      if (r.unit_price.trim() && Number(r.unit_price) < 0) {
        setError(`Prix invalide pour « ${r.item.reference} ».`);
        return;
      }
    }

    const items: BcFromSupplyItemInput[] = taken.map((r) => ({
      supply_request_item_id: r.item.id,
      quantity: Number(r.take),
      unit_price: r.unit_price.trim() ? String(Number(r.unit_price)) : null,
    }));

    setBusy(true);
    try {
      const created = await api.createBcFromSupply({
        supply_request_id: supply.id,
        supplier_id: supplierId,
        request_date: requestDate,
        expected_date: expectedDate || null,
        notes: notes.trim() || null,
        items,
      });
      onCreated(created.bc_number);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  const allConsumed = supply.items.every((it) => it.remaining_quantity <= 0);

  return (
    <Modal
      title={`Créer un bon depuis ${supply.sr_number}`}
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
            disabled={busy || allConsumed}
          >
            {busy ? "Création…" : "Créer le bon"}
          </button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      {allConsumed ? (
        <div className="warn-banner">
          Toutes les lignes de ce besoin ont déjà été commandées. Il n'y a plus
          rien à traiter.
        </div>
      ) : (
        <>
          <div
            className="form-grid"
            style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}
          >
            <div className="field">
              <label>
                Fournisseur <span className="required">*</span>
              </label>
              {suppliers.loading ? (
                <Loading />
              ) : (
                <select
                  className="select"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">Choisir…</option>
                  {suppliers.data?.items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="field">
              <label>
                Date du bon <span className="required">*</span>
              </label>
              <input
                className="input"
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
              />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>Date attendue (facultatif)</label>
            <input
              className="input"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>

          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table className="lines-table">
              <thead>
                <tr>
                  <th>Pièce</th>
                  <th className="num" style={{ width: 80 }}>
                    Demandé
                  </th>
                  <th className="num" style={{ width: 90 }}>
                    Commandé
                  </th>
                  <th className="num" style={{ width: 70 }}>
                    Reste
                  </th>
                  <th className="num" style={{ width: 100 }}>
                    À commander
                  </th>
                  <th className="num" style={{ width: 120 }}>
                    Prix unit. (FCFA)
                  </th>
                  <th className="num" style={{ width: 110 }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const q = Number(r.take) || 0;
                  const p = Number(r.unit_price) || 0;
                  const over = q > r.item.remaining_quantity;
                  return (
                    <tr key={r.item.id}>
                      <td>
                        <span className="mono">{r.item.reference}</span> —{" "}
                        {r.item.designation}
                      </td>
                      <td className="num">{formatNumber(r.item.quantity)}</td>
                      <td className="num" style={{ color: "var(--accent)" }}>
                        {formatNumber(r.item.ordered_quantity)}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {formatNumber(r.item.remaining_quantity)}
                      </td>
                      <td className="num">
                        <input
                          className="input num"
                          type="number"
                          min={0}
                          max={r.item.remaining_quantity}
                          value={r.take}
                          onChange={(e) =>
                            update(idx, { take: e.target.value })
                          }
                          style={
                            over ? { borderColor: "var(--danger)" } : undefined
                          }
                        />
                      </td>
                      <td className="num">
                        <input
                          className="input num"
                          type="number"
                          min={0}
                          placeholder="—"
                          value={r.unit_price}
                          onChange={(e) =>
                            update(idx, { unit_price: e.target.value })
                          }
                        />
                      </td>
                      <td className="num line-total">
                        {q > 0 && p > 0 ? formatFCFA(q * p) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            className="row-flex"
            style={{ justifyContent: "flex-end", marginBottom: 12 }}
          >
            <div style={{ fontWeight: 600 }}>
              Total :{" "}
              <span style={{ color: "var(--accent)" }}>
                {formatFCFA(total)}
              </span>
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

          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Laissez « À commander » à 0 pour les lignes que vous traiterez plus
            tard ou chez un autre fournisseur.
          </p>
        </>
      )}
    </Modal>
  );
}
