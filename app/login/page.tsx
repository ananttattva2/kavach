'use client';

import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowRight, ArrowLeft, ShieldCheck, Mail, LoaderCircle, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authClient } from '@/lib/auth-client';
import { KavachBrand } from '@/components/kavach-brand';
import { LoginModuleGallery } from '@/components/login-module-gallery';
import './login.css';

const schema = z.object({ email: z.email('Please enter a valid email address') });
gsap.registerPlugin(useGSAP);

export default function Login() {
  const root = useRef<HTMLElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const { register, handleSubmit, setFocus, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.train-login-card', { opacity: 0, y: 16, duration: .8, ease: 'power2.out' });
      gsap.from('.mosaic-tile', { opacity: 0, y: 14, duration: .7, stagger: .07, ease: 'power2.out' });
    });
    return () => mm.revert();
  }, { scope: root });

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function send(value: string) {
    setBusy(true); setError('');
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email: value, type: 'sign-in' });
      if (result.error) throw new Error(result.error.message || 'Could not send your code. Please try again.');
      setEmail(value); setStep(1); setCooldown(60);
    } catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await authClient.signIn.emailOtp({ email, otp });
      if (result.error) throw new Error(result.error.message || 'Please check the code and try again.');
      window.location.assign('/modules');
    } catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); setBusy(false); }
  }

  return <main className="white-login" ref={root}><div className="login-form-side">
    <header className="train-header"><KavachBrand href="/login"/><button className="train-help" onClick={() => help.current?.showModal()}>Need help?</button></header>
    <section className="train-login-card" aria-labelledby="login-title">
      <div className="train-eyebrow">LESS WASTE. MORE POSSIBILITY.</div>
      <h1 id="login-title">{step ? 'A secure start.' : 'Welcome back.'}</h1>
      <p className="train-description">{step ? <>Enter the code sent to <strong>{email}</strong></> : 'One workspace for a more responsible tomorrow.'}</p>
      {step ? <form onSubmit={verify} className="train-form">
        <label htmlFor="otp" className="train-field-label">Your 6-digit verification code</label>
        <input id="otp" className="train-otp" aria-label="Verification code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="000000" autoFocus required disabled={busy}/>
        <div className="train-code-help"><span>Expires in 5 minutes</span><button type="button" disabled={busy || cooldown > 0} onClick={() => send(email)}>{cooldown ? `Resend in ${cooldown}s` : 'Resend code'}</button></div>
        <button className="train-submit" disabled={busy || otp.length !== 6}>{busy ? <LoaderCircle size={19} className="spin"/> : <>Enter workspace<ArrowRight size={19}/></>}</button>
        <button type="button" className="train-back" disabled={busy} onClick={() => { setStep(0); setOtp(''); setError(''); }}><ArrowLeft size={14}/>Use a different email</button>
      </form> : <form onSubmit={handleSubmit(({ email }) => send(email))} className="train-form">
        <label className="train-field" htmlFor="email"><Mail size={20} strokeWidth={1.5}/><input id="email" type="email" aria-label="Email address" autoComplete="email" placeholder="Email address" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} {...register('email')} disabled={busy}/></label>
        {errors.email && <p id="email-error" className="train-error">{errors.email.message}</p>}
        <div className="train-security"><ShieldCheck size={20} strokeWidth={1.4}/><div><strong>Secure, password-free sign in</strong><span>We’ll send a one-time code to your email.</span></div></div>
        <button className="train-submit" disabled={busy}>{busy ? <><LoaderCircle size={18} className="spin"/>Sending your code…</> : <>Sign in<ArrowRight size={19}/></>}</button>
      </form>}
      {error && <p role="alert" className="train-error">{error}</p>}
      <div className="train-card-bottom">{step ? <><ShieldCheck size={14}/>Your code stays private. Never share it.</> : <>New to KAVACH? <button onClick={() => setFocus('email')}>Create an account</button></>}</div>
    </section>
    <footer className="train-footer"><ShieldCheck size={13}/>Protecting resources. Enabling responsibility.</footer></div><LoginModuleGallery/>
    <dialog ref={help} className="train-help-dialog" aria-labelledby="help-title" onClick={event => { if (event.target === event.currentTarget) help.current?.close(); }}><button aria-label="Close help" className="train-dialog-close" onClick={() => help.current?.close()}><X size={20}/></button><ShieldCheck size={28}/><h2 id="help-title">Your next chapter starts here.</h2><p>Enter your email to receive a secure sign-in code. New accounts are created when you verify your email. If you need help, contact our team.</p><a href="mailto:crm@ananttattva.com">crm@ananttattva.com<ArrowRight size={16}/></a></dialog>
  </main>;
}
