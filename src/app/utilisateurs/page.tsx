"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { ManagedUser, UserRole } from "@/lib/types";
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

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrateur",
  magazinier: "Magazinier",
  centre: "Centre",
};

export default function UsersPage() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState<"" | UserRole>("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const users = useAsync(
    () =>
      api.listUsers({
        search: debounced || undefined,
        role: role || undefined,
        is_active: active === "" ? undefined : active === "true",
        page,
        limit: LIMIT,
      }),
    [debounced, role, active, page],
  );

  async function toggleActive(u: ManagedUser) {
    setBusyId(u.id);
    try {
      if (u.is_active) {
        await api.deactivateUser(u.id);
        toast.push(`${u.username} désactivé.`, "success");
      } else {
        await api.activateUser(u.id);
        toast.push(`${u.username} réactivé.`, "success");
      }
      users.reload();
    } catch (e) {
      toast.push(
        e instanceof ApiError ? e.detail : "Action impossible.",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteUser(deleting.id);
      toast.push(`${deleting.username} supprimé.`, "success");
      setDeleting(null);
      users.reload();
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
          <h1>Utilisateurs</h1>
          <div className="sub">Gérez les accès au système</div>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nouvel utilisateur
        </button>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Recherche</label>
          <input
            className="input"
            placeholder="Identifiant ou nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Rôle</label>
          <select
            className="select"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as "" | UserRole);
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            <option value="admin">Administrateur</option>
            <option value="magazinier">Magazinier</option>
          </select>
        </div>
        <div className="field">
          <label>Statut</label>
          <select
            className="select"
            value={active}
            onChange={(e) => {
              setActive(e.target.value as "" | "true" | "false");
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            <option value="true">Actifs</option>
            <option value="false">Désactivés</option>
          </select>
        </div>
      </div>

      {users.error && <ErrorBox message={users.error} />}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Identifiant</th>
              <th>Nom complet</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Créé le</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.loading && !users.data ? (
              <tr>
                <td colSpan={6}>
                  <Loading />
                </td>
              </tr>
            ) : users.data && users.data.items.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    message="Aucun utilisateur"
                    hint="Créez un compte pour donner accès au système."
                  />
                </td>
              </tr>
            ) : (
              users.data?.items.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <tr key={u.id} className={u.is_active ? "" : "user-inactive"}>
                    <td className="mono">
                      {u.username}
                      {isSelf && <span className="muted"> (vous)</span>}
                    </td>
                    <td>{u.full_name || <span className="muted">—</span>}</td>
                    <td>
                      <span
                        className={
                          "role-badge " +
                          (u.role === "admin"
                            ? "role-admin"
                            : "role-magazinier")
                        }
                      >
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className="status-badge paid">Actif</span>
                      ) : (
                        <span className="status-badge to-pay">Désactivé</span>
                      )}
                    </td>
                    <td>{formatDate(u.created_at)}</td>
                    <td className="actions">
                      <button
                        className="btn-link"
                        onClick={() => setEditing(u)}
                      >
                        Modifier
                      </button>
                      <button
                        className="btn-link"
                        onClick={() => setResetting(u)}
                      >
                        Mot de passe
                      </button>
                      {/* On ne peut ni se désactiver ni se supprimer soi-même :
                          le backend refuse, donc on masque les actions pour soi. */}
                      {!isSelf && (
                        <>
                          <button
                            className="btn-link"
                            disabled={busyId === u.id}
                            onClick={() => toggleActive(u)}
                          >
                            {u.is_active ? "Désactiver" : "Réactiver"}
                          </button>
                          <button
                            className="btn-link danger"
                            onClick={() => setDeleting(u)}
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {users.data && users.data.total > 0 && (
        <Pagination
          page={users.data.page}
          pages={users.data.pages}
          total={users.data.total}
          limit={LIMIT}
          onPage={setPage}
        />
      )}

      {creating && (
        <UserForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            users.reload();
            toast.push("Utilisateur créé.", "success");
          }}
        />
      )}

      {editing && (
        <UserForm
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            users.reload();
            toast.push("Utilisateur mis à jour.", "success");
          }}
        />
      )}

      {resetting && (
        <PasswordResetForm
          user={resetting}
          onClose={() => setResetting(null)}
          onSaved={() => {
            setResetting(null);
            toast.push("Mot de passe réinitialisé.", "success");
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer l'utilisateur"
          message={`Supprimer le compte « ${deleting.username} » ? Cette action est définitive. Préférez la désactivation pour conserver l'historique.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={deleteBusy}
        />
      )}
    </>
  );
}

// ---------- Formulaire création / édition ----------
function UserForm({
  user,
  onClose,
  onSaved,
}: {
  user?: ManagedUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const [username, setUsername] = useState(user?.username ?? "");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(user?.role ?? "magazinier");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!isEdit) {
      if (username.trim().length < 3) {
        setError("L'identifiant doit faire au moins 3 caractères.");
        return;
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
        setError(
          "L'identifiant ne peut contenir que lettres, chiffres, points, tirets et underscores.",
        );
        return;
      }
      if (password.length < 8) {
        setError("Le mot de passe doit faire au moins 8 caractères.");
        return;
      }
    }
    setBusy(true);
    try {
      if (isEdit) {
        await api.updateUser(user!.id, {
          full_name: fullName.trim() || null,
          role,
        });
      } else {
        await api.createUser({
          username: username.trim(),
          password,
          full_name: fullName.trim() || null,
          role,
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
      title={isEdit ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
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
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="field">
          <label>
            Identifiant <span className="required">*</span>
          </label>
          <input
            className="input mono"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isEdit}
            placeholder="magasinier1"
            autoFocus={!isEdit}
          />
          {isEdit && (
            <span className="muted" style={{ fontSize: 11 }}>
              L'identifiant ne peut pas être modifié.
            </span>
          )}
        </div>
        <div className="field">
          <label>Nom complet</label>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Kouassi Konan"
          />
        </div>

        {!isEdit && (
          <div className="field">
            <label>
              Mot de passe <span className="required">*</span>
            </label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères minimum"
              autoComplete="new-password"
            />
          </div>
        )}

        <div className="field">
          <label>
            Rôle <span className="required">*</span>
          </label>
          <select
            className="select"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="magazinier">Magazinier</option>
            <option value="admin">Administrateur</option>
          </select>
        </div>
      </div>

      {role === "admin" && (
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Un administrateur a accès à tout, y compris aux montants, aux
          paiements et à la gestion des utilisateurs.
        </p>
      )}
    </Modal>
  );
}

// ---------- Réinitialisation de mot de passe ----------
function PasswordResetForm({
  user,
  onClose,
  onSaved,
}: {
  user: ManagedUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      await api.resetUserPassword(user.id, password);
      onSaved();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.detail : "Réinitialisation impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Mot de passe — ${user.username}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Enregistrement…" : "Réinitialiser"}
          </button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}
      <div className="field">
        <label>
          Nouveau mot de passe <span className="required">*</span>
        </label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8 caractères minimum"
          autoComplete="new-password"
          autoFocus
        />
      </div>
      <div className="field">
        <label>
          Confirmer <span className="required">*</span>
        </label>
        <input
          className="input"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        L'utilisateur devra se reconnecter avec ce nouveau mot de passe.
      </p>
    </Modal>
  );
}
