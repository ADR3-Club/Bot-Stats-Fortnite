// src/services/epicStats.js
import { getEpicClient, isEpicReady } from './epicAuth.js';

// Plateformes externes supportées
const EXTERNAL_PLATFORMS = ['psn', 'xbl'];  // fortnite-api.com supporte psn et xbl

// Configuration des saisons Fortnite (timestamps en secondes UTC)
// Mise à jour nécessaire à chaque nouvelle saison
export const SEASONS = {
  c6s1: {
    name: 'Chapitre 6 Saison 1',
    shortName: 'C6S1',
    startDate: new Date('2024-12-01T07:00:00Z'),  // 1er décembre 2024 à 8h CET
    get startTime() { return Math.floor(this.startDate.getTime() / 1000); },
  },
  // Saison actuelle (alias)
  get current() { return this.c6s1; },
};

// Headers pour fortnite-api.com (avec clé API si disponible)
function getFortniteApiHeaders() {
  const headers = {};
  if (process.env.FORTNITE_API_KEY) {
    headers['Authorization'] = process.env.FORTNITE_API_KEY;
  }
  return headers;
}

// Mapping des modes de jeu - patterns pour matcher les playlists Epic
export const GAME_MODES = {
  // Battle Royale standard
  solo: { name: 'Solo', patterns: ['defaultsolo', 'brsolo'] },
  duo: { name: 'Duo', patterns: ['defaultduo', 'brduo'] },
  squad: { name: 'Squad', patterns: ['defaultsquad', 'brsquad', 'defaultsquads'] },

  // Zero Build (modes individuels)
  zb_solo: { name: 'Zero Build Solo', patterns: ['nobuildbr_solo', 'nobuildbrsolo'] },
  zb_duo: { name: 'Zero Build Duo', patterns: ['nobuildbr_duo', 'nobuildbrduo'] },
  zb_squad: { name: 'Zero Build Squad', patterns: ['nobuildbr_squad', 'nobuildbrsquad'] },

  // Zero Build agrégé (Solo + Duo + Squad, hors Reload)
  zero_build: { name: 'Zero Build', patterns: [], aggregate: ['Zero Build Solo', 'Zero Build Duo', 'Zero Build Squad'] },

  // Reload (noms internes: blastberry actuel, anciens: punchberry, tigerranch, piperboot, figment)
  reload: { name: 'Reload', patterns: [
    'blastberry',  // Nom actuel (2024+)
    'punchberry', 'tigerranch', 'piperboot', 'figment', 'respawn',  // Anciens noms
  ] },
  reload_zb: { name: 'Reload Zero Build', patterns: [
    // Blastberry (actuel)
    'blastberry_nobuild', 'blastberrynobuild', 'nobuild_blastberry',
    // Anciens noms
    'punchberrynobuild', 'punchberry_nobuild', 'nobuild_punchberry',
    'tigerranchnobuild', 'tigerranch_nobuild', 'nobuild_tigerranch',
    'piperbootnobuild', 'piperboot_nobuild', 'nobuild_piperboot',
    'figmentnobuild', 'figment_nobuild', 'nobuild_figment',
    'respawn_nobuild', 'respawnnobuild', 'nobuild_respawn',
  ] },

  // Ranked (habanero = ranked)
  ranked_br: { name: 'Ranked BR', patterns: ['habanero_solo', 'habanero_duo', 'habanero_squad', 'showdown'] },
  ranked_zb: { name: 'Ranked Zero Build', patterns: [
    'nobuildbr_habanero', 'showdown_nobuild',
    'habanero_nobuild_blastberry', 'habanero_blastberry_nobuild',  // Ranked Reload ZB
  ] },

  // Autres modes
  blitz: { name: 'Blitz', patterns: ['blitz'] },
};


/**
 * Recherche un joueur par son pseudo Epic ou plateforme externe
 * Essaie dans l'ordre: Epic > PSN > Xbox (via fortnite-api.com)
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

  // 2. Essayer les plateformes externes via fortnite-api.com (nécessite clé API)
  if (!process.env.FORTNITE_API_KEY) {
    // Sans clé API, le lookup PSN/Xbox ne marchera pas
    return null;
  }

  for (const platform of EXTERNAL_PLATFORMS) {
    try {
      const response = await fetch(
        `https://fortnite-api.com/v2/stats/br/v2?name=${encodeURIComponent(displayName)}&accountType=${platform}`,
        { headers: getFortniteApiHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === 200 && data.data?.account) {
          return {
            id: data.data.account.id,
            displayName: data.data.account.name,
            platform: platform,
            externalDisplayName: displayName,
          };
        }
      }
    } catch {
      // Continuer avec la plateforme suivante
    }
  }

  return null;
}

/**
 * Récupère les stats d'un joueur
 * @param {string} accountId - ID du compte Epic
 * @param {Object} options - Options de filtrage
 * @param {number} options.startTime - Timestamp en secondes (début de période)
 * @param {number} options.endTime - Timestamp en secondes (fin de période)
 * @returns {Promise<Object>} - Stats formatées
 */
export async function getPlayerStats(accountId, options = {}) {
  if (!isEpicReady()) {
    throw new Error('Client Epic non connecté');
  }

  const client = getEpicClient();

  try {
    // Récupérer les stats brutes (avec filtrage temporel si spécifié)
    const stats = await client.getBRStats(accountId, options.startTime, options.endTime);

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

  // Créer les modes agrégés
  for (const [, modeConfig] of Object.entries(GAME_MODES)) {
    if (!modeConfig.aggregate) continue;

    const aggregated = {
      wins: 0,
      kills: 0,
      matches: 0,
      minutesPlayed: 0,
      playersOutlived: 0,
      score: 0,
    };

    // Agréger les stats des modes sources
    for (const sourceName of modeConfig.aggregate) {
      const sourceStats = result.modes[sourceName];
      if (sourceStats) {
        aggregated.wins += sourceStats.wins;
        aggregated.kills += sourceStats.kills;
        aggregated.matches += sourceStats.matches;
        aggregated.minutesPlayed += sourceStats.minutesPlayed;
        aggregated.playersOutlived += sourceStats.playersOutlived || 0;
        aggregated.score += sourceStats.score || 0;
      }
    }

    // Calculer K/D et Win Rate si le mode a des parties
    if (aggregated.matches > 0) {
      const deaths = aggregated.matches - aggregated.wins;
      result.modes[modeConfig.name] = {
        ...aggregated,
        kd: deaths > 0 ? (aggregated.kills / deaths).toFixed(2) : aggregated.kills.toString(),
        winRate: ((aggregated.wins / aggregated.matches) * 100).toFixed(1),
      };
    }
  }

  return result;
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

/**
 * Formate le temps de jeu en format lisible
 * @param {number} minutes - Temps en minutes
 * @returns {string} - Temps formaté (ex: "5j 12h" ou "3h 45m")
 */
export function formatPlaytime(minutes) {
  if (!minutes) return '0h';
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}j ${remainingHours}h`;
  }
  return `${hours}h ${minutes % 60}m`;
}
