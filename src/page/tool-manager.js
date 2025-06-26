// ==============================
// ToolManager Class
// ==============================
class ToolManager {

  // Debugging
  static DEBUG_TOOL_CALLS = false;
  static DEBUG_USER_MESSAGES = false;
  static DEBUG_SYSTEM_PROMPTS = false;

  // Static properties
  static TOOL_PREFIX = '### ';
  static TOOL_PARAMS_PREFIX = 'PARAMS:';
  static SYSTEM_PROMPT_SEPARATOR = '===TOOLS-INSTRUCTIONS==='; // Add separator constant
  static SYSTEM_PROMPT_SEPARATOR_END = '===TOOLS-END===';
  static SYSTEM_PROMPT_TOOL_DEFINITIONS = '***Available Tools:';
  static TOOL_RESULT_TAG = 'Tool result for ';
  static TOOL_CALL_TAG = '<TOOL_CALL>';
  static TOOL_CALL_TAG_END = '</TOOL_CALL>';

  static SYSTEM_PROMPT = `I have access to a set of tools which I can execute for you. 
The tools are listed below.
To use these tools, you have to respond with a short explanation of why you need a tool, then with the tool call in this exact format:
${ToolManager.TOOL_CALL_TAG}{"tool": "prefix-tool_name", "parameters": {"param1": "value1"}}${ToolManager.TOOL_CALL_TAG_END}
Then wait for my reply with the result of the tool call before continueing. 

  Notes:
- Format must be exact. including the opening and closing tags and JSON format.
- Include the full tool name (e.g. "MCPT_Default-whatsapp_get_chats").
- DON'T try to run the tool yourself, DON'T use python code for that. just respond with the tool call format and let me run it.
- Describe actions naturally, without referencing tool names.
- Only use tools explicitly listed in the registry I provide.
- REMEMBER: you can include up to a single tool call in any response you send, and use the exact tool call format I provided:
  ${ToolManager.TOOL_CALL_TAG}{"tool": "prefix-tool_name", "parameters": {"param1": "value1"}}${ToolManager.TOOL_CALL_TAG_END}

# ${ToolManager.SYSTEM_PROMPT_TOOL_DEFINITIONS}`;

  constructor(uiManager, platformAdapter) {
    this.uiManager = uiManager;
    this.platformAdapter = platformAdapter;

    this.toolDefinitions = new Map(); // Map from class name to array of tools
    this.toolsDefinitionChanged = false;

    // Track processed nodes to avoid duplication
    this.processedNodes = new WeakMap();
    this.lastMessageUrl = null; // Store URL where last message was sent
    this.lastAssitantMessageRan = -1; // Store number of assistant messages

    // Setup network interceptors
    this.setupNetworkInterceptors();

    // Setup tool call detection via MutationObserver
    this.setupDOMObserver();
  }

  _registerTool(toolDefinition) {
    const className = toolDefinition.className || 'default';

    // Get or create the tools array for this class
    if (!this.toolDefinitions.has(className)) {
      this.toolDefinitions.set(className, []);
    }

    const classTools = this.toolDefinitions.get(className);

    // Check if tool already exists in this class
    const existingIndex = classTools.findIndex(tool => tool.name === toolDefinition.name);

    if (existingIndex >= 0) {
      // Update existing tool
      classTools[existingIndex] = toolDefinition;
    } else {
      // Add new tool
      classTools.push(toolDefinition);
    }
  }

