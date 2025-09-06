import { getUidFromSession } from '../auth';
import { getAnalyticsManager } from '../worker-utils';
import { AISuggestion, AISuggestionType, AISuggestionsAnalysis, SnapshotFile } from '../types';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface AIConversation {
  id: string;
  snapshotId: string;
  messages: OpenAIMessage[];
  createdAt: number;
  updatedAt: number;
  userId?: string;
  ipAddress?: string;
}

// Rate limiting constants
const RATE_LIMIT_REQUESTS_PER_HOUR = 40;
const RATE_LIMIT_TOKENS_PER_HOUR = 100000;
const MAX_CONVERSATION_MESSAGES = 20;
const CONVERSATION_TIMEOUT_HOURS = 24;

// Start or get AI conversation for a snapshot
export async function handleStartAIConversation(c: any) {
  try {
    const snapshotId = c.req.param('snapshotId');
    if (!snapshotId) {
      return c.json({ success: false, error: 'Snapshot ID required' }, 400);
    }

    // Get user ID (optional - allow anonymous users)
    const uid = await getUidFromSession(c);
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(c, uid || undefined, ipAddress);
    if (!rateLimitCheck.allowed) {
      return c.json({ success: false, error: rateLimitCheck.error }, 429);
    }

    // Get snapshot data
    const snapshot = await c.env.KV_SNAPS.get(`snap:${snapshotId}`, { type: 'json' });
    if (!snapshot) {
      return c.json({ success: false, error: 'Snapshot not found' }, 404);
    }

    // Debug access control
    console.log('🔍 Snapshot access check:', {
      snapshotId,
      uid,
      snapshotPublic: snapshot.public,
      snapshotOwnerUid: snapshot.ownerUid,
      isOwner: snapshot.ownerUid === uid,
      shouldAllow: snapshot.public || snapshot.ownerUid === uid
    });

    // Get user info to check if superadmin
    let isSuperadmin = false;
    if (uid) {
      try {
        const user = await c.env.KV_USERS.get(`user:${uid}`, { type: 'json' });
        isSuperadmin = user?.role === 'superadmin';
        console.log('🔍 User role check:', { uid, role: user?.role, isSuperadmin });
      } catch (err) {
        console.warn('Failed to check user role:', err);
      }
    }

    // AI analysis is available to anyone - no access restrictions needed
    // Each user gets their own conversation based on uid or persistent anonymous ID
    console.log('✅ AI analysis access granted to:', { uid, ipAddress, isSuperadmin });

    // For anonymous users, we need to get a persistent ID from the request
    // This should be sent from the frontend like we do for comments
    const requestBody = await c.req.json().catch(() => ({}));
    const anonymousUserId = requestBody.anonymousUserId;
    const forceReanalysis = requestBody.forceReanalysis || false;
    
    // Use uid if authenticated, otherwise use anonymousUserId, fallback to ipAddress
    const userId = uid || anonymousUserId || ipAddress;
    const conversationId = `ai-conv:${snapshotId}:${userId}`;
    console.log('🔍 Creating/retrieving conversation with ID:', conversationId);
    console.log('🔍 User ID:', uid, 'Anonymous ID:', anonymousUserId, 'IP Address:', ipAddress, 'Final User ID:', userId);
    let conversation = await c.env.KV_ANALYTICS.get(conversationId, { type: 'json' }) as AIConversation | null;
    
    if (!conversation || forceReanalysis) {
      // Get snapshot content for analysis
      const snapshotContent = await getSnapshotContentForAnalysis(snapshotId, snapshot.files, c.env);
      
      // Create initial conversation with OpenAI analysis
      const initialMessages: OpenAIMessage[] = [
        {
          role: 'system',
          content: getSystemPrompt()
        },
        {
          role: 'user',
          content: `
            I'm a product manager sharing a web prototype with my design and engineering team. This is throwaway code - I don't care about code quality, performance, or technical implementation. I need your help to give actionable feedback to improve the USER EXPERIENCE and DESIGN.

            Please analyze this prototype from a PRODUCT and USER EXPERIENCE perspective:

            **What I need from you:**
            - User experience insights and pain points
            - Design suggestions that will improve usability
            - Accessibility issues that could exclude users
            - Mobile experience improvements
            - Visual hierarchy and information architecture feedback
            - User flow and task completion improvements
            - Specific, actionable recommendations for my team

            **What I DON'T need:**
            - Code quality feedback
            - Technical implementation suggestions
            - Performance optimization advice
            - Architecture recommendations

            **Context:** This is a web prototype that users will interact with. Focus on what users will see, feel, and experience when using this interface.

            Here's the prototype content:
            \n\n${snapshotContent}`
        }
      ];
      
      // Get AI analysis
      const analysisResult = await callOpenAI(initialMessages, c.env.OPENAI_API_KEY);
      
      conversation = {
        id: conversationId,
        snapshotId,
        messages: [
          {
            role: 'system',
            content: getSystemPrompt()
          },
          {
            role: 'assistant',
            content: analysisResult
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        userId: uid || undefined,
        ipAddress
      };
      
      await c.env.KV_ANALYTICS.put(conversationId, JSON.stringify(conversation), {
        expirationTtl: CONVERSATION_TIMEOUT_HOURS * 3600
      });
    }

    // Track analytics
    if (uid) {
      const analytics = getAnalyticsManager(c);
      await analytics.trackEvent(uid, 'ai_conversation_started', { snapshotId });
    }

    return c.json({ 
      success: true, 
      data: {
        conversationId: conversation?.id || '',
        messages: conversation?.messages.filter(m => m.role !== 'system') || [] // Don't send system prompt to frontend
      }
    });
  } catch (error) {
    console.error('Failed to start AI conversation:', error);
    return c.json({ success: false, error: 'AI service temporarily unavailable' }, 503);
  }
}

// Send message to AI conversation
export async function handleSendAIMessage(c: any) {
  try {
    const snapshotId = c.req.param('snapshotId');
    if (!snapshotId) {
      return c.json({ success: false, error: 'Snapshot ID required' }, 400);
    }

    const body = await c.req.json();
    const { message, anonymousUserId } = body;
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return c.json({ success: false, error: 'Message is required' }, 400);
    }

    if (message.length > 1000) {
      return c.json({ success: false, error: 'Message too long (max 1000 characters)' }, 400);
    }

    const uid = await getUidFromSession(c);
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

    // Use uid if authenticated, otherwise use anonymousUserId, fallback to ipAddress
    const userId = uid || anonymousUserId || ipAddress;

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(c, uid || undefined, ipAddress);
    if (!rateLimitCheck.allowed) {
      return c.json({ success: false, error: rateLimitCheck.error }, 429);
    }

    // Get conversation
    const conversationId = `ai-conv:${snapshotId}:${userId}`;
    console.log('🔍 Looking for conversation with ID:', conversationId);
    console.log('🔍 User ID:', uid, 'Anonymous ID:', anonymousUserId, 'IP Address:', ipAddress, 'Final User ID:', userId);
    const conversation = await c.env.KV_ANALYTICS.get(conversationId, { type: 'json' }) as AIConversation | null;
    console.log('🔍 Conversation found:', conversation ? 'Yes' : 'No');
    
    if (!conversation) {
      console.error('❌ Conversation not found for ID:', conversationId);
      return c.json({ success: false, error: 'Conversation not found. Please start a new conversation.' }, 404);
    }

    // Check conversation limits
    if (conversation.messages.length >= MAX_CONVERSATION_MESSAGES) {
      return c.json({ success: false, error: 'Conversation limit reached. Please start a new conversation.' }, 429);
    }

    // Add user message
    conversation.messages.push({
      role: 'user',
      content: message.trim()
    });

    // Get AI response
    try {
      console.log('🤖 Calling OpenAI with API key:', c.env.OPENAI_API_KEY ? 'Present' : 'Missing');
      const aiResponse = await callOpenAI(conversation.messages, c.env.OPENAI_API_KEY);
      
      conversation.messages.push({
        role: 'assistant',
        content: aiResponse
      });
      
      conversation.updatedAt = Date.now();
      
      // Save updated conversation
      await c.env.KV_ANALYTICS.put(conversationId, JSON.stringify(conversation), {
        expirationTtl: CONVERSATION_TIMEOUT_HOURS * 3600
      });
      
      // Track usage
      await updateRateLimit(c, uid || undefined, ipAddress);
      
      if (uid) {
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'ai_message_sent', { snapshotId, messageLength: message.length });
      }
      
      return c.json({
        success: true,
        data: {
          messages: conversation.messages.filter(m => m.role !== 'system'),
          response: aiResponse
        }
      });
      
    } catch (aiError) {
      console.error('OpenAI API error:', aiError);
      return c.json({ success: false, error: 'AI service temporarily unavailable' }, 503);
    }
    
  } catch (error) {
    console.error('Failed to send AI message:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}

// Get AI conversation for a snapshot
export async function handleGetAIConversation(c: any) {
  try {
    const snapshotId = c.req.param('snapshotId');
    if (!snapshotId) {
      return c.json({ success: false, error: 'Snapshot ID required' }, 400);
    }

    const uid = await getUidFromSession(c);
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    
    // Get conversation
    const conversationId = `ai-conv:${snapshotId}:${uid || ipAddress}`;
    const conversation = await c.env.KV_ANALYTICS.get(conversationId, { type: 'json' }) as AIConversation | null;
    
    if (!conversation) {
      return c.json({ 
        success: true, 
        data: { messages: [], exists: false } 
      });
    }

    return c.json({ 
      success: true, 
      data: {
        messages: conversation.messages.filter(m => m.role !== 'system'),
        exists: true,
        updatedAt: conversation.updatedAt
      }
    });
  } catch (error) {
    console.error('Failed to get AI conversation:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}

// OpenAI API integration
async function callOpenAI(messages: OpenAIMessage[], apiKey: string): Promise<string> {
  console.log('🔑 OpenAI API Key check:', apiKey ? 'Present' : 'Missing');
  if (!apiKey) {
    console.error('❌ OpenAI API key not configured');
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 429 || response.status === 402) {
      throw new Error('Service temporarily unavailable');
    }
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data: OpenAIResponse = await response.json();
  return data.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response at this time.';
}

// Get snapshot content for AI analysis
async function getSnapshotContentForAnalysis(snapshotId: string, files: SnapshotFile[], env: any): Promise<string> {
  try {
    console.log('🔍 Files to analyze:', files.map(f => ({ 
      path: f.p || f.name, 
      contentType: f.ct || f.type, 
      size: f.sz || f.size 
    })));
    
    // Get file contents from R2
    const fileContents = await Promise.all(
      files.slice(0, 10).map(async (file) => { // Limit to first 10 files
        try {
          // Handle both old and new file formats
          const filePath = file.p || file.name;
          const fileType = file.ct || file.type;
          
          // Check if file has a valid path
          if (!filePath) {
            console.warn('File missing path property:', file);
            return '';
          }
          
          // Check if it's a text file we can analyze
          const isTextFile = fileType === 'text/html' || fileType === 'text/css' || fileType === 'text/javascript' ||
                            filePath.endsWith('.html') || filePath.endsWith('.css') || filePath.endsWith('.js') ||
                            filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
          
          if (isTextFile) {
            console.log(`📄 Reading file: ${filePath} (${fileType})`);
            // Try both path formats: snap/snapshotId/filePath and snapshotId/filePath
            let object = await env.R2_SNAPSHOTS.get(`snap/${snapshotId}/${filePath}`);
            if (!object) {
              object = await env.R2_SNAPSHOTS.get(`${snapshotId}/${filePath}`);
            }
            
            if (object) {
              const content = await object.text();
              console.log(`✅ Successfully read ${filePath}, length: ${content.length}`);
              return `\n\n--- ${filePath} (${fileType}) ---\n${content.substring(0, 5000)}`; // Limit content length
            } else {
              console.warn(`❌ File not found in R2: snap/${snapshotId}/${filePath} or ${snapshotId}/${filePath}`);
            }
          } else {
            console.log(`⏭️ Skipping non-text file: ${filePath} (${fileType})`);
          }
        } catch (err) {
          console.warn(`Failed to read file ${file.p || file.name}:`, err);
        }
        return '';
      })
    );

    const validContents = fileContents.filter(content => content.length > 0);
    
    if (validContents.length === 0) {
      return `Snapshot ${snapshotId} contains ${files.length} files, but no readable text content was found. Files include: ${files.map(f => f.p || f.name).join(', ')}`;
    }

    return `Snapshot Analysis for ${snapshotId}:\nFiles: ${files.length} total\n\nContent:\n${validContents.join('\n')}`;
  } catch (error) {
    console.error('Failed to get snapshot content for analysis:', error);
    return `Snapshot ${snapshotId} - Error retrieving content: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Generate system prompt for UI/UX analysis
function getSystemPrompt(): string {
  return `You are a senior product manager and UX strategist with 10+ years of experience reviewing prototypes and giving feedback to design and engineering teams. You understand that prototypes are communication tools, not production code.

**Your expertise:**
- Product strategy and user experience design
- Cross-functional team communication and feedback
- Stakeholder presentation and demo preparation
- User research and usability principles
- Design system and accessibility standards

**Your role:** Help product managers give actionable, strategic feedback to their teams. Focus on user experience, business value, and team alignment - NOT code quality or technical implementation.

**Analysis priorities:**
1. **User Experience**: Is this intuitive and user-friendly?
2. **Business Value**: Does this solve real user problems effectively?
3. **Team Alignment**: Will this help designers and engineers understand the vision?
4. **Stakeholder Communication**: Is this ready for demos and presentations?
5. **Accessibility**: Will this work for all users?
6. **Mobile Experience**: How does this work on different devices?

**Your feedback style:**
- Lead with user impact and business value
- Give specific, actionable recommendations
- Explain the "why" behind each suggestion
- Prioritize feedback by user impact and effort
- Use language that helps PMs communicate with their teams
- Focus on what users will see, feel, and experience

Remember: This is throwaway prototype code. Focus on the user experience and design, not the technical implementation.`;
}

// Rate limiting functions
async function checkRateLimit(c: any, uid?: string, ipAddress?: string): Promise<{allowed: boolean, error?: string}> {
  const identifier = uid || ipAddress || 'anonymous';
  const hourKey = `rate-limit:${identifier}:${Math.floor(Date.now() / 3600000)}`;
  
  const current = await c.env.KV_ANALYTICS.get(hourKey, { type: 'json' }) || { requests: 0, tokens: 0 };
  
  if (current.requests >= RATE_LIMIT_REQUESTS_PER_HOUR) {
    return { allowed: false, error: 'Too many requests. Please try again in an hour.' };
  }
  
  if (current.tokens >= RATE_LIMIT_TOKENS_PER_HOUR) {
    return { allowed: false, error: 'Token limit reached. Please try again in an hour.' };
  }
  
  return { allowed: true };
}

async function updateRateLimit(c: any, uid?: string, ipAddress?: string, tokensUsed: number = 500): Promise<void> {
  const identifier = uid || ipAddress || 'anonymous';
  const hourKey = `rate-limit:${identifier}:${Math.floor(Date.now() / 3600000)}`;
  
  const current = await c.env.KV_ANALYTICS.get(hourKey, { type: 'json' }) || { requests: 0, tokens: 0 };
  current.requests += 1;
  current.tokens += tokensUsed;
  
  await c.env.KV_ANALYTICS.put(hourKey, JSON.stringify(current), { expirationTtl: 3600 });
}