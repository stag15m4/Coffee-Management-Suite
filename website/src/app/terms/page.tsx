import { generatePageMetadata } from '@/lib/metadata';
import Section from '@/components/shared/Section';
import { CONTACT_EMAIL } from '@/lib/constants';

export const metadata = generatePageMetadata({
  title: 'Terms of Service',
  description: 'Terms of Service for Coffee Management Suite.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <Section bg="light" padding="md">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-h1 font-clash text-espresso-900">Terms of Service</h1>
        <p className="text-body-sm text-espresso-600 mt-2 mb-12">Last updated: March 2026</p>

        {/* TODO: Replace with reviewed legal text */}

        <div className="space-y-10">
          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">1. Acceptance of Terms</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              By accessing or using Coffee Management Suite, you agree to be bound by these Terms of Service. If you do
              not agree to these terms, you may not use the service. We may update these terms from time to time, and
              continued use of the service constitutes acceptance of any changes.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">2. Service Description</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              Coffee Management Suite is a multi-tenant SaaS platform providing coffee shop management tools including
              recipe costing, tip payout calculation, cash deposit tracking, bulk ordering, equipment maintenance, and
              administrative task management. Features are provided on a modular basis according to your subscription
              plan.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">3. Account Responsibilities</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              You are responsible for maintaining the confidentiality of your account credentials and for all activity
              that occurs under your account. You must provide accurate and complete information when creating an
              account and keep it up to date. You agree to notify us immediately of any unauthorized use of your
              account.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">4. Billing and Payment</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              Paid plans are billed monthly or annually as selected. Prices are per location as described on our pricing
              page. All fees are non-refundable except as expressly stated in our refund policy. We reserve the right to
              change pricing with 30 days&apos; notice to active subscribers.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">5. Cancellation and Refunds</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              You may cancel your subscription at any time from your account settings. Upon cancellation, you will
              retain access through the end of your current billing period. We do not provide prorated refunds for
              partial billing periods. Data export is available for 30 days after cancellation.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">6. Intellectual Property</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              All intellectual property rights in the service, including software, design, and content, remain with
              Coffee Management Suite. You retain ownership of all data you input into the platform. You grant us a
              limited license to process your data solely to provide the service.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">7. Limitation of Liability</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              To the maximum extent permitted by law, Coffee Management Suite shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, or any loss of profits or revenue, whether
              incurred directly or indirectly. Our total liability shall not exceed the amounts paid by you in the
              twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">8. Governing Law</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              These Terms shall be governed by and construed in accordance with the laws of the State of Texas, without
              regard to its conflict of law provisions. Any disputes arising from these terms or the service shall be
              resolved in the courts located in Travis County, Texas.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">9. Contact</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              If you have any questions about these Terms of Service, please contact us at{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-caramel-500 hover:text-caramel-600 transition-colors font-semibold"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </Section>
  );
}
