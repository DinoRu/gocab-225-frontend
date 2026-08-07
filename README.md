<div align="center">

# 🖥️ GOCAB 225 — Interface de gestion

**Interface web** du système de gestion des pièces détachées automobiles GOCAB 225 — commandes, inventaire, approvisionnement et paiements fournisseurs.

[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Licence](https://img.shields.io/badge/licence-propriétaire-lightgrey)](#-licence)

</div>

---

## 📋 À propos

Ce dépôt contient le **frontend** de GOCAB 225 : une application web construite avec **Next.js** (App Router) et **TypeScript**. Elle consomme l'API backend (FastAPI) et offre une interface complète pour la gestion quotidienne des pièces détachées.

L'interface s'adapte au **rôle** de l'utilisateur connecté : un administrateur voit l'ensemble des modules, un magasinier accède à un périmètre restreint (inventaire, besoins d'approvisionnement, consultation du catalogue).

---

## ✨ Aperçu des écrans

| Écran | Description |
|---|---|
| 🔐 **Connexion** | Authentification par identifiant / mot de passe (JWT). |
| 🚀 **Lanceur de modules** | Navigation façon « app launcher » — une grille de modules, sans débordement. |
| 📊 **Tableau de bord** | Vue d'ensemble des volumes et de l'activité. |
| 🛒 **Commandes** | Consultation des commandes reçues (montants masqués pour les magasiniers). |
| 📄 **Bons de commande** | Création et suivi des bons, export PDF & Excel *(admin)*. |
| 📥 **Besoins** | Signalement des pièces manquantes par le magasinier. |
| 📦 **Inventaire** | Comptage tournant avec calcul automatique des sorties. |
| 🔧 **Catalogue** | Pièces, marques et modèles. |
| 💳 **Paiements** | Demandes de paiement fournisseurs *(admin)*. |
| 👥 **Utilisateurs** | Gestion des comptes et des rôles *(admin)*. |

---

## 🧱 Stack technique

- **Next.js 14** (App Router) — framework React
- **TypeScript** — typage statique
- **React 18** — bibliothèque d'interface
- **CSS** — thème maison (variables CSS, accent violet `#5b48c8`)
- Client API centralisé avec gestion du token JWT et des téléchargements authentifiés

---

## 🚀 Démarrage rapide (local)

### Prérequis

- [Node.js](https://nodejs.org/) 18.17+ (ou 20+)
- Le **backend** GOCAB 225 en cours d'exécution (voir son dépôt)

### 1. Installer les dépendances

\`\`\`bash
npm install
\`\`\`

### 2. Configurer l'environnement

Crée un fichier \`.env.local\` à la racine :

\`\`\`bash
NEXT_PUBLIC_API_URL=http://localhost:8000
\`\`\`

> Cette variable indique où joindre l'API backend. En production, elle pointera vers l'URL publique du backend.

### 3. Lancer le serveur de développement

\`\`\`bash
npm run dev
\`\`\`

L'interface est disponible sur **http://localhost:3000**.

### 4. Build de production (test local)

\`\`\`bash
npm run build
npm run start
\`\`\`

---

## 🔐 Variables d'environnement

| Variable | Description | Exemple |
|---|---|---|
| \`NEXT_PUBLIC_API_URL\` | URL de base de l'API backend (le préfixe \`/api/v1\` est ajouté côté client) | \`https://gocab-backend.up.railway.app\` |

> Le préfixe \`NEXT_PUBLIC_\` est nécessaire pour que la variable soit accessible côté navigateur. Ne mets **jamais** de secret dans une variable \`NEXT_PUBLIC_\` — elle est visible par le client.

---

## 🔑 Rôles & accès

L'interface masque dynamiquement les modules selon le rôle :

| Module | 👑 Admin | 📦 Magasinier |
|---|:---:|:---:|
| Tableau de bord | ✅ | ✅ |
| Inventaire | ✅ | ✅ |
| Besoins d'approvisionnement | ✅ | ✅ |
| Commandes | ✅ | 👁️ *(sans prix)* |
| Pièces / Marques / Modèles | ✅ | 👁️ Lecture |
| Bons de commande | ✅ | ⛔ |
| Fournisseurs | ✅ | ⛔ |
| Paiements | ✅ | ⛔ |
| Statistiques | ✅ | ⛔ |
| Utilisateurs | ✅ | ⛔ |

> Le masquage côté interface double le cloisonnement appliqué par l'API : même en forçant une URL, un magasinier est redirigé et ne reçoit aucune donnée financière.

---

## ☁️ Déploiement

Le frontend est prévu pour un déploiement sur **Vercel** :

1. Importer le dépôt dans Vercel.
2. Définir la variable \`NEXT_PUBLIC_API_URL\` avec l'URL publique du backend.
3. Déployer (build automatique à chaque push sur \`main\`).
4. Autoriser l'URL Vercel dans la configuration \`CORS_ORIGINS\` du backend.

---

## 📁 Structure du projet

\`\`\`
src/
├── app/            # Pages (App Router) : login, dashboard, modules…
│   ├── besoins/
│   ├── bons-de-commande/
│   ├── commandes/
│   ├── inventaire/
│   ├── paiements/
│   ├── pieces/
│   └── utilisateurs/
├── components/     # Composants partagés (Nav, UI, modales…)
└── lib/            # Client API, contexte d'authentification, helpers
\`\`\`

---

## 📄 Licence

Projet **propriétaire** — GOCAB 225. Tous droits réservés. Usage interne uniquement.

---

<div align="center">
<sub>Construit avec soin pour GOCAB 225 · Abidjan, Côte d'Ivoire</sub>
</div>