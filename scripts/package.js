const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Get version from manifest.json
const manifestJson = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const version = manifestJson.version;

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Create output zip file
const output = fs.createWriteStream(path.join(distDir, `mcp-total-ext-v${version}.zip`));
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

// Handle errors
archive.on('error', (err) => {
  throw err;
});

// Listen for all archive data to be written
output.on('close', function () {
  console.log(`Packaging complete: dist/mcp-total-ext-v${version}.zip`);
  console.log(`Total size: ${archive.pointer()} bytes`);
});

// Pipe archive data to the output file
archive.pipe(output);

// Helper function to safely add files to the archive
function safelyAddFile(filePath, archivePath) {
  if (fs.existsSync(filePath)) {
    archive.file(filePath, { name: archivePath || path.basename(filePath) });
    console.log(`Added: ${filePath} as ${archivePath || path.basename(filePath)}`);
    return true;
  } else {
    console.warn(`Warning: File not found, skipping: ${filePath}`);
    return false;
  }
}

// Add manifest.json
safelyAddFile(path.join(distDir, 'manifest.json'), 'manifest.json');

// Add all built JavaScript files
// - Background scripts
safelyAddFile(path.join(distDir, 'src/background/background.js'), 'src/background/background.js');

// - Content scripts
safelyAddFile(path.join(distDir, 'src/content/content.js'), 'src/content/content.js');
safelyAddFile(path.join(distDir, 'src/content/mcp-bridge.js'), 'src/content/mcp-bridge.js');

// - Page scripts (web accessible resources)
safelyAddFile(path.join(distDir, 'src/page/monitor.js'), 'src/page/monitor.js');

// - MCPTotal scripts
safelyAddFile(path.join(distDir, 'src/mcptotal/mcpt.js'), 'src/mcptotal/mcpt.js');



// Add assets (icons)
const assetsDir = path.join(distDir, 'assets');
if (fs.existsSync(assetsDir)) {
  archive.directory(assetsDir, 'assets');
  console.log('Added: assets directory');
} else {
  console.warn('Warning: assets directory not found, skipping');
}

// Finalize the archive
archive.finalize();
