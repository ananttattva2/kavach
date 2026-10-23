import { chromium } from '@playwright/test';
import { MongoClient, ObjectId } from 'mongodb';
import { createHmac, randomBytes } from 'node:crypto';
import { setServers } from 'node:dns';
import { setServers as setPromiseServers } from 'node:dns/promises';
import { existsSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
process.loadEnvFile('.env.local');
if(process.env.DNS_SERVERS){const servers=process.env.DNS_SERVERS.split(',');setServers(servers);setPromiseServers(servers);}
mkdirSync('artifacts',{recursive:true});
const base=process.env.QA_BASE_URL||'http://localhost:9000';
const database=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
const db=database.db(process.env.MONGODB_DB||'kavach');
const member=new ObjectId(),admin=new ObjectId();const errors=[];let browser;
async function fixture(id,role){const token=randomBytes(32).toString('hex'),sessionId=new ObjectId(),licenseId=new ObjectId(),now=new Date();const email=`qa-${id}@example.invalid`;await db.collection('user').insertOne({_id:id,name:role==='admin'?'QA Administrator':'QA Member',email,emailVerified:true,role,banned:false,createdAt:now,updatedAt:now});await db.collection('session').insertOne({_id:sessionId,userId:id,token,expiresAt:new Date(Date.now()+1200000),createdAt:now,updatedAt:now});await db.collection('licenses').insertOne({_id:licenseId,keyHash:randomBytes(32).toString('hex'),keyPrefix:'TEST',keyLast4:'0000',assignedEmail:email,issuedToName:'QA',assignedUser:id.toString(),status:'active',maxDevices:1,expiresAt:null,activatedDevices:[],createdBy:id.toString(),createdAt:now,updatedAt:now});await db.collection('session_licenses').insertOne({_id:sessionId.toString(),userId:id.toString(),licenseId,verifiedUntil:new Date(Date.now()+1200000),verifiedAt:now});return encodeURIComponent(token+'.'+createHmac('sha256',process.env.BETTER_AUTH_SECRET).update(token).digest('base64'));}
try {
 const userCookie=await fixture(member,'user'),adminCookie=await fixture(admin,'admin');
 browser=await chromium.launch({headless:true,executablePath:existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addCookies([{name:'better-auth.session_token',value:userCookie,url:base,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const url=base+'/dashboard?view=onboarding&stream=plastic&category=pibo';
 await page.goto(url);await page.getByRole('button',{name:'Submit onboarding',exact:true}).waitFor({state:'hidden'});await page.getByRole('button',{name:'Continue',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Fill with JSON'}).count(),0);
 await context.clearCookies();await context.addCookies([{name:'better-auth.session_token',value:adminCookie,url:base,httpOnly:true,sameSite:'Lax'}]);
 await page.goto(url);await page.getByRole('button',{name:'Fill with JSON'}).click();
 const editor=page.getByLabel('Client JSON',{exact:true}),validate=page.getByRole('button',{name:'Validate JSON'}),fill=page.getByRole('button',{name:'Fill all steps',exact:true});
 assert.equal(await fill.isDisabled(),true);
 await editor.fill('{bad json}');await validate.click();await page.getByText('Invalid JSON. Check commas, double quotes and brackets.').waitFor();assert.equal(await fill.isDisabled(),true);
 await editor.fill(JSON.stringify({id:'wrong-record',status:'submitted'}));await validate.click();await page.locator('.onboarding-bot').getByRole('alert').getByText(/Unrecognized keys/).waitFor();
 await editor.fill(JSON.stringify({plantCount:1.5}));await validate.click();await page.locator('.onboarding-bot').getByRole('alert').waitFor();assert.equal(await fill.isDisabled(),true);
 await editor.fill(JSON.stringify({basic:{'Company type':'Made up type'}}));await validate.click();await page.locator('.onboarding-bot').getByRole('alert').getByText(/basic.Company type/).waitFor();
 await page.getByRole('button',{name:'Use current form template'}).click();const template=JSON.parse(await editor.inputValue());assert.ok(template.documents.length===7&&template.tables.msme&&template.tables.regulations);
 const payload={...template,basic:{'Client legal name':'JSON Bot QA Limited','Trade name':'JSON Bot QA','Company group name':'QA Group','Company type':'Private Limited','Financial year':'2026-27','PIBO category':'Producer','Authorised person name':'QA Admin','Authorised contact number':'9876543210','Authorised email':'qa@example.invalid'},address:{'Registered address line 1':'42 Test Street','Registered state':'Gujarat','Registered city':'Ahmedabad','Registered PIN code':'380001'},sameAddress:true,plantCount:2,documents:[{type:'GST Certificate',number:'QA-GST-123',date:'2026-01-01'}],tables:{msme:[{Year:'2026-27',Status:'Small','Udyam number':'QA-UDYAM'}],cte:[{'Plant name':'Plant A','Consent number':'QA-CTE','Issued date':'2026-01-01'}],cteProducts:[{'Plant name':'Plant A','Product name':'Test product',Quantity:100,UOM:'KG'}],cto:[{'Plant name':'Plant A','CTO / CCA type':'Fresh','Consent order number':'QA-CTO'}],ctoProducts:[{'Plant name':'Plant A','Product name':'Test product',Quantity:75,UOM:'KG'}],capacity:[{'Product name':'Test product','Production output in one hour':10,'Machine working days':20,'Working hours per day':8,UOM:'KG'}],additional:[{'Plant name':'Plant A','Ground / bore well water usage':'No'}],regulations:[{Regulation:'Water','Plant name':'Plant A','Permitted quantity':10,UOM:'KLD'}]}};
 await editor.fill(JSON.stringify(payload,null,2));await validate.click();await page.getByText('JSON is ready to fill',{exact:true}).waitFor();await page.screenshot({path:'artifacts/onboarding-bot-preview.png'});assert.equal(await fill.isEnabled(),true);
 await fill.click();assert.equal(await page.locator('.onboarding-bot[open]').count(),0);assert.equal(await page.getByLabel('Number of plant locations').inputValue(),'2');assert.equal(await page.getByLabel('CTE details row 1 Consent number',{exact:true}).inputValue(),'QA-CTE');assert.equal(await page.getByLabel('Production capacity validation row 1 Total monthly capacity (kg)',{exact:true}).inputValue(),'1600');assert.equal(await page.getByLabel('CTO / CCA additional details row 1 CGWA NOC requirement',{exact:true}).inputValue(),'Not Applicable');assert.equal(await page.locator('.table-regulations tbody tr').count(),2);
 await page.getByRole('button',{name:'Basic information',exact:false}).click();assert.equal(await page.getByLabel('Client legal name',{exact:false}).inputValue(),'JSON Bot QA Limited');
 await page.getByRole('button',{name:'Company address',exact:false}).click();assert.equal(await page.getByLabel('Registered city',{exact:false}).inputValue(),'Ahmedabad');assert.equal(await page.getByRole('checkbox',{name:'Same as registered'}).isChecked(),true);
 await page.getByRole('button',{name:'Documents & MSME',exact:false}).click();assert.equal(await page.getByLabel('GST Certificate number',{exact:true}).inputValue(),'QA-GST-123');assert.equal(await page.getByLabel('MSME details row 1 Udyam number',{exact:true}).inputValue(),'QA-UDYAM');
 await page.getByRole('button',{name:'CTE & CTO / CCA',exact:false}).click();await page.getByRole('button',{name:'Submit onboarding',exact:true}).click();await page.getByRole('button',{name:'Yes, continue'}).click();await page.waitForURL('**/pre-audit');await page.getByRole('heading',{name:'ANANTTATTVA PRIVATE LIMITED'}).waitFor();
 const record=await db.collection('clients').findOne({ownerId:admin.toString()});assert.equal(record.status,'submitted');assert.equal(record.address['Communication city'],'Ahmedabad');assert.equal(record.tables.capacity[0]['Total monthly capacity (kg)'],'1600');assert.deepEqual(errors,[]);
 // Mobile layout, partial imports, and cancel leave the existing form untouched.
 await page.setViewportSize({width:390,height:844});await page.goto(url);await page.getByRole('button',{name:'Fill with JSON'}).click();await editor.fill(JSON.stringify({basic:{'Trade name':'Partial example'}}));await validate.click();await page.getByText(/required details still need attention/).waitFor();await page.screenshot({path:'artifacts/onboarding-bot-mobile.png'});await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.getByLabel('Trade name',{exact:false}).inputValue(),'');
 console.log('PASS member exclusion, admin JSON validation, all four steps, derived fields, plant rows, submission, partial import and mobile cancel');
} finally {
 if(browser)await browser.close();for(const id of [member,admin]){await db.collection('client_audits').deleteMany({ownerId:id.toString()});await db.collection('clients').deleteMany({ownerId:id.toString()});await db.collection('session').deleteMany({userId:id});await db.collection('session_licenses').deleteMany({userId:id.toString()});await db.collection('licenses').deleteMany({assignedUser:id.toString()});await db.collection('user').deleteOne({_id:id});}await database.close();
}
