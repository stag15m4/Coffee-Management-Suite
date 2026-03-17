import { generatePageMetadata } from '@/lib/metadata';
import Section from '@/components/shared/Section';
import Badge from '@/components/shared/Badge';
import ScrollReveal from '@/components/shared/ScrollReveal';
import Container from '@/components/shared/Container';

export const metadata = generatePageMetadata({
  title: 'Changelog',
  description: "See what's new in Coffee Management Suite.",
  path: '/changelog',
});

/* TODO: Integrate with Sanity CMS for dynamic changelog entries */
const entries = [
  {
    date: 'March 2026',
    badge: 'New Feature' as const,
    badgeVariant: 'new' as const,
    title: 'Recipe Cost Manager: Batch Ingredient Pricing',
    description: 'Update prices for multiple ingredients at once. Import from CSV or manually adjust in bulk.',
  },
  {
    date: 'February 2026',
    badge: 'Improvement' as const,
    badgeVariant: 'default' as const,
    title: 'Tip Payout Calculator: Export Improvements',
    description: 'New PDF export format with detailed breakdowns. Compatible with all major payroll systems.',
  },
  {
    date: 'January 2026',
    badge: 'New Feature' as const,
    badgeVariant: 'new' as const,
    title: 'Equipment Maintenance Module Launch',
    description:
      'Track every piece of equipment, schedule preventive maintenance, and never miss a service date again.',
  },
];

export default function ChangelogPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-espresso-900 py-24">
        <Container>
          <div className="text-center">
            <h1 className="text-h1 text-cream-50 font-clash">What&apos;s New</h1>
            <p className="text-body-lg text-cream-400 max-w-2xl mx-auto mt-6">
              Product updates, improvements, and fixes.
            </p>
          </div>
        </Container>
      </section>

      {/* Changelog Entries */}
      <Section bg="light" padding="md">
        <div className="relative max-w-3xl mx-auto">
          {/* Vertical timeline line */}
          <div className="absolute left-[7px] md:left-[9px] top-2 bottom-2 w-0.5 bg-cream-300" />

          <div className="space-y-12">
            {entries.map((entry, index) => (
              <ScrollReveal key={entry.title} delay={index * 0.1}>
                <div className="relative pl-10 md:pl-12">
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1.5 w-4 h-4 md:w-5 md:h-5 rounded-full bg-caramel-400 ring-4 ring-cream-50 z-10" />

                  {/* Date */}
                  <p className="text-body-sm font-semibold text-espresso-500 mb-2">{entry.date}</p>

                  {/* Card */}
                  <div className="bg-white border border-cream-300 rounded-xl p-6 shadow-sm">
                    <Badge variant={entry.badgeVariant}>{entry.badge}</Badge>
                    <h2 className="text-h4 font-clash text-espresso-900 mt-3">{entry.title}</h2>
                    <p className="text-body text-espresso-600 mt-2">{entry.description}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
