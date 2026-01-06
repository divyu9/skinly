const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

console.log('🔄 Fixing package versions...\n');

// CORRECT VERSIONS jo definitely exist karte hain
const correctVersions = {
  // Tailwind related
  "tailwindcss": "^3.4.0",
  "@tailwindcss/typography": "^0.5.10",  // 0.5.20 nahi, 0.5.10 hai
  "@tailwindcss/vite": "^0.5.0",
  "tailwind-merge": "^2.4.0",
  
  // Other common packages
  "@clerk/clerk-react": "^5.59.2",
  "convex": "^1.31.2",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "lucide-react": "^0.546.0",
  
  // Radix UI (sab latest)
  "@radix-ui/react-accordion": "^1.2.12",
  "@radix-ui/react-alert-dialog": "^1.1.15",
  
  // DND Kit
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0"
};

// Update dependencies
Object.keys(pkg.dependencies || {}).forEach(dep => {
  if (correctVersions[dep]) {
    console.log(`✅ ${dep}: ${pkg.dependencies[dep]} → ${correctVersions[dep]}`);
    pkg.dependencies[dep] = correctVersions[dep];
  }
});

// Update devDependencies bhi
Object.keys(pkg.devDependencies || {}).forEach(dep => {
  if (correctVersions[dep]) {
    console.log(`✅ ${dep}: ${pkg.devDependencies[dep]} → ${correctVersions[dep]}`);
    pkg.devDependencies[dep] = correctVersions[dep];
  }
});

// Save updated package.json
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('\n🎉 All versions fixed!');
console.log('\n📦 Now run: npm install --legacy-peer-deps');
