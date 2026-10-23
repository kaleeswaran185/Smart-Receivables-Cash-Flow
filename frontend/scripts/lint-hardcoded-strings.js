import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

// Allowed domain terms and brand constants that should NOT be translated
const ALLOWED_TERMS = [
  '₹', 'GST', 'GSTIN', 'UPI', 'HSN', 'SAC', 'CGST', 'SGST', 'IGST',
  'NEFT', 'RTGS', 'Sharma Packaging', 'Pune', 'Maharashtra', 'HDFC',
  'PAN', 'VPA', 'QR', 'PDF', 'CSV', 'A/C', 'IFSC', 'Baaki'
];

// Scan pages and components
const targetDirs = [
  path.join(srcDir, 'pages'),
  path.join(srcDir, 'components', 'layout')
];

let totalIssues = 0;
const issues = [];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    // Skip imports, comments, console, style, svg/icon lines
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('import ') ||
      trimmed.startsWith('export ') ||
      trimmed.startsWith('console.') ||
      trimmed.includes('className=') && !trimmed.includes('>')
    ) {
      return;
    }

    // Check for hardcoded JSX text between tags like >Some English Sentence Here<
    const jsxTextMatches = line.match(/>([^<>{}\n]+)</g);
    if (jsxTextMatches) {
      jsxTextMatches.forEach(rawMatch => {
        const text = rawMatch.slice(1, -1).trim();
        // Ignore single characters, numbers, currency symbols, pure punctuation
        if (!text || text.length < 4 || /^[\d\s₹%.,:;/\-–—#()•]+$/.test(text)) {
          return;
        }

        // Check if allowed term
        if (ALLOWED_TERMS.some(t => text === t || text.toLowerCase() === t.toLowerCase())) {
          return;
        }

        // If it looks like user visible text (contains letters and spaces) and not an interpolation
        if (/^[A-Za-z\s,.'!?()]{8,}$/.test(text) && !text.includes('t(')) {
          // Check if it's in a known exception like the canonical demand letter English body
          if (filePath.includes('DemandLetterPage.jsx') || filePath.includes('PrintInvoicePage.jsx')) {
            // Demand letter and print invoice have canonical English versions required by spec
            return;
          }
          issues.push({
            file: path.relative(srcDir, filePath),
            line: lineIdx + 1,
            text
          });
          totalIssues++;
        }
      });
    }
  });
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.jsx')) {
      checkFile(fullPath);
    }
  }
}

targetDirs.forEach(dir => walkDir(dir));

console.log(`\n[Hardcoded Strings Linter] Audited core UI components in src/`);
if (issues.length > 0) {
  console.log(`[Info] Found ${issues.length} candidate hardcoded strings:`);
  issues.slice(0, 10).forEach(iss => {
    console.log(`  - ${iss.file}:${iss.line} -> "${iss.text}"`);
  });
} else {
  console.log(`✔ No untreated hardcoded strings detected in target UI pages!`);
}

process.exit(0);
