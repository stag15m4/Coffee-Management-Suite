'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Section from '@/components/shared/Section';
import SectionHeading from '@/components/shared/SectionHeading';
import Button from '@/components/shared/Button';
import { CONTACT_EMAIL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Mail, Clock, ArrowRight } from 'lucide-react';

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  shopName: z.string().optional(),
  locations: z.enum(['1', '2-5', '5-10', '10+']),
  subject: z.enum(['general', 'sales', 'support', 'partnership']),
  message: z.string().min(20, 'Please include more detail'),
});

type ContactFormData = z.infer<typeof contactSchema>;

const locationOptions = ['1', '2-5', '5-10', '10+'] as const;
const subjectOptions = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'sales', label: 'Sales' },
  { value: 'support', label: 'Support' },
  { value: 'partnership', label: 'Partnership' },
] as const;

const inputClasses =
  'w-full bg-white border border-cream-300 rounded-lg px-4 py-3 text-body font-general text-espresso-900 placeholder:text-espresso-400 focus:border-caramel-400 focus:ring-1 focus:ring-caramel-400/20 focus:outline-none transition-colors';

const labelClasses = 'block text-espresso-900 font-medium text-sm mb-1.5';
const errorClasses = 'text-rust-500 text-sm mt-1';

export default function ContactPage() {
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      locations: '1',
      subject: 'general',
    },
  });

  async function onSubmit(data: ContactFormData) {
    setSubmitState('loading');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to send');
      setSubmitState('success');
      reset();
    } catch {
      setSubmitState('error');
    }
  }

  return (
    <Section bg="light" padding="md">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Left: Contact Form */}
        <div>
          <h1 className="text-h1 font-clash text-espresso-900 mb-8">Contact Us</h1>

          {submitState === 'success' ? (
            <div className="bg-sage-400/10 border border-sage-400/30 rounded-xl p-8 text-center">
              <h2 className="text-h3 font-clash text-espresso-900 mb-2">Message sent!</h2>
              <p className="text-body text-espresso-600">We&apos;ll get back to you within 24 hours.</p>
              <Button variant="secondary" className="mt-6" onClick={() => setSubmitState('idle')}>
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Full Name */}
              <div>
                <label htmlFor="name" className={labelClasses}>
                  Full Name <span className="text-rust-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Your full name"
                  className={cn(inputClasses, errors.name && 'border-rust-500')}
                  {...register('name')}
                />
                {errors.name && <p className={errorClasses}>{errors.name.message}</p>}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className={labelClasses}>
                  Email <span className="text-rust-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@yourshop.com"
                  className={cn(inputClasses, errors.email && 'border-rust-500')}
                  {...register('email')}
                />
                {errors.email && <p className={errorClasses}>{errors.email.message}</p>}
              </div>

              {/* Shop Name */}
              <div>
                <label htmlFor="shopName" className={labelClasses}>
                  Shop Name
                </label>
                <input
                  id="shopName"
                  type="text"
                  placeholder="Your coffee shop's name"
                  className={inputClasses}
                  {...register('shopName')}
                />
              </div>

              {/* Number of Locations */}
              <div>
                <label htmlFor="locations" className={labelClasses}>
                  Number of Locations
                </label>
                <select id="locations" className={inputClasses} {...register('locations')}>
                  {locationOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="subject" className={labelClasses}>
                  Subject
                </label>
                <select id="subject" className={inputClasses} {...register('subject')}>
                  {subjectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className={labelClasses}>
                  Message <span className="text-rust-500">*</span>
                </label>
                <textarea
                  id="message"
                  rows={5}
                  placeholder="Tell us how we can help..."
                  className={cn(inputClasses, 'resize-y', errors.message && 'border-rust-500')}
                  {...register('message')}
                />
                {errors.message && <p className={errorClasses}>{errors.message.message}</p>}
              </div>

              {submitState === 'error' && (
                <p className="text-rust-500 text-sm">Something went wrong. Please try again or email us directly.</p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={submitState === 'loading'}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Send Message
              </Button>
            </form>
          )}
        </div>

        {/* Right: Contact Info */}
        <div>
          <SectionHeading title="Get in Touch" align="left" />
          <div className="bg-cream-100 rounded-xl p-8 space-y-6">
            <div className="flex items-start gap-4">
              <Mail className="w-5 h-5 text-caramel-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-body-sm font-medium text-espresso-900">Email</p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-body text-caramel-500 hover:text-caramel-600 transition-colors"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Clock className="w-5 h-5 text-caramel-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-body-sm font-medium text-espresso-900">Response Time</p>
                <p className="text-body text-espresso-600">We respond within 24 hours</p>
              </div>
            </div>

            <div className="border-t border-cream-300 pt-6">
              <p className="text-body text-espresso-600">
                Prefer to talk?{' '}
                <a
                  href="/demo"
                  className="text-caramel-500 hover:text-caramel-600 font-semibold transition-colors inline-flex items-center gap-1"
                >
                  Book a demo instead
                  <ArrowRight className="w-4 h-4" />
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
