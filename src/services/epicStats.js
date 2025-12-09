// src/services/epicStats.js
import { getEpicClient, isEpicReady } from './epicAuth.js';

// Plateformes externes supportées
const EXTERNAL_PLATFORMS = {
  psn: 'psn',       // PlayStation Network
  xbl: 'xbl',       // Xbox Live
  nintendo: 'nintendo', // Nintendo Switch
};

// Mapping des modes de jeu - patterns pour matcher les playlists Epic
export const GAME_MODES = {
  // Battle Royale standard
  solo: { name: 'Solo', patterns: ['defaultsolo', 'brsolo'] },
  duo: { name: 'Duo', patterns: ['defaultduo', 'brduo'] },
  squad: { name: 'Squad', patterns: ['defaultsquad', 'brsquad', 'defaultsquads'] },

  // Zero Build
  zb_solo: { name: 'Zero Build Solo', patterns: ['nobuildbr_solo', 'nobuildbrsolo'] },
  zb_duo: { name: 'Zero Build Duo', patterns: ['nobuildbr_duo', 'nobuildbrduo'] },
  zb_squad: { name: 'Zero Build Squad', patterns: ['nobuildbr_squad', 'nobuildbrsquad'] },

  // Reload (différents noms internes: punchberry, tigerranch, piperboot, etc.)
  reload: { name: 'Reload', patterns: ['punchberry', 'tigerranch', 'piperboot', 'figment', 'respawn'] },
  reload_zb: { name: 'Reload Zero Build', patterns: ['punchberrynobuild', 'tigerranchnobuild', 'piperbootnobuild', 'figmentnobuild', 'respawn_nobuild'] },

  // Ranked (habanero = ranked)
  ranked_br: { name: 'Ranked BR', patterns: ['habanero_solo', 'habanero_duo', 'habanero_squad', 'showdown'] },
  ranked_zb: { name: 'Ranked Zero Build', patterns: ['nobuildbr_habanero', 'showdown_nobuild'] },

  // Autres modes
  blitz: { name: 'Blitz', patterns: ['blitz'] },
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
 * Recherche un joueur par son pseudo Epic ou plateforme externe
 * Essaie dans l'ordre: Epic > PSN > Xbox > Nintendo
 * @param {string} displayName - Pseudo Epic Games ou console
 * @returns {Promise<Object|null>} - Compte trouvé ou null
 */
export async function findPlayer(displayName) {
  if (!isEpicReady()) {
    throw new Error('Client Epic non connecté');
  }

  const client = getEpicClient();

  // 1. Essayer d'abord la recherche Epic directe
  try {
    const user = await client.user.fetch(displayName);

    if (user) {
      return {
        id: user.id,
        displayName: user.displayName,
      };
    }
  } catch (e) {
    // UserNotFoundError - continuer avec les plateformes externes
    if (e.name !== 'UserNotFoundError' && !e.message?.includes('not found')) {
      throw e;
    }
  }

  // 2. Essayer les plateformes externes (PSN, Xbox, Nintendo)
  for (const platform of Object.keys(EXTERNAL_PLATFORMS)) {
    try {
      const response = await client.http.epicgamesRequest({
        method: 'GET',
        url: `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/lookup/externalAuth/${platform}/displayName/${encodeURIComponent(displayName)}`,
      }, 'fortnite');

      if (response && response.id) {
        return {
          id: response.id,
          displayName: response.displayName || displayName,
          platform: platform,
          externalDisplayName: displayName,
        };
      }
    } catch {
      // Continuer avec la plateforme suivante
    }
  }

  return null;
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
    // fetch() accepte aussi les IDs de compte
    const user = await client.user.fetch(accountId);

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
 * Recherche un joueur par son pseudo sur une plateforme externe (PSN, Xbox, Nintendo)
 * @param {string} displayName - Pseudo sur la plateforme
 * @param {string} platform - Plateforme (psn, xbl, nintendo)
 * @returns {Promise<Object|null>}
 */
export async function findPlayerByExternalPlatform(displayName, platform) {
  if (!isEpicReady()) {
    throw new Error('Client Epic non connecté');
  }

  if (!EXTERNAL_PLATFORMS[platform]) {
    return null;
  }

  const client = getEpicClient();

  try {
    // Appel direct à l'API Epic Games pour lookup externe
    const response = await client.http.epicgamesRequest({
      method: 'GET',
      url: `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/lookup/externalAuth/${platform}/displayName/${encodeURIComponent(displayName)}`,
    }, 'fortnite');

    if (response && response.id) {
      return {
        id: response.id,
        displayName: response.displayName || displayName,
        platform: platform,
        externalDisplayName: displayName,
      };
    }
    return null;
  } catch (e) {
    // 404 = compte non trouvé
    if (e.code === 404 || e.message?.includes('not found')) {
      return null;
    }
    // Ignorer les erreurs silencieusement pour les recherches
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
 * Trouve le mode correspondant à une playlist
 */
function findModeForPlaylist(playlist) {
  for (const [modeKey, mode] of Object.entries(GAME_MODES)) {
    for (const pattern of mode.patterns) {
      if (playlist.includes(pattern)) {
        return { key: modeKey, name: mode.name };
      }
    }
  }
  return null;
}

/**
 * Formate les stats brutes en objet lisible
 * Format Epic: { data: { stats: { "br_kills_keyboardmouse_m0_playlist_xxx": value } } }
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
  };

  // Vérifier la structure
  const stats = rawStats?.data?.stats || rawStats?.stats || rawStats;
  if (!stats || typeof stats !== 'object') {
    return result;
  }

  // Parser les stats - format: br_{stat}_{input}_m0_playlist_{playlist}
  const playlistStats = {};

  for (const [key, value] of Object.entries(stats)) {
    // Extraire les infos de la clé
    const match = key.match(/^br_(\w+)_(?:keyboardmouse|gamepad|touch)_m0_playlist_(.+)$/);
    if (!match) continue;

    const [, statType, playlist] = match;

    // Trouver le mode
    const mode = findModeForPlaylist(playlist);
    const modeName = mode ? mode.name : playlist;

    if (!playlistStats[modeName]) {
      playlistStats[modeName] = {
        wins: 0,
        kills: 0,
        matches: 0,
        minutesPlayed: 0,
        playersOutlived: 0,
        score: 0,
      };
    }

    // Accumuler selon le type de stat
    if (statType === 'placetop1') {
      playlistStats[modeName].wins += value;
      result.overall.wins += value;
    } else if (statType === 'kills') {
      playlistStats[modeName].kills += value;
      result.overall.kills += value;
    } else if (statType === 'matchesplayed') {
      playlistStats[modeName].matches += value;
      result.overall.matches += value;
    } else if (statType === 'minutesplayed') {
      playlistStats[modeName].minutesPlayed += value;
      result.overall.minutesPlayed += value;
    } else if (statType === 'playersoutlived') {
      playlistStats[modeName].playersOutlived += value;
      result.overall.playersOutlived = (result.overall.playersOutlived || 0) + value;
    } else if (statType === 'score') {
      playlistStats[modeName].score += value;
      result.overall.score = (result.overall.score || 0) + value;
    }
  }

  // Calculer K/D et Win Rate pour chaque mode
  for (const [modeName, modeStats] of Object.entries(playlistStats)) {
    const deaths = modeStats.matches - modeStats.wins;
    result.modes[modeName] = {
      wins: modeStats.wins,
      kills: modeStats.kills,
      matches: modeStats.matches,
      minutesPlayed: modeStats.minutesPlayed,
      playersOutlived: modeStats.playersOutlived,
      score: modeStats.score,
      kd: deaths > 0 ? (modeStats.kills / deaths).toFixed(2) : modeStats.kills.toString(),
      winRate: modeStats.matches > 0
        ? ((modeStats.wins / modeStats.matches) * 100).toFixed(1)
        : '0',
    };
  }

  // Calculer K/D et Win Rate global
  const totalDeaths = result.overall.matches - result.overall.wins;
  result.overall.kd = totalDeaths > 0 ? (result.overall.kills / totalDeaths).toFixed(2) : result.overall.kills.toString();
  result.overall.winRate = result.overall.matches > 0
    ? ((result.overall.wins / result.overall.matches) * 100).toFixed(1)
    : '0';

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
