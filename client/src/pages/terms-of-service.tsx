import { useLocation } from 'wouter';
import { useTheme } from '@/contexts/ThemeProvider';
import { useVertical } from '@/contexts/VerticalContext';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  const [, setLocation] = useLocation();
  const { colors: themeColors, meta } = useTheme();
  const { vertical } = useVertical();
  const productName = vertical?.productName || meta.companyName || 'Coffee Management Suite';
  const effectiveDate = 'March 12, 2026';
  const contactEmail = 'support@coffeemanagementsuite.com';

  return (
    <div style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh' }}>
      <header
        className="sticky top-0 z-50 border-b"
        style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-accent-dark)' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => setLocation('/')}
            className="flex items-center gap-1 text-sm font-medium hover:opacity-80"
            style={{ color: themeColors.primary }}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-secondary)' }}>
            Terms of Service
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-sm max-w-none" style={{ color: 'var(--color-secondary)' }}>
          <p className="text-sm mb-8" style={{ color: 'var(--color-secondary-light)' }}>
            Effective Date: {effectiveDate}
          </p>

          <h2 className="text-xl font-bold mb-3">1. Acceptance of Terms</h2>
          <p className="mb-6">
            By accessing or using {productName} (the "Service"), you agree to be bound by these Terms of Service
            ("Terms"). If you do not agree, do not use the Service. If you are using the Service on behalf of a
            business, you represent that you have authority to bind that business to these Terms.
          </p>

          <h2 className="text-xl font-bold mb-3">2. Description of Service</h2>
          <p className="mb-6">
            {productName} is a multi-tenant software-as-a-service (SaaS) platform that provides operational management
            tools for food service businesses, including recipe costing, tip payout calculations, cash deposit tracking,
            bulk ordering, equipment maintenance logging, administrative task management, and financial budgeting. The
            Service may integrate with third-party platforms (e.g., QuickBooks Online, Stripe) at your direction.
          </p>

          <h2 className="text-xl font-bold mb-3">3. Accounts and Access</h2>
          <p className="mb-4">
            You are responsible for maintaining the confidentiality of your account credentials and for all activity
            that occurs under your account. You must:
          </p>
          <ul className="list-disc pl-6 mb-6 space-y-1">
            <li>Provide accurate and complete registration information</li>
            <li>Notify us immediately of any unauthorized use of your account</li>
            <li>Not share your credentials or allow others to access your account</li>
          </ul>
          <p className="mb-6">
            Business owners and managers may invite team members and assign roles (Owner, Manager, Lead, Employee). You
            are responsible for the access levels you grant within your organization.
          </p>

          <h2 className="text-xl font-bold mb-3">4. Permitted Use</h2>
          <p className="mb-4">You agree to use the Service only for lawful business purposes. You may not:</p>
          <ul className="list-disc pl-6 mb-6 space-y-1">
            <li>Attempt to access another tenant's data or bypass security controls</li>
            <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
            <li>Use the Service to store or transmit malicious code</li>
            <li>Resell or sublicense access to the Service without written authorization</li>
            <li>Use automated tools to scrape or extract data from the Service</li>
          </ul>

          <h2 className="text-xl font-bold mb-3">5. Your Data</h2>
          <p className="mb-6">
            You retain ownership of all data you enter into the Service ("Your Data"). We do not claim ownership of Your
            Data. By using the Service, you grant us a limited license to host, process, and display Your Data solely to
            provide the Service to you. We will not access Your Data except to provide the Service, respond to support
            requests, or comply with the law.
          </p>

          <h2 className="text-xl font-bold mb-3">6. Third-Party Integrations</h2>
          <p className="mb-6">
            The Service allows you to connect third-party accounts (e.g., QuickBooks Online, Stripe). By connecting a
            third-party service, you authorize us to access and retrieve data from that service as necessary to provide
            the features you use. We are not responsible for the availability, accuracy, or policies of third-party
            services. Your use of third-party services is governed by their respective terms.
          </p>

          <h2 className="text-xl font-bold mb-3">7. Subscription and Payment</h2>
          <p className="mb-6">
            Access to the Service requires a paid subscription after any applicable trial period. Subscription fees are
            billed in advance on a monthly or annual basis through our payment processor (Stripe). You authorize us to
            charge your payment method for recurring fees. Prices may change with 30 days' notice. Non-payment may
            result in suspension or termination of your account.
          </p>

          <h2 className="text-xl font-bold mb-3">8. Service Availability</h2>
          <p className="mb-6">
            We strive to maintain high availability but do not guarantee uninterrupted access. We may perform scheduled
            maintenance with reasonable advance notice. We are not liable for downtime caused by circumstances beyond
            our control, including third-party service outages, network failures, or force majeure events.
          </p>

          <h2 className="text-xl font-bold mb-3">9. Limitation of Liability</h2>
          <p className="mb-6">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, {productName.toUpperCase()} AND ITS AFFILIATES SHALL NOT BE LIABLE
            FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR
            BUSINESS OPPORTUNITY, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT
            EXCEED THE FEES YOU PAID IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
          </p>

          <h2 className="text-xl font-bold mb-3">10. Disclaimer of Warranties</h2>
          <p className="mb-6">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
            INCLUDING BUT NOT LIMITED TO MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO
            NOT WARRANT THAT THE SERVICE WILL BE ERROR-FREE OR THAT DEFECTS WILL BE CORRECTED.
          </p>

          <h2 className="text-xl font-bold mb-3">11. Indemnification</h2>
          <p className="mb-6">
            You agree to indemnify and hold harmless {productName}, its officers, directors, and employees from any
            claims, damages, or expenses arising from your use of the Service, your violation of these Terms, or your
            violation of any third party's rights.
          </p>

          <h2 className="text-xl font-bold mb-3">12. Termination</h2>
          <p className="mb-6">
            Either party may terminate the agreement at any time. You may cancel your subscription through your account
            settings or by contacting support. We may suspend or terminate your access if you violate these Terms. Upon
            termination, your right to use the Service ceases immediately. We will make Your Data available for export
            for 30 days following termination, after which it may be deleted.
          </p>

          <h2 className="text-xl font-bold mb-3">13. Governing Law</h2>
          <p className="mb-6">
            These Terms are governed by the laws of the State of Louisiana, without regard to conflict of law
            principles. Any disputes shall be resolved in the courts located in New Orleans, Louisiana.
          </p>

          <h2 className="text-xl font-bold mb-3">14. Changes to These Terms</h2>
          <p className="mb-6">
            We may update these Terms from time to time. We will notify you of material changes by posting the updated
            Terms on this page and updating the effective date. Your continued use of the Service after changes
            constitutes acceptance of the revised Terms.
          </p>

          <h2 className="text-xl font-bold mb-3">15. Contact Us</h2>
          <p className="mb-6">
            If you have questions about these Terms, contact us at{' '}
            <a href={`mailto:${contactEmail}`} style={{ color: themeColors.primary }}>
              {contactEmail}
            </a>
            .
          </p>
        </div>
      </main>

      <footer
        className="py-8 border-t"
        style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-accent-dark)' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm" style={{ color: 'var(--color-secondary-light)' }}>
            &copy; {new Date().getFullYear()} {productName}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
