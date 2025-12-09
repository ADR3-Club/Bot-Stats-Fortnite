// src/lib/renderStats.js
import { createCanvas, registerFont, loadImage } from 'canvas';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

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

// Cache pour les icônes SVG chargées
const iconCache = {};
const ICONS_DIR = join(__dirname, '../assets/icons');

/**
 * Charge une icône SVG et la met en cache
 */
async function loadIcon(name) {
  if (iconCache[name]) return iconCache[name];

  const svgPath = join(ICONS_DIR, `${name}.svg`);
  if (!existsSync(svgPath)) {
    console.log(`[WARN] Icône ${name}.svg non trouvée`);
    return null;
  }

  try {
    // Lire le SVG et le convertir en data URL pour loadImage
    const svgContent = readFileSync(svgPath, 'utf-8');
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
    const img = await loadImage(dataUrl);
    iconCache[name] = img;
    return img;
  } catch (e) {
    console.log(`[WARN] Erreur chargement icône ${name}: ${e.message}`);
    return null;
  }
}

/**
 * Précharge toutes les icônes au démarrage
 */
export async function preloadIcons() {
  const iconNames = ['crown', 'percent', 'play', 'swords', 'crosshair', 'skull', 'clock', 'timer'];
  for (const name of iconNames) {
    await loadIcon(name);
  }
  console.log(`[INFO] ${Object.keys(iconCache).length} icônes chargées`);
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
 * @param {string} options.avatarUrl - URL de l'avatar Discord
 * @returns {Promise<Buffer>} - Image PNG
 */
export async function renderStatsCard({ playerName, modeName, stats, period = 'Lifetime', avatarUrl }) {
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

  // === AVATAR DISCORD (cercle en haut à droite) ===
  const avatarSize = 140;
  const avatarX = CARD_WIDTH - avatarSize - 25;
  const avatarY = 20;

  if (avatarUrl) {
    try {
      // Forcer le format PNG et une taille raisonnable
      const cleanUrl = avatarUrl.split('?')[0] + '?size=256';
      const avatar = await loadImage(cleanUrl);

      // Cercle de fond (bordure blanche)
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fill();
      ctx.restore();

      // Masque circulaire pour l'avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    } catch (e) {
      console.log(`[WARN] Avatar non chargé: ${e.message}`);
      // Dessiner un cercle placeholder
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
      ctx.restore();
    }
  }

  // === NOM DU MODE (Style fortnite.gg - Jaune/Orange italique) ===
  ctx.save();
  ctx.font = 'italic bold 52px Burbank, Arial Black, sans-serif';

  // Dégradé jaune/orange pour le mode
  const modeGradient = ctx.createLinearGradient(25, 15, 350, 60);
  modeGradient.addColorStop(0, '#ffd700');  // Or
  modeGradient.addColorStop(0.5, '#ffb800');  // Orange doré
  modeGradient.addColorStop(1, '#ff9500');  // Orange
  ctx.fillStyle = modeGradient;

  // Ombre portée forte
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  ctx.fillText(modeName.toUpperCase(), 25, 58);
  ctx.restore();

  // === NOM DU JOUEUR ===
  ctx.save();
  ctx.font = 'bold 64px Burbank, Arial Black, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 4;
  ctx.fillText(playerName, 25, 125);
  ctx.restore();

  // === PÉRIODE (sous le nom, style LEVEL) ===
  ctx.save();
  ctx.font = 'bold 26px Burbank, Arial, sans-serif';
  // Couleur cyan pour la période
  ctx.fillStyle = '#00e5ff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.fillText(period.toUpperCase(), 25, 158);
  ctx.restore();

  // === BARRES DE STATS ===
  const barStartY = 180;
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

      // Valeur (grande, blanche, bold)
      ctx.save();
      ctx.font = 'bold 40px Burbank, Arial Black, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 3;
      ctx.fillText(statInfo.value, cellX, cellY);
      ctx.restore();

      // Label avec icône vectorielle (petit, sous la valeur)
      ctx.save();
      ctx.font = 'bold 14px Burbank, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.textAlign = 'center';

      // Mesurer le label pour positionner l'icône
      const labelWidth = ctx.measureText(statInfo.label).width;
      const iconSize = 12;
      const gap = 4;
      const totalWidth = iconSize + gap + labelWidth;
      const startX = cellX - totalWidth / 2;

      // Dessiner l'icône
      if (statInfo.iconType) {
        drawIcon(ctx, statInfo.iconType, startX + iconSize / 2, cellY + 24, iconSize);
      }

      // Dessiner le label
      ctx.textAlign = 'left';
      ctx.fillText(statInfo.label, startX + iconSize + gap, cellY + 28);
      ctx.restore();
    }
  }

  // === FOOTER ===
  ctx.save();
  ctx.font = 'bold 16px Burbank, Arial, sans-serif';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.textAlign = 'right';
  ctx.fillText('BOT-STATS-FORTNITE', CARD_WIDTH - 20, CARD_HEIGHT - 15);
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
    wins: { value: wins.toLocaleString(), label: 'WINS', iconType: 'crown' },
    winRate: { value: `${winRate}%`, label: 'WIN RATE', iconType: 'percent' },
    matches: { value: matches.toLocaleString(), label: 'MATCHES', iconType: 'play' },
    kd: { value: kd, label: 'K/D', iconType: 'swords' },
    killsPerMatch: { value: killsPerMatch, label: 'KILLS/MATCH', iconType: 'crosshair' },
    kills: { value: kills.toLocaleString(), label: 'KILLS', iconType: 'skull' },
    playtime: { value: formatPlaytimeShort(minutesPlayed), label: 'PLAY TIME', iconType: 'clock' },
    avgMatchTime: { value: `${avgMatchTime}M`, label: 'AVG. MATCH', iconType: 'timer' },
  };
}

