'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Bell, CheckCheck, ChevronRight, ClipboardCheck, FileText, Leaf, LoaderCircle, Users, X } from 'lucide-react';
import type { NotificationData, WorkspaceNotification } from '@/lib/notifications';
import './notifications.css';

type Props={onOpen:(notification:WorkspaceNotification)=>void;onViewAll:()=>void};
async function getNotifications():Promise<NotificationData>{const res=await fetch('/api/notifications');const data=await res.json();if(res.status===403&&data.code==='LICENSE_REQUIRED')window.location.replace('/license');if(!res.ok)throw new Error(data.error||'Unable to load notifications');return data;}
function useNotifications(){
 const cache=useQueryClient();const query=useQuery({queryKey:['notifications'],queryFn:getNotifications,refetchInterval:60000});
 const mutation=useMutation({mutationFn:async(ids:string[])=>{const res=await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});if(!res.ok)throw new Error('Could not mark notifications as read');},onMutate:async ids=>{await cache.cancelQueries({queryKey:['notifications']});const previous=cache.getQueryData<NotificationData>(['notifications']);if(previous){const items=previous.items.map(item=>ids.includes(item.id)?{...item,read:true}:item);cache.setQueryData(['notifications'],{items,unreadCount:items.filter(item=>!item.read).length});}return{previous};},onError:(_error,_ids,context)=>{if(context?.previous)cache.setQueryData(['notifications'],context.previous);},onSettled:()=>cache.invalidateQueries({queryKey:['notifications']})});
 return{query,mutation};
}
const icons={client:Users,document:FileText,reminder:ClipboardCheck,welcome:Leaf};
function dayKey(value:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);}
function group(value:string){const today=new Date();const yesterday=new Date(today.getTime()-86400000);const key=dayKey(new Date(value));return key===dayKey(today)?'TODAY':key===dayKey(yesterday)?'YESTERDAY':'EARLIER';}
function relative(value:string){const seconds=Math.max(0,(Date.now()-new Date(value).getTime())/1000);if(seconds<60)return'Just now';if(seconds<3600)return Math.floor(seconds/60)+' min ago';if(seconds<86400)return Math.floor(seconds/3600)+' hr ago';if(seconds<172800)return'Yesterday';return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'}).format(new Date(value));}

export function NotificationsPanel({onOpen,onViewAll,fullPage=false,onClose}:Props & {fullPage?:boolean;onClose?:()=>void}){
 const{query,mutation}=useNotifications();const[tab,setTab]=useState<'all'|'unread'>('all');const all=query.data?.items||[];const unread=query.data?.unreadCount||0;const items=tab==='unread'?all.filter(item=>!item.read):all;let lastGroup='';
 function open(item:WorkspaceNotification){if(!item.read)mutation.mutate([item.id]);onOpen(item);}
 return <div className={'notifications-panel '+(fullPage?'full-notifications':'')}>
  <div className="notifications-heading"><h2>Notifications<span>{unread}</span></h2><button className="mark-all-read" disabled={!unread||mutation.isPending} onClick={()=>mutation.mutate(all.filter(item=>!item.read).map(item=>item.id))}>Mark all as read</button>{onClose&&<button className="notifications-close" aria-label="Close notifications" onClick={onClose}><X size={16}/></button>}</div>
  <div className="notification-tabs" role="tablist" aria-label="Filter notifications"><button role="tab" aria-selected={tab==='all'} id={fullPage?'all-notifications-page':'all-notifications-menu'} onClick={()=>setTab('all')}>All<span>{all.length}</span></button><button role="tab" aria-selected={tab==='unread'} id={fullPage?'unread-notifications-page':'unread-notifications-menu'} onClick={()=>setTab('unread')}>Unread<span>{unread}</span></button></div>
  <div className="notification-list" data-lenis-prevent role="tabpanel" aria-label={tab==='all'?'All notifications':'Unread notifications'}>
   {query.isPending?<div className="notification-empty"><LoaderCircle size={21} className="spin"/>Loading your updates…</div>:query.error?<div className="notification-empty"><p>{query.error.message}</p><button onClick={()=>query.refetch()}>Try again</button></div>:items.length?items.map(item=>{const section=group(item.createdAt);const show=section!==lastGroup;lastGroup=section;const Icon=icons[item.type];return <div key={item.id}>{show&&<div className="notification-day">{section}</div>}<button className={'notification-row '+(!item.read?'is-unread':'')} onClick={()=>open(item)}><span className="notification-unread-dot"/><span className={'notification-icon notification-'+item.type}><Icon size={18} strokeWidth={1.6}/></span><span className="notification-copy"><strong>{item.title}</strong><span>{item.description}</span></span><time dateTime={item.createdAt}>{relative(item.createdAt)}</time></button></div>;}):<div className="notification-empty"><CheckCheck size={27}/><h3>{tab==='unread'?'You’re all caught up':'No updates yet'}</h3><p>{tab==='unread'?'New workspace updates will appear here.':'Add a client to start your compliance journey.'}</p></div>}
  </div>
  {mutation.error&&<p role="alert" className="notification-action-error">{mutation.error.message}</p>}
  {!fullPage&&<button className="notifications-footer" onClick={onViewAll}>View all notifications<ChevronRight size={16}/></button>}
 </div>;
}

export function NotificationMenu({onOpen,onViewAll}:Props){
 const[open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);const button=useRef<HTMLButtonElement>(null);const panel=useRef<HTMLDivElement>(null);const reduced=useReducedMotion();const{query}=useNotifications();const unread=query.data?.unreadCount||0;
 function close(restore=false){setOpen(false);if(restore)button.current?.focus();}
 useEffect(()=>{if(!open)return;panel.current?.focus();const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);button.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[open]);
 return <div className="notification-menu" ref={root} onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}}><button ref={button} className="notification-trigger" aria-label="Workspace notifications" aria-haspopup="dialog" aria-expanded={open} aria-controls={open?'workspace-notifications':undefined} onClick={()=>setOpen(!open)}><Bell size={19}/>{unread>0&&<span className="notification-badge">{unread>99?'99+':unread}</span>}</button><AnimatePresence>{open&&<motion.div ref={panel} id="workspace-notifications" className="notification-popover" role="dialog" aria-label="Notifications" aria-modal="false" tabIndex={-1} initial={{opacity:0,y:reduced?0:-8,scale:reduced?1:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:reduced?0:-5,scale:reduced?1:.98}} transition={{duration:reduced?0:.18}}><NotificationsPanel onClose={()=>close(true)} onOpen={item=>{close();onOpen(item);}} onViewAll={()=>{close();onViewAll();}}/></motion.div>}</AnimatePresence></div>;
}
