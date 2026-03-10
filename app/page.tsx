"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import s from "./editor.module.css";
import {
  Adjustments, defaultAdjustments,
  applyAdjustments, computeHistogram, drawHistogram,
  applyGrayscale, applySepia, applyInvert, applyCoolFilter, applyWarmFilter
} from "@/lib/imageProcessing";
import { PRESETS } from "@/lib/presets";

type Tab = "photo" | "video" | "ai";
type SubPanel = "adjust" | "presets" | "filters" | "tools" | "layers";
type ChatMsg = { role: "user"|"ai"; text: string };

interface VideoResult {
  title?: string; enhanced_prompt?: string; negative_prompt?: string;
  scenes?: { time:string; description:string; camera:string; mood:string; color_palette:string[] }[];
  technical?: { fps:number; motion_style:string; lighting:string; color_grade:string };
  sora_prompt?: string; runway_prompt?: string; pika_prompt?: string;
  tips?: string[]; error?: string;
}

const SLIDERS = [
  { key:"exposure",   label:"Exposure",   min:-100, max:100, group:"Light" },
  { key:"contrast",   label:"Contrast",   min:-100, max:100, group:"Light" },
  { key:"highlights", label:"Highlights", min:-100, max:100, group:"Light" },
  { key:"shadows",    label:"Shadows",    min:-100, max:100, group:"Light" },
  { key:"whites",     label:"Whites",     min:-100, max:100, group:"Light" },
  { key:"blacks",     label:"Blacks",     min:-100, max:100, group:"Light" },
  { key:"temp",       label:"Temp",       min:-100, max:100, group:"Color" },
  { key:"tint",       label:"Tint",       min:-100, max:100, group:"Color" },
  { key:"saturation", label:"Saturation", min:-100, max:100, group:"Color" },
  { key:"vibrance",   label:"Vibrance",   min:-100, max:100, group:"Color" },
  { key:"clarity",    label:"Clarity",    min:-100, max:100, group:"Detail" },
  { key:"dehaze",     label:"Dehaze",     min:0,    max:100, group:"Detail" },
  { key:"sharpness",  label:"Sharpness",  min:0,    max:100, group:"Detail" },
  { key:"vignette",   label:"Vignette",   min:-100, max:0,   group:"Detail" },
] as const;

const QUICK_PROMPTS = [
  "cinematic teal & orange",
  "golden hour portrait",
  "moody dramatic",
  "bright airy clean",
  "vintage film look",
  "black & white dramatic",
  "vibrant pop",
  "cool winter mood",
];

const VIDEO_STYLES = ["Cinematic","Anime","Realistic","Fantasy","Cyberpunk","Documentary","Lo-fi","Epic"];
const VIDEO_DURATIONS = [3,5,8,10,15,30];
const VIDEO_ASPECTS = ["16:9","9:16","1:1","4:3","21:9"];

