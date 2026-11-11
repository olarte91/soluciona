import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  const content = readFileSync(filePath, 'utf-8');
  const vars = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    vars[key] = value;
  }

  return vars;
}

// 1. Cargar variables locales desde .env (si existe) y priorizar process.env (ej. Netlify)
const localEnv = {
  ...parseEnvFile(resolve(projectRoot, '..', '.env')),
  ...parseEnvFile(resolve(projectRoot, '.env'))
};

const supabaseUrl = process.env.SUPABASE_URL || localEnv.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || localEnv.SUPABASE_KEY || 'placeholder-key';

const envDir = resolve(projectRoot, 'src/environments');
mkdirSync(envDir, { recursive: true });

const createEnvContent = (isProduction) => `// Archivo generado automáticamente por scripts/set-env.mjs (NO versionar credenciales reales)
export const environment = {
  production: ${isProduction},
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabaseKey: ${JSON.stringify(supabaseKey)}
};
`;

writeFileSync(resolve(envDir, 'environment.ts'), createEnvContent(true), 'utf-8');
writeFileSync(resolve(envDir, 'environment.development.ts'), createEnvContent(false), 'utf-8');

const source = process.env.SUPABASE_URL ? 'variables de entorno del sistema (CI/Netlify)' : existsSync(resolve(projectRoot, '.env')) ? '.env local' : 'valores placeholder (modo demo)';
console.log(`[set-env] Environments generados usando ${source}.`);

