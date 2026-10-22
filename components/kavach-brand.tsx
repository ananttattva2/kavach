import { ShieldCheck, Leaf } from 'lucide-react';
import Link from 'next/link';
export function KavachBrand({ href = '/modules' }: { href?: string }) {
  return <Link href={href} className="kavach-wordmark" aria-label="KAVACH home"><span className="kavach-shield"><ShieldCheck size={32} strokeWidth={1.3}/><Leaf size={13} className="shield-leaf"/></span><span>KAVACH</span></Link>;
}
