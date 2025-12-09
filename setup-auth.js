// setup-auth.js - Génère les credentials Epic Games Device Auth
import { Client } from 'fnbr';
import { writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

console.log('='.repeat(60));
console.log('   Setup Epic Games Device Auth pour Bot-Stats-Fortnite');
console.log('='.repeat(60));
console.log();

if (existsSync('device_auth.json')) {
  console.log('device_auth.json existe déjà.');
  const overwrite = await question('Écraser ? (o/n): ');
  if (overwrite.toLowerCase() !== 'o') {
    console.log('Annulé.');
    process.exit(0);
  }
}

console.log();
console.log('1. Ouvre ce lien dans ton navigateur :');
console.log();
console.log('   https://www.epicgames.com/id/api/redirect?clientId=3446cd72694c4a4485d81b77adbb2141&responseType=code');
console.log();
console.log('2. Connecte-toi avec le compte Epic du bot');
console.log('3. Copie le "authorizationCode" de la réponse JSON');
console.log();

const authCode = await question('Code d\'autorisation: ');

if (!authCode || authCode.length < 10) {
  console.error('Code invalide.');
  process.exit(1);
}

console.log();
console.log('Authentification en cours...');

try {
  const client = new Client({
    auth: {
      authorizationCode: authCode.trim(),
    },
  });

  // Capturer les device auth générés
  client.on('deviceauth:created', (da) => {
    const deviceAuth = {
      accountId: da.accountId,
      deviceId: da.deviceId,
      secret: da.secret,
    };

    writeFileSync('device_auth.json', JSON.stringify(deviceAuth, null, 2));

    console.log();
    console.log('Device Auth généré avec succès !');
    console.log();
    console.log('Fichier créé: device_auth.json');
    console.log();
    console.log('Contenu à ajouter dans .env :');
    console.log('-'.repeat(40));
    console.log(`EPIC_ACCOUNT_ID=${da.accountId}`);
    console.log(`EPIC_DEVICE_ID=${da.deviceId}`);
    console.log(`EPIC_SECRET=${da.secret}`);
    console.log('-'.repeat(40));
    console.log();
  });

  await client.login();

  console.log(`Connecté en tant que: ${client.user.self.displayName}`);
  console.log();

  await client.logout();

  console.log('Setup terminé ! Tu peux maintenant lancer le bot avec: npm start');

} catch (error) {
  console.error('Erreur:', error.message);

  if (error.message.includes('expired')) {
    console.log();
    console.log('Le code a expiré. Régénère-en un nouveau (valide 5 min).');
  }

  process.exit(1);
}

rl.close();
