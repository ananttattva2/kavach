import Link from 'next/link';
export function KavachBrand({ href = '/dashboard' }: { href?: string }) {
  return <Link href={href} className="kavach-wordmark" aria-label="KAVACH home"><img className="kavach-logo" src="/images/kavach-logo.webp" alt="KAVACH" width={180} height={80}/></Link>;
}
