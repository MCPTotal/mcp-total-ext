// ==============================
// ToolManager Class
// ==============================
class ToolManager {
  // Static properties
  static TOOL_PREFIX = 'TOOL:';
  static TOOL_PARAMS_PREFIX = 'PARAMS:';
  static SYSTEM_PROMPT_SEPARATOR = '===TOOLS-INSTRUCTIONS==='; // Add separator constant
  static SYSTEM_PROMPT_SEPARATOR_END = '===TOOLS-END===';
  static SYSTEM_PROMPT = `You have access to tools that I (the user) can run for you. You do NOT execute tools directly — instead, reply using the format below so I can run them and return the result.

---

### 🔧 Tool Call Format (STRICT)

Reply with tool calls ONLY in this exact format:
[TOOL_CALL]{"tool": "prefix-tool_name", "parameters": {"param1": "value1"}}[/TOOL_CALL]

- Tags [TOOL_CALL] and [/TOOL_CALL] must be exact.
- Use valid JSON.
- Include full tool name (e.g., with 'MCPT:' prefix).
- No other content or formatting.

---

### 🔁 One at a Time

Reply with ONE tool call per message.  
After that, STOP and wait for my reply with the result.  
Then continue based on that result. No batching.

---

### 🧭 IDs & Follow-ups

- If an \`id\` (e.g. \`page_id\`) is missing, call another tool to get it.
- If a result includes an ID, call another tool to resolve it to a readable name before replying.
- Never guess IDs. Ask if needed.
- Translate IDs to names in user-facing replies when possible.

---

### ✅ Behavior

- Be proactive. Complete tasks end-to-end.
- Prefer tool calls over questions if info can be looked up.
- Don’t mention tool names in replies — describe actions naturally.
- Don’t simulate tool results.
- Use only tools I provide.

Respond with tool calls when needed, and always wait for my response before continuing.

### 🔧 Available Tools:

`;

  constructor(uiManager, platformAdapter) {
    this.uiManager = uiManager;
    this.platformAdapter = platformAdapter;
    
    this.toolDefinitions = [];
    this.toolsDefinitionChanged = false;
    
    // Track processed nodes to avoid duplication
    this.processedNodes = new WeakMap();
    this.firstMessageUrl = null; // Store URL where first message was sent

    // Setup network interceptors
    this.setupNetworkInterceptors();
    
    // Setup tool call detection via MutationObserver
    this.setupDOMObserver();
  }

  registerTool(name, description, parameters, callback) {
    // Check if tool already exists
    const existingIndex = this.toolDefinitions.findIndex(tool => tool.name === name);

    const toolDefinition = {
      name,
      description,
      parameters: parameters || {},
      callback,
    };

    if (existingIndex >= 0) {
      // Update existing tool
      this.toolDefinitions[existingIndex] = toolDefinition;
    } else {
      // Add new tool
      this.toolDefinitions.push(toolDefinition);
    }

    //console.log(`📡 Registered tool: ${name}`);

    return toolDefinition;
  }
  
  updateTools(tools) {
    // Simple check to avoid updates if nothing changed
    if (tools.length === this.toolDefinitions.length) {
      // Check if all tools match
      let allMatch = true;
      
      for (let i = 0; i < tools.length; i++) {
        const newTool = tools[i];
        // Try to find a matching tool in current definitions
        const existingTool = this.toolDefinitions.find(t => t.name === newTool.name);
        
        // If no matching tool or properties differ, tools have changed
        if (!existingTool || 
            existingTool.description !== newTool.description || 
            JSON.stringify(existingTool.parameters || {}) !== 
              JSON.stringify(newTool.parameters || {})) {
          allMatch = false;
          break;
        }
      }
      
      if (allMatch) {
        //console.log('📡 Tools list unchanged, skipping update');
        return true;
      }
    }
    
    // If different, update with the new tools
    console.log('📡 Updating tools with new list');
    this.toolDefinitions = [];
    for (const tool of tools) {
      this.registerTool(
        tool.name, 
        tool.description, 
        tool.parameters, 
        tool.callback
      );
    }
    this.toolsDefinitionChanged = true;
    return true;
  }

  getToolByName(name) {
    return this.toolDefinitions.find(tool => tool.name === name);
  }

  executeToolCall(toolName, parameters) {
    console.log(`📡 Executing tool: ${toolName} with parameters:`, parameters);

    const tool = this.getToolByName(toolName);
    if (tool && typeof tool.callback === 'function') {
      try {
        return tool.callback(parameters);
      } catch (error) {
        console.error(`📡 Error executing tool ${toolName}:`, error);
        return `Error executing tool ${toolName}: ${error.message}`;
      }
    }

    return `Error: Unknown tool '${toolName}'`;
  }

