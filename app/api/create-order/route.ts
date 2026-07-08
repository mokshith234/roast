import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { resumeText, jdText, dreamJob } = body;

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error("Supabase keys are missing in the environment.");
    }

    // Generate a unique order ID
    const orderId = `order_${crypto.randomUUID().replace(/-/g, "")}`;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { error: dbError } = await supabase.from('orders').insert([{ 
      razorpay_order_id: orderId, 
      resume_text: resumeText, 
      jd_text: jdText || null, 
      dream_job: dreamJob || null
    }]);

    if (dbError) {
      console.error("Supabase insert error:", dbError);
      throw new Error("Database error: Could not save resume data.");
    }

    return NextResponse.json({ id: orderId });
  } catch (error: any) {
    console.error("Order Creation Error:", error);
    const errorMessage = error?.message || "Failed to create order";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
