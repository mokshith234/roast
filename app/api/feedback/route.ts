import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { orderId, rating, feedback } = await req.json();

    if (!orderId || !rating) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: dbError } = await supabase.from("feedback").insert([{
      razorpay_order_id: orderId,
      rating,
      feedback_text: feedback || null,
    }]);

    if (dbError) {
      console.error("Feedback insert error:", dbError);
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Feedback Error:", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
