import { NextResponse } from 'next/server';
import { z } from 'zod';

const demoSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  shopName: z.string().optional(),
  message: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = demoSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Validation failed', issues: result.error.issues }, { status: 400 });
    }

    // TODO: Send notification email via Resend
    console.log('Demo request submission:', result.data);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to submit demo request' }, { status: 500 });
  }
}
