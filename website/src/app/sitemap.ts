import { MetadataRoute } from 'next';

const SITE_URL = 'https://coffeemanagementsuite.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: `${SITE_URL}/features`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${SITE_URL}/pricing`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${SITE_URL}/customers`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.7 },
    { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${SITE_URL}/demo`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${SITE_URL}/security`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${SITE_URL}/changelog`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.3 },
  ];

  // TODO: Add dynamic blog post URLs from Sanity CMS
  // const posts = await fetchBlogSlugs();
  // const blogPages = posts.map(slug => ({
  //   url: `${SITE_URL}/blog/${slug}`,
  //   lastModified: new Date(),
  //   changeFrequency: 'monthly' as const,
  //   priority: 0.6,
  // }));

  return [...staticPages];
}
