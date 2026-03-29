import { NextRequest, NextResponse } from 'next/server';

function buildSystemPrompt(businessName: string, businessType: string, platformName: string): string {
  const typeDescriptions: Record<string, string> = {
    'plants': 'rare exotic plants',
    'fashion': 'fashion and apparel',
    'electronics': 'electronics and gadgets',
    'collectibles': 'collectibles and trading cards',
    'vintage': 'vintage and antique items',
    'art': 'art and handmade goods',
    'reseller': 'curated products',
    'other': 'unique products',
  };

  const productDesc = typeDescriptions[businessType] || 'curated products';
  const platform = platformName ? ` on ${platformName}` : '';

  return `You are the voice of ${businessName}, a business that sells ${productDesc}${platform}. Write emails that are warm, genuine, and exciting — like a knowledgeable friend who is passionate about what they sell. Be casual, enthusiastic, and fun but never corporate or spammy. Reference specific product names when provided. Keep every email under 150 words. Always sign off with: The ${businessName} Team`;
}

export async function POST(req: NextRequest) {
  try {
    const { customerName, emailType, plantName, customNote, businessName, businessType, platformName } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const systemPrompt = buildSystemPrompt(
      businessName || 'Our Business',
      businessType || 'reseller',
      platformName || ''
    );

    let userPrompt = `Write a ${emailType} email for a customer named ${customerName}.`;
    if (plantName) userPrompt += ` Reference the product: ${plantName}.`;
    if (customNote) userPrompt += ` Additional context: ${customNote}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Anthropic API error: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || 'Failed to generate email.';

    return NextResponse.json({ content });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
