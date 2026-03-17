import { generatePageMetadata } from '@/lib/metadata';
import SectionHeading from '@/components/shared/SectionHeading';
import Card from '@/components/shared/Card';
import ScrollReveal from '@/components/shared/ScrollReveal';
import Container from '@/components/shared/Container';
import { Shield, Lock, Cloud, Eye } from 'lucide-react';

export const metadata = generatePageMetadata({
  title: 'Security',
  description: 'Your data security is non-negotiable. Learn how Coffee Management Suite protects your business.',
  path: '/security',
});

const securityFeatures = [
  {
    icon: Shield,
    title: 'Encrypted Connections',
    description:
      'All data transmitted over secure, encrypted connections (TLS). Your business data never travels in plain text. Period.',
  },
  {
    icon: Lock,
    title: 'Strict Access Controls',
    description:
      'Every API request is authenticated and authorized. Each business can only access its own data \u2014 complete tenant isolation.',
  },
  {
    icon: Cloud,
    title: 'Reliable Infrastructure',
    description:
      'Hosted on trusted cloud infrastructure with automatic backups. Your data is safe even if hardware fails.',
  },
  {
    icon: Eye,
    title: 'Data Privacy',
    description:
      'We collect only what\u2019s necessary, store it securely, and never sell your data. Your business information belongs to you.',
  },
];

export default function SecurityPage() {
  return (
    <div className="bg-espresso-900">
      {/* Hero */}
      <section className="py-24">
        <Container>
          <div className="text-center">
            <h1 className="text-h1 text-cream-50 font-clash">Your Data Security is Non-Negotiable</h1>
            <p className="text-body-lg text-cream-400 max-w-2xl mx-auto mt-6">
              Built with enterprise-grade security from day one.
            </p>
          </div>
        </Container>
      </section>

      {/* Security Features */}
      <section className="py-24">
        <Container>
          <SectionHeading title="How We Protect Your Data" theme="dark" align="center" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {securityFeatures.map((feature, index) => (
              <ScrollReveal key={feature.title} delay={index * 0.1}>
                <Card variant="dark" padding="lg">
                  <feature.icon className="w-12 h-12 text-sage-400 mb-5" />
                  <h3 className="text-h3 font-clash text-cream-50 mb-3">{feature.title}</h3>
                  <p className="text-body text-cream-400">{feature.description}</p>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Compliance Roadmap */}
      <section className="py-16 pb-24">
        <Container>
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-body-lg text-cream-400">We&apos;re actively working toward SOC 2 Type II compliance.</p>
            <p className="text-body text-cream-400 mt-4">
              Have security questions? Contact us at{' '}
              <a
                href="mailto:security@coffeemanagementsuite.com"
                className="text-caramel-400 hover:text-caramel-300 transition-colors font-semibold"
              >
                security@coffeemanagementsuite.com
              </a>
            </p>
          </div>
        </Container>
      </section>
    </div>
  );
}
