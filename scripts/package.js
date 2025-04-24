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

// Listen for all archive data to be written
output.on('close', function() {
  console.log(`Packaging complete: dist/mcp-tools-for-chatgpt-v${version}.zip`);
  console.log(`Total size: ${archive.pointer()} bytes`);
});

// Pipe archive data to the output file
archive.pipe(output);

// Helper function to safely add files to the archive
function safelyAddFile(filePath, archivePath) {
  if (fs.existsSync(filePath)) {
    archive.file(filePath, { name: archivePath || path.basename(filePath) });
    console.log(`Added: ${filePath}`);
    return true;
  } else {
    console.warn(`Warning: File not found, skipping: ${filePath}`);
    return false;
  }
}

// Add required files to the zip
safelyAddFile('manifest.json', 'manifest.json');
safelyAddFile(path.join(distDir, 'content.js'), 'content.js');
safelyAddFile(path.join(distDir, 'monitor.js'), 'monitor.js');

// Optional files - add if they exist
safelyAddFile('README.md', 'README.md');
safelyAddFile('CHANGELOG.md', 'CHANGELOG.md');

// Add icon directory if it exists
if (fs.existsSync('icons')) {
  archive.directory('icons/', 'icons');
  console.log('Added: icons directory');
} else {
  console.warn('Warning: icons directory not found, skipping');
}

// Finalize the archive
archive.finalize();
