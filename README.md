<div align="center">

# 📊 Fortnite Stats Bot

**Bot Discord pour tracker les stats Fortnite : Reload, Blitz, Zero Build, et plus**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-14-5865F2?logo=discord&logoColor=white)](https://discord.js.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Installation](#-installation) • [Configuration](#%EF%B8%8F-configuration) • [Utilisation](#-utilisation) • [Fonctionnalités](#-fonctionnalités)

---

### 📸 Aperçu

> _Ajoute tes screenshots ici !_
>
> 1. Screenshot de la commande `/stats`
> 2. Screenshot de `/me`
> 3. Screenshot du leaderboard

</div>

---

## ✨ Fonctionnalités

### 🎯 Principales
- **📊 Stats complètes** - Accès à tous les modes : Solo, Duo, Squad, Zero Build, Reload, Blitz
- **🔗 Liaison de compte** - Lie ton compte Epic à Discord
- **🏅 Leaderboard** - Classement des joueurs du serveur
- **⚡ Cache intelligent** - Mise en cache des stats (5 min) pour performances optimales

### 🎮 Modes supportés
| Mode | Disponible |
|------|------------|
| Solo / Duo / Squad | ✅ |
| Zero Build (Solo/Duo/Squad) | ✅ |
| Reload | ✅ |
| Reload Zero Build | ✅ |
| Blitz | ✅ |
| Ranked BR / ZB | ✅ |

### 🛡️ Fiabilité
- **Auth Epic Games** - Authentification officielle via Device Auth
- **Graceful shutdown** - Arrêt propre des connexions
- **Auto-deploy commands** - Commandes déployées automatiquement
- **Base SQLite** - Données persistantes

---

## 🚀 Quick Start

```bash
# 1. Cloner et installer
git clone https://github.com/ADR3-Club/Bot-Stats-Fortnite.git
cd Bot-Stats-Fortnite
npm install

# 2. Configurer Discord
cp .env.example .env
nano .env  # Remplir DISCORD_TOKEN et DISCORD_APP_ID

# 3. Setup Epic Games (une seule fois)
npm run setup

# 4. Lancer le bot
npm start
```

---

## 📦 Installation

### Prérequis

- **Node.js** 18+ ([Télécharger](https://nodejs.org/))
- **Compte Discord Developer** ([Créer](https://discord.com/developers/applications))
- **Compte Epic Games** (pour l'authentification API)

### 1️⃣ Cloner le projet

```bash
git clone https://github.com/ADR3-Club/Bot-Stats-Fortnite.git
cd Bot-Stats-Fortnite
npm install
```

### 2️⃣ Créer le bot Discord

1. Aller sur [Discord Developer Portal](https://discord.com/developers/applications)
2. **New Application** → Donner un nom (ex: `Fortnite Stats`)
3. Noter l'**Application ID** → Coller dans `.env` (`DISCORD_APP_ID`)
4. Onglet **Bot** → **Reset Token** → Coller dans `.env` (`DISCORD_TOKEN`)
5. **OAuth2** → **URL Generator** :
   - **Scopes** : `bot`, `applications.commands`
   - **Permissions** : `Send Messages`, `Embed Links`
   - **Permissions Integer** : `2048`
6. Inviter le bot sur ton serveur

### 3️⃣ Setup Epic Games Auth

```bash
npm run setup
```

1. Un lien s'affiche → Ouvre-le dans ton navigateur
2. Connecte-toi avec le compte Epic dédié au bot
3. Copie le `authorizationCode` de la réponse JSON
4. Colle-le dans le terminal
5. Les credentials sont sauvegardés dans `device_auth.json`

⚠️ **Important** : Utilise un compte Epic **dédié au bot**, pas ton compte principal.

---

## ⚙️ Configuration

### Fichier `.env`

```env
# Discord Bot Token (requis)
DISCORD_TOKEN=your_discord_bot_token_here

# Discord Application ID (requis)
DISCORD_APP_ID=your_application_id_here
```

### Fichier `device_auth.json` (généré automatiquement)

```json
{
  "accountId": "xxx",
  "deviceId": "xxx",
  "secret": "xxx"
}
```

---

## 🎮 Utilisation

### Démarrer le bot

```bash
# Mode développement
npm start

# Mode production (PM2)
pm2 start ecosystem.config.cjs
pm2 logs bot-stats-fortnite
```

### Commandes Discord

#### `/stats <pseudo> [mode]`

Affiche les stats d'un joueur.

```
/stats pseudo:Ninja
/stats pseudo:Ninja mode:zb_solo
```

---

#### `/link set <pseudo>`

Lie ton compte Epic à Discord.

```
/link set pseudo:MonPseudoEpic
```

---

#### `/link remove`

Supprime le lien avec ton compte Epic.

---

#### `/link status`

Affiche ton compte Epic lié.

---

#### `/me [mode]`

Affiche tes propres stats (compte lié requis).

```
/me
/me mode:reload_zb
```

---

#### `/leaderboard [stat]`

Classement des joueurs liés du serveur.

```
/leaderboard
/leaderboard stat:kills
```

**Stats disponibles** : `wins`, `kills`, `kd`, `matches`

---

## 🏗️ Architecture

### Structure du projet

```
Bot-Stats-Fortnite/
├── bot.js                    # Point d'entrée principal
├── setup-auth.js             # Script setup Epic Games
├── device_auth.json          # Credentials Epic (généré)
├── src/
│   ├── commands/
│   │   ├── stats.js          # /stats
│   │   ├── link.js           # /link
│   │   ├── me.js             # /me
│   │   └── leaderboard.js    # /leaderboard
│   ├── services/
│   │   ├── epicAuth.js       # Auth Epic via fnbr.js
│   │   └── epicStats.js      # Récupération stats
│   └── database/
│       └── db.js             # SQLite
├── data/
│   └── bot.db                # Base de données
├── logs/                     # Logs PM2
├── .env                      # Variables d'environnement
└── package.json
```

### Base de données

```sql
-- Comptes liés Discord <-> Epic
linked_accounts (discord_id, epic_account_id, epic_display_name, linked_at)

-- Cache des stats (5 min)
stats_cache (epic_account_id, stats_json, cached_at)
```

---

## 🛠️ Dépannage

### ❌ "device_auth.json manquant"

<details>
<summary><b>Générer les credentials</b></summary>

```bash
npm run setup
```

Suivez les instructions pour vous connecter à Epic Games.

</details>

### ❌ "Client Epic non connecté"

<details>
<summary><b>Vérifier les credentials</b></summary>

Les credentials Epic peuvent expirer si :
- Le mot de passe du compte a changé
- Le compte a été banni
- Epic a révoqué les sessions

**Solution** : Relancer `npm run setup`

</details>

### ❌ "Stats privées"

<details>
<summary><b>Activer les stats publiques</b></summary>

Le joueur doit activer ses stats publiques :
1. Ouvrir Fortnite
2. Paramètres → Compte → Confidentialité
3. Activer "Afficher sur les classements"

</details>

---

## ⚡ Optimisations

| Feature | Valeur | Description |
|---------|--------|-------------|
| **Cache stats** | 5 minutes | Évite les requêtes répétées |
| **Device Auth** | Persistant | Pas besoin de re-login |
| **SQLite WAL** | Activé | Meilleures performances DB |
| **Graceful shutdown** | ✅ | Déconnexion propre Epic + Discord |

---

## 🔐 Sécurité

- ⚠️ **Ne jamais commit** `.env` et `device_auth.json`
- 🔑 Utiliser un compte Epic **dédié au bot**
- 🛡️ Les credentials Device Auth sont liés à un seul compte
- 🔒 Base SQLite locale uniquement

---

## 🤝 Crédits

- [fnbr.js](https://fnbr.js.org/) - Bibliothèque Fortnite API
- [Discord.js](https://discord.js.org) - Bibliothèque Discord
- [Epic Games](https://epicgames.com) - API Stats

---

## 📝 Changelog

### v1.0.0 (Latest)
- 🎉 Release initiale
- 📊 Stats tous modes (ZB, Reload, Blitz)
- 🔗 Liaison compte Epic
- 🏅 Leaderboard serveur
- ⚡ Cache intelligent
- 🛡️ Auth Device Auth

---

## 📄 Licence

MIT © ADR3 Club

---

<div align="center">

**Fait avec ❤️ pour la communauté Fortnite**

[⬆ Retour en haut](#-fortnite-stats-bot)

</div>
