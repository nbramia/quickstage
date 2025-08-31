export class CommentsRoom implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname;
    
    // Handle enhanced comment system routes
    if (path.startsWith('/comments')) {
      return this.handleEnhancedComments(request, url, method);
    }
    
    // Legacy routes (keep for backward compatibility)
    if (method === 'GET') {
      const cursor = url.searchParams.get('cursor') || undefined;
      const list = await this.storage.list({ reverse: true, limit: 50 });
      const items: any[] = [];
      for (const [_key, value] of list) items.push(value);
      return new Response(JSON.stringify({ comments: items, cursor: null }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    if (method === 'POST') {
      const body = await request.json() as { 
        text?: string; 
        file?: string; 
        line?: number;
        author?: string;
      };
      
      if (!body.text || !body.text.trim()) {
        return new Response(JSON.stringify({ error: 'Comment text is required' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' } 
        });
      }

      const record = {
        id: `c:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
        text: String(body.text || '').slice(0, 1000),
        createdAt: Date.now(),
        author: body.author || 'Anonymous',
        file: body.file || undefined,
        line: body.line || undefined,
      };
      
      await this.storage.put(record.id, record);
      return new Response(JSON.stringify({ ok: true, comment: record }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    return new Response('Method not allowed', { status: 405 });
  }

  // Enhanced comment system handlers
  async handleEnhancedComments(request: Request, url: URL, method: string) {
    const path = url.pathname;
    
    try {
      if (method === 'POST' && path === '/comments/create') {
        return this.createEnhancedComment(request);
      }
      
      if (method === 'GET' && path === '/comments/list') {
        return this.listEnhancedComments(request, url);
      }
      
      if (method === 'GET' && path.match(/^\/comments\/[^\/]+$/)) {
        return this.getEnhancedComment(request, path);
      }
      
      if (method === 'PUT' && path.match(/^\/comments\/[^\/]+$/)) {
        return this.updateEnhancedComment(request, path);
      }
      
      if (method === 'DELETE' && path.match(/^\/comments\/[^\/]+$/)) {
        return this.deleteEnhancedComment(request, path);
      }
      
      if (method === 'POST' && path === '/comments/bulk-resolve') {
        return this.bulkResolveComments(request);
      }
      
      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('Enhanced comments error:', error);
      return new Response(JSON.stringify({ error: 'Internal error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  }

  async createEnhancedComment(request: Request) {
    const comment: any = await request.json();
    
    if (!comment.text || !comment.text.trim()) {
      return new Response(JSON.stringify({ error: 'Comment text is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // Store comment with all enhanced fields
    await this.storage.put(comment.id, comment);
    
    return new Response(JSON.stringify({ success: true, comment }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  async listEnhancedComments(request: Request, url: URL) {
    const snapshotId = url.searchParams.get('snapshotId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    
    const list = await this.storage.list({ reverse: true, limit });
    const comments: any[] = [];
    
    for (const [_key, value] of list) {
      const comment = value as any;
      // Filter by snapshotId if provided
      if (!snapshotId || comment.snapshotId === snapshotId) {
        comments.push(comment);
      }
    }
    
    return new Response(JSON.stringify({ success: true, comments }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  async getEnhancedComment(request: Request, path: string) {
    const commentId = path.split('/').pop();
    if (!commentId) {
      return new Response(JSON.stringify({ error: 'Invalid comment ID' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    const comment = await this.storage.get(commentId);
    
    if (!comment) {
      return new Response(JSON.stringify({ error: 'Comment not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    return new Response(JSON.stringify(comment), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  async updateEnhancedComment(request: Request, path: string) {
    const commentId = path.split('/').pop();
    if (!commentId) {
      return new Response(JSON.stringify({ error: 'Invalid comment ID' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    const updates: any = await request.json();
    
    const existing: any = await this.storage.get(commentId);
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Comment not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    const updated = { ...existing, ...updates };
    await this.storage.put(commentId, updated);
    
    return new Response(JSON.stringify(updated), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  async deleteEnhancedComment(request: Request, path: string) {
    const commentId = path.split('/').pop();
    if (!commentId) {
      return new Response(JSON.stringify({ error: 'Invalid comment ID' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    const existing = await this.storage.get(commentId);
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Comment not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    await this.storage.delete(commentId);
    
    return new Response(JSON.stringify({ success: true }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  async bulkResolveComments(request: Request) {
    const requestBody: any = await request.json();
    const { commentIds, resolvedBy, resolvedAt } = requestBody;
    
    if (!Array.isArray(commentIds) || commentIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid comment IDs' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    const results = [];
    for (const commentId of commentIds) {
      const comment: any = await this.storage.get(commentId);
      if (comment) {
        const updated = {
          ...comment,
          state: 'resolved',
          resolvedBy,
          resolvedAt,
          updatedAt: Date.now()
        };
        await this.storage.put(commentId, updated);
        results.push(updated);
      }
    }
    
    return new Response(JSON.stringify({ success: true, updatedComments: results }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}


