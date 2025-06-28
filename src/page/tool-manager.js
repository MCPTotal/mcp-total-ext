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

  static SYSTEM_PROMPT = `I have access to a set of tools which I can run for you to perform actions in this conversation.
The tools are listed below. Take then into account on any prompt you get, and if applicable, plan a set of tool calls to perform the task.
Start by responding with the planned set of tool calls and explanation of what you're going to do, then repond with the first tool call in this exact format:
${ToolManager.TOOL_CALL_TAG}{"tool": "prefix-tool_name", "parameters": {"param1": "value1"}}${ToolManager.TOOL_CALL_TAG_END}
Then immediately stop responding and wait for me to run the tool and reply with the result before continuing and potentially issuing another tool call.

** Remember **:
- Start with a plan of a series of tool call, immediately followed with the first tool call, then wait for the result before continuing with the next tool call.
- You MUST use the exact full tool call format, including the opening and closing tags and the JSON format within it.
- You can only use one tool call at a time
- After placing each tool call, you must pause entirely and wait for my reply with the result before continuing.
- The tools listed below are guaranteed to be available through this entire conversation. You can use them at any time.
- You must include the full tool name exactly as listed (e.g., "MCPT_personal-whatsapp_list_chats").

* Example - Correct *

User: 
summarize the last 10 messages in the Family whatsapp chat group

Assistant: 
in order to list the messages in the Family chat group, I'll first call MCPT_personal-whatsapp_list_chats to get the id of the Family group chat, 
then use it to call MCPT_personal-whatsapp_list_messages with filter on that id to get the last 10 messages.
Let's start with the first tool call:
${ToolManager.TOOL_CALL_TAG}{...}${ToolManager.TOOL_CALL_TAG_END}

(STOP AND WAIT FOR MY REPLY)

User: 
Retuls for MCPT_personal-whatsapp_list_chats: ...

Assistant: 
Now I'll use the id to call MCPT_personal-whatsapp_list_messages with filter on that id to get the last 10 messages.
${ToolManager.TOOL_CALL_TAG}{...}${ToolManager.TOOL_CALL_TAG_END}

(STOP AND WAIT FOR MY REPLY)

User: 
Results for MCPT_personal-whatsapp_list_messages: ...

Assistant:
Here's a summary of the last 10 messages in the Family chat group:
...

* Example - Incorrect 1 - not waiting for the result *
User: 
summarize the last 10 messages in the Family whatsapp chat group

Assistant: 
in order to ... Let's start with the first tool call:
${ToolManager.TOOL_CALL_TAG}{...}${ToolManager.TOOL_CALL_TAG_END}

It looks like I don't actually have the WhatsApp tools connected in this chat.


* Example - Incorrect 2 - multiple same tool calls without waiting for the result *
User: 
...

Assistant: 
in order to list the messages in the Family chat group, ... Let's start with the first tool call:
${ToolManager.TOOL_CALL_TAG}{...}${ToolManager.TOOL_CALL_TAG_END}

in order to list the messages in the Family chat group, ... Let's start with the first tool call:
${ToolManager.TOOL_CALL_TAG}{...}${ToolManager.TOOL_CALL_TAG_END}
...

* Other incorrect patterns *
- Multiple calls for different tools for the same user message, without waiting for the result of the previous tool call.
- Replying with a wrong tool call format, e.g. missing opening or closing tags, or missing or invalidJSON format within it.

${ToolManager.SYSTEM_PROMPT_TOOL_DEFINITIONS}`;

  static SYSTEM_PROMPT_NOTE = `Reminder:
1. You MUST use the exact complete tool call format, including the opening and closing tags and the JSON format within it.
2. Make sure the JSON is valid.
2. You can only use one tool call at a time
3. After placing each tool call, you must pause entirely and wait for my reply with the result before continuing.
4. The tools listed below are guaranteed to be available through this entire conversation. You can use them at any time.
5. You must include the complete tool name exactly as listed (e.g., "MCPT_personal-whatsapp_list_chats").
6. Do not use any identifiers from other conversations, only use the ones provided here.
These rules are critical and must be followed at all times. Failure to comply will result in a critical instruction violation
Here are the tools available to you:
`;

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

  /**
   * Attempts to parse JSON with various fallback strategies for common formatting issues
   * @param {string} jsonString - The JSON string to parse
   * @returns {object|null} - Parsed object or null on failure
   */
  robustJsonParse(jsonString) {
    // First try standard JSON.parse
    try {
      return JSON.parse(jsonString);
    } catch (firstError) {
      console.warn('📡 Standard JSON.parse failed, trying robust parsing:', firstError.message);
    }

    // Try to fix common JSON issues
    let cleanedJson = jsonString.trim();

    try {
      // 1. Fix trailing commas
      cleanedJson = cleanedJson.replace(/,(\s*[}\]])/g, '$1');

      // 2. Fix single quotes to double quotes (but be careful with apostrophes in strings)
      cleanedJson = cleanedJson.replace(/'/g, '"');

      // 3. Fix unquoted property names
      cleanedJson = cleanedJson.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

      // 4. Fix newlines in strings (escape them)
      cleanedJson = cleanedJson.replace(/"([^"]*?)(\n|\r\n|\r)([^"]*?)"/g, (match, before, newline, after) => {
        return `"${before}\\n${after}"`;
      });

      // Try parsing the cleaned JSON
      return JSON.parse(cleanedJson);
    } catch (secondError) {
      console.warn('📡 Robust JSON parsing failed, trying final fallback:', secondError.message);
    }

    // Final fallback: try to extract tool and parameters with regex
    try {
      const toolMatch = cleanedJson.match(/"tool"\s*:\s*"([^"]+)"/);
      const parametersMatch = cleanedJson.match(/"parameters"\s*:\s*(\{.*\})/s);

      if (toolMatch) {
        const result = { tool: toolMatch[1] };

        if (parametersMatch) {
          try {
            result.parameters = JSON.parse(parametersMatch[1]);
          } catch (paramError) {
            console.warn('📡 Could not parse parameters, using empty object:', paramError);
            result.parameters = {};
          }
        } else {
          result.parameters = {};
        }

        console.log('📡 Successfully extracted tool call using regex fallback:', result);
        return result;
      }
    } catch (regexError) {
      console.error('📡 Regex fallback failed:', regexError);
    }

    // If all else fails, return null
    console.error('📡 All JSON parsing strategies failed for:', jsonString.substring(0, 100) + '...');
    return null;
  }

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

      // Use robust JSON parsing
      const toolCall = this.robustJsonParse(toolCallText);

      if (toolCall && toolCall.tool) {
        toolCalls.push({
          tool: toolCall.tool,
          parameters: toolCall.parameters || {},
          execute: () => this.executeToolCall(toolCall.tool, toolCall.parameters),
          toolCallText: text.slice(start, end + ToolManager.TOOL_CALL_TAG_END.length)
        });
        console.log('📡 Successfully parsed tool call:', toolCall.tool);
      } else {
        console.error('📡 Failed to parse tool call, skipping:', toolCallText.substring(0, 100) + '...');
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
    const isFirstMessage = assistantMessages.length == 0 ||
      assistantMessages[0].textContent.length === 0;

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
        systemPrompt + ToolManager.SYSTEM_PROMPT_NOTE + ToolManager.SYSTEM_PROMPT_SEPARATOR_END;
      console.log('******* Injecting system prompt', isFirstMessage, hasExplicitToken, this.toolsDefinitionChanged);
      console.log(systemPromptWithSeparator);

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

      const extra = ToolManager.SYSTEM_PROMPT_SEPARATOR + ToolManager.SYSTEM_PROMPT_NOTE +
        this.getToolsNames() + ToolManager.SYSTEM_PROMPT_SEPARATOR_END;
      bodyData = this.platformAdapter.appendSystemPrompt(
        bodyData, extra, '');
    }
    return bodyData;
  }

  getToolsNames() {
    const toolsNames = [];
    for (const classTools of this.toolDefinitions.values()) {
      for (const tool of classTools) {
        toolsNames.push(tool.name);
      }
    }
    return toolsNames.join('\n');
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
        // Convert to standard format
        const standardTool = {
          name: tool.name,
          description: tool.description
        };
        standardTool.inputSchema = tool.parameters;

        return JSON.stringify(standardTool, null, 2);
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
      let toolDefinitions = '';
      const split = parts[1].split(ToolManager.SYSTEM_PROMPT_TOOL_DEFINITIONS);
      if (split.length > 1) {
        toolDefinitions = split[1].trim();
      }

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

      if (toolDefinitions.length > 0) {
        // Use UIManager to create theme-aware system prompt toggle
        this.uiManager.createSystemPromptToggle(
          'tool definitions',
          toolDefinitions,
          parentElement,
          deepestNode
        );
      }

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
