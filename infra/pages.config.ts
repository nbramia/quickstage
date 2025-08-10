// Cloudflare Pages configuration
export default {
  name: 'quickstage-web',
  compatibility_date: '2024-05-12',
  routes: [
    {
      pattern: '/api/*',
      destination: '/api/:splat',
    },
    {
      pattern: '/s/*',
      destination: '/api/s/:splat',
    },
    {
      pattern: '/*',
      destination: '/index.html',
    },
  ],
  build: {
    command: 'pnpm build',
    output_dir: 'apps/web/dist',
  },
};

