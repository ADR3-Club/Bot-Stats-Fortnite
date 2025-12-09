// src/lib/renderStats.js
import { createCanvas, registerFont } from 'canvas';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Enregistrer la font Fortnite
try {
  registerFont(join(__dirname, '../assets/fonts/BurbankBigCondensed-Bold.otf'), {
    family: 'Burbank',
    weight: 'bold',
  });
} catch (e) {
  console.log('[WARN] Font Burbank non trouvée, utilisation de la font système');
}

// Dimensions de la carte
const CARD_WIDTH = 800;
const CARD_HEIGHT = 450;

// Couleurs des barres de stats (style fortnite.gg)
const STAT_BARS = [
  { bg: 'rgba(147, 81, 182, 0.95)', stats: ['wins', 'winRate', 'matches'] },      // Violet
  { bg: 'rgba(45, 135, 145, 0.95)', stats: ['kd', 'killsPerMatch', 'kills'] },    // Teal/Cyan
  { bg: 'rgba(85, 55, 120, 0.95)', stats: ['playtime', 'avgMatchTime'] },         // Violet foncé
];

/**
 * Génère une carte stats PNG pour un joueur
 * @param {Object} options
 * @param {string} options.playerName - Nom du joueur
 * @param {string} options.modeName - Nom du mode (Reload, Zero Build, Blitz)
 * @param {Object} options.stats - Stats du mode
 * @param {string} options.period - Période (Lifetime, C7S1, etc.)
 * @returns {Promise<Buffer>} - Image PNG
 */
export async function renderStatsCard({ playerName, modeName, stats, period = 'Lifetime' }) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // === FOND ===
  // Dégradé de fond (ciel bleu style Fortnite)
  const bgGradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bgGradient.addColorStop(0, '#4da6ff');
  bgGradient.addColorStop(0.4, '#6bb8ff');
  bgGradient.addColorStop(0.7, '#87ceeb');
  bgGradient.addColorStop(1, '#a8d8ea');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Décoration géométrique (triangles/formes style Fortnite)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.moveTo(CARD_WIDTH - 250, CARD_HEIGHT);
  ctx.lineTo(CARD_WIDTH, CARD_HEIGHT - 200);
  ctx.lineTo(CARD_WIDTH, CARD_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.moveTo(CARD_WIDTH - 120, 0);
  ctx.lineTo(CARD_WIDTH, 0);
  ctx.lineTo(CARD_WIDTH, 100);
  ctx.closePath();
  ctx.fill();

  // Petites formes décoratives
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(CARD_WIDTH - 80, CARD_HEIGHT - 100);
  ctx.lineTo(CARD_WIDTH - 30, CARD_HEIGHT - 150);
  ctx.lineTo(CARD_WIDTH - 30, CARD_HEIGHT - 100);
  ctx.closePath();
  ctx.fill();

  // === NOM DU MODE (Style fortnite.gg - Jaune/Orange italique) ===
  ctx.save();
  ctx.font = 'italic bold 48px Burbank, Arial Black, sans-serif';

  // Dégradé jaune/orange pour le mode
  const modeGradient = ctx.createLinearGradient(25, 15, 300, 60);
  modeGradient.addColorStop(0, '#ffd700');  // Or
  modeGradient.addColorStop(0.5, '#ffb800');  // Orange doré
  modeGradient.addColorStop(1, '#ff9500');  // Orange
  ctx.fillStyle = modeGradient;

  // Ombre portée
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillText(modeName.toUpperCase(), 25, 55);
  ctx.restore();

  // === NOM DU JOUEUR ===
  ctx.save();
  ctx.font = 'bold 58px Burbank, Arial Black, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillText(playerName, 25, 115);
  ctx.restore();

  // === PÉRIODE (sous le nom) ===
  ctx.save();
  ctx.font = 'bold 22px Burbank, Arial, sans-serif';
  // Couleur cyan/vert pour la période
  ctx.fillStyle = '#00ff88';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 3;
  ctx.fillText(`${period.toUpperCase()}`, 25, 145);
  ctx.restore();

  // === BARRES DE STATS ===
  const barStartY = 170;
  const barHeight = 80;
  const barGap = 8;
  const barWidth = 520;
  const barX = 20;

  // Préparer les données de stats
  const statsData = prepareStatsData(stats);

  for (let i = 0; i < STAT_BARS.length; i++) {
    const bar = STAT_BARS[i];
    const y = barStartY + (barHeight + barGap) * i;

    // Fond de la barre avec coins arrondis
    ctx.save();
    ctx.fillStyle = bar.bg;
    roundRect(ctx, barX, y, barWidth, barHeight, 12);
    ctx.fill();
    ctx.restore();

    // Stats dans la barre
    const statCount = bar.stats.length;
    const cellWidth = barWidth / statCount;

    for (let j = 0; j < statCount; j++) {
      const statKey = bar.stats[j];
      const statInfo = statsData[statKey];
      if (!statInfo) continue;

      const cellX = barX + cellWidth * j + cellWidth / 2;
      const cellY = y + barHeight / 2;

      // Icône (emoji style)
      ctx.save();
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(statInfo.icon || '', cellX - 50, cellY - 8);
      ctx.restore();

      // Valeur (grande, blanche)
      ctx.save();
      ctx.font = 'bold 36px Burbank, Arial Black, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 2;
      ctx.fillText(statInfo.value, cellX, cellY - 2);
      ctx.restore();

      // Label (petit, sous la valeur)
      ctx.save();
      ctx.font = 'bold 13px Burbank, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.textAlign = 'center';
      ctx.fillText(statInfo.label, cellX, cellY + 25);
      ctx.restore();
    }
  }

  // === FOOTER ===
  ctx.save();
  ctx.font = 'bold 14px Burbank, Arial, sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.textAlign = 'right';
  ctx.fillText('BOT-STATS-FORTNITE', CARD_WIDTH - 20, CARD_HEIGHT - 12);
  ctx.restore();

  return canvas.toBuffer('image/png');
}

