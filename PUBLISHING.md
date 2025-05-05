# Publishing to Chrome Web Store

Quick guide for submitting the extension to the Chrome Web Store and creating a high-quality listing that will help users discover your extension.

> **Note:** This file is primarily for project maintainers and can be excluded from the public repository if you prefer to keep your publishing process private. If included, it provides transparency about your release process to potential contributors.

## Pre-submission Checklist

- Update version in `manifest.json`
- Convert SVG icons to PNG if needed (some browsers have issues with SVG)
- Verify matches pattern is set to `https://chat.openai.com/*`
- Run `npm run build` followed by `npm run package` for distribution package

## Creating a Quality Store Listing

A high-quality listing helps your extension get discovered and builds trust with users. Chrome Web Store ranks extensions based on user ratings, usage statistics, and the quality of the listing itself.

### Item Title

- **Name**: "MCP for ChatGPT"
- Keep it clear, concise, and descriptive
- Accurately reflect the extension's core function
- Avoid keyword stuffing or generic superlatives

### Item Summary (132 characters max)

```
Connect ChatGPT to your own AI tools using Model Context Protocol (MCP) – extend ChatGPT with custom capabilities
```

This summary:
- Clearly explains what the extension does
- Highlights the main user benefit (extending ChatGPT)
- Avoids generic claims like "best extension ever"

### Item Description (16,000 characters max)

Format your description with:
- An overview paragraph explaining the purpose
- A clear list of features
- Information on how to get started

```
MCP for ChatGPT seamlessly integrates Model Context Protocol (MCP) servers with the ChatGPT interface, allowing you to extend ChatGPT with custom AI tools and capabilities.

✨ WHAT IT DOES
This extension lets you connect ChatGPT to your own MCP-compatible tools and services. Once connected, ChatGPT can use these tools directly in your conversations, enabling you to build and use custom AI capabilities beyond ChatGPT's built-in features.

🔑 KEY FEATURES
• Connect to multiple MCP servers simultaneously
• Automatically register tools from MCP servers with ChatGPT
• Use your tools directly within ChatGPT conversations
• Configure and manage servers easily through the browser UI
• Works with the standard Model Context Protocol

💡 PERFECT FOR
• Developers building custom AI tools
• Teams wanting to extend ChatGPT with specialized capabilities
• Anyone wanting to connect ChatGPT to their own data or services
• Researchers exploring AI tool interoperability

🔒 PRIVACY & SECURITY
• Your conversations stay private – we don't collect chat data
• Only tool parameters are sent to your configured MCP servers
• All server configurations are stored locally in your browser
• Minimal permissions required

⚙️ GETTING STARTED
1. Install the extension
2. Visit chat.openai.com
3. Connect to an MCP server by opening the configuration UI
4. Start using MCP tools in your ChatGPT conversations

For developers interested in creating MCP tools, visit the Model Context Protocol documentation to learn how to build compatible servers and tools.

This extension is not affiliated with OpenAI or ChatGPT.
```

### Category and Language

- **Category**: Tools
- **Language**: English (United States)
  - If supporting multiple languages, consider creating localized listings

## Image Assets Guidelines

### Store Icon (Required)

- **Size**: 128x128 pixels PNG
- **Best practices**:
  - Use a simple, recognizable design
  - Make sure it's consistent with your brand
  - Avoid screenshots or complex UI elements
  - Use appropriate colors that stand out

### Screenshots (Required, 1-5)

- **Size**: 1280x800 or 640x400 pixels
- **Format**: Use square corners, no padding (full bleed)
- **Content**:
  - Show the actual user experience
  - Focus on core features
  - Use the most up-to-date UI
  - Make sure images are clear and high-quality
  - Add visual aids to explain functionality
  - Avoid overwhelming text in the screenshots
  - Consider adding captions to explain features

- **Suggested screenshots for MCP for ChatGPT**:
  1. The extension showing tools being registered in ChatGPT
  2. A conversation with ChatGPT where a tool is being used
  3. The server configuration UI
  4. A successful tool execution result
  5. A before/after showing ChatGPT with and without tools

### Promotional Images (Optional but Recommended)

- **Small Promo Tile**: 440x280 pixels
  - Appears on homepage, category pages, and search results
  - Should be eye-catching but not too busy

- **Marquee Image**: 1400x560 pixels
  - Used if your extension is featured in the rotating carousel
  - Should be uncluttered and high-resolution

**Design Tips for Promotional Images**:
- Keep text minimal
- Use saturated colors that stand out
- Fill the entire region with no white borders
- Ensure branding is consistent with your other assets
- Make sure the image works when shrunk to half size
- Avoid claims like "Editor's Choice" or "Number One"

## Additional Information

- **Single Purpose Description** (1,000 chars max):
  ```
  This extension connects ChatGPT to MCP (Model Context Protocol) servers, allowing users to use custom AI tools directly within ChatGPT conversations. It extends ChatGPT's capabilities by integrating external tools without leaving the chat interface.
  ```

- **Website/Homepage URL**: Your project's GitHub page or documentation site
  - Builds trust with users
  - Provides more information about your extension

## Permission Justifications

Clear permission justifications help your extension get approved faster:

- **Host Permission Justification**:
  ```
  This extension requires host permissions to communicate with user-configured MCP servers (via *://*/*) and to intercept and modify requests to OpenAI's API (via https://api.openai.com/*) in order to register tools with ChatGPT and handle tool execution requests.
  ```

- **Remote Code Justification** (if "Yes, I am using remote code" is selected):
  ```
  The extension connects to user-configured MCP servers to discover and execute tools. These servers provide tool definitions and handle tool execution requests. The extension does not execute arbitrary code from these servers but rather processes structured tool definitions and executes tools through a sandboxed API.
  ```

## Data Usage Declaration

For the data collection section, ensure these are unchecked:
- [ ] Personally identifiable information
- [ ] Health information
- [ ] Financial and payment information
- [ ] Authentication information
- [ ] Personal communications
- [ ] Location
- [ ] Web history
- [ ] User activity
- [ ] Website content

Ensure these declarations are checked:
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

## Privacy Policy

- Host the included PRIVACY_POLICY.md on a publicly accessible URL
- Enter this URL in the Privacy Policy field

## Submission Process

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Create a new item and upload the package zip
3. Fill in all required information as outlined above
4. Submit for review (typically takes 2-3 business days)

## Update Process

1. Increment version in `manifest.json`
2. Make code changes and test thoroughly
3. Run `npm run package` for new package
4. Upload to Developer Dashboard
5. Submit for review

## Resources

- [Chrome Web Store Developer Documentation](https://developer.chrome.com/docs/webstore/)
- [Chrome Extension Developer Documentation](https://developer.chrome.com/docs/extensions/)
- [Chrome Web Store Quality Guidelines](https://developer.chrome.com/docs/webstore/program-policies/) 