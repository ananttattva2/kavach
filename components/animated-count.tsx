'use client';
import { useEffect, useRef } from 'react';
import { useInView, useReducedMotion, animate } from 'motion/react';

export function AnimatedCount({value,loading=false}:{value:number;loading?:boolean}){
 const node=useRef<HTMLSpanElement>(null);const current=useRef(0);const visible=useInView(node,{once:true,amount:.3});const reduced=useReducedMotion();
 useEffect(()=>{
  if(loading||!visible)return;
  if(reduced){if(node.current)node.current.textContent=String(value);current.current=value;return;}
  const controls=animate(current.current,value,{duration:1.05,ease:[.22,1,.36,1],onUpdate:latest=>{current.current=latest;if(node.current)node.current.textContent=String(Math.round(latest));}});
  return()=>controls.stop();
 },[value,loading,visible,reduced]);
 return <span ref={node} className="animated-count" aria-label={loading?'Loading count':String(value)} data-count-target={value}>{loading?'—':reduced?value:0}</span>;
}
