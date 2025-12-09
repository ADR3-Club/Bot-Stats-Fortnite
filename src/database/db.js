// src/database/db.js
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';

let db = null;

/**
 * Initialise la base de données SQLite
 */
export function initDb() {
  // Créer le dossier data si nécessaire
  if (!existsSync('data')) {
    mkdirSync('data', { recursive: true });
  }

  db = new Database('data/bot.db');

  // Activer WAL mode pour de meilleures performances
  db.pragma('journal_mode = WAL');

  // Créer les tables
  db.exec(`
    -- Comptes Epic liés aux utilisateurs Discord
    CREATE TABLE IF NOT EXISTS linked_accounts (
      discord_id TEXT PRIMARY KEY,
      epic_account_id TEXT NOT NULL,
      epic_display_name TEXT NOT NULL,
      linked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Cache des stats (éviter trop de requêtes API)
    CREATE TABLE IF NOT EXISTS stats_cache (
      epic_account_id TEXT PRIMARY KEY,
      stats_json TEXT NOT NULL,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Index pour performance
    CREATE INDEX IF NOT EXISTS idx_linked_epic ON linked_accounts(epic_account_id);
    CREATE INDEX IF NOT EXISTS idx_cache_time ON stats_cache(cached_at);
  `);

  return db;
}

/**
 * Retourne l'instance de la base de données
 */
export function getDb() {
  if (!db) {
    throw new Error('Base de données non initialisée');
  }
  return db;
}

/**
 * Lie un compte Epic à un utilisateur Discord
 */
export function linkAccount(discordId, epicAccountId, epicDisplayName) {
  const db = getDb();
  db.prepare(`
    INSERT INTO linked_accounts (discord_id, epic_account_id, epic_display_name)
    VALUES (?, ?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET
      epic_account_id = excluded.epic_account_id,
      epic_display_name = excluded.epic_display_name,
      linked_at = CURRENT_TIMESTAMP
  `).run(discordId, epicAccountId, epicDisplayName);
}

/**
 * Récupère le compte Epic lié d'un utilisateur Discord
 */
export function getLinkedAccount(discordId) {
  const db = getDb();
  return db.prepare(`
    SELECT epic_account_id, epic_display_name, linked_at
    FROM linked_accounts
    WHERE discord_id = ?
  `).get(discordId);
}

/**
 * Supprime le lien d'un compte
 */
export function unlinkAccount(discordId) {
  const db = getDb();
  return db.prepare(`
    DELETE FROM linked_accounts WHERE discord_id = ?
  `).run(discordId);
}

/**
 * Cache les stats d'un joueur (durée: 5 minutes)
 */
export function cacheStats(epicAccountId, stats) {
  const db = getDb();
  db.prepare(`
    INSERT INTO stats_cache (epic_account_id, stats_json, cached_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(epic_account_id) DO UPDATE SET
      stats_json = excluded.stats_json,
      cached_at = CURRENT_TIMESTAMP
  `).run(epicAccountId, JSON.stringify(stats));
}

/**
 * Récupère les stats en cache (si < 5 minutes)
 */
export function getCachedStats(epicAccountId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT stats_json, cached_at
    FROM stats_cache
    WHERE epic_account_id = ?
      AND cached_at > datetime('now', '-5 minutes')
  `).get(epicAccountId);

  if (row) {
    return JSON.parse(row.stats_json);
  }
  return null;
}

/**
 * Maintenance: purge le cache expiré
 */
export function runMaintenance() {
  const db = getDb();

  // Supprimer le cache de plus de 1 heure
  const cacheResult = db.prepare(`
    DELETE FROM stats_cache
    WHERE cached_at < datetime('now', '-1 hour')
  `).run();

  if (cacheResult.changes > 0) {
    console.log(`Maintenance: ${cacheResult.changes} entrées de cache supprimées`);
  }
}

/**
 * Récupère le classement des joueurs liés par wins
 */
export function getLeaderboard(limit = 10) {
  const db = getDb();
  return db.prepare(`
    SELECT
      la.discord_id,
      la.epic_display_name,
      sc.stats_json
    FROM linked_accounts la
    LEFT JOIN stats_cache sc ON la.epic_account_id = sc.epic_account_id
    WHERE sc.stats_json IS NOT NULL
    ORDER BY json_extract(sc.stats_json, '$.overall.wins') DESC
    LIMIT ?
  `).all(limit);
}
