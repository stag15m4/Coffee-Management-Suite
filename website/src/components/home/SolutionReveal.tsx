'use client';

import { type Variants, motion, useReducedMotion } from 'framer-motion';
import Divider from '@/components/shared/Divider';
import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';

const EASE = [0.16, 1, 0.3, 1] as const;

const revealVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.8, ease: EASE },
  },
};

const noMotion: Variants = {
  hidden: {},
  visible: {},
};

function FullDashboardMockup() {
  const prefersReducedMotion = useReducedMotion();

  const variants = prefersReducedMotion ? noMotion : revealVariants;

  return (
    <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={variants}>
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
              app.coffeemanagementsuite.com/dashboard
            </div>
          </div>
        </div>

        {/* App content */}
        <div className="flex min-h-[360px] md:min-h-[440px]">
          {/* Sidebar */}
          <div className="hidden md:flex flex-col w-48 border-r border-espresso-700 bg-espresso-900/50 p-3 gap-1">
            <div className="px-3 py-2 mb-2">
              <div className="text-xs font-semibold text-cream-50">CMS</div>
              <div className="text-[10px] text-cream-600">Dashboard</div>
            </div>
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
          <div className="flex-1 p-4 md:p-6">
            <div className="text-sm font-semibold text-cream-50 mb-5">Recipe Cost Manager</div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                { label: "Today's Food Cost", value: '28.4%', color: 'text-caramel-400' },
                { label: 'Tips This Week', value: '$2,847', color: 'text-sage-400' },
                { label: 'Equipment Due', value: '2', color: 'text-rust-400' },
                { label: 'Open Tasks', value: '7', color: 'text-copper-400' },
              ].map((stat) => (
                <div key={stat.label} className="bg-espresso-900/60 rounded-lg border border-espresso-700 p-3">
                  <div className="text-[10px] text-cream-600 mb-1">{stat.label}</div>
                  <div className={`text-lg font-semibold ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Recipe list */}
            <div className="bg-espresso-900/60 rounded-lg border border-espresso-700 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-[10px] text-cream-600 border-b border-espresso-700">
                <span>Recipe Name</span>
                <span className="text-right">Cost</span>
                <span className="text-right">Price</span>
                <span className="text-right">Margin</span>
              </div>
              {[
                { name: 'Vanilla Oat Latte', cost: '$0.93', price: '$5.50', margin: '83.1%' },
                { name: 'Cortado', cost: '$0.52', price: '$4.25', margin: '87.8%' },
                { name: 'Cold Brew (16oz)', cost: '$0.38', price: '$5.00', margin: '92.4%' },
                { name: 'Matcha Latte', cost: '$1.12', price: '$6.00', margin: '81.3%' },
                { name: 'Avocado Toast', cost: '$2.45', price: '$9.50', margin: '74.2%' },
              ].map((recipe) => (
                <div
                  key={recipe.name}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5 text-xs border-b border-espresso-700/50 last:border-b-0"
                >
                  <span className="text-cream-200">{recipe.name}</span>
                  <span className="text-cream-400 text-right tabular-nums">{recipe.cost}</span>
                  <span className="text-cream-300 text-right tabular-nums">{recipe.price}</span>
                  <span className="text-sage-400 text-right tabular-nums font-medium">{recipe.margin}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function SolutionReveal() {
  return (
    <>
      <Divider variant="wave" from="light" to="dark" />
      <Section bg="dark" padding="lg" id="solution">
        <SectionHeading
          title="One Platform. Everything You Need."
          subtitle="Replace your spreadsheets, calculators, and sticky notes with six powerful modules — or just pick the ones you need."
          theme="dark"
          align="center"
        />
        <FullDashboardMockup />
      </Section>
    </>
  );
}
