// Resend email integration for Coffee Order module and Feedback
import { Resend } from 'resend';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'orders@coffeemanagementsuite.com';
  return { client: new Resend(apiKey), fromEmail };
}

export async function getUncachableResendClient() {
  return getResendClient();
}

export interface OrderEmailData {
  vendorEmail: string;
  ccEmail?: string;
  vendorName: string;
  orderItems: { name: string; size: string; quantity: number; price: number }[];
  totalUnits: number;
  totalCost: number;
  notes?: string;
  tenantName?: string;
}

export async function sendOrderEmail(data: OrderEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = getResendClient();

    const itemsHtml = data.orderItems
      .map(item => `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.size}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`)
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #5D4037;">Coffee Order from ${data.tenantName || 'Customer'}</h2>
        <p>Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #C9A962; color: white;">
              <th style="padding: 10px; text-align: left;">Product</th>
              <th style="padding: 10px; text-align: left;">Size</th>
              <th style="padding: 10px; text-align: center;">Qty</th>
              <th style="padding: 10px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background-color: #f5f5f5;">
              <td colspan="2" style="padding: 10px;">Total</td>
              <td style="padding: 10px; text-align: center;">${data.totalUnits} units</td>
              <td style="padding: 10px; text-align: right;">$${data.totalCost.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        ${data.notes ? `<p style="background-color: #FFF8E1; padding: 10px; border-radius: 4px;"><strong>Notes:</strong> ${data.notes}</p>` : ''}

        <p style="color: #888; font-size: 12px; margin-top: 30px;">
          This order was sent via the Erwin Mills Management Suite.
        </p>
      </div>
    `;

    const emailOptions: any = {
      from: fromEmail,
      to: data.vendorEmail,
      subject: `Coffee Order from ${data.tenantName || 'Customer'} - ${new Date().toLocaleDateString()}`,
      html
    };

    if (data.ccEmail) {
      emailOptions.cc = data.ccEmail;
    }

    const result = await client.emails.send(emailOptions);

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending order email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// Beta Invite Email
export interface BetaInviteEmailData {
  recipientEmail: string;
  licenseCode: string;
  signupUrl: string;
}

export async function sendBetaInviteEmail(data: BetaInviteEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = getResendClient();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #C9A227; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Coffee Management Suite</h1>
          <p style="color: #FFF8E1; margin: 8px 0 0 0; font-size: 14px;">Beta Tester Invitation</p>
        </div>

        <div style="padding: 24px; background-color: #f9f9f9;">
          <h2 style="color: #4A3728; margin-top: 0;">You're Invited to Beta Test!</h2>
          <p style="color: #333; line-height: 1.6;">
            You've been selected to beta test the Coffee Management Suite — a platform
            for managing recipes, tips, cash deposits, scheduling, and more for your coffee shop.
          </p>

          <div style="background-color: white; padding: 20px; border-radius: 8px; border: 2px solid #C9A227; text-align: center; margin: 24px 0;">
            <p style="color: #6B5344; margin: 0 0 8px 0; font-size: 13px;">Your Beta Access Code</p>
            <p style="color: #4A3728; font-size: 28px; font-weight: bold; letter-spacing: 3px; margin: 0;">
              ${data.licenseCode}
            </p>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.signupUrl}" style="display: inline-block; background-color: #C9A227; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Get Started
            </a>
          </div>

          <p style="color: #666; font-size: 13px; line-height: 1.5;">
            Click the button above to sign up, then enter your beta code during setup.
            This code expires in 90 days. As a beta tester, you'll have full access
            to all features and we'd love your feedback!
          </p>
        </div>

        <div style="background-color: #4A3728; padding: 12px; text-align: center;">
          <p style="color: #C9A227; margin: 0; font-size: 12px;">
            Coffee Management Suite - Erwin Mills
          </p>
        </div>
      </div>
    `;

    const result = await client.emails.send({
      from: fromEmail,
      to: data.recipientEmail,
      subject: "You're invited to beta test Coffee Management Suite!",
      html,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending beta invite email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

// Feedback Email Data Interface
export interface FeedbackEmailData {
  feedbackType: 'bug' | 'suggestion' | 'general';
  subject: string;
  description: string;
  pageUrl?: string;
  browserInfo?: string;
  userEmail?: string;
  userName?: string;
  tenantId?: string;
  tenantName?: string;
}

// Send feedback email to CMS@erwinmills.com
export async function sendFeedbackEmail(data: FeedbackEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = getResendClient();

    const typeLabels: Record<string, string> = {
      bug: 'Bug Report',
      suggestion: 'Suggestion',
      general: 'General Feedback'
    };

    const typeColors: Record<string, string> = {
      bug: '#dc2626',
      suggestion: '#2563eb',
      general: '#16a34a'
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #C9A227; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">CMS Feedback</h1>
        </div>

        <div style="padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: ${typeColors[data.feedbackType]}; color: white; display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-bottom: 16px;">
            ${typeLabels[data.feedbackType]}
          </div>

          <h2 style="color: #4A3728; margin-top: 0;">${data.subject}</h2>

          <div style="background-color: white; padding: 16px; border-radius: 8px; border-left: 4px solid ${typeColors[data.feedbackType]};">
            <p style="margin: 0; white-space: pre-wrap; color: #333;">${data.description}</p>
          </div>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

          <h3 style="color: #6B5344; font-size: 14px; margin-bottom: 8px;">Submitted By</h3>
          <table style="font-size: 13px; color: #666;">
            <tr>
              <td style="padding: 4px 12px 4px 0; font-weight: bold;">Name:</td>
              <td>${data.userName || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 12px 4px 0; font-weight: bold;">Email:</td>
              <td>${data.userEmail || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 12px 4px 0; font-weight: bold;">Tenant:</td>
              <td>${data.tenantName || 'Unknown'} ${data.tenantId ? `(${data.tenantId})` : ''}</td>
            </tr>
            <tr>
              <td style="padding: 4px 12px 4px 0; font-weight: bold;">Page:</td>
              <td>${data.pageUrl || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 12px 4px 0; font-weight: bold;">Browser:</td>
              <td style="font-size: 11px; max-width: 400px; word-break: break-all;">${data.browserInfo || 'Not provided'}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #4A3728; padding: 12px; text-align: center;">
          <p style="color: #C9A227; margin: 0; font-size: 12px;">
            Coffee Management Suite - Erwin Mills
          </p>
        </div>
      </div>
    `;

    const result = await client.emails.send({
      from: fromEmail,
      to: 'CMS@coffeemanagementsuite.com',
      subject: `[CMS ${typeLabels[data.feedbackType]}] ${data.subject}`,
      html,
      replyTo: data.userEmail || undefined
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending feedback email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}
