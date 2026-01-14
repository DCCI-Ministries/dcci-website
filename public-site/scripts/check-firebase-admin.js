/**
 * Build-time check to ensure firebase-admin is not imported in client-side code
 * 
 * This script scans for firebase-admin imports in:
 * - src/components/ (client components)
 * - Any .astro files that might import it client-side
 * 
 * firebase-admin should ONLY be imported in:
 * - src/lib/firebaseAdmin.ts (server-only)
 * - Astro frontmatter (server-side)
 * - API routes (server-side)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const FORBIDDEN_PATTERNS = [
  /import.*['"]firebase-admin['"]/,
  /import.*['"]\.\.\/lib\/firebaseAdmin['"]/,
  /import.*['"]\.\.\/\.\.\/lib\/firebaseAdmin['"]/,
  /from.*['"]firebase-admin['"]/,
  /from.*['"]\.\.\/lib\/firebaseAdmin['"]/,
  /from.*['"]\.\.\/\.\.\/lib\/firebaseAdmin['"]/,
];

const CLIENT_DIRS = [
  'src/components',
];

const ALLOWED_FILES = [
  'src/lib/firebaseAdmin.ts',
  'src/lib/firestore.ts',
];

function checkFile(filePath, relativePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    // Skip if it's an allowed file
    if (ALLOWED_FILES.some(allowed => relativePath.includes(allowed))) {
      return { violations: [] };
    }
    
    // Check for forbidden patterns
    const violations = [];
    FORBIDDEN_PATTERNS.forEach((pattern, index) => {
      const matches = content.match(pattern);
      if (matches) {
        const lines = content.split('\n');
        const lineNumber = lines.findIndex(line => pattern.test(line)) + 1;
        violations.push({
          pattern: pattern.toString(),
          line: lineNumber,
          match: matches[0]
        });
      }
    });
    
    return { violations };
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return { violations: [] };
  }
}

function scanDirectory(dir, baseDir = '') {
  const violations = [];
  
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = join(baseDir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        violations.push(...scanDirectory(fullPath, relativePath));
      } else if (stat.isFile()) {
        const ext = extname(entry);
        // Check .ts, .tsx, .js, .jsx, .astro files
        if (['.ts', '.tsx', '.js', '.jsx', '.astro'].includes(ext)) {
          const result = checkFile(fullPath, relativePath);
          if (result.violations.length > 0) {
            violations.push({
              file: relativePath,
              violations: result.violations
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dir}:`, error.message);
  }
  
  return violations;
}

// Main check
console.log('🔍 Checking for firebase-admin in client code...\n');

let totalViolations = 0;

// Check client directories
CLIENT_DIRS.forEach(dir => {
  const dirPath = join(process.cwd(), dir);
  try {
    if (statSync(dirPath).isDirectory()) {
      console.log(`Checking ${dir}/...`);
      const violations = scanDirectory(dirPath, dir);
      if (violations.length > 0) {
        violations.forEach(({ file, violations: fileViolations }) => {
          console.error(`\n❌ ${file}:`);
          fileViolations.forEach(v => {
            console.error(`   Line ${v.line}: ${v.match}`);
          });
          totalViolations += fileViolations.length;
        });
      }
    }
  } catch (error) {
    // Directory doesn't exist, skip
  }
});

// Check all .astro files for client-side imports (in <script> tags)
console.log('\nChecking .astro files for client-side firebase-admin imports...');
const astroFiles = scanDirectory(join(process.cwd(), 'src'), 'src')
  .filter(v => v.file.endsWith('.astro'));

if (astroFiles.length > 0) {
  astroFiles.forEach(({ file, violations }) => {
    // Check if import is in frontmatter (allowed) or in <script> tag (forbidden)
    const filePath = join(process.cwd(), file);
    const content = readFileSync(filePath, 'utf-8');
    const frontmatterEnd = content.indexOf('---', 3);
    
    violations.forEach(v => {
      const importIndex = content.indexOf(v.match);
      // If import is after frontmatter, it might be client-side
      if (importIndex > frontmatterEnd) {
        console.error(`\n❌ ${file}:`);
        console.error(`   Line ${v.line}: ${v.match}`);
        console.error(`   ⚠️  firebase-admin import found outside frontmatter (possibly client-side)`);
        totalViolations++;
      }
    });
  });
}

if (totalViolations > 0) {
  console.error(`\n❌ Found ${totalViolations} violation(s) of firebase-admin in client code!`);
  console.error('firebase-admin must ONLY be imported in server-side code (Astro frontmatter, API routes).');
  process.exit(1);
} else {
  console.log('✅ No firebase-admin found in client code. Build is safe.');
  process.exit(0);
}
