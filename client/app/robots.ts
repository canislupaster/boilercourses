import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: "/api/*"
    },
    sitemap: new URL("/sitemap.xml", process.env.NEXT_PUBLIC_ROOT_URL).href,
  }
}