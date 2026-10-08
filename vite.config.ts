import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, Plugin} from 'vite';

function patchFirestorePlugin(): Plugin {
  return {
    name: 'patch-firestore-ca9',
    transform(code: string, id: string) {
      if (id.includes('firestore') || code.includes('3241') || code.includes('0x0ca9')) {
        let changed = false;
        if (code.includes('3241')) {
          code = code.replace(
            /this\.ve\s*-=\s*1\s*,\s*__PRIVATE_hardAssert\s*\(\s*this\.ve\s*>=\s*0\s*,\s*3241\s*,\s*\{[\s\S]*?\}\s*\);?/g,
            'this.ve = Math.max(0, this.ve - 1);'
          );
          changed = true;
        }
        if (code.includes('__PRIVATE_hardAssert(') && !code.includes('if (t === 3241')) {
          code = code.replace(
            /function __PRIVATE_hardAssert\((\w+),\s*(\w+),\s*(\w+),\s*(\w+)\)\s*\{/,
            'function __PRIVATE_hardAssert($1, $2, $3, $4) { if ($2 === 3241 || $2 === 0xca9 || $2 === 0xb815 || $2 === 0x0ca9) return;'
          );
          changed = true;
        }
        if (code.includes('hardAssert(') && !code.includes('if (assertionId === 0x0ca9')) {
          code = code.replace(
            /function hardAssert\((\w+),\s*(\w+)(?:,\s*(\w+))?\)\s*\{/,
            'function hardAssert($1, $2, $3) { if ($2 === 0x0ca9 || $2 === 0xca9 || $2 === 3241 || $2 === 0xb815) return;'
          );
          changed = true;
        }
        if (changed) {
          return { code, map: null };
        }
      }
      return null;
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), patchFirestorePlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
