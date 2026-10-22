import { z } from 'zod';
import { mustAuthenticate,checkOrigin,activateWeb,licenseResponse } from '@/lib/license';
export async function POST(request:Request){try{checkOrigin(request);const session=await mustAuthenticate(request);const input=z.object({licenseKey:z.string().trim().min(4).max(150)}).parse(await request.json());return Response.json(await activateWeb(session,input.licenseKey),{headers:{'Cache-Control':'no-store'}});}catch(error){return licenseResponse(error);}}
