import { generatePageMetadata } from '@/lib/metadata';
import Section from '@/components/shared/Section';
import { CONTACT_EMAIL } from '@/lib/constants';

export const metadata = generatePageMetadata({
  title: 'Privacy Policy',
  description: 'Privacy Policy for Coffee Management Suite.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <Section bg="light" padding="md">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-h1 font-clash text-espresso-900">Privacy Policy</h1>
        <p className="text-body-sm text-espresso-600 mt-2 mb-12">Last updated: March 2026</p>

        {/* TODO: Replace with reviewed legal text */}

        <div className="space-y-10">
          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">1. What We Collect</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              We collect information you provide directly, such as your name, email address, shop name, and payment
              information when you create an account or contact us. We also collect usage data automatically, including
              pages visited, features used, and device information to improve our service.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">2. How We Use It</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              We use your information to provide and improve our services, process payments, send important updates
              about your account, and provide customer support. We may also use anonymized, aggregated data to
              understand usage patterns and improve the platform.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">3. How We Protect It</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              We implement industry-standard security measures including encryption in transit (TLS) and at rest, strict
              access controls, and regular security audits. Your business data is isolated through multi-tenant
              architecture with row-level security policies.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">4. Third-Party Services</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              We use trusted third-party services to operate our platform, including Supabase for data storage and
              authentication, Stripe for payment processing, and Resend for transactional emails. These providers are
              contractually obligated to protect your data and only process it as we instruct.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">5. Data Retention</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              We retain your data for as long as your account is active or as needed to provide our services. If you
              close your account, we will delete your personal data within 30 days, except where we are required by law
              to retain certain records.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">6. Your Rights</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              You have the right to access, correct, or delete your personal data at any time. You can export your data
              through the platform or by contacting us. You may also request that we restrict processing of your data or
              object to certain uses.
            </p>
          </section>

          <section>
            <h2 className="text-h3 font-clash text-espresso-900 mb-3">7. Contact</h2>
            {/* TODO: Replace with reviewed legal text */}
            <p className="text-body text-espresso-700">
              If you have any questions about this Privacy Policy or our data practices, please contact us at{' '}
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
