import Container from '@/components/shared/Container';
import Badge from '@/components/shared/Badge';

export function PricingHero() {
  return (
    <section className="bg-cream-50 py-24">
      <Container>
        <div className="text-center">
          <Badge>Pricing</Badge>
          <h1 className="text-h1 font-clash text-espresso-900 mt-6">Simple Pricing That Scales With You</h1>
          <p className="text-body-lg text-espresso-600 max-w-2xl mx-auto mt-4">
            Start free. Add modules as you grow. No contracts. Cancel anytime.
          </p>
        </div>
      </Container>
    </section>
  );
}
