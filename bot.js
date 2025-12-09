// bot.js
import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType } from 'discord.js';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DateTime } from 'luxon';
import { initDb, runMaintenance } from './src/database/db.js';
import { initEpicClient, getEpicClient } from './src/services/epicAuth.js';
import { updateCurrentSeason } from './src/services/epicStats.js';
import { preloadIcons } from './src/lib/renderStats.js';

// ========= LOGGING =========
export function log(message, level = 'INFO') {
  const timestamp = DateTime.now()
    .setZone('Europe/Paris')
    .toFormat('dd/MM/yyyy - HH:mm:ss');
  console.log(`${timestamp} [${level}] ${message}`);
}

// ========= VALIDATION ENV =========
const { DISCORD_TOKEN, DISCORD_APP_ID } = process.env;
if (!DISCORD_TOKEN) {
  log('DISCORD_TOKEN manquant dans .env', 'ERROR');
  process.exit(1);
}
if (!DISCORD_APP_ID) {
  log('DISCORD_APP_ID manquant dans .env', 'ERROR');
  process.exit(1);
}

// Vérifier device_auth.json
if (!existsSync('device_auth.json')) {
  log('device_auth.json manquant. Lance: npm run setup', 'ERROR');
  process.exit(1);
}

// ========= CLIENT DISCORD =========
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Charger les commandes
const commandsPath = join(process.cwd(), 'src', 'commands');
if (existsSync(commandsPath)) {
  for (const file of readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    const mod = await import(`./src/commands/${file}`);
    if (mod?.data && mod?.execute) {
      client.commands.set(mod.data.name, mod);
      log(`Commande chargée: /${mod.data.name}`);
    }
  }
}

// ========= REGISTRATION COMMANDES =========
async function registerGuildCommands(guildId) {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const body = client.commands.map(c => c.data.toJSON());
  await rest.put(
    Routes.applicationGuildCommands(DISCORD_APP_ID, guildId),
    { body }
  );
  log(`Commandes déployées sur ${guildId}`);
}

// ========= EVENT READY =========
client.once('clientReady', async (c) => {
  log(`Discord connecté: ${c.user.tag}`);

  // Présence
  client.user.setPresence({
    status: 'online',
    activities: [{ name: 'vos stats Fortnite', type: ActivityType.Watching }],
  });

  // Init DB
  initDb();
  log('Base de données initialisée');

  // Maintenance au démarrage
  runMaintenance();

  // Précharger les icônes pour les cartes stats
  await preloadIcons();

  // Init Epic Client
  try {
    await initEpicClient();
    const epicClient = getEpicClient();
    log(`Epic connecté: ${epicClient.user.self.displayName}`);
  } catch (e) {
    log(`Erreur Epic: ${e.message}`, 'ERROR');
    log('Le bot fonctionne mais les stats ne seront pas disponibles', 'WARN');
  }

  // Mettre à jour la saison actuelle
  await updateCurrentSeason();

  // Déployer commandes sur toutes les guildes
  for (const [id] of client.guilds.cache) {
    try {
      await registerGuildCommands(id);
    } catch (e) {
      log(`Erreur déploiement ${id}: ${e.message}`, 'ERROR');
    }
  }

  log(`Actif sur ${client.guilds.cache.size} serveur(s)`);
});

// ========= EVENT GUILD JOIN =========
client.on('guildCreate', async (guild) => {
  try {
    await registerGuildCommands(guild.id);
    log(`Rejoint ${guild.name} — commandes déployées`);
  } catch (e) {
    log(`Erreur déploiement ${guild.id}: ${e.message}`, 'ERROR');
  }
});

// ========= INTERACTION HANDLER =========
client.on('interactionCreate', async (interaction) => {
  // Autocomplete
  if (interaction.isAutocomplete()) {
    const cmd = client.commands.get(interaction.commandName);
    if (cmd?.autocomplete) {
      try {
        await cmd.autocomplete(interaction);
      } catch (e) {
        log(`Erreur autocomplete: ${e.message}`, 'ERROR');
      }
    }
    return;
  }

  // Slash commands
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (e) {
    log(`Erreur commande /${interaction.commandName}: ${e.message}`, 'ERROR');
    const errorMsg = '❌ Une erreur est survenue.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errorMsg).catch(() => {});
    } else {
      await interaction.reply({ content: errorMsg, ephemeral: true }).catch(() => {});
    }
  }
});

// ========= EVENTS RECONNEXION =========
client.on('warn', info => log(`Warning: ${info}`, 'WARN'));
client.on('error', error => log(`Erreur: ${error.message}`, 'ERROR'));

client.on('shardDisconnect', (event, shardId) => {
  log(`Shard ${shardId} déconnecté (code: ${event.code})`, 'WARN');
});

client.on('shardReconnecting', shardId => {
  log(`Shard ${shardId} reconnexion...`);
});

client.on('shardResume', (shardId, replayedEvents) => {
  log(`Shard ${shardId} reconnecté (${replayedEvents} events rejoués)`);
});

client.on('shardError', (error, shardId) => {
  log(`Erreur shard ${shardId}: ${error.message}`, 'ERROR');
});

process.on('unhandledRejection', error => {
  log(`Unhandled rejection: ${error?.message || error}`, 'ERROR');
});

// ========= GRACEFUL SHUTDOWN =========
async function gracefulShutdown(signal) {
  log(`Signal ${signal} reçu, arrêt propre...`, 'WARN');

  try {
    // Déconnecter Epic
    const epicClient = getEpicClient();
    if (epicClient?.isReady) {
      await epicClient.logout();
      log('Epic déconnecté');
    }
  } catch (e) {
    log(`Erreur déconnexion Epic: ${e.message}`, 'ERROR');
  }

  try {
    if (client) {
      await client.destroy();
      log('Discord déconnecté');
    }
  } catch (e) {
    log(`Erreur déconnexion Discord: ${e.message}`, 'ERROR');
  }

  log('Arrêt propre terminé');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ========= LOGIN =========
client.login(DISCORD_TOKEN).catch(e => {
  log(`Échec connexion Discord: ${e.message}`, 'ERROR');
  process.exit(1);
});
