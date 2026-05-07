import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://noticereply.com';
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard', '/notices', '/contacts', '/settings', '/workflows', '/campaigns'] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
