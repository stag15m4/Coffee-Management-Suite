import Image from 'next/image';
import { generatePageMetadata } from '@/lib/metadata';
import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';
import Card from '@/components/shared/Card';
import ScrollReveal from '@/components/shared/ScrollReveal';
import Container from '@/components/shared/Container';
import { Heart, Eye, Coffee, TrendingUp } from 'lucide-react';

export const metadata = generatePageMetadata({
  title: 'About',
  description:
    'Built by food service professionals who lived the 5am opens, the register drama, and the broken grinder mornings. This is our story.',
  path: '/about',
});

const timeline = [
  {
    label: 'The Problem',
    content:
      'We were running coffee shops and drowning in spreadsheets, calculators, and sticky notes. Every night ended with mental math and crossed fingers.',
  },
  {
    label: 'The Idea',
    content:
      'What if one platform could replace all of it? What if it was built by people who actually understood the workflow?',
  },
  {
    label: 'The Build',
    content:
      'We built Coffee Management Suite from the ground up, module by module, testing every feature behind real counters with real baristas.',
  },
  {
    label: 'Today',
    content: "Now we're helping coffee shops across the country run smarter, not harder.",
  },
];

const values = [
  {
    icon: Heart,
    title: 'Built for Operators',
    description: 'We make tools for people who actually run shops, not people who theorize about running shops.',
  },
  {
    icon: Eye,
    title: 'Transparent Always',
    description: 'No hidden fees, no surprise pricing, no BS. What you see is what you pay.',
  },
  {
    icon: Coffee,
    title: 'Coffee First, Tech Second',
    description: 'The tool should serve the craft, not the other way around. We stay out of your way.',
  },
  {
    icon: TrendingUp,
    title: 'Grow With You',
    description: 'Start with one module, scale to twenty locations. We grow when you grow.',
  },
];

const team = [
  {
    name: 'Austin E.',
    role: 'Co-Founder',
    order: 'Oat cortado, no sugar',
    initials: 'AE',
  },
  {
    /* TODO: Replace with real team member */
    name: 'Team Member',
    role: 'Engineering',
    order: 'Cold brew, black, always',
    initials: 'TM',
  },
  {
    /* TODO: Replace with real team member */
    name: 'Team Member',
    role: 'Design',
    order: 'Matcha latte with a shot',
    initials: 'TM',
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-espresso-900 py-16 sm:py-24">
        <Container>
          <div className="text-center">
            <h1 className="text-h1 text-cream-50 font-clash">Built by Baristas, Not Boardrooms</h1>
            <p className="text-body-lg text-cream-400 max-w-2xl mx-auto mt-6">
              We didn&apos;t study the coffee industry from the outside. We lived it &mdash; the 5am opens, the register
              drama, the &ldquo;oh god the grinder is broken&rdquo; mornings.
            </p>
          </div>
        </Container>
      </section>

      {/* Origin Story */}
      <Section bg="light" padding="md">
        <SectionHeading title="Our Story" align="center" />
        <div className="max-w-2xl mx-auto mb-12">
          <Image
            src="/images/about/origin-story.jpg"
            alt="Barista crafting coffee"
            width={672}
            height={378}
            className="rounded-xl w-full aspect-video object-cover"
          />
        </div>
        <div className="relative max-w-3xl mx-auto">
          {/* Vertical timeline line */}
          <div className="absolute left-6 md:left-1/2 md:-translate-x-px top-0 bottom-0 w-0.5 bg-cream-300" />

          <div className="space-y-12">
            {timeline.map((item, index) => (
              <ScrollReveal key={item.label} delay={index * 0.1}>
                <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
                  {/* Timeline dot */}
                  <div className="absolute left-6 md:left-1/2 top-1 -translate-x-1/2 w-3 h-3 rounded-full bg-caramel-400 ring-4 ring-cream-50 z-10" />

                  {/* Label side */}
                  <div
                    className={`pl-14 md:pl-0 ${index % 2 === 0 ? 'md:text-right md:pr-12' : 'md:col-start-2 md:pl-12'}`}
                  >
                    <span className="text-overline text-caramel-400 font-semibold">{item.label}</span>
                  </div>

                  {/* Content side */}
                  <div
                    className={`pl-14 md:pl-0 -mt-6 md:mt-0 ${index % 2 === 0 ? 'md:col-start-2 md:pl-12' : 'md:col-start-1 md:row-start-1 md:pr-12'}`}
                  >
                    <Card variant="light" padding="md">
                      <p className="text-body text-espresso-700">{item.content}</p>
                    </Card>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </Section>

      {/* Values */}
      <Section bg="light" padding="sm">
        <SectionHeading title="What We Believe" align="center" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {values.map((value, index) => (
            <ScrollReveal key={value.title} delay={index * 0.1}>
              <Card variant="light" padding="lg" hover>
                <value.icon className="w-10 h-10 text-caramel-400 mb-4" />
                <h3 className="text-h4 font-clash text-espresso-900 mb-2">{value.title}</h3>
                <p className="text-body text-espresso-600">{value.description}</p>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </Section>

      {/* Team */}
      <section className="bg-espresso-900 py-24">
        <Container>
          <SectionHeading
            title="The Team"
            theme="dark"
            align="center"
            subtitle="We're a small team of food service veterans and software engineers who think spreadsheets are the enemy."
          />
          <div className="mb-12">
            <Image
              src="/images/about/team-photo.jpg"
              alt="The Coffee Management Suite team"
              width={1260}
              height={540}
              className="rounded-xl w-full aspect-[21/9] object-cover"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {team.map((member, index) => (
              <ScrollReveal key={index} delay={index * 0.1}>
                <div className="bg-espresso-800 rounded-xl p-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-espresso-700 mx-auto mb-4 flex items-center justify-center">
                    <span className="font-clash text-xl font-semibold text-cream-200">{member.initials}</span>
                  </div>
                  <h3 className="text-h4 font-clash text-cream-50">{member.name}</h3>
                  <p className="text-body-sm text-cream-400 mt-1">{member.role}</p>
                  <p className="text-body-sm text-caramel-400 mt-3 font-caveat text-lg">{member.order}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
