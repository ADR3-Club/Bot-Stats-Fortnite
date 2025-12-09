// src/services/epicAuth.js
import fnbr from 'fnbr';
const { Client } = fnbr;
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

let epicClient = null;

/**
 * Initialise le client Epic Games avec Device Auth
 */
export async function initEpicClient() {
  if (!existsSync('device_auth.json')) {
    throw new Error('device_auth.json non trouvé. Lance: npm run setup');
  }

  const deviceAuth = JSON.parse(readFileSync('device_auth.json', 'utf-8'));

  epicClient = new Client({
    auth: {
      deviceAuth: {
        accountId: deviceAuth.accountId,
        deviceId: deviceAuth.deviceId,
        secret: deviceAuth.secret,
      },
    },
    // Ne pas rejoindre de party automatiquement
    partyConfig: {
      joinConfirmation: false,
    },
  });

  // Mettre à jour device_auth si régénéré
  epicClient.on('deviceauth:created', (da) => {
    const newAuth = {
      accountId: da.accountId,
      deviceId: da.deviceId,
      secret: da.secret,
    };
    writeFileSync('device_auth.json', JSON.stringify(newAuth, null, 2));
  });

  await epicClient.login();

  return epicClient;
}

/**
 * Retourne le client Epic connecté
 */
export function getEpicClient() {
  return epicClient;
}

/**
 * Vérifie si le client est prêt
 */
export function isEpicReady() {
  return epicClient?.isReady ?? false;
}
