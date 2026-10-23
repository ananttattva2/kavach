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
try{
 const cookie=await fixture(member,'user');
 browser=await chromium.launch({headless:true,executablePath:existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'better-auth.session_token',value:cookie,url:base,httpOnly:true,sameSite:'Lax'}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/dashboard');await page.getByRole('heading',{name:'Compliance portfolio'}).waitFor();await page.screenshot({path:'artifacts/dashboard-recovered.png'});
 await page.goto(base+'/dashboard?view=onboarding&stream=plastic&category=pibo');
 await page.getByRole('button',{name:'CTE & CTO / CCA'}).click();
 for(const route of ['clients','files']){const rejected=await page.request.post(base+'/api/'+route,{headers:{Origin:'https://unknown.example.com'},data:{}});assert.equal(rejected.status(),403);assert.equal((await rejected.json()).error,'Invalid origin');}
 const uploaded=await page.request.post(base+'/api/files',{headers:{Origin:base},multipart:{file:{name:'qa.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nQA attachment')}}});assert.equal(uploaded.status(),200,await uploaded.text());
 const count=page.getByLabel('Number of plant locations');
 for(const n of [1,2,1]){await count.fill(String(n));for(const key of ['cte','cteProducts','cto','ctoProducts','capacity','additional','regulations'])assert.equal(await page.locator('.table-'+key+' tbody tr').count(),n);}
 await page.getByRole('button',{name:'Submit onboarding',exact:true}).click();assert.equal(await page.locator('dialog[open]').count(),0);
 await page.getByRole('button',{name:'Basic information',exact:false}).click();
 for(const label of ['Client legal name','Trade name','Company group name','Authorised person name'])await page.getByLabel(label,{exact:false}).fill('QA Onboarding');
 await page.getByLabel('Company type',{exact:false}).selectOption('Private Limited');await page.getByLabel('Financial year',{exact:false}).selectOption('2026-27');await page.getByLabel('PIBO category',{exact:false}).selectOption('Producer');await page.getByLabel('Authorised contact number',{exact:false}).fill('9876543210');await page.getByLabel('Authorised email',{exact:false}).fill('qa@example.invalid');
 await page.getByRole('button',{name:'Company address',exact:false}).click();for(const [label,value] of [['Registered address line 1','Test address'],['Registered state','Gujarat'],['Registered city','Ahmedabad'],['Registered PIN code','380001']])await page.getByLabel(label,{exact:false}).fill(value);
 await page.getByRole('button',{name:'CTE & CTO / CCA'}).click();await page.getByRole('button',{name:'Submit onboarding',exact:true}).click();await page.locator('dialog[open]').waitFor();await page.screenshot({path:'artifacts/onboarding-confirmation.png'});await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.locator('dialog[open]').count(),0);
 await page.getByRole('button',{name:'Submit onboarding',exact:true}).click();const submission=page.waitForResponse(r=>r.url().endsWith('/api/clients')&&r.request().method()==='POST');await page.getByRole('button',{name:'Yes, continue'}).click();const submitted=await submission;assert.equal(submitted.status(),200,await submitted.text());await page.waitForURL('**/pre-audit');await page.getByRole('heading',{name:'ANANTTATTVA PRIVATE LIMITED'}).waitFor();await page.screenshot({path:'artifacts/pre-audit-desktop.png',fullPage:true});await page.getByRole('button',{name:'Client basic info',exact:true}).click();await page.getByText('QA Onboarding',{exact:true}).first().waitFor();assert.deepEqual(errors,[]);console.log('PASS dashboard recovery, trusted upload, rejected foreign origins, plant rows 1/2/1, validation, cancel, submit persistence, redirect and pre-audit tabs');
}finally{if(browser)await browser.close();await db.collection('files').deleteMany({ownerId:member.toString()});await db.collection('clients').deleteMany({ownerId:member.toString()});await db.collection('session').deleteMany({userId:member});await db.collection('session_licenses').deleteMany({userId:member.toString()});await db.collection('licenses').deleteMany({assignedUser:member.toString()});await db.collection('user').deleteOne({_id:member});await database.close();}
