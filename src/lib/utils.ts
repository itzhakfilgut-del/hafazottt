import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFallbackAvatar(name: string = '') {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const colors = ['#0284c7', '#ea580c', '#16a34a', '#9333ea', '#db2777', '#475569', '#059669', '#ca8a04', '#4f46e5', '#e11d48'];
  const charCode = name ? name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  const bgColor = colors[charCode % colors.length];
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bgColor}" /><text x="50" y="50" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${initial}</text></svg>`;
  
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
