import { getAuth } from '@/lib/auth';
import { z } from 'zod';
export async function PATCH(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const session=await getAuth().api.getSession({headers:request.headers});
 if(!session)return Response.json({error:'Unauthorized'},{status:401});
 const parsed=z.object({name:z.string().trim().min(2).max(80)}).safeParse(await request.json());
 if(!parsed.success)return Response.json({error:'Enter a name between 2 and 80 characters'},{status:400});
 try{await getAuth().api.updateUser({headers:request.headers,body:parsed.data});return Response.json({success:true});}catch{return Response.json({error:'Unable to update your profile'},{status:503});}
}
