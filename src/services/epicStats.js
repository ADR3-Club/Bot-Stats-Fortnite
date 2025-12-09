// src/services/epicStats.js
import { getEpicClient, isEpicReady } from './epicAuth.js';

// Mapping des modes de jeu
export const GAME_MODES = {
  // Battle Royale standard
  solo: { name: 'Solo', playlist: 'defaultsolo' },
  duo: { name: 'Duo', playlist: 'defaultduo' },
  squad: { name: 'Squad', playlist: 'defaultsquad' },

  // Zero Build
  zb_solo: { name: 'Zero Build Solo', playlist: 'nobuildbr_solo' },
  zb_duo: { name: 'Zero Build Duo', playlist: 'nobuildbr_duo' },
  zb_squad: { name: 'Zero Build Squad', playlist: 'nobuildbr_squad' },

  // Reload
  reload: { name: 'Reload', playlist: 'respawn' },
  reload_zb: { name: 'Reload Zero Build', playlist: 'respawn_nobuild' },

  // Autres modes
  blitz: { name: 'Blitz', playlist: 'blitz' },
  ranked_br: { name: 'Ranked BR', playlist: 'showdown' },
  ranked_zb: { name: 'Ranked Zero Build', playlist: 'showdown_nobuild' },
};

// Stats à récupérer
const STAT_KEYS = [
  'placetop1',      // Wins
  'kills',          // Kills
  'matchesplayed',  // Matches
  'minutesplayed',  // Time played
  'playersoutlived', // Players outlived
  'score',          // Score
];

/**
 * Recherche un joueur par son pseudo Epic
 * @param {string} displayName - Pseudo Epic Games
 * @returns {Promise<Object|null>} - Compte trouvé ou null
 */
export async function findPlayer(displayName) {
  if (!isEpicReady()) {
    throw new Error('Client Epic non connecté');
  }

  const client = getEpicClient();

  try {
    // Recherche par displayName via l'API HTTP
    const user = await client.http.sendEpicgamesRequest(
      true,
      'GET',
      `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/displayName/${encodeURIComponent(displayName)}`,
      'fortnite'
    );

    if (user) {
      return {
        id: user.id,
        displayName: user.displayName,
      };
    }
    return null;
  } catch (e) {
    if (e.code === 'errors.com.epicgames.account.account_not_found') {
      return null;
    }
    throw e;
  }
}

/**
 * Recherche un joueur par son ID Epic
 * @param {string} accountId - ID du compte Epic
 * @returns {Promise<Object|null>}
 */
export async function findPlayerById(accountId) {
  if (!isEpicReady()) {
    throw new Error('Client Epic non connecté');
  }

  const client = getEpicClient();

  try {
    const user = await client.http.sendEpicgamesRequest(
      true,
      'GET',
      `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/${accountId}`,
      'fortnite'
    );

    if (user) {
      return {
        id: user.id,
        displayName: user.displayName,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Récupère les stats d'un joueur
 * @param {string} accountId - ID du compte Epic
 * @returns {Promise<Object>} - Stats formatées
 */
export async function getPlayerStats(accountId) {
  if (!isEpicReady()) {
    throw new Error('Client Epic non connecté');
  }

  const client = getEpicClient();

  try {
    // Récupérer les stats brutes
    const stats = await client.getBRStats(accountId);

    if (!stats) {
      return null;
    }

    return formatStats(stats);
  } catch (e) {
    if (e.message?.includes('private')) {
      return { private: true };
    }
    throw e;
  }
}

/**
 * Formate les stats brutes en objet lisible
 */
function formatStats(rawStats) {
  const result = {
    overall: {
      wins: 0,
      kills: 0,
      matches: 0,
      kd: 0,
      winRate: 0,
      minutesPlayed: 0,
    },
    modes: {},
    inputTypes: ['keyboardmouse', 'gamepad', 'touch'],
  };

  // Parser les stats par input type et mode
  for (const inputType of result.inputTypes) {
    const inputStats = rawStats[inputType];
    if (!inputStats) continue;

    for (const [playlist, data] of Object.entries(inputStats)) {
      // Trouver le mode correspondant
      const modeKey = Object.keys(GAME_MODES).find(
        k => GAME_MODES[k].playlist === playlist.replace('playlist_', '')
      );

      const modeName = modeKey ? GAME_MODES[modeKey].name : playlist;

      if (!result.modes[modeName]) {
        result.modes[modeName] = {
          wins: 0,
          kills: 0,
          matches: 0,
          kd: 0,
          winRate: 0,
        };
      }

      // Accumuler les stats
      const wins = data.placetop1 || 0;
      const kills = data.kills || 0;
      const matches = data.matchesplayed || 0;

      result.modes[modeName].wins += wins;
      result.modes[modeName].kills += kills;
      result.modes[modeName].matches += matches;

      result.overall.wins += wins;
      result.overall.kills += kills;
      result.overall.matches += matches;
      result.overall.minutesPlayed += data.minutesplayed || 0;
    }
  }

  // Calculer K/D et Win Rate
  const deaths = result.overall.matches - result.overall.wins;
  result.overall.kd = deaths > 0 ? (result.overall.kills / deaths).toFixed(2) : result.overall.kills;
  result.overall.winRate = result.overall.matches > 0
    ? ((result.overall.wins / result.overall.matches) * 100).toFixed(1)
    : 0;

  for (const mode of Object.values(result.modes)) {
    const modeDeaths = mode.matches - mode.wins;
    mode.kd = modeDeaths > 0 ? (mode.kills / modeDeaths).toFixed(2) : mode.kills;
    mode.winRate = mode.matches > 0
      ? ((mode.wins / mode.matches) * 100).toFixed(1)
      : 0;
  }

  return result;
}

/**
 * Récupère les stats d'un mode spécifique
 * @param {string} accountId
 * @param {string} modeKey - Clé du mode (solo, duo, zb_solo, reload, etc.)
 */
export async function getPlayerStatsByMode(accountId, modeKey) {
  const stats = await getPlayerStats(accountId);

  if (!stats || stats.private) {
    return stats;
  }

  const mode = GAME_MODES[modeKey];
  if (!mode) {
    return null;
  }

  return stats.modes[mode.name] || null;
}

/**
 * Liste des modes disponibles pour l'autocomplétion
 */
export function getAvailableModes() {
  return Object.entries(GAME_MODES).map(([key, value]) => ({
    name: value.name,
    value: key,
  }));
}
