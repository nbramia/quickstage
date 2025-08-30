import { getUidFromSession } from '../auth';
import { getAnalyticsManager } from '../worker-utils';
// Generate unique project ID
function generateProjectId() {
    return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
// Create a new project
export async function handleCreateProject(c) {
    try {
        const uid = await getUidFromSession(c);
        if (!uid) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        const body = await c.req.json();
        const { name, description, color, icon } = body;
        if (!name || name.trim().length === 0) {
            return c.json({ error: 'Project name is required' }, 400);
        }
        const projectId = generateProjectId();
        const now = Date.now();
        const project = {
            id: projectId,
            ownerUid: uid,
            name: name.trim(),
            description: description?.trim(),
            color,
            icon,
            createdAt: now,
            updatedAt: now,
            snapshotCount: 0,
            isArchived: false,
            sortOrder: 0
        };
        // Store project
        await c.env.KV_PROJECTS.put(`${uid}:${projectId}`, JSON.stringify(project));
        // Track analytics
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'project_created', { projectId, name: project.name });
        return c.json({ success: true, project });
    }
    catch (error) {
        console.error('Error creating project:', error);
        return c.json({ error: 'Failed to create project' }, 500);
    }
}
// Get all projects for a user
export async function handleGetProjects(c) {
    try {
        const uid = await getUidFromSession(c);
        if (!uid) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        // List all projects for this user
        const projectsList = await c.env.KV_PROJECTS.list({
            prefix: `${uid}:`
        });
        const projects = [];
        for (const key of projectsList.keys) {
            const projectData = await c.env.KV_PROJECTS.get(key.name);
            if (projectData) {
                const project = JSON.parse(projectData);
                projects.push(project);
            }
        }
        // Sort by sortOrder, then by createdAt
        projects.sort((a, b) => {
            if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
                if (a.sortOrder !== b.sortOrder) {
                    return a.sortOrder - b.sortOrder;
                }
            }
            return b.createdAt - a.createdAt;
        });
        return c.json({ success: true, projects });
    }
    catch (error) {
        console.error('Error fetching projects:', error);
        return c.json({ error: 'Failed to fetch projects' }, 500);
    }
}
// Update a project
export async function handleUpdateProject(c) {
    try {
        const uid = await getUidFromSession(c);
        if (!uid) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        const projectId = c.req.param('projectId');
        const body = await c.req.json();
        // Get existing project
        const existingData = await c.env.KV_PROJECTS.get(`${uid}:${projectId}`);
        if (!existingData) {
            return c.json({ error: 'Project not found' }, 404);
        }
        const existingProject = JSON.parse(existingData);
        // Check ownership
        if (existingProject.ownerUid !== uid) {
            return c.json({ error: 'Unauthorized' }, 403);
        }
        // Update fields
        const updatedProject = {
            ...existingProject,
            name: body.name !== undefined ? body.name.trim() : existingProject.name,
            description: body.description !== undefined ? body.description?.trim() : existingProject.description,
            color: body.color !== undefined ? body.color : existingProject.color,
            icon: body.icon !== undefined ? body.icon : existingProject.icon,
            isArchived: body.isArchived !== undefined ? body.isArchived : existingProject.isArchived,
            sortOrder: body.sortOrder !== undefined ? body.sortOrder : existingProject.sortOrder,
            updatedAt: Date.now()
        };
        // Save updated project
        await c.env.KV_PROJECTS.put(`${uid}:${projectId}`, JSON.stringify(updatedProject));
        // Track analytics
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'project_updated', { projectId, updates: Object.keys(body) });
        return c.json({ success: true, project: updatedProject });
    }
    catch (error) {
        console.error('Error updating project:', error);
        return c.json({ error: 'Failed to update project' }, 500);
    }
}
// Delete a project
export async function handleDeleteProject(c) {
    try {
        const uid = await getUidFromSession(c);
        if (!uid) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        const projectId = c.req.param('projectId');
        // Get existing project
        const existingData = await c.env.KV_PROJECTS.get(`${uid}:${projectId}`);
        if (!existingData) {
            return c.json({ error: 'Project not found' }, 404);
        }
        const existingProject = JSON.parse(existingData);
        // Check ownership
        if (existingProject.ownerUid !== uid) {
            return c.json({ error: 'Unauthorized' }, 403);
        }
        // Check if project has snapshots
        if (existingProject.snapshotCount > 0) {
            return c.json({
                error: 'Cannot delete project with snapshots. Please move or delete snapshots first.'
            }, 400);
        }
        // Delete project
        await c.env.KV_PROJECTS.delete(`${uid}:${projectId}`);
        // Track analytics
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, 'project_deleted', { projectId, name: existingProject.name });
        return c.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting project:', error);
        return c.json({ error: 'Failed to delete project' }, 500);
    }
}
// Archive/unarchive a project
export async function handleArchiveProject(c) {
    try {
        const uid = await getUidFromSession(c);
        if (!uid) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        const projectId = c.req.param('projectId');
        const { isArchived } = await c.req.json();
        // Get existing project
        const existingData = await c.env.KV_PROJECTS.get(`${uid}:${projectId}`);
        if (!existingData) {
            return c.json({ error: 'Project not found' }, 404);
        }
        const existingProject = JSON.parse(existingData);
        // Check ownership
        if (existingProject.ownerUid !== uid) {
            return c.json({ error: 'Unauthorized' }, 403);
        }
        // Update archive status
        const updatedProject = {
            ...existingProject,
            isArchived,
            updatedAt: Date.now()
        };
        // Save updated project
        await c.env.KV_PROJECTS.put(`${uid}:${projectId}`, JSON.stringify(updatedProject));
        // Track analytics
        const analytics = getAnalyticsManager(c);
        await analytics.trackEvent(uid, isArchived ? 'project_archived' : 'project_unarchived', { projectId });
        return c.json({ success: true, project: updatedProject });
    }
    catch (error) {
        console.error('Error archiving project:', error);
        return c.json({ error: 'Failed to archive project' }, 500);
    }
}
// Reorder projects
export async function handleReorderProjects(c) {
    try {
        const uid = await getUidFromSession(c);
        if (!uid) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        const { projectOrder } = await c.req.json();
        if (!Array.isArray(projectOrder)) {
            return c.json({ error: 'Invalid project order' }, 400);
        }
        // Update sort order for each project
        for (let i = 0; i < projectOrder.length; i++) {
            const projectId = projectOrder[i];
            const projectData = await c.env.KV_PROJECTS.get(`${uid}:${projectId}`);
            if (projectData) {
                const project = JSON.parse(projectData);
                // Check ownership
                if (project.ownerUid !== uid) {
                    continue;
                }
                project.sortOrder = i;
                project.updatedAt = Date.now();
                await c.env.KV_PROJECTS.put(`${uid}:${projectId}`, JSON.stringify(project));
            }
        }
        return c.json({ success: true });
    }
    catch (error) {
        console.error('Error reordering projects:', error);
        return c.json({ error: 'Failed to reorder projects' }, 500);
    }
}
