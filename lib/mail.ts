import 'server-only';
export async function sendOTP(email: string, otp: string) {
 if (process.env.MAIL_TRANSPORT !== 'graph') throw new Error('Configure Microsoft Graph mail transport');
 const token = await fetch(`https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`, { method:'POST', body: new URLSearchParams({client_id:process.env.MS_CLIENT_ID!,client_secret:process.env.MS_CLIENT_SECRET!,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}), signal:AbortSignal.timeout(15000) });
 if (!token.ok) throw new Error('Mail authentication failed');
 const {access_token} = await token.json();
 const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(process.env.OTP_SENDER_EMAIL!)}/sendMail`, {method:'POST',headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'},body:JSON.stringify({message:{subject:'Your Kavach sign-in code',body:{contentType:'HTML',content:`<div style="font-family:Arial;padding:40px;background:#f5f5ef"><h2>Kavach · Anant Tattva</h2><p>Your secure sign-in code</p><h1 style="letter-spacing:12px;color:#225b43">${otp}</h1><p>This code expires in 5 minutes. Do not share it.</p></div>`},toRecipients:[{emailAddress:{address:email}}]},saveToSentItems:false}),signal:AbortSignal.timeout(15000)});
 if (!res.ok) throw new Error('Unable to send OTP email');
}
