'use client';

import { useState, useMemo } from 'react';
import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';
import AnimatedCounter from '@/components/shared/AnimatedCounter';
import Button from '@/components/shared/Button';
import { ArrowRight } from 'lucide-react';
import { APP_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

interface SliderConfig {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  format: (val: number) => string;
}

const sliders: SliderConfig[] = [
  {
    id: 'locations',
    label: 'How many locations?',
    min: 1,
    max: 20,
    step: 1,
    default: 1,
    format: (val) => String(val),
  },
  {
    id: 'employees',
    label: 'Employees per location?',
    min: 1,
    max: 30,
    step: 1,
    default: 8,
    format: (val) => String(val),
  },
  {
    id: 'revenue',
    label: 'Monthly revenue per location',
    min: 10000,
    max: 200000,
    step: 5000,
    default: 40000,
    format: (val) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(val),
  },
];

export function ROICalculator() {
  const [values, setValues] = useState<Record<string, number>>({
    locations: 1,
    employees: 8,
    revenue: 40000,
  });

  const savings = useMemo(() => {
    const locations = values.locations;
    const employees = values.employees;
    const hoursSaved = locations * 5 + employees * locations * 0.5;
    const subscriptionReplaced = locations * 85;
    const monthlySavings = hoursSaved * 25 + subscriptionReplaced;

    return {
      hoursSaved: Math.round(hoursSaved),
      subscriptionReplaced: Math.round(subscriptionReplaced),
      monthlySavings: Math.round(monthlySavings),
    };
  }, [values]);

  const handleChange = (id: string, val: number) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  };

  return (
    <Section bg="light" padding="lg" id="roi">
      <SectionHeading
        title="See What You'll Save"
        subtitle="Plug in your numbers and see the difference."
        align="center"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* Left — sliders */}
        <div className="space-y-8">
          {sliders.map((slider) => {
            const value = values[slider.id];
            const percent = ((value - slider.min) / (slider.max - slider.min)) * 100;

            return (
              <div key={slider.id}>
                <div className="flex items-center justify-between mb-3">
                  <label htmlFor={slider.id} className="text-body font-medium text-espresso-900">
                    {slider.label}
                  </label>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-cream-200 text-sm font-semibold text-espresso-900 tabular-nums">
                    {slider.format(value)}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="range"
                    id={slider.id}
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={value}
                    onChange={(e) => handleChange(slider.id, Number(e.target.value))}
                    className={cn(
                      'w-full h-2 rounded-full appearance-none cursor-pointer',
                      'bg-cream-300',
                      '[&::-webkit-slider-thumb]:appearance-none',
                      '[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5',
                      '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
                      '[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2',
                      '[&::-webkit-slider-thumb]:border-caramel-400',
                      '[&::-webkit-slider-thumb]:cursor-pointer',
                      '[&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10',
                      '[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5',
                      '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white',
                      '[&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border-2',
                      '[&::-moz-range-thumb]:border-caramel-400',
                      '[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-solid'
                    )}
                    style={{
                      background: `linear-gradient(to right, var(--color-caramel-400) 0%, var(--color-copper-500) ${percent}%, var(--color-cream-300) ${percent}%)`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Right — results */}
        <div className="bg-white rounded-2xl border border-cream-300 p-8 md:p-10 text-center lg:text-left">
          <p className="text-body text-espresso-600 mb-2">You could save</p>
          <div className="flex items-baseline justify-center lg:justify-start gap-1">
            <AnimatedCounter
              key={savings.monthlySavings}
              target={savings.monthlySavings}
              prefix="$"
              className="text-price text-caramel-400"
            />
          </div>
          <p className="text-body text-espresso-600 mb-8">/month</p>

          <ul className="space-y-3 mb-8 text-left">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-caramel-400 mt-2.5 shrink-0" />
              <span className="text-body text-espresso-700">
                <span className="font-semibold">{savings.hoursSaved} hours/week</span> saved on manual calculations
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-caramel-400 mt-2.5 shrink-0" />
              <span className="text-body text-espresso-700">
                Replaces <span className="font-semibold">~${savings.subscriptionReplaced}/month</span> in other
                subscriptions
              </span>
            </li>
          </ul>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            href={`${APP_URL}/register`}
            icon={<ArrowRight className="h-5 w-5" />}
            onClick={() => trackEvent('roi_cta_click', { savings: savings.monthlySavings })}
          >
            Start Your Free Trial
          </Button>
        </div>
      </div>
    </Section>
  );
}
