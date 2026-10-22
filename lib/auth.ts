import { betterAuth } from 'better-auth';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { emailOTP, admin } from 'better-auth/plugins';
import { defaultAc, userAc } from 'better-auth/plugins/admin/access';
import { nextCookies } from 'better-auth/next-js';
import { db, getClient } from './db';
import { sendOTP } from './mail';
import { authOrigins } from './auth-origins';
function createAuth() {
 return betterAuth({database:mongodbAdapter(db(),{client:getClient()}),secret:process.env.BETTER_AUTH_SECRET,baseURL:process.env.BETTER_AUTH_URL,trustedOrigins:authOrigins(process.env.BETTER_AUTH_URL),rateLimit:{enabled:true,storage:'database',window:60,max:15},plugins:[emailOTP({otpLength:6,expiresIn:300,allowedAttempts:5,storeOTP:'hashed',async sendVerificationOTP({email,otp}) { await sendOTP(email,otp); }}),admin({adminRoles:['admin','super_admin'],roles:{admin:defaultAc.newRole({user:['list','get'],session:['list']}),super_admin:defaultAc.newRole({user:['list','get'],session:['list']}),user:userAc,manager:userAc,client:userAc}}),nextCookies()]});
}
let instance:ReturnType<typeof createAuth> | undefined;
export function getAuth(){return instance ??= createAuth();}
