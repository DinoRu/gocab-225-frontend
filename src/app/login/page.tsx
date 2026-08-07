"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      {/* Panneau de marque (masqué sur mobile) */}
      <aside className="login-brand-panel">
        {/* Motif technique en filigrane */}
        <div className="login-brand-pattern" aria-hidden="true">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 400 600"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
            stroke="#fff"
            strokeWidth="1.5"
          >
            <circle cx="70" cy="110" r="34" />
            <circle cx="70" cy="110" r="15" />
            <g strokeWidth="2">
              <line x1="70" y1="68" x2="70" y2="80" />
              <line x1="70" y1="140" x2="70" y2="152" />
              <line x1="28" y1="110" x2="40" y2="110" />
              <line x1="100" y1="110" x2="112" y2="110" />
              <line x1="40" y1="80" x2="49" y2="89" />
              <line x1="91" y1="131" x2="100" y2="140" />
              <line x1="100" y1="80" x2="91" y2="89" />
              <line x1="49" y1="131" x2="40" y2="140" />
            </g>
            <circle cx="330" cy="470" r="48" />
            <circle cx="330" cy="470" r="22" />
            <g strokeWidth="2">
              <line x1="330" y1="410" x2="330" y2="425" />
              <line x1="330" y1="515" x2="330" y2="530" />
              <line x1="270" y1="470" x2="285" y2="470" />
              <line x1="375" y1="470" x2="390" y2="470" />
              <line x1="288" y1="428" x2="299" y2="439" />
              <line x1="361" y1="501" x2="372" y2="512" />
              <line x1="372" y1="428" x2="361" y2="439" />
              <line x1="299" y1="501" x2="288" y2="512" />
            </g>
            <polygon
              points="310,180 328,190 328,212 310,222 292,212 292,190"
              strokeWidth="2"
            />
            <circle cx="310" cy="201" r="9" />
            <polygon
              points="120,380 132,387 132,401 120,408 108,401 108,387"
              strokeWidth="2"
            />
            <line
              x1="150"
              y1="260"
              x2="260"
              y2="260"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <line
              x1="60"
              y1="320"
              x2="210"
              y2="320"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          </svg>
        </div>

        <div className="login-brand-logo">
          GOCAB<span> 225</span>
        </div>
        <div className="login-brand-pitch">
          <div className="login-brand-title">Gestion des pièces détachées</div>
          <div className="login-brand-desc">
            Commandes, inventaire, approvisionnement et suivi des paiements
            fournisseurs.
          </div>
        </div>
        <div className="login-brand-footer">Abidjan · Côte d'Ivoire</div>
      </aside>

      {/* Formulaire */}
      <main className="login-form-panel">
        <form className="login-form" onSubmit={submit}>
          <div className="login-form-head">
            <h1>Connexion</h1>
            <p>Accédez à votre espace de gestion.</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <label className="login-label" htmlFor="login-username">
            Identifiant
          </label>
          <div className="login-input-wrap">
            <span className="login-input-icon" aria-hidden="true">
              {/* icône utilisateur */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <input
              id="login-username"
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              placeholder="dino"
            />
          </div>

          <label className="login-label" htmlFor="login-password">
            Mot de passe
          </label>
          <div className="login-input-wrap">
            <span className="login-input-icon" aria-hidden="true">
              {/* icône cadenas */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              id="login-password"
              className="login-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <button
              type="button"
              className="login-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword
                  ? "Masquer le mot de passe"
                  : "Afficher le mot de passe"
              }
            >
              {showPassword ? "Masquer" : "Afficher"}
            </button>
          </div>

          <button className="login-submit" type="submit" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </main>
    </div>
  );
}
