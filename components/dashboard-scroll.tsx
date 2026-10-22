'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

export function DashboardScroll({routeKey}:{routeKey:string}){
 const controller=useRef<Lenis|null>(null);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');let cleanup=()=>{};
  function setup(){cleanup();if(media.matches)return;const lenis=new Lenis({autoRaf:false,smoothWheel:true,syncTouch:false,duration:.8,anchors:true,prevent:node=>Boolean(node.closest('.sidebar-scroll, .notification-list, .portal-dialog, .portal-table-wrap, [data-lenis-prevent]'))});controller.current=lenis;const tick=(seconds:number)=>lenis.raf(seconds*1000);gsap.ticker.add(tick);cleanup=()=>{gsap.ticker.remove(tick);lenis.destroy();controller.current=null;};}
  setup();media.addEventListener('change',setup);return()=>{media.removeEventListener('change',setup);cleanup();};
 },[]);
 useEffect(()=>{if(controller.current)controller.current.scrollTo(0,{immediate:true});else window.scrollTo({top:0,behavior:'instant'});},[routeKey]);
 return null;
}
