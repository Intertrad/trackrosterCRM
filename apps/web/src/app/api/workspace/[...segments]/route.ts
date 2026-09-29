import { proxyWorkspaceRequest } from '@/lib/server/workspace-proxy';

export const dynamic = 'force-dynamic';
async function handle(request: Request, context: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await context.params;
  return proxyWorkspaceRequest(request, segments);
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
