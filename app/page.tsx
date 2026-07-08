"use client";

import { useEffect, useState, useRef } from "react";
import Script from "next/script";
import ReactMarkdown from "react-markdown";
import { useRouter } from "next/navigation";
import * as htmlToImage from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";

function TiltCard({ children, onClick, onDragOver, onDragLeave, onDrop, isLocked, borderClass }: any) {
  return (
    <div
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative h-64 rounded-2xl flex flex-col items-center justify-center p-8 text-center cursor-pointer bg-gray-950/90 border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
        isLocked ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)] scale-[0.98]' : borderClass || 'border-white/10 hover:border-white/30'
      }`}
    >
      <div className="w-full flex flex-col items-center">
        {children}
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "queue" | "roasted" | "fixing" | "error">("idle");
  const [intensity, setIntensity] = useState<"soft" | "nuclear" | "ender">("nuclear");
  const [loadingStep, setLoadingStep] = useState(0);
  
  const [targetRole, setTargetRole] = useState("");
  const [customRole, setCustomRole] = useState("");

  const [resumeMode, setResumeMode] = useState<"pdf" | "text">("pdf");
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState("");
  
  const [jdMode, setJdMode] = useState<"pdf" | "text">("pdf");
  const [jdName, setJdName] = useState<string | null>(null);
  const [jdText, setJdText] = useState("");

  const [roastText, setRoastText] = useState("");
  const [typedRoast, setTypedRoast] = useState("");
  
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);

  const [isDraggingResume, setIsDraggingResume] = useState(false);
  const [isDraggingJd, setIsDraggingJd] = useState(false);



  // Typing animation effect
  useEffect(() => {
    if (state === "roasted" && roastText) {
      if (typedRoast === roastText) return;
      
      let currentIdx = 0;
      setTypedRoast("");
      const intervalId = setInterval(() => {
        setTypedRoast((prev) => {
          const next = roastText.slice(0, currentIdx + 1);
          currentIdx++;
          if (currentIdx >= roastText.length) {
            clearInterval(intervalId);
          }
          return next;
        });
      }, 10);
      return () => clearInterval(intervalId);
    }
  }, [state, roastText]);

  // Loading sequence effect
  useEffect(() => {
    if (state === "loading") {
      const interval = setInterval(() => {
        setLoadingStep(s => (s + 1) % 3);
      }, 2000);
      return () => clearInterval(interval);
    } else {
      setLoadingStep(0);
    }
  }, [state]);

  const scoreMatch = roastText.match(new RegExp("\\*\\*Impact Score:\\s*(\\d+(?:\\.\\d+)?)/100\\*\\*", "i")) 
                  || roastText.match(new RegExp("Impact Score:\\s*(\\d+(?:\\.\\d+)?)/100", "i"));
  const impactScore = scoreMatch ? scoreMatch[1] : "?";
  const cleanedRoastText = typedRoast.replace(new RegExp("\\*\\*Impact Score:\\s*\\d+(?:\\.\\d+)?/100\\*\\*", "i"), "");

  const parsedScore = parseFloat(impactScore) || 0;
  let reactionEmoji = "";
  let reactionAnim: any = {};
  let scoreShadow = "0 0 20px rgba(255,255,255,0.2)";

  if (impactScore !== "?") {
    if (parsedScore <= 20) {
      reactionEmoji = "💀";
      reactionAnim = { x: [-10, 10, -10, 10, 0] };
      scoreShadow = "0 0 40px rgba(220,38,38,0.8)";
    } else if (parsedScore <= 50) {
      reactionEmoji = "😂";
      reactionAnim = { y: [0, -30, 0] };
      scoreShadow = "0 0 20px rgba(255,255,255,0.5)";
    } else if (parsedScore <= 75) {
      reactionEmoji = "😬";
      reactionAnim = { rotate: [-10, 10, -10, 10, 0] };
      scoreShadow = "0 0 20px rgba(255,255,255,0.5)";
    } else {
      reactionEmoji = "😎";
      reactionAnim = { scale: [1, 1.2, 1] };
      scoreShadow = "0 0 50px rgba(250,204,21,1)";
    }
  }

  const handleFile = async (file: File, type: "resume" | "jd") => {
    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }
    
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        fullText += strings.join(" ") + "\n";
      }
      
      if (type === "resume") {
        setResumeText(fullText);
        setResumeName(file.name);
        setResumeMode("pdf");
      } else {
        setJdText(fullText);
        setJdName(file.name);
        setJdMode("pdf");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to parse PDF.");
    }
  };

  const processData = async () => {
    const isReady = resumeText.trim().length > 10;
    if (!isReady) return;
    
    setState("loading");
    setTypedRoast("");
    setLoadingStep(0);

    const actualRole = targetRole === "Other" ? customRole.trim() : targetRole;
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          resumeText,
          jdText: jdText.trim().length > 10 ? jdText : null, 
          intensity,
          targetRole: actualRole
        }),
      });
      const data = await res.json();
      
      if (res.status === 429 || data.error === "RATE_LIMIT") {
        setState("queue");
        return;
      }
      if (data.error) throw new Error(data.error);
      
      setRoastText(data.text);
      setState("roasted");
    } catch (err: any) {
      alert("Failed to process: " + err.message);
      setState("idle");
    }
  };

  const handleShare = async () => {
    const node = document.getElementById("roast-capture");
    if (!node) return;
    try {
      const dataUrl = await htmlToImage.toPng(node, { backgroundColor: "#000000", pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = "my-hologram-roast.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      alert("Failed to generate image.");
      console.error(err);
    }
  };

  const handleFixIt = async () => {
    setState("fixing");
    const actualRole = targetRole === "Other" ? customRole.trim() : targetRole;
    try {
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jdText, dreamJob: actualRole })
      });
      const data = await res.json();
      if (data.error || !data.id) throw new Error(data.error || "Failed to create order");
      const { id } = data;

      // Save the pending order ID to localStorage
      localStorage.setItem("pending_order_id", id);

      // Redirect to manual Razorpay Payment Link
      window.location.href = "https://rzp.io/rzp/ZGnECyZ";
    } catch (err: any) {
      alert("Error initiating payment: " + err.message);
      setState("roasted");
    }
  };

  const containerVariants: any = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.15 } } };
  const itemVariants: any = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } };
  const loadingStates = [
    { emoji: "👀", text: "Scanning your sad bullet points...", animate: { y: [0, -15, 0] }, transition: { repeat: Infinity, duration: 0.8 } },
    { emoji: "📝", text: "Comparing to the Job Description...", animate: { rotate: [0, -20, 20, -20, 0] }, transition: { repeat: Infinity, duration: 0.5 } },
    { emoji: "😈", text: "Preparing to destroy your self-esteem...", animate: { scale: [1, 1.2, 1] }, transition: { repeat: Infinity, duration: 1 } },
  ];

  const roles = ["Software Engineer", "Data Analyst", "Product Manager", "Marketing", "Design", "Finance", "Other"];
  const actualRole = targetRole === "Other" ? customRole.trim() : targetRole;
  const isReady = resumeText.trim().length > 10 && actualRole.length > 0;

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col items-center py-16 px-4 font-sans overflow-hidden relative">
      
      {/* 1. THE BREATHING BACKGROUND & SCATTERED EMOJIS — CSS-only for performance */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-50">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-900/30 blur-[80px] animate-[drift1_20s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[70%] rounded-full bg-purple-900/20 blur-[80px] animate-[drift2_25s_ease-in-out_infinite]" />
        <div className="absolute top-[20%] left-[10%] text-5xl opacity-30 animate-[float_6s_ease-in-out_infinite]">💀</div>
        <div className="absolute top-[60%] right-[15%] text-6xl opacity-20 animate-[float_8s_ease-in-out_infinite_1s]">🔥</div>
        <div className="absolute bottom-[20%] left-[20%] text-5xl opacity-30 animate-[float_5s_ease-in-out_infinite_0.5s]">📉</div>
      </div>

      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="w-full max-w-5xl flex flex-col items-center relative z-10">
        
        <motion.div initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: 1, ease: "easeOut" }} className="flex items-center justify-center gap-6 mb-12">
          <motion.div animate={{ scale: [1, 1.1, 1], rotate: [-5, 5, -5] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="text-6xl md:text-7xl drop-shadow-[0_0_30px_rgba(255,0,0,0.5)]">👹</motion.div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">RoastMyResume.ai</h1>
        </motion.div>

        {state === "idle" && (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full flex flex-col items-center">
            
            {/* TARGET ROLE DROPDOWN */}
            <motion.div variants={itemVariants} className="w-full max-w-md mb-8 flex flex-col items-center">
              <label className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-3">What are you applying for?</label>
              <select 
                value={targetRole} 
                onChange={(e) => setTargetRole(e.target.value)}
                className={`w-full bg-gray-900/80 border border-white/20 rounded-xl p-4 outline-none focus:border-cyan-500 transition-colors appearance-none text-center font-bold text-lg cursor-pointer ${targetRole ? 'text-white' : 'text-gray-500'}`}
              >
                <option value="" disabled className="bg-gray-900">Select your target role...</option>
                {roles.map(r => <option key={r} value={r} className="bg-gray-900">{r}</option>)}
              </select>
            </motion.div>

            {/* CUSTOM ROLE INPUT */}
            {targetRole === "Other" && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md mb-8 flex flex-col items-center"
              >
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="Enter your dream job title..."
                  className="w-full bg-gray-900/80 border border-white/20 text-white rounded-xl p-4 outline-none focus:border-cyan-500 transition-all text-center font-bold text-lg placeholder-gray-600 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                />
              </motion.div>
            )}

            {/* Intensity Selector */}
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row gap-4 w-full max-w-3xl justify-center mb-12">
              {[
                { id: "soft", label: "Soft", color: "green" },
                { id: "nuclear", label: "Nuclear", color: "orange" },
                { id: "ender", label: "Ender", color: "red" },
              ].map((opt) => {
                const isSelected = intensity === opt.id;
                const glowColors: any = { green: "rgba(34, 197, 94, 0.5)", orange: "rgba(249, 115, 22, 0.5)", red: "rgba(239, 68, 68, 0.5)" };
                return (
                  <motion.button
                    key={opt.id} onClick={() => setIntensity(opt.id as any)}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    animate={{
                      borderColor: isSelected ? glowColors[opt.color].replace("0.5", "1") : "rgba(255,255,255,0.1)",
                      boxShadow: isSelected ? `0 0 20px ${glowColors[opt.color]}` : "0 0 0px rgba(0,0,0,0)",
                      backgroundColor: isSelected ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.5)",
                      color: isSelected ? "#fff" : "#9ca3af"
                    }}
                    className="flex-1 py-4 px-6 border-2 rounded-xl text-sm font-bold uppercase tracking-widest transition-colors"
                  >
                    {opt.label}
                  </motion.button>
                );
              })}
            </motion.div>

            {/* Upload Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl mb-12">
              
              {/* Resume Card */}
              <motion.div variants={itemVariants} className="w-full flex flex-col">
                <div className="flex bg-white/5 rounded-t-xl border border-white/10 border-b-0 overflow-hidden text-sm font-bold uppercase tracking-wider">
                  <button onClick={() => setResumeMode("pdf")} className={`flex-1 py-3 transition-colors ${resumeMode === "pdf" ? "bg-white/10 text-cyan-400" : "text-gray-500 hover:bg-white/5"}`}>Upload PDF</button>
                  <button onClick={() => setResumeMode("text")} className={`flex-1 py-3 transition-colors ${resumeMode === "text" ? "bg-white/10 text-cyan-400" : "text-gray-500 hover:bg-white/5"}`}>Paste Text</button>
                </div>
                
                {resumeMode === "pdf" ? (
                  <>
                    <input type="file" accept=".pdf" className="hidden" ref={resumeInputRef} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], "resume")} />
                    <TiltCard
                      onClick={() => resumeInputRef.current?.click()}
                      onDragOver={(e: any) => { e.preventDefault(); setIsDraggingResume(true); }}
                      onDragLeave={() => setIsDraggingResume(false)}
                      onDrop={(e: any) => { e.preventDefault(); setIsDraggingResume(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], "resume"); }}
                      isLocked={!!resumeName}
                      borderClass={isDraggingResume ? 'border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.4)]' : 'rounded-t-none'}
                    >
                      <AnimatePresence mode="wait">
                        {resumeName ? (
                          <motion.div key="locked" initial={{ opacity: 0, scale: 0.5, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.5 }} className="flex flex-col items-center">
                            <div className="mb-4 p-4 rounded-full bg-green-500/20 text-green-400"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">Target Locked</h3>
                            <p className="text-green-400 font-mono text-sm truncate max-w-full px-4">{resumeName}</p>
                          </motion.div>
                        ) : (
                          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                            <div className="mb-4 p-4 rounded-full bg-white/5 border border-white/10 text-gray-400"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">Upload Resume</h3>
                            <p className="text-gray-500 text-xs font-semibold tracking-wider uppercase">Click or Drag PDF</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </TiltCard>
                  </>
                ) : (
                  <div className="h-64 relative bg-gray-950/90 border border-white/10 border-t-0 rounded-b-2xl p-4 flex flex-col">
                    <textarea 
                      value={resumeText} onChange={(e) => setResumeText(e.target.value)}
                      placeholder="Paste your entire resume text here..."
                      className="w-full h-full bg-transparent text-white placeholder-gray-600 focus:outline-none resize-none custom-scrollbar p-2"
                    />
                  </div>
                )}
              </motion.div>

              {/* JD Card */}
              <motion.div variants={itemVariants} className="w-full flex flex-col">
                <div className="flex bg-white/5 rounded-t-xl border border-white/10 border-b-0 overflow-hidden text-sm font-bold uppercase tracking-wider">
                  <button onClick={() => setJdMode("pdf")} className={`flex-1 py-3 transition-colors ${jdMode === "pdf" ? "bg-white/10 text-cyan-400" : "text-gray-500 hover:bg-white/5"}`}>Upload PDF</button>
                  <button onClick={() => setJdMode("text")} className={`flex-1 py-3 transition-colors ${jdMode === "text" ? "bg-white/10 text-cyan-400" : "text-gray-500 hover:bg-white/5"}`}>Paste Text</button>
                </div>

                {jdMode === "pdf" ? (
                  <>
                    <input type="file" accept=".pdf" className="hidden" ref={jdInputRef} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], "jd")} />
                    <TiltCard
                      onClick={() => jdInputRef.current?.click()}
                      onDragOver={(e: any) => { e.preventDefault(); setIsDraggingJd(true); }}
                      onDragLeave={() => setIsDraggingJd(false)}
                      onDrop={(e: any) => { e.preventDefault(); setIsDraggingJd(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], "jd"); }}
                      isLocked={!!jdName}
                      borderClass={isDraggingJd ? 'border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.4)]' : 'rounded-t-none'}
                    >
                      <AnimatePresence mode="wait">
                        {jdName ? (
                          <motion.div key="locked-jd" initial={{ opacity: 0, scale: 0.5, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.5 }} className="flex flex-col items-center">
                            <div className="mb-4 p-4 rounded-full bg-green-500/20 text-green-400"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">JD Locked</h3>
                            <p className="text-green-400 font-mono text-sm truncate max-w-full px-4">{jdName}</p>
                          </motion.div>
                        ) : (
                          <motion.div key="empty-jd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center w-full">
                            <div className="mb-4 p-4 rounded-full bg-white/5 border border-white/10 text-gray-400"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div>
                            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">Job Description</h3>
                            <p className="text-gray-500 text-xs font-semibold tracking-wider uppercase">Optional PDF</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </TiltCard>
                  </>
                ) : (
                  <div className="h-64 relative bg-gray-950/90 border border-white/10 border-t-0 rounded-b-2xl p-4 flex flex-col">
                    <textarea 
                      value={jdText} onChange={(e) => setJdText(e.target.value)}
                      placeholder="Paste Job Description text here (Optional)..."
                      className="w-full h-full bg-transparent text-white placeholder-gray-600 focus:outline-none resize-none custom-scrollbar p-2"
                    />
                  </div>
                )}
              </motion.div>
            </div>
            
            {/* THE FIRE BUTTON */}
            <motion.div variants={itemVariants}>
              <motion.button
                onClick={processData}
                disabled={!isReady}
                whileTap={{ scale: 0.95 }}
                animate={{
                  y: isReady ? 10 : 0,
                  backgroundColor: isReady ? "rgba(239, 68, 68, 1)" : "rgba(31, 41, 55, 0.4)",
                  borderColor: isReady ? "rgba(255, 100, 100, 0.5)" : "rgba(255,255,255,0.1)",
                  boxShadow: isReady 
                    ? "0 10px 40px rgba(239, 68, 68, 0.6), inset 0 0 20px rgba(255,255,255,0.2)"
                    : "0 0 0px rgba(0,0,0,0)",
                  color: isReady ? "#fff" : "rgba(255,255,255,0.3)"
                }}
                title={!targetRole ? "Please select a target role first" : !resumeText.trim() ? "Please upload or paste your resume" : ""}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="relative text-xl font-black py-5 px-16 rounded-2xl uppercase tracking-[0.2em] transition-all border-2"
              >
                {isReady ? "Destroy My Self Esteem" : !targetRole ? "Select a Role First" : "Awaiting Resume"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {/* 2. THE THINKING / LOADING SCREEN */}
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center h-96">
            <AnimatePresence mode="wait">
              <motion.div key={loadingStep} initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: -20 }} transition={{ duration: 0.3 }} className="flex flex-col items-center text-center">
                <motion.div animate={loadingStates[loadingStep].animate as any} transition={loadingStates[loadingStep].transition as any} className="text-8xl mb-8 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                  {loadingStates[loadingStep].emoji}
                </motion.div>
                <p className="text-white text-xl md:text-3xl font-black tracking-widest uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
                  {loadingStates[loadingStep].text}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* RATE LIMIT QUEUE SCREEN */}
        {state === "queue" && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-96">
            <motion.div animate={{ rotate: [-2, 2, -2] }} transition={{ repeat: Infinity, duration: 1 }} className="text-9xl mb-8 drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]">
              🚪
            </motion.div>
            <p className="text-white text-2xl font-black tracking-widest uppercase text-center max-w-lg mb-8">
              The AI bouncer says we're at capacity. Chill for 10 seconds and try again.
            </p>
            <button 
              onClick={() => setState("idle")}
              className="bg-white text-black py-4 px-8 rounded-xl font-black tracking-widest uppercase hover:bg-gray-200 transition-colors shadow-[0_0_30px_rgba(255,255,255,0.4)]"
            >
              Try Again
            </button>
          </motion.div>
        )}

        {/* 3. THE RESULT REACTIONS */}
        <AnimatePresence>
          {(state === "roasted" || state === "fixing") && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="w-full max-w-4xl">
              <div id="roast-capture" className="bg-gray-950/95 border border-white/10 rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                
                <div className="flex flex-col md:flex-row justify-between md:items-end border-b border-white/10 pb-6 mb-8 gap-4">
                  <div>
                    <h2 className="text-xs font-bold text-gray-500 tracking-[0.3em] uppercase mb-1">Status Report</h2>
                    <p className="text-xl font-black text-white mb-2">TARGET: <span className="text-cyan-400">{targetRole.toUpperCase()}</span></p>
                    <p className="text-lg font-black text-white">THREAT LEVEL: <span className="text-red-500">{intensity.toUpperCase()}</span></p>
                  </div>
                  
                  {impactScore !== "?" && (
                    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: "spring" }} className="flex flex-col items-center md:items-end">
                      <p className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-2">Impact Score</p>
                      <div className="flex flex-col items-center gap-2">
                        <motion.div animate={reactionAnim} transition={parsedScore <= 20 ? { repeat: Infinity, duration: 0.1 } : { repeat: Infinity, duration: 1 }} className="text-7xl md:text-9xl mb-2">
                          {reactionEmoji}
                        </motion.div>
                        <p className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500" style={{ filter: `drop-shadow(${scoreShadow})` }}>
                          {impactScore}<span className="text-3xl text-gray-600">/100</span>
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
                
                <div className="prose prose-invert prose-lg max-w-none prose-headings:text-white prose-strong:text-white prose-a:text-cyan-400 mt-6">
                  <ReactMarkdown>{cleanedRoastText}</ReactMarkdown>
                </div>

                <div className="mt-16 pt-6 border-t border-white/5 flex items-center justify-between opacity-40">
                  <span className="text-xs font-bold tracking-[0.2em]">ROASTMYRESUME.AI</span>
                  <span className="text-xs font-mono">SYS.LOG.CAPTURED</span>
                </div>
              </div>

              {typedRoast.length === roastText.length && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-12 flex flex-col md:flex-row gap-6 justify-center">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={handleShare} className="py-4 px-8 rounded-xl font-bold tracking-widest uppercase border border-white/20 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Share
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={handleFixIt} disabled={state === "fixing"} className="py-4 px-8 rounded-xl font-black tracking-widest uppercase bg-white text-black hover:bg-gray-200 shadow-[0_0_30px_rgba(255,255,255,0.3)] flex items-center justify-center gap-3 disabled:opacity-50">
                    {state === "fixing" ? <span className="animate-pulse">PROCESSING...</span> : <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>OVERRIDE FOR ₹49</>}
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
        @keyframes drift1 { 0%,100% { transform: translate(0,0); } 33% { transform: translate(50px,-40px); } 66% { transform: translate(-30px,20px); } }
        @keyframes drift2 { 0%,100% { transform: translate(0,0); } 33% { transform: translate(-60px,50px); } 66% { transform: translate(40px,-30px); } }
        @keyframes drift3 { 0%,100% { transform: translate(0,0); } 33% { transform: translate(30px,30px); } 66% { transform: translate(-50px,-50px); } }
        @keyframes float { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(5deg); } }
      `}} />
    </div>
  );
}
