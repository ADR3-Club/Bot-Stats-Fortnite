// src/services/epicStats.js
import { getEpicClient, isEpicReady } from './epicAuth.js';

// Plateformes externes supportées
const EXTERNAL_PLATFORMS = ['psn', 'xbl'];  // fortnite-api.com supporte psn et xbl

// Configuration des saisons Fortnite - mise à jour automatique au démarrage
// Fallback statique si l'API échoue
const SEASON_FALLBACKS = {
  c6s1: { name: 'Chapitre 6 Saison 1', shortName: 'C6S1', startDate: '2024-12-01T07:00:00Z' },
  c7s1: { name: 'Chapitre 7 Saison 1', shortName: 'C7S1', startDate: '2025-11-30T07:00:00Z' },
};

// Saison courante (mise à jour dynamiquement)
let currentSeason = {
  name: SEASON_FALLBACKS.c7s1.name,
  shortName: SEASON_FALLBACKS.c7s1.shortName,
  startDate: new Date(SEASON_FALLBACKS.c7s1.startDate),
  get startTime() { return Math.floor(this.startDate.getTime() / 1000); },
};

// Export SEASONS avec getter dynamique
export const SEASONS = {
  get current() { return currentSeason; },
};

/**
 * Récupère et met à jour la saison actuelle depuis fortnite-api.com
 * Appelé au démarrage du bot
 */
export async function updateCurrentSeason() {
  try {
    // Utiliser l'endpoint AES qui contient la version du build (ex: 39.00 = Season 39)
    const response = await fetch('https://fortnite-api.com/v2/aes', {
      headers: getFortniteApiHeaders(),
    });

    if (!response.ok) return;

    const data = await response.json();
    if (data.status !== 200 || !data.data?.build) return;

    // Extraire le numéro de version (ex: "+Fortnite+Release-39.00-CL-..." → 39)
    const buildMatch = data.data.build.match(/Release-(\d+)\./);
    if (!buildMatch) return;

    const seasonNumber = parseInt(buildMatch[1], 10);

    // Calculer chapitre et saison (Chapter 2 = Season 11-20, Chapter 3 = 21-24, etc.)
    // Seasons: C1=1-10, C2=11-18, C3=19-22, C4=23-26, C5=27-30, C6=31-34, OG=35-38, C7=39+
    let chapter, seasonInChapter;
    if (seasonNumber >= 39) {
      chapter = 7;
      seasonInChapter = seasonNumber - 38;
    } else if (seasonNumber >= 35) {
      chapter = 6; // OG seasons counted as C6
      seasonInChapter = seasonNumber - 34;
    } else if (seasonNumber >= 31) {
      chapter = 6;
      seasonInChapter = seasonNumber - 30;
    } else if (seasonNumber >= 27) {
      chapter = 5;
      seasonInChapter = seasonNumber - 26;
    } else {
      // Fallback pour anciennes saisons
      return;
    }

    const shortName = `C${chapter}S${seasonInChapter}`;
    const name = `Chapitre ${chapter} Saison ${seasonInChapter}`;

    // Chercher si on a une date de début dans les fallbacks
    const fallbackKey = `c${chapter}s${seasonInChapter}`;
    const fallback = SEASON_FALLBACKS[fallbackKey];

    if (fallback) {
      currentSeason = {
        name: fallback.name,
        shortName: fallback.shortName,
        startDate: new Date(fallback.startDate),
        get startTime() { return Math.floor(this.startDate.getTime() / 1000); },
      };
    } else {
      // Nouvelle saison non configurée - utiliser date approximative (saison dure ~90j)
      // On estime que la saison a commencé il y a moins de 90 jours
      const estimatedStart = new Date();
      estimatedStart.setDate(estimatedStart.getDate() - 45); // Milieu de saison approximatif
      estimatedStart.setHours(7, 0, 0, 0);

      currentSeason = {
        name,
        shortName,
        startDate: estimatedStart,
        get startTime() { return Math.floor(this.startDate.getTime() / 1000); },
      };

      console.log(`[WARN] Nouvelle saison détectée: ${shortName} - Date estimée. Ajouter dans SEASON_FALLBACKS.`);
    }

    console.log(`[INFO] Saison actuelle: ${currentSeason.shortName}`);
  } catch (e) {
    console.log(`[WARN] Impossible de récupérer la saison: ${e.message}`);
  }
}

// Headers pour fortnite-api.com (avec clé API si disponible)
function getFortniteApiHeaders() {
  const headers = {};
  if (process.env.FORTNITE_API_KEY) {
    headers['Authorization'] = process.env.FORTNITE_API_KEY;
  }
  return headers;
}

// Mapping des modes de jeu - patterns pour matcher les playlists Epic
// Modes: Reload ZB, Blitz, Zero Build (Solo/Duo/Squad + agrégé)
export const GAME_MODES = {
  // Reload Zero Build (patterns spécifiques avant patterns génériques)
  reload_zb: { name: 'Reload', patterns: [
    // Blastberry (actuel) - tous les variants nobuild
    'blastberry_nobuild', 'blastberrynobuild', 'nobuild_blastberry',
    'blastberry_duos_nobuild', 'blastberry_squads_nobuild', 'blastberry_trios_nobuild',
    // Anciens noms
    'punchberrynobuild', 'punchberry_nobuild', 'nobuild_punchberry',
    'tigerranchnobuild', 'tigerranch_nobuild', 'nobuild_tigerranch',
    'piperbootnobuild', 'piperboot_nobuild', 'nobuild_piperboot',
    'figmentnobuild', 'figment_nobuild', 'nobuild_figment',
    'respawn_nobuild', 'respawnnobuild', 'nobuild_respawn',
    // Fallback: tout blastberry (le mode actuel est ZB par défaut)
    'blastberry',
  ] },

  // Blitz
  blitz: { name: 'Blitz', patterns: ['blitz'] },

  // Zero Build - modes individuels (visibles dans les choix)
  zb_solo: { name: 'Zero Build Solo', patterns: ['nobuildbr_solo', 'nobuildbrsolo'] },
  zb_duo: { name: 'Zero Build Duo', patterns: ['nobuildbr_duo', 'nobuildbrduo'] },
  zb_squad: { name: 'Zero Build Squad', patterns: ['nobuildbr_squad', 'nobuildbrsquad'] },

  // Zero Build agrégé (Solo + Duo + Squad)
  zero_build: { name: 'Zero Build', patterns: [], aggregate: ['Zero Build Solo', 'Zero Build Duo', 'Zero Build Squad'] },
};


/**
 * Récupère le niveau Battle Royale d'un joueur via fortnite-api.com
 * @param {string} accountId - ID du compte Epic
 * @returns {Promise<number|null>} - Niveau ou null si erreur
 */
export async function getPlayerLevel(accountId) {
  try {
    const response = await fetch(
      `https://fortnite-api.com/v2/stats/br/v2/${accountId}`,
      { headers: getFortniteApiHeaders() }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.status === 200 && data.data?.battlePass?.level) {
      return data.data.battlePass.level;
    }
    return null;
  } catch (e) {
    console.log(`[WARN] Impossible de récupérer le niveau: ${e.message}`);
    return null;
  }
}

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
