import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are the voice of Jungle Lounge, a rare exotic plant business based in Miami Beach, Florida. Write emails that are warm, tropical, and genuinely exciting — like a knowledgeable friend who is obsessed with rare aroids. Be casual, passionate, and fun but never corporate or spammy. Reference specific plant names when provided. Keep every email under 150 words. Always sign off with: The Jungle Lounge Team 🌿🦩 — Never use the phrase Jungle Jam anywhere. The streams are always called Jungle Lounge streams.`;

export async function POST(req: NextRequest) {
  try {
    const { customerName, emailType, plantName, customNote } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    let userPrompt = `Write a ${emailType} email for a customer named ${customerName}.`;
    if (plantName) userPrompt += ` Reference the plant: ${plantName}.`;
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
        system: SYSTEM_PROMPT,
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
