import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
export const metadata:Metadata={title:'Kavach — Client Workspace',description:'A thoughtful workspace for client onboarding and environmental compliance.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body><Providers>{children}</Providers></body></html>;}
