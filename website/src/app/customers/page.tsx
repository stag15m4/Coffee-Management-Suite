import Image from 'next/image';
import { generatePageMetadata } from '@/lib/metadata';
import { TESTIMONIALS } from '@/lib/constants';
import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';
import Card from '@/components/shared/Card';
import ScrollReveal from '@/components/shared/ScrollReveal';
import Badge from '@/components/shared/Badge';
import Container from '@/components/shared/Container';
import { FinalCTA } from '@/components/home/FinalCTA';

export const metadata = generatePageMetadata({
  title: 'Customers',
  description: 'See how coffee shops like yours are using Coffee Management Suite to streamline operations.',
  path: '/customers',
});

const caseStudies = [
  {
    /* TODO: Replace with real case study data */
    shop: 'Groundwork Coffee',
    location: 'Portland, OR',
    size: '3 locations, 24 employees',
    challenge: 'Tracking costs across locations',
    modules: ['Recipe Cost Manager', 'Equipment Maintenance'],
    results: [
      'Cut food waste by 12% in first month',
      'Unified cost tracking across all three locations',
      'Saved 6 hours per week on spreadsheet reconciliation',
    ],
    pullQuote: 'We finally know exactly what every drink costs us. No guessing, no spreadsheets.',
  },
  {
    /* TODO: Replace with real case study data */
    shop: 'Daily Grind Cafe',
    location: 'Austin, TX',
    size: 'Single location, 12 employees',
    challenge: 'Tip distribution disputes',
    modules: ['Tip Payout Calculator', 'Cash Deposit Record'],
    results: [
      'Zero tip disputes since switching',
      'Reduced end-of-day cash reconciliation from 30 min to 5 min',
      'Full audit trail for every shift',
    ],
    pullQuote: 'My team trusts the numbers now. That alone was worth switching.',
  },
];

export default function CustomersPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-espresso-900 py-16 sm:py-24">
        <Container>
          <div className="text-center">
            <h1 className="text-h1 text-cream-50 font-clash">Real Shops. Real Results.</h1>
            <p className="text-body-lg text-cream-400 max-w-2xl mx-auto mt-6">
              See how coffee shops like yours are using CMS.
            </p>
          </div>
        </Container>
      </section>

      {/* Testimonials Grid */}
      <Section bg="light" padding="md">
        <SectionHeading title="What Our Customers Say" align="center" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((testimonial, index) => (
            <ScrollReveal key={testimonial.name} delay={index * 0.1}>
              <Card variant="light" padding="lg" hover>
                <span className="block text-[80px] leading-none text-caramel-400/10 font-clash -mb-6">&ldquo;</span>
                <p className="text-body text-espresso-700 mb-6">{testimonial.quote}</p>
                <div className="border-t border-cream-200 pt-4 flex items-center gap-3">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.name}
                    width={48}
                    height={48}
                    className="rounded-full object-cover w-12 h-12"
                  />
                  <div>
                    <p className="font-semibold text-espresso-900">{testimonial.name}</p>
                    <p className="text-body-sm text-espresso-600">
                      {testimonial.title}, {testimonial.shop}
                    </p>
                    <p className="text-body-sm text-espresso-500">{testimonial.location}</p>
                  </div>
                </div>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </Section>

      {/* Case Studies */}
      <section className="bg-espresso-900 py-24">
        <Container>
          <SectionHeading title="Featured Stories" theme="dark" align="center" />
          <div className="space-y-12">
            {caseStudies.map((study, index) => (
              <ScrollReveal key={study.shop} delay={index * 0.15}>
                <div className="bg-espresso-800 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-5 sm:p-8 lg:p-10">
                    {/* Left: Shop details */}
                    <div>
                      <h3 className="text-h3 font-clash text-cream-50">{study.shop}</h3>
                      <p className="text-body-sm text-cream-400 mt-1">
                        {study.location} &middot; {study.size}
                      </p>

                      <div className="mt-6">
                        <p className="text-overline text-caramel-400 mb-2">Challenge</p>
                        <p className="text-body text-cream-300">{study.challenge}</p>
                      </div>

                      <div className="mt-6">
                        <p className="text-overline text-caramel-400 mb-2">Modules Used</p>
                        <div className="flex flex-wrap gap-2">
                          {study.modules.map((mod) => (
                            <Badge key={mod}>{mod}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Results */}
                    <div>
                      <p className="text-overline text-caramel-400 mb-3">Results</p>
                      <ul className="space-y-3">
                        {study.results.map((result) => (
                          <li key={result} className="flex items-start gap-3 text-body text-cream-300">
                            <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-sage-400" />
                            {result}
                          </li>
                        ))}
                      </ul>

                      <blockquote className="mt-8 border-l-2 border-caramel-400 pl-4">
                        <p className="text-body-lg text-cream-200 italic">&ldquo;{study.pullQuote}&rdquo;</p>
                      </blockquote>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      <FinalCTA />
    </>
  );
}
