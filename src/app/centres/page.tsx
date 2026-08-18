"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type {
  CenterRequest,
  CenterItemInput,
  CenterStatus,
  PartDetail,
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
import { PartFreeCombobox } from "@/components/PartFreeCombobox";

const LIMIT = 20;

const STATUS_LABEL: Record<CenterStatus, string> = {
  nouvelle: "Nouvelle",
  preparee: "Préparée",
  envoyee: "Envoyée",
};
const STATUS_CLASS: Record<CenterStatus, string> = {
  nouvelle: "cr-nouvelle",
  preparee: "cr-preparee",
  envoyee: "cr-envoyee",
};

export default function CenterRequestsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<"" | CenterStatus>("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CenterRequest | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const requests = useAsync(
    () =>
      api.listCenterRequests({
        status: status || undefined,
        page,
        limit: LIMIT,
      }),
    [status, page],
  );

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteCenterRequest(deleting.id);
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
          <h1>Demandes inter-centres</h1>
          <div className="sub">
            {isAdmin
              ? "Demandes de pièces du Centre 2 — à préparer et envoyer"
              : "Vos demandes de pièces à l'entrepôt du Centre 1"}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouvelle demande
        </button>
      </div>

      {/* Filtres par statut */}
      <div className="cr-filters">
        {(
          [
            ["", "Toutes"],
            ["nouvelle", "Nouvelles"],
            ["preparee", "Préparées"],
            ["envoyee", "Envoyées"],
          ] as const
        ).map(([val, label]) => (
          <button
            key={val}
            className={"cr-filter" + (status === val ? " active" : "")}
            onClick={() => {
              setStatus(val as "" | CenterStatus);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {requests.error && <ErrorBox message={requests.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Date</th>
              <th>Véhicule</th>
              <th>Immatriculation</th>
              {isAdmin && <th>Demandé par</th>}
              <th className="num">Pièces</th>
              <th>Statut</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.loading && !requests.data ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7}>
                  <Loading />
                </td>
              </tr>
            ) : requests.data && requests.data.items.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7}>
                  <EmptyState
                    message="Aucune demande"
                    hint="Créez une demande de pièces."
                  />
                </td>
              </tr>
            ) : (
              requests.data?.items.map((r) => (
                <tr
                  key={r.id}
                  className="clickable"
                  onClick={() => setViewing(r.id)}
                >
                  <td className="mono">{r.request_number}</td>
                  <td>{formatDate(r.request_date)}</td>
                  <td>
                    {r.vehicle_brand} {r.vehicle_model}
                  </td>
                  <td className="mono">
                    {r.plate_number || <span className="muted">—</span>}
                  </td>
                  {isAdmin && (
                    <td>
                      {r.created_by_name || <span className="muted">—</span>}
                    </td>
                  )}
                  <td className="num">
                    {r.status !== "nouvelle"
                      ? `${r.prepared_count}/${r.total_items}`
                      : r.total_items}
                  </td>
                  <td>
                    <span className={"cr-badge " + STATUS_CLASS[r.status]}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-link"
                      onClick={() => setViewing(r.id)}
                    >
                      {isAdmin ? "Préparer" : "Détails"}
                    </button>
                    {r.status === "nouvelle" && (
                      <button
                        className="btn-link danger"
                        onClick={() => setDeleting(r)}
                      >
                        Supprimer
                      </button>
                    )}
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
        <RequestForm
          onClose={() => setCreating(false)}
          onSaved={(num) => {
            setCreating(false);
            requests.reload();
            toast.push(`Demande ${num} créée.`, "success");
          }}
        />
      )}

      {viewing && (
        <RequestDetail
          id={viewing}
          isAdmin={isAdmin}
          onClose={() => setViewing(null)}
          onChanged={() => requests.reload()}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer la demande"
          message={`Supprimer la demande ${deleting.request_number} ?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

// ---------- Détail : préparation (admin) ou consultation (centre) ----------
function RequestDetail({
  id,
  isAdmin,
  onClose,
  onChanged,
}: {
  id: string;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const req = useAsync(() => api.getCenterRequest(id), [id]);
  const [busy, setBusy] = useState(false);
  const data = req.data;

  async function toggle(itemId: string, prepared: boolean) {
    try {
      await api.toggleCenterItem(id, itemId, prepared);
      req.reload();
      onChanged();
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Action impossible.",
        "error",
      );
    }
  }

  async function changeStatus(status: CenterStatus, msg: string) {
    setBusy(true);
    try {
      await api.setCenterStatus(id, status);
      toast.push(msg, "success");
      req.reload();
      onChanged();
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Action impossible.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={data ? `Demande ${data.request_number}` : "Demande"}
      onClose={onClose}
      wide
      footer={
        <>
          {isAdmin && data && data.status === "nouvelle" && (
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                changeStatus("preparee", "Demande marquée préparée.")
              }
            >
              Marquer préparée
            </button>
          )}
          {isAdmin && data && data.status !== "envoyee" && (
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                changeStatus("envoyee", "Demande marquée envoyée.")
              }
            >
              Marquer envoyée
            </button>
          )}
          {isAdmin && data && data.status === "envoyee" && (
            <button
              className="btn"
              disabled={busy}
              onClick={() => changeStatus("nouvelle", "Demande rouverte.")}
            >
              Rouvrir
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Fermer
          </button>
        </>
      }
    >
      {req.loading && <Loading />}
      {req.error && <ErrorBox message={req.error} />}
      {data && (
        <>
          <div
            style={{
              display: "flex",
              gap: 24,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <F
              label="Véhicule"
              value={`${data.vehicle_brand} ${data.vehicle_model}`}
            />
            {data.plate_number && (
              <F label="Immatriculation" value={data.plate_number} />
            )}
            <F label="Date" value={formatDate(data.request_date)} />
            {isAdmin && data.created_by_name && (
              <F label="Demandé par" value={data.created_by_name} />
            )}
            <div>
              <div
                className="muted"
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Statut
              </div>
              <span
                className={"cr-badge " + STATUS_CLASS[data.status]}
                style={{ marginTop: 2 }}
              >
                {STATUS_LABEL[data.status]}
              </span>
            </div>
          </div>

          {isAdmin && data.status !== "nouvelle" && (
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Préparation : {data.prepared_count}/{data.total_items} pièces
              rassemblées
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {isAdmin && <th style={{ width: 36 }}>✓</th>}
                  <th>Pièce</th>
                  <th className="num">Qté</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr
                    key={it.id}
                    style={
                      isAdmin && it.prepared ? { opacity: 0.55 } : undefined
                    }
                  >
                    {isAdmin && (
                      <td>
                        <input
                          type="checkbox"
                          checked={it.prepared}
                          onChange={(e) => toggle(it.id, e.target.checked)}
                        />
                      </td>
                    )}
                    <td>
                      {it.designation}
                      {!it.from_catalog && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--warning, #b7791f)",
                            marginLeft: 6,
                          }}
                        >
                          (hors catalogue)
                        </span>
                      )}
                    </td>
                    <td className="num">{it.quantity}</td>
                    <td>{it.note || <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.notes && (
            <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
              <strong>Notes :</strong> {data.notes}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

function F({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="muted"
        style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600 }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ---------- Formulaire de création (centre + admin) ----------
type ReqLine = {
  key: number;
  part_id: string | null;
  designation: string;
  quantity: string;
  note: string;
};
let reqLineCounter = 0;
const newReqLine = (): ReqLine => ({
  key: ++reqLineCounter,
  part_id: null,
  designation: "",
  quantity: "1",
  note: "",
});

function RequestForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (num: string) => void;
}) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [reqDate, setReqDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReqLine[]>([newReqLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parts = useAsync(() => api.listParts({ limit: 1000 }), []);

  function updateLine(key: number, patch: Partial<ReqLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    if (!brand.trim()) {
      setError("La marque du véhicule est obligatoire.");
      return;
    }
    if (!model.trim()) {
      setError("Le modèle du véhicule est obligatoire.");
      return;
    }
    const filled = lines.filter((l) => l.designation.trim());
    if (filled.length === 0) {
      setError("Ajoutez au moins une pièce.");
      return;
    }
    for (const l of filled) {
      const q = Number(l.quantity);
      if (!Number.isInteger(q) || q <= 0) {
        setError(`Quantité invalide pour « ${l.designation} ».`);
        return;
      }
    }

    const items: CenterItemInput[] = filled.map((l) => ({
      part_id: l.part_id,
      designation: l.designation.trim(),
      quantity: Number(l.quantity),
      note: l.note.trim() || null,
    }));

    setBusy(true);
    try {
      const created = await api.createCenterRequest({
        vehicle_brand: brand.trim(),
        vehicle_model: model.trim(),
        plate_number: plate.trim() || null,
        request_date: reqDate,
        notes: notes.trim() || null,
        items,
      });
      onSaved(created.request_number);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Nouvelle demande de pièces"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Création…" : "Envoyer la demande"}
          </button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      <div
        className="form-grid"
        style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", marginBottom: 16 }}
      >
        <div className="field">
          <label>
            Marque <span className="required">*</span>
          </label>
          <input
            className="input"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Chery, FAW…"
          />
        </div>
        <div className="field">
          <label>
            Modèle <span className="required">*</span>
          </label>
          <input
            className="input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Tiggo, Bestune…"
          />
        </div>
        <div className="field">
          <label>Immatriculation</label>
          <input
            className="input"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="Facultatif"
          />
        </div>
        <div className="field">
          <label>
            Date <span className="required">*</span>
          </label>
          <input
            className="input"
            type="date"
            value={reqDate}
            onChange={(e) => setReqDate(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="lines-table">
          <thead>
            <tr>
              <th style={{ minWidth: 240 }}>Pièce</th>
              <th className="num" style={{ width: 70 }}>
                Qté
              </th>
              <th style={{ width: 160 }}>Note</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key}>
                <td>
                  <PartFreeCombobox
                    parts={parts.data?.items ?? []}
                    designation={l.designation}
                    onChangeText={(text) =>
                      updateLine(l.key, { designation: text, part_id: null })
                    }
                    onPickPart={(p) =>
                      updateLine(l.key, {
                        part_id: p.id,
                        designation: p.designation,
                      })
                    }
                    placeholder="Pièce ou désignation libre…"
                  />
                </td>
                <td>
                  <input
                    className="input num"
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) =>
                      updateLine(l.key, { quantity: e.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    className="input"
                    value={l.note}
                    onChange={(e) =>
                      updateLine(l.key, { note: e.target.value })
                    }
                    placeholder="ex : avant, gauche…"
                  />
                </td>
                <td className="num">
                  <button
                    className="btn-link danger"
                    onClick={() =>
                      setLines((ls) =>
                        ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls,
                      )
                    }
                    disabled={lines.length <= 1}
                    title="Retirer"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        className="btn btn-sm"
        onClick={() => setLines((ls) => [...ls, newReqLine()])}
        style={{ marginBottom: 16 }}
      >
        + Ajouter une pièce
      </button>

      <div className="field">
        <label>Notes générales</label>
        <textarea
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Urgence, précisions… (facultatif)"
        />
      </div>
    </Modal>
  );
}
