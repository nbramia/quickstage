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
    // Each user gets their own conversation based on uid or ipAddress
    console.log('✅ AI analysis access granted to:', { uid, ipAddress, isSuperadmin });

    // Get or create conversation
    const conversationId = `ai-conv:${snapshotId}:${uid || ipAddress}`;
    console.log('🔍 Creating/retrieving conversation with ID:', conversationId);
    console.log('🔍 User ID:', uid, 'IP Address:', ipAddress);
    let conversation = await c.env.KV_ANALYTICS.get(conversationId, { type: 'json' }) as AIConversation | null;
    
    if (!conversation) {
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
            Please analyze this prototype and provide specific UI/UX feedback and suggestions. 
            Here's the snapshot content:
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
    const { message } = body;
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return c.json({ success: false, error: 'Message is required' }, 400);
    }

    if (message.length > 1000) {
      return c.json({ success: false, error: 'Message too long (max 1000 characters)' }, 400);
    }

    const uid = await getUidFromSession(c);
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(c, uid || undefined, ipAddress);
    if (!rateLimitCheck.allowed) {
      return c.json({ success: false, error: rateLimitCheck.error }, 429);
    }

    // Get conversation
    const conversationId = `ai-conv:${snapshotId}:${uid || ipAddress}`;
    console.log('🔍 Looking for conversation with ID:', conversationId);
    console.log('🔍 User ID:', uid, 'IP Address:', ipAddress);
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
    // Get file contents from R2
    const fileContents = await Promise.all(
      files.slice(0, 10).map(async (file) => { // Limit to first 10 files
        try {
          if (file.ct === 'text/html' || file.ct === 'text/css' || file.ct === 'text/javascript' ||
              file.p.endsWith('.html') || file.p.endsWith('.css') || file.p.endsWith('.js')) {
            const object = await env.R2_SNAPSHOTS.get(`${snapshotId}/${file.p}`);
            if (object) {
              const content = await object.text();
              return `\n\n--- ${file.p} (${file.ct}) ---\n${content.substring(0, 5000)}`; // Limit content length
            }
          }
        } catch (err) {
          console.warn(`Failed to read file ${file.p}:`, err);
        }
        return '';
      })
    );

    const validContents = fileContents.filter(content => content.length > 0);
    
    if (validContents.length === 0) {
      return `Snapshot ${snapshotId} contains ${files.length} files, but no readable text content was found. Files include: ${files.map(f => f.p).join(', ')}`;
    }

    return `Snapshot Analysis for ${snapshotId}:\nFiles: ${files.length} total\n\nContent:\n${validContents.join('\n')}`;
  } catch (error) {
    console.error('Failed to get snapshot content for analysis:', error);
    return `Snapshot ${snapshotId} - Error retrieving content: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Generate system prompt for UI/UX analysis
function getSystemPrompt(): string {
  return `You are an expert UI/UX consultant specializing in prototype review and cross-functional communication. You help product managers, designers, developers, and technical sales teams improve prototypes used for stakeholder communication and product development alignment.

**Your role:** Analyze prototypes as communication tools between PMs, designers, engineers, and sales teams. Focus on clarity, usability, and technical feasibility.

**Target audience context:**
- **Product Managers**: Need clear user flows, business logic validation, and stakeholder-friendly interfaces
- **Product Designers**: Want feedback on design systems, visual hierarchy, and user experience patterns  
- **Software Developers**: Need technically feasible designs with clear interaction patterns and edge cases
- **Tech Sales**: Require compelling, professional interfaces that demonstrate product value effectively

**Key analysis areas:**
- **Communication Clarity**: Does the prototype clearly convey intended functionality?
- **User Flow Logic**: Are the workflows intuitive and complete for demo purposes?
- **Technical Feasibility**: Can developers easily understand and implement this design?
- **Professional Polish**: Does this look credible for client/stakeholder presentations?
- **Accessibility & Standards**: WCAG compliance and modern web standards
- **Mobile/Responsive**: Cross-device compatibility for various demo scenarios
- **Edge Cases**: Missing states, error handling, loading patterns that teams often overlook

**Your response style:**
- Lead with business impact and user value
- Provide specific, implementable suggestions with priority levels
- Include technical considerations for developers
- Suggest demo/presentation improvements for sales scenarios
- Reference modern design patterns and industry standards
- Keep feedback constructive and collaboration-focused

Focus on making this prototype an effective tool for cross-team communication and stakeholder buy-in.`;
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