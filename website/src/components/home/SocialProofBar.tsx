import AnimatedCounter from '@/components/shared/AnimatedCounter';
import ScrollReveal from '@/components/shared/ScrollReveal';
import Container from '@/components/shared/Container';

const stats = [
  { target: 500, suffix: '+', label: 'Recipes tracked' },
  { target: 50000, suffix: '+', label: 'Tips calculated' },
  { target: 200, suffix: '+', label: 'Locations managed' },
];

export function SocialProofBar() {
  return (
    <section className="bg-cream-50 py-12">
      <Container>
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-0">
            {stats.map((stat, index) => (
              <div key={stat.label} className="flex items-center gap-8 sm:gap-0">
                {index > 0 && <div className="hidden sm:block h-8 w-px bg-cream-300 mx-8 md:mx-12" />}
                <div className="text-center">
                  <AnimatedCounter
                    target={stat.target}
                    suffix={stat.suffix}
                    className="font-clash text-2xl md:text-3xl font-semibold text-espresso-900"
                  />
                  <p className="text-body-sm text-espresso-600 mt-1">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </Container>
    </section>
  );
}
