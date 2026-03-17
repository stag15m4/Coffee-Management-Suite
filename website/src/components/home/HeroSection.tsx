'use client';

import { type Variants, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import Container from '@/components/shared/Container';
import { APP_URL } from '@/lib/constants';
import { trackEvent } from '@/lib/analytics';

const EASE = [0.16, 1, 0.3, 1] as const;

const stagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE },
  },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: EASE },
  },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.8, delay: 0.3, ease: EASE },
  },
};

const noMotion: Variants = {
  hidden: {},
  visible: {},
};

function DashboardMockup() {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      className="w-full"
    >
      <div
        className="rounded-xl border border-espresso-700 bg-espresso-800 overflow-hidden"
        style={{ boxShadow: 'var(--shadow-glow)' }}
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-espresso-700">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-espresso-900 rounded-md px-3 py-1.5 text-xs text-cream-600 font-general text-center truncate">
              app.coffeemanagementsuite.com/recipes
            </div>
          </div>
        </div>

        {/* App content */}
        <div className="flex min-h-[280px] md:min-h-[340px]">
          {/* Sidebar */}
          <div className="hidden sm:flex flex-col w-44 border-r border-espresso-700 bg-espresso-900/50 p-3 gap-1">
            {[
              { label: 'Recipe Costs', active: true },
              { label: 'Tip Payouts', active: false },
              { label: 'Cash Deposits', active: false },
              { label: 'Bulk Orders', active: false },
              { label: 'Equipment', active: false },
              { label: 'Admin Tasks', active: false },
            ].map((item) => (
              <div
                key={item.label}
                className={`px-3 py-2 rounded-md text-xs font-medium ${
                  item.active ? 'bg-caramel-400/10 text-caramel-400' : 'text-cream-600'
                }`}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-4 md:p-5">
            <div className="text-sm font-semibold text-cream-50 mb-4">Recipe Cost Manager</div>

            {/* Recipe card */}
            <div className="bg-espresso-900/60 rounded-lg border border-espresso-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-cream-100">Vanilla Oat Latte</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-sage-400/10 text-sage-400">83.1% margin</span>
              </div>

              <div className="space-y-2">
                {[
                  { name: 'Espresso (2oz)', cost: '$0.45' },
                  { name: 'Oat Milk (8oz)', cost: '$0.22' },
                  { name: 'Vanilla Syrup (1oz)', cost: '$0.18' },
                  { name: 'Cup + Lid', cost: '$0.08' },
                ].map((row) => (
                  <div key={row.name} className="flex justify-between items-center text-xs">
                    <span className="text-cream-400">{row.name}</span>
                    <span className="text-cream-300 font-medium tabular-nums">{row.cost}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-espresso-700 flex justify-between items-center">
                <div className="text-xs text-cream-400">
                  Total Cost: <span className="text-cream-100 font-semibold">$0.93</span>
                </div>
                <div className="text-xs text-cream-400">
                  Sell Price: <span className="text-caramel-400 font-semibold">$5.50</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function HeroSection() {
  const prefersReducedMotion = useReducedMotion();

  const containerVariants = prefersReducedMotion ? noMotion : stagger;
  const itemVariants = prefersReducedMotion ? noMotion : fadeUp;
  const fadeVariants = prefersReducedMotion ? noMotion : fadeIn;
  const scaleVariants = prefersReducedMotion ? noMotion : scaleIn;

  return (
    <section className="relative min-h-screen bg-gradient-to-b from-espresso-950 to-espresso-900 overflow-hidden">
      {/* Coffee beans background texture */}
      <Image
        src="/images/hero/hero-bg-beans.jpg"
        alt=""
        fill
        className="object-cover opacity-5"
        priority
        aria-hidden="true"
      />

      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute top-0 right-0 w-[800px] h-[800px] opacity-[0.07]"
        style={{
          background: 'radial-gradient(circle at center, var(--color-caramel-400), transparent 70%)',
        }}
        aria-hidden="true"
      />

      <Container className="relative z-10 pt-28 pb-16 lg:pt-32 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-12 lg:gap-8 items-center lg:min-h-[calc(100vh-8rem)]">
          {/* Left column — copy */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-xl lg:max-w-none"
          >
            <motion.div variants={itemVariants}>
              <Badge variant="default">Built for Food Service</Badge>
            </motion.div>

            <motion.h1 variants={itemVariants} className="text-display text-cream-50 mt-6">
              Stop Working <em className="italic">For</em>
              <br />
              Your Cafe.
              <br />
              Start Working <em className="italic">On</em> It.
            </motion.h1>

            <motion.p variants={fadeVariants} className="text-body-lg text-cream-400 mt-6 max-w-lg">
              Tired of juggling spreadsheets, tip calculators, and sticky notes? Coffee Management Suite replaces
              3&ndash;5 tools with one platform built by people who&rsquo;ve actually closed out a register at midnight.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-start gap-4 mt-8">
              <div className="flex flex-col items-start">
                <Button
                  variant="primary"
                  size="lg"
                  href={`${APP_URL}/register`}
                  icon={<ArrowRight className="h-5 w-5" />}
                  onClick={() => trackEvent('hero_cta_click', { cta: 'start_free_trial' })}
                >
                  Start Free Trial
                </Button>
                <span className="text-sm text-cream-600 mt-2 ml-1">No credit card required</span>
              </div>
              <Button
                variant="secondary"
                size="lg"
                href="/pricing"
                className="border-cream-600 text-cream-300 hover:bg-espresso-800 hover:text-cream-50"
              >
                View Pricing
              </Button>
            </motion.div>

            <motion.p variants={fadeVariants} className="text-sm text-cream-600 mt-6">
              Trusted by 50+ coffee shops across the country
            </motion.p>
          </motion.div>

          {/* Right column — dashboard mockup */}
          <motion.div
            variants={scaleVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-lg mx-auto lg:max-w-none lg:pl-4"
          >
            <DashboardMockup />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
