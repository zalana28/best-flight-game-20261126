// Gullwing Courier's hand-in program (Node 22, standard library only).
// It copies the game and its screenshots into the output directory and
// writes the dossier the judge reads, using the kit's vendored library.
// Run it with MAKEFUN_OUTPUT_DIR set outside the grader, or /output inside:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program must write the same bytes on every run.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

const dossierText = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierText);

// Second pass: read the output back and verify it is a complete hand-in
// before reporting success. A run that cannot prove its own output is a
// failed run, and the grader runs this program twice and compares bytes.
const writtenDossier = JSON.parse(readFileSync(join(outputDir, 'dossier.json'), 'utf8'));
if (typeof writtenDossier !== 'object' || writtenDossier === null) {
  throw new Error('dossier.json did not parse back as an object');
}
const gameFiles = readdirSync(join(outputDir, 'game'));
if (!gameFiles.includes('index.html')) throw new Error('game/index.html missing from output');
const shots = readdirSync(join(outputDir, 'screenshots')).filter((f) => !f.startsWith('.'));
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`expected 3-4 screenshots, found ${shots.length}`);
}
for (const shot of shots) {
  if (statSync(join(outputDir, 'screenshots', shot)).size > 262144) {
    throw new Error(`screenshot ${shot} is over the 256 KiB cap`);
  }
}
console.log(`Gullwing Courier handed in: ${gameFiles.length} top-level game entries, ${shots.length} screenshots, dossier ${dossierText.length} bytes`);
