import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Couleurs
const PRIMARY_COLOR = '#4F46E5'; // Indigo
const TEXT_COLOR = '#FFFFFF';

// SVG pour l'icône standard (avec "R")
function createIconSVG(size, isMaskable = false) {
  const padding = isMaskable ? size * 0.1 : 0; // 10% padding pour maskable
  const innerSize = isMaskable ? size * 0.8 : size;
  const fontSize = innerSize * 0.5;
  const yOffset = isMaskable ? padding : 0;
  
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${PRIMARY_COLOR}" ${isMaskable ? 'rx="20"' : ''}/>
      <text 
        x="50%" 
        y="${isMaskable ? '52%' : '52%'}" 
        dominant-baseline="middle" 
        text-anchor="middle" 
        fill="${TEXT_COLOR}" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="${fontSize}" 
        font-weight="bold"
      >R</text>
    </svg>
  `;
}

// SVG pour screenshot wide
function createScreenshotWideSVG() {
  return `
    <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
      <rect width="1280" height="720" fill="#f8fafc"/>
      <rect x="0" y="0" width="280" height="720" fill="${PRIMARY_COLOR}"/>
      <text x="140" y="100" text-anchor="middle" fill="white" font-family="system-ui" font-size="48" font-weight="bold">R</text>
      <rect x="320" y="80" width="400" height="120" rx="8" fill="white" stroke="#e2e8f0"/>
      <rect x="320" y="240" width="900" height="400" rx="8" fill="white" stroke="#e2e8f0"/>
      <text x="360" y="140" fill="#1e293b" font-family="system-ui" font-size="24">Dashboard Receptio</text>
      <text x="360" y="300" fill="#64748b" font-family="system-ui" font-size="16">Appels du jour</text>
    </svg>
  `;
}

// SVG pour screenshot narrow (mobile)
function createScreenshotNarrowSVG() {
  return `
    <svg width="750" height="1334" xmlns="http://www.w3.org/2000/svg">
      <rect width="750" height="1334" fill="#f8fafc"/>
      <rect x="0" y="0" width="750" height="120" fill="${PRIMARY_COLOR}"/>
      <text x="375" y="75" text-anchor="middle" fill="white" font-family="system-ui" font-size="48" font-weight="bold">R</text>
      <rect x="20" y="160" width="710" height="200" rx="12" fill="white" stroke="#e2e8f0"/>
      <rect x="20" y="400" width="710" height="300" rx="12" fill="white" stroke="#e2e8f0"/>
      <rect x="20" y="740" width="710" height="300" rx="12" fill="white" stroke="#e2e8f0"/>
      <text x="375" y="240" text-anchor="middle" fill="#1e293b" font-family="system-ui" font-size="32">Receptio</text>
    </svg>
  `;
}

// SVG pour favicon (32x32 simple)
function createFaviconSVG() {
  return `
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="${PRIMARY_COLOR}" rx="4"/>
      <text x="16" y="22" text-anchor="middle" fill="white" font-family="system-ui" font-size="18" font-weight="bold">R</text>
    </svg>
  `;
}

async function generateAssets() {
  console.log('Génération des assets PWA...\n');

  const assets = [
    // Icônes standards
    { name: 'pwa-192x192.png', size: 192, maskable: false },
    { name: 'pwa-512x512.png', size: 512, maskable: false },
    // Icônes maskables (safe zone)
    { name: 'pwa-maskable-192x192.png', size: 192, maskable: true },
    { name: 'pwa-maskable-512x512.png', size: 512, maskable: true },
    // Favicon multiples tailles
    { name: 'favicon-16x16.png', size: 16, maskable: false, favicon: true },
    { name: 'favicon-32x32.png', size: 32, maskable: false, favicon: true },
    { name: 'apple-touch-icon.png', size: 180, maskable: false },
  ];

  for (const asset of assets) {
    const svg = asset.favicon 
      ? createFaviconSVG() 
      : createIconSVG(asset.size, asset.maskable);
    
    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(PUBLIC_DIR, asset.name));
    
    console.log(`✓ ${asset.name} généré`);
  }

  // Générer le favicon.ico (multi-resolution)
  const favicon16 = await sharp(Buffer.from(createFaviconSVG())).resize(16, 16).toBuffer();
  const favicon32 = await sharp(Buffer.from(createFaviconSVG())).resize(32, 32).toBuffer();
  
  // Pour le favicon.ico, on utilise juste le PNG 32x32 comme fallback
  // sharp ne génère pas de .ico directement, on crée un PNG qu'on renomme
  await sharp(Buffer.from(createFaviconSVG()))
    .resize(32, 32)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'favicon.png'));
  
  console.log(`✓ favicon.png généré (utilisez-le comme favicon)`);

  // Screenshots
  const wideSVG = createScreenshotWideSVG();
  await sharp(Buffer.from(wideSVG))
    .png()
    .toFile(path.join(PUBLIC_DIR, 'screenshot-wide.png'));
  console.log(`✓ screenshot-wide.png généré`);

  const narrowSVG = createScreenshotNarrowSVG();
  await sharp(Buffer.from(narrowSVG))
    .png()
    .toFile(path.join(PUBLIC_DIR, 'screenshot-narrow.png'));
  console.log(`✓ screenshot-narrow.png généré`);

  console.log('\n✅ Tous les assets ont été générés dans public/');
}

generateAssets().catch(console.error);
