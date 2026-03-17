import { Sheet, Clock, AlertTriangle } from 'lucide-react';
import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';
import Card from '@/components/shared/Card';
import ScrollReveal from '@/components/shared/ScrollReveal';

const painPoints = [
  {
    icon: Sheet,
    title: 'The Spreadsheet Spiral',
    description:
      'You built a spreadsheet to track costs. Then another for tips. Then another for maintenance. Now you have 14 tabs, three are outdated, and you\u2019re not sure which version is the right one.',
  },
  {
    icon: Clock,
    title: 'The End-of-Night Math',
    description:
      'It\u2019s 11pm. You\u2019ve been on your feet for 14 hours. Now you\u2019re hunched over a calculator splitting tips, counting cash, and praying the register balances. This is not why you opened a coffee shop.',
  },
  {
    icon: AlertTriangle,
    title: 'The \u201CI Forgot\u201D Spiral',
    description:
      'The grinder was supposed to be serviced last month. The walk-in filter was due two weeks ago. You only find out when something breaks \u2014 and it always breaks during the morning rush.',
  },
];

export function ProblemSection() {
  return (
    <Section bg="light" padding="lg" id="problems">
      <SectionHeading
        title="Sound Familiar?"
        subtitle="Running a cafe shouldn't feel like a second job on top of your job."
        align="center"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {painPoints.map((point, index) => (
          <ScrollReveal key={point.title} delay={index * 0.1}>
            <Card variant="light" hover glow padding="lg" className="group h-full">
              <div className="mb-5">
                <point.icon
                  className="h-10 w-10 text-espresso-600 transition-colors duration-300 group-hover:text-caramel-400"
                  strokeWidth={1.5}
                />
              </div>
              <h3 className="text-h4 text-espresso-900 mb-3">{point.title}</h3>
              <p className="text-body text-espresso-600">{point.description}</p>
            </Card>
          </ScrollReveal>
        ))}
      </div>

      <ScrollReveal delay={0.4}>
        <p className="font-caveat text-2xl text-caramel-400 text-center mt-12 -rotate-3">
          there&rsquo;s a better way &darr;
        </p>
      </ScrollReveal>
    </Section>
  );
}
