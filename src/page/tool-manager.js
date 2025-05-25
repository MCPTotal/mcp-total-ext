// ==============================
// ToolManager Class
// ==============================
class ToolManager {
  // Static properties
  static TOOL_PREFIX = "TOOL:"
  static TOOL_PARAMS_PREFIX = "PARAMS:"
  static SYSTEM_PROMPT_SEPARATOR = '\n\n===INSTRUCTIONS===\n\n'; // Add separator constant
  static SYSTEM_PROMPT = `I have access to several tools, I can run for you when needed and reply with the result.
To call a tool, reply to me with the following format:
[TOOL_CALL]{"tool": "prefix-tool_name", "parameters": {"param1": "value1"}}[/TOOL_CALL].
I'll run the tool and send you the result.

The tools are described below.

For any prompt you get, check if tools could be useful, and plan a strategy to use them, then reply to me to run them one by one according to your plan.

** IMPORTANT **
Always respond to me to use a tool, DON'T try to run the tool yourself e.g. in python code!
Always use the above format, including the TOOL_CALL tags and the tool name.


** TOOLS:
`;

  constructor(uiManager) {
    this.uiManager = uiManager;
    this.state = {
      authToken: null
    };

    this.toolDefinitions = [];
    this.toolsDefinitionChanged = false;
    
    // Track processed nodes to avoid duplication
    this.processedNodes = new WeakMap();

    // Setup network interceptors
    this.setupNetworkInterceptors();
    
    // Setup tool call detection via MutationObserver
    this.setupToolCallDetection();
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
            JSON.stringify(existingTool.parameters || {}) !== JSON.stringify(newTool.parameters || {})) {
          allMatch = false;
          break;
        }
      }
      
      if (allMatch) {
        console.log('📡 Tools list unchanged, skipping update');
        return true;
      }
    }
    
    // If different, update with the new tools
    console.log('📡 Updating tools with new list');
    this.toolDefinitions = [];
    for (const tool of tools) {
      this.registerTool(tool.name, tool.description, tool.parameters, tool.callback);
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

  // Process tool calls from text chunks
  processToolCalls(text) {
    const toolCalls = [];
    let startIndex = 0;
    
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
      console.log('📡 !! No tool calls found in text:', text);
    }
    return toolCalls;
  }

  setupToolCallDetection() {
    console.log('📡 Setting up MutationObserver for tool call detection');
    
    // Function to process a node and its children
    const processNode = (node) => {
      // Skip if already processed
      if (this.hasProcessedNode(node)) {
        return false; // Return false to indicate nothing was processed
      }
      
      let wasProcessed = false; // Track if any child or this node was processed
      
      // Process children first (bottom-up approach)
      if (node.nodeType === Node.ELEMENT_NODE && node.childNodes.length > 0) {
        // Process all child nodes first
        for (const childNode of node.childNodes) {
          const childProcessed = processNode(childNode);
          if (childProcessed) {
            wasProcessed = true;
          }
        }
        
        // If any children were processed, mark this node as processed and return
        if (wasProcessed) {
          this.markNodeAsProcessed(node, 'child-processed');
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
            content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            node: node,
            parentElement: node.parentElement
          });
        } else {
          console.log('📡 Found tool call in element:', {
            element: node,
            tagName: node.tagName,
            classList: node.classList ? Array.from(node.classList) : [],
            content: content.substring(0, 100) + (content.length > 100 ? '...' : '')
          });
        }
        
        // Process the content for tool calls
        const toolCalls = this.processToolCalls(content);
        if (toolCalls.length > 0) {
          console.log('📡 Processing tool call in specific node:', toolCalls);
          
          // Find the best container for UI injection
          let targetElement = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
          
          // Inject UI
          requestAnimationFrame(() => {
            toolCalls.forEach(toolCall => {
              this.uiManager.injectToolResultButton(toolCall, toolCall.execute, toolCall.toolCallText, targetElement);
            });
          });
          
          // Mark node as processed
          this.markNodeAsProcessed(node, content);
          
          // Mark all parent nodes to prevent duplicate processing
          let parent = node.parentElement;
          while (parent) {
            this.markNodeAsProcessed(parent, 'child-processed');
            parent = parent.parentElement;
          }
          
          return true; // Indicate this branch was processed
        }
      }
      
      return wasProcessed; // Return whether processing occurred
    };
    
    // Create a simple single observer that looks for new assistant messages
    this.observer = new MutationObserver((mutations) => {
      // Track nodes to process with delay
      const nodesToProcess = new Set();
      
      for (const mutation of mutations) {
        // Handle text content changes - we need to unmark previously processed nodes
        if (mutation.type === 'characterData') {

          const clearProcessedStatus = (node) => {
            // Clear from this node
            if (this.processedNodes.has(node)) {
              //console.log('📡 Clearing processed status for:', node);
              this.processedNodes.delete(node);
            }
            
            // Recursively clear from children
            if (node.childNodes) {
              for (const child of node.childNodes) {
                clearProcessedStatus(child);
              }
            }
          };

           // Find the closest user message ancestor
          let userMessage = mutation.target;
          while (userMessage && 
                (!userMessage.getAttribute || 
                  userMessage.getAttribute('data-message-author-role') !== 'user')) {
            userMessage = userMessage.parentElement;
          }

          if (userMessage) {
            clearProcessedStatus(userMessage);
            this.hideSystemPromptInUserMessage(userMessage);
          }
          
          // Find the closest assistant message ancestor
          let assistantMessage = mutation.target;
          while (assistantMessage && 
                 (!assistantMessage.getAttribute || 
                  assistantMessage.getAttribute('data-message-author-role') !== 'assistant')) {
            assistantMessage = assistantMessage.parentElement;
          }
          
          // If we found an assistant message, clear processed status of all nodes within it
          if (assistantMessage) {
            //console.log('📡 Clearing processed status for updated assistant message:', assistantMessage);            
            // Clear processed status from the assistant message and all its descendants            
            clearProcessedStatus(assistantMessage);
            // Queue for delayed processing
            nodesToProcess.add(assistantMessage);
          }
        }
        
        // Handle new nodes
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {

            if (node.getAttribute && node.getAttribute('data-message-author-role') === 'user') {
              //console.log('📡 New user message found in node!', node);
            }
            // Process only element nodes
            if (node.nodeType === Node.ELEMENT_NODE) {
              // If this is an assistant message, queue it for delayed processing
              if (node.getAttribute && node.getAttribute('data-message-author-role') === 'assistant') {
                //console.log('📡 New assistant message found, queueing for processing:', node);
                nodesToProcess.add(node);
              }
              
              // If this is a user message, check if it contains our system prompt and hide it
              if (node.getAttribute && node.getAttribute('data-message-author-role') === 'user') {
                // Use a short delay to ensure content is fully rendered
                setTimeout(() => this.hideSystemPromptInUserMessage(node), 100);
              }
              
              // Check for messages within added nodes
              if (node.querySelectorAll) {
                // Look for assistant messages
                const assistantMessages = node.querySelectorAll('[data-message-author-role="assistant"]');
                if (assistantMessages.length > 0) {
                  // console.log(`📡 Found ${assistantMessages.length} assistant messages within added node`);
                  assistantMessages.forEach(message => {
                    nodesToProcess.add(message);
                  });
                }
                
                // Look for user messages that might contain system prompts
                const userMessages = node.querySelectorAll('[data-message-author-role="user"]');
                // console.log('📡 Found', userMessages.length, 'user messages within added node');
                if (userMessages.length > 0) {
                  userMessages.forEach(message => {
                    setTimeout(() => this.hideSystemPromptInUserMessage(message), 100);
                  });
                }
              }
            }
          }
        }
      }
      
      // Process queued nodes after a small delay
      if (nodesToProcess.size > 0) {
        // Clear any existing timeout
        if (this.processingTimeout) {
          clearTimeout(this.processingTimeout);
        }
        
        // Set a new timeout to process nodes after a delay
        this.processingTimeout = setTimeout(() => {
          //console.log('📡 Processing queued nodes after delay:', nodesToProcess.size);
          nodesToProcess.forEach(node => processNode(node));
        }, 100); // 100ms delay to ensure content is populated and to reduce cycles
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
      
      // Find the main container (preferably main, but fall back to body if needed)
      const targetNode = document.body || document.documentElement;
      if (!targetNode) {
        console.log('📡 No valid target node found, will try again in 500ms');
        setTimeout(startObserver, 500);
        return;
      }
      
      try {
        // Process any existing assistant messages first
        const existingMessages = targetNode.querySelectorAll('[data-message-author-role="assistant"]');
        console.log(`📡 Found ${existingMessages.length} existing assistant messages`);
        existingMessages.forEach(message => processNode(message));
        const existingUserMessages = targetNode.querySelectorAll('[data-message-author-role="user"]');
        console.log(`📡 Found ${existingUserMessages.length} existing user messages`);
        existingUserMessages.forEach(message => processNode(message));
        
        // Then start observing for new ones
        this.observer.observe(targetNode, {
          childList: true,
          subtree: true,
          characterData: true
        });
        
        console.log(`📡 Observer installed on ${targetNode.nodeName || 'unknown'} - watching for new assistant messages`);
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
      const url = arguments[0]?.url || arguments[0];
      const options = arguments[1] || {};
      
      // Store auth token when we see it in a request
      if (options.headers) {
        const authHeader =
          options.headers.authorization ||
          options.headers.Authorization ||
          options.headers['authorization'] ||
          options.headers['Authorization'];

        if (authHeader && self.state.authToken !== authHeader) {
          self.state.authToken = authHeader;
          console.log('📡 Captured auth token');
        }
      }
      
      // Check if this is a message creation request to append the system prompt
      if (url.includes('/backend-api/conversation') && options.method === 'POST' && options.body) {
        try {
          // Parse the request body
          const bodyData = JSON.parse(options.body);
          
          // Check if this is a message creation request with content
          if (bodyData.messages && bodyData.messages.length > 0) {
            // Check if this might be the first message in a conversation
            const isFirstMessage = self.isFirstUserMessage();
            const hasExplicitToken = bodyData.messages.some(msg => 
              msg.author?.role === 'user' && 
              msg.content?.parts?.[0]?.includes("MCPT")
            );
            
            // Inject system prompt if this is the first message or has explicit token
            if (self.toolsDefinitionChanged || isFirstMessage || hasExplicitToken) {
              // Generate system prompt with tools
              const toolsDefinitions = self.getToolsDefinitions();
              const systemPrompt = [ToolManager.SYSTEM_PROMPT, ...toolsDefinitions].join('\n\n');
              
              // Find the first user message
              const firstMessage = bodyData.messages.find(msg => msg.author.role === 'user');
              if (firstMessage) {
                console.log('📡 Appending system prompt to user message ' + 
                           (isFirstMessage ? '(first in conversation)' : '(has MCPT token)'));
                
                // Append our system prompt to the end of the user message
                // Remove MCPT token if present
                const userContent = firstMessage.content.parts[0].replace("MCPT", "").trim();
                firstMessage.content.parts[0] = userContent + ToolManager.SYSTEM_PROMPT_SEPARATOR + systemPrompt;
                
                // Update the request body
                options.body = JSON.stringify(bodyData);
                
                // Set flag to prevent multiple injections
                self.toolsDefinitionChanged = false;
              }
            }
          }
        } catch (e) {
          console.error('📡 Error attempting to inject system prompt:', e);
        }
      }

      // Make the original request and return it
      return originalFetch.apply(this, arguments);
    };
  }
  
  // Helper method to determine if this is likely the first user message in a conversation
  isFirstUserMessage() {
    try {
      // Check how many user messages are in the DOM
      const userMessages = document.querySelectorAll('[data-message-author-role="user"]');
      const messageCount = userMessages.length;
      
      // If 0 messages exist, this is definitely the first message
      // If 1 message exists, it's likely this is that message being sent
      const isFirst = messageCount <= 1;
      
      console.log(`📡 User message count in DOM: ${messageCount}, treating as ${isFirst ? 'first' : 'subsequent'} message`);
      return isFirst;
    } catch (e) {
      console.error('📡 Error checking message count:', e);
      return false; // Default to false on error
    }
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
  hasProcessedNode(node, content) {
    if (!node) return false;
    
    // If content is provided, check if the node was processed with this exact content
    if (content !== undefined) {
      const processedContent = this.processedNodes.get(node);
      return processedContent === content;
    }
    
    // Otherwise just check if the node was processed at all
    return this.processedNodes.has(node);
  }

  // Marks a node as processed with the current content
  markNodeAsProcessed(node, content) {
    this.processedNodes.set(node, content);
  }

  // Add a new method to hide system prompts in user messages
  hideSystemPromptInUserMessage(userMessageNode) {
    if (!userMessageNode || this.processedNodes.has(userMessageNode)) return;
    
    // Function to find the deepest node containing the system prompt separator
    const findDeepestNodeWithPrompt = (node) => {
      // If this is a text node and contains the separator, return it
      if (node.nodeType === Node.TEXT_NODE && 
          node.textContent && 
          node.textContent.includes(ToolManager.SYSTEM_PROMPT_SEPARATOR)) {
        return node;
      }
      
      // If this is an element node, check its children
      if (node.nodeType === Node.ELEMENT_NODE && node.childNodes.length > 0) {
        for (const child of node.childNodes) {
          const result = findDeepestNodeWithPrompt(child);
          if (result) return result;
        }
      }
      
      // If we didn't find anything, return null
      return null;
    };
    
    // Find all potential container divs in the user message
    const messageDivs = userMessageNode.querySelectorAll('div');
    let wasModified = false;
    
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
      const deepestNode = findDeepestNodeWithPrompt(div);
      
      if (deepestNode) {
        console.log('📡 Found system prompt in deep node:', deepestNode);
        
        // Split the content by our separator
        const parts = deepestNode.textContent.split(ToolManager.SYSTEM_PROMPT_SEPARATOR);
        if (parts.length >= 2) {
          const userMessage = parts[0].trim();
          const toolDefinitions = parts[1].trim();
          
          // Update just this text node to remove the system prompt
          deepestNode.textContent = userMessage;
          
          // Find parent element that will hold the toggle button
          let parentElement = deepestNode.parentElement;
          
          // Use UIManager to create theme-aware system prompt toggle
          this.uiManager.createSystemPromptToggle(userMessage, toolDefinitions, parentElement, deepestNode);
          
          console.log('📡 Hidden system prompt in user message:', userMessage.substring(0, 50));
          
          // Mark this element as processed
          this.markNodeAsProcessed(parentElement, 'system-prompt-hidden');
          wasModified = true;
          break; // We only need to process one instance per message
        }
      }
    }
    
    // If we modified anything, mark the user message as processed
    if (wasModified) {
      this.markNodeAsProcessed(userMessageNode, 'system-prompt-hidden');
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
