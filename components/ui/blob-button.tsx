import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './blob-button.css';

export function BlobButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return <button className={`blob-button ${className}`} {...props}>
    <span className="blob-button-label">{children}</span>
    <span className="blob-button-inner" aria-hidden="true"><span className="blob-button-blobs"><span/><span/><span/><span/></span></span>
  </button>;
}

export function BlobButtonEffects() {
  return <svg className="blob-button-effects" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs><filter id="kavach-blob-goo" x="-30%" y="-50%" width="160%" height="200%" colorInterpolationFilters="sRGB"><feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10"/><feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 21 -7" result="goo"/><feBlend in="SourceGraphic" in2="goo"/></filter></defs></svg>;
}
