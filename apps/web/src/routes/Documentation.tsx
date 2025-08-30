import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../fonts.css';

interface DocSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

export default function Documentation() {
  const [activeSection, setActiveSection] = useState('getting-started');

  const sections: DocSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      content: (
        <div className="prose prose-lg max-w-none">
          <h2>Welcome to QuickStage</h2>
          <p>
            QuickStage is a lightning-fast platform for sharing and collaborating on web prototypes. 
            Deploy your local development projects in seconds and get feedback from your team instantly.
          </p>
          
          <h3>Quick Setup Guide</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 my-6">
            <div className="flex items-start">
              <div className="bg-blue-100 p-2 rounded-lg mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-blue-900 mb-2">3-Step Setup</h4>
                <ol className="list-decimal list-inside space-y-2 text-blue-800">
                  <li>Download and install the QuickStage extension for VS Code or Cursor</li>
                  <li>Open your project folder in your IDE</li>
                  <li>Click the "Stage" button to deploy your project instantly</li>
                </ol>
              </div>
            </div>
          </div>

          <h3>Key Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">⚡ Lightning Fast</h4>
              <p className="text-gray-600">Deploy your projects in under 10 seconds with optimized build processes.</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">🔒 Secure Sharing</h4>
              <p className="text-gray-600">Password-protected snapshots with role-based access control.</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">💬 Collaboration</h4>
              <p className="text-gray-600">Real-time comments, reviews, and feedback collection.</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">📱 Mobile Ready</h4>
              <p className="text-gray-600">Responsive design works perfectly on all devices.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'project-organization',
      title: 'Project Organization',
      content: (
        <div className="prose prose-lg max-w-none">
          <h2>Organizing Your Snapshots with Projects</h2>
          <p>
            Project folders help you organize snapshots by client, feature, or any categorization that makes sense for your workflow.
          </p>

          <h3>Creating Projects</h3>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 my-4">
            <h4 className="text-green-900 font-semibold mb-2">💡 Pro Tip</h4>
            <p className="text-green-800">Use color coding to visually distinguish different types of projects (e.g., client work vs. personal projects).</p>
          </div>

          <ol className="list-decimal list-inside space-y-2">
            <li>Navigate to your Dashboard</li>
            <li>Click the "+" button next to "Projects" in the sidebar</li>
            <li>Enter a project name and choose a color</li>
            <li>Click "Create" to save your new project</li>
          </ol>

          <h3>Moving Snapshots Between Projects</h3>
          <p>You can organize your snapshots by moving them into project folders:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Individual Move:</strong> Edit a snapshot and select a different project</li>
            <li><strong>Bulk Move:</strong> Select multiple snapshots and use the "Move to Project" bulk action</li>
          </ul>

          <h3>Project Management</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 my-4">
            <h4 className="text-yellow-900 font-semibold mb-2">⚠️ Important</h4>
            <p className="text-yellow-800">You can only delete empty projects. Move or delete all snapshots before removing a project.</p>
          </div>

          <ul className="list-disc list-inside space-y-1">
            <li><strong>Archive:</strong> Hide completed projects without deleting them</li>
            <li><strong>Reorder:</strong> Drag and drop projects in the sidebar to organize them</li>
            <li><strong>Delete:</strong> Remove empty projects permanently</li>
          </ul>
        </div>
      )
    },
    {
      id: 'snapshot-management',
      title: 'Snapshot Management',
      content: (
        <div className="prose prose-lg max-w-none">
          <h2>Advanced Snapshot Features</h2>
          <p>
            QuickStage provides powerful tools for managing and organizing your snapshots with rich metadata and flexible organization options.
          </p>

          <h3>Enhanced Metadata</h3>
          <p>Add context to your snapshots with detailed metadata:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Name:</strong> Give your snapshots meaningful names instead of using IDs</li>
            <li><strong>Description:</strong> Add detailed descriptions of what the snapshot contains</li>
            <li><strong>Tags:</strong> Use tags for easy filtering and organization</li>
            <li><strong>Version:</strong> Track version numbers or release names</li>
            <li><strong>Client Name:</strong> Associate snapshots with specific clients</li>
            <li><strong>Milestone:</strong> Mark project milestones or development phases</li>
            <li><strong>Review Summary:</strong> Add context for reviewers about what to focus on</li>
          </ul>

          <h3>Dashboard Sorting & Filtering</h3>
          <p>Find what you need quickly with powerful organization tools:</p>
          
          <h4>Sortable Columns</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>Created date (newest/oldest first)</li>
            <li>Last modified date</li>
            <li>Expiration date (expiring soon first)</li>
            <li>View count (most/least popular)</li>
            <li>Comment count</li>
            <li>Snapshot name (alphabetical)</li>
          </ul>

          <h4>Advanced Filtering</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Search:</strong> Full-text search across names, descriptions, tags, and metadata</li>
            <li><strong>Date Ranges:</strong> Filter by creation or modification dates</li>
            <li><strong>Project Folders:</strong> View snapshots from specific projects</li>
            <li><strong>Tags:</strong> Filter by one or more tags</li>
            <li><strong>Status:</strong> Show active, expired, or all snapshots</li>
            <li><strong>Review Status:</strong> Filter by snapshots with pending reviews</li>
          </ul>

          <h3>Bulk Operations</h3>
          <p>Manage multiple snapshots efficiently:</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
            <h4 className="text-blue-900 font-semibold mb-2">🚀 Time Saver</h4>
            <p className="text-blue-800">Select multiple snapshots using checkboxes to perform bulk operations like moving to projects, extending expiry, or adding tags.</p>
          </div>

          <ul className="list-disc list-inside space-y-1">
            <li><strong>Move to Project:</strong> Organize snapshots into project folders</li>
            <li><strong>Extend Expiry:</strong> Extend expiration dates for multiple snapshots</li>
            <li><strong>Bulk Tagging:</strong> Add or remove tags from multiple snapshots</li>
            <li><strong>Batch Delete:</strong> Remove multiple expired snapshots</li>
          </ul>
        </div>
      )
    },
    {
      id: 'collaboration',
      title: 'Comments & Collaboration',
      content: (
        <div className="prose prose-lg max-w-none">
          <h2>Collaborative Feedback System</h2>
          <p>
            QuickStage's advanced commenting system enables precise, contextual feedback on your prototypes with element pinning and threaded conversations.
          </p>

          <h3>Element Pinning</h3>
          <p>Pin comments directly to specific UI elements for precise feedback:</p>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 my-4">
            <h4 className="text-purple-900 font-semibold mb-2">✨ Interactive Comments</h4>
            <p className="text-purple-800">Click on any element in your prototype to attach comments. Comments automatically adapt to different screen sizes and device orientations.</p>
          </div>

          <h4>How Element Pinning Works</h4>
          <ol className="list-decimal list-inside space-y-2">
            <li>Navigate to your snapshot in the viewer</li>
            <li>Click the comment button to enter comment mode</li>
            <li>Click on any UI element to pin a comment</li>
            <li>Type your feedback and submit</li>
            <li>Comments appear as numbered bubbles on hover</li>
          </ol>

          <h3>Threaded Conversations</h3>
          <p>Keep discussions organized with nested reply chains:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Replies:</strong> Respond to specific comments to create conversation threads</li>
            <li><strong>Mentions:</strong> Use @username to notify team members</li>
            <li><strong>Rich Text:</strong> Format comments with Markdown, code snippets, and emojis</li>
            <li><strong>File Attachments:</strong> Attach images, documents, and design files</li>
          </ul>

          <h3>Comment States</h3>
          <p>Track the lifecycle of feedback with comment states:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Draft:</strong> Work on comments before publishing</li>
            <li><strong>Published:</strong> Live comments visible to all team members</li>
            <li><strong>Resolved:</strong> Mark feedback as addressed</li>
            <li><strong>Archived:</strong> Hide old conversations while preserving history</li>
          </ul>

          <h3>File Attachments</h3>
          <p>Enhance your feedback with visual examples:</p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 my-4">
            <h4 className="text-green-900 font-semibold mb-2">📎 Supported Formats</h4>
            <p className="text-green-800">JPG, PNG, GIF, PDF, TXT, MD, DOC, DOCX files up to 10MB each.</p>
          </div>
        </div>
      )
    },
    {
      id: 'review-workflows',
      title: 'Review Workflows',
      content: (
        <div className="prose prose-lg max-w-none">
          <h2>Structured Review Process</h2>
          <p>
            Streamline your feedback collection with formal review workflows, deadlines, and approval tracking.
          </p>

          <h3>Creating Review Requests</h3>
          <p>Request formal reviews from specific team members:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Navigate to your snapshot</li>
            <li>Click "Request Review" button</li>
            <li>Select team members to review</li>
            <li>Set an optional deadline</li>
            <li>Add review notes or specific areas to focus on</li>
            <li>Send the review request</li>
          </ol>

          <h3>Review Status Tracking</h3>
          <p>Monitor review progress with visual indicators:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Pending:</strong> Review requested but not yet started</li>
            <li><strong>In Progress:</strong> Some reviewers have started</li>
            <li><strong>Completed:</strong> All reviewers have submitted feedback</li>
            <li><strong>Overdue:</strong> Review deadline has passed</li>
          </ul>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 my-4">
            <h4 className="text-orange-900 font-semibold mb-2">⏰ Deadline Management</h4>
            <p className="text-orange-800">Set review deadlines to ensure timely feedback. Automatic reminders are sent 24 hours before the deadline.</p>
          </div>

          <h3>Review Dashboard</h3>
          <p>Track all your reviews in one place:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Reviews Requested:</strong> Reviews you've asked others to complete</li>
            <li><strong>Reviews Assigned:</strong> Reviews assigned to you by others</li>
            <li><strong>Overdue Reviews:</strong> Reviews past their deadline</li>
            <li><strong>Completed Reviews:</strong> Review history and outcomes</li>
          </ul>

          <h3>Approval Workflow</h3>
          <p>Each reviewer can provide one of these responses:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Approved:</strong> No changes needed, ready to proceed</li>
            <li><strong>Changes Requested:</strong> Specific feedback provided, changes needed</li>
          </ul>

          <h3>Automated Follow-ups</h3>
          <p>Stay on top of reviews with automatic notifications:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Email reminders sent to reviewers before deadlines</li>
            <li>Notifications when reviews are completed</li>
            <li>Summary emails for review requesters</li>
            <li>Escalation notifications for overdue reviews</li>
          </ul>
        </div>
      )
    },
    {
      id: 'best-practices',
      title: 'Best Practices',
      content: (
        <div className="prose prose-lg max-w-none">
          <h2>QuickStage Best Practices</h2>
          <p>
            Maximize your team's productivity with these proven workflows and organizational strategies.
          </p>

          <h3>Project Organization</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
            <h4 className="text-blue-900 font-semibold mb-2">🎯 Organization Strategy</h4>
            <p className="text-blue-800">Create projects for each client, product feature, or development sprint. Use consistent naming conventions like "Client-ProjectName" or "Sprint-XX-FeatureName".</p>
          </div>

          <h4>Recommended Project Structure</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>By Client:</strong> Separate projects for each client or customer</li>
            <li><strong>By Feature:</strong> Group related functionality together</li>
            <li><strong>By Sprint:</strong> Organize by development cycles</li>
            <li><strong>By Environment:</strong> Development, staging, production snapshots</li>
          </ul>

          <h3>Snapshot Naming</h3>
          <p>Use descriptive names that provide context:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Include Version:</strong> "User Dashboard v2.1"</li>
            <li><strong>Add Context:</strong> "Homepage Mobile Responsive Fix"</li>
            <li><strong>Use Dates:</strong> "Landing Page 2024-01-15"</li>
            <li><strong>Specify Purpose:</strong> "Client Review - Shopping Cart"</li>
          </ul>

          <h3>Effective Tagging</h3>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 my-4">
            <h4 className="text-green-900 font-semibold mb-2">🏷️ Tag Strategy</h4>
            <p className="text-green-800">Use consistent tags across your team. Create a tagging guide with standard tags like "mobile", "desktop", "bug-fix", "new-feature", "client-review".</p>
          </div>

          <h4>Tag Categories</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Platform:</strong> mobile, desktop, tablet</li>
            <li><strong>Status:</strong> draft, review, approved, deployed</li>
            <li><strong>Type:</strong> bug-fix, feature, enhancement, prototype</li>
            <li><strong>Priority:</strong> urgent, high, medium, low</li>
            <li><strong>Audience:</strong> internal, client, stakeholder</li>
          </ul>

          <h3>Review Workflow</h3>
          <h4>Review Request Guidelines</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Be Specific:</strong> Provide clear review notes about what feedback you need</li>
            <li><strong>Set Realistic Deadlines:</strong> Allow 24-48 hours for meaningful review</li>
            <li><strong>Include Context:</strong> Explain what changed since the last version</li>
            <li><strong>Assign Appropriately:</strong> Choose reviewers based on expertise needed</li>
          </ul>

          <h4>Giving Effective Feedback</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Be Constructive:</strong> Explain the issue and suggest solutions</li>
            <li><strong>Use Element Pinning:</strong> Attach comments to specific UI elements</li>
            <li><strong>Provide Examples:</strong> Attach reference images or mockups</li>
            <li><strong>Consider Context:</strong> Account for device types and user scenarios</li>
          </ul>

          <h3>Collaboration Tips</h3>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 my-4">
            <h4 className="text-purple-900 font-semibold mb-2">👥 Team Collaboration</h4>
            <p className="text-purple-800">Establish team conventions for commenting, reviewing, and organizing snapshots. Regular retrospectives help refine your workflow.</p>
          </div>

          <h4>Team Workflow</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Daily Standup:</strong> Share recent snapshots for quick feedback</li>
            <li><strong>Sprint Reviews:</strong> Use formal review workflow for sprint demos</li>
            <li><strong>Client Presentations:</strong> Create dedicated client review projects</li>
            <li><strong>Retrospectives:</strong> Review comment patterns and workflow efficiency</li>
          </ul>
        </div>
      )
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      content: (
        <div className="prose prose-lg max-w-none">
          <h2>Common Issues & Solutions</h2>
          <p>
            Quick solutions to the most common QuickStage issues and questions.
          </p>

          <h3>Extension Issues</h3>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
            <h4 className="text-red-900 font-semibold mb-2">❌ "Stage" Button Not Appearing</h4>
            <div className="text-red-800">
              <p className="mb-2"><strong>Solutions:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Restart VS Code/Cursor after installing the extension</li>
                <li>Check that you have a valid project folder open</li>
                <li>Ensure the extension is enabled in the Extensions panel</li>
                <li>Update to the latest version of the extension</li>
              </ul>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
            <h4 className="text-red-900 font-semibold mb-2">⚠️ Upload Fails or Times Out</h4>
            <div className="text-red-800">
              <p className="mb-2"><strong>Common Causes & Solutions:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Large Files:</strong> Remove or reduce large assets (images, videos)</li>
                <li><strong>node_modules:</strong> Ensure node_modules is in .gitignore</li>
                <li><strong>Build Artifacts:</strong> Clean build folders (dist/, build/) before staging</li>
                <li><strong>Network Issues:</strong> Check your internet connection and try again</li>
              </ul>
            </div>
          </div>

          <h3>Dashboard & Viewing Issues</h3>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 my-4">
            <h4 className="text-yellow-900 font-semibold mb-2">🔍 Snapshots Not Loading</h4>
            <div className="text-yellow-800">
              <p className="mb-2"><strong>Troubleshooting Steps:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Refresh the page (Ctrl+F5 or Cmd+Shift+R)</li>
                <li>Clear browser cache and cookies for quickstage.tech</li>
                <li>Check if you're logged in correctly</li>
                <li>Try logging out and logging back in</li>
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 my-4">
            <h4 className="text-yellow-900 font-semibold mb-2">🚫 Password Protected Snapshot Access</h4>
            <div className="text-yellow-800">
              <p className="mb-2"><strong>If you can't access a snapshot:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Ensure you're entering the password exactly as provided</li>
                <li>Check for extra spaces or hidden characters</li>
                <li>Try copying and pasting the password</li>
                <li>Contact the snapshot owner for a new password</li>
              </ul>
            </div>
          </div>

          <h3>Comments & Collaboration Issues</h3>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
            <h4 className="text-blue-900 font-semibold mb-2">💬 Comments Not Appearing</h4>
            <div className="text-blue-800">
              <p className="mb-2"><strong>Possible Solutions:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Refresh the snapshot viewer page</li>
                <li>Check if comments are in "resolved" or "archived" state</li>
                <li>Verify you have permission to view comments</li>
                <li>Try disabling browser ad blockers temporarily</li>
              </ul>
            </div>
          </div>

          <h3>Account & Billing Issues</h3>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 my-4">
            <h4 className="text-purple-900 font-semibold mb-2">💳 Pro Features Not Available</h4>
            <div className="text-purple-800">
              <p className="mb-2"><strong>Check These Items:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Verify your subscription status in Settings</li>
                <li>Ensure payment method is up to date</li>
                <li>Check if your trial has expired</li>
                <li>Log out and log back in to refresh permissions</li>
              </ul>
            </div>
          </div>

          <h3>Performance & Speed</h3>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 my-4">
            <h4 className="text-green-900 font-semibold mb-2">🐌 Slow Loading or Deployment</h4>
            <div className="text-green-800">
              <p className="mb-2"><strong>Optimization Tips:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Exclude Large Files:</strong> Use .gitignore to exclude unnecessary files</li>
                <li><strong>Optimize Images:</strong> Compress images before including in projects</li>
                <li><strong>Clean Dependencies:</strong> Remove unused npm packages</li>
                <li><strong>Build Optimization:</strong> Use production builds when possible</li>
              </ul>
            </div>
          </div>

          <h3>Getting Help</h3>
          <p>If you're still experiencing issues:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Check Status:</strong> Visit our status page for system updates</li>
            <li><strong>Contact Support:</strong> Email support@quickstage.tech with detailed information</li>
            <li><strong>Community:</strong> Join our Discord community for peer support</li>
            <li><strong>Documentation:</strong> Review this documentation for additional guidance</li>
          </ul>

          <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 my-6">
            <h4 className="text-gray-900 font-semibold mb-2">📋 When Contacting Support</h4>
            <p className="text-gray-700 mb-2">Please include:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Your account email address</li>
              <li>Browser and version (Chrome 91, Safari 14, etc.)</li>
              <li>Operating system (Windows 10, macOS Big Sur, etc.)</li>
              <li>Steps to reproduce the issue</li>
              <li>Screenshots or error messages if applicable</li>
            </ul>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  QuickStage
                </span>
              </Link>
              <span className="ml-4 text-gray-500">/</span>
              <span className="ml-4 text-gray-900 font-medium">Documentation</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-indigo-600 hover:text-indigo-800">
                Dashboard
              </Link>
              <Link to="/login" className="text-gray-600 hover:text-gray-900">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Documentation</h3>
              <nav className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      activeSection === section.id
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              {sections.find(s => s.id === activeSection)?.content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}