# MCPTotal Extension

A Chrome extension that seamlessly integrates Model Context Protocol (MCP) server tools into the ChatGPT interface, enabling powerful AI-powered tool usage without leaving your chat.

## Features

- Seamlessly integrate tools from MCP servers into ChatGPT
- Review and edit tool responses before they're sent to ChatGPT
- Configure SSE-based MCP servers with a simple keyboard shortcut (<Ctrl>+M)
  - Stdio-based MCP servers could be adapted using mcp-proxy (https://github.com/sparfenyuk/mcp-proxy)
- Ability to configure auto-run and auto-send modes

## Getting Started

1. Install the extension (see below)
2. Visit chatgpt.com
3. Connect to an MCP server by opening the configuration UI (Ctrl+M)
4. Start using MCP tools in your ChatGPT conversations

### Example: Connecting to WhatsApp MCP

You can use WhatsApp directly from ChatGPT with the [whatsapp-mcp](https://github.com/lharries/whatsapp-mcp) server:

1. Clone the WhatsApp MCP repository:
   ```sh
   git clone https://github.com/lharries/whatsapp-mcp.git
   cd whatsapp-mcp
   ```

2. Run the bridge and scan the QR code:
   ```sh
   cd bridge
   go run main.go
   ```

3. Run the MCP server with mcp-proxy:
   ```sh
   cd whatsapp-mcp-server
   uvx mcp-proxy --sse-port=8090 uv run main.py
   ```

4. Connect the extension to `http://localhost:8090/sse`

5. Now you can use WhatsApp tools directly in your ChatGPT conversations!

## Installation

### From Chrome Web Store

*Coming soon*

### For Development

1. Clone this repository:
   ```sh
   git clone https://github.com/piiano/mcp-total-ext.git
   cd mcp-total-ext
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Load the extension in Chrome (three methods):
   - Navigate to: `chrome://extensions`
   - Enable "Developer mode" (toggle in top-right)

   #### Method 1: Load directly from the main folder
   - Click "Load unpacked" and select the project root directory

   #### Method 2: Build and load from 'dist'
   ```sh
   # Build the extension
   npm run build
   ```
   - Click "Load unpacked" and select the `dist` directory

   #### Method 3: Package and load the zip file
   ```sh
   # Build and package the extension
   npm run package
   ```
   - Drag and drop the generated zip file from `dist/mcp-total-ext-v[version].zip` onto the extensions page

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

### Using with stdio-based MCP Servers

You can use [mcp-proxy](https://github.com/sparfenyuk/mcp-proxy) to adapt stdio-based MCP servers to work with this extension:

1. Install mcp-proxy:
   ```sh
   uv tool install mcp-proxy
   # or
   pipx install mcp-proxy
   ```

2. Run your stdio-based MCP server through mcp-proxy:
   ```sh
   mcp-proxy --sse-port=8090 your-mcp-server-command
   ```

3. Connect the extension to `http://localhost:8090/sse`

### Managing MCP Servers

After opening ChatGPT with the extension active, you can add and manage MCP servers through the server configuration UI (available via keyboard shortcut or browser console)

## How It Works

This extension integrates with ChatGPT by:

1. Intercepting API calls to OpenAI servers
2. Adding MCP tool definitions to ChatGPT requests via the ChatGPT customization feature (system prompt)
3. Handling tool calls when requested by the AI
4. Returning tool results back to the conversation

The extension supports:
- Server management with connection testing
- Auto-discovery of MCP tools
- Tool parameter validation and conversion
- Proper error handling and user feedback

## Current Limitations

- **Limited number of tools**: Due to ChatGPT's customization limitations, only a limited number of tools can be registered at once. The exact limit may change based on OpenAI's policies.
- **Only tools are supported**: Currently, only tool functionality is supported. Future versions will add support for other MCP features like prompts, resources, notifications, etc.

## Key Components

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

## Troubleshooting

Common issues and solutions:
1. Server connection failures:
   - Check server URL and API key
   - Verify network connectivity
   - Check browser console for errors

2. Tool execution issues:
   - Verify tool parameters
   - Check server logs
   - Ensure server is enabled

3. UI problems:
   - Clear browser cache
   - Reload the extension
   - Check for console errors

Open Issues:
1. Support for StreamableHTTP
2. Bearer key as Authorization header, rather than request parameter (not supported yet by the SDK)
3. Support for other MCP features except simple tool fetching - prompts, resources, notifications etc.
4. Identify tool calling in more cases (e.g. in blocks or when two options are presented)

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to this project.

## License

[MIT License](LICENSE.md)

---

*This extension is not affiliated with OpenAI or ChatGPT*
