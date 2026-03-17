'use client';

import { useState } from 'react';
import Image from 'next/image';
import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import ScrollReveal from '@/components/shared/ScrollReveal';
import Container from '@/components/shared/Container';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

/* TODO: Fetch from Sanity CMS instead of static data */
const posts = [
  {
    slug: '5-ways-to-cut-food-costs',
    category: 'Operations',
    title: '5 Ways to Cut Food Costs Without Cutting Corners',
    excerpt:
      'Learn how smart recipe costing can save your shop hundreds per month without sacrificing quality or portion sizes.',
    author: 'CMS Team',
    date: 'March 10, 2026',
    color: 'bg-caramel-200',
    image: '/images/blog/blog-1.jpg',
  },
  {
    slug: 'complete-guide-tip-distribution',
    category: 'Tips & Tricks',
    title: 'The Complete Guide to Fair Tip Distribution',
    excerpt:
      'Tip pooling, percentage splits, and role-based distribution explained. Everything you need to keep your team happy.',
    author: 'CMS Team',
    date: 'February 24, 2026',
    color: 'bg-sage-400/20',
    image: '/images/blog/blog-2.jpg',
  },
  {
    slug: 'scaling-one-to-five-locations',
    category: 'Growth',
    title: 'Scaling from One Location to Five: Lessons Learned',
    excerpt:
      'What nobody tells you about going multi-location. From operational blind spots to the tools that actually help.',
    author: 'CMS Team',
    date: 'February 10, 2026',
    color: 'bg-copper-400/20',
    image: '/images/blog/blog-3.jpg',
  },
];

export default function BlogPage() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    try {
      await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubscribed(true);
      setEmail('');
    } catch {
      // Silently fail for now
    }
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-espresso-900 py-16 sm:py-24">
        <Container>
          <div className="text-center">
            <h1 className="text-h1 text-cream-50 font-clash">The CMS Blog</h1>
            <p className="text-body-lg text-cream-400 max-w-2xl mx-auto mt-6">
              Tips, guides, and insights for running a better coffee shop.
            </p>
          </div>
        </Container>
      </section>

      {/* Blog Grid */}
      <Section bg="light" padding="md">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post, index) => (
            <ScrollReveal key={post.slug} delay={index * 0.1}>
              <a
                href={`/blog/${post.slug}`}
                className="group block bg-white border border-cream-300 rounded-xl overflow-hidden hover:-translate-y-1 hover:shadow-xl hover:border-caramel-300 transition-all duration-300"
              >
                <div className="relative h-48">
                  <Image src={post.image} alt={post.title} fill className="object-cover" />
                </div>

                <div className="p-6">
                  <Badge>{post.category}</Badge>
                  <h2 className="text-h4 font-clash text-espresso-900 mt-3 group-hover:text-caramel-500 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-body-sm text-espresso-600 mt-2 line-clamp-2">{post.excerpt}</p>
                  <div className="flex items-center gap-2 mt-4 text-body-sm text-espresso-500">
                    <span>{post.author}</span>
                    <span>&middot;</span>
                    <span>{post.date}</span>
                  </div>
                </div>
              </a>
            </ScrollReveal>
          ))}
        </div>

        {/* Newsletter signup */}
        <div className="mt-20 text-center max-w-md mx-auto">
          <SectionHeading
            title="Stay in the Loop"
            subtitle="More content coming soon. Subscribe to get notified."
            align="center"
          />
          {subscribed ? (
            <p className="text-sage-500 font-semibold">You&apos;re subscribed! We&apos;ll be in touch.</p>
          ) : (
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 mt-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 bg-white border border-cream-300 rounded-full px-5 py-3 text-body font-general text-espresso-900 placeholder:text-espresso-400 focus:border-caramel-400 focus:ring-1 focus:ring-caramel-400/20 focus:outline-none transition-colors"
              />
              <Button type="submit" variant="primary" icon={<ArrowRight className="w-4 h-4" />}>
                Subscribe
              </Button>
            </form>
          )}
        </div>
      </Section>
    </>
  );
}
