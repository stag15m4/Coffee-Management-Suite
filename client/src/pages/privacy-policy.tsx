import { useLocation } from 'wouter';
import { useTheme } from '@/contexts/ThemeProvider';
import { useVertical } from '@/contexts/VerticalContext';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
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
            Privacy Policy
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-sm max-w-none" style={{ color: 'var(--color-secondary)' }}>
          <p className="text-sm mb-8" style={{ color: 'var(--color-secondary-light)' }}>
            Effective Date: {effectiveDate}
          </p>

          <h2 className="text-xl font-bold mb-3">1. Introduction</h2>
          <p className="mb-6">
            {productName} ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application and related services (collectively, the "Service").
          </p>

          <h2 className="text-xl font-bold mb-3">2. Information We Collect</h2>
          <p className="mb-2 font-semibold">Account Information</p>
          <p className="mb-4">
            When you create an account, we collect your name, email address, and the business name and location(s) you associate with your account. If you are invited by a business owner, your profile is created with the information they provide.
          </p>
          <p className="mb-2 font-semibold">Business Data</p>
          <p className="mb-4">
            The Service stores operational data you enter, including but not limited to: recipes, ingredient costs, tip distributions, cash deposit records, equipment logs, task assignments, employee schedules, financial budgets, and documents you upload.
          </p>
          <p className="mb-2 font-semibold">Third-Party Integrations</p>
          <p className="mb-4">
            If you connect third-party services (e.g., QuickBooks Online, Stripe), we receive tokens and account identifiers necessary to access your data on those platforms. We store OAuth tokens securely and only access the scopes you authorize.
          </p>
          <p className="mb-2 font-semibold">Usage Data</p>
          <p className="mb-6">
            We automatically collect technical information such as browser type, device type, IP address, pages visited, and timestamps to improve the Service and diagnose issues.
          </p>

          <h2 className="text-xl font-bold mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 mb-6 space-y-1">
            <li>To provide, operate, and maintain the Service</li>
            <li>To process transactions and send related notifications</li>
            <li>To connect with third-party services you authorize (e.g., QuickBooks, Stripe)</li>
            <li>To send administrative communications (account verification, security alerts, support)</li>
            <li>To improve and personalize the Service</li>
            <li>To comply with legal obligations</li>
          </ul>

          <h2 className="text-xl font-bold mb-3">4. Data Sharing and Disclosure</h2>
          <p className="mb-4">
            We do not sell your personal information. We may share information with:
          </p>
          <ul className="list-disc pl-6 mb-6 space-y-1">
            <li><strong>Service providers</strong> — hosting (GitHub/Supabase), payment processing (Stripe), email delivery (Resend), and file storage providers that help us operate the Service</li>
            <li><strong>Third-party integrations</strong> — only the platforms you explicitly connect (e.g., QuickBooks Online), and only with the data scopes you authorize</li>
            <li><strong>Legal requirements</strong> — if required by law, court order, or governmental request</li>
            <li><strong>Business transfers</strong> — in connection with a merger, acquisition, or sale of assets</li>
          </ul>

          <h2 className="text-xl font-bold mb-3">5. Data Security</h2>
          <p className="mb-6">
            We use industry-standard security measures including encrypted connections (TLS), row-level security to isolate tenant data, role-based access controls, and secure token storage. While we strive to protect your data, no method of electronic transmission or storage is 100% secure.
          </p>

          <h2 className="text-xl font-bold mb-3">6. Data Retention</h2>
          <p className="mb-6">
            We retain your data for as long as your account is active or as needed to provide the Service. If you delete your account, we will delete or anonymize your data within 90 days, except where retention is required by law.
          </p>

          <h2 className="text-xl font-bold mb-3">7. Your Rights</h2>
          <p className="mb-4">Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-6 mb-6 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your data in a portable format</li>
            <li>Withdraw consent for optional processing</li>
          </ul>
          <p className="mb-6">
            To exercise any of these rights, contact us at <a href={`mailto:${contactEmail}`} style={{ color: themeColors.primary }}>{contactEmail}</a>.
          </p>

          <h2 className="text-xl font-bold mb-3">8. Cookies</h2>
          <p className="mb-6">
            The Service uses essential cookies and local storage for authentication and session management. We do not use third-party advertising or tracking cookies.
          </p>

          <h2 className="text-xl font-bold mb-3">9. Children's Privacy</h2>
          <p className="mb-6">
            The Service is not directed to individuals under the age of 16. We do not knowingly collect personal information from children.
          </p>

          <h2 className="text-xl font-bold mb-3">10. Changes to This Policy</h2>
          <p className="mb-6">
            We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page and updating the effective date. Your continued use of the Service after changes constitutes acceptance.
          </p>

          <h2 className="text-xl font-bold mb-3">11. Contact Us</h2>
          <p className="mb-6">
            If you have questions about this Privacy Policy, contact us at{' '}
            <a href={`mailto:${contactEmail}`} style={{ color: themeColors.primary }}>{contactEmail}</a>.
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
