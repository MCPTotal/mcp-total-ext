// ==============================
// ToolManager Class
// ==============================
class ToolManager {
  // Static properties
  static TOOL_PREFIX = "TOOL:"
  static TOOL_PARAMS_PREFIX = "PARAMS:"
  static SYSTEM_PROMPT_SEPARATOR = '===INSTRUCTIONS==='; // Add separator constant
  static SYSTEM_PROMPT_SEPARATOR_END = '===END_INSTRUCTIONS===';
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

  constructor(uiManager, platformAdapter) {
    this.uiManager = uiManager;
    this.platformAdapter = platformAdapter;
    
    this.toolDefinitions = [];
    this.toolsDefinitionChanged = false;
    
    // Track processed nodes to avoid duplication
    this.processedNodes = new WeakMap();

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
            JSON.stringify(existingTool.parameters || {}) !== JSON.stringify(newTool.parameters || {})) {
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

  // Extract tool calls from text
  extractToolCalls(text) {
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

          let userMessage = this.platformAdapter.findUserMessageAncestor(mutation.target);
          if (userMessage) {
            userNodesToProcess.add(userMessage);
          }
          else if (mutation.target.querySelectorAll) {
            let userMessages = mutation.target.querySelectorAll(this.platformAdapter.getSelectors().userMessage);
            if (userMessages.length > 0) {
              userMessages.forEach(message => {              
                userNodesToProcess.add(message);
              });
            }
          }
          
          let assistantMessage = this.platformAdapter.findAssistantMessageAncestor(mutation.target);
          if (assistantMessage) {
            assistantNodesToProcess.add(assistantMessage);
          }
          else if (mutation.target.querySelector) {
            let assistantMessages = mutation.target.querySelectorAll(this.platformAdapter.getSelectors().assistantMessage);
            if (assistantMessages.length > 0) {
              assistantMessages.forEach(message => {              
                assistantNodesToProcess.add(message);
              });
            }
          }
        }
        assistantNodesToProcess.forEach(node => this.processAssistantMessage(node));
        userNodesToProcess.forEach(node => this.processUserMessage(node));
      } catch (error) {
        console.error('📡 Error processing nodes:', error);
      }
      // Process queued nodes after a small delay
      if (false) {//assistantNodesToProcess.size > 0 || userNodesToProcess.size > 0) {        
        // Set a new timeout to process nodes after a delay
        this.processingTimeout = setTimeout(() => {
          console.log('📡 Processing queued nodes after delay:', assistantNodesToProcess.size, userNodesToProcess.size);
          assistantNodesToProcess.forEach(node => this.processAssistantMessage(node));
          userNodesToProcess.forEach(node => this.processUserMessage(node));
        }, 10); // 10ms delay to ensure content is populated and to reduce cycles
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
      let targetNode;
      targetNode = document.body || document.documentElement;
      
      if (!targetNode) {
        console.log('📡 No valid target node found, will try again in 500ms');
        setTimeout(startObserver, 500);
        return;
      }
      
      try {
        // Process any existing assistant messages first using platform adapter
        let existingMessages = this.platformAdapter.getAssistantMessages();
        console.log(`📡 Found ${existingMessages.length} existing assistant messages`);
        existingMessages.forEach(message => this.processAssistantMessage(message));
        
        let existingUserMessages = this.platformAdapter.getUserMessages();
        console.log(`📡 Found ${existingUserMessages.length} existing user messages`);
        existingUserMessages.forEach(message => this.processUserMessage(message));
        
        // Then start observing for new ones
        this.observer.observe(targetNode, {
          childList: true,
          subtree: true,
          characterData: true
        });
        
        console.log(`📡 ***** Observer installed on ${targetNode.nodeName || 'unknown'} - watching for new messages`);
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
        const isConversationRequest = self.platformAdapter.isConversationEndpoint(url, options.method);
        if (isConversationRequest) {
          try {
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
      const systemPromptWithSeparator = ToolManager.SYSTEM_PROMPT_SEPARATOR + systemPrompt + ToolManager.SYSTEM_PROMPT_SEPARATOR_END;
      console.log('📡 Injecting system prompt' + (isFirstMessage ? '(first in conversation)' : '(has MCPT token)'));
      
      bodyData = this.platformAdapter.appendSystemPrompt(bodyData, systemPromptWithSeparator, "MCPT");

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

  processAssistantMessage(node) {
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
        if (this.processAssistantMessage(childNode)) {
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
        let targetElement = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        
        // Inject UI
        requestAnimationFrame(() => {
          console.log('****** Injecting tool result button for tool calls:', toolCalls, targetElement);
          toolCalls.forEach(toolCall => {
            this.uiManager.injectToolResultButton(toolCall, toolCall.execute, toolCall.toolCallText, targetElement);
          });
        });
        
        return true; // Indicate this branch was processed
      }
    }
    
    return false; // Return whether processing occurred
  };

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
          deepestNode.textContent = userMessage;
          
          // Find parent element that will hold the toggle button
          let parentElement = deepestNode.parentElement;
          
          // Use UIManager to create theme-aware system prompt toggle
          this.uiManager.createSystemPromptToggle(userMessage, toolDefinitions.replace(ToolManager.SYSTEM_PROMPT_SEPARATOR_END, ''), parentElement, deepestNode);
          
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