/**
 * Dessine une icône (SVG si disponible, sinon fallback vectoriel)
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} type - Type d'icône
 * @param {number} x - Position X (centre)
 * @param {number} y - Position Y (centre)
 * @param {number} size - Taille de l'icône
 */
function drawIcon(ctx, type, x, y, size) {
  // Essayer d'utiliser l'icône SVG en cache
  const icon = iconCache[type];
  if (icon) {
    ctx.save();
    ctx.drawImage(icon, x - size / 2, y - size / 2, size, size);
    ctx.restore();
    return;
  }

  // Fallback: dessiner l'icône vectoriellement
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = size / 2;

  switch (type) {
    case 'crown':
      ctx.beginPath();
      ctx.moveTo(x - s, y + s * 0.6);
      ctx.lineTo(x - s, y - s * 0.2);
      ctx.lineTo(x - s * 0.5, y + s * 0.2);
      ctx.lineTo(x, y - s * 0.6);
      ctx.lineTo(x + s * 0.5, y + s * 0.2);
      ctx.lineTo(x + s, y - s * 0.2);
      ctx.lineTo(x + s, y + s * 0.6);
      ctx.closePath();
      ctx.fill();
      break;

    case 'percent':
      ctx.font = `bold ${size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('%', x, y);
      break;

    case 'play':
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y - s * 0.7);
      ctx.lineTo(x + s * 0.7, y);
      ctx.lineTo(x - s * 0.4, y + s * 0.7);
      ctx.closePath();
      ctx.fill();
      break;

    case 'swords':
      ctx.beginPath();
      ctx.moveTo(x - s * 0.7, y + s * 0.7);
      ctx.lineTo(x + s * 0.7, y - s * 0.7);
      ctx.moveTo(x - s * 0.3, y - s * 0.1);
      ctx.lineTo(x + s * 0.1, y + s * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + s * 0.7, y + s * 0.7);
      ctx.lineTo(x - s * 0.7, y - s * 0.7);
      ctx.moveTo(x + s * 0.3, y - s * 0.1);
      ctx.lineTo(x - s * 0.1, y + s * 0.3);
      ctx.stroke();
      break;

    case 'crosshair':
      ctx.beginPath();
      ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.8);
      ctx.lineTo(x, y - s * 0.5);
      ctx.moveTo(x, y + s * 0.5);
      ctx.lineTo(x, y + s * 0.8);
      ctx.moveTo(x - s * 0.8, y);
      ctx.lineTo(x - s * 0.5, y);
      ctx.moveTo(x + s * 0.5, y);
      ctx.lineTo(x + s * 0.8, y);
      ctx.stroke();
      break;

    case 'skull':
      ctx.beginPath();
      ctx.arc(x, y - s * 0.1, s * 0.6, Math.PI, 0);
      ctx.lineTo(x + s * 0.6, y + s * 0.2);
      ctx.quadraticCurveTo(x + s * 0.3, y + s * 0.6, x, y + s * 0.4);
      ctx.quadraticCurveTo(x - s * 0.3, y + s * 0.6, x - s * 0.6, y + s * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(x - s * 0.25, y - s * 0.1, s * 0.15, 0, Math.PI * 2);
      ctx.arc(x + s * 0.25, y - s * 0.1, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'clock':
      ctx.beginPath();
      ctx.arc(x, y, s * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - s * 0.4);
      ctx.moveTo(x, y);
      ctx.lineTo(x + s * 0.3, y + s * 0.1);
      ctx.stroke();
      break;

    case 'timer':
      ctx.beginPath();
      ctx.arc(x, y + s * 0.1, s * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.15, y - s * 0.5);
      ctx.lineTo(x + s * 0.15, y - s * 0.5);
      ctx.lineTo(x + s * 0.15, y - s * 0.7);
      ctx.lineTo(x - s * 0.15, y - s * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.1);
      ctx.lineTo(x + s * 0.25, y - s * 0.2);
      ctx.stroke();
      break;

    default:
      break;
  }

  ctx.restore();
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
