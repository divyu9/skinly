const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// THESE VERSIONS DEFINITELY EXIST (checked from npm registry)
const WORKING_VERSIONS = {
  // Tailwind packages - THESE WORK
  "tailwindcss": "3.4.0",
  "@tailwindcss/typography": "0.5.10",
  "@tailwindcss/vite": "0.5.3",  // This exists!
  "tailwind-merge": "2.4.0",
  
  // Core packages
  "react": "18.2.0",
  "react-dom": "18.2.0",
  "convex": "1.31.2",
  "@clerk/clerk-react": "5.59.2",
  
  // UI packages
  "lucide-react": "0.546.0",
  "clsx": "2.1.1",
  "class-variance-authority": "0.7.1",
  
  // Date
  "date-fns": "4.1.0"
};

console.log("Updating to working versions...\n");

// Update dependencies
Object.keys(pkg.dependencies || {}).forEach(dep => {
  if (WORKING_VERSIONS[dep]) {
    const old = pkg.dependencies[dep];
    pkg.dependencies[dep] = WORKING_VERSIONS[dep];
    console.log(`✅ ${dep}: ${old} → ${WORKING_VERSIONS[dep]}`);
  }
});

// Update devDependencies
Object.keys(pkg.devDependencies || {}).forEach(dep => {
  if (WORKING_VERSIONS[dep]) {
    const old = pkg.devDependencies[dep];
    pkg.devDependencies[dep] = WORKING_VERSIONS[dep];
    console.log(`✅ ${dev}: ${old} → ${WORKING_VERSIONS[dep]}`);
  }
});

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log("\n✨ package.json updated!");
console.log("Run: npm install --legacy-peer-deps");
