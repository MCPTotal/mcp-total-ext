const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Get version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Create output zip file
const output = fs.createWriteStream(path.join(distDir, `mcp-tools-for-chatgpt-v${version}.zip`));
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

// Handle errors
archive.on('error', (err) => {
  throw err;
});

// Pipe archive data to the output file
archive.pipe(output);

// Add files to the zip
archive.file('manifest.json', { name: 'manifest.json' });
archive.file(path.join(distDir, 'content.js'), { name: 'content.js' });
archive.file(path.join(distDir, 'options.js'), { name: 'options.js' });
archive.file('options.html', { name: 'options.html' });
archive.file('README.md', { name: 'README.md' });

// Add icon directory
archive.directory('icons/', 'icons');

// Finalize the archive
archive.finalize();

console.log(`Packaging complete: dist/mcp-tools-for-chatgpt-v${version}.zip`); 