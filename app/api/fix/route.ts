import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing" }, { status: 500 });
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash"
    });

    const { resumeBase64, resumeText, jdBase64, jdText, dreamJob } = await req.json();

    if (!resumeBase64 && !resumeText) {
      return NextResponse.json({ error: "No resume provided" }, { status: 400 });
    }

    let resumePart: any;
    if (resumeBase64) {
      resumePart = { inlineData: { mimeType: "application/pdf", data: resumeBase64 } };
    } else {
      resumePart = { text: `RESUME TEXT:\n${resumeText}` };
    }

    let jdPart: any = null;
    if (jdBase64) {
      jdPart = { inlineData: { mimeType: "application/pdf", data: jdBase64 } };
    } else if (jdText && jdText.trim() !== "") {
      jdPart = { text: `JOB DESCRIPTION:\n${jdText}` };
    }

    let promptText = `You are an elite ATS optimization expert. Rewrite this resume to score 90+ on automated screening software.

CRITICAL LAWS:
1. [ROLE LOCK] If a 'Dream Job' or 'Job Description' is provided, target THAT exact role. If they want to be a 'Marketing Manager', DO NOT write software engineering skills. If NO role/JD is provided, rewrite it as a general professional resume. NEVER assume 'Software Engineer'.
2. [NO FAKE SKILLS] DO NOT invent skills. Only optimize what is explicitly in their original text. DO NOT invent job titles, companies, degrees, or certifications. If a skill, company, or credential is not in the original resume, DO NOT add it.
3. [ATS FORMATTING] ATS systems cannot read tables, columns, or graphics. Use ONLY standard Markdown text.
4. [KEYWORD INJECTION] If a JD is provided, extract the top 5 hard skills from the JD. Naturally weave those exact keywords into the resume bullets (ONLY if they actually possess them based on the text).
5. [XYZ FORMULA] Every single bullet point MUST use the format: 'Accomplished [X] as measured by [Y], by doing [Z]'. Start bullets with strong action verbs (Spearheaded, Architected, Optimized, Generated).
6. [NO HALLUCINATION] You are STRICTLY FORBIDDEN from adding ANY information not present in the original resume. No fake metrics, no invented percentages, no made-up project names. If the original doesn't have a number, write the bullet without one — do NOT fabricate statistics.

OUTPUT FORMAT — Follow this EXACT structure. Do NOT deviate:

# [Full Name]

**[Email] | [Phone] | [Location] | [LinkedIn/Portfolio if available]**

(Only include contact details that exist in the original resume. Do NOT invent email, phone, or links.)

---

## PROFESSIONAL SUMMARY

Write a 3-4 sentence power summary using ONLY facts from the original resume. First sentence states years of experience and domain. Second sentence highlights 2-3 signature achievements with numbers (ONLY if numbers exist in original). Third sentence states the candidate's unique value proposition for the target role.

---

## CORE COMPETENCIES

A simple comma-separated list of their ACTUAL skills from the original resume. Group by category if they have 8+ skills. Example:
**Technical:** Python, JavaScript, SQL, AWS
**Leadership:** Team Management, Agile/Scrum, Stakeholder Communication

Do NOT add skills they don't have. Only rephrase/optimize existing ones.

---

## PROFESSIONAL EXPERIENCE

For EACH role (using ONLY roles from the original resume), format EXACTLY like this:

### [Job Title]
**[Company Name]** | [Start Date] – [End Date or Present]

- Bullet point using XYZ formula
- Bullet point using XYZ formula
- Bullet point using XYZ formula (aim for 3-5 bullets per role)

---

## EDUCATION

### [Degree Name]
**[University Name]** | [Graduation Year]
[Any honors, GPA if >3.5, relevant coursework — only if present in original]

---

## CERTIFICATIONS

[Only include this section if certifications exist in original resume. List each on its own line. DO NOT invent certifications.]

---

## PROJECTS

[Only include this section if notable projects exist in original resume. Format like experience bullets. DO NOT invent projects.]

===RESUME_END===

Now output EXACTLY this delimiter:
===REALITY_CHECK_START===

Then write the Reality Check — this section IS allowed to suggest NEW things the candidate should learn. Be brutally honest.
Use these EXACT sections:

### 🎯 JOB-FIT SCORE
Give a score out of 100 for how well this candidate fits the target role. Be brutally honest. Format: **Score: XX/100**
One line explaining why.

### 🔴 CRITICAL SKILL GAPS
List the top 3-5 skills the candidate is MISSING for the target role that they need to develop. For each:
- **[Skill Name]**: Why it matters for this role + how to learn it (specific course/resource)

### 🟡 WEAK AREAS TO STRENGTHEN
List 2-3 areas where the candidate has some experience but needs to level up. Be specific about what "good" looks like.

### 📋 30-60-90 DAY ACTION PLAN
- **Days 1-30**: [Specific learning/certification goals]
- **Days 31-60**: [Portfolio/project building goals]
- **Days 61-90**: [Application strategy and networking goals]

### 💡 INTERVIEW PREP WARNINGS
List 2-3 likely tough interview questions for this role that the candidate would struggle with, and brief guidance on how to prepare.

End with exactly:
===REALITY_CHECK_END===`;

    if (jdPart || dreamJob) {
      promptText += `\nTARGET:\n`;
      if (dreamJob) promptText += `Target Job: ${dreamJob}\n`;
    }

    const parts: any[] = [resumePart];
    if (jdPart) parts.push(jdPart);
    parts.push({ text: promptText });

    let response;
    let retries = 3;

    for (let i = 0; i < retries; i++) {
      try {
        const result = await model.generateContent(parts);
        response = result.response.text();
        break;
      } catch (error: any) {
        if (error?.status === 429 && i < retries - 1) {
          await sleep((i + 1) * 5000);
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json({ text: response });
  } catch (error: any) {
    console.error("Fix Error:", error);
    return NextResponse.json(
      { error: "AI failed to rewrite resume. Please try again." },
      { status: 500 }
    );
  }
}