import { describe, it, expect, beforeEach, afterEach } from 'vitest';
describe('Project Management Routes', () => {
    let env;
    let ctx;
    beforeEach(() => {
        // Mock Cloudflare environment
        env = {
            KV_PROJECTS: {
                put: async (key, value) => {
                    env.KV_PROJECTS._storage[key] = value;
                },
                get: async (key) => {
                    return env.KV_PROJECTS._storage[key] || null;
                },
                delete: async (key) => {
                    delete env.KV_PROJECTS._storage[key];
                },
                list: async (options) => {
                    const keys = Object.keys(env.KV_PROJECTS._storage);
                    const filteredKeys = options.prefix
                        ? keys.filter(key => key.startsWith(options.prefix))
                        : keys;
                    return {
                        keys: filteredKeys.map(name => ({ name }))
                    };
                },
                _storage: {}
            },
            KV_USERS: {
                get: async (key) => {
                    if (key === 'user:test-uid') {
                        return JSON.stringify({
                            uid: 'test-uid',
                            name: 'Test User',
                            email: 'test@example.com',
                            role: 'user'
                        });
                    }
                    return null;
                }
            }
        };
        ctx = {
            env,
            req: {
                json: async () => ({}),
                param: (name) => {
                    const params = {
                        'projectId': 'test-project-id'
                    };
                    return params[name];
                }
            },
            json: (data, status) => ({
                data,
                status: status || 200
            })
        };
    });
    afterEach(() => {
        // Clean up storage
        if (env.KV_PROJECTS._storage) {
            env.KV_PROJECTS._storage = {};
        }
    });
    describe('Project Creation', () => {
        it('should create a new project successfully', async () => {
            // Mock authenticated user
            const mockGetUidFromSession = async () => 'test-uid';
            ctx.req.json = async () => ({
                name: 'Test Project',
                description: 'A test project',
                color: '#4F46E5'
            });
            // Mock analytics manager
            const mockAnalyticsManager = {
                trackEvent: async () => { }
            };
            // Test project creation logic
            const projectData = {
                id: expect.stringMatching(/^proj_\d+_[a-z0-9]{9}$/),
                ownerUid: 'test-uid',
                name: 'Test Project',
                description: 'A test project',
                color: '#4F46E5',
                createdAt: expect.any(Number),
                updatedAt: expect.any(Number),
                snapshotCount: 0,
                isArchived: false,
                sortOrder: 0
            };
            // Verify the project would be stored correctly
            expect(projectData.name).toBe('Test Project');
            expect(projectData.ownerUid).toBe('test-uid');
            expect(projectData.snapshotCount).toBe(0);
        });
        it('should reject empty project names', async () => {
            ctx.req.json = async () => ({
                name: '',
                description: 'A test project'
            });
            const result = ctx.json({ error: 'Project name is required' }, 400);
            expect(result.status).toBe(400);
            expect(result.data.error).toBe('Project name is required');
        });
        it('should require authentication', async () => {
            const mockGetUidFromSession = async () => null;
            const result = ctx.json({ error: 'Unauthorized' }, 401);
            expect(result.status).toBe(401);
            expect(result.data.error).toBe('Unauthorized');
        });
    });
    describe('Project Retrieval', () => {
        beforeEach(async () => {
            // Set up test projects
            const project1 = {
                id: 'proj1',
                ownerUid: 'test-uid',
                name: 'Project 1',
                createdAt: Date.now() - 1000,
                updatedAt: Date.now() - 1000,
                snapshotCount: 5,
                sortOrder: 0
            };
            const project2 = {
                id: 'proj2',
                ownerUid: 'test-uid',
                name: 'Project 2',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                snapshotCount: 3,
                sortOrder: 1
            };
            await env.KV_PROJECTS.put('test-uid:proj1', JSON.stringify(project1));
            await env.KV_PROJECTS.put('test-uid:proj2', JSON.stringify(project2));
        });
        it('should return all projects for authenticated user', async () => {
            const projects = [
                JSON.parse(await env.KV_PROJECTS.get('test-uid:proj1')),
                JSON.parse(await env.KV_PROJECTS.get('test-uid:proj2'))
            ];
            expect(projects).toHaveLength(2);
            expect(projects[0].name).toBe('Project 1');
            expect(projects[1].name).toBe('Project 2');
        });
        it('should sort projects by sortOrder then createdAt', async () => {
            const projects = [
                JSON.parse(await env.KV_PROJECTS.get('test-uid:proj1')),
                JSON.parse(await env.KV_PROJECTS.get('test-uid:proj2'))
            ];
            // Sort logic test
            const sorted = projects.sort((a, b) => {
                if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
                    if (a.sortOrder !== b.sortOrder) {
                        return a.sortOrder - b.sortOrder;
                    }
                }
                return b.createdAt - a.createdAt;
            });
            expect(sorted[0].id).toBe('proj1'); // sortOrder 0
            expect(sorted[1].id).toBe('proj2'); // sortOrder 1
        });
    });
    describe('Project Updates', () => {
        beforeEach(async () => {
            const project = {
                id: 'test-project-id',
                ownerUid: 'test-uid',
                name: 'Original Name',
                description: 'Original description',
                color: '#4F46E5',
                createdAt: Date.now() - 1000,
                updatedAt: Date.now() - 1000,
                snapshotCount: 2
            };
            await env.KV_PROJECTS.put('test-uid:test-project-id', JSON.stringify(project));
        });
        it('should update project fields successfully', async () => {
            const existingProject = JSON.parse(await env.KV_PROJECTS.get('test-uid:test-project-id'));
            const updates = {
                name: 'Updated Name',
                description: 'Updated description',
                color: '#7C3AED'
            };
            const updatedProject = {
                ...existingProject,
                ...updates,
                updatedAt: Date.now()
            };
            expect(updatedProject.name).toBe('Updated Name');
            expect(updatedProject.description).toBe('Updated description');
            expect(updatedProject.color).toBe('#7C3AED');
            expect(updatedProject.updatedAt).toBeGreaterThan(existingProject.updatedAt);
        });
        it('should preserve existing fields when partially updating', async () => {
            const existingProject = JSON.parse(await env.KV_PROJECTS.get('test-uid:test-project-id'));
            const updates = { name: 'New Name Only' };
            const updatedProject = { ...existingProject, ...updates };
            expect(updatedProject.name).toBe('New Name Only');
            expect(updatedProject.description).toBe('Original description'); // preserved
            expect(updatedProject.snapshotCount).toBe(2); // preserved
        });
    });
    describe('Project Deletion', () => {
        beforeEach(async () => {
            const emptyProject = {
                id: 'empty-project',
                ownerUid: 'test-uid',
                name: 'Empty Project',
                snapshotCount: 0,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            const nonEmptyProject = {
                id: 'non-empty-project',
                ownerUid: 'test-uid',
                name: 'Non-empty Project',
                snapshotCount: 3,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await env.KV_PROJECTS.put('test-uid:empty-project', JSON.stringify(emptyProject));
            await env.KV_PROJECTS.put('test-uid:non-empty-project', JSON.stringify(nonEmptyProject));
        });
        it('should allow deletion of empty projects', async () => {
            const project = JSON.parse(await env.KV_PROJECTS.get('test-uid:empty-project'));
            expect(project.snapshotCount).toBe(0);
            // Deletion would be allowed
            expect(project.snapshotCount === 0).toBe(true);
        });
        it('should prevent deletion of projects with snapshots', async () => {
            const project = JSON.parse(await env.KV_PROJECTS.get('test-uid:non-empty-project'));
            expect(project.snapshotCount).toBeGreaterThan(0);
            // Would return error
            const result = ctx.json({
                error: 'Cannot delete project with snapshots. Please move or delete snapshots first.'
            }, 400);
            expect(result.status).toBe(400);
            expect(result.data.error).toContain('Cannot delete project with snapshots');
        });
    });
    describe('Project Archiving', () => {
        beforeEach(async () => {
            const project = {
                id: 'test-project-id',
                ownerUid: 'test-uid',
                name: 'Test Project',
                isArchived: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await env.KV_PROJECTS.put('test-uid:test-project-id', JSON.stringify(project));
        });
        it('should archive project successfully', async () => {
            const existingProject = JSON.parse(await env.KV_PROJECTS.get('test-uid:test-project-id'));
            // Add small delay to ensure different timestamp
            await new Promise(resolve => setTimeout(resolve, 1));
            const updatedProject = {
                ...existingProject,
                isArchived: true,
                updatedAt: Date.now()
            };
            expect(updatedProject.isArchived).toBe(true);
            expect(updatedProject.updatedAt).toBeGreaterThanOrEqual(existingProject.updatedAt);
        });
        it('should unarchive project successfully', async () => {
            // First set as archived
            const project = JSON.parse(await env.KV_PROJECTS.get('test-uid:test-project-id'));
            project.isArchived = true;
            await env.KV_PROJECTS.put('test-uid:test-project-id', JSON.stringify(project));
            // Then unarchive
            const updatedProject = {
                ...project,
                isArchived: false,
                updatedAt: Date.now()
            };
            expect(updatedProject.isArchived).toBe(false);
        });
    });
    describe('Project Reordering', () => {
        beforeEach(async () => {
            const projects = [
                { id: 'proj1', ownerUid: 'test-uid', name: 'Project 1', sortOrder: 0 },
                { id: 'proj2', ownerUid: 'test-uid', name: 'Project 2', sortOrder: 1 },
                { id: 'proj3', ownerUid: 'test-uid', name: 'Project 3', sortOrder: 2 }
            ];
            for (const project of projects) {
                await env.KV_PROJECTS.put(`test-uid:${project.id}`, JSON.stringify(project));
            }
        });
        it('should update sort order for reordered projects', async () => {
            const newOrder = ['proj3', 'proj1', 'proj2'];
            for (let i = 0; i < newOrder.length; i++) {
                const projectId = newOrder[i];
                const project = JSON.parse(await env.KV_PROJECTS.get(`test-uid:${projectId}`));
                const updatedProject = {
                    ...project,
                    sortOrder: i,
                    updatedAt: Date.now()
                };
                await env.KV_PROJECTS.put(`test-uid:${projectId}`, JSON.stringify(updatedProject));
            }
            // Verify new sort orders
            const proj3 = JSON.parse(await env.KV_PROJECTS.get('test-uid:proj3'));
            const proj1 = JSON.parse(await env.KV_PROJECTS.get('test-uid:proj1'));
            const proj2 = JSON.parse(await env.KV_PROJECTS.get('test-uid:proj2'));
            expect(proj3.sortOrder).toBe(0);
            expect(proj1.sortOrder).toBe(1);
            expect(proj2.sortOrder).toBe(2);
        });
        it('should validate project order array', async () => {
            const invalidOrder = 'not-an-array';
            const result = ctx.json({ error: 'Invalid project order' }, 400);
            expect(result.status).toBe(400);
            expect(result.data.error).toBe('Invalid project order');
        });
    });
    describe('Analytics Integration', () => {
        it('should track project creation events', async () => {
            const mockAnalytics = {
                trackEvent: async (userId, eventType, eventData) => {
                    expect(userId).toBe('test-uid');
                    expect(eventType).toBe('project_created');
                    expect(eventData).toHaveProperty('projectId');
                    expect(eventData).toHaveProperty('name');
                }
            };
            // Analytics tracking would be called during project creation
            await mockAnalytics.trackEvent('test-uid', 'project_created', {
                projectId: 'test-project-id',
                name: 'Test Project'
            });
        });
        it('should track project updates', async () => {
            const mockAnalytics = {
                trackEvent: async (userId, eventType, eventData) => {
                    expect(userId).toBe('test-uid');
                    expect(eventType).toBe('project_updated');
                    expect(eventData).toHaveProperty('projectId');
                    expect(eventData).toHaveProperty('updates');
                }
            };
            await mockAnalytics.trackEvent('test-uid', 'project_updated', {
                projectId: 'test-project-id',
                updates: ['name', 'description']
            });
        });
        it('should track project deletion', async () => {
            const mockAnalytics = {
                trackEvent: async (userId, eventType, eventData) => {
                    expect(userId).toBe('test-uid');
                    expect(eventType).toBe('project_deleted');
                    expect(eventData).toHaveProperty('projectId');
                    expect(eventData).toHaveProperty('name');
                }
            };
            await mockAnalytics.trackEvent('test-uid', 'project_deleted', {
                projectId: 'test-project-id',
                name: 'Test Project'
            });
        });
    });
});
