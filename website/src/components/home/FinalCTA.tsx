'use client';

import Container from '@/components/shared/Container';
import { APP_URL } from '@/lib/constants';
import { trackEvent } from '@/lib/analytics';

export function FinalCTA() {
  return (
    <section className="bg-gradient-to-br from-caramel-200 via-caramel-300 to-copper-400 py-24 md:py-32">
      <Container>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-h2 text-espresso-950">Ready to Stop Surviving and Start Scaling?</h2>
          <p className="text-body-lg text-espresso-800 mt-4 mb-10">
            Join cafe owners who replaced their spreadsheets, calculators, and sticky notes with one platform that
            actually works.
          </p>

          <a
            href={`${APP_URL}/register`}
            onClick={() => trackEvent('final_cta_click', { cta: 'start_free_trial' })}
            className="inline-flex items-center justify-center bg-espresso-900 text-cream-50 px-12 py-5 text-lg font-semibold rounded-full hover:scale-[1.03] shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-espresso-700 focus:ring-offset-2 focus:ring-offset-caramel-300"
          >
            Start Your Free Trial &rarr;
          </a>

          <p className="text-sm text-espresso-700 mt-4">Free forever on Starter. No credit card needed.</p>

          <a
            href="/demo"
            className="inline-flex items-center gap-1 text-sm font-semibold text-espresso-800 hover:text-espresso-950 mt-3 transition-colors duration-200"
          >
            or Book a Demo &rarr;
          </a>
        </div>
      </Container>
    </section>
  );
}
