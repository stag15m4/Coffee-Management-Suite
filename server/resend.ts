// Resend email integration for Coffee Order module
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

export async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
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
    const { client, fromEmail } = await getUncachableResendClient();
    
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
