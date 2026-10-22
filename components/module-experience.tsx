'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Leaf, LockKeyhole, LogOut, X } from 'lucide-react';
import { KavachBrand } from './kavach-brand';
import { wasteModules } from '@/lib/modules';
import { authClient } from '@/lib/auth-client';
import './module-experience.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function ModuleExperience({ name }: { name: string }) {
  const root = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const navigation = useRef<(index: number) => void>(() => {});
  const [active, setActive] = useState(0);
  const [help, setHelp] = useState(false);
  const helpRef = useRef<HTMLDialogElement>(null);
  const activeRef = useRef(0);

  useGSAP(() => {
    const element = root.current!;
    const scenes = gsap.utils.toArray<HTMLElement>('.waste-scene', element);
    let cancelled = false;
    const refresh = () => { if (!cancelled) ScrollTrigger.refresh(); };
    const images = Array.from(element.querySelectorAll('img'));
    const prepared = images.map(img => img.decode().catch(() => {}));
    Promise.all(prepared).then(refresh);
    document.fonts.ready.then(refresh);
    const mm = gsap.matchMedia();

    mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
      pin.current?.classList.add('is-pinned');
      const lenis = new Lenis({ autoRaf: false, smoothWheel: true, syncTouch: false, duration: 1.05, anchors: true });
      const tick = (time: number) => lenis.raf(time * 1000);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(tick);
      // Lenis uses GSAP's ticker exclusively; there is no second requestAnimationFrame loop.
      const hold = .62;
      const transition = .38;
      scenes.forEach((scene, i) => {
        gsap.set(scene, { autoAlpha: i === 0 ? 1 : 0, zIndex: i + 1 });
        gsap.set(scene.querySelector('.scene-image'), { scale: i === 0 ? 1.04 : 1.12, xPercent: i === 0 ? 0 : 2 });
        gsap.set(scene.querySelector('.scene-foreground'), { scale: 1, yPercent: i === 0 ? 0 : 10 });
        gsap.set(scene.querySelector('.scene-copy'), { autoAlpha: i === 0 ? 1 : 0, y: i === 0 ? 0 : 30 });
      });
      let current = 0;
      const timeline = gsap.timeline({
        scrollTrigger: {
          id: 'kavach-modules', trigger: element, pin: pin.current, start: 'top top',
          end: () => `+=${window.innerHeight * 5}`, scrub: 1, anticipatePin: 1,
          invalidateOnRefresh: true,
        },
        onUpdate() {
          const index = Math.min(4, Math.max(0, Math.floor(this.time() + .12)));
          if (index !== current) { current = index; activeRef.current = index; setActive(index); }
          scenes.forEach((scene, i) => {
            // Visibility and pointer access follow the same readable hold phase.
            scene.inert = i !== index;
            scene.setAttribute('aria-hidden', String(i !== index));
          });
        },
      });
      scenes.forEach((scene, i) => {
        const image = scene.querySelector('.scene-image');
        const foreground = scene.querySelector('.scene-foreground');
        const copy = scene.querySelector('.scene-copy');
        timeline.addLabel(`module-${i}`, i);
        timeline.to(image, { scale: 1.16, xPercent: -1.5, ease: 'none', duration: hold }, i);
        timeline.to(foreground, { scale: 1.15, yPercent: 3, ease: 'none', duration: hold }, i);
        if (i < scenes.length - 1) {
          const next = scenes[i + 1];
          const at = i + hold;
          // Incoming architecture is present before the outgoing scene dissolves.
          timeline.to(next, { autoAlpha: 1, duration: transition, ease: 'none' }, at);
          timeline.to(image, { scale: 1.5, xPercent: -5, duration: transition, ease: 'power1.in' }, at);
          timeline.to(foreground, { scale: 1.8, yPercent: 28, opacity: 0, duration: transition, ease: 'power1.in' }, at);
          timeline.to(copy, { autoAlpha: 0, y: -28, duration: .16, ease: 'none' }, at);
          timeline.to(next.querySelector('.scene-image'), { scale: 1.04, xPercent: 0, duration: transition, ease: 'none' }, at);
          timeline.to(next.querySelector('.scene-foreground'), { yPercent: 0, duration: transition, ease: 'none' }, at);
          timeline.to(next.querySelector('.scene-copy'), { autoAlpha: 1, y: 0, duration: .2, ease: 'none' }, at + .18);
          timeline.to(pin.current, { backgroundColor: wasteModules[i + 1].color, duration: transition, ease: 'none' }, at);
        } else {
          timeline.to(image, { scale: 1.19, duration: transition, ease: 'none' }, i + hold);
        }
      });
      const st = timeline.scrollTrigger!;
      navigation.current = index => lenis.scrollTo(st.start + (index / 5) * (st.end - st.start), { duration: 1.2 });
      const focusScene = (event: FocusEvent) => {
        const scene = (event.target as HTMLElement).closest<HTMLElement>('.waste-scene');
        if (scene) { const index = scenes.indexOf(scene); if (index !== activeRef.current) navigation.current(index); }
      };
      element.addEventListener('focusin', focusScene);
      return () => {
        pin.current?.classList.remove('is-pinned');
        element.removeEventListener('focusin', focusScene);
        gsap.ticker.remove(tick);
        lenis.off('scroll', ScrollTrigger.update);
        lenis.destroy();
        timeline.scrollTrigger?.kill();
        timeline.kill();
        scenes.forEach(scene => { scene.inert = false; scene.removeAttribute('aria-hidden'); });
      };
    });

    mm.add('(max-width: 900px), (prefers-reduced-motion: reduce)', () => {
      scenes.forEach(scene => { scene.inert = false; scene.removeAttribute('aria-hidden'); });
      navigation.current = index => scenes[index].scrollIntoView({ behavior: 'instant', block: 'start' });
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) { const index = scenes.indexOf(entry.target as HTMLElement); activeRef.current = index; setActive(index); }
        });
      }, { threshold: .55 });
      scenes.forEach(scene => observer.observe(scene));
      return () => observer.disconnect();
    });
    return () => { cancelled = true; mm.revert(); navigation.current = () => {}; };
  }, { scope: root });

  function showHelp() { setHelp(true); helpRef.current?.showModal(); }

  return <main className="module-experience" ref={root}>
    <a className="cinema-skip" href="#module-end">Skip module introduction</a>
    <div ref={pin} className="cinema-viewport">
      <header className="cinema-header"><KavachBrand/><div className="cinema-header-right"><span className="cinema-welcome">Welcome, {name}</span><button onClick={showHelp} className="cinema-help">Need help?</button><button aria-label="Sign out" className="cinema-signout" onClick={async () => { await authClient.signOut(); window.location.assign('/login'); }}><LogOut size={17}/></button></div></header>
      <div className="cinema-scenes">
        {wasteModules.map((module, i) => <section className="waste-scene" id={`module-${module.id}`} data-module={module.id} aria-labelledby={`title-${module.id}`} key={module.id}>
          <div className="scene-image"><img src={module.image} alt="" width={1920} height={1080} fetchPriority={i === 0 ? 'high' : 'low'} loading="eager" decoding="async"/></div>
          <div className="scene-shade"/>
          <div className="scene-light"/>
          <div className="scene-foreground"><img src="/images/foreground.webp" alt="" width={1536} height={1024} decoding="async"/></div>
          <div className="scene-copy">
            <div className="scene-eyebrow"><span/>{module.detail}</div>
            <div className="scene-module-name">{module.number} <span>/</span> {module.name}</div>
            <h1 id={`title-${module.id}`}>{module.headline[0]}<br/><em>{module.headline[1]}</em></h1>
            <p>{module.description}</p>
            {module.available ? <Link className="scene-cta" href={module.href}>Access Dashboard<ArrowUpRight size={19}/></Link> : <button type="button" className="scene-cta upcoming" disabled aria-label={`${module.name} — upcoming, unavailable`}><LockKeyhole size={14}/>Upcoming</button>}
            <span className="scene-footnote">{module.available ? <><Check size={12}/> Your compliance workspace is ready.</> : 'A new chapter in circularity. Coming soon.'}</span>
          </div>
          <div className="scene-material"><span className="material-line"/>{module.material}</div>
        </section>)}
      </div>
      <div className="cinema-topline"><span>A CLEARER PATH. A LIGHTER FOOTPRINT.</span><span><Leaf size={12}/> RESPONSIBILITY, REIMAGINED</span></div>
      <div className="cinema-bottom"><div className="scroll-instruction"><span className="scroll-mouse"/><span>SCROLL TO EXPLORE<ArrowDown size={11}/></span></div><div className="cinema-pagination"><span>{wasteModules[active].number}</span><div className="cinema-progress"><i style={{ transform: `scaleX(${(active + 1) / 5})` }}/></div><span className="page-total">05</span></div></div>
      <nav className="module-navigation" aria-label="Waste modules">{wasteModules.map((module, index) => <button key={module.id} onClick={() => navigation.current(index)} aria-current={active === index ? 'step' : undefined}><span className="module-nav-dot"/><span className="module-nav-number">{module.number}</span><span>{module.name}</span>{!module.available && <LockKeyhole size={9}/>}</button>)}</nav>
    </div>
    <section id="module-end" className="cinema-outro"><Leaf size={27}/><span className="scene-eyebrow">ONE WORKSPACE. A MORE CIRCULAR WORLD.</span><h2>Progress starts with<br/><em>one responsible step.</em></h2><p>Continue to your clients, documents and compliance workspace.</p><Link className="scene-cta" href="/dashboard">Open client workspace<ArrowRight size={18}/></Link><footer><KavachBrand/><span>Protecting resources. Enabling responsibility.</span><span>© {new Date().getFullYear()} Anant Tattva</span></footer></section>
    <dialog ref={helpRef} className="cinema-dialog" onClose={() => setHelp(false)} onClick={event => { if (event.target === event.currentTarget) helpRef.current?.close(); }} aria-label="KAVACH support"><button className="dialog-close" aria-label="Close help" onClick={() => helpRef.current?.close()}><X size={20}/></button>{help && <><Leaf size={28}/><h2>A little guidance?</h2><p>Choose an available module to open your client workspace. Plastic Waste and E-Waste are available; additional modules are coming soon.</p><a className="scene-cta" href="mailto:crm@ananttattva.com">Contact our team<ArrowUpRight size={16}/></a></>}</dialog>
  </main>;
}
