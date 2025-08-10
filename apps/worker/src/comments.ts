export class CommentsRoom {
  state: any; // DurableObjectState
  storage: any; // DurableObjectStorage

  constructor(state: any, env: any) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    
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
}


