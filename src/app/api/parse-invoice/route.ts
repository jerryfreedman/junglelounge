import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a data extraction assistant for Jungle Lounge, a rare exotic plant business. You receive PDF invoices from plant suppliers. Extract every individual plant/item from the invoice and return ONLY a valid JSON array. Each item must have these fields:
- "name": the plant name (string)
- "quantity": number of plants (number, default 1)
- "unit_cost": cost per plant in USD (number)
- "total_cost": total cost for this line item in USD (number)
- "supplier": the supplier/vendor name from the invoice (string)
- "date": the invoice date in YYYY-MM-DD format (string). Look for any date on the invoice — order date, invoice date, ship date. If no date is found, use null.

If you cannot parse the invoice, return: [{"error": "Could not parse invoice"}]
Return ONLY the JSON array, no other text.`;

export async function POST(req: NextRequest) {
  try {
    const { fileBase64, fileType } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    // Determine media type
    let mediaType = 'application/pdf';
    if (fileType === 'image/png') mediaType = 'image/png';
    else if (fileType === 'image/jpeg') mediaType = 'image/jpeg';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: fileBase64,
              },
            },
            {
              type: 'text',
              text: 'Extract all plant items from this invoice. Return only a JSON array.',
            }
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `API error: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '[]';

    // Try to parse the JSON from the response
    let items;
    try {
      // Handle case where Claude wraps JSON in markdown code block
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      items = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      items = [{ error: 'Failed to parse extracted data' }];
    }

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
