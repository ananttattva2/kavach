import { z } from 'zod';
import { validateDesktop,deviceSchema,licenseResponse } from '@/lib/license';
export async function POST(request:Request){try{const input=deviceSchema.extend({activationToken:z.string().min(32).max(200)}).parse(await request.json());return Response.json(await validateDesktop(input),{headers:{'Cache-Control':'no-store'}});}catch(error){return licenseResponse(error);}}
