// src/lib/renderStats.js
import { createCanvas, registerFont, loadImage } from 'canvas';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Enregistrer la font Fortnite (Burbank Big Condensed Black)
const fontPath = join(__dirname, '../assets/fonts/Burbank Big Condensed Black.otf');
if (existsSync(fontPath)) {
  try {
    registerFont(fontPath, {
      family: 'Fortnite',
      weight: 'normal',
    });
    console.log('[INFO] Font Fortnite enregistrée');
  } catch (e) {
    console.log(`[ERROR] Erreur enregistrement font: ${e.message}`);
  }
} else {
  console.log(`[ERROR] Font non trouvée: ${fontPath}`);
}

// Cache pour les icônes chargées
const iconCache = {};
const ICONS_DIR = join(__dirname, '../assets/icons');

// Mapping des noms d'icônes vers les fichiers PNG
const ICON_FILES = {
  crown: 'trophée.png',
  crosshair: 'target.png',
  timer: 'time.png',
};

// Cache pour les backgrounds
const backgroundCache = {};
const BACKGROUNDS_DIR = join(__dirname, '../assets/backgrounds');

// Mapping des modes vers les fichiers de fond
const BACKGROUND_FILES = {
  'Reload': 'Reload_cleanup.jpg',
  'Blitz': 'Blitz_cleanup.jpg',
  'Zero Build': 'Classic_cleaup.jpg',
  'Zero Build Solo': 'Classic_cleaup.jpg',
  'Zero Build Duo': 'Classic_cleaup.jpg',
  'Zero Build Squad': 'Classic_cleaup.jpg',
};

/**
 * Charge une icône PNG et la met en cache
 */
async function loadIcon(name) {
  if (iconCache[name]) return iconCache[name];

  const fileName = ICON_FILES[name];
  if (!fileName) {
    return null;
  }

  const pngPath = join(ICONS_DIR, fileName);
  if (!existsSync(pngPath)) {
    console.log(`[WARN] Icône ${fileName} non trouvée`);
    return null;
  }

  try {
    const img = await loadImage(pngPath);
    iconCache[name] = img;
    return img;
  } catch (e) {
    console.log(`[WARN] Erreur chargement icône ${name}: ${e.message}`);
    return null;
  }
}

/**
 * Charge un background et le met en cache
 */
async function loadBackground(modeName) {
  if (backgroundCache[modeName]) return backgroundCache[modeName];

  const fileName = BACKGROUND_FILES[modeName];
  if (!fileName) return null;

  const bgPath = join(BACKGROUNDS_DIR, fileName);
  if (!existsSync(bgPath)) {
    console.log(`[WARN] Background ${fileName} non trouvé`);
    return null;
  }

  try {
    const img = await loadImage(bgPath);
    backgroundCache[modeName] = img;
    return img;
  } catch (e) {
    console.log(`[WARN] Erreur chargement background ${modeName}: ${e.message}`);
    return null;
  }
}

/**
 * Précharge toutes les icônes et backgrounds au démarrage
 */
export async function preloadIcons() {
  // Icônes
  const iconNames = Object.keys(ICON_FILES);
  for (const name of iconNames) {
    await loadIcon(name);
  }
  console.log(`[INFO] ${Object.keys(iconCache).length} icônes chargées`);

  // Backgrounds (uniquement les fichiers uniques)
  const uniqueBackgrounds = [...new Set(Object.values(BACKGROUND_FILES))];
  for (const fileName of uniqueBackgrounds) {
    const modeName = Object.keys(BACKGROUND_FILES).find(k => BACKGROUND_FILES[k] === fileName);
    if (modeName) await loadBackground(modeName);
  }
  console.log(`[INFO] ${Object.keys(backgroundCache).length} backgrounds chargés`);
}

// Dimensions de la carte (ratio fortnite.gg ~1.45:1)
const CARD_WIDTH = 900;
const CARD_HEIGHT = 620;

