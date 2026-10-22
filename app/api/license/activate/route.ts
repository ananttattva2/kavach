import { z } from 'zod';
import { activateDesktop,deviceSchema,licenseResponse } from '@/lib/license';
export async function POST(request:Request){try{const input=deviceSchema.extend({licenseKey:z.string().trim().min(4).max(150)}).parse(await request.json());return Response.json(await activateDesktop(input),{headers:{'Cache-Control':'no-store'}});}catch(error){return licenseResponse(error);}}
