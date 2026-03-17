import { NextResponse } from 'next/server';
import { z } from 'zod';

const newsletterSchema = z.object({
  email: z.string().email('Valid email required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = newsletterSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Validation failed', issues: result.error.issues }, { status: 400 });
    }

    // TODO: Integrate with email service (Resend audience, etc.)
    console.log('Newsletter signup:', result.data.email);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
