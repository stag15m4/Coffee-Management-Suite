import Button from '@/components/shared/Button';
import Container from '@/components/shared/Container';
import { Coffee } from 'lucide-react';

export default function NotFound() {
  return (
    <section className="bg-espresso-900 min-h-[60vh] flex items-center justify-center relative overflow-hidden">
      <Container>
        <div className="relative text-center py-24">
          {/* Large background 404 */}
          <span className="absolute inset-0 flex items-center justify-center font-clash text-[120px] md:text-[180px] font-bold text-caramel-400/20 select-none pointer-events-none">
            404
          </span>

          {/* Foreground content */}
          <div className="relative z-10">
            <Coffee className="w-16 h-16 text-caramel-400 mx-auto mb-6 rotate-12" />
            <h1 className="text-h2 font-clash text-cream-50">Looks like this page got over-extracted.</h1>
            <p className="text-body text-cream-400 mt-4 max-w-lg mx-auto">
              The page you&apos;re looking for doesn&apos;t exist, was moved, or was consumed by the morning rush.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="primary" href="/">
                Back to Homepage
              </Button>
              <Button variant="ghost" href="/blog">
                or check out our Blog
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
