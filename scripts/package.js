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
safelyAddFile(path.join(distDir, 'background/background.js'), 'background/background.js');

// - Content scripts
safelyAddFile(path.join(distDir, 'content/content.js'), 'content/content.js');
safelyAddFile(path.join(distDir, 'content/mcp-bridge.js'), 'content/mcp-bridge.js');

// - Page scripts (web accessible resources)
safelyAddFile(path.join(distDir, 'page/monitor-debug.js'), 'page/monitor-debug.js');
safelyAddFile(path.join(distDir, 'page/monitor-prod.js'), 'page/monitor-prod.js');
safelyAddFile(path.join(distDir, 'page/tool-manager.js'), 'page/tool-manager.js');
safelyAddFile(path.join(distDir, 'page/mcp-manager.js'), 'page/mcp-manager.js');
safelyAddFile(path.join(distDir, 'page/ui-manager.js'), 'page/ui-manager.js');
safelyAddFile(path.join(distDir, 'page/mcp-ui.js'), 'page/mcp-ui.js');
safelyAddFile(path.join(distDir, 'page/utils.js'), 'page/utils.js');
safelyAddFile(path.join(distDir, 'page/page-client.js'), 'page/page-client.js');

// Add MCP client
safelyAddFile(path.join(distDir, 'mcpClient/mcp-browser.js'), 'mcpClient/mcp-browser.js');

// Add assets (icons)
const assetsDir = path.join(distDir, 'assets');
if (fs.existsSync(assetsDir)) {
  archive.directory(assetsDir, 'assets');
  console.log('Added: assets directory');
} else {
  console.warn('Warning: assets directory not found, skipping');
}

// Add documentation files
safelyAddFile('README.md', 'README.md');
safelyAddFile('CHANGELOG.md', 'CHANGELOG.md');
safelyAddFile('LICENSE', 'LICENSE');

// Finalize the archive
archive.finalize();
