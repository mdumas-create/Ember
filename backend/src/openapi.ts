export const openapiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Ember API',
    version: '2.0.0',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/register': { post: { summary: 'Register' } },
    '/auth/login': { post: { summary: 'Login' } },
    '/posts': { get: { summary: 'Feed' }, post: { summary: 'Create post' } },
    '/posts/{postId}': { get: { summary: 'Get post by id' }, put: { summary: 'Update post' }, delete: { summary: 'Delete post' } },
    '/posts/{postId}/comment': { post: { summary: 'Create comment' } },
    '/posts/{postId}/comments': { get: { summary: 'Get comments' } },
    '/chat/conversations': { get: { summary: 'List conversations' }, post: { summary: 'Get or create conversation' } },
    '/chat/conversations/{conversationId}/messages': { get: { summary: 'Get messages' }, post: { summary: 'Send message' } },
    '/users/me': { get: { summary: 'Get my profile' }, put: { summary: 'Update my profile' }, delete: { summary: 'Delete account' } },
    '/users/me/notifications': { get: { summary: 'List notifications' } },
    '/stories': { get: { summary: 'List stories feed' }, post: { summary: 'Create story' } },
    '/hashtags/trending': { get: { summary: 'Trending hashtags' } },
    '/reports': { post: { summary: 'Create report' } },
    '/mod/reports': { get: { summary: 'List reports (moderation)' } },
    '/mod/reports/{reportId}/review': { post: { summary: 'Review report (moderation)' } },
    '/analytics/event': { post: { summary: 'Track event' } },
  },
} as const;
