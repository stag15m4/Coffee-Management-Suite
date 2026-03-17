import { NextResponse } from 'next/server';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  shopName: z.string().optional(),
  locations: z.enum(['1', '2-5', '5-10', '10+']),
  subject: z.enum(['general', 'sales', 'support', 'partnership']),
  message: z.string().min(20, 'Please include more detail'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = contactSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Validation failed', issues: result.error.issues }, { status: 400 });
    }

    // TODO: Send email via Resend
    console.log('Contact form submission:', result.data);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
