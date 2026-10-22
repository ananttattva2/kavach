import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.env.QA_BASE_URL||'http://localhost:9000';
for(const origin of ['http://localhost:9000','http://127.0.0.1:9000','http://localhost:3000','https://unknown.example.com']){
 const response=await fetch(base+'/api/license/user/activate',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({licenseKey:'TEST-NOT-A-REAL-KEY'})});const result=await response.json();
 assert.equal(response.status,origin.includes('unknown')?403:401);assert.equal(result.code,origin.includes('unknown')?'INVALID_ORIGIN':'UNAUTHORIZED');
}
const icon=await fetch(base+'/favicon.ico');assert.equal(icon.status,200);assert.match(icon.headers.get('content-type'),/image/);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});await page.addInitScript(()=>{const observer=new MutationObserver(()=>{if(document.body){document.body.setAttribute('cz-shortcut-listen','true');observer.disconnect();}});observer.observe(document.documentElement||document,{childList:true,subtree:true});});await page.goto(base+'/login');await page.getByRole('textbox',{name:'Email address'}).waitFor();await page.waitForTimeout(500);assert.ok(!errors.some(error=>/hydration|hydrated|share-modal/i.test(error)));}finally{await browser.close();}
console.log('PASS local origin aliases, unknown-origin rejection, favicon and extension body-attribute hydration. No email sent or account key used.');
