import Image from 'next/image';
import Container from '@/components/shared/Container';
import Badge from '@/components/shared/Badge';

export function FeatureHero() {
  return (
    <section className="relative bg-espresso-900 py-24 md:py-32 overflow-hidden">
      {/* Espresso machine background texture */}
      <Image
        src="/images/features/espresso-machine.jpg"
        alt=""
        fill
        className="object-cover opacity-[0.06]"
        aria-hidden="true"
      />
      <Container className="relative z-10">
        <div className="text-center">
          <Badge>Platform Overview</Badge>
          <h1 className="text-h1 text-cream-50 mt-6">Six Powerful Modules. One Simple Platform.</h1>
          <p className="text-body-lg text-cream-400 max-w-2xl mx-auto mt-4">
            Every module is designed to solve a specific pain point in running a coffee shop. Pick what you need, or get
            them all.
          </p>
        </div>
      </Container>
    </section>
  );
}