// Couleurs des barres de stats (fortnite.gg exact)
const STAT_BARS = [
  { bg: '#346487', icon: 'crown', labelColor: '#7eb8e0', stats: ['wins', 'winRate', 'matches'] },       // Bleu foncé
  { bg: '#803E91', icon: 'crosshair', labelColor: '#c090d0', stats: ['kd', 'killsPerMatch', 'kills'] }, // Violet
  { bg: '#943156', icon: 'timer', labelColor: '#e090a0', stats: ['playtime', 'avgMatchTime'] },         // Bordeaux
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
  // Essayer de charger le background du mode
  const background = backgroundCache[modeName] || await loadBackground(modeName);

  if (background) {
    // Utiliser l'image de fond (cover: remplir tout le canvas)
    const scale = Math.max(CARD_WIDTH / background.width, CARD_HEIGHT / background.height);
    const scaledWidth = background.width * scale;
    const scaledHeight = background.height * scale;
    const offsetX = (CARD_WIDTH - scaledWidth) / 2;
    const offsetY = (CARD_HEIGHT - scaledHeight) / 2;
    ctx.drawImage(background, offsetX, offsetY, scaledWidth, scaledHeight);
  } else {
    // Fallback: dégradé de fond (ciel bleu style Fortnite)
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
  }

  // === NOM DU MODE (Style fortnite.gg - Jaune/Orange italique) ===
  ctx.save();
  ctx.font = 'italic bold 58px Fortnite, Arial Black, sans-serif';

  // Dégradé jaune/orange pour le mode
  const modeGradient = ctx.createLinearGradient(35, 20, 400, 70);
  modeGradient.addColorStop(0, '#ffd700');  // Or
  modeGradient.addColorStop(0.5, '#ffb800');  // Orange doré
  modeGradient.addColorStop(1, '#ff9500');  // Orange
  ctx.fillStyle = modeGradient;

  // Ombre portée forte
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillText(modeName.toUpperCase(), 35, 60);
  ctx.restore();

  // === NOM DU JOUEUR ===
  ctx.save();
  ctx.font = 'bold 72px Fortnite, Arial Black, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillText(playerName, 35, 135);
  ctx.restore();

  // === PÉRIODE (sous le nom, style LEVEL - fortnite.gg) ===
  ctx.save();
  ctx.font = 'bold 30px Fortnite, Arial, sans-serif';
  // Couleur cyan pour la période (style LEVEL)
  ctx.fillStyle = '#00e5ff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.fillText(`LEVEL  ${period.toUpperCase()}`, 35, 180);
  ctx.restore();

  // === BARRES DE STATS (positions fortnite.gg exactes) ===
  const barStartY = 220;
  const barHeight = 100;
  const barGap = 12;
  const barWidth = 500;
  const barX = 80; // Décalé pour laisser place aux icônes à gauche
  const iconSize = 60;

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

    // Icône à gauche de la barre (style fortnite.gg)
    if (bar.icon) {
      const iconX = barX - 5; // Légèrement à gauche de la barre
      const iconY = y + barHeight / 2;
      drawIconColored(ctx, bar.icon, iconX, iconY, iconSize, bar.labelColor);
    }

    // Stats dans la barre (décalées pour laisser place à l'icône)
    const statsStartX = barX + 70; // Après l'icône
    const statsWidth = barWidth - 70;
    const statCount = bar.stats.length;
    const cellWidth = statsWidth / statCount;

    for (let j = 0; j < statCount; j++) {
      const statKey = bar.stats[j];
      const statInfo = statsData[statKey];
      if (!statInfo) continue;

      const cellX = statsStartX + cellWidth * j + cellWidth / 2;
      const cellY = y + barHeight / 2;

      // Séparation verticale (sauf pour la première colonne)
      if (j > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const sepX = statsStartX + cellWidth * j;
        ctx.moveTo(sepX, y + 18);
        ctx.lineTo(sepX, y + barHeight - 18);
        ctx.stroke();
        ctx.restore();
      }

      // Valeur (GRANDE, blanche, bold - style fortnite.gg)
      ctx.save();
      ctx.font = 'bold 54px Fortnite, Arial Black, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 3;
      ctx.fillText(statInfo.value, cellX, cellY + 8);
      ctx.restore();

      // Label (coloré selon la barre - style fortnite.gg)
      ctx.save();
      ctx.font = 'bold 18px Fortnite, Arial, sans-serif';
      ctx.fillStyle = bar.labelColor;
      ctx.textAlign = 'center';
      ctx.fillText(statInfo.label, cellX, cellY + 38);
      ctx.restore();
    }
  }

  // === FOOTER (style fortnite.gg/stats) ===
  ctx.save();
  // Fond du badge
  const footerText = 'BOT-STATS-FORTNITE';
  ctx.font = 'bold 18px Fortnite, Arial, sans-serif';
  const footerWidth = ctx.measureText(footerText).width + 20;
  const footerX = CARD_WIDTH - footerWidth - 15;
  const footerY = CARD_HEIGHT - 40;

  // Badge avec fond semi-transparent
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  roundRect(ctx, footerX, footerY, footerWidth, 28, 4);
  ctx.fill();

  // Texte du footer
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(footerText, footerX + 10, footerY + 20);
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
 * Dessine une grande icône (pour la barre de stats)
 * Utilise l'icône PNG si disponible, sinon fallback vectoriel
 */
function drawIconColored(ctx, type, x, y, size, color) {
  const icon = iconCache[type];

  if (icon) {
    // Dessiner l'icône PNG directement (déjà colorée)
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(icon, x - size / 2, y - size / 2, size, size);
    ctx.restore();
    return;
  }

  // Fallback vectoriel avec couleur
  drawIconVector(ctx, type, x, y, size, color);
}

/**
 * Dessine une icône vectorielle avec une couleur spécifique
 */
function drawIconVector(ctx, type, x, y, size, color = 'rgba(255, 255, 255, 0.9)') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = size / 2;

  switch (type) {
    case 'crown':
      ctx.beginPath();
      ctx.moveTo(x - s, y + s * 0.5);
      ctx.lineTo(x - s, y - s * 0.3);
      ctx.lineTo(x - s * 0.5, y + s * 0.1);
      ctx.lineTo(x, y - s * 0.6);
      ctx.lineTo(x + s * 0.5, y + s * 0.1);
      ctx.lineTo(x + s, y - s * 0.3);
      ctx.lineTo(x + s, y + s * 0.5);
      ctx.closePath();
      ctx.fill();
      // Base de la couronne
      ctx.fillRect(x - s, y + s * 0.5, s * 2, s * 0.2);
      break;

    case 'crosshair':
      ctx.beginPath();
      ctx.arc(x, y, s * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.9);
      ctx.lineTo(x, y - s * 0.55);
      ctx.moveTo(x, y + s * 0.55);
      ctx.lineTo(x, y + s * 0.9);
      ctx.moveTo(x - s * 0.9, y);
      ctx.lineTo(x - s * 0.55, y);
      ctx.moveTo(x + s * 0.55, y);
      ctx.lineTo(x + s * 0.9, y);
      ctx.stroke();
      break;

    case 'timer':
      ctx.beginPath();
      ctx.arc(x, y + s * 0.1, s * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      // Bouton du haut
      ctx.fillRect(x - s * 0.15, y - s * 0.8, s * 0.3, s * 0.25);
      // Aiguille
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.1);
      ctx.lineTo(x + s * 0.35, y - s * 0.25);
      ctx.stroke();
      break;

    default:
      // Cercle par défaut
      ctx.beginPath();
      ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      break;
  }

  ctx.restore();
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
