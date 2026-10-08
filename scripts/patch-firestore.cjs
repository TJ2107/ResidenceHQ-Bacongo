const fs = require('fs');
const path = require('path');

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. Replace the pendingResponses decrement with assertion in minified files
  // Match: this.ve -= 1, __PRIVATE_hardAssert(this.ve >= 0, 3241, { ... });
  content = content.replace(
    /this\.ve\s*-=\s*1\s*,\s*__PRIVATE_hardAssert\s*\(\s*this\.ve\s*>=\s*0\s*,\s*3241\s*,\s*\{[\s\S]*?\}\s*\);?/g,
    'this.ve = Math.max(0, this.ve - 1);'
  );

  // Match in unminified node.cjs:
  // this.pendingResponses -= 1;\n hardAssert(this.pendingResponses >= 0, 0x0ca9, { pendingResponses: this.pendingResponses });
  content = content.replace(
    /this\.pendingResponses\s*-=\s*1\s*;\s*hardAssert\s*\(\s*this\.pendingResponses\s*>=\s*0\s*,\s*(?:0x0ca9|0xca9|3241)\s*,\s*\{[\s\S]*?\}\s*\);?/g,
    'this.pendingResponses = Math.max(0, this.pendingResponses - 1);'
  );

  // 2. Add safety guard to __PRIVATE_hardAssert
  if (content.includes('function __PRIVATE_hardAssert(') && !content.includes('if (t === 3241')) {
    content = content.replace(
      /function __PRIVATE_hardAssert\((\w+),\s*(\w+),\s*(\w+),\s*(\w+)\)\s*\{/,
      'function __PRIVATE_hardAssert($1, $2, $3, $4) { if ($2 === 3241 || $2 === 0xca9 || $2 === 0xb815 || $2 === 0x0ca9) return;'
    );
  }

  // 3. Add safety guard to hardAssert
  if (content.includes('function hardAssert(') && !content.includes('if (assertionId === 0x0ca9')) {
    content = content.replace(
      /function hardAssert\((\w+),\s*(\w+)(?:,\s*(\w+))?\)\s*\{/,
      'function hardAssert($1, $2, $3) { if ($2 === 0x0ca9 || $2 === 0xca9 || $2 === 3241 || $2 === 0xb815) return;'
    );
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[patch-firestore] Patched: ${filePath}`);
    return true;
  }
  return false;
}

const targets = [
  'node_modules/@firebase/firestore/dist/common-edb5d170.esm.js',
  'node_modules/@firebase/firestore/dist/common-51e31ebf.cjs.js',
  'node_modules/@firebase/firestore/dist/common-882bbb15.node.cjs.js',
  'node_modules/@firebase/firestore/dist/common-63fc3a52.rn.js',
  'node_modules/@firebase/firestore/dist/intermediate/common.js',
  'node_modules/.vite/deps/firebase_firestore.js'
];

let totalPatched = 0;
for (const target of targets) {
  if (patchFile(path.resolve(process.cwd(), target))) {
    totalPatched++;
  }
}

console.log(`[patch-firestore] Total files patched: ${totalPatched}`);
