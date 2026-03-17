import Section from '@/components/shared/Section';
import Button from '@/components/shared/Button';

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // TODO: Fetch from Sanity CMS using slug
  void slug;

  return (
    <Section bg="light" padding="lg">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-h1 font-clash text-espresso-900">Coming Soon</h1>
        <p className="text-body-lg text-espresso-600 mt-4">This blog post is on its way. Check back soon.</p>
        <Button href="/blog" variant="primary" className="mt-8">
          Back to Blog
        </Button>
      </div>
    </Section>
  );
}
