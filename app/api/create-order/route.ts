import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { resumeText, jdText, dreamJob } = body;

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay keys are missing in the environment.");
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error("Supabase keys are missing in the environment.");
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: 4900,
      currency: "INR",
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { error: dbError } = await supabase.from('orders').insert([{ 
      razorpay_order_id: order.id, 
      resume_text: resumeText, 
      jd_text: jdText || null, 
      dream_job: dreamJob || null
    }]);

    if (dbError) {
      console.error("Supabase insert error:", dbError);
      throw new Error("Database error: Could not save resume data.");
    }

    return NextResponse.json({ id: order.id });
  } catch (error: any) {
    console.error("Razorpay Order Creation Error:", error);
    const errorMessage = error?.error?.description || error?.message || "Failed to create Razorpay order";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
