"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@supabase/supabase-js";

/* ─────────────────────────────────────────────
   PROFESSIONAL RESUME RENDERER
   Transforms markdown into a print-ready resume
   ───────────────────────────────────────────── */

function ResumeDocument({ markdown }: { markdown: string }) {
  return (
    <div className="resume-document">
      <ReactMarkdown
        components={{
          // H1 = Name — large, centered, with accent underline
          h1: ({ children }) => (
            <div className="resume-header">
              <h1 className="resume-name">{children}</h1>
            </div>
          ),
          // H2 = Section headers — uppercase, tracked, with left accent
          h2: ({ children }) => (
            <div className="resume-section-header">
              <h2>{children}</h2>
            </div>
          ),
          // H3 = Job titles / Degree names
          h3: ({ children }) => (
            <h3 className="resume-subtitle">{children}</h3>
          ),
          // Paragraphs
          p: ({ children }) => {
            const text = String(children);
            // Contact info line (contains | separators, typically the second line)
            if (text.includes(" | ") && text.split("|").length >= 3) {
              return (
                <div className="resume-contact">
                  {text.split("|").map((item, i) => (
                    <span key={i} className="resume-contact-item">
                      {item.trim()}
                    </span>
                  ))}
                </div>
              );
            }
            return <p className="resume-paragraph">{children}</p>;
          },
          // Lists — clean bullet styling
          ul: ({ children }) => (
            <ul className="resume-list">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="resume-list-item">{children}</li>
          ),
          // Strong text
          strong: ({ children }) => (
            <strong className="resume-strong">{children}</strong>
          ),
          // HR = Section dividers
          hr: () => <div className="resume-divider" />,
          // Links
          a: ({ href, children }) => (
            <a href={href} className="resume-link" target="_blank" rel="noopener noreferrer">{children}</a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

/* ─────────────────────────────────────────────
   REALITY CHECK RENDERER
   Structured action plan with visual sections
   ───────────────────────────────────────────── */

function RealityCheckPanel({ markdown }: { markdown: string }) {
  // Split by H3 headers to create distinct sections
  const sections = markdown.split(/(?=### )/).filter(s => s.trim());
  
  const getSectionStyle = (title: string) => {
    if (title.includes("JOB-FIT") || title.includes("SCORE")) return { border: "border-cyan-500/30", bg: "bg-cyan-950/20", accent: "text-cyan-400", icon: "🎯" };
    if (title.includes("CRITICAL") || title.includes("GAPS")) return { border: "border-red-500/30", bg: "bg-red-950/20", accent: "text-red-400", icon: "🔴" };
    if (title.includes("WEAK") || title.includes("STRENGTHEN")) return { border: "border-amber-500/30", bg: "bg-amber-950/20", accent: "text-amber-400", icon: "🟡" };
    if (title.includes("ACTION") || title.includes("PLAN") || title.includes("30-60-90")) return { border: "border-blue-500/30", bg: "bg-blue-950/20", accent: "text-blue-400", icon: "📋" };
    if (title.includes("INTERVIEW") || title.includes("PREP")) return { border: "border-purple-500/30", bg: "bg-purple-950/20", accent: "text-purple-400", icon: "💡" };
    return { border: "border-gray-500/30", bg: "bg-gray-950/20", accent: "text-gray-400", icon: "📌" };
  };

  return (
    <div className="space-y-6">
      {sections.map((section, idx) => {
        const firstLine = section.split("\n")[0] || "";
        const style = getSectionStyle(firstLine);
        
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * idx, type: "spring", stiffness: 80 }}
            className={`${style.bg} ${style.border} border rounded-xl p-6 md:p-8 relative overflow-hidden`}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-current opacity-60" style={{ color: style.accent.replace("text-", "").includes("cyan") ? "#22d3ee" : style.accent.replace("text-", "").includes("red") ? "#f87171" : style.accent.replace("text-", "").includes("amber") ? "#fbbf24" : style.accent.replace("text-", "").includes("blue") ? "#60a5fa" : "#a78bfa" }} />
            <div className="prose prose-invert max-w-none 
              prose-p:text-gray-300 prose-p:leading-relaxed prose-p:my-2
              prose-strong:text-white prose-strong:font-bold
              prose-li:text-gray-300 prose-li:leading-relaxed prose-li:my-1
              prose-h3:text-lg prose-h3:font-black prose-h3:uppercase prose-h3:tracking-wider prose-h3:mb-4 prose-h3:mt-0
              prose-ul:my-3 prose-ul:space-y-1
              prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
              text-sm md:text-base">
              <ReactMarkdown>{section}</ReactMarkdown>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN SUCCESS PAGE
   ───────────────────────────────────────────── */

function SuccessContent() {
  const searchParams = useSearchParams();
  const [resumeText, setResumeText] = useState("");
  const [realityCheck, setRealityCheck] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"resume" | "action">("resume");
  const resumeRef = useRef<HTMLDivElement>(null);

  // Feedback state
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHover, setFeedbackHover] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Check if feedback was already submitted
  useEffect(() => {
    const orderId = searchParams.get("orderId");
    if (orderId && localStorage.getItem(`feedback_${orderId}`)) {
      setFeedbackSubmitted(true);
    }
  }, [searchParams]);

  const handleFeedbackSubmit = async () => {
    const orderId = searchParams.get("orderId");
    if (!orderId || feedbackRating === 0) return;

    setFeedbackSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          rating: feedbackRating,
          feedback: feedbackText.trim() || null,
        }),
      });
      localStorage.setItem(`feedback_${orderId}`, "true");
      setFeedbackSubmitted(true);
    } catch {
      // Silent fail — don't disrupt the user experience for feedback
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Warn user before closing tab while loading
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.returnValue = '';
    };

    if (!isReady && !error) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isReady, error]);

  // Scroll to results when ready
  useEffect(() => {
    if (isReady && resumeRef.current) {
      setTimeout(() => {
        resumeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 600);
    }
  }, [isReady]);

  useEffect(() => {
    const generateFixedResume = async () => {
      try {
        const orderId = searchParams.get("orderId");
        if (!orderId) {
          setError("No order ID provided. Are you sure you paid?");
          return;
        }

        // 1. Check local storage first to prevent reloading the API on refresh
        const cachedResume = localStorage.getItem(`fixed_resume_${orderId}`);
        let fullText = "";

        if (cachedResume) {
          fullText = cachedResume;
        } else {
          // 2. Fetch from Supabase
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          );

          const { data: dbData, error: dbError } = await supabase.from('orders').select('*').eq('razorpay_order_id', orderId).single();

          if (dbError || !dbData) {
            setError("Could not find your order in the database. Please contact support.");
            return;
          }

          let attempt = 1;
          let success = false;

          while (attempt <= 5 && !success) {
            try {
              if (attempt > 1) {
                setRetryCount(attempt);
              }
              const res = await fetch("/api/fix", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  resumeText: dbData.resume_text, 
                  jdText: dbData.jd_text, 
                  dreamJob: dbData.dream_job 
                }),
              });
              const data = await res.json();
              
              if (data.error) throw new Error(data.error);
              
              fullText = data.text;
              success = true;
            } catch (err: any) {
              if (attempt === 5) throw err;
              attempt++;
              await new Promise(resolve => setTimeout(resolve, 10000));
            }
          }

          // 3. Save to localStorage to protect against page refreshes
          localStorage.setItem(`fixed_resume_${orderId}`, fullText);
        }
        
        const delimiterStart = "===REALITY_CHECK_START===";
        const delimiterEnd = "===REALITY_CHECK_END===";
        const resumeEndDelimiter = "===RESUME_END===";
        
        let finalResume = fullText;
        let finalRealityCheck = null;
        
        // Strip ===RESUME_END=== if present
        if (fullText.includes(resumeEndDelimiter)) {
          finalResume = fullText.substring(0, fullText.indexOf(resumeEndDelimiter)).trim();
          const afterResume = fullText.substring(fullText.indexOf(resumeEndDelimiter) + resumeEndDelimiter.length);
          
          if (afterResume.includes(delimiterStart) && afterResume.includes(delimiterEnd)) {
            finalRealityCheck = afterResume.substring(
              afterResume.indexOf(delimiterStart) + delimiterStart.length,
              afterResume.indexOf(delimiterEnd)
            ).trim();
          }
        } else if (fullText.includes(delimiterStart) && fullText.includes(delimiterEnd)) {
          const startIndex = fullText.indexOf(delimiterStart);
          finalResume = fullText.substring(0, startIndex).trim();
          finalRealityCheck = fullText.substring(
            startIndex + delimiterStart.length,
            fullText.indexOf(delimiterEnd)
          ).trim();
        }
        
        setResumeText(finalResume);
        setRealityCheck(finalRealityCheck);
        setIsReady(true);
      } catch (err: any) {
        setTimeout(() => {
          setResumeText("# 🚨 ERROR: AI Engine Failed\n\n**Reason:** " + err.message + "\n\n*Please go back and try again.*");
          setIsReady(true);
        }, 1500);
      }
    };

    generateFixedResume();
  }, []);

  const handleDownload = () => {
    window.print();
  };

  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[60vh] px-4"
      >
        <div className="text-6xl mb-6">💔</div>
        <p className="text-red-400 text-xl font-bold text-center max-w-md">{error}</p>
        <a href="/" className="mt-8 text-cyan-400 underline underline-offset-4 font-semibold hover:text-cyan-300 transition-colors">← Back to Home</a>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* Print styles — only prints the resume document */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #resume-to-download, #resume-to-download * { visibility: visible; }
          #resume-to-download {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            margin: 0; padding: 48px;
            box-shadow: none; border: none; border-radius: 0;
            background: white;
          }
          .no-print { display: none !important; }
        }

        /* ── Resume Document Styles ── */
        .resume-document {
          font-family: 'Georgia', 'Times New Roman', serif;
          color: #1a1a1a;
          line-height: 1.6;
        }
        .resume-header {
          text-align: center;
          margin-bottom: 4px;
          padding-bottom: 8px;
        }
        .resume-name {
          font-size: 2rem;
          font-weight: 900;
          letter-spacing: 0.04em;
          color: #111;
          margin: 0 0 4px 0;
          text-transform: uppercase;
        }
        .resume-contact {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 6px 16px;
          font-size: 0.85rem;
          color: #555;
          margin-bottom: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .resume-contact-item {
          white-space: nowrap;
        }
        .resume-contact-item:not(:last-child)::after {
          content: '•';
          margin-left: 16px;
          color: #ccc;
        }
        .resume-section-header {
          margin-top: 20px;
          margin-bottom: 12px;
          border-bottom: 2px solid #111;
          padding-bottom: 4px;
        }
        .resume-section-header h2 {
          font-size: 0.85rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: #111;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .resume-subtitle {
          font-size: 1.05rem;
          font-weight: 700;
          color: #222;
          margin: 14px 0 2px 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .resume-paragraph {
          font-size: 0.92rem;
          color: #333;
          margin: 4px 0;
          line-height: 1.65;
        }
        .resume-strong {
          font-weight: 700;
          color: #111;
        }
        .resume-list {
          margin: 6px 0;
          padding-left: 20px;
          list-style: none;
        }
        .resume-list-item {
          font-size: 0.9rem;
          color: #333;
          line-height: 1.6;
          margin-bottom: 4px;
          position: relative;
          padding-left: 14px;
        }
        .resume-list-item::before {
          content: '▸';
          position: absolute;
          left: 0;
          color: #888;
          font-size: 0.8rem;
        }
        .resume-divider {
          height: 0;
          margin: 0;
          border: none;
        }
        .resume-link {
          color: #2563eb;
          text-decoration: none;
        }
        .resume-link:hover {
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .resume-name { font-size: 1.5rem; }
          .resume-contact { flex-direction: column; align-items: center; gap: 2px; }
          .resume-contact-item::after { display: none; }
        }
      `}} />

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-12 pb-4 no-print"
      >
        <h1 className="text-4xl md:text-5xl font-black mb-2 text-[#39FF14] tracking-widest uppercase drop-shadow-[0_0_20px_rgba(57,255,20,0.5)]">
          Payment Verified
        </h1>
        <p className="text-gray-500 font-mono text-sm">Order ID: {searchParams.get("orderId")}</p>
      </motion.div>

      {/* LOADING STATE */}
      <AnimatePresence mode="wait">
        {!isReady && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -30 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center min-h-[60vh] px-4"
          >
            <motion.div
              animate={{ rotateY: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className="text-8xl md:text-9xl mb-10 drop-shadow-[0_0_50px_rgba(57,255,20,0.8)]"
            >
              📄
            </motion.div>
            <p className="text-xl md:text-3xl font-black text-[#39FF14] animate-pulse uppercase tracking-[0.2em] text-center">
              AI is rewriting your resume...
            </p>
            <p className="text-red-500 font-black uppercase text-base md:text-lg mt-8 animate-pulse text-center">
              {retryCount > 0 
                ? `🚨 AI SERVERS BUSY. KEEP THIS TAB OPEN. RETRYING... (${retryCount}/5) 🚨` 
                : "🚨 PAYMENT RECEIVED. DO NOT CLOSE THIS TAB. 🚨"}
            </p>

            {/* Progress dots */}
            <div className="flex gap-2 mt-10">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }}
                  className="w-3 h-3 rounded-full bg-[#39FF14]"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RESULTS */}
      <AnimatePresence>
        {isReady && (
          <motion.div
            key="results"
            ref={resumeRef}
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, type: "spring", stiffness: 60, damping: 18 }}
            className="w-full max-w-5xl px-4 md:px-6 pb-20 flex flex-col items-center"
          >
            {/* Success badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-full px-6 py-3 no-print"
            >
              <span className="text-2xl">✅</span>
              <span className="text-green-400 font-bold text-sm uppercase tracking-widest">Resume Optimized Successfully</span>
            </motion.div>

            {/* Tab switcher — if reality check exists */}
            {realityCheck && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex bg-white/5 rounded-xl border border-white/10 overflow-hidden mb-8 no-print"
              >
                <button
                  onClick={() => setActiveTab("resume")}
                  className={`py-3 px-8 font-bold text-sm uppercase tracking-widest transition-all duration-300 ${
                    activeTab === "resume"
                      ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  📄 Optimized Resume
                </button>
                <button
                  onClick={() => setActiveTab("action")}
                  className={`py-3 px-8 font-bold text-sm uppercase tracking-widest transition-all duration-300 ${
                    activeTab === "action"
                      ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  🚨 Reality Check
                </button>
              </motion.div>
            )}

            {/* RESUME TAB */}
            {activeTab === "resume" && (
              <motion.div
                key="resume-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="w-full flex flex-col items-center"
              >
                {/* The resume document */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  id="resume-to-download"
                  className="w-full bg-white text-gray-900 p-8 md:p-12 lg:p-16 shadow-[0_4px_60px_rgba(0,0,0,0.5)] rounded-lg max-w-[816px]"
                  style={{ minHeight: "900px" }}
                >
                  <ResumeDocument markdown={resumeText} />
                </motion.div>

                {/* Download button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-8 w-full max-w-md no-print"
                >
                  <motion.button 
                    whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(6,182,212,0.7)" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDownload}
                    className="w-full bg-cyan-500 text-black py-5 px-8 rounded-xl font-black text-lg uppercase tracking-widest shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:bg-cyan-400 transition-colors flex items-center justify-center gap-3"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download as PDF
                  </motion.button>
                  <p className="text-center text-gray-600 text-xs mt-3 font-medium">Uses browser print → Save as PDF</p>
                </motion.div>

                {/* Nudge to reality check */}
                {realityCheck && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    onClick={() => setActiveTab("action")}
                    className="mt-8 text-red-400 hover:text-red-300 font-bold text-sm uppercase tracking-widest transition-colors no-print flex items-center gap-2"
                  >
                    🚨 View your Reality Check & Action Plan →
                  </motion.button>
                )}
              </motion.div>
            )}

            {/* REALITY CHECK TAB */}
            {activeTab === "action" && realityCheck && (
              <motion.div
                key="action-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-4xl no-print"
              >
                {/* Section title */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent"></div>
                  <span className="text-red-400 text-xs font-black uppercase tracking-[0.3em]">Confidential Intel</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent"></div>
                </div>

                <div className="bg-red-950/10 border border-red-500/20 rounded-2xl p-4 md:p-6 mb-6">
                  <p className="text-red-300/70 text-sm font-medium text-center">
                    ⚠️ Do NOT include any of this in your resume. This is your private gap analysis and growth roadmap.
                  </p>
                </div>

                <RealityCheckPanel markdown={realityCheck} />

                {/* Back to resume */}
                <motion.div className="mt-10 flex justify-center">
                  <button
                    onClick={() => setActiveTab("resume")}
                    className="text-gray-500 hover:text-white font-bold text-sm uppercase tracking-widest transition-colors flex items-center gap-2"
                  >
                    ← Back to Optimized Resume
                  </button>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="mt-8 text-center"
                >
                  <p className="text-gray-600 text-sm font-medium">
                    💡 Bookmark this page — your results are cached in your browser.
                  </p>
                </motion.div>
              </motion.div>
            )}

            {/* ── FEEDBACK SECTION ── */}
            {isReady && !feedbackSubmitted && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="w-full max-w-lg mt-16 no-print"
              >
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-md">
                  <div className="text-center mb-6">
                    <span className="text-3xl mb-3 block">🙏</span>
                    <h3 className="text-lg font-black text-white uppercase tracking-widest mb-2">Thank You for Choosing Us!</h3>
                    <p className="text-gray-400 text-sm">Your feedback helps us improve. How was your experience?</p>
                  </div>

                  {/* Star Rating */}
                  <div className="flex justify-center gap-2 mb-6">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setFeedbackRating(star)}
                        onMouseEnter={() => setFeedbackHover(star)}
                        onMouseLeave={() => setFeedbackHover(0)}
                        className="text-4xl transition-transform hover:scale-125 focus:outline-none"
                      >
                        <span className={`${(feedbackHover || feedbackRating) >= star ? 'opacity-100' : 'opacity-30'} transition-opacity`}>
                          ⭐
                        </span>
                      </button>
                    ))}
                  </div>

                  {feedbackRating > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-4"
                    >
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder={feedbackRating >= 4 ? "What did you love about it? (optional)" : "How can we improve? (optional)"}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-600 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors h-24"
                      />
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleFeedbackSubmit}
                        disabled={feedbackSubmitting}
                        className="w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                      >
                        {feedbackSubmitting ? "Sending..." : "Submit Feedback"}
                      </motion.button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Feedback already submitted */}
            {isReady && feedbackSubmitted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-16 text-center no-print"
              >
                <span className="text-2xl">💚</span>
                <p className="text-gray-500 text-sm font-medium mt-2">Thanks for your feedback!</p>
              </motion.div>
            )}

            {/* Back to home */}
            <motion.a
              href="/"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-10 mb-8 text-gray-600 hover:text-white font-bold text-sm uppercase tracking-widest transition-colors no-print"
            >
              ← Roast Another Resume
            </motion.a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col items-center font-sans relative">
      {/* Background glow effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none mix-blend-screen opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-green-900/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[70%] rounded-full bg-cyan-900/20 blur-[120px]" />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full flex flex-col items-center">
        <Suspense fallback={<div className="text-[#39FF14] text-2xl font-black mt-20 animate-pulse">Loading System...</div>}>
          <SuccessContent />
        </Suspense>
      </div>
    </div>
  );
}
