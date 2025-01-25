import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Add your video summarization logic here
    // For now, let's return a mock response
    return NextResponse.json({
      summary: "This is a test summary. Replace this with your actual API implementation."
    });

  } catch (err) { // Changed 'error' to 'err' and using it in the response
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to summarize video" },
      { status: 500 }
    );
  }
}