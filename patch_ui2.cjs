const fs = require('fs');
let content = fs.readFileSync('src/components/POS.tsx', 'utf8');

const targetRegex = /                    <div className="space-y-3">\n                      <div className="space-y-1\.5">/;

if (targetRegex.test(content)) {
  const replacement = `                      </>
                    )}

                    <div className="space-y-3">
                      <div className="space-y-1.5">`;

  content = content.replace(targetRegex, replacement);
  fs.writeFileSync('src/components/POS.tsx', content, 'utf8');
  console.log("UI Patched successfully!");
} else {
  console.log("Could not match the regex for the UI replacement.");
}
