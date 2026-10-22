'use client';

import { useState } from 'react';
import { ArrowUpRight, BatteryCharging, CarFront, Check, Droplets, Laptop, Recycle } from 'lucide-react';
import { wasteModules } from '@/lib/modules';

const icons = [Recycle, Laptop, BatteryCharging, CarFront, Droplets];

export function LoginModuleGallery() {
  const [selected, setSelected] = useState<string | null>(null);
  return <aside className="login-gallery" aria-label="Explore KAVACH waste modules">
    <div className="gallery-intro"><span><span className="gallery-live-dot"/>BUILT FOR A CIRCULAR WORLD</span><span>05 WASTE STREAMS</span></div>
    <div className="module-mosaic">
      {wasteModules.map((module, index) => {
        const Icon = icons[index];
        return <button type="button" key={module.id} className={`mosaic-tile mosaic-${module.id}${selected === module.id ? ' is-selected' : ''}`} aria-pressed={selected === module.id} aria-label={`Preview ${module.name}${module.available ? ', available' : ', upcoming'}`} onClick={() => setSelected(current => current === module.id ? null : module.id)}>
          <img className="mosaic-image" src={module.image} alt="" width={1672} height={941} fetchPriority={index === 0 ? 'high' : 'low'} decoding="async"/>
          <span className="mosaic-shade"/>
          <span className="mosaic-top"><span className="mosaic-icon"><Icon size={20} strokeWidth={1.4}/></span><span className="mosaic-number">{module.number} / 05</span></span>
          <span className="mosaic-content"><span className="mosaic-status">{module.available ? <><span/>AVAILABLE NOW</> : <>COMING SOON</>}</span><span className="mosaic-title" role="heading" aria-level={2}>{module.name}</span><span className="mosaic-description">{module.description}</span><span className="mosaic-bottom"><span>{module.available ? 'Sign in to access dashboard' : 'Upcoming module'}</span>{module.available ? <ArrowUpRight size={18}/> : <span className="mosaic-soon-dot"/>}</span></span>
          <span className="mosaic-preview-tag"><Check size={11}/>PREVIEW</span>
        </button>;
      })}
    </div>
    <div className="gallery-caption"><span>Waste is a beginning.<br/><strong>Let’s give it a better future.</strong></span><span className="gallery-caption-note">HOVER TO EXPLORE<span>On a touch screen? Tap a module.</span></span></div>
  </aside>;
}
