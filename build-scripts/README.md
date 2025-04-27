# FastMCP Browser Bundle

This directory contains scripts to create a browser-compatible version of the [fastmcp](https://www.npmjs.com/package/fastmcp) npm package.

## What This Does

The fastmcp package is primarily designed for Node.js environments. These scripts:

1. Import the fastmcp package
2. Create browser-compatible wrappers
3. Bundle everything into a single JavaScript file using webpack
4. Polyfill Node.js APIs required by the package
5. Produce a minified UMD module that can be loaded directly in a browser

## Prerequisites

- Node.js (>=14.x)
- npm

## Building

Run the build script:

```bash
./build.sh
```

This will:
1. Create necessary directories
2. Install required dependencies
3. Build the browser-compatible bundle
4. Copy the bundle to the extension's `src` directory

## Output

The build process produces:

- `dist/fastmcp-browser.js` - The bundled library
- A copy in `src/fastmcp-browser.js` for use by the extension

## Usage in the Extension

The bundle exports a global `FastMCP` object with these components:

- `FastMCP.Client` - Browser-friendly MCP client
- `FastMCP.Server` - Browser-friendly MCP server
- `FastMCP.FastMCP` - Original FastMCP class
- `FastMCP.OriginalClient` - Original Client class
- `FastMCP.SSEClientTransport` - SSE transport

### Integration

The extension includes a wrapper (`src/modules/FastMcpClient.js`) that provides a simpler interface around the bundled library.

```javascript
// Create a client instance
const client = new FastMcpClient('http://localhost:8020/sse');

// Connect to the server
await client.connect();

// List available tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool('greet', { name: 'Browser' });

// Disconnect when done
await client.disconnect();
```

## Troubleshooting

If you encounter errors:

1. Check if all dependencies are installed
2. Verify that webpack configuration is correct
3. Check for Node.js compatibility issues
4. Look for CSP issues in the browser console

## Limitations

- Some Node.js specific features may not work
- Network operations may be affected by browser security policies
- WebSocket or raw TCP connections are not supported in browsers
- Only Server-Sent Events (SSE) transport is fully supported 