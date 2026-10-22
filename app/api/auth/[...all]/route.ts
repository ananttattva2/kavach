import { getAuth } from '@/lib/auth';
export async function GET(request:Request) { try { return await getAuth().handler(request); } catch(error) { console.error('Auth request failed:', error instanceof Error ? error.message : 'Unknown error'); return Response.json({message:'Authentication unavailable. Check database and mail configuration.'},{status:503}); } }
export const POST = GET;
