/**
 * GulfHive ERP - PDF Arabic Font Registry Utility
 * Locates and registers the OFL-licensed Amiri Arabic font families on any PDFKit document.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

export function registerArabicFonts(doc: any): void {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    let currentDir = __dirname;
    let fontsDir = '';

    // Traverse upwards to locate src/assets/fonts
    for (let i = 0; i < 5; i++) {
      const potentialPath = path.join(currentDir, 'src/assets/fonts');
      if (fs.existsSync(potentialPath)) {
        fontsDir = potentialPath;
        break;
      }
      const potentialPathAlt = path.join(currentDir, 'assets/fonts');
      if (fs.existsSync(potentialPathAlt)) {
        fontsDir = potentialPathAlt;
        break;
      }
      currentDir = path.dirname(currentDir);
    }

    if (!fontsDir) {
      // Direct absolute fallback for standard deployment layout
      const absoluteFallback = '/app/applet/src/assets/fonts';
      if (fs.existsSync(absoluteFallback)) {
        fontsDir = absoluteFallback;
      }
    }

    if (fontsDir) {
      const regularPath = path.join(fontsDir, 'Amiri-Regular.ttf');
      const boldPath = path.join(fontsDir, 'Amiri-Bold.ttf');

      if (fs.existsSync(regularPath)) {
        doc.registerFont('Amiri', regularPath);
      } else {
        console.warn(`[PDF Font Registry] Amiri-Regular.ttf not found at ${regularPath}`);
      }

      if (fs.existsSync(boldPath)) {
        doc.registerFont('Amiri-Bold', boldPath);
      } else {
        console.warn(`[PDF Font Registry] Amiri-Bold.ttf not found at ${boldPath}`);
      }
    } else {
      console.warn('[PDF Font Registry] Could not locate fonts directory in path traversal');
    }
  } catch (err) {
    console.error('[PDF Font Registry] Error during Arabic font registration:', err);
  }
}
