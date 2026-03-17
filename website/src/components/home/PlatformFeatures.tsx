import { MapPin, Users, Shield, Palette } from 'lucide-react';
import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';
import Card from '@/components/shared/Card';
import Badge from '@/components/shared/Badge';
import ScrollReveal from '@/components/shared/ScrollReveal';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: MapPin,
    title: 'Multi-Location Support',
    description:
      'Manage every location from one dashboard. Location-specific settings, combined reporting, individual store views. Scale from one shop to fifty without switching tools.',
    extras: null,
  },
  {
    icon: Users,
    title: 'The Right Access for the Right People',
    description:
      'Owner sees everything. Manager sees their location. Lead sees their shift. Employee sees their tasks and tips. Nobody sees what they shouldn\u2019t.',
    extras: (
      <div className="flex flex-wrap gap-2 mt-4">
        {['Owner', 'Manager', 'Lead', 'Employee'].map((role) => (
          <span
            key={role}
            className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-cream-200 text-espresso-700"
          >
            {role}
          </span>
        ))}
      </div>
    ),
  },
  {
    icon: Shield,
    title: 'Your Data, Protected',
    description:
      'Encrypted connections. Authenticated requests. Complete business isolation. We take security seriously so you can focus on making great coffee.',
    extras: null,
  },
  {
    icon: Palette,
    title: 'Make It Yours',
    description:
      'Professional plan includes white-label branding. Your logo, your colors across every module. Your team sees YOUR brand, not ours.',
    extras: (
      <div className="mt-4">
        <Badge className="bg-copper-500/10 text-copper-500">Professional Plan</Badge>
      </div>
    ),
  },
];

export function PlatformFeatures() {
  return (
    <Section bg="light" padding="lg" id="platform">
      <SectionHeading
        title="Built for How You Actually Work"
        subtitle="Whether you run one shop or twenty, CMS scales with you."
        align="center"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {features.map((feature, index) => (
          <ScrollReveal key={feature.title} delay={index * 0.1}>
            <Card variant="light" hover glow padding="lg" className="group h-full">
              <div
                className={cn(
                  'w-[72px] h-[72px] rounded-full flex items-center justify-center mb-5',
                  'bg-cream-200 transition-colors duration-300 group-hover:bg-caramel-200'
                )}
              >
                <feature.icon className="h-8 w-8 text-espresso-700" strokeWidth={1.5} />
              </div>
              <h3 className="text-h4 text-espresso-900 mb-3">{feature.title}</h3>
              <p className="text-body text-espresso-600">{feature.description}</p>
              {feature.extras}
            </Card>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
