'use client';

import { useRef, useState } from 'react';
import { Bot, Check, Download, FileJson, Sparkles, X } from 'lucide-react';
import { Button } from './ui/button';
import { importOnboardingJson, onboardingJsonTemplate } from '@/lib/onboarding-import';
import { submissionErrors, type ClientData } from '@/lib/schema';
import './onboarding-bot.css';

export function OnboardingBot({data, disabled, onFill}:{data:ClientData;disabled:boolean;onFill:(next:ClientData)=>void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [json,setJson] = useState('');
  const [error,setError] = useState('');
  const [preview,setPreview] = useState<ClientData|null>(null);
  const missing = preview ? submissionErrors(preview) : [];

  function update(text:string) {setJson(text);setError('');setPreview(null);}
  function template() {return JSON.stringify(onboardingJsonTemplate(data),null,2);}
  function download() {
    const url = URL.createObjectURL(new Blob([template()],{type:'application/json'}));
    const link = document.createElement('a');link.href=url;link.download='kavach-onboarding-template.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function validate() {
    try {setPreview(importOnboardingJson(json,data));setError('');}
    catch (error) {setError((error as Error).message);setPreview(null);}
  }
  return <>
    <Button variant="outline" disabled={disabled} onClick={()=>dialog.current?.showModal()}><Bot size={18}/>Fill with JSON<span className="bot-admin-badge">ADMIN</span></Button>
    <dialog ref={dialog} className="onboarding-bot" data-lenis-prevent aria-labelledby="bot-title" aria-describedby="bot-description" onClose={()=>{setPreview(null);setError('');}}>
      <header className="bot-header"><span className="bot-icon"><Bot size={26}/></span><div><span className="bot-eyebrow">ADMIN ASSISTANT</span><h2 id="bot-title">Fill onboarding with JSON</h2></div><button className="bot-close" aria-label="Close JSON bot" onClick={()=>dialog.current?.close()}><X size={20}/></button></header>
      <div className="bot-body"><p id="bot-description">Paste your client JSON to fill all four steps in one go. Review the details, then submit onboarding.</p>
        <div className="bot-step-list">{['Company & people','Company address','Documents & MSME','CTE & CTO / CCA'].map((step,i)=><span key={step}><b>{String(i+1).padStart(2,'0')}</b>{step}</span>)}</div>
        <div className="bot-editor-heading"><label htmlFor="onboarding-json"><FileJson size={16}/>Client JSON</label><div><button onClick={()=>update(template())}>Use current form template</button><button onClick={download}><Download size={14}/>Download template</button></div></div>
        <textarea id="onboarding-json" spellCheck={false} value={json} onChange={e=>update(e.target.value)} placeholder={'{\n  "basic": { "Client legal name": "Your company" },\n  "plantCount": 1,\n  "tables": { "cte": [{ "Plant name": "Main plant" }] }\n}'} aria-invalid={Boolean(error)} aria-describedby="bot-format-help"/>
        <p id="bot-format-help" className="bot-help">Use the template’s exact field names and YYYY-MM-DD dates. Only supplied values are updated. Upload actual document files in the form; JSON fills certificate details.</p>
        {error&&<div role="alert" className="bot-error"><strong>Check your JSON</strong><pre>{error}</pre></div>}
        {preview&&<div role="status" className="bot-preview"><strong><Check size={17}/>JSON is ready to fill</strong><div className="bot-preview-stats"><span><b>{Object.values(preview.basic).filter(Boolean).length}</b>Company fields</span><span><b>{preview.plantCount}</b>Plant locations</span><span><b>{Object.values(preview.tables).reduce((sum,rows)=>sum+rows.length,0)}</b>Table rows</span></div>{missing.length>0?<details><summary>{missing.length} required details still need attention before submission</summary><ul>{missing.map(item=><li key={item}>{item}</li>)}</ul></details>:<p>Required company and address details are ready for review.</p>}</div>}
      </div>
      <footer className="bot-footer"><Button variant="ghost" onClick={()=>dialog.current?.close()}>Cancel</Button><div><Button variant="outline" disabled={!json.trim()} onClick={validate}><Check size={16}/>Validate JSON</Button><Button disabled={!preview||disabled} onClick={()=>{if(preview){onFill(preview);dialog.current?.close();setPreview(null);}}}><Sparkles size={16}/>Fill all steps</Button></div></footer>
    </dialog>
  </>;
}
