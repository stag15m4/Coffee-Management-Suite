import { generatePageMetadata } from '@/lib/metadata';
import { CONTACT_EMAIL } from '@/lib/constants';
import Section from '@/components/shared/Section';
import Card from '@/components/shared/Card';
import Button from '@/components/shared/Button';
import Container from '@/components/shared/Container';
import { Check, Calendar } from 'lucide-react';

export const metadata = generatePageMetadata({
  title: 'Book a Demo',
  description: 'Get a personalized 30-minute walkthrough of Coffee Management Suite.',
  path: '/demo',
});

const expectations = [
  '30-minute personalized demo',
  'See the modules most relevant to your operation',
  'Get your questions answered live',
  'No commitment, no pressure',
  'Walk away with a clear picture of how CMS fits your business',
];

export default function DemoPage() {
  return (
    <Section bg="light" padding="md">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Left: Info */}
        <div>
          <h1 className="text-h1 font-clash text-espresso-900">See CMS in Action</h1>
          <p className="text-body-lg text-espresso-600 mt-4 max-w-lg">
            Get a personalized walkthrough of Coffee Management Suite tailored to your shop&apos;s specific needs.
          </p>

          <div className="mt-10 space-y-4">
            <p className="text-overline text-caramel-400">What to expect</p>
            <ul className="space-y-3">
              {expectations.map((item) => (
                <li key={item} className="flex items-start gap-3 text-body text-espresso-700">
                  <Check className="w-5 h-5 text-sage-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Calendar placeholder */}
        <Card variant="elevated" padding="lg">
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-cream-300 mx-auto mb-6" />
            <h2 className="text-h3 font-clash text-espresso-900">Calendar booking coming soon</h2>
            <p className="text-body text-espresso-600 mt-3 max-w-sm mx-auto">
              In the meantime, email us at{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-caramel-500 hover:text-caramel-600 font-semibold transition-colors"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
            <div className="mt-8">
              <Button variant="primary" size="lg" href={`mailto:${CONTACT_EMAIL}?subject=Demo Request`}>
                Email Us
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </Section>
  );
}
