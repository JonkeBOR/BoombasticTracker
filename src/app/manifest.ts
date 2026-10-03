import type { MetadataRoute } from 'next';
import { appStrings } from '@/lib/strings/app';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appStrings.name,
    short_name: appStrings.shortName,
    description: appStrings.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fbe4d8',
    theme_color: '#fbe4d8',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
