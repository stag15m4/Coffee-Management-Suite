'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';
import Card from '@/components/shared/Card';
import ScrollReveal from '@/components/shared/ScrollReveal';
import { TESTIMONIALS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function TestimonialSection() {
  const [activeMobileIndex, setActiveMobileIndex] = useState(0);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    setActiveMobileIndex((prev) => {
      if (direction === 'left') {
        return prev < TESTIMONIALS.length - 1 ? prev + 1 : 0;
      }
      return prev > 0 ? prev - 1 : TESTIMONIALS.length - 1;
    });
  }, []);

  return (
    <Section bg="dark" padding="lg" id="testimonials">
      <SectionHeading
        title="Don't Take Our Word For It"
        subtitle="Hear from cafe owners who made the switch."
        theme="dark"
        align="center"
      />

      {/* Desktop grid */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        {TESTIMONIALS.map((testimonial, index) => (
          <ScrollReveal key={testimonial.name} delay={index * 0.1}>
            <Card variant="dark" padding="lg" className="relative h-full">
              <span
                className="font-clash text-[120px] leading-none text-caramel-400/10 absolute top-4 left-4 select-none pointer-events-none"
                aria-hidden="true"
              >
                &ldquo;
              </span>
              <div className="relative z-10">
                <p className="text-body text-cream-100 mb-6">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <Image
                    src={testimonial.image}
                    alt={testimonial.name}
                    width={48}
                    height={48}
                    className="rounded-full object-cover w-12 h-12"
                  />
                  <div>
                    <p className="font-semibold text-cream-50">{testimonial.name}</p>
                    <p className="text-sm text-cream-400">
                      {testimonial.title}, {testimonial.shop}
                    </p>
                    <p className="text-sm text-cream-600">{testimonial.location}</p>
                  </div>
                </div>
              </div>
            </Card>
          </ScrollReveal>
        ))}
      </div>

      {/* Mobile carousel */}
      <div className="md:hidden">
        <div
          className="overflow-hidden touch-pan-y"
          onTouchStart={(e) => {
            const startX = e.touches[0].clientX;
            const el = e.currentTarget;
            const onTouchEnd = (endEvent: TouchEvent) => {
              const diff = startX - endEvent.changedTouches[0].clientX;
              if (Math.abs(diff) > 50) {
                handleSwipe(diff > 0 ? 'left' : 'right');
              }
              el.removeEventListener('touchend', onTouchEnd);
            };
            el.addEventListener('touchend', onTouchEnd);
          }}
        >
          <Card variant="dark" padding="lg" className="relative">
            <span
              className="font-clash text-[120px] leading-none text-caramel-400/10 absolute top-4 left-4 select-none pointer-events-none"
              aria-hidden="true"
            >
              &ldquo;
            </span>
            <div className="relative z-10">
              <p className="text-body text-cream-100 mb-6">&ldquo;{TESTIMONIALS[activeMobileIndex].quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <Image
                  src={TESTIMONIALS[activeMobileIndex].image}
                  alt={TESTIMONIALS[activeMobileIndex].name}
                  width={48}
                  height={48}
                  className="rounded-full object-cover w-12 h-12"
                />
                <div>
                  <p className="font-semibold text-cream-50">{TESTIMONIALS[activeMobileIndex].name}</p>
                  <p className="text-sm text-cream-400">
                    {TESTIMONIALS[activeMobileIndex].title}, {TESTIMONIALS[activeMobileIndex].shop}
                  </p>
                  <p className="text-sm text-cream-600">{TESTIMONIALS[activeMobileIndex].location}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Dots indicator */}
        <div className="flex justify-center mt-6">
          {TESTIMONIALS.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveMobileIndex(index)}
              aria-label={`View testimonial ${index + 1}`}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <span
                className={cn(
                  'block h-2 rounded-full transition-all duration-200',
                  index === activeMobileIndex ? 'bg-caramel-400 w-6' : 'bg-espresso-700 w-2',
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}