/**
 * Prépare les données de stats pour l'affichage
 */
function prepareStatsData(stats) {
  const wins = stats?.wins || 0;
  const kills = stats?.kills || 0;
  const matches = stats?.matches || 0;
  const minutesPlayed = stats?.minutesPlayed || 0;

  const deaths = Math.max(matches - wins, 1);
  const kd = (kills / deaths).toFixed(2);
  const winRate = matches > 0 ? ((wins / matches) * 100).toFixed(1) : '0';
  const killsPerMatch = matches > 0 ? (kills / matches).toFixed(2) : '0';
  const avgMatchTime = matches > 0 ? Math.floor(minutesPlayed / matches) : 0;

  return {
    wins: { value: wins.toLocaleString(), label: 'WINS', icon: '🏆' },
    winRate: { value: `${winRate}%`, label: 'WIN RATE', icon: '' },
    matches: { value: matches.toLocaleString(), label: 'MATCHES', icon: '' },
    kd: { value: kd, label: 'K/D', icon: '🎯' },
    killsPerMatch: { value: killsPerMatch, label: 'KILLS/MATCH', icon: '' },
    kills: { value: kills.toLocaleString(), label: 'KILLS', icon: '' },
    playtime: { value: formatPlaytimeShort(minutesPlayed), label: 'PLAY TIME', icon: '⏱️' },
    avgMatchTime: { value: `${avgMatchTime}M`, label: 'AVG. MATCH', icon: '' },
  };
}

/**
 * Formate le temps de jeu en format court
 */
function formatPlaytimeShort(minutes) {
  if (!minutes) return '0H';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}D ${remainingHours}H`;
  }
  if (hours > 0) {
    return `${hours}H ${mins}M`;
  }
  return `${mins}M`;
}

/**
 * Dessine un rectangle avec coins arrondis
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