export default function Editor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const histRef   = useRef<HTMLCanvasElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const originalRef = useRef<ImageData|null>(null);

  const [tab, setTab]           = useState<Tab>("photo");
  const [subPanel, setSubPanel] = useState<SubPanel>("adjust");
  const [hasImage, setHasImage] = useState(false);
  const [isDrag, setIsDrag]     = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadMsg, setLoadMsg]   = useState("");
  const [notif, setNotif]       = useState("");
  const [showNotif, setShowNotif] = useState(false);
  const [zoom, setZoom]         = useState(1);
  const [adj, setAdj]           = useState<Adjustments>({...defaultAdjustments});
  const [activePreset, setActivePreset] = useState(0);
  const [activeFilter, setActiveFilter] = useState("none");
  const [imgInfo, setImgInfo]   = useState({w:0,h:0,name:""});
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const [chat, setChat]         = useState<ChatMsg[]>([
    { role:"ai", text:"Hi! Upload a photo to edit, or switch to the Video tab to generate AI video prompts. I can help with both! ✦" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [bottomSheet, setBottomSheet] = useState(false);
  const [layers, setLayers] = useState([
    {id:1,name:"Background",type:"Image",vis:true},
    {id:2,name:"Adjustments",type:"Adjust",vis:true},
  ]);

  // Video state
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoStyle, setVideoStyle] = useState("Cinematic");
  const [videoDuration, setVideoDuration] = useState(10);
  const [videoAspect, setVideoAspect] = useState("16:9");
  const [videoResult, setVideoResult] = useState<VideoResult|null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoTab, setVideoTab] = useState<"generate"|"result"|"chat">("generate");

  const notifTimer = useRef<any>();
  const notify = useCallback((msg:string) => {
    setNotif(msg); setShowNotif(true);
    clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(()=>setShowNotif(false),2600);
  },[]);

  // ── Render ──────────────────────────────────────────────
  const render = useCallback((a:Adjustments) => {
    const c=canvasRef.current; if(!c||!originalRef.current) return;
    const ctx=c.getContext("2d")!;
    const out=applyAdjustments(originalRef.current,a,c.width,c.height);
    ctx.putImageData(out,0,0);
    if(histRef.current){const h=computeHistogram(out.data);drawHistogram(histRef.current,h);}
  },[]);

  // ── Load image ───────────────────────────────────────────
  const loadImg = useCallback((src:string, name="image") => {
    const img=new Image();
    img.onload=()=>{
      const c=canvasRef.current; if(!c) return;
      c.width=img.width; c.height=img.height;
      const ctx=c.getContext("2d")!; ctx.drawImage(img,0,0);
      originalRef.current=ctx.getImageData(0,0,img.width,img.height);
      setHasImage(true); setImgInfo({w:img.width,h:img.height,name});
      setAdj({...defaultAdjustments}); setActivePreset(0); setActiveFilter("none");
      setUndoStack([]); setRedoStack([]);
      if(histRef.current){const h=computeHistogram(originalRef.current.data);drawHistogram(histRef.current,h);}
      notify(`Loaded ${name} (${img.width}×${img.height})`);
      setTab("photo");
    };
    img.src=src;
  },[notify]);

  const handleFile = useCallback((file:File) => {
    const r=new FileReader(); r.onload=e=>loadImg(e.target?.result as string,file.name); r.readAsDataURL(file);
  },[loadImg]);

  // ── Undo/Redo ────────────────────────────────────────────
  const pushUndo = useCallback(() => {
    const c=canvasRef.current; if(!c) return;
    const ctx=c.getContext("2d")!;
    setUndoStack(p=>[...p.slice(-14),ctx.getImageData(0,0,c.width,c.height)]);
    setRedoStack([]);
  },[]);

  const undo = useCallback(() => {
    if(!undoStack.length) return;
    const c=canvasRef.current; if(!c) return;
    const ctx=c.getContext("2d")!;
    const cur=ctx.getImageData(0,0,c.width,c.height);
    setRedoStack(p=>[...p,cur]);
    ctx.putImageData(undoStack[undoStack.length-1],0,0);
    setUndoStack(p=>p.slice(0,-1)); notify("Undo ↩");
  },[undoStack,notify]);

  const redo = useCallback(() => {
    if(!redoStack.length) return;
    const c=canvasRef.current; if(!c) return;
    const ctx=c.getContext("2d")!;
    const cur=ctx.getImageData(0,0,c.width,c.height);
    setUndoStack(p=>[...p,cur]);
    ctx.putImageData(redoStack[redoStack.length-1],0,0);
    setRedoStack(p=>p.slice(0,-1)); notify("Redo ↪");
  },[redoStack,notify]);

  // ── Adjustments ──────────────────────────────────────────
  const updateAdj = useCallback((key:keyof Adjustments, val:number) => {
    setAdj(p=>{ const n={...p,[key]:val}; render(n); return n; });
  },[render]);

  const reset = useCallback(()=>{
    const a={...defaultAdjustments}; setAdj(a); setActivePreset(0); setActiveFilter("none");
    if(originalRef.current&&canvasRef.current){const ctx=canvasRef.current.getContext("2d")!;ctx.putImageData(originalRef.current,0,0);}
    notify("Reset ✓");
  },[notify]);

  // ── Preset ───────────────────────────────────────────────
  const applyPreset = useCallback((i:number)=>{
    const p=PRESETS[i]; const n={...defaultAdjustments,...p.adj};
    setAdj(n); setActivePreset(i); setActiveFilter("none"); render(n);
    notify(`Preset: ${p.name}`);
  },[render,notify]);

  // ── Filter ───────────────────────────────────────────────
  const applyFilter = useCallback((f:string)=>{
    if(!originalRef.current||!canvasRef.current) return;
    pushUndo();
    const c=canvasRef.current; const ctx=c.getContext("2d")!;
    const d=ctx.getImageData(0,0,c.width,c.height);
    if(f==="none"){ctx.putImageData(originalRef.current,0,0);render(adj);setActiveFilter("none");return;}
    if(f==="gray")applyGrayscale(d.data);
    else if(f==="sepia")applySepia(d.data);
    else if(f==="invert")applyInvert(d.data);
    else if(f==="cool")applyCoolFilter(d.data);
    else if(f==="warm")applyWarmFilter(d.data);
    ctx.putImageData(d,0,0); setActiveFilter(f); notify(`Filter: ${f}`);
  },[adj,pushUndo,render,notify]);

  // ── Export ───────────────────────────────────────────────
  const exportImg = useCallback((fmt:"png"|"jpg"|"webp")=>{
    const c=canvasRef.current; if(!c){notify("No image");return;}
    const mime=fmt==="jpg"?"image/jpeg":fmt==="webp"?"image/webp":"image/png";
    const a=document.createElement("a"); a.href=c.toDataURL(mime,.92); a.download=`lumen.${fmt}`; a.click();
    notify(`Exported ${fmt.toUpperCase()} ✓`);
  },[notify]);

  // ── AI Edit ──────────────────────────────────────────────
  const runAI = useCallback(async()=>{
    if(!aiPrompt.trim()){notify("Enter a prompt");return;}
    setIsLoading(true); setLoadMsg("Asking Claude…");
    try{
      const r=await fetch("/api/edit",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt:aiPrompt,currentAdjustments:adj})});
      const data=await r.json();
      if(data.adjustments){
        const n={...defaultAdjustments,...data.adjustments};
        setAdj(n); render(n); setActivePreset(-1);
        notify(`✦ ${data.name||"AI edit"} applied`);
        setChat(p=>[...p,{role:"user",text:aiPrompt},{role:"ai",text:`Applied: ${data.description||data.name}`}]);
      } else notify("AI error — check API key");
    }catch{notify("AI unavailable");}
    setIsLoading(false); setAiPrompt("");
  },[aiPrompt,adj,render,notify]);

  // ── AI Chat ──────────────────────────────────────────────
  const sendChat = useCallback(async()=>{
    if(!chatInput.trim()||chatLoading) return;
    const msg=chatInput.trim(); setChatInput("");
    setChat(p=>[...p,{role:"user",text:msg}]); setChatLoading(true);
    try{
      const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({messages:[...chat,{role:"user",text:msg}].map(m=>({role:m.role==="ai"?"assistant":"user",content:m.text})),
          context:hasImage?`Image: ${imgInfo.w}×${imgInfo.h} ${imgInfo.name}`:"No image"})});
      const d=await r.json();
      setChat(p=>[...p,{role:"ai",text:d.reply||"I can help with that!"}]);
    }catch{setChat(p=>[...p,{role:"ai",text:"Check your ANTHROPIC_API_KEY in Vercel settings."}]);}
    setChatLoading(false);
  },[chatInput,chatLoading,chat,hasImage,imgInfo]);

  // ── Video generation ─────────────────────────────────────
  const generateVideo = useCallback(async()=>{
    if(!videoPrompt.trim()){notify("Enter a video prompt");return;}
    setVideoLoading(true); setLoadMsg("Generating with Claude…");
    try{
      const r=await fetch("/api/video-prompt",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt:videoPrompt,style:videoStyle,duration:videoDuration,aspect:videoAspect})});
      const data=await r.json();
      setVideoResult(data); setVideoTab("result");
      notify("Video plan ready ✓");
    }catch{notify("Generation failed — check API key");}
    setVideoLoading(false); setIsLoading(false);
  },[videoPrompt,videoStyle,videoDuration,videoAspect,notify]);

  // ── Scroll chat ──────────────────────────────────────────
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[chat]);

  // ── Keyboard ─────────────────────────────────────────────
  useEffect(()=>{
    const fn=(e:KeyboardEvent)=>{
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement) return;
      if((e.metaKey||e.ctrlKey)&&e.key==="z"){e.preventDefault();undo();}
      if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key==="Z"){e.preventDefault();redo();}
      if(e.key==="+"||e.key==="=")setZoom(z=>Math.min(z*1.2,8));
      if(e.key==="-")setZoom(z=>Math.max(z/1.2,.1));
      if(e.key==="0")setZoom(1);
    };
    window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn);
  },[undo,redo]);

  // ── Drop ─────────────────────────────────────────────────
  const onDrop=(e:React.DragEvent)=>{
    e.preventDefault(); setIsDrag(false);
    const f=e.dataTransfer.files[0]; if(f&&f.type.startsWith("image/"))handleFile(f);
  };

  // ── Sample canvas gen ────────────────────────────────────
  const loadSample=(i:number)=>{
    const c=document.createElement("canvas"); c.width=800;c.height=600;
    const ctx=c.getContext("2d")!;
    const pals=[["#1a1a2e","#ff4d6d","#ff8c42"],["#0d1b2a","#1b4965","#72b5d4"],
      ["#f9c784","#e07b39","#2d1b00"],["#0f2e1a","#2d5a27","#8bc34a"]];
    const p=pals[i];
    const g=ctx.createLinearGradient(0,0,800,600);
    p.forEach((c,j)=>g.addColorStop(j/(p.length-1),c));
    ctx.fillStyle=g;ctx.fillRect(0,0,800,600);
    for(let j=0;j<12;j++){
      ctx.beginPath();ctx.arc(Math.random()*800,Math.random()*600,20+Math.random()*100,0,Math.PI*2);
      ctx.fillStyle=`rgba(255,255,255,0.04)`;ctx.fill();
    }
    loadImg(c.toDataURL(),["City Night","Ocean Blue","Golden Desert","Forest Green"][i]);
  };

  const copyText=(text:string)=>{
    navigator.clipboard.writeText(text).then(()=>notify("Copied ✓")).catch(()=>notify("Copy failed"));
  };

  const groups = ["Light","Color","Detail"];

  return (
    <div className={s.app}>
      {/* ── TOP BAR ── */}
      <header className={s.header}>
        <div className={s.logo}>
          <span className={s.logoDot}/>
          <span className={s.logoText}>LUMEN</span>
          <span className={s.logoBadge}>STUDIO</span>
        </div>
        <div className={s.headerActions}>
          {hasImage && <>
            <button className={s.iconBtn} onClick={undo} disabled={!undoStack.length} title="Undo">↩</button>
            <button className={s.iconBtn} onClick={redo} disabled={!redoStack.length} title="Redo">↪</button>
          </>}
          <button className={s.iconBtn} onClick={()=>fileRef.current?.click()} title="Upload">⤒</button>
          {hasImage && (
            <div className={s.exportMenu}>
              <button className={s.exportBtn}>↓ Export</button>
              <div className={s.exportDropdown}>
                {(["png","jpg","webp"] as const).map(f=>(
                  <button key={f} onClick={()=>exportImg(f)}>{f.toUpperCase()}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN TABS ── */}
      <div className={s.mainTabs}>
        {(["photo","video","ai"] as Tab[]).map(t=>(
          <button key={t} className={`${s.mainTab} ${tab===t?s.mainTabActive:""}`}
            onClick={()=>setTab(t)}>
            {t==="photo"?"📷 Photo":t==="video"?"🎬 Video":"✦ AI Chat"}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div className={s.content}>

        {/* ═══ PHOTO TAB ═══ */}
        {tab==="photo" && (
          <div className={s.photoLayout}>
            {/* Canvas zone */}
            <div className={s.canvasZone}
              onDragOver={e=>{e.preventDefault();setIsDrag(true);}}
              onDragLeave={()=>setIsDrag(false)}
              onDrop={onDrop}>

              {!hasImage ? (
                <div className={`${s.uploadArea} ${isDrag?s.uploadDrag:""}`}
                  onClick={()=>fileRef.current?.click()}>
                  <div className={s.uploadIcon}>📸</div>
                  <div className={s.uploadTitle}>Drop photo here</div>
                  <div className={s.uploadSub}>PNG · JPG · WEBP</div>
                  <button className={s.uploadBtn}>Choose File</button>
                  <div className={s.sampleRow}>
                    {["🌃","🌊","🏜","🌲"].map((e,i)=>(
                      <button key={i} className={s.sampleBtn} onClick={(ev)=>{ev.stopPropagation();loadSample(i);}}>{e}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={s.canvasContainer} style={{transform:`scale(${zoom})`}}>
                  <canvas ref={canvasRef} className={s.canvas}/>
                </div>
              )}

              {/* Zoom bar */}
              {hasImage && (
                <div className={s.zoomBar}>
                  <button className={s.zBtn} onClick={()=>setZoom(z=>Math.max(z/1.2,.1))}>−</button>
                  <span className={s.zVal}>{Math.round(zoom*100)}%</span>
                  <button className={s.zBtn} onClick={()=>setZoom(z=>Math.min(z*1.2,8))}>+</button>
                  <button className={s.zBtn} onClick={()=>setZoom(1)}>⊞</button>
                  <div className={s.imgMeta}>{imgInfo.w}×{imgInfo.h}</div>
                </div>
              )}
            </div>

            {/* Sub-panel tabs */}
            <div className={s.subTabs}>
              {(["adjust","presets","filters","tools","layers"] as SubPanel[]).map(p=>(
                <button key={p} className={`${s.subTab} ${subPanel===p?s.subTabActive:""}`}
                  onClick={()=>setSubPanel(p)}>
                  {p==="adjust"?"Adjust":p==="presets"?"Presets":p==="filters"?"Filters":p==="tools"?"Tools":"Layers"}
                </button>
              ))}
            </div>

            {/* Sub-panel body */}
            <div className={s.panelBody}>

              {/* ADJUST */}
              {subPanel==="adjust" && (
                <div className={s.adjustPanel}>
                  <div className={s.panelHeader}>
                    <span>Adjustments</span>
                    <button className={s.resetBtn} onClick={reset}>Reset All</button>
                  </div>
                  {/* AI Quick edit */}
                  <div className={s.aiQuickBox}>
                    <input className={s.aiInput} value={aiPrompt}
                      onChange={e=>setAiPrompt(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&runAI()}
                      placeholder="✦ AI: describe the look you want…"/>
                    <button className={s.aiRunBtn} onClick={runAI}>Go</button>
                  </div>
                  <div className={s.quickPrompts}>
                    {QUICK_PROMPTS.map(p=>(
                      <button key={p} className={s.quickChip}
                        onClick={()=>{setAiPrompt(p);}}>{p}</button>
                    ))}
                  </div>
                  {/* Sliders grouped */}
                  {groups.map(grp=>(
                    <div key={grp} className={s.sliderGroup}>
                      <div className={s.groupLabel}>{grp}</div>
                      {SLIDERS.filter(sl=>sl.group===grp).map(sl=>(
                        <div key={sl.key} className={s.sliderRow}>
                          <div className={s.sliderTop}>
                            <span className={s.sliderLabel}>{sl.label}</span>
                            <span className={s.sliderVal}
                              style={{color:adj[sl.key as keyof Adjustments]!==0?"var(--fire2)":"var(--text-3)"}}>
                              {adj[sl.key as keyof Adjustments]>0?"+":""}{adj[sl.key as keyof Adjustments]}
                            </span>
                          </div>
                          <input type="range" min={sl.min} max={sl.max}
                            value={adj[sl.key as keyof Adjustments]}
                            onChange={e=>updateAdj(sl.key as keyof Adjustments,+e.target.value)}/>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* PRESETS */}
              {subPanel==="presets" && (
                <div className={s.presetsPanel}>
                  <div className={s.panelHeader}><span>Presets</span></div>
                  <div className={s.presetsGrid}>
                    {PRESETS.map((p,i)=>(
                      <div key={i} className={`${s.presetCard} ${activePreset===i?s.presetActive:""}`}
                        onClick={()=>applyPreset(i)}>
                        <div className={s.presetSwatch}
                          style={{background:`linear-gradient(135deg,${p.colors.join(",")})`}}/>
                        <span className={s.presetEmoji}>{p.emoji}</span>
                        <span className={s.presetName}>{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FILTERS */}
              {subPanel==="filters" && (
                <div className={s.filtersPanel}>
                  <div className={s.panelHeader}><span>Instant Filters</span></div>
                  <div className={s.filterGrid}>
                    {[
                      {id:"none",    label:"Original", bg:"linear-gradient(135deg,#667eea,#764ba2)"},
                      {id:"gray",    label:"B&W",       bg:"linear-gradient(135deg,#2c3e50,#bdc3c7)"},
                      {id:"sepia",   label:"Sepia",     bg:"linear-gradient(135deg,#8b7355,#d4a96a)"},
                      {id:"warm",    label:"Warm",      bg:"linear-gradient(135deg,#f7971e,#ffd200)"},
                      {id:"cool",    label:"Cool",      bg:"linear-gradient(135deg,#6ee7ff,#4facfe)"},
                      {id:"invert",  label:"Invert",    bg:"linear-gradient(135deg,#2c3e50,#fd746c)"},
                    ].map(f=>(
                      <div key={f.id}
                        className={`${s.filterCard} ${activeFilter===f.id?s.filterActive:""}`}
                        onClick={()=>applyFilter(f.id)}>
                        <div className={s.filterSwatch} style={{background:f.bg}}/>
                        <span className={s.filterName}>{f.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className={s.panelHeader} style={{marginTop:16}}><span>Histogram</span></div>
                  <div className={s.histWrap}>
                    <canvas ref={histRef} width={280} height={60} className={s.histCanvas}/>
                  </div>
                </div>
              )}

              {/* TOOLS */}
              {subPanel==="tools" && (
                <div className={s.toolsPanel}>
                  <div className={s.panelHeader}><span>Transform</span></div>
                  <div className={s.toolGrid}>
                    <button className={s.toolCard} onClick={()=>{if(canvasRef.current){
                      pushUndo();
                      const c=canvasRef.current,ctx=c.getContext("2d")!;
                      const tmp=document.createElement("canvas");tmp.width=c.height;tmp.height=c.width;
                      const tc=tmp.getContext("2d")!;tc.translate(c.height/2,c.width/2);tc.rotate(Math.PI/2);
                      tc.drawImage(c,-c.width/2,-c.height/2);c.width=tmp.width;c.height=tmp.height;
                      ctx.drawImage(tmp,0,0);
                      originalRef.current=ctx.getImageData(0,0,c.width,c.height);
                      notify("Rotated 90° ↻");
                    }}}>↻ Rotate 90°</button>
                    <button className={s.toolCard} onClick={()=>{if(canvasRef.current){
                      pushUndo();
                      const c=canvasRef.current,ctx=c.getContext("2d")!;
                      const tmp=document.createElement("canvas");tmp.width=c.width;tmp.height=c.height;
                      const tc=tmp.getContext("2d")!;tc.translate(c.width,0);tc.scale(-1,1);
                      tc.drawImage(c,0,0);ctx.drawImage(tmp,0,0);
                      originalRef.current=ctx.getImageData(0,0,c.width,c.height);
                      notify("Flipped ↔");
                    }}}>⇔ Flip H</button>
                    <button className={s.toolCard} onClick={()=>{if(canvasRef.current){
                      pushUndo();
                      const c=canvasRef.current,ctx=c.getContext("2d")!;
                      const tmp=document.createElement("canvas");tmp.width=c.width;tmp.height=c.height;
                      const tc=tmp.getContext("2d")!;tc.translate(0,c.height);tc.scale(1,-1);
                      tc.drawImage(c,0,0);ctx.drawImage(tmp,0,0);
                      originalRef.current=ctx.getImageData(0,0,c.width,c.height);
                      notify("Flipped ↕");
                    }}}>↕ Flip V</button>
                    <button className={s.toolCard} onClick={()=>{if(canvasRef.current){
                      pushUndo();const c=canvasRef.current,ctx=c.getContext("2d")!;
                      const d=ctx.getImageData(0,0,c.width,c.height);applyGrayscale(d.data);ctx.putImageData(d,0,0);
                      originalRef.current=ctx.getImageData(0,0,c.width,c.height);notify("B&W applied");
                    }}}>◑ B&W</button>
                    <button className={s.toolCard} onClick={reset}>⟳ Reset All</button>
                    <button className={s.toolCard} onClick={()=>exportImg("png")}>↓ PNG</button>
                    <button className={s.toolCard} onClick={()=>exportImg("jpg")}>↓ JPG</button>
                    <button className={s.toolCard} onClick={()=>exportImg("webp")}>↓ WEBP</button>
                  </div>

                  <div className={s.panelHeader} style={{marginTop:16}}><span>Image Info</span></div>
                  <div className={s.infoTable}>
                    <div className={s.infoRow}><span>File</span><span>{imgInfo.name||"—"}</span></div>
                    <div className={s.infoRow}><span>Size</span><span>{imgInfo.w>0?`${imgInfo.w}×${imgInfo.h}px`:"—"}</span></div>
                    <div className={s.infoRow}><span>Zoom</span><span>{Math.round(zoom*100)}%</span></div>
                    <div className={s.infoRow}><span>Undos</span><span>{undoStack.length}</span></div>
                  </div>
                </div>
              )}

              {/* LAYERS */}
              {subPanel==="layers" && (
                <div className={s.layersPanel}>
                  <div className={s.panelHeader}>
                    <span>Layers</span>
                    <button className={s.resetBtn}
                      onClick={()=>{setLayers(l=>[{id:Date.now(),name:"New Layer",type:"Empty",vis:true},...l]);notify("Layer added");}}>
                      + Add
                    </button>
                  </div>
                  {layers.map((l,i)=>(
                    <div key={l.id} className={`${s.layerItem} ${i===0?s.layerActive:""}`}>
                      <div className={s.layerThumb}
                        style={{background:i===0?"var(--fire-soft)":"var(--surface2)"}}/>
                      <div className={s.layerInfo}>
                        <div className={s.layerName}>{l.name}</div>
                        <div className={s.layerType}>{l.type}</div>
                      </div>
                      <button className={s.layerEye}
                        onClick={()=>setLayers(ls=>ls.map(ll=>ll.id===l.id?{...ll,vis:!ll.vis}:ll))}>
                        {l.vis?"👁":"·"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ VIDEO TAB ═══ */}
        {tab==="video" && (
          <div className={s.videoLayout}>
            <div className={s.videoSubTabs}>
              <button className={`${s.videoSubTab} ${videoTab==="generate"?s.videoSubTabActive:""}`}
                onClick={()=>setVideoTab("generate")}>Generate</button>
              <button className={`${s.videoSubTab} ${videoTab==="result"?s.videoSubTabActive:""}`}
                onClick={()=>setVideoTab("result")} disabled={!videoResult}>
                {videoResult?"📋 Plan":"Plan"}
              </button>
              <button className={`${s.videoSubTab} ${videoTab==="chat"?s.videoSubTabActive:""}`}
                onClick={()=>setVideoTab("chat")}>Chat</button>
            </div>

            {/* Generate form */}
            {videoTab==="generate" && (
              <div className={s.videoGenPanel}>
                <div className={s.videoHero}>
                  <div className={s.videoHeroIcon}>🎬</div>
                  <div className={s.videoHeroTitle}>AI Video Creator</div>
                  <div className={s.videoHeroSub}>Generate detailed prompts for Sora, Runway & Pika</div>
                </div>

                <div className={s.formSection}>
                  <label className={s.formLabel}>Describe your video</label>
                  <textarea className={s.videoPromptTA}
                    value={videoPrompt}
                    onChange={e=>setVideoPrompt(e.target.value)}
                    placeholder="A lone astronaut walks across a crimson Mars landscape, dust storms swirling in the distance, golden light from twin suns casting long shadows…"
                    rows={4}/>
                </div>

                <div className={s.formSection}>
                  <label className={s.formLabel}>Visual Style</label>
                  <div className={s.styleGrid}>
                    {VIDEO_STYLES.map(st=>(
                      <button key={st}
                        className={`${s.styleChip} ${videoStyle===st?s.styleChipActive:""}`}
                        onClick={()=>setVideoStyle(st)}>{st}</button>
                    ))}
                  </div>
                </div>

                <div className={s.formRow}>
                  <div className={s.formSection} style={{flex:1}}>
                    <label className={s.formLabel}>Duration</label>
                    <div className={s.durGrid}>
                      {VIDEO_DURATIONS.map(d=>(
                        <button key={d}
                          className={`${s.durChip} ${videoDuration===d?s.durChipActive:""}`}
                          onClick={()=>setVideoDuration(d)}>{d}s</button>
                      ))}
                    </div>
                  </div>
                  <div className={s.formSection} style={{flex:1}}>
                    <label className={s.formLabel}>Aspect Ratio</label>
                    <div className={s.aspectGrid}>
                      {VIDEO_ASPECTS.map(a=>(
                        <button key={a}
                          className={`${s.aspectChip} ${videoAspect===a?s.aspectChipActive:""}`}
                          onClick={()=>setVideoAspect(a)}>{a}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={s.videoInspire}>
                  <div className={s.formLabel}>Quick ideas</div>
                  <div className={s.inspireGrid}>
                    {[
                      "Ocean waves at golden hour, slow motion",
                      "Cyberpunk city at night, neon rain",
                      "Cherry blossoms falling in slow motion",
                      "A dragon flying over mountain peaks",
                      "Abstract liquid color art morphing",
                      "Timelapse of clouds over a city",
                    ].map(idea=>(
                      <button key={idea} className={s.inspireChip}
                        onClick={()=>setVideoPrompt(idea)}>{idea}</button>
                    ))}
                  </div>
                </div>

                <button className={s.generateBtn}
                  onClick={generateVideo} disabled={videoLoading||!videoPrompt.trim()}>
                  {videoLoading ? <><span className={s.btnSpinner}/>Generating…</> : "✦ Generate Video Plan"}
                </button>
              </div>
            )}

            {/* Result */}
            {videoTab==="result" && videoResult && (
              <div className={s.videoResult}>
                {videoResult.error ? (
                  <div className={s.errorBox}>Error: {videoResult.error}<br/>Check your ANTHROPIC_API_KEY.</div>
                ) : <>
                  <div className={s.resultTitle}>{videoResult.title}</div>

                  {videoResult.scenes && (
                    <div className={s.resultSection}>
                      <div className={s.resultSectionTitle}>🎬 Storyboard</div>
                      {videoResult.scenes.map((sc,i)=>(
                        <div key={i} className={s.sceneCard}>
                          <div className={s.sceneTime}>{sc.time}</div>
                          <div className={s.sceneBody}>
                            <div className={s.sceneDesc}>{sc.description}</div>
                            <div className={s.sceneMeta}>
                              <span>📷 {sc.camera}</span>
                              <span>🌟 {sc.mood}</span>
                            </div>
                            <div className={s.scenePalette}>
                              {sc.color_palette?.map((c,j)=>(
                                <div key={j} className={s.paletteDot}
                                  style={{background:c}} title={c}/>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {videoResult.technical && (
                    <div className={s.resultSection}>
                      <div className={s.resultSectionTitle}>⚙️ Technical</div>
                      <div className={s.techGrid}>
                        <div className={s.techItem}><span>FPS</span><strong>{videoResult.technical.fps}</strong></div>
                        <div className={s.techItem}><span>Motion</span><strong>{videoResult.technical.motion_style}</strong></div>
                        <div className={s.techItem}><span>Lighting</span><strong>{videoResult.technical.lighting}</strong></div>
                        <div className={s.techItem}><span>Grade</span><strong>{videoResult.technical.color_grade}</strong></div>
                      </div>
                    </div>
                  )}

                  {[
                    {label:"✦ Enhanced Prompt", text:videoResult.enhanced_prompt},
                    {label:"⊘ Negative Prompt", text:videoResult.negative_prompt},
                    {label:"🔲 Sora Prompt", text:videoResult.sora_prompt},
                    {label:"🎥 Runway Gen-3", text:videoResult.runway_prompt},
                    {label:"⚡ Pika Prompt", text:videoResult.pika_prompt},
                  ].map(p=>p.text&&(
                    <div key={p.label} className={s.resultSection}>
                      <div className={s.resultSectionTitle}>{p.label}</div>
                      <div className={s.promptBlock}>
                        <p className={s.promptText}>{p.text}</p>
                        <button className={s.copyBtn} onClick={()=>copyText(p.text!)}>Copy</button>
                      </div>
                    </div>
                  ))}

                  {videoResult.tips && (
                    <div className={s.resultSection}>
                      <div className={s.resultSectionTitle}>💡 Tips</div>
                      {videoResult.tips.map((t,i)=>(
                        <div key={i} className={s.tipItem}>→ {t}</div>
                      ))}
                    </div>
                  )}
                </>}
              </div>
            )}

            {/* Chat in video tab */}
            {videoTab==="chat" && (
              <div className={s.chatPanel}>
                <div className={s.chatMessages}>
                  {chat.map((m,i)=>(
                    <div key={i} className={`${s.chatBubble} ${m.role==="ai"?s.chatAi:s.chatUser}`}>
                      {m.role==="ai"&&<div className={s.chatLabel}>LUMEN AI</div>}
                      {m.text}
                    </div>
                  ))}
                  {chatLoading&&<div className={`${s.chatBubble} ${s.chatAi}`}><div className={s.chatLabel}>LUMEN AI</div><span className={s.dots}>···</span></div>}
                  <div ref={chatEndRef}/>
                </div>
                <div className={s.chatInputRow}>
                  <input className={s.chatInput} value={chatInput}
                    onChange={e=>setChatInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&sendChat()}
                    placeholder="Ask about video creation…"/>
                  <button className={s.chatSendBtn} onClick={sendChat} disabled={chatLoading}>▶</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ AI CHAT TAB ═══ */}
        {tab==="ai" && (
          <div className={s.aiLayout}>
            <div className={s.aiHeader}>
              <div className={s.aiHeaderIcon}>✦</div>
              <div className={s.aiHeaderText}>
                <div className={s.aiHeaderTitle}>LUMEN AI</div>
                <div className={s.aiHeaderSub}>Your creative assistant</div>
              </div>
              <div className={s.aiBadge}>LIVE</div>
            </div>

            <div className={s.chatMessages}>
              {chat.map((m,i)=>(
                <div key={i} className={`${s.chatBubble} ${m.role==="ai"?s.chatAi:s.chatUser}`}>
                  {m.role==="ai"&&<div className={s.chatLabel}>LUMEN AI</div>}
                  {m.text}
                </div>
              ))}
              {chatLoading&&<div className={`${s.chatBubble} ${s.chatAi}`}>
                <div className={s.chatLabel}>LUMEN AI</div>
                <span className={s.dots}>···</span>
              </div>}
              <div ref={chatEndRef}/>
            </div>

            <div className={s.aiSuggestions}>
              {["How do I make portraits look professional?","Best settings for landscape photography?","What is color grading?","Tips for editing in golden hour?"].map(q=>(
                <button key={q} className={s.suggChip} onClick={()=>{setChatInput(q);}}>{q}</button>
              ))}
            </div>

            <div className={s.chatInputRow}>
              <input className={s.chatInput} value={chatInput}
                onChange={e=>setChatInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&sendChat()}
                placeholder="Ask anything about photo & video editing…"/>
              <button className={s.chatSendBtn} onClick={sendChat} disabled={chatLoading}>▶</button>
            </div>
          </div>
        )}
      </div>

      {/* ── LOADING OVERLAY ── */}
      {isLoading && (
        <div className={s.loadingOverlay}>
          <div className={s.loadingCard}>
            <div className={s.loadSpinner}/>
            <div className={s.loadText}>{loadMsg}</div>
            <div className={s.loadSub}>Powered by Claude</div>
          </div>
        </div>
      )}

      {/* ── NOTIFICATION ── */}
      <div className={`${s.notif} ${showNotif?s.notifShow:""}`}>{notif}</div>

      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);e.target.value="";}}/>
    </div>
  );
}