  updateTools(tools) {
    // Calculate total count of existing tools
    const existingToolCount = Array.from(this.toolDefinitions.values())
      .reduce((sum, classTools) => sum + classTools.length, 0);

    // Simple check to avoid updates if nothing changed
    if (tools.length === existingToolCount) {
      // Check if all tools match
      let allMatch = true;

      for (const newTool of tools) {
        // Try to find a matching tool in current definitions
        const existingTool = this.getToolByName(newTool.name);

        // If no matching tool or properties differ, tools have changed
        if (!existingTool ||
          existingTool.description !== newTool.description ||
          existingTool.className !== newTool.className ||
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
    this.toolDefinitions.clear();
    for (const tool of tools) {
      this._registerTool(tool);
    }
    this.toolsDefinitionChanged = true;
    return true;
  }

  getToolByName(name) {
    // Search through all classes for the tool
    for (const classTools of this.toolDefinitions.values()) {
      const tool = classTools.find(tool => tool.name === name);
      if (tool) {
        return tool;
      }
    }
    return undefined;
  }

  getToolsByPrefix(prefix) {
    return Array.from(this.toolDefinitions.values())
      .flatMap(classTools => classTools.filter(tool => tool.name.startsWith(prefix)))
      .map(tool => tool.name);
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
      const start = text.indexOf(ToolManager.TOOL_CALL_TAG, startIndex);
      if (start === -1) break;

      const end = text.indexOf(ToolManager.TOOL_CALL_TAG_END, start);
      if (end === -1) break;

      const toolCallText = text.slice(start + ToolManager.TOOL_CALL_TAG.length, end);
      try {
        const toolCall = JSON.parse(toolCallText);
        if (toolCall.tool) {
          toolCalls.push({
            tool: toolCall.tool,
            parameters: toolCall.parameters || {},
            execute: () => this.executeToolCall(toolCall.tool, toolCall.parameters),
            toolCallText: text.slice(start, end + ToolManager.TOOL_CALL_TAG_END.length)
          });
        }
      } catch (e) {
        console.error('📡 Error parsing tool call:', e);
      }

      startIndex = end + ToolManager.TOOL_CALL_TAG_END.length;
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

          // Find a user message ancestor
          const userMessage = this.platformAdapter.findUserMessageAncestor(mutation.target);
          if (userMessage) {
            userNodesToProcess.add(userMessage);
          }
          // find a user message child
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
        console.log(`**[TOOL_MANAGER]** Found ${existingMessages.length} existing assistant messages`);
        existingMessages.forEach(message => this.processAssistantMessageForToolCalls(message));

        const existingUserMessages = this.platformAdapter.getUserMessages();
        console.log(`**[TOOL_MANAGER]** Found ${existingUserMessages.length} existing user messages`);
        existingUserMessages.forEach(message => this.processUserMessage(message));

        // Then start observing for new ones
        this.observer.observe(targetNode, {
          childList: true,
          subtree: true,
          characterData: true
        });

        console.log(`**[TOOL_MANAGER]** Observer installed on ${targetNode.nodeName || 'unknown'} - watching for new messages`);
      } catch (error) {
        console.error('**[TOOL_MANAGER]** Error setting up observer:', error);
      }
    };

    // Start the observer safely
    startObserver();
  }

  setupNetworkInterceptors() {
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function () {
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
    const assistantMessages = this.platformAdapter.getAssistantMessages();
    const isFirstMessage = assistantMessages.length == 0 || assistantMessages[0].textContent.length === 0;

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
      console.log('******* Injecting system prompt', isFirstMessage, hasExplicitToken, this.toolsDefinitionChanged);

      bodyData = this.platformAdapter.appendSystemPrompt(
        bodyData, systemPromptWithSeparator, 'MCPT');

      // Set flag to prevent multiple injections
      this.toolsDefinitionChanged = false;
    }
    else {
      console.log('***** Skipping system prompt injection',
        isFirstMessage, hasExplicitToken, this.toolsDefinitionChanged,
        this.platformAdapter.getAssistantMessages().map(m => m.textContent),
        this.platformAdapter.getUserMessages().map(m => m.textContent));
    }
    return bodyData;
  }

  getToolsDefinitions() {
    const sections = [];

    // Sort class names for consistent output
    const sortedClassNames = Array.from(this.toolDefinitions.keys()).sort();

    for (const className of sortedClassNames) {
      const classTools = this.toolDefinitions.get(className);
      if (classTools.length === 0) continue;

      // Add class header
      sections.push(`## ${className.toUpperCase()} TOOLS`);

      // Add tools for this class
      const toolDefinitions = classTools.map(tool => {
        let params = '';
        if (tool.parameters && Object.keys(tool.parameters).length > 0) {
          params = Object.entries(tool.parameters)
            .map(([name, param]) => `\t* "${name}" : ${param.description}`)
            .join('\n');
          params = `\n${ToolManager.TOOL_PARAMS_PREFIX}\n${params}`;
        }
        const definition = `${ToolManager.TOOL_PREFIX}${tool.name}\n${tool.description}${params}\n`;
        return definition;
      });

      sections.push(...toolDefinitions);
      sections.push(''); // Add empty line between sections
    }

    return sections;
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
  findDeepestNodeWith(node, separators) {

    const nodeText = node.nodeType === Node.TEXT_NODE ? node.textContent : node.innerText || '';
    const nodeContainsPrompt = nodeText &&
      separators.every(separator => nodeText.includes(separator));

    if (nodeContainsPrompt) {
      // If this is a text node and contains the separator, return it
      if (node.nodeType === Node.TEXT_NODE) return node;

      // If this is an element node, check its children
      if (node.nodeType === Node.ELEMENT_NODE && node.childNodes.length > 0) {
        for (const child of node.childNodes) {
          const result = this.findDeepestNodeWith(child, separators);
          if (result) return result;
        }
      }
      return node;
    }

    // If we didn't find anything, return null
    return null;
  }

  processAssistantMessageForToolCalls(node) {
    if (ToolManager.DEBUG_TOOL_CALLS) {
      console.log('**[ASSISTANT_MESSAGES]** Processing assistant message:', node, node.textContent);
    }
    // Skip if already processed
    if (!node || this.hasProcessedNode(node)) return false;
    this.markNodeAsProcessed(node);

    // Check if this node contains a tool call (only if no children were processed)
    const content = node.nodeType === Node.TEXT_NODE ? node.textContent : node.innerText || '';
    const hasToolCall = content.includes(ToolManager.TOOL_CALL_TAG) &&
      content.includes(ToolManager.TOOL_CALL_TAG_END);
    if (!hasToolCall) {
      return false;
    }

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

    // Only process if this is the most specific element with the tool call
    // (not already processed)
    if (node.nodeType === Node.TEXT_NODE) {
      if (ToolManager.DEBUG_TOOL_CALLS) {
        console.log('**[ASSISTANT_MESSAGES]** Found tool call in text node:', {
          content: content,
          node: node,
          parentElement: node.parentElement
        });
      }
    } else {
      if (ToolManager.DEBUG_TOOL_CALLS) {
        console.log('**[ASSISTANT_MESSAGES]** Found tool call in element:', {
          element: node,
          tagName: node.tagName,
          classList: node.classList ? Array.from(node.classList) : [],
          content: content
        });
      }
    }

    // Process the content for tool calls
    const toolCalls = this.extractToolCalls(content);
    if (toolCalls.length > 0) {
      if (ToolManager.DEBUG_TOOL_CALLS) {
        console.log('**[ASSISTANT_MESSAGES]** Processing tool call in specific node:', toolCalls);
      }

      // Find the best container for UI injection
      const targetElement = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;

      const parentAssistantMessageIndex =
        this.platformAdapter.getParentAssistantMessageIndex(node);
      // Check if a message was already sent (avoid running old messages)
      console.log('**[ASSISTANT_MESSAGES]** Checking if can auto-run:', window.location.href, this.lastMessageUrl, this.lastAssitantMessageRan, parentAssistantMessageIndex);
      const canAutoRun = window.location.href === this.lastMessageUrl &&
        this.lastAssitantMessageRan < parentAssistantMessageIndex;
      // Inject UI
      const self = this;
      requestAnimationFrame(() => {
        if (ToolManager.DEBUG_TOOL_CALLS) {
          console.log('**[ASSISTANT_MESSAGES]** Injecting tool result button for tool calls:',
            toolCalls, targetElement);
        }
        toolCalls.forEach(toolCall => {
          const ran = this.uiManager.injectToolResultButton(
            toolCall,
            toolCall.execute,
            toolCall.toolCallText,
            targetElement,
            canAutoRun
          );
          if (ran) {
            if (ToolManager.DEBUG_TOOL_CALLS) {
              console.log('**[ASSISTANT_MESSAGES]** Last auto-run set to:', targetElement);
            }
            self.lastAssitantMessageRan = parentAssistantMessageIndex;
          }
        });
      });

      return true; // Indicate this branch was processed
    }

    return false; // Return whether processing occurred
  }

  processUserMessageForResult(userMessageNode) {
    //console.log('** [USER_MESSAGES] ** Processing user message for result:', userMessageNode, userMessageNode.textContent);
    const deepestNode = this.findDeepestNodeWith(userMessageNode, [ToolManager.TOOL_RESULT_TAG]);
    if (deepestNode) {
      const originalText = deepestNode.textContent;
      deepestNode.textContent = '';
      const parentElement = deepestNode.nodeType === Node.TEXT_NODE ?
        deepestNode.parentElement : deepestNode;
      console.log('** [USER_MESSAGES] ** Found tool result in deepest node:', deepestNode, deepestNode.textContent);
      this.uiManager.createSystemPromptToggle(
        'tool result',
        originalText,
        parentElement,
        deepestNode
      );
      return true;
    }
    return false;
  }

  processUserMessageForSystemPrompt(userMessageNode) {
    const deepestNode = this.findDeepestNodeWith(userMessageNode,
      [ToolManager.SYSTEM_PROMPT_SEPARATOR, ToolManager.SYSTEM_PROMPT_SEPARATOR_END]);
    if (!deepestNode) {
      return false;
    }

    console.log('📡 Found system prompt in deep node:', deepestNode);

    // Split the content by our separator
    const parts = deepestNode.textContent.split(ToolManager.SYSTEM_PROMPT_SEPARATOR);
    if (parts.length >= 2) {
      const userMessage = parts[0].trim();
      const toolDefinitions = parts[1].split(ToolManager.SYSTEM_PROMPT_TOOL_DEFINITIONS)[1].trim();

      // Update just this text node to remove the system prompt
      if (ToolManager.DEBUG_USER_MESSAGES) {
        console.log('**[USER_MESSAGES]** Removing system prompt from user message:', deepestNode, userMessage, deepestNode.textContent);
      }
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
      if (ToolManager.DEBUG_USER_MESSAGES) {
        console.log('**[USER_MESSAGES]** Post removal user message:', deepestNode, deepestNode.textContent);
      }

      // Use UIManager to create theme-aware system prompt toggle
      this.uiManager.createSystemPromptToggle(
        'tool definitions',
        toolDefinitions,
        parentElement,
        deepestNode
      );

      if (ToolManager.DEBUG_USER_MESSAGES) {
        console.log('**[USER_MESSAGES]** Hidden system prompt in user message:', userMessage.substring(0, 50));
      }
      return true;
    }
    return false;
  }

  // Add a new method to hide system prompts in user messages
  processUserMessage(userMessageNode) {
    if (ToolManager.DEBUG_USER_MESSAGES) {
      console.log('** [USER_MESSAGES] ** Processing user message:', userMessageNode, userMessageNode.textContent);
    }
    if (!userMessageNode || this.hasProcessedNode(userMessageNode)) return;
    this.markNodeAsProcessed(userMessageNode);

    // Check if this message has already been processed
    const hasSystemPrompt = userMessageNode.querySelector('.tool-definitions-toggle');
    if (hasSystemPrompt) return;

    this.processUserMessageForSystemPrompt(userMessageNode);
    this.processUserMessageForResult(userMessageNode);
    return;
  }

  updateServerAutomation(serverId, automation) {
    console.log(`📡 Updating server automation for ${serverId} to ${automation}`);
    // Get all tools from this server (tools are prefixed with server ID)
    const serverPrefix = `${serverId}`;
    const affectedTools = this.getToolsByPrefix(serverPrefix);

    console.log(`📡 Applying automation "${automation}" to ${affectedTools.length} tools from server "${serverId}"`);

    // Apply automation preference to each tool
    affectedTools.forEach(toolName => {
      this.uiManager.setToolPreference(toolName, { mode: automation });
      console.log(`📡 Set tool "${toolName}" to automation mode: ${automation}`);
    });
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
