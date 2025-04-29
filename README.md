# MCP Tools for ChatGPT

A Chrome extension that seamlessly integrates Model Context Protocol (MCP) server tools into the ChatGPT interface, enabling powerful AI-powered tool usage without leaving your chat.

## Features

- Connect to multiple MCP servers simultaneously
- Automatically register tools from MCP servers with ChatGPT
- Execute MCP tools directly within ChatGPT conversations
- Server configuration management via browser UI
- Built-in demo tools for testing functionality
- Built on the official MCP protocol specification
- Asynchronous tool execution with proper error handling

## Installation

### From Chrome Web Store

*Coming soon*

### For Development

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/mcp-tools-for-chatgpt.git
   cd mcp-tools-for-chatgpt
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   # Build both MCP client and extension
   npm run build
   
   # For development mode with source maps
   npm run build:dev
   
   # For quicker iteration (skip rebuilding MCP client)
   npm run quick
   ```

4. Load in Chrome/Edge:
   - Navigate to: `chrome://extensions`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked" and select the `dist` directory
   - The extension is now active when you visit ChatGPT

## Project Structure

```
├── src/                       # Source code
│   ├── background/            # Service worker (background script)
│   │   └── background.js      # Handles MCP API communication
│   │
│   ├── content/               # Content scripts
│   │   ├── content.js         # Intercepts ChatGPT requests
│   │   └── mcp-bridge.js      # Bridges page context with extension
│   │
│   ├── mcpClient/             # MCP client implementation
│   │   ├── mcp-browser-entry.js    # Entry point for MCP client
│   │   └── mcp-browser-generated.js # Generated browser-compatible client
│   │
│   └── page/                  # Web accessible resources
│       ├── monitor.js         # Main entry point for page-side code
│       ├── page-client.js     # Client functionality
│       ├── tool-manager.js    # Tool registration and execution
│       ├── mcp-manager.js     # MCP server management
│       ├── mcp-ui.js          # UI components for server config
│       ├── ui-manager.js      # UI integration with ChatGPT
│       └── utils.js           # Utility functions
│
├── scripts/                   # Build scripts
│   ├── build.js               # Main build orchestration
│   ├── dev.js                 # Development server with auto-reload
│   ├── package.js             # Packaging for distribution
│   └── webpack.config.js      # Webpack configuration
│
├── dist/                      # Build output (not in repo)
│
├── icons/                     # Extension icons
│
└── tests/                     # Test utilities
```

## Development Commands

- **Development with auto-reload:** `npm run dev`
- **Build for development:** `npm run build:dev`
- **Build for production:** `npm run build`
- **Build MCP client only:** `npm run build:mcp`
- **Build extension without rebuilding MCP client:** `npm run quick`
- **Package for distribution:** `npm run package`
- **Run tests:** `npm test`
- **Lint code:** `npm run lint`
- **Format code:** `npm run format`

## Connecting to MCP Servers

### Default Local Server Configuration

By default, the extension is configured to connect to a local MCP server at:
```
http://localhost:8020/sse
```

### Testing with a Local Server

1. Install the extension in Chrome
2. Start a local MCP server:
   ```bash
   # Install FastMCP if you don't have it
   pip install fastmcp
   
   # Run the example server
   cd tests/mcp-client-server
   python server.py
   ```
3. The server will run on `http://localhost:8020` with a simple "greet" tool

### Managing MCP Servers

After opening ChatGPT with the extension active, you can add and manage MCP servers through:

1. The server configuration UI (available via keyboard shortcut or browser console)
2. Browser console commands for debugging:

```javascript
// Add a new MCP server
window.addMcpServer({
  id: "my-server",
  url: "http://localhost:8020/sse",
  apiKey: "", // Optional API key
  enabled: true
});

// List configured servers
window.getMcpServers();

// Enable/disable a server
window.setMcpServerStatus("my-server", true);

// Test connection to a server
window.testServerConnection("my-server");

// Toggle debug mode (requires page refresh)
window.setDebugMode(true);
```

## How It Works

This extension integrates with ChatGPT by:

1. Intercepting API calls to OpenAI servers
2. Adding MCP tool definitions to ChatGPT requests
3. Handling tool calls when requested by the AI
4. Returning tool results back to the conversation

The extension supports:
- Server management with connection testing
- Auto-discovery of MCP tools
- Tool parameter validation and conversion
- Proper error handling and user feedback

## Architecture

### Component Interaction

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  ChatGPT UI  │◄───┤Content Script│◄───┤Monitor Script│
└──────────────┘    └──────────────┘    └──────────────┘
                           ▲                    ▲
                           │                    │
                           ▼                    ▼
                    ┌──────────────┐    ┌──────────────┐
                    │Background    │◄───┤ MCP Manager  │
                    │Service Worker│    └──────────────┘
                    └──────────────┘           ▲
                           ▲                   │
                           │                   ▼
                           ▼            ┌──────────────┐
                    ┌──────────────┐    │ Tool Manager │
                    │  MCP Client  │    └──────────────┘
                    └──────────────┘
                           ▲
                           │
                           ▼
                    ┌──────────────┐
                    │  MCP Server  │
                    └──────────────┘
```

### Key Components

- **Content Script**: Injects monitor script and intercepts API calls
- **Monitor Script**: Manages tools and UI integration
- **MCP Manager**: Handles server configuration and tool discovery
- **Tool Manager**: Registers and executes tools
- **MCP Client**: Browser-compatible implementation of the MCP protocol

## Security & Privacy

- The extension does not store or transmit your chat content outside of OpenAI
- Tool calls are processed locally in your browser
- Only the specific arguments needed for tools are sent to MCP servers
- Permissions are limited to the minimum required

## Debug Mode

The extension includes a debug mode for development and testing:

1. Enable debug mode:
   ```javascript
   window.setDebugMode(true);
   ```
   Or add `?mcp_debug=true` to the ChatGPT URL

2. Debug mode features:
   - Dynamic module loading for faster iteration
   - Global access to component instances
   - Verbose logging
   - Additional debugging tools and UI

3. Open the MCP configuration UI directly:
   ```javascript
   window.openMcpConfig();
   ```

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to this project.

## License

[MIT License](LICENSE)

## Credits

Created by Ariel Shiftan.

---

*This extension is not affiliated with OpenAI or ChatGPT*