  // Extract tool calls from text
  extractToolCalls(text) {
    const toolCalls = [];
    let startIndex = 0;
    
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const start = text.indexOf('[TOOL_CALL]', startIndex);
      if (start === -1) break;
      
      const end = text.indexOf('[/TOOL_CALL]', start);
      if (end === -1) break;
      
      const toolCallText = text.slice(start + '[TOOL_CALL]'.length, end);
      try {
        const toolCall = JSON.parse(toolCallText);
        if (toolCall.tool) {
          toolCalls.push({
            tool: toolCall.tool,
            parameters: toolCall.parameters || {},
            execute: () => this.executeToolCall(toolCall.tool, toolCall.parameters),
            toolCallText: text.slice(start, end + '[/TOOL_CALL]'.length)
          });
        }
      } catch (e) {
        console.error('📡 Error parsing tool call:', e);
      }
      
      startIndex = end + '[/TOOL_CALL]'.length;
    }
    
    if (toolCalls.length === 0) {
      console.warn('📡 !! No tool calls found in text:', text);
    }
    return toolCalls;
  }

  setupDOMObserver() {
    console.log('📡 Setting up MutationObserver for tool call detection');
    
 
    // Create a simple single observer that looks for new assistant messages
    this.observer = new MutationObserver((mutations) => {
      try {
        // Track nodes to process with delay
        //console.log('📡 MutationObserver triggered', mutations);

        const assistantNodesToProcess = new Set();
        const userNodesToProcess = new Set();
        
        for (const mutation of mutations) {

          const userMessage = this.platformAdapter.findUserMessageAncestor(mutation.target);
          if (userMessage) {
            userNodesToProcess.add(userMessage);
          }
          else if (mutation.target.querySelectorAll) {
            const userMessages = 
              mutation.target.querySelectorAll(this.platformAdapter.getSelectors().userMessage);
            if (userMessages.length > 0) {
              userMessages.forEach(message => {              
                userNodesToProcess.add(message);
              });
            }
          }
          
          const assistantMessage = 
            this.platformAdapter.findAssistantMessageAncestor(mutation.target);
          if (assistantMessage) {
            assistantNodesToProcess.add(assistantMessage);
          }
          else if (mutation.target.querySelector) {
            const assistantMessages = mutation.target.querySelectorAll(
              this.platformAdapter.getSelectors().assistantMessage
            );
            if (assistantMessages.length > 0) {
              assistantMessages.forEach(message => {              
                assistantNodesToProcess.add(message);
              });
            }
          }
        }
        assistantNodesToProcess.forEach(node => this.processAssistantMessageForToolCalls(node));
        userNodesToProcess.forEach(node => this.processUserMessage(node));
      } catch (error) {
        console.error('📡 Error processing nodes:', error);
      }
    });
    
    // Function to safely start the observer
    const startObserver = () => {
      // Check if we have access to the document
      if (typeof document === 'undefined') {
        console.log('📡 Document not available yet, will try again in 500ms');
        setTimeout(startObserver, 500);
        return;
      }
      
      // Find the main container using platform adapter
      const targetNode = document.body || document.documentElement;
      
      if (!targetNode) {
        console.log('📡 No valid target node found, will try again in 500ms');
        setTimeout(startObserver, 500);
        return;
      }
      
      try {
        // Process any existing assistant messages first using platform adapter
        const existingMessages = this.platformAdapter.getAssistantMessages();
        console.log(`📡 Found ${existingMessages.length} existing assistant messages`);
        existingMessages.forEach(message => this.processAssistantMessageForToolCalls(message));
        
        const existingUserMessages = this.platformAdapter.getUserMessages();
        console.log(`📡 Found ${existingUserMessages.length} existing user messages`);
        existingUserMessages.forEach(message => this.processUserMessage(message));
        
        // Then start observing for new ones
        this.observer.observe(targetNode, {
          childList: true,
          subtree: true,
          characterData: true
        });
        
        console.log(`📡 ***** Observer installed on ${
          targetNode.nodeName || 'unknown'} - watching for new messages`);
      } catch (error) {
        console.error('📡 Error setting up observer:', error);
      }
    };
    
    // Start the observer safely
    startObserver();
  }

  setupNetworkInterceptors() {
    const originalFetch = window.fetch;
    const self = this;
    
    window.fetch = async function() {
      try {
        const url = arguments[0]?.url || arguments[0];
        const options = arguments[1] || {};
      
        // Check if this is a message creation request to append the system prompt
        const isConversationRequest = self.platformAdapter
          .isConversationEndpoint(url, options.method);
        if (isConversationRequest) {
          try {
            self.lastMessageUrl = window.location.href;
            let bodyData = JSON.parse(options.body);
            //console.log("<<< ", bodyData);
            bodyData = self.injectSystemPrompt(bodyData);
            //console.log(">>> ", bodyData);
            options.body = JSON.stringify(bodyData);
          } catch (e) {
            console.error('📡 Error attempting to inject system prompt:', e);
          }
        }

      } catch (e) {
        console.error('📡 Error in fetch:', e);
      }
      // Make the original request and return it
      return originalFetch.apply(this, arguments);
    };
  }

  injectSystemPrompt(bodyData) {
    // Determine platform and check conditions
    const isFirstMessage = this.platformAdapter.getUserMessages().length === 0;
    
    let hasExplicitToken = false;
    let shouldInject = false;
    
    // Claude: Check for MCPT token in prompt
    hasExplicitToken = this.platformAdapter.hasExplicitToken(bodyData);
    shouldInject = this.toolsDefinitionChanged || isFirstMessage || hasExplicitToken;
    
    if (shouldInject) {
      // Generate system prompt with tools
      const toolsDefinitions = this.getToolsDefinitions();      
      // Get system prompt configuration from platform adapter
      const systemPrompt = [ToolManager.SYSTEM_PROMPT, ...toolsDefinitions].join('\n\n');
      const systemPromptWithSeparator = ToolManager.SYSTEM_PROMPT_SEPARATOR + 
        systemPrompt + ToolManager.SYSTEM_PROMPT_SEPARATOR_END;
      console.log('📡 Injecting system prompt' + 
        (isFirstMessage ? '(first in conversation)' : '(has MCPT token)'));
      
      bodyData = this.platformAdapter.appendSystemPrompt(
        bodyData, systemPromptWithSeparator, 'MCPT');

      // Set flag to prevent multiple injections
      this.toolsDefinitionChanged = false;
    }
    return bodyData;
  }
  
  getToolsDefinitions() {
    return this.toolDefinitions.map(tool => {
      let params = '';
      if (tool.parameters && Object.keys(tool.parameters).length > 0) {
        params = Object.entries(tool.parameters)
          .map(([name, param]) => `\t* ${name}: ${param.description}`)
          .join('\n');
        params = `\n${ToolManager.TOOL_PARAMS_PREFIX}\n${params}`;
      }
      return `${ToolManager.TOOL_PREFIX} ${tool.name}: ${tool.description}${params}`;
    });
  }
  
  // Checks if a node has already been processed with the current content
  hasProcessedNode(node) {
    if (!node) return false;
    
    // If content is provided, check if the node was processed with this exact content
    if (node.textContent !== undefined) {
      const processedContent = this.processedNodes.get(node);
      return processedContent === node.textContent;
    }
    
    // Otherwise just check if the node was processed at all
    return this.processedNodes.has(node);
  }

  // Marks a node as processed with the current content
  markNodeAsProcessed(node) {
    this.processedNodes.set(node, node.textContent);
  }


  // Function to find the deepest node containing the system prompt separator
  findDeepestNodeWithPrompt(node) {
    // If this is a text node and contains the separator, return it
    if (node.nodeType === Node.TEXT_NODE && 
        node.textContent && 
        node.textContent.includes(ToolManager.SYSTEM_PROMPT_SEPARATOR) &&
        node.textContent.includes(ToolManager.SYSTEM_PROMPT_SEPARATOR_END)) {
      return node;
    }
    
    // If this is an element node, check its children
    if (node.nodeType === Node.ELEMENT_NODE && node.childNodes.length > 0) {
      for (const child of node.childNodes) {
        const result = this.findDeepestNodeWithPrompt(child);
        if (result) return result;
      }
    }
    if (node.textContent && 
        node.textContent.includes(ToolManager.SYSTEM_PROMPT_SEPARATOR_END) && 
        node.textContent.includes(ToolManager.SYSTEM_PROMPT_SEPARATOR)) {
      return node;
    }
    
    // If we didn't find anything, return null
    return null;
  }

  processAssistantMessageForToolCalls(node) {
    //console.log('**************** Processing assistant message:', node, node.textContent);
    // Skip if already processed
    if (this.hasProcessedNode(node)) {
      return false; // Return false to indicate nothing was processed
    }
    this.markNodeAsProcessed(node);
    
    // Process children first (bottom-up approach)
    if (node.nodeType === Node.ELEMENT_NODE && node.childNodes.length > 0) {
      // Process all child nodes first
      let processed = false;
      for (const childNode of node.childNodes) {
        if (this.processAssistantMessageForToolCalls(childNode)) {
          processed = true;
        }
      }      
      if (processed) {
        return true;
      }
    }
    
    // Check if this node contains a tool call (only if no children were processed)
    const content = node.nodeType === Node.TEXT_NODE ? node.textContent : node.innerText || node.textContent || '';
    
    if (content && content.includes('[TOOL_CALL]') && content.includes('[/TOOL_CALL]')) {
      // Only process if this is the most specific element with the tool call
      // (not already processed)
      if (node.nodeType === Node.TEXT_NODE) {
        console.log('📡 Found tool call in text node:', {
          content: content,
          node: node,
          parentElement: node.parentElement
        });
      } else {
        console.log('📡 Found tool call in element:', {
          element: node,
          tagName: node.tagName,
          classList: node.classList ? Array.from(node.classList) : [],
          content: content
        });
      }
      
      // Process the content for tool calls
      const toolCalls = this.extractToolCalls(content);
      if (toolCalls.length > 0) {
        console.log('📡 Processing tool call in specific node:', toolCalls);
        
        // Find the best container for UI injection
        const targetElement = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        
        // Inject UI
        requestAnimationFrame(() => {
          console.log('****** Injecting tool result button for tool calls:', 
            toolCalls, targetElement);
          toolCalls.forEach(toolCall => {
            this.uiManager.injectToolResultButton(
              toolCall, 
              toolCall.execute, 
              toolCall.toolCallText, 
              targetElement, 
              window.location.href === this.lastMessageUrl
            );
          });
        });
        
        return true; // Indicate this branch was processed
      }
    }
    
    return false; // Return whether processing occurred
  }

  // Add a new method to hide system prompts in user messages
  processUserMessage(userMessageNode) {
    //console.log('**************** Processing user message:', userMessageNode, userMessageNode.textContent);
    if (!userMessageNode) return;
    if (this.hasProcessedNode(userMessageNode)) return;
    this.markNodeAsProcessed(userMessageNode);
    
    // Find all potential container divs in the user message
    const messageDivs = [userMessageNode];//userMessageNode.querySelectorAll('div');
    
    // First check if this message has already been processed
    for (const div of messageDivs) {
      if (div.querySelector('.tool-definitions-toggle')) {
        // Already processed
        return;
      }
    }
    
    // Go through each div and look for the system prompt
    for (const div of messageDivs) {
      // Find the deepest node containing the system prompt
      const deepestNode = this.findDeepestNodeWithPrompt(div);
      
      if (deepestNode) {
        console.log('📡 Found system prompt in deep node:', deepestNode);
        
        // Split the content by our separator
        const parts = deepestNode.textContent.split(ToolManager.SYSTEM_PROMPT_SEPARATOR);
        if (parts.length >= 2) {
          const userMessage = parts[0].trim();
          const toolDefinitions = parts[1].trim();
          
          // Update just this text node to remove the system prompt
          console.log('📡 Removing system prompt from user message:', deepestNode, userMessage, deepestNode.textContent);
          let parentElement = deepestNode.parentElement;
          if (deepestNode.nodeType === Node.TEXT_NODE) {
            deepestNode.textContent = userMessage;
          } else {
            const separator = ToolManager.SYSTEM_PROMPT_SEPARATOR;
            let found = false;
            
            const toRemove = [];
            for (let i = 0; i < deepestNode.childNodes.length; i++) {
              const child = deepestNode.childNodes[i];
              if (found) {
                toRemove.push(child);
              }
            
              if (!found && child.textContent?.includes(separator)) {
                found = true;
              }
              // if the child text content starts with the separator, remove it
              if (child.textContent?.startsWith(separator)) {
                toRemove.push(child);
              } else {
                // if the child text has user message before the separator, keep only it
                child.textContent = child.textContent.split(separator)[0];
              }
            }
            toRemove.forEach(child => child.remove());
            parentElement = deepestNode;
          }
          console.log('📡 Post removal user message:', deepestNode, deepestNode.textContent);
          
          // Use UIManager to create theme-aware system prompt toggle
          this.uiManager.createSystemPromptToggle(
            userMessage, 
            toolDefinitions.replace(ToolManager.SYSTEM_PROMPT_SEPARATOR_END, ''), 
            parentElement, 
            deepestNode
          );
          
          console.log('📡 Hidden system prompt in user message:', userMessage.substring(0, 50));
          
          break; // We only need to process one instance per message
        }
      }
    }    
  }
}

/* eslint-disable no-undef */
if (typeof exposeModule === 'function') {
  exposeModule(ToolManager);
} else {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToolManager;
  }
}
/* eslint-enable no-undef */ 
