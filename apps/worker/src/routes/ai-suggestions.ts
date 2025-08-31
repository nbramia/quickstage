import { getUidFromSession } from '../auth';
import { getAnalyticsManager } from '../worker-utils';
import { AISuggestion, AISuggestionType, AISuggestionsAnalysis, SnapshotFile } from '../types';

// Generate AI suggestions for a snapshot
export async function handleGenerateAISuggestions(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const snapshotId = c.req.param('snapshotId');
    if (!snapshotId) {
      return c.json({ success: false, error: 'Snapshot ID required' }, 400);
    }

    // Get snapshot data
    const snapshot = await c.env.KV_SNAPS.get(`snap:${snapshotId}`, { type: 'json' });
    if (!snapshot) {
      return c.json({ success: false, error: 'Snapshot not found' }, 404);
    }

    // Check if user owns the snapshot
    if (snapshot.ownerUid !== uid) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Generate suggestions based on file analysis
    const suggestions = await analyzeSnapshotFiles(snapshotId, snapshot.files, c.env);
    
    // Store suggestions in KV
    const suggestionsKey = `ai-suggestions:${snapshotId}`;
    const analysis: AISuggestionsAnalysis = {
      snapshotId,
      totalSuggestions: suggestions.length,
      suggestionsByCategory: countByCategory(suggestions),
      suggestionsBySeverity: countBySeverity(suggestions),
      overallScore: calculateOverallScore(suggestions),
      lastAnalyzedAt: Date.now(),
      analysisVersion: '1.0',
    };

    await c.env.KV_ANALYTICS.put(suggestionsKey, JSON.stringify({
      suggestions,
      analysis,
    }));

    // Track analytics
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'ai_suggestions_generated', {
      snapshotId,
      suggestionCount: suggestions.length,
      overallScore: analysis.overallScore,
    });

    return c.json({ 
      success: true, 
      data: { suggestions, analysis } 
    });
  } catch (error) {
    console.error('Failed to generate AI suggestions:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}

// Get AI suggestions for a snapshot
export async function handleGetAISuggestions(c: any) {
  try {
    const uid = await getUidFromSession(c);
    const snapshotId = c.req.param('snapshotId');
    
    if (!snapshotId) {
      return c.json({ success: false, error: 'Snapshot ID required' }, 400);
    }

    // Get snapshot to check ownership
    const snapshot = await c.env.KV_SNAPS.get(`snap:${snapshotId}`, { type: 'json' });
    if (!snapshot) {
      return c.json({ success: false, error: 'Snapshot not found' }, 404);
    }

    // Check access permissions (owner or public)
    if (snapshot.ownerUid !== uid && !snapshot.public) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Get stored suggestions
    const suggestionsKey = `ai-suggestions:${snapshotId}`;
    const stored = await c.env.KV_ANALYTICS.get(suggestionsKey, { type: 'json' });
    
    if (!stored) {
      return c.json({ 
        success: true, 
        data: { suggestions: [], analysis: null } 
      });
    }

    // Track viewing
    if (uid) {
      const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, 'ai_suggestions_viewed', { snapshotId });
    }

    return c.json({ 
      success: true, 
      data: stored 
    });
  } catch (error) {
    console.error('Failed to get AI suggestions:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}

// Update suggestion status (applied/dismissed)
export async function handleUpdateSuggestionStatus(c: any) {
  try {
    const uid = await getUidFromSession(c);
    if (!uid) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const snapshotId = c.req.param('snapshotId');
    const suggestionId = c.req.param('suggestionId');
    const body = await c.req.json();
    const { status, feedback } = body; // status: 'applied' | 'dismissed', feedback: 'helpful' | 'not_helpful' | 'neutral'

    if (!snapshotId || !suggestionId) {
      return c.json({ success: false, error: 'Snapshot ID and suggestion ID required' }, 400);
    }

    // Get snapshot to check ownership
    const snapshot = await c.env.KV_SNAPS.get(`snap:${snapshotId}`, { type: 'json' });
    if (!snapshot || snapshot.ownerUid !== uid) {
      return c.json({ success: false, error: 'Access denied' }, 403);
    }

    // Get stored suggestions
    const suggestionsKey = `ai-suggestions:${snapshotId}`;
    const stored = await c.env.KV_ANALYTICS.get(suggestionsKey, { type: 'json' });
    
    if (!stored || !stored.suggestions) {
      return c.json({ success: false, error: 'Suggestions not found' }, 404);
    }

    // Update the specific suggestion
    const updatedSuggestions = stored.suggestions.map((suggestion: AISuggestion) => {
      if (suggestion.id === suggestionId) {
        const now = Date.now();
        return {
          ...suggestion,
          status,
          userFeedback: feedback,
          appliedAt: status === 'applied' ? now : suggestion.appliedAt,
          dismissedAt: status === 'dismissed' ? now : suggestion.dismissedAt,
        };
      }
      return suggestion;
    });

    // Save updated suggestions
    await c.env.KV_ANALYTICS.put(suggestionsKey, JSON.stringify({
      ...stored,
      suggestions: updatedSuggestions,
    }));

    // Track analytics
    const eventType = status === 'applied' ? 'ai_suggestion_applied' : 'ai_suggestion_dismissed';
    const analytics = getAnalyticsManager(c);
    await analytics.trackEvent(uid, eventType, {
      snapshotId,
      suggestionId,
      suggestionType: stored.suggestions.find((s: AISuggestion) => s.id === suggestionId)?.type,
      feedback,
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to update suggestion status:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}

// Analyze snapshot files and generate suggestions
async function analyzeSnapshotFiles(snapshotId: string, files: SnapshotFile[], env: any): Promise<AISuggestion[]> {
  const suggestions: AISuggestion[] = [];
  const now = Date.now();

  // Find HTML files for analysis
  const htmlFiles = files.filter(file => 
    file.ct === 'text/html' || 
    file.p.endsWith('.html') ||
    file.p.endsWith('.htm')
  );

  // Find CSS files for analysis
  const cssFiles = files.filter(file => 
    file.ct === 'text/css' || 
    file.p.endsWith('.css')
  );

  // Find image files
  const imageFiles = files.filter(file => 
    file.ct.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(file.p)
  );

  // Generate suggestions based on file patterns
  
  // 1. Accessibility suggestions
  if (htmlFiles.length > 0) {
    suggestions.push(createSuggestion(
      snapshotId,
      'accessibility_missing_alt',
      'Add Alt Text to Images',
      'Images should have descriptive alt text for screen readers and accessibility.',
      'medium',
      'accessibility',
      now
    ));

    suggestions.push(createSuggestion(
      snapshotId,
      'accessibility_semantic_html',
      'Use Semantic HTML Elements',
      'Replace div elements with semantic HTML5 elements like header, nav, main, and footer.',
      'low',
      'accessibility',
      now
    ));

    suggestions.push(createSuggestion(
      snapshotId,
      'accessibility_focus_indicators',
      'Add Focus Indicators',
      'Ensure all interactive elements have visible focus indicators for keyboard navigation.',
      'medium',
      'accessibility',
      now
    ));
  }

  // 2. Usability suggestions
  suggestions.push(createSuggestion(
    snapshotId,
    'usability_button_size',
    'Ensure Adequate Button Size',
    'Interactive elements should be at least 44x44px for easy touch interaction.',
    'medium',
    'usability',
    now
  ));

  suggestions.push(createSuggestion(
    snapshotId,
    'usability_loading_states',
    'Add Loading States',
    'Provide visual feedback when users interact with buttons or forms.',
    'low',
    'usability',
    now
  ));

  suggestions.push(createSuggestion(
    snapshotId,
    'usability_error_messages',
    'Improve Error Messages',
    'Error messages should be clear, helpful, and positioned near the relevant input.',
    'medium',
    'usability',
    now
  ));

  // 3. Design suggestions
  if (cssFiles.length > 0) {
    suggestions.push(createSuggestion(
      snapshotId,
      'design_spacing_consistency',
      'Use Consistent Spacing',
      'Apply a consistent spacing scale (e.g., 8px, 16px, 24px) throughout your design.',
      'low',
      'design',
      now
    ));

    suggestions.push(createSuggestion(
      snapshotId,
      'design_typography_hierarchy',
      'Establish Typography Hierarchy',
      'Use different font sizes, weights, and styles to create clear visual hierarchy.',
      'medium',
      'design',
      now
    ));
  }

  // 4. Performance suggestions
  if (imageFiles.length > 0) {
    suggestions.push(createSuggestion(
      snapshotId,
      'performance_image_optimization',
      'Optimize Images',
      'Consider using modern image formats like WebP and implement lazy loading for better performance.',
      'medium',
      'performance',
      now
    ));
  }

  // 5. Mobile suggestions
  suggestions.push(createSuggestion(
    snapshotId,
    'mobile_responsive_design',
    'Ensure Mobile Responsiveness',
    'Test and optimize your design for mobile devices with proper viewport settings.',
    'high',
    'mobile',
    now
  ));

  suggestions.push(createSuggestion(
    snapshotId,
    'mobile_touch_targets',
    'Optimize Touch Targets',
    'Ensure buttons and links are large enough and properly spaced for touch interaction.',
    'medium',
    'mobile',
    now
  ));

  return suggestions;
}

function createSuggestion(
  snapshotId: string,
  type: AISuggestionType,
  title: string,
  description: string,
  severity: 'info' | 'low' | 'medium' | 'high',
  category: 'accessibility' | 'usability' | 'design' | 'performance' | 'mobile',
  generatedAt: number
): AISuggestion {
  return {
    id: generateSuggestionId(),
    snapshotId,
    type,
    title,
    description,
    severity,
    category,
    actionable: true,
    actionSteps: getActionSteps(type),
    resources: getResources(type),
    confidence: 0.8,
    generatedAt,
    status: 'active',
  };
}

function generateSuggestionId(): string {
  return 'ai-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function getActionSteps(type: AISuggestionType): string[] {
  const steps: Record<string, string[]> = {
    accessibility_missing_alt: [
      'Identify all img elements in your HTML',
      'Add descriptive alt attributes to each image',
      'Use empty alt="" for decorative images',
      'Test with a screen reader or accessibility tool'
    ],
    accessibility_semantic_html: [
      'Replace div elements with semantic HTML5 elements',
      'Use header, nav, main, aside, footer appropriately',
      'Add proper heading hierarchy (h1-h6)',
      'Use lists (ul, ol) for related items'
    ],
    usability_button_size: [
      'Review all interactive elements (buttons, links)',
      'Ensure minimum size of 44x44px',
      'Add adequate padding around clickable areas',
      'Test on mobile devices'
    ],
    mobile_responsive_design: [
      'Add viewport meta tag to HTML head',
      'Use flexible layouts (flexbox, grid)',
      'Test on various screen sizes',
      'Optimize typography for mobile reading'
    ],
    // Add more action steps as needed
  };
  return steps[type] || [];
}

function getResources(type: AISuggestionType): Array<{ title: string; url: string; type: 'article' | 'guide' | 'documentation' | 'example' | 'tool' }> {
  const resources: Record<string, Array<{ title: string; url: string; type: 'article' | 'guide' | 'documentation' | 'example' | 'tool' }>> = {
    accessibility_missing_alt: [
      { title: 'WebAIM Alt Text Guide', url: 'https://webaim.org/articles/alt/', type: 'guide' },
      { title: 'MDN Alt Attribute', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#alt', type: 'documentation' }
    ],
    mobile_responsive_design: [
      { title: 'Responsive Web Design Basics', url: 'https://web.dev/responsive-web-design-basics/', type: 'guide' },
      { title: 'CSS Media Queries', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries', type: 'documentation' }
    ],
    // Add more resources as needed
  };
  return resources[type] || [];
}

function countByCategory(suggestions: AISuggestion[]): Record<string, number> {
  const counts: Record<string, number> = {};
  suggestions.forEach(suggestion => {
    counts[suggestion.category] = (counts[suggestion.category] || 0) + 1;
  });
  return counts;
}

function countBySeverity(suggestions: AISuggestion[]): Record<string, number> {
  const counts: Record<string, number> = {};
  suggestions.forEach(suggestion => {
    counts[suggestion.severity] = (counts[suggestion.severity] || 0) + 1;
  });
  return counts;
}

function calculateOverallScore(suggestions: AISuggestion[]): number {
  if (suggestions.length === 0) return 100;
  
  const severityWeights = { info: 1, low: 2, medium: 4, high: 8 };
  const totalPenalty = suggestions.reduce((sum, suggestion) => 
    sum + severityWeights[suggestion.severity], 0
  );
  
  // Calculate score based on penalty (max penalty of 50 gives score of 50)
  const score = Math.max(50, 100 - totalPenalty);
  return Math.round(score);
}