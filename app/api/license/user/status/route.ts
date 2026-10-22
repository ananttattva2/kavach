import { mustAuthenticate,userLicenseStatus,licenseResponse } from '@/lib/license';
export async function GET(request:Request){try{return Response.json(await userLicenseStatus(await mustAuthenticate(request)),{headers:{'Cache-Control':'no-store'}});}catch(error){return licenseResponse(error);}}
