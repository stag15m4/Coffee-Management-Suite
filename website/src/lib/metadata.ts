import { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from './constants';

type MetadataArgs = {
  title?: string;
  description?: string;
  path?: string;
  ogImage?: string;
};

export function generatePageMetadata({
  title,
  description,
  path = '',
  ogImage = '/images/og/og-default.png',
}: MetadataArgs): Metadata {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | The All-in-One Platform for Coffee Shops`;
  const url = `${SITE_URL}${path}`;

  return {
    title: fullTitle,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630, alt: fullTitle }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
    },
  };
}
