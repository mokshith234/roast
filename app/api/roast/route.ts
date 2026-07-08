import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing" }, { status: 500 });
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const body = await req.json();
    const { resumeText, jdText, dreamJob, targetRole } = body;
    const mode = new URL(req.url).searchParams.get("mode");

    if (!resumeText || resumeText.trim() === "") {
      return NextResponse.json({ error: "Missing resume Text" }, { status: 400 });
    }

    const contents: any[] = [];
    contents.push({ text: `RESUME:\n${resumeText}` });

    const hasJD = !!(jdText && jdText.trim() !== "");
    if (hasJD) {
      contents.push({ text: `JOB DESCRIPTION:\n${jdText}` });
    }

    let promptText = "";

    if (mode === "fix") {
        promptText = `You are an expert resume writer. Rewrite this resume.
Return JSON with this schema:
{
  "summary": "String",
  "experience": ["String bullets"],
  "skills": ["String"]
}
`;
    } else {
        const role = dreamJob || targetRole || "";
        promptText = `You are a brutal hiring manager. Roast this RESUME.
You must return ONLY a raw JSON object with this exact schema:
{
  "impact_score": "Score out of 100 (e.g. 12)",
  "summary": "A brutal summary of how bad it is",
  "weaknesses": [
    {
      "flaw": "The flaw",
      "roast": "Sarcastic comment about the flaw"
    }
  ]
}
`;
        if (hasJD) {
          promptText += `\nRoast how horribly they mismatch the JOB DESCRIPTION.`;
        } else if (role) {
          promptText += `\nThey want to be a ${role}. Mock them for not being ready.`;
        }
    }

    contents.push({ text: promptText });

    let response;
    let retries = 3;

    for (let i = 0; i < retries; i++) {
      try {
        const result = await model.generateContent(contents);
        response = result.response.text();
        break;
      } catch (error: any) {
        if (error?.status === 429 && i < retries - 1) {
          await sleep((i + 1) * 5000);
          continue;
        }
        throw error;
      }
    }

    if (mode === "fix") {
        return NextResponse.json({ text: response });
    }
    
    let json;
    try {
      json = JSON.parse(response || "{}");
    } catch (e) {
      console.error("Failed to parse JSON:", response);
      return NextResponse.json({ text: response });
    }

    const md = `**Impact Score: ${json.impact_score}/100**\n\n${json.summary}\n\n### Why You're Failing:\n${json.weaknesses?.map((w: any) => `- **${w.flaw}**: ${w.roast}`).join('\n')}`;

    return NextResponse.json({ text: md });
  } catch (error: any) {
    console.error("Roast Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
