# MCP Tools for ChatGPT

A Chrome extension that seamlessly integrates Model Context Protocol (MCP) server tools into the ChatGPT interface, enabling powerful AI-powered tool usage without leaving your chat.

## Features

- Automatically register tools from MCP servers with ChatGPT
- Execute MCP tools directly within ChatGPT conversations
- Connect to multiple MCP servers simultaneously
- Server configuration management via browser UI

## Installation

### From Chrome Web Store

*Coming soon*

### For Development

1. Clone this repository:
   ```sh
   git clone https://github.com/piiano/mcp-chrome-ext.git
   cd mcp-chrome-ext
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Load the extension in Chrome (three methods):

   #### Method 1: Load directly from the main folder
   - Navigate to: `chrome://extensions`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked" and select the project root directory
   - The extension is now active when you visit ChatGPT

   #### Method 2: Build and load from 'dist'
   ```sh
   # Build the extension
   npm run build
   ```
   - Navigate to: `chrome://extensions`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked" and select the `dist` directory
   - The extension is now active when you visit ChatGPT

   #### Method 3: Package and load the zip file
   ```sh
   # Build and package the extension
   npm run package
   ```
   - Navigate to: `chrome://extensions`
   - Enable "Developer mode" (toggle in top-right)
   - Drag and drop the generated zip file from `dist/mcp-for-chatgpt-v[version].zip` onto the extensions page
   - The extension is now active when you visit ChatGPT

4. Other build options:
   ```sh
   # For development mode with source maps
   npm run build:dev
   
   # For quicker iteration (skip rebuilding MCP client)
   npm run quick
   ```

## Connecting to MCP Servers

### Default Local Server Configuration

By default, the extension is configured to connect to a local MCP server at:
```
http://localhost:8020/sse
```

### Testing with a Local Server

1. Install the extension in Chrome
2. Start a local MCP server:
   ```sh
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

TODO:
1. StreamableHTTP
2. Bearer key as Authorization header, rather than request parameter
3. Identify tool calling in more cases (e.g. in blocks or when two options are presented)
4. Support for other MCP features except simple tool fetching - prompts, resources, notifications etc.

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to this project.

## License

[MIT License](LICENSE.md)

---

*This extension is not affiliated with OpenAI or ChatGPT*
