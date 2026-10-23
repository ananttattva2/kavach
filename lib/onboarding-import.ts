import { z } from 'zod';
import { clientSchema, documentTypes, fieldMap, tables, type ClientData } from './schema';
import { onboardingChoices, tableChoices } from './onboarding-choices';

const value = z.union([z.string().max(5000), z.number().finite()]).transform(v => String(v));
const fields = (keys: readonly string[]) => z.object(Object.fromEntries(keys.map(key => [key, value.optional()]))).strict();
const inputSchema = z.object({
  basic: fields(fieldMap.basic).optional(),
  address: fields(fieldMap.address).optional(),
  sameAddress: z.boolean().optional(),
  plantCount: z.number().int().min(0).max(100).optional(),
  documents: z.array(z.object({type:z.enum(documentTypes as [string, ...string[]]), number:z.string().max(200).optional(), date:z.string().optional()}).strict()).max(20).optional(),
  tables: z.object(Object.fromEntries(Object.entries(tables).map(([key, config]) => [key, z.array(fields(config.fields.filter(f => !['Document','Certificate'].includes(f)))).max(100).optional()]))).strict().optional(),
}).strict().refine(data => Object.keys(data).length > 0, 'Include at least one onboarding section.');

function validateField(field: string, text: string, path: string, choices?: string[]) {
  if (!text) return;
  if (choices && !choices.includes(text)) throw new Error(`${path}: choose ${choices.join(', ')}.`);
  if (/date|Valid up to/i.test(field) && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text)) || new Date(text).toISOString().slice(0,10) !== text)) throw new Error(`${path}: use a valid date in YYYY-MM-DD format.`);
  if (/email/i.test(field) && !z.email().safeParse(text).success) throw new Error(`${path}: enter a valid email address.`);
  if (/Quantity|Turnover|Permitted quantity|capital investment|Production output|Power per hour|working days|Working hours|capacity \(kg\)/i.test(field) && (!Number.isFinite(Number(text)) || Number(text) < 0)) throw new Error(`${path}: enter a non-negative number.`);
}

/** Import form values only. Record identity, status and uploaded files stay with the current record. */
export function importOnboardingJson(text: string, current: ClientData): ClientData {
  if (text.length > 1_000_000) throw new Error('JSON must be smaller than 1 MB.');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Invalid JSON. Check commas, double quotes and brackets.'); }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues.slice(0,5).map(i => `${i.path.join('.') || 'JSON'}: ${i.message}`).join('\n'));
  const input = parsed.data;
  const next = structuredClone(current);
  next.status = 'draft';
  next.basic = {...next.basic, ...input.basic} as Record<string,string>;
  next.address = {...next.address, ...input.address} as Record<string,string>;
  next.sameAddress = input.sameAddress ?? next.sameAddress;
  next.plantCount = input.plantCount ?? next.plantCount;
  for (const [field, text] of Object.entries(input.basic || {})) {
    const choices = field === 'PIBO category' && current.wasteStream === 'ewaste' ? ['Producer','Recycler','Manufacturer','Refurbisher'] : onboardingChoices[field];
    validateField(field, text || '', `basic.${field}`, choices);
  }
  for (const [field, text] of Object.entries(input.address || {})) {
    if (/PIN code/.test(field) && text && !/^\d{6}$/.test(text)) throw new Error(`address.${field}: use a 6-digit PIN code.`);
  }
  const seen = new Set<string>();
  for (const doc of input.documents || []) {
    if (seen.has(doc.type)) throw new Error(`documents: duplicate ${doc.type}.`);
    seen.add(doc.type);
    validateField('date', doc.date || '', `documents.${doc.type}.date`);
    const existing = next.documents.find(d => d.type === doc.type);
    if (existing) Object.assign(existing, doc);
    else next.documents.push({type:doc.type,number:doc.number||'',date:doc.date||'',fileId:'',fileName:''});
  }
  for (const [key, rows] of Object.entries(input.tables || {})) {
    if (!rows) continue;
    next.tables[key] = Array.from({length:Math.max(rows.length,next.tables[key]?.length || 0)}, (_, i) => {
      const row = rows[i] || {};
      const imported = Object.fromEntries(Object.entries(row).filter(([,v]) => v !== undefined)) as Record<string,string>;
      for (const [field,text] of Object.entries(imported)) {
        let choices = tableChoices[field];
        if (field === 'Year') choices = ['2026-27','2025-26','2024-25','2023-24','2022-23'];
        if (field === 'UOM' && key === 'capacity') choices = ['KG','MT'];
        validateField(field, text, `tables.${key}[${i}].${field}`, choices);
      }
      const result: Record<string,string> = {...next.tables[key]?.[i], ...imported, __rowId:next.tables[key]?.[i]?.__rowId || crypto.randomUUID()};
      if (key === 'capacity') {
        const output=Number(result['Production output in one hour']), days=Number(result['Machine working days']), hours=Number(result['Working hours per day']);
        result['Total monthly capacity (kg)'] = output>0&&days>0&&hours>0 ? String(Math.round(output*days*hours*(result.UOM==='MT'?1000:1)*100)/100) : '';
      }
      if (result['Ground / bore well water usage'] === 'No') result['CGWA NOC requirement'] = 'Not Applicable';
      return result;
    });
  }
  for (const key of Object.keys(tables).filter(k => k !== 'msme')) {
    const rows = next.tables[key] || [];
    next.tables[key] = Array.from({length:Math.max(rows.length,next.plantCount)},(_,i) => rows[i] || {__rowId:crypto.randomUUID()});
  }
  if (next.sameAddress) fieldMap.address.slice(0,6).forEach((field,i) => {next.address[fieldMap.address[i+6]] = next.address[field] || '';});
  const validated = clientSchema.safeParse(next);
  if (!validated.success) throw new Error(validated.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n'));
  return validated.data;
}

export function onboardingJsonTemplate(current: ClientData) {
  return {
    basic:Object.fromEntries(fieldMap.basic.map(field => [field, current.basic[field] || ''])),
    address:Object.fromEntries(fieldMap.address.map(field => [field, current.address[field] || ''])),
    sameAddress:current.sameAddress,
    plantCount:Math.min(100,current.plantCount),
    documents:documentTypes.map(type => ({type,number:current.documents.find(d => d.type===type)?.number || '',date:current.documents.find(d => d.type===type)?.date || ''})),
    tables:Object.fromEntries(Object.entries(tables).map(([key,config]) => [key,(current.tables[key]?.length ? current.tables[key] : [{}]).map(row => Object.fromEntries(config.fields.filter(f => !['Document','Certificate'].includes(f)).map(field => [field,row[field] || ''])))])),
  };
}
