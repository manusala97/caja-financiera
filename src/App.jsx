import { useState, useCallback, useMemo, useEffect, useRef, Fragment } from "react";
import { createClient } from "@supabase/supabase-js";


const SB = createClient(
  "https://aauyrjwytyxabjxyaech.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhdXlyand5dHl4YWJqeHlhZWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDc2MzcsImV4cCI6MjA4ODQyMzYzN30.KgsY8Oyn17eZrxHODj5jDXba-XrGx1H1bSh68jlSmmw"
);

const MONEDAS = [
  { id:"USD",  simbolo:"$",  color:"#4ade80", label:"Dolares" },
  { id:"ARS",  simbolo:"$",  color:"#f59e0b", label:"Pesos"   },
  { id:"BRL",  simbolo:"R$", color:"#34d399", label:"Reales"  },
  { id:"GBP",  simbolo:"£",  color:"#a78bfa", label:"Libras"  },
  { id:"EUR",  simbolo:"€",  color:"#60a5fa", label:"Euros"   },
  { id:"USDT", simbolo:"T",  color:"#2dd4bf", label:"USDT"    },
];

const TIPOS_OP = {
  compra:             { label:"Compra",               icon:"+", color:"#4ade80" },
  venta:              { label:"Venta",                icon:"-", color:"#f87171" },
  cheque_dia:         { label:"Cheque al dia",        icon:"C", color:"#fb923c" },
  cheque_dif:         { label:"Cheque diferido",      icon:"D", color:"#c084fc" },
  transferencia:      { label:"Transferencia",        icon:"T", color:"#38bdf8" },
  ajuste:             { label:"Ajuste",               icon:"A", color:"#9ca3af" },
  cobro_dif:          { label:"Cobro diferido",       icon:"C", color:"#c084fc" },
  cc_ingreso_transf:  { label:"CC Transf recibida",  icon:"+", color:"#34d399" },
  cc_ingreso_dep:     { label:"CC Deposito recibido",icon:"+", color:"#34d399" },
  cc_retiro_transf:   { label:"CC Transf enviada",   icon:"-", color:"#38bdf8" },
  cc_retiro_efectivo: { label:"CC Retiro efectivo",  icon:"-", color:"#f97316" },
};

const parse = (v) => {
  if (v===""||v===null||v===undefined) return 0;
  const s=String(v);
  if (s.includes(",")) return parseFloat(s.replace(/\./g,"").replace(",","."))||0;
  const dots=(s.match(/\./g)||[]).length;
  if (dots>1) return parseFloat(s.replace(/\./g,""))||0;
  return parseFloat(s)||0;
};
const fmt = (n) => {
  const num=typeof n==="string"?parse(n):(n||0);
  return Math.abs(num)>=1000
    ? num.toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:2})
    : num.toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:4});
};
const fmtUSD = (n) => "USD "+fmt(n);
const diasEntre = (a,b) => { if(!a||!b) return 0; return Math.max(0,Math.round((new Date(b)-new Date(a))/86400000)); };
const sumarDiasHabiles = (fechaStr, dias) => {
  if(!fechaStr) return "";
  let d = new Date(fechaStr+"T12:00:00");
  let agregados = 0;
  while(agregados < dias) {
    d.setDate(d.getDate()+1);
    const dow = d.getDay(); // 0=dom, 6=sab
    if(dow !== 0 && dow !== 6) agregados++;
  }
  return d.toISOString().split("T")[0];
};
// Siempre usar horario Argentina (UTC-3) - funcion para calcular siempre fresco
const getHoy = () => {
  const ar = new Date(new Date().toLocaleString("en-US", {timeZone:"America/Argentina/Buenos_Aires"}));
  return ar.getFullYear()+"-"+String(ar.getMonth()+1).padStart(2,"0")+"-"+String(ar.getDate()).padStart(2,"0");
};
const ahoraAR = new Date(new Date().toLocaleString("en-US", {timeZone:"America/Argentina/Buenos_Aires"}));
const hoy = getHoy();
const fechaLarga = ahoraAR.toLocaleDateString("es-AR",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
const fmtFecha = (f) => f ? new Date(f+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short",year:"numeric",month:"short",day:"numeric"}) : "";

function calcTotalUSD(saldos, cotiz) {
  // ARS: cotiz es cuantos pesos vale 1 USD → dividimos
  // BRL, EUR, GBP: cotiz es cuantos USD vale 1 unidad → multiplicamos
  // USDT: 1:1 con USD
  let total = parse(saldos.USD||0);
  total += parse(saldos.ARS||0) / (parse(cotiz.ARS)||1);
  total += parse(saldos.BRL||0) * (parse(cotiz.BRL)||0);
  total += parse(saldos.GBP||0) * (parse(cotiz.GBP)||0);
  total += parse(saldos.EUR||0) * (parse(cotiz.EUR)||0);
  total += parse(saldos.USDT||0); // 1:1
  return total;
}

const S = {
  app:   { minHeight:"100vh", background:"#060810", color:"#cbd5e1", fontFamily:"'Inter',system-ui,sans-serif", fontSize:13 },
  nav:   { background:"#060810", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"0 20px", display:"flex", gap:1, overflowX:"auto", alignItems:"center", height:56, position:"sticky", top:0, zIndex:100, backdropFilter:"blur(20px)" },
  main:  { maxWidth:1320, margin:"0 auto", padding:"28px 20px 100px" },
  card:  { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:20 },
  inp:   (x={}) => ({ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"10px 14px", color:"#e2e8f0", fontFamily:"inherit", fontSize:13, outline:"none", boxSizing:"border-box", transition:"border-color .2s, background .2s", ...x }),
  lbl:   { display:"block", fontSize:10, letterSpacing:1.5, color:"#64748b", textTransform:"uppercase", marginBottom:5, fontWeight:600 },
  btn:   (on,c="#34d399") => ({ padding:"7px 15px", borderRadius:8, border:"1px solid", borderColor:on?c+"99":"rgba(255,255,255,0.08)", background:on?"rgba("+hexToRgb(c)+",0.12)":"transparent", color:on?c:"#475569", fontFamily:"inherit", fontSize:11, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", transition:"all .2s" }),
  grid:  (cols,gap=12) => ({ display:"grid", gridTemplateColumns:cols, gap }),
  toast: (ok) => ({ position:"fixed", bottom:24, right:24, zIndex:9999, background:ok?"rgba(5,46,22,0.95)":"rgba(28,5,5,0.95)", border:"1px solid "+(ok?"#34d39966":"#f43f5e66"), color:ok?"#34d399":"#f87171", padding:"12px 20px", borderRadius:12, fontSize:13, fontWeight:600, boxShadow:"0 20px 60px #00000099", backdropFilter:"blur(20px)" }),
};

function hexToRgb(hex) {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return r+","+g+","+b;
}

// Inject global styles
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    body { background: #060810; }
    ::-webkit-scrollbar { width: 3px; height: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
    select option { background: #0d1117; }
    input:focus, select:focus { border-color: rgba(99,102,241,0.5) !important; background: rgba(99,102,241,0.05) !important; }
    .mono { font-family: 'JetBrains Mono', monospace !important; }
    .btn-glow:hover { box-shadow: 0 0 20px rgba(99,102,241,0.3); }
    .card-glass { backdrop-filter: blur(10px); }
    .fade-in { animation: fadeIn .3s ease; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
    .op-row { transition: background .15s; }
    .op-row:hover { background: rgba(255,255,255,0.02) !important; }
    .saldo-card { transition: all .2s; cursor: pointer; }
    .saldo-card:hover { border-color: rgba(255,255,255,0.15) !important; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
    .nav-item { transition: all .15s; border-radius: 8px; }
    .nav-item:hover { background: rgba(255,255,255,0.05) !important; }
    @media (max-width: 768px) {
      .desktop-nav { display: none !important; }
      .mobile-nav { display: flex !important; }
      .hide-mobile { display: none !important; }
      .grid-mobile-1 { grid-template-columns: 1fr !important; }
    }
    @media (min-width: 769px) {
      .mobile-nav { display: none !important; }
      .mobile-menu { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}

const Lbl = ({children}) => <span style={S.lbl}>{children}</span>;
const Inp = ({sx,...p}) => <input style={S.inp(sx)} {...p}/>;
const Sel = ({children,...p}) => <select style={S.inp()} {...p}>{children}</select>;
const Card = ({children,sx,...p}) => <div style={{...S.card,...sx}} {...p}>{children}</div>;
const MonedasSel = ({value,onChange,exclude}) => (
  <Sel value={value} onChange={e=>onChange(e.target.value)}>
    {MONEDAS.filter(m=>m.id!==exclude).map(m=><option key={m.id} value={m.id}>{m.id} - {m.label}</option>)}
  </Sel>
);

// Grafico de lineas SVG puro — sin dependencias externas
function MiniLineChart({ series=[], labels=[], height=180 }) {
  if (!series.length || !series[0].data.length) return null;
  const W=500, H=height, padL=52, padR=12, padT=10, padB=28;
  const allVals = series.flatMap(s=>s.data.filter(v=>v!==null&&v!==undefined));
  if (!allVals.length) return null;
  const minV=Math.min(...allVals), maxV=Math.max(...allVals);
  const range=maxV-minV||1;
  const n=series[0].data.length;
  const xOf=i=>padL+(i/(Math.max(n-1,1)))*(W-padL-padR);
  const yOf=v=>padT+(1-((v-minV)/range))*(H-padT-padB);
  // ticks Y
  const ticks=4;
  const tickVals=Array.from({length:ticks+1},(_,i)=>minV+(i/ticks)*range);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height}}>
      {/* grid */}
      {tickVals.map((v,i)=>(
        <g key={i}>
          <line x1={padL} y1={yOf(v)} x2={W-padR} y2={yOf(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
          <text x={padL-6} y={yOf(v)+4} textAnchor="end" fontSize="9" fill="#475569">${Math.round(v).toLocaleString("es-AR")}</text>
        </g>
      ))}
      {/* labels X */}
      {labels.filter((_,i)=>i%(Math.ceil(n/6))===0||i===n-1).map((l,_,arr,i=labels.indexOf(l))=>(
        <text key={i} x={xOf(i)} y={H-6} textAnchor="middle" fontSize="9" fill="#475569">{l}</text>
      ))}
      {/* lineas */}
      {series.map((s,si)=>{
        const pts=s.data.map((v,i)=>v!==null&&v!==undefined?[xOf(i),yOf(v)]:null);
        // construir segmentos continuos
        const segments=[];
        let seg=[];
        pts.forEach(p=>{ if(p){seg.push(p);}else{if(seg.length>1)segments.push(seg);seg=[];} });
        if(seg.length>1) segments.push(seg);
        return segments.map((sg,sgi)=>(
          <polyline key={si+"-"+sgi}
            points={sg.map(p=>p.join(",")).join(" ")}
            fill="none" stroke={s.color} strokeWidth="2"
            strokeDasharray={s.dash?"6,4":"none"}
            strokeLinecap="round" strokeLinejoin="round"/>
        ));
      })}
      {/* puntos */}
      {series.map((s,si)=>
        s.data.map((v,i)=>v!==null&&v!==undefined?(
          <circle key={si+"-"+i} cx={xOf(i)} cy={yOf(v)} r="3" fill={s.color}/>
        ):null)
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────
// PANTALLA ANÁLISIS CPP — NUEVA
// ─────────────────────────────────────────────
function PantallaPnl({pnlData}) {
  const fmtU=(v)=>v==null?"—":(v>=0?"+":"")+Number(v).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=(v,t)=>t?((v/t)*100).toFixed(1)+"%":"—";
  const [pnlDetFecha,setPnlDetFecha]=useState(null);

  const Card2=({label,val,color,sub})=>(
    <div style={{background:"#0f1623",border:`1px solid ${color}22`,borderRadius:12,padding:"14px 16px",flex:"1 1 140px"}}>
      <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:6}}>{label}</div>
      <div style={{fontSize:18,fontWeight:700,color:(val||0)>=0?color:"#f87171",fontFamily:"monospace"}}>{fmtU(val)}</div>
      {sub&&<div style={{fontSize:10,color:"#94a3b8",marginTop:3}}>{sub}</div>}
    </div>
  );

  const totalN1=pnlData.reduce((s,r)=>s+(r.nivel1||0),0);
  const totalInterm=pnlData.reduce((s,r)=>s+(r.intermediacion||0),0);
  const totalFee=pnlData.reduce((s,r)=>s+(r.fee_total||0),0);
  const totalPos=pnlData.reduce((s,r)=>s+(r.posicion||0),0);
  const detalle=pnlDetFecha?pnlData.find(r=>r.fecha===pnlDetFecha):null;

  return (
    <div style={{padding:"20px 16px",maxWidth:900,margin:"0 auto"}}>
      <div style={{fontSize:10,letterSpacing:3,color:"#f472b6",marginBottom:16}}>ANÁLISIS P&L</div>

      <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:8}}>ACUMULADO HISTÓRICO</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
        <Card2 label="RESULTADO TOTAL" val={totalN1} color="#f472b6" sub={`${pnlData.length} días con cierre`}/>
        <Card2 label="INTERMEDIACIÓN" val={totalInterm} color="#38bdf8" sub={pct(totalInterm,totalN1)+" del total"}/>
        <Card2 label="FEE INCOME" val={totalFee} color="#4ade80" sub={pct(totalFee,totalN1)+" del total"}/>
        <Card2 label="POSICIÓN (MERCADO)" val={totalPos} color="#f59e0b" sub={pct(totalPos,totalN1)+" del total"}/>
      </div>

      {pnlData.length===0&&(
        <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:12,padding:32,textAlign:"center",color:"#94a3b8",fontSize:13}}>
          Aún no hay datos de P&L. Se generan automáticamente al cerrar la caja cada día.
        </div>
      )}

      {pnlData.length>0&&(
        <div>
          <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:8}}>DETALLE POR DÍA</div>
          <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:12,overflow:"hidden",marginBottom:20}}>
            <div style={{display:"grid",gridTemplateColumns:"110px 1fr 1fr 1fr 1fr 60px",gap:0}}>
              {["FECHA","N1 RESULTADO","INTERMEDIACIÓN","FEE INCOME","POSICIÓN",""].map((h,i)=>(
                <div key={i} style={{padding:"8px 10px",fontSize:9,color:"#94a3b8",letterSpacing:1,fontWeight:700,borderBottom:"1px solid #1f2937",background:"#080d14"}}>{h}</div>
              ))}
              {pnlData.map(row=>{
                const n1=row.nivel1||0,interm=row.intermediacion||0,fee=row.fee_total||0,pos=row.posicion||0;
                const isOpen=pnlDetFecha===row.fecha;
                return (
                  <Fragment key={row.fecha}>
                    <div style={{padding:"10px",fontSize:11,color:"#94a3b8",borderBottom:"1px solid #0a0a0a"}}>{row.fecha}</div>
                    <div style={{padding:"10px",fontSize:12,fontWeight:700,color:n1>=0?"#f472b6":"#f87171",borderBottom:"1px solid #0a0a0a",fontFamily:"monospace"}}>{fmtU(n1)}</div>
                    <div style={{padding:"10px",fontSize:12,color:"#38bdf8",borderBottom:"1px solid #0a0a0a",fontFamily:"monospace"}}>{fmtU(interm)}<span style={{fontSize:9,color:"#9ca3af",marginLeft:4}}>{pct(interm,n1)}</span></div>
                    <div style={{padding:"10px",fontSize:12,color:"#4ade80",borderBottom:"1px solid #0a0a0a",fontFamily:"monospace"}}>{fmtU(fee)}<span style={{fontSize:9,color:"#9ca3af",marginLeft:4}}>{pct(fee,n1)}</span></div>
                    <div style={{padding:"10px",fontSize:12,color:pos>=0?"#f59e0b":"#f87171",borderBottom:"1px solid #0a0a0a",fontFamily:"monospace"}}>{fmtU(pos)}<span style={{fontSize:9,color:"#9ca3af",marginLeft:4}}>{pct(pos,n1)}</span></div>
                    <div style={{padding:"8px",borderBottom:"1px solid #0a0a0a",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <button onClick={()=>setPnlDetFecha(isOpen?null:row.fecha)}
                        style={{fontSize:10,padding:"3px 8px",borderRadius:5,background:isOpen?"rgba(244,114,182,0.1)":"transparent",border:"1px solid "+(isOpen?"#f472b6":"#374151"),color:isOpen?"#f472b6":"#4b5563",cursor:"pointer",fontFamily:"inherit"}}>
                        {isOpen?"▲":"▼"}
                      </button>
                    </div>
                    {isOpen&&detalle&&(
                      <div style={{gridColumn:"1/-1",background:"#080d14",padding:"14px 16px",borderBottom:"1px solid #1f2937"}}>
                        <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:10}}>DESGLOSE — {row.fecha}</div>
                        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
                          {[
                            {l:"USD/ARS",v:detalle.int_usdars,c:"#38bdf8"},
                            {l:"USDT/ARS",v:detalle.int_usdtars,c:"#fbbf24"},
                            {l:"USDT/USD",v:detalle.int_usdtusd,c:"#fbbf24"},
                            {l:"EUR",v:detalle.int_eur,c:"#a78bfa"},
                            {l:"BRL",v:detalle.int_brl,c:"#4ade80"},
                            {l:"Cheq.Día",v:detalle.fee_cheqdia,c:"#4ade80"},
                            {l:"Cheq.Dif.",v:detalle.fee_cheqdif,c:"#4ade80"},
                            {l:"Transf.",v:detalle.fee_transf,c:"#4ade80"},
                            {l:"Canje",v:detalle.fee_canje,c:"#4ade80"},
                          ].filter(x=>(x.v||0)!==0).map(x=>(
                            <div key={x.l} style={{background:"rgba(255,255,255,0.02)",border:"1px solid #1f2937",borderRadius:8,padding:"8px 12px",minWidth:100}}>
                              <div style={{fontSize:9,color:"#94a3b8",marginBottom:3}}>{x.l}</div>
                              <div style={{fontSize:13,fontWeight:700,color:x.c,fontFamily:"monospace"}}>{fmtU(x.v)}</div>
                            </div>
                          ))}
                        </div>
                        {detalle.detalle_ops&&detalle.detalle_ops.length>0&&(
                          <div>
                            <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:6}}>OPERACIONES</div>
                            <div style={{display:"grid",gridTemplateColumns:"90px 80px 100px 100px 110px 1fr",gap:0,fontSize:10}}>
                              {["Cruce","Monto","Cotiz.","Costo FIFO","Ganancia USD","Ref. lote"].map((h,i)=>(
                                <div key={i} style={{padding:"5px 8px",color:"#64748b",fontWeight:700,borderBottom:"1px solid #0a0a0a"}}>{h}</div>
                              ))}
                              {detalle.detalle_ops.map((op,i)=>(
                                <Fragment key={i}>
                                  <div style={{padding:"5px 8px",color:"#94a3b8",borderBottom:"1px solid #0a0a0a"}}>{op.cruce}</div>
                                  <div style={{padding:"5px 8px",color:"#e2e8f0",borderBottom:"1px solid #0a0a0a",fontFamily:"monospace"}}>{Number(op.monto||0).toLocaleString("es-AR",{maximumFractionDigits:2})}</div>
                                  <div style={{padding:"5px 8px",color:"#e2e8f0",borderBottom:"1px solid #0a0a0a",fontFamily:"monospace"}}>${Number(op.cotiz_op||0).toLocaleString("es-AR",{maximumFractionDigits:2})}</div>
                                  <div style={{padding:"5px 8px",color:"#94a3b8",borderBottom:"1px solid #0a0a0a",fontFamily:"monospace"}}>${Number(op.costo_fifo||0).toLocaleString("es-AR",{maximumFractionDigits:2})}</div>
                                  <div style={{padding:"5px 8px",color:(op.ganancia_usd||0)>=0?"#38bdf8":"#f87171",borderBottom:"1px solid #0a0a0a",fontFamily:"monospace",fontWeight:700}}>{fmtU(op.ganancia_usd)}</div>
                                  <div style={{padding:"5px 8px",color:"#64748b",borderBottom:"1px solid #0a0a0a",fontSize:9}}>{op.lote_ref}</div>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PantallaCppDashboard({resultado, fmtN, colorGan}) {
  const [objetivoMensual, setObjetivoMensual] = useState(2500);
  const [jerarquia, setJerarquia] = useState("mes");
  const [drillPath, setDrillPath] = useState([]);
  const [sliderMin, setSliderMin] = useState(0);
  const [sliderMax, setSliderMax] = useState(100);
  const parse = v => { try{return parseFloat(v||0)||0}catch{return 0} };

        const histUSD = resultado.monedas?.USD?.historial || [];
        const todosLosDias = [...new Set(histUSD.map(h=>h.fecha))].sort();
        const blueHist = resultado.blueHistory || [];

        // ── Helpers de agrupación ──────────────────────────────────────
        const getMesKey  = f => f.slice(0,7);
        const getSemKey  = f => { const d=new Date(f); const day=d.getDay(); const diff=d.getDate()-day+(day===0?-6:1); const l=new Date(d); l.setDate(diff); return l.toISOString().split("T")[0]; };
        const getDiaKey  = f => f;

        // Agrupar por nivel
        const agrupar = (nivel, filtroFechas) => {
          const grupos = {};
          histUSD.forEach(h => {
            if(filtroFechas && (h.fecha < filtroFechas[0] || h.fecha > filtroFechas[1])) return;
            const key = nivel==="mes" ? getMesKey(h.fecha) : nivel==="semana" ? getSemKey(h.fecha) : getDiaKey(h.fecha);
            if(!grupos[key]) grupos[key] = {key, label:key, ganancia:0, volumen:0, ops:0, compras:0, dias:[]};
            if(h.tipo==="venta"){
              grupos[key].ganancia += h.gananciaOp||0;
              grupos[key].volumen  += h.monto||0;
              grupos[key].ops      += 1;
            } else {
              grupos[key].compras += h.monto||0;
            }
            if(!grupos[key].dias.includes(h.fecha)) grupos[key].dias.push(h.fecha);
          });
          return Object.values(grupos).sort((a,b)=>a.key.localeCompare(b.key));
        };

        // Slider: convertir % a fecha
        const allDates = todosLosDias;
        const idxMin = Math.floor(sliderMin/100*(allDates.length-1));
        const idxMax = Math.ceil(sliderMax/100*(allDates.length-1));
        const fechaSliderMin = allDates[idxMin] || allDates[0];
        const fechaSliderMax = allDates[idxMax] || allDates[allDates.length-1];

        // Drill-down: determinar qué mostrar
        const nivelActual = drillPath.length===0 ? jerarquia :
                            drillPath.length===1 ? (jerarquia==="mes"?"semana":"dia") : "dia";
        const filtroFechas = [fechaSliderMin, fechaSliderMax];

        let datos = [];
        if(drillPath.length===0){
          datos = agrupar(jerarquia, filtroFechas);
        } else if(drillPath.length===1){
          const parent = drillPath[0];
          const subFiltro = jerarquia==="mes"
            ? [parent.key+"-01", parent.key+"-31"]
            : [parent.key, new Date(new Date(parent.key).getTime()+6*86400000).toISOString().split("T")[0]];
          datos = agrupar(jerarquia==="mes"?"semana":"dia", [
            Math.max(filtroFechas[0], subFiltro[0]) > filtroFechas[0] ? subFiltro[0] : filtroFechas[0],
            subFiltro[1]
          ]);
        } else {
          datos = agrupar("dia", [drillPath[1].key, drillPath[1].key]);
        }

        const maxGan = Math.max(...datos.map(s=>Math.abs(s.ganancia)), 1);
        const BAR_H = 120;

        // Breadcrumb
        const breadcrumb = ["Todo", ...drillPath.map(p=>p.key)];

        // Mes actual para objetivo
        const hoyStr = new Date().toISOString().split("T")[0];
        const mesActual = hoyStr.slice(0,7);
        const ganMesARS = histUSD.filter(h=>h.tipo==="venta"&&h.fecha.startsWith(mesActual)).reduce((s,h)=>s+(h.gananciaOp||0),0);
        const blueRef = resultado.blueActual || 1500;
        const ganMesUSD = ganMesARS / blueRef;
        const diasMes = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
        const diaHoy = new Date().getDate();
        const diasRestantes = diasMes - diaHoy;
        const falta = Math.max(0, objetivoMensual - ganMesUSD);
        const porDia = diasRestantes > 0 ? falta/diasRestantes : 0;
        const pctObjetivo = Math.min(100, ganMesUSD/objetivoMensual*100);

        // Semana actual vs anterior
        const semsArr = agrupar("semana", null).slice(-2);
        const semActual = semsArr[semsArr.length-1];
        const semAnterior = semsArr[semsArr.length-2];

  return (
          <div style={{marginBottom:24}}>
            <div style={{fontSize:10,letterSpacing:3,color:"#f472b6",marginBottom:16,fontWeight:700}}>📊 PERFORMANCE — COMPRA/VENTA USD</div>

            {/* ── Objetivo mensual ── */}
            <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:14,padding:"18px 20px",marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:12}}>
                <div>
                  <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:6}}>OBJETIVO MENSUAL — {mesActual}</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                    <span style={{fontSize:24,fontWeight:700,color:"#f472b6",fontFamily:"monospace"}}>
                      USD {fmtN(Math.round(ganMesUSD),0)}
                    </span>
                    <span style={{fontSize:14,color:"#64748b"}}>/</span>
                    <span style={{fontSize:14,color:"#9ca3af"}}>USD</span>
                    <input type="number" value={objetivoMensual} onChange={e=>setObjetivoMensual(Number(e.target.value))}
                      style={{width:80,background:"transparent",border:"none",borderBottom:"1px solid #374151",color:"#e2e8f0",fontFamily:"monospace",fontSize:16,fontWeight:700,outline:"none",textAlign:"center"}}/>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:4}}>PARA LLEGAR</div>
                  <div style={{fontSize:20,fontWeight:700,color:porDia<100?"#4ade80":"#f59e0b",fontFamily:"monospace"}}>
                    USD {fmtN(Math.round(porDia),0)}<span style={{fontSize:11,fontWeight:400}}>/día</span>
                  </div>
                  <div style={{fontSize:10,color:"#9ca3af"}}>{diasRestantes} días restantes · faltan USD {fmtN(Math.round(falta),0)}</div>
                </div>
              </div>
              <div style={{background:"#080d14",borderRadius:6,height:8,overflow:"hidden"}}>
                <div style={{height:"100%",width:pctObjetivo+"%",background:"linear-gradient(90deg,#6366f1,#f472b6)",borderRadius:6}}/>
              </div>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>{pctObjetivo.toFixed(1)}% completado</div>
            </div>

            {/* ── Comparativa semanas ── */}
            {semActual&&semAnterior&&(
              <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                {[{l:"SEMANA ACTUAL",d:semActual,c:"#f472b6"},{l:"SEMANA ANTERIOR",d:semAnterior,c:"#374151"}].map(({l,d,c})=>(
                  <div key={l} style={{flex:"1 1 180px",background:"#0f1623",border:`1px solid ${c}44`,borderRadius:12,padding:"12px 14px"}}>
                    <div style={{fontSize:9,color:c,letterSpacing:2,marginBottom:8,fontWeight:700}}>{l}</div>
                    <div style={{fontSize:18,fontWeight:700,fontFamily:"monospace",color:d.ganancia>=0?"#4ade80":"#f87171",marginBottom:4}}>
                      ${fmtN(Math.round(d.ganancia))}
                    </div>
                    <div style={{fontSize:10,color:"#94a3b8"}}>{d.ops} ventas · {fmtN(Math.round(d.volumen),0)} USD · desde {d.key}</div>
                  </div>
                ))}
                <div style={{flex:"1 1 180px",background:"#0f1623",border:"1px solid #1f2937",borderRadius:12,padding:"12px 14px"}}>
                  <div style={{fontSize:9,color:"#9ca3af",letterSpacing:2,marginBottom:8,fontWeight:700}}>VARIACIÓN</div>
                  {(()=>{ const diff=semActual.ganancia-semAnterior.ganancia; const pct=semAnterior.ganancia?(diff/Math.abs(semAnterior.ganancia)*100):0; return (
                    <>
                      <div style={{fontSize:18,fontWeight:700,fontFamily:"monospace",color:diff>=0?"#4ade80":"#f87171",marginBottom:4}}>
                        {diff>=0?"+":""}{fmtN(Math.round(diff))} ARS
                      </div>
                      <div style={{fontSize:13,fontWeight:700,color:pct>=0?"#4ade80":"#f87171"}}>{pct>=0?"+":""}{pct.toFixed(1)}%</div>
                      <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>{diff>=0?"↑ Mejor":"↓ Por debajo"} que la semana pasada</div>
                    </>
                  );})()}
                </div>
              </div>
            )}

            {/* ── Gráfico interactivo ── */}
            <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:14,padding:"18px 20px",marginBottom:14}}>

              {/* Controles */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:14}}>
                <div style={{display:"flex",gap:6}}>
                  {["mes","semana","dia"].map(n=>(
                    <button key={n} onClick={()=>{setJerarquia(n);setDrillPath([]);}}
                      style={{padding:"5px 14px",borderRadius:6,border:"1px solid "+(jerarquia===n?"#f472b6":"#1f2937"),
                        background:jerarquia===n?"rgba(244,114,182,0.1)":"transparent",
                        color:jerarquia===n?"#f472b6":"#4b5563",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:600,
                        textTransform:"capitalize"}}>
                      {n==="mes"?"Mensual":n==="semana"?"Semanal":"Diario"}
                    </button>
                  ))}
                </div>
                {/* Breadcrumb drill-down */}
                <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11}}>
                  {breadcrumb.map((b,i)=>(
                    <Fragment key={i}>
                      <span onClick={()=>setDrillPath(drillPath.slice(0,i===0?0:i))}
                        style={{color:i===breadcrumb.length-1?"#e2e8f0":"#f472b6",cursor:i<breadcrumb.length-1?"pointer":"default",
                          textDecoration:i<breadcrumb.length-1?"underline":"none"}}>
                        {b}
                      </span>
                      {i<breadcrumb.length-1&&<span style={{color:"#64748b"}}> › </span>}
                    </Fragment>
                  ))}
                </div>
              </div>

              {/* Slider de rango */}
              <div style={{marginBottom:16,padding:"0 4px"}}>
                <div style={{fontSize:9,color:"#9ca3af",letterSpacing:1,marginBottom:6}}>RANGO: {fechaSliderMin} — {fechaSliderMax}</div>
                <div style={{position:"relative",height:20,display:"flex",alignItems:"center"}}>
                  <div style={{position:"absolute",left:0,right:0,height:3,background:"#1f2937",borderRadius:2}}/>
                  <div style={{position:"absolute",left:sliderMin+"%",right:(100-sliderMax)+"%",height:3,background:"#f472b6",borderRadius:2}}/>
                  <input type="range" min="0" max="100" value={sliderMin}
                    onChange={e=>setSliderMin(Math.min(Number(e.target.value),sliderMax-5))}
                    style={{position:"absolute",width:"100%",opacity:0,cursor:"pointer",height:20,margin:0}}/>
                  <input type="range" min="0" max="100" value={sliderMax}
                    onChange={e=>setSliderMax(Math.max(Number(e.target.value),sliderMin+5))}
                    style={{position:"absolute",width:"100%",opacity:0,cursor:"pointer",height:20,margin:0}}/>
                  <div style={{position:"absolute",left:"calc("+sliderMin+"% - 6px)",width:12,height:12,borderRadius:"50%",background:"#f472b6",border:"2px solid #0f1623",pointerEvents:"none"}}/>
                  <div style={{position:"absolute",left:"calc("+sliderMax+"% - 6px)",width:12,height:12,borderRadius:"50%",background:"#f472b6",border:"2px solid #0f1623",pointerEvents:"none"}}/>
                </div>
              </div>

              {/* Barras */}
              {datos.length>0?(
                <div style={{overflowX:"auto"}}>
                  <div style={{display:"flex",alignItems:"flex-end",gap:6,minWidth:Math.max(datos.length*50,300),height:BAR_H+60,paddingBottom:28,position:"relative"}}>
                    {datos.map((s,i)=>{
                      const h = Math.max(Math.abs(s.ganancia)/maxGan*BAR_H, 3);
                      const isLast = i===datos.length-1;
                      const canDrill = nivelActual!=="dia";
                      return (
                        <div key={s.key} style={{flex:1,minWidth:40,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:canDrill?"pointer":"default"}}
                          onClick={()=>{ if(canDrill) setDrillPath([...drillPath,s]); }}>
                          <div style={{fontSize:9,color:s.ganancia>=0?"#4ade80":"#f87171",fontFamily:"monospace",whiteSpace:"nowrap"}}>
                            {s.ganancia>=0?"+":""}{fmtN(Math.round(s.ganancia/1000),0)}k
                          </div>
                          <div style={{
                            width:"100%",height:h,
                            background:isLast?"#f472b6":s.ganancia>=0?"#6366f1":"#f87171",
                            borderRadius:"4px 4px 0 0",
                            opacity:isLast?1:0.7,
                            transition:"height 0.3s",
                            position:"relative"
                          }}>
                            {canDrill&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:10,color:"rgba(255,255,255,0.4)"}}>▼</div>}
                          </div>
                          <div style={{fontSize:8,color:isLast?"#f472b6":"#374151",fontFamily:"monospace",whiteSpace:"nowrap",textAlign:"center",maxWidth:50,overflow:"hidden",textOverflow:"ellipsis"}}>
                            {s.key.slice(5)}
                          </div>
                          <div style={{fontSize:8,color:"#64748b"}}>{s.ops}v</div>
                        </div>
                      );
                    })}
                  </div>
                  {nivelActual!=="dia"&&<div style={{fontSize:10,color:"#9ca3af",textAlign:"center",marginTop:4}}>Click en una barra para ver el desglose ▼</div>}
                </div>
              ):<div style={{textAlign:"center",color:"#64748b",padding:32,fontSize:12}}>Sin datos en el rango seleccionado</div>}
            </div>

            {/* ── Evolución Blue ── */}
            {blueHist.length>1&&(()=>{
              const blueSlice = blueHist.filter(b=>b.fecha>=fechaSliderMin&&b.fecha<=fechaSliderMax);
              if(blueSlice.length<2) return null;
              const vals = blueSlice.map(b=>b.venta);
              const min = Math.min(...vals), max = Math.max(...vals), range = max-min||1;
              const W=600, H=80, pad=8;
              const xOf = i => pad+(i/(vals.length-1))*(W-pad*2);
              const yOf = v => H-pad-((v-min)/range)*(H-pad*2);
              const pts = vals.map((v,i)=>`${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
              const area = `M${xOf(0)},${yOf(vals[0])} `+vals.slice(1).map((v,i)=>`L${xOf(i+1)},${yOf(v)}`).join(" ")+` L${xOf(vals.length-1)},${H} L${xOf(0)},${H} Z`;
              return (
                <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:14,padding:"18px 20px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2}}>EVOLUCIÓN DÓLAR BLUE (VENTA)</div>
                    <div style={{display:"flex",gap:16,fontSize:11,fontFamily:"monospace"}}>
                      <span style={{color:"#64748b"}}>Min: <span style={{color:"#f87171"}}>${fmtN(min)}</span></span>
                      <span style={{color:"#64748b"}}>Max: <span style={{color:"#4ade80"}}>${fmtN(max)}</span></span>
                      <span style={{color:"#64748b"}}>Actual: <span style={{color:"#e2e8f0"}}>${fmtN(vals[vals.length-1])}</span></span>
                    </div>
                  </div>
                  <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:H,overflow:"visible"}}>
                    <defs>
                      <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ade80" stopOpacity="0.3"/>
                        <stop offset="100%" stopColor="#4ade80" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path d={area} fill="url(#blueGrad)"/>
                    <polyline points={pts} fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx={xOf(vals.length-1)} cy={yOf(vals[vals.length-1])} r="3" fill="#4ade80"/>
                  </svg>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#94a3b8",marginTop:4}}>
                    <span>{blueSlice[0]?.fecha}</span>
                    <span>{blueSlice[blueSlice.length-1]?.fecha}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        );
}

function ChequesCriterioSelector({ch, fmtN}) {
  const [criterioCheq, setCriterioCheq] = useState("devengado");
  const datosActivos = criterioCheq==="devengado" ? ch.datosGrafico : ch.datosPercibido;
  const comDifActivo = criterioCheq==="devengado" ? ch.comDifDevengado : ch.comDifPercibido;
  const totalActivo = criterioCheq==="devengado" ? ch.totalDevengado : ch.totalPercibido;
  const labelFecha = criterioCheq==="devengado" ? "fecha de recepción" : "fecha de acreditación (dfa)";
  const fmt2 = v => Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:0});
  return (
    <>
      {/* Selector criterio */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[{v:"devengado",l:"📥 Devengado",hint:"Por fecha en que recibiste el cheque"},{v:"percibido",l:"💰 Percibido",hint:"Por fecha en que acredita el banco"}].map(opt=>(
          <button key={opt.v} onClick={()=>setCriterioCheq(opt.v)} title={opt.hint}
            style={{padding:"6px 16px",borderRadius:6,border:"1px solid "+(criterioCheq===opt.v?"#c084fc":"#1f2937"),
              background:criterioCheq===opt.v?"rgba(192,132,252,0.1)":"transparent",
              color:criterioCheq===opt.v?"#c084fc":"#4b5563",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:700}}>
            {opt.l}
          </button>
        ))}
        <span style={{fontSize:10,color:"#9ca3af",alignSelf:"center"}}>Agrupado por {labelFecha}</span>
      </div>
      {/* KPIs */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
        {[
          {l:"CHEQUES AL DÍA",v:ch.comDia,c:"#38bdf8",sub:ch.opsDia.length+" operaciones"},
          {l:"CHEQUES DIFERIDOS",v:comDifActivo,c:"#a78bfa",sub:(criterioCheq==="devengado"?ch.opsDif.length:ch.opsDifPercibido.length)+" operaciones"},
          {l:"TOTAL",v:totalActivo,c:"#c084fc",sub:criterioCheq==="devengado"?"recibido en el período":"cobrado en el período"},
          {l:"CARTERA PENDIENTE",v:ch.comDifDevengado-ch.comDifPercibido,c:"#f59e0b",sub:"diferidos recibidos aún no acreditados"},
        ].map(({l,v,c,sub})=>(
          <div key={l} style={{flex:"1 1 150px",background:"#0f1623",border:`1px solid ${c}33`,borderRadius:10,padding:"14px 16px"}}>
            <div style={{fontSize:9,color:"#94a3b8",letterSpacing:1,marginBottom:4}}>{l}</div>
            <div style={{fontSize:18,fontWeight:700,color:c,fontFamily:"monospace"}}>${fmtN(Math.round(v))}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{sub}</div>
          </div>
        ))}
      </div>
      {/* Gráfico */}
      <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:14,padding:"18px 20px",marginBottom:14}}>
        <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:12}}>COMISIONES POR PERÍODO (ARS) — {criterioCheq.toUpperCase()}</div>
        <GraficoBarras
          datos={datosActivos}
          fmtN={fmtN}
          colorPrincipal="#38bdf8"
          colorSecundario="#a78bfa"
          labelPrincipal="Cheques al día"
          labelSecundario="Cheques diferidos"
        />
      </div>
    </>
  );
}

function GraficoBarras({datos, fmtN, colorPrincipal="#6366f1", colorSecundario=null, labelPrincipal="", labelSecundario=""}) {
  const [jerarquia, setJerarquia] = useState("semana");
  const [drillPath, setDrillPath] = useState([]);
  const [sliderMin, setSliderMin] = useState(0);
  const [sliderMax, setSliderMax] = useState(100);

  // datos: array de {fecha, valor, valor2?}
  const todosLosDias = [...new Set(datos.map(d=>d.fecha))].sort();

  const getMesKey  = f => f.slice(0,7);
  const getSemKey  = f => { const d=new Date(f); const day=d.getDay(); const diff=d.getDate()-day+(day===0?-6:1); const l=new Date(d); l.setDate(diff); return l.toISOString().split("T")[0]; };

  const agrupar = (nivel, filtroFechas) => {
    const grupos = {};
    datos.forEach(d => {
      if(filtroFechas && (d.fecha < filtroFechas[0] || d.fecha > filtroFechas[1])) return;
      const key = nivel==="mes" ? getMesKey(d.fecha) : nivel==="semana" ? getSemKey(d.fecha) : d.fecha;
      if(!grupos[key]) grupos[key] = {key, valor:0, valor2:0, count:0};
      grupos[key].valor  += d.valor  || 0;
      grupos[key].valor2 += d.valor2 || 0;
      grupos[key].count  += 1;
    });
    return Object.values(grupos).sort((a,b)=>a.key.localeCompare(b.key));
  };

  const idxMin = Math.floor(sliderMin/100*(todosLosDias.length-1));
  const idxMax = Math.ceil(sliderMax/100*(todosLosDias.length-1));
  const fechaMin = todosLosDias[idxMin] || todosLosDias[0] || "";
  const fechaMax = todosLosDias[idxMax] || todosLosDias[todosLosDias.length-1] || "";

  const nivelActual = drillPath.length===0 ? jerarquia : drillPath.length===1 ? (jerarquia==="mes"?"semana":"dia") : "dia";
  const filtro = [fechaMin, fechaMax];

  let barras = [];
  if(drillPath.length===0){
    barras = agrupar(jerarquia, filtro);
  } else if(drillPath.length===1){
    const p = drillPath[0];
    const sub = jerarquia==="mes" ? [p.key+"-01", p.key+"-31"] : [p.key, new Date(new Date(p.key).getTime()+6*86400000).toISOString().split("T")[0]];
    barras = agrupar(jerarquia==="mes"?"semana":"dia", [sub[0]<filtro[0]?filtro[0]:sub[0], sub[1]]);
  } else {
    barras = agrupar("dia", [drillPath[1].key, drillPath[1].key]);
  }

  const maxVal = Math.max(...barras.map(b=>Math.abs(b.valor)+(b.valor2||0)), 1);
  const BAR_H = 100;
  const breadcrumb = ["Todo", ...drillPath.map(p=>p.key)];

  if(todosLosDias.length === 0) return <div style={{color:"#64748b",fontSize:12,padding:20,textAlign:"center"}}>Sin datos en el período</div>;

  return (
    <div>
      {/* Controles */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:12}}>
        <div style={{display:"flex",gap:6}}>
          {["mes","semana","dia"].map(n=>(
            <button key={n} onClick={()=>{setJerarquia(n);setDrillPath([]);}}
              style={{padding:"5px 14px",borderRadius:6,border:"1px solid "+(jerarquia===n?colorPrincipal:"#1f2937"),
                background:jerarquia===n?`rgba(${colorPrincipal==="f472b6"?"244,114,182":"99,102,241"},0.1)`:"transparent",
                color:jerarquia===n?colorPrincipal:"#4b5563",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:600}}>
              {n==="mes"?"Mensual":n==="semana"?"Semanal":"Diario"}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11}}>
          {breadcrumb.map((b,i)=>(
            <Fragment key={i}>
              <span onClick={()=>setDrillPath(drillPath.slice(0,i===0?0:i))}
                style={{color:i===breadcrumb.length-1?"#e2e8f0":colorPrincipal,cursor:i<breadcrumb.length-1?"pointer":"default",
                  textDecoration:i<breadcrumb.length-1?"underline":"none"}}>
                {b}
              </span>
              {i<breadcrumb.length-1&&<span style={{color:"#64748b"}}> › </span>}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Slider */}
      <div style={{marginBottom:14,padding:"0 4px"}}>
        <div style={{fontSize:9,color:"#9ca3af",letterSpacing:1,marginBottom:6}}>RANGO: {fechaMin} — {fechaMax}</div>
        <div style={{position:"relative",height:20,display:"flex",alignItems:"center"}}>
          <div style={{position:"absolute",left:0,right:0,height:3,background:"#1f2937",borderRadius:2}}/>
          <div style={{position:"absolute",left:sliderMin+"%",right:(100-sliderMax)+"%",height:3,background:colorPrincipal,borderRadius:2}}/>
          <input type="range" min="0" max="100" value={sliderMin}
            onChange={e=>setSliderMin(Math.min(Number(e.target.value),sliderMax-5))}
            style={{position:"absolute",width:"100%",opacity:0,cursor:"pointer",height:20,margin:0}}/>
          <input type="range" min="0" max="100" value={sliderMax}
            onChange={e=>setSliderMax(Math.max(Number(e.target.value),sliderMin+5))}
            style={{position:"absolute",width:"100%",opacity:0,cursor:"pointer",height:20,margin:0}}/>
          <div style={{position:"absolute",left:"calc("+sliderMin+"% - 6px)",width:12,height:12,borderRadius:"50%",background:colorPrincipal,border:"2px solid #0f1623",pointerEvents:"none"}}/>
          <div style={{position:"absolute",left:"calc("+sliderMax+"% - 6px)",width:12,height:12,borderRadius:"50%",background:colorPrincipal,border:"2px solid #0f1623",pointerEvents:"none"}}/>
        </div>
      </div>

      {/* Barras */}
      {barras.length>0?(
        <div style={{overflowX:"auto"}}>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,minWidth:Math.max(barras.length*50,300),height:BAR_H+50,paddingBottom:28}}>
            {barras.map((b,i)=>{
              const isLast=i===barras.length-1;
              const canDrill=nivelActual!=="dia";
              const h1=Math.max(Math.abs(b.valor)/maxVal*BAR_H,2);
              const h2=colorSecundario?Math.max((b.valor2||0)/maxVal*BAR_H,0):0;
              return (
                <div key={b.key} style={{flex:1,minWidth:40,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:canDrill?"pointer":"default"}}
                  onClick={()=>canDrill&&setDrillPath([...drillPath,b])}>
                  <div style={{fontSize:9,color:b.valor>=0?"#4ade80":"#f87171",fontFamily:"monospace",whiteSpace:"nowrap"}}>
                    {b.valor>=0?"+":""}{fmtN(Math.round((b.valor+(b.valor2||0))/1000),0)}k
                  </div>
                  <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"stretch",position:"relative"}}>
                    {h2>0&&<div style={{height:h2,background:isLast?colorSecundario+"cc":colorSecundario,borderRadius:"4px 4px 0 0",opacity:isLast?1:0.7}}/>}
                    <div style={{height:h1,background:isLast?colorPrincipal:colorPrincipal+"99",borderRadius:h2>0?"0":"4px 4px 0 0",opacity:isLast?1:0.7}}>
                      {canDrill&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",fontSize:10,color:"rgba(255,255,255,0.3)"}}>▼</div>}
                    </div>
                  </div>
                  <div style={{fontSize:8,color:isLast?colorPrincipal:"#374151",fontFamily:"monospace",whiteSpace:"nowrap"}}>{b.key.slice(5)}</div>
                </div>
              );
            })}
          </div>
          {nivelActual!=="dia"&&<div style={{fontSize:10,color:"#9ca3af",textAlign:"center",marginTop:4}}>Click en una barra para ver el desglose ▼</div>}
        </div>
      ):<div style={{textAlign:"center",color:"#64748b",padding:24,fontSize:12}}>Sin datos en el rango seleccionado</div>}

      {/* Leyenda */}
      {colorSecundario&&(
        <div style={{display:"flex",gap:12,marginTop:8}}>
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#9ca3af"}}>
            <div style={{width:10,height:10,borderRadius:2,background:colorPrincipal}}/>{labelPrincipal}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#9ca3af"}}>
            <div style={{width:10,height:10,borderRadius:2,background:colorSecundario}}/>{labelSecundario}
          </div>
        </div>
      )}
    </div>
  );
}

function PantallaRecaudadora({recaudTransf, setRecaudTransf, clientes, hoy, SB, notify}) {
  const [formR, setFormR] = useState({clienteId:"",recaudadora:"maltu",montoEnviado:"",pctRecaud:1,pctComision:3,fecha:hoy,nota:"",ccPagoId:""});
  const [mostrarForm, setMostrarForm] = useState(false);
  const [buscarCl, setBuscarCl] = useState("");
  const [buscarCC, setBuscarCC] = useState("");
  const [filtroBuscar, setFiltroBuscar] = useState("");
  const [vistaRecaud, setVistaRecaud] = useState("transferencias");
  const [clienteSelRecaud, setClienteSelRecaud] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const parse = v => { try{return parseFloat(v||0)||0}catch{return 0} };
  const fmt = v => Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:0});

  const hoyDate = new Date();
  const dias72 = (fecha) => {
    const d = new Date(fecha);
    d.setDate(d.getDate()+3);
    return d;
  };
  const horasRestantes = (fecha) => {
    const vence = dias72(fecha);
    const diff = vence - hoyDate;
    return Math.floor(diff / (1000*60*60));
  };

  const RECAUDADORAS = {
    maltu: {label:"Maltu", color:"#38bdf8", pctDefault:1},
    devi:  {label:"Devi",  color:"#f472b6", pctDefault:2.7},
  };

  // Calcular totales por recaudadora
  const totales = Object.fromEntries(Object.keys(RECAUDADORAS).map(k=>([k,{
    pendiente: recaudTransf.filter(t=>t.recaudadora===k&&t.estado==="pendiente").reduce((s,t)=>s+Number(t.neto_recaudadora||0),0),
    acreditado: recaudTransf.filter(t=>t.recaudadora===k&&t.estado==="acreditado").reduce((s,t)=>s+Number(t.neto_recaudadora||0),0),
    ganancia: recaudTransf.filter(t=>t.recaudadora===k).reduce((s,t)=>s+Number(t.ganancia||0),0),
    count: recaudTransf.filter(t=>t.recaudadora===k).length,
  }])));

  // Filtros
  const filtradas = recaudTransf.filter(t=>{
    if(filtroEstado!=="todos"&&t.estado!==filtroEstado) return false;
    if(filtroBuscar&&!t.cliente_nombre?.toLowerCase().includes(filtroBuscar.toLowerCase())) return false;
    return true;
  });

  const cambiarEstado = async(id, nuevoEstado, t) => {
    await SB.from("recaudadora_transferencias").update({estado:nuevoEstado}).eq("id",id);
    setRecaudTransf(p=>p.map(x=>x.id!==id?x:{...x,estado:nuevoEstado}));
    // Si pasa a "acreditado" → impactar CC recaudadora (retiro = nos debe)
    // Si pasa a "pagado" → impactar CC cliente (ingreso = le debemos el neto)
    if(nuevoEstado==="acreditado"){
      notify("Marcado como acreditado");
    } else if(nuevoEstado==="pagado"){
      notify("Marcado como pagado al cliente");
    }
  };

  const guardarTransf = async() => {
    const monto = parse(formR.montoEnviado);
    if(!formR.clienteId||!monto){notify("Completá cliente y monto",false);return;}
    const cl = clientes.find(x=>x.id===Number(formR.clienteId));
    const hora = new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    const {data:ins} = await SB.from("recaudadora_transferencias").insert({
      cliente_id:Number(formR.clienteId),
      cliente_nombre:cl?cl.nombre+" "+(cl.apellido||""):"",
      recaudadora:formR.recaudadora,
      monto_enviado:monto,
      pct_recaudadora:parse(formR.pctRecaud),
      pct_comision:parse(formR.pctComision),
      fecha:formR.fecha,
      hora,
      estado:"pendiente",
      nota:formR.nota,
    }).select().single();
    if(ins){
      setRecaudTransf(p=>[ins,...p]);
      // Impactar CC del cliente con neto_cliente (ingreso = le debemos)
      const netoCliente = monto*(1-parse(formR.pctComision)/100);
      const notaCC = `Recaudadora ${formR.recaudadora.toUpperCase()} — $${fmt(monto)} enviado — neto cliente $${fmt(netoCliente)}`;
      await SB.from("movimientos_cc").insert({
        cliente_id:Number(formR.clienteId),hora,fecha:formR.fecha,
        tipo:"ingreso_transf",moneda:"ARS",monto:netoCliente,nota:notaCC
      });
      // Impactar CC de la recaudadora (retiro = nos debe)
      const clRecaud = clientes.find(x=>x.nombre?.toLowerCase().includes(formR.recaudadora));
      if(clRecaud){
        const netoRecaud = monto*(1-parse(formR.pctRecaud)/100);
        const notaRecaudCC = `Transferencia cliente ${cl?.nombre||""} — $${fmt(monto)} — nos debe $${fmt(netoRecaud)}`;
        await SB.from("movimientos_cc").insert({
          cliente_id:clRecaud.id,hora,fecha:formR.fecha,
          tipo:"retiro_transf",moneda:"ARS",monto:netoRecaud,nota:notaRecaudCC
        });
      }
      setMostrarForm(false);
      setFormR({clienteId:"",recaudadora:"maltu",montoEnviado:"",pctRecaud:1,pctComision:3,fecha:hoy,nota:"",ccPagoId:""});
      setBuscarCl(""); setBuscarCC("");
      notify("Transferencia registrada ✓ — CC actualizadas");
    }
  };

  const clFiltrados = clientes.filter(cl=>!cl.oculto&&(cl.nombre+" "+(cl.apellido||"")).toLowerCase().includes(buscarCl.toLowerCase())).slice(0,8);

  const estadoColor = {pendiente:"#f59e0b", acreditado:"#38bdf8", pagado:"#4ade80"};
  const estadoLabel = {pendiente:"⏳ Pendiente", acreditado:"✓ Acreditado", pagado:"💰 Pagado"};

  return (
    <div style={{padding:"16px 16px 40px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{fontSize:10,letterSpacing:3,color:"#e879f9",marginBottom:4,fontWeight:700}}>RECAUDADORA</div>
      <div style={{fontSize:18,fontWeight:700,color:"#e2e8f0",marginBottom:20}}>Gestión de Transferencias</div>

      {/* Cards por recaudadora */}
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        {Object.entries(RECAUDADORAS).map(([key,r])=>(
          <div key={key} style={{flex:"1 1 200px",background:"#0f1623",border:`1px solid ${r.color}33`,borderRadius:14,padding:"16px 18px"}}>
            <div style={{fontSize:10,color:r.color,fontWeight:700,letterSpacing:2,marginBottom:12}}>{r.label.toUpperCase()}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div>
                <div style={{fontSize:9,color:"#94a3b8",marginBottom:2}}>PENDIENTE DE COBRAR</div>
                <div style={{fontSize:16,fontWeight:700,color:"#f59e0b",fontFamily:"monospace"}}>${fmt(totales[key].pendiente)}</div>
              </div>
              <div>
                <div style={{fontSize:9,color:"#94a3b8",marginBottom:2}}>ACREDITADO</div>
                <div style={{fontSize:16,fontWeight:700,color:"#38bdf8",fontFamily:"monospace"}}>${fmt(totales[key].acreditado)}</div>
              </div>
              <div>
                <div style={{fontSize:9,color:"#94a3b8",marginBottom:2}}>GANANCIA TOTAL</div>
                <div style={{fontSize:14,fontWeight:700,color:"#4ade80",fontFamily:"monospace"}}>${fmt(totales[key].ganancia)}</div>
              </div>
              <div>
                <div style={{fontSize:9,color:"#94a3b8",marginBottom:2}}>OPERACIONES</div>
                <div style={{fontSize:14,fontWeight:700,color:"#9ca3af"}}>{totales[key].count}</div>
              </div>
            </div>
          </div>
        ))}

        {/* Alertas 72hs */}
        {(()=>{
          const alertas = recaudTransf.filter(t=>t.estado==="pendiente"&&horasRestantes(t.fecha)<=72&&horasRestantes(t.fecha)>0);
          const vencidas = recaudTransf.filter(t=>t.estado==="pendiente"&&horasRestantes(t.fecha)<=0);
          return (alertas.length>0||vencidas.length>0)&&(
            <div style={{flex:"1 1 200px",background:"#0f1623",border:"1px solid #f8717133",borderRadius:14,padding:"16px 18px"}}>
              <div style={{fontSize:10,color:"#f87171",fontWeight:700,letterSpacing:2,marginBottom:12}}>⚠ ALERTAS 72HS</div>
              {vencidas.map(t=>(
                <div key={t.id} style={{fontSize:11,color:"#f87171",marginBottom:4,fontWeight:700}}>
                  🔴 VENCIDA — {t.cliente_nombre} · ${fmt(t.neto_recaudadora)} ({t.recaudadora})
                </div>
              ))}
              {alertas.map(t=>(
                <div key={t.id} style={{fontSize:11,color:"#f59e0b",marginBottom:4}}>
                  🟡 {horasRestantes(t.fecha)}hs restantes — {t.cliente_nombre} · ${fmt(t.neto_recaudadora)} ({t.recaudadora})
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Toggle vista */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[{v:"transferencias",l:"📋 Transferencias"},{v:"clientes",l:"👥 Por cliente"}].map(opt=>(
          <button key={opt.v} onClick={()=>{setVistaRecaud(opt.v);setClienteSelRecaud(null);}}
            style={{padding:"7px 18px",borderRadius:8,border:"1px solid "+(vistaRecaud===opt.v?"#e879f9":"#1f2937"),
              background:vistaRecaud===opt.v?"rgba(232,121,249,0.1)":"transparent",
              color:vistaRecaud===opt.v?"#e879f9":"#4b5563",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700}}>
            {opt.l}
          </button>
        ))}
      </div>

      {/* Vista por cliente */}
      {vistaRecaud==="clientes"&&(()=>{
        // Agrupar por cliente
        const porCliente = {};
        recaudTransf.forEach(t=>{
          const key = t.cliente_id||t.cliente_nombre;
          if(!porCliente[key]) porCliente[key] = {
            clienteId:t.cliente_id, nombre:t.cliente_nombre,
            transferencias:[], totalEnviado:0,
            pendiente:0, acreditado:0, pagado:0, ganancia:0
          };
          porCliente[key].transferencias.push(t);
          porCliente[key].totalEnviado += Number(t.monto_enviado||0);
          porCliente[key].ganancia += Number(t.ganancia||0);
          if(t.estado==="pendiente") porCliente[key].pendiente += Number(t.neto_cliente||0);
          else if(t.estado==="acreditado") porCliente[key].acreditado += Number(t.neto_cliente||0);
          else if(t.estado==="pagado") porCliente[key].pagado += Number(t.neto_cliente||0);
        });
        const clientes_arr = Object.values(porCliente).sort((a,b)=>(b.pendiente+b.acreditado)-(a.pendiente+a.acreditado));

        if(clienteSelRecaud){
          const cl = porCliente[clienteSelRecaud];
          if(!cl) return null;
          return (
            <div>
              <button onClick={()=>setClienteSelRecaud(null)}
                style={{fontSize:11,color:"#e879f9",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",marginBottom:12,padding:0}}>
                ← Volver a clientes
              </button>
              <div style={{fontSize:14,fontWeight:700,color:"#e2e8f0",marginBottom:4}}>{cl.nombre}</div>
              <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                {[
                  {l:"⏳ Pendiente de cobrar",v:cl.pendiente,c:"#f59e0b"},
                  {l:"✓ Acreditado sin pagar",v:cl.acreditado,c:"#38bdf8"},
                  {l:"💰 Pagado al cliente",v:cl.pagado,c:"#4ade80"},
                  {l:"Ganancia total",v:cl.ganancia,c:"#f472b6"},
                ].map(({l,v,c2,c})=>(
                  <div key={l} style={{flex:"1 1 140px",background:"#0f1623",border:"1px solid #1f2937",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:9,color:"#94a3b8",marginBottom:4}}>{l}</div>
                    <div style={{fontSize:16,fontWeight:700,color:c,fontFamily:"monospace"}}>${fmt(Math.round(v))}</div>
                  </div>
                ))}
              </div>
              {/* Tabla de transferencias del cliente */}
              <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:12,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"90px 80px 110px 110px 80px 80px 110px",gap:0}}>
                  {["Fecha","Recaud.","Enviado","Neto cliente","Vence","Ganancia","Estado"].map(h=>(
                    <div key={h} style={{padding:"7px 10px",fontSize:9,color:"#94a3b8",fontWeight:700,letterSpacing:1,borderBottom:"1px solid #1f2937",background:"#080d14"}}>{h}</div>
                  ))}
                  {cl.transferencias.map(t=>{
                    const hrs=horasRestantes(t.fecha);
                    const alertColor=hrs<=0?"#f87171":hrs<=24?"#f59e0b":hrs<=48?"#fbbf24":"#374151";
                    return (
                      <Fragment key={t.id}>
                        <div style={{padding:"8px 10px",fontSize:11,color:"#94a3b8",borderBottom:"1px solid #0a0a0a"}}>{t.fecha}</div>
                        <div style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a"}}>
                          <span style={{fontSize:10,fontWeight:700,color:RECAUDADORAS[t.recaudadora]?.color,background:`rgba(${t.recaudadora==="maltu"?"56,189,248":"244,114,182"},0.1)`,padding:"2px 6px",borderRadius:4}}>
                            {t.recaudadora?.toUpperCase()}
                          </span>
                        </div>
                        <div style={{padding:"8px 10px",fontSize:12,fontFamily:"monospace",color:"#e2e8f0",borderBottom:"1px solid #0a0a0a"}}>${fmt(t.monto_enviado)}</div>
                        <div style={{padding:"8px 10px",fontSize:12,fontFamily:"monospace",color:"#a78bfa",fontWeight:700,borderBottom:"1px solid #0a0a0a"}}>${fmt(t.neto_cliente)}</div>
                        <div style={{padding:"8px 10px",fontSize:11,color:alertColor,fontWeight:hrs<=72?700:400,borderBottom:"1px solid #0a0a0a"}}>{hrs<=0?"VENCIDA":hrs<=72?hrs+"hs":"—"}</div>
                        <div style={{padding:"8px 10px",fontSize:12,fontFamily:"monospace",color:"#4ade80",borderBottom:"1px solid #0a0a0a"}}>${fmt(t.ganancia)}</div>
                        <div style={{padding:"8px 10px",borderBottom:"1px solid #0a0a0a"}}>
                          <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:`rgba(${t.estado==="pendiente"?"245,158,11":t.estado==="acreditado"?"56,189,248":"74,222,128"},0.1)`,color:estadoColor[t.estado],fontWeight:600}}>
                            {estadoLabel[t.estado]}
                          </span>
                        </div>
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12,marginBottom:16}}>
            {clientes_arr.map(cl=>(
              <div key={cl.clienteId||cl.nombre} onClick={()=>setClienteSelRecaud(cl.clienteId||cl.nombre)}
                style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:14,padding:"16px 18px",cursor:"pointer",transition:"border-color 0.2s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#e879f944"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#1f2937"}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>{cl.nombre}</div>
                  <div style={{fontSize:10,color:"#9ca3af"}}>{cl.transferencias.length} ops</div>
                </div>
                {cl.pendiente>0&&(
                  <div style={{marginBottom:6}}>
                    <div style={{fontSize:9,color:"#f59e0b",marginBottom:2}}>⏳ PENDIENTE DE COBRAR</div>
                    <div style={{fontSize:16,fontWeight:700,color:"#f59e0b",fontFamily:"monospace"}}>${fmt(Math.round(cl.pendiente))}</div>
                  </div>
                )}
                {cl.acreditado>0&&(
                  <div style={{marginBottom:6}}>
                    <div style={{fontSize:9,color:"#38bdf8",marginBottom:2}}>✓ ACREDITADO SIN PAGAR</div>
                    <div style={{fontSize:16,fontWeight:700,color:"#38bdf8",fontFamily:"monospace"}}>${fmt(Math.round(cl.acreditado))}</div>
                  </div>
                )}
                {cl.pagado>0&&(
                  <div style={{marginBottom:6}}>
                    <div style={{fontSize:9,color:"#4ade80",marginBottom:2}}>💰 PAGADO</div>
                    <div style={{fontSize:14,color:"#4ade80",fontFamily:"monospace"}}>${fmt(Math.round(cl.pagado))}</div>
                  </div>
                )}
                <div style={{borderTop:"1px solid #1f2937",paddingTop:8,marginTop:4,display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:10,color:"#9ca3af"}}>Ganancia</span>
                  <span style={{fontSize:12,fontWeight:700,color:"#f472b6",fontFamily:"monospace"}}>${fmt(Math.round(cl.ganancia))}</span>
                </div>
              </div>
            ))}
            {clientes_arr.length===0&&(
              <div style={{color:"#64748b",fontSize:13,padding:32}}>Sin transferencias registradas</div>
            )}
          </div>
        );
      })()}

      {/* Controles */}
      {vistaRecaud==="transferencias"&&<div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <input placeholder="Buscar cliente..." value={filtroBuscar} onChange={e=>setFiltroBuscar(e.target.value)}
          style={{background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:7,padding:"7px 12px",color:"#e2e8f0",fontFamily:"inherit",fontSize:12,outline:"none",flex:"1 1 160px"}}/>
        <div style={{display:"flex",gap:6}}>
          {["todos","pendiente","acreditado","pagado"].map(e=>(
            <button key={e} onClick={()=>setFiltroEstado(e)}
              style={{padding:"6px 12px",borderRadius:6,border:"1px solid "+(filtroEstado===e?"#e879f9":"#1f2937"),
                background:filtroEstado===e?"rgba(232,121,249,0.1)":"transparent",
                color:filtroEstado===e?"#e879f9":"#4b5563",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:600,textTransform:"capitalize"}}>
              {e==="todos"?"Todos":estadoLabel[e]}
            </button>
          ))}
        </div>
        <button onClick={()=>setMostrarForm(v=>!v)}
          style={{padding:"8px 18px",borderRadius:8,background:"rgba(232,121,249,0.1)",border:"1px solid #e879f944",color:"#e879f9",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,marginLeft:"auto"}}>
          + Nueva transferencia
        </button>
      </div>}

      {/* Formulario nueva transferencia */}
      {mostrarForm&&(
        <div style={{background:"rgba(232,121,249,0.04)",border:"1px solid #e879f922",borderRadius:12,padding:"16px 18px",marginBottom:16}}>
          <div style={{fontSize:10,color:"#e879f9",letterSpacing:2,marginBottom:14,fontWeight:700}}>NUEVA TRANSFERENCIA</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10,marginBottom:12}}>

            {/* Cliente */}
            <div style={{position:"relative",gridColumn:"span 2"}}>
              <label style={{fontSize:10,color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>CLIENTE</label>
              {formR.clienteId?(
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <div style={{flex:1,padding:"7px 10px",background:"rgba(232,121,249,0.08)",border:"1px solid #e879f944",borderRadius:6,fontSize:12,color:"#e879f9",fontWeight:600}}>
                    {clientes.find(x=>x.id===Number(formR.clienteId))?.nombre}
                  </div>
                  <button onClick={()=>{setFormR(f=>({...f,clienteId:""}));setBuscarCl("");}}
                    style={{padding:"5px 8px",borderRadius:5,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontSize:11}}>✕</button>
                </div>
              ):(
                <div>
                  <input placeholder="Buscar cliente..." value={buscarCl} onChange={e=>setBuscarCl(e.target.value)}
                    style={{width:"100%",background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"7px 10px",color:"#e2e8f0",fontFamily:"inherit",fontSize:12,outline:"none"}}/>
                  {buscarCl&&(
                    <div style={{position:"absolute",left:0,right:0,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:100,maxHeight:160,overflowY:"auto",marginTop:2}}>
                      {clFiltrados.map(cl=>(
                        <div key={cl.id} onClick={()=>{setFormR(f=>({...f,clienteId:String(cl.id)}));setBuscarCl("");}}
                          style={{padding:"8px 12px",cursor:"pointer",fontSize:12,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>
                          {cl.nombre} {cl.apellido||""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recaudadora */}
            <div>
              <label style={{fontSize:10,color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>RECAUDADORA</label>
              <div style={{display:"flex",gap:6}}>
                {Object.entries(RECAUDADORAS).map(([k,r])=>(
                  <button key={k} onClick={()=>setFormR(f=>({...f,recaudadora:k,pctRecaud:r.pctDefault}))}
                    style={{flex:1,padding:"7px",borderRadius:6,border:`1px solid ${formR.recaudadora===k?r.color+"66":"#1f2937"}`,
                      background:formR.recaudadora===k?`rgba(${k==="maltu"?"56,189,248":"244,114,182"},0.1)`:"transparent",
                      color:formR.recaudadora===k?r.color:"#94a3b8",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700}}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Monto */}
            <div>
              <label style={{fontSize:10,color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>MONTO ENVIADO $</label>
              <input type="number" placeholder="1000000" value={formR.montoEnviado} onChange={e=>setFormR(f=>({...f,montoEnviado:e.target.value}))}
                style={{width:"100%",background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"7px 10px",color:"#e2e8f0",fontFamily:"inherit",fontSize:12,outline:"none"}}/>
            </div>

            {/* % Recaudadora */}
            <div>
              <label style={{fontSize:10,color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>% RECAUDADORA</label>
              <input type="number" step="0.1" value={formR.pctRecaud} onChange={e=>setFormR(f=>({...f,pctRecaud:e.target.value}))}
                style={{width:"100%",background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"7px 10px",color:"#e2e8f0",fontFamily:"inherit",fontSize:12,outline:"none"}}/>
            </div>

            {/* % Comisión cliente */}
            <div>
              <label style={{fontSize:10,color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>% TU COMISIÓN</label>
              <input type="number" step="0.1" value={formR.pctComision} onChange={e=>setFormR(f=>({...f,pctComision:e.target.value}))}
                style={{width:"100%",background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"7px 10px",color:"#e2e8f0",fontFamily:"inherit",fontSize:12,outline:"none"}}/>
            </div>

            {/* Fecha */}
            <div>
              <label style={{fontSize:10,color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>FECHA</label>
              <input type="date" value={formR.fecha} onChange={e=>setFormR(f=>({...f,fecha:e.target.value}))}
                style={{width:"100%",background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"7px 10px",color:"#e2e8f0",fontFamily:"inherit",fontSize:12,outline:"none"}}/>
            </div>

            {/* Nota */}
            <div style={{gridColumn:"span 2"}}>
              <label style={{fontSize:10,color:"#9ca3af",letterSpacing:1,display:"block",marginBottom:4}}>NOTA</label>
              <input placeholder="Opcional..." value={formR.nota} onChange={e=>setFormR(f=>({...f,nota:e.target.value}))}
                style={{width:"100%",background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"7px 10px",color:"#e2e8f0",fontFamily:"inherit",fontSize:12,outline:"none"}}/>
            </div>
          </div>

          {/* Preview de montos */}
          {formR.montoEnviado&&(
            <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
              {[
                {l:"Enviado por cliente",v:parse(formR.montoEnviado),c:"#e2e8f0"},
                {l:`Recaudadora cobra (${formR.pctRecaud}%)`,v:parse(formR.montoEnviado)*parse(formR.pctRecaud)/100,c:"#f87171"},
                {l:"Neto que te paga recaudadora",v:parse(formR.montoEnviado)*(1-parse(formR.pctRecaud)/100),c:"#38bdf8"},
                {l:`Tu comisión (${formR.pctComision}%)`,v:parse(formR.montoEnviado)*parse(formR.pctComision)/100,c:"#4ade80"},
                {l:"Neto al cliente",v:parse(formR.montoEnviado)*(1-parse(formR.pctComision)/100),c:"#a78bfa"},
                {l:"Tu ganancia",v:parse(formR.montoEnviado)*(parse(formR.pctComision)-parse(formR.pctRecaud))/100,c:"#f59e0b"},
              ].map(({l,v,c})=>(
                <div key={l} style={{flex:"1 1 130px",background:"rgba(255,255,255,0.02)",borderRadius:8,padding:"8px 10px",border:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{fontSize:9,color:"#94a3b8",marginBottom:3}}>{l}</div>
                  <div style={{fontSize:14,fontWeight:700,color:c,fontFamily:"monospace"}}>${fmt(Math.round(v))}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setMostrarForm(false);setBuscarCl("");}}
              style={{flex:1,padding:"9px",borderRadius:7,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontFamily:"inherit",fontSize:12}}>
              Cancelar
            </button>
            <button onClick={guardarTransf}
              style={{flex:2,padding:"9px",borderRadius:7,background:"rgba(232,121,249,0.1)",border:"1px solid #e879f9",color:"#e879f9",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700}}>
              ✓ Registrar transferencia
            </button>
          </div>
        </div>
      )}

      {/* Tabla de transferencias */}
      {vistaRecaud==="transferencias"&&(<div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:14,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"100px 1fr 80px 110px 110px 110px 80px 110px 100px",gap:0}}>
          {["Fecha","Cliente","Recaud.","Enviado","Neto recaud.","Neto cliente","Ganancia","Vence 72hs","Estado"].map(h=>(
            <div key={h} style={{padding:"8px 10px",fontSize:9,color:"#94a3b8",fontWeight:700,letterSpacing:1,borderBottom:"1px solid #1f2937",background:"#080d14"}}>{h}</div>
          ))}
          {filtradas.length===0&&(
            <div style={{gridColumn:"1/-1",padding:32,textAlign:"center",color:"#64748b",fontSize:13}}>Sin transferencias registradas</div>
          )}
          {filtradas.map(t=>{
            const hrs = horasRestantes(t.fecha);
            const alertColor = hrs<=0?"#f87171":hrs<=24?"#f59e0b":hrs<=48?"#fbbf24":"#374151";
            const venceLabel = hrs<=0?"VENCIDA":hrs<=72?hrs+"hs":"—";
            return (
              <Fragment key={t.id}>
                <div style={{padding:"10px",fontSize:11,color:"#94a3b8",borderBottom:"1px solid #0a0a0a"}}>{t.fecha}</div>
                <div style={{padding:"10px",fontSize:12,color:"#e2e8f0",borderBottom:"1px solid #0a0a0a",fontWeight:600}}>
                  {t.cliente_nombre}
                  {t.nota&&<div style={{fontSize:10,color:"#9ca3af"}}>{t.nota}</div>}
                </div>
                <div style={{padding:"10px",borderBottom:"1px solid #0a0a0a"}}>
                  <span style={{fontSize:10,fontWeight:700,color:RECAUDADORAS[t.recaudadora]?.color||"#e2e8f0",background:`rgba(${t.recaudadora==="maltu"?"56,189,248":"244,114,182"},0.1)`,padding:"2px 8px",borderRadius:4}}>
                    {t.recaudadora?.toUpperCase()}
                  </span>
                </div>
                <div style={{padding:"10px",fontSize:12,fontFamily:"monospace",color:"#e2e8f0",borderBottom:"1px solid #0a0a0a"}}>${fmt(t.monto_enviado)}</div>
                <div style={{padding:"10px",fontSize:12,fontFamily:"monospace",color:"#38bdf8",borderBottom:"1px solid #0a0a0a"}}>${fmt(t.neto_recaudadora)}</div>
                <div style={{padding:"10px",fontSize:12,fontFamily:"monospace",color:"#a78bfa",borderBottom:"1px solid #0a0a0a"}}>${fmt(t.neto_cliente)}</div>
                <div style={{padding:"10px",fontSize:12,fontFamily:"monospace",color:"#4ade80",fontWeight:700,borderBottom:"1px solid #0a0a0a"}}>${fmt(t.ganancia)}</div>
                <div style={{padding:"10px",fontSize:11,color:alertColor,fontWeight:hrs<=72?700:400,borderBottom:"1px solid #0a0a0a"}}>{venceLabel}</div>
                <div style={{padding:"8px 6px",borderBottom:"1px solid #0a0a0a",display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                  {t.estado==="pendiente"&&(
                    <button onClick={()=>cambiarEstado(t.id,"acreditado",t)}
                      style={{fontSize:9,padding:"3px 6px",borderRadius:4,background:"rgba(56,189,248,0.1)",border:"1px solid #38bdf844",color:"#38bdf8",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                      Acreditar
                    </button>
                  )}
                  {t.estado==="acreditado"&&(
                    <button onClick={()=>cambiarEstado(t.id,"pagado",t)}
                      style={{fontSize:9,padding:"3px 6px",borderRadius:4,background:"rgba(74,222,128,0.1)",border:"1px solid #4ade8044",color:"#4ade80",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                      Pagar cliente
                    </button>
                  )}
                  <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:`rgba(${t.estado==="pendiente"?"245,158,11":t.estado==="acreditado"?"56,189,248":"74,222,128"},0.1)`,color:estadoColor[t.estado],fontWeight:600}}>
                    {t.estado==="pendiente"?"⏳":t.estado==="acreditado"?"✓":"💰"}
                  </span>
                  <button onClick={async()=>{
                    if(!window.confirm("¿Borrar esta transferencia? Se revertirán los movimientos en CC del cliente y la recaudadora.")) return;
                    // 1. Buscar y borrar movimientos CC relacionados por nota
                    const notaCC = `Recaudadora ${t.recaudadora?.toUpperCase()} — $${fmt(t.monto_enviado)} enviado`;
                    const {data:movsCC} = await SB.from("movimientos_cc").select("id").ilike("nota", `%${notaCC}%`);
                    if(movsCC&&movsCC.length>0){
                      await SB.from("movimientos_cc").delete().in("id", movsCC.map(m=>m.id));
                    }
                    // 2. Borrar la transferencia
                    await SB.from("recaudadora_transferencias").delete().eq("id",t.id);
                    setRecaudTransf(p=>p.filter(x=>x.id!==t.id));
                    // 3. Actualizar estado local de clientes
                    setClientes(p=>p.map(cl=>{
                      const movsBorrados=(movsCC||[]).map(m=>m.id);
                      if(!movsBorrados.length) return cl;
                      return {...cl, movimientos:(cl.movimientos||[]).filter(mv=>!movsBorrados.includes(mv.id))};
                    }));
                    notify("Transferencia y movimientos CC revertidos ✓");
                  }} style={{fontSize:9,padding:"3px 6px",borderRadius:4,background:"rgba(248,113,113,0.08)",border:"1px solid #f8717133",color:"#f87171",cursor:"pointer",fontFamily:"inherit"}}>
                    ✕
                  </button>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>)}
    </div>
  );
}

const CotFld=({label,children})=>(<div style={{display:"flex",flexDirection:"column",gap:4}}><label style={{fontSize:10,color:"#9ca3af",letterSpacing:1}}>{label}</label>{children}</div>);
const CotNum=({value,onChange,placeholder})=>(<input type="text" inputMode="decimal" value={value} onChange={onChange} placeholder={placeholder||"0"} style={{background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"7px 10px",color:"#e2e8f0",fontFamily:"inherit",fontSize:12,outline:"none",width:"100%",boxSizing:"border-box"}}/>);

function PantallaCotizaciones() {
  const [cot,setCot]=useState({
    usdC:"",usdV:"",
    eurC:"",eurV:"",
    brlC:"",brlV:"",
    gbpC:"",gbpV:"",
    usdtC:"",usdtV:"",
    usdtArsC:"",usdtArsV:"",
    canjeS:"",canjeB:"",
    comentario1:true,comentario2:true,comentario3:true,comentario4:true
  });
  const hoyFmt=new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).replace(/^./,s=>s.toUpperCase());

  // Calcular ARS desde cotiz vs USD
  const usdMid=()=>{
    const c2=parseFloat(cot.usdC||0), v=parseFloat(cot.usdV||0);
    return (c2+v)/2||v||c2||0;
  };
  const toARS=(ratio,punta)=>{
    const base=punta==="C"?parseFloat(cot.usdC||0):parseFloat(cot.usdV||0);
    if(!base||!ratio) return "";
    return Math.round(parseFloat(ratio)*base).toLocaleString("es-AR");
  };
  const signoPct=(v)=>{const n=parseFloat(v);if(isNaN(n)||v==="")return "";return (n>=0?"+":"-")+Math.abs(n)+"%";};

  const preview=useMemo(()=>{
    const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    const nl="\n";
    let m="\uD83C\uDFE6 *STS*"+nl;
    m+="\uD83D\uDCC5 "+hoyFmt+nl+nl;
    if(cot.usdC||cot.usdV) m+="\uD83D\uDCB5 *USD* \u2014 Compra: $"+cot.usdC+" | Venta: $"+cot.usdV+nl;
    if(cot.eurC||cot.eurV) m+="\uD83D\uDCB6 *EUR* \u2014 Compra: $"+cot.eurC+" | Venta: $"+cot.eurV+nl;
    if(cot.brlC||cot.brlV) m+="\uD83C\uDDE7\uD83C\uDDF7 *BRL* \u2014 Compra: $"+cot.brlC+" | Venta: $"+cot.brlV+nl;
    if(cot.gbpC||cot.gbpV) m+="\uD83C\uDDEC\uD83C\uDDE7 *GBP* \u2014 Compra: $"+cot.gbpC+" | Venta: $"+cot.gbpV+nl;
    if(cot.usdtC||cot.usdtV) m+="\uD83D\uDFE1 *USDT vs USD* \u2014 Compra: "+signoPct(cot.usdtC)+" USD | Venta: "+signoPct(cot.usdtV)+" USD"+nl;
    if(cot.usdtArsC||cot.usdtArsV) m+="\uD83D\uDFE1 *USDT vs ARS* \u2014 Compra: $"+cot.usdtArsC+" | Venta: $"+cot.usdtArsV+nl;
    if(cot.canjeS||cot.canjeB) m+="\uD83D\uDD04 *Canje* \u2014 Subida: "+signoPct(cot.canjeS)+" | Bajada: "+signoPct(cot.canjeB)+nl;
    const hayComent=cot.comentario1||cot.comentario2||cot.comentario3||cot.comentario4;
    if(hayComent) m+=nl;
    if(cot.comentario1) m+="\uD83D\uDCCB Gesti\u00F3n de Cheques al D\u00EDa y Diferidos \u2014 A consultar"+nl;
    if(cot.comentario2) m+="\uD83D\uDD01 Compra/Venta de USDT por Pesos \u2014 A consultar"+nl;
    if(cot.comentario3) m+="\uD83D\uDD04 Consultar precio de Canje"+nl;
    if(cot.comentario4) m+="\uD83D\uDCB8 Gesti\u00F3n por Transferencia \u2014 A consultar"+nl;
    m+=nl+"\u23F0 Precios al "+hora+" hs \u2014 Consultar antes de operar, sujeto a variaci\u00F3n de mercado";
    return m.trim();
  },[cot]);

  const copiar=()=>{navigator.clipboard.writeText(preview);};
  const [publicando,setPublicando]=useState(false);
  const [ultimaPublicacion,setUltimaPublicacion]=useState(null);
  const publicar=async()=>{
    setPublicando(true);
    try {
      const datos={
        usdC:cot.usdC,usdV:cot.usdV,
        eurC:cot.eurC,eurV:cot.eurV,
        brlC:cot.brlC,brlV:cot.brlV,
        gbpC:cot.gbpC,gbpV:cot.gbpV,
        usdtC:cot.usdtC,usdtV:cot.usdtV,
        usdtArsC:cot.usdtArsC,usdtArsV:cot.usdtArsV,
        canjeS:cot.canjeS,canjeB:cot.canjeB,
        comentario1:cot.comentario1,comentario2:cot.comentario2,
        comentario3:cot.comentario3,comentario4:cot.comentario4,
        updated_at:new Date().toISOString()
      };
      const fechaHoy=new Date().toISOString().split("T")[0];
      await SB.from("cotizaciones_publicas").upsert({id:fechaHoy,fecha:fechaHoy,datos,updated_at:new Date().toISOString()},{onConflict:"id"});
      await SB.from("cotizaciones_publicas").upsert({id:"current",fecha:fechaHoy,datos,updated_at:new Date().toISOString()},{onConflict:"id"});
      setUltimaPublicacion(new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}));
    } catch(e){ console.error(e); }
    setPublicando(false);
  };

  // Helper: card de moneda vs USD con preview ARS calculado
  const CardRatio=({label,color,kC,kV,phC,phV})=>{
    const arsC=toARS(cot[kC],"C"), arsV=toARS(cot[kV],"V");
    return (
      <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:10,padding:"12px 14px"}}>
        <div style={{fontSize:10,color,fontWeight:700,marginBottom:8,letterSpacing:1}}>{label}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <CotFld label="COMPRA vs USD">
            <CotNum value={cot[kC]} onChange={e=>setCot(p=>({...p,[kC]:e.target.value}))} placeholder={phC}/>
            {arsC&&<span style={{fontSize:10,color:"#94a3b8",marginTop:2}}>≈ ${arsC}</span>}
          </CotFld>
          <CotFld label="VENTA vs USD">
            <CotNum value={cot[kV]} onChange={e=>setCot(p=>({...p,[kV]:e.target.value}))} placeholder={phV}/>
            {arsV&&<span style={{fontSize:10,color:"#94a3b8",marginTop:2}}>≈ ${arsV}</span>}
          </CotFld>
        </div>
      </div>
    );
  };

  return (
    <div style={{padding:"20px 16px",maxWidth:620,margin:"0 auto"}}>
      <div style={{fontSize:10,letterSpacing:3,color:"#38bdf8",marginBottom:16}}>COTIZACIONES DEL D\u00CDA</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>

        {/* USD — base en pesos */}
        <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"#f59e0b",fontWeight:700,marginBottom:8,letterSpacing:1}}>{"\uD83D\uDCB5"} USD</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <CotFld label="COMPRA $"><CotNum value={cot.usdC} onChange={e=>setCot(p=>({...p,usdC:e.target.value}))} placeholder="1500"/></CotFld>
            <CotFld label="VENTA $"><CotNum value={cot.usdV} onChange={e=>setCot(p=>({...p,usdV:e.target.value}))} placeholder="1520"/></CotFld>
          </div>
        </div>

        {/* USDT — % sobre USD */}
        <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"#fbbf24",fontWeight:700,marginBottom:8,letterSpacing:1}}>{"\uD83D\uDFE1"} USDT <span style={{color:"#94a3b8",fontSize:9}}>% s/USD</span></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <CotFld label="COMPRA %">
              <CotNum value={cot.usdtC} onChange={e=>setCot(p=>({...p,usdtC:e.target.value}))} placeholder="+0.25"/>
            </CotFld>
            <CotFld label="VENTA %">
              <CotNum value={cot.usdtV} onChange={e=>setCot(p=>({...p,usdtV:e.target.value}))} placeholder="-3"/>
            </CotFld>
          </div>
        </div>

        {/* USDT — directo en pesos */}
        <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"#fbbf24",fontWeight:700,marginBottom:8,letterSpacing:1}}>{"\uD83D\uDFE1"} USDT <span style={{color:"#94a3b8",fontSize:9}}>en pesos</span></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <CotFld label="COMPRA $"><CotNum value={cot.usdtArsC} onChange={e=>setCot(p=>({...p,usdtArsC:e.target.value}))} placeholder="1480"/></CotFld>
            <CotFld label="VENTA $"><CotNum value={cot.usdtArsV} onChange={e=>setCot(p=>({...p,usdtArsV:e.target.value}))} placeholder="1495"/></CotFld>
          </div>
        </div>

        {/* EUR vs USD */}
        <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"#a78bfa",fontWeight:700,marginBottom:8,letterSpacing:1}}>{"\uD83D\uDCB6"} EUR</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <CotFld label="COMPRA $"><CotNum value={cot.eurC} onChange={e=>setCot(p=>({...p,eurC:e.target.value}))} placeholder="1650"/></CotFld>
            <CotFld label="VENTA $"><CotNum value={cot.eurV} onChange={e=>setCot(p=>({...p,eurV:e.target.value}))} placeholder="1800"/></CotFld>
          </div>
        </div>

        {/* BRL vs USD */}
        <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"#4ade80",fontWeight:700,marginBottom:8,letterSpacing:1}}>{"\uD83C\uDDE7\uD83C\uDDF7"} BRL</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <CotFld label="COMPRA $"><CotNum value={cot.brlC} onChange={e=>setCot(p=>({...p,brlC:e.target.value}))} placeholder="280"/></CotFld>
            <CotFld label="VENTA $"><CotNum value={cot.brlV} onChange={e=>setCot(p=>({...p,brlV:e.target.value}))} placeholder="300"/></CotFld>
          </div>
        </div>

        {/* GBP vs USD */}
        <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"#e879f9",fontWeight:700,marginBottom:8,letterSpacing:1}}>{"\uD83C\uDDEC\uD83C\uDDE7"} GBP</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <CotFld label="COMPRA $"><CotNum value={cot.gbpC} onChange={e=>setCot(p=>({...p,gbpC:e.target.value}))} placeholder="1900"/></CotFld>
            <CotFld label="VENTA $"><CotNum value={cot.gbpV} onChange={e=>setCot(p=>({...p,gbpV:e.target.value}))} placeholder="2000"/></CotFld>
          </div>
        </div>

        {/* Canje */}
        <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"#38bdf8",fontWeight:700,marginBottom:8,letterSpacing:1}}>{"\uD83D\uDD04"} CANJE <span style={{color:"#94a3b8",fontSize:9}}>%</span></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <CotFld label="SUBIDA"><CotNum value={cot.canjeS} onChange={e=>setCot(p=>({...p,canjeS:e.target.value}))} placeholder="-1"/></CotFld>
            <CotFld label="BAJADA"><CotNum value={cot.canjeB} onChange={e=>setCot(p=>({...p,canjeB:e.target.value}))} placeholder="-2"/></CotFld>
          </div>
        </div>

      </div>

      {/* Comentarios */}
      <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
        <div style={{fontSize:10,color:"#9ca3af",fontWeight:700,marginBottom:10,letterSpacing:1}}>COMENTARIOS</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            ["comentario1","\uD83D\uDCCB Gesti\u00F3n de Cheques al D\u00EDa y Diferidos \u2014 A consultar"],
            ["comentario2","\uD83D\uDD01 Compra/Venta de USDT por Pesos \u2014 A consultar"],
            ["comentario3","\uD83D\uDD04 Consultar precio de Canje"],
            ["comentario4","\uD83D\uDCB8 Gesti\u00F3n por Transferencia \u2014 A consultar"],
          ].map(([k,txt])=>(
            <div key={k} onClick={()=>setCot(p=>({...p,[k]:!p[k]}))} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"6px 8px",borderRadius:6,background:cot[k]?"rgba(56,189,248,0.06)":"rgba(255,255,255,0.02)",border:"1px solid "+(cot[k]?"#38bdf822":"#1f2937")}}>
              <div style={{width:14,height:14,borderRadius:3,background:cot[k]?"#38bdf8":"transparent",border:"1px solid "+(cot[k]?"#38bdf8":"#374151"),flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {cot[k]&&<span style={{fontSize:10,color:"#0f1623",fontWeight:900}}>{"\u2713"}</span>}
              </div>
              <span style={{fontSize:11,color:cot[k]?"#e2e8f0":"#4b5563"}}>{txt}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Vista previa */}
      <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
        <div style={{fontSize:10,color:"#9ca3af",letterSpacing:1,marginBottom:8}}>VISTA PREVIA</div>
        <pre style={{fontFamily:"inherit",fontSize:12,color:"#e2e8f0",whiteSpace:"pre-wrap",margin:0,lineHeight:1.8}}>{preview}</pre>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <button onClick={copiar} style={{width:"100%",padding:"13px",borderRadius:8,background:"rgba(56,189,248,0.08)",border:"1px solid #38bdf844",color:"#38bdf8",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:1}}>
          {"\uD83D\uDCCB"} COPIAR MENSAJE
        </button>
        <button onClick={publicar} disabled={publicando} style={{width:"100%",padding:"13px",borderRadius:8,background:publicando?"rgba(255,255,255,0.02)":"rgba(74,222,128,0.08)",border:"1px solid "+(publicando?"#1f2937":"#4ade8044"),color:publicando?"#374151":"#4ade80",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:publicando?"not-allowed":"pointer",letterSpacing:1,opacity:publicando?0.6:1}}>
          {publicando?"\u23F3 Publicando...":"\uD83D\uDE80 Publicar precios en panel p\u00FAblico"}
        </button>
        {ultimaPublicacion&&<div style={{textAlign:"center",fontSize:11,color:"#4ade80"}}>{"\u2713 Publicado a las "+ultimaPublicacion+" hs \u2014 el panel ya tiene los precios actualizados"}</div>}
      </div>
    </div>
  );
}


function PantallaAnalisis() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("estado");
  const [resultado, setResultado] = useState(null);
  const [monedaSel, setMonedaSel] = useState("USD");
  const [filtroDesde, setFiltroDesde] = useState("2026-04-14");
  const [filtroHasta, setFiltroHasta] = useState(new Date().toISOString().split("T")[0]);
  const [tabAnalisis, setTabAnalisis] = useState("spread"); // spread | transferencias
  const [objetivoMensual, setObjetivoMensual] = useState(2500);
  const [jerarquia, setJerarquia] = useState("mes"); // mes | semana | dia
  const [drillPath, setDrillPath] = useState([]); // [{nivel, key}]
  const [sliderMin, setSliderMin] = useState(0);
  const [sliderMax, setSliderMax] = useState(100);

  useEffect(() => { cargar(filtroDesde, filtroHasta); }, [filtroDesde, filtroHasta]);

  async function cargar(desde, hasta) {
    setCargando(true); setError("");
    try {
      const [{ data: opsRaw }, { data: cierres }, { data: dias }, { data: movsCC }, { data: diferidosData }, { data: recaudData }] = await Promise.all([
        SB.from("operaciones").select("*").order("fecha", { ascending: true }).order("hora", { ascending: true }),
        SB.from("cierres").select("*").order("fecha", { ascending: true }),
        SB.from("dias").select("*").order("id", { ascending: true }),
        SB.from("movimientos_cc").select("*").order("id",{ascending:true}).limit(10000),
        SB.from("diferidos").select("*"),
        SB.from("recaudadora_transferencias").select("*").order("fecha",{ascending:true}),
      ]);
      if (!cierres?.length) {
        setError("Necesitás al menos un cierre con cotización blue para calcular el CPP.");
        setCargando(false); return;
      }
      const ops = (opsRaw || []).map(o => ({
        ...(o.datos || {}), id: o.id,
        fecha: o.fecha || o.datos?.fecha,
        hora: o.hora || o.datos?.hora,
        tipo: o.tipo
      })).filter(o => o.fecha);
      setResultado(correrCPP(ops, cierres, dias || [], movsCC || [], diferidosData || [], desde || filtroDesde, hasta || filtroHasta, recaudData || []));
    } catch (e) { setError("Error al cargar: " + e.message); }
    setCargando(false);
  }

  function correrCPP(ops, cierres, dias, movsCC, diferidos, fechaDesde, fechaHasta, recaudTransf=[]) {
    const FECHA_CORTE = fechaDesde || "2026-04-14";

    // ── Punto de arranque ──────────────────────────────────────────────────
    // Arrancamos desde cero — el CPP se construye solo desde las compras reales
    const stockArranque = 0;
    const cotizArranque = 0;

    // Helper: obtener blue mid del día
    const getBlueMid = (fecha) => {
      const ci = cierres.find(c => c.fecha === fecha);
      const v = parse(ci?.cotiz_blue?.venta) || parse(ci?.cotiz_blue?.compra) || parse(ci?.cotizaciones?.ARS) || 0;
      const co = parse(ci?.cotiz_blue?.compra) || v;
      return v && co ? (v + co) / 2 : v || co;
    };
    const getBlueVenta = (fecha) => {
      const ci = cierres.find(c => c.fecha === fecha);
      return parse(ci?.cotiz_blue?.venta) || parse(ci?.cotiz_blue?.compra) || parse(ci?.cotizaciones?.ARS) || 0;
    };
    const getBlueCompra = (fecha) => {
      const ci = cierres.find(c => c.fecha === fecha);
      return parse(ci?.cotiz_blue?.compra) || parse(ci?.cotiz_blue?.venta) || 0;
    };
    const getCotizCierre = (fecha) => {
      const ci = cierres.find(c => c.fecha === fecha);
      return parse(ci?.cotizaciones?.ARS) || getBlueVenta(fecha) || 0;
    };

    // ── Estado por moneda ──────────────────────────────────────────────────
    const estado = {
      USD:  { stock: 0, cpp: 0, costoBruto: 0, ganReal: 0, historial: [], resumenDias: {} },
      USDT: { stock: 0, cpp: 0, costoBruto: 0, ganReal: 0, historial: [], resumenDias: {} },
      EUR:  { stock: 0, cpp: 0, costoBruto: 0, ganReal: 0, historial: [], resumenDias: {} },
      BRL:  { stock: 0, cpp: 0, costoBruto: 0, ganReal: 0, historial: [], resumenDias: {} },
      GBP:  { stock: 0, cpp: 0, costoBruto: 0, ganReal: 0, historial: [], resumenDias: {} },
    };

    const procesarOp = (monedaKey, monto, cotizOp, esCompra, fecha, hora, cliente, blueRef) => {
      const e = estado[monedaKey];
      if (!monto || !cotizOp) return;
      const cppAntes = e.cpp;
      let gananciaOp = null;
      let ganVsMercado = null;

      if (esCompra) {
        const nuevoTotal = e.costoBruto + monto * cotizOp;
        const nuevoStock = e.stock + monto;
        e.cpp = nuevoStock > 0 ? nuevoTotal / nuevoStock : cotizOp;
        e.costoBruto = nuevoTotal;
        e.stock = nuevoStock;
        // Ganancia vs mercado en compra: pagué menos que el mercado
        if (blueRef > 0) ganVsMercado = (blueRef - cotizOp) * monto;
      } else {
        if (e.cpp > 0) {
          gananciaOp = (cotizOp - e.cpp) * monto;
          e.ganReal += gananciaOp;
        }
        e.stock = Math.max(0, e.stock - monto);
        e.costoBruto = e.stock * e.cpp;
        // Ganancia vs mercado en venta: vendí más que el mercado
        if (blueRef > 0) ganVsMercado = (cotizOp - blueRef) * monto;
      }

      const entry = { fecha, hora, tipo: esCompra ? "compra" : "venta", monto, cotizOp, cppAntes, cppDespues: e.cpp, gananciaOp, ganVsMercado, stockDespues: e.stock, blueRef, cliente };
      e.historial.push(entry);

      if (!e.resumenDias[fecha]) e.resumenDias[fecha] = { fecha, compras: 0, ventas: 0, ganancia: 0, ganVsMercado: 0, cppFinal: 0, stockFinal: 0, blueRef: 0 };
      const d = e.resumenDias[fecha];
      if (esCompra) { d.compras += monto; } else { d.ventas += monto; d.ganancia += gananciaOp || 0; }
      if (ganVsMercado !== null) d.ganVsMercado += ganVsMercado;
      d.cppFinal = e.cpp; d.stockFinal = e.stock; d.blueRef = blueRef || d.blueRef;
    };

    // ── Filtrar y procesar ops ─────────────────────────────────────────────
    const FECHA_HASTA = fechaHasta || "9999-12-31";
    const opsValidas = ops.filter(o => {
      if (o.fecha < FECHA_CORTE || o.fecha > FECHA_HASTA) return false;
      if (o.tipo !== "compra" && o.tipo !== "venta") return false;
      // Ignorar ops con cotización claramente errónea
      const cotiz = parse(o.cotizacion);
      if (cotiz > 100000) return false; // cotización absurda
      // Ignorar ARS/USD (venta de ARS contra USD — caso mal cargado)
      if (o.moneda === "ARS" && o.moneda2 === "USD" && parse(o.monto2) > 10000) return false;
      return true;
    });

    opsValidas.forEach(op => {
      const moneda = op.moneda || "", moneda2 = op.moneda2 || "";
      const monto = parse(op.monto), monto2 = parse(op.monto2);
      const cotizOp = parse(op.cotizacion) || (monto2 && monto ? monto2 / monto : 0);
      const hora = op.hora || "", cliente = op.cliente || "";
      const blueMid = getBlueMid(op.fecha);
      const blueV = getBlueVenta(op.fecha);
      const blueC = getBlueCompra(op.fecha);

      // USD/ARS
      if (moneda === "USD" && moneda2 === "ARS") {
        const esCompra = op.tipo === "compra";
        procesarOp("USD", monto, cotizOp, esCompra, op.fecha, hora, cliente, esCompra ? blueV : blueC);
      }
      // ARS/USD (inverso — raro pero posible)
      else if (moneda === "ARS" && moneda2 === "USD") {
        const esCompra = op.tipo === "venta";
        const cotiz = monto2 ? monto / monto2 : cotizOp;
        procesarOp("USD", monto2, cotiz, esCompra, op.fecha, hora, cliente, esCompra ? blueV : blueC);
      }
      // USDT/USD — CPP en USD
      else if (moneda === "USDT" && moneda2 === "USD") {
        const esCompra = op.tipo === "compra";
        // cotizOp = USD por USDT
        procesarOp("USDT", monto, cotizOp, esCompra, op.fecha, hora, cliente, 1); // ref = 1 USD = 1 USD
      }
      // USDT/ARS — convertir a USD usando cotiz cierre
      else if (moneda === "USDT" && moneda2 === "ARS") {
        const esCompra = op.tipo === "compra";
        const cotizCierre = getCotizCierre(op.fecha) || 1;
        const cotizEnUSD = cotizOp / cotizCierre; // ARS por USDT → USD por USDT
        procesarOp("USDT", monto, cotizEnUSD, esCompra, op.fecha, hora, cliente, 1);
      }
      // EUR/ARS — CPP en ARS
      else if (moneda === "EUR" && moneda2 === "ARS") {
        const esCompra = op.tipo === "compra";
        procesarOp("EUR", monto, cotizOp, esCompra, op.fecha, hora, cliente, 0);
      }
      // BRL/ARS — CPP en ARS
      else if (moneda === "BRL" && moneda2 === "ARS") {
        const esCompra = op.tipo === "compra";
        procesarOp("BRL", monto, cotizOp, esCompra, op.fecha, hora, cliente, 0);
      }
      // GBP/ARS — CPP en ARS
      else if (moneda === "GBP" && moneda2 === "ARS") {
        const esCompra = op.tipo === "compra";
        procesarOp("GBP", monto, cotizOp, esCompra, op.fecha, hora, cliente, 0);
      }
    });

    // ── Valores actuales de mercado ────────────────────────────────────────
    const ultimoCierre = cierres[cierres.length - 1];
    const blueActual = parse(ultimoCierre?.cotiz_blue?.venta) || parse(ultimoCierre?.cotiz_blue?.compra) || parse(ultimoCierre?.cotizaciones?.ARS) || 0;

    // Ganancia no realizada por moneda
    const noRealizadaUSD = blueActual > 0 ? (blueActual - estado.USD.cpp) * estado.USD.stock : null;
    const noRealizadaUSDT = blueActual > 0 ? (1 - estado.USDT.cpp) * estado.USDT.stock : null; // vs 1 USD

    const tenencia = calcularTenencia(cierres, movsCC, diferidos);

    return {
      // Compatibilidad con código existente
      stockUSD: estado.USD.stock,
      cpp: estado.USD.cpp,
      gananciaRealizada: estado.USD.ganReal,
      gananciaNoRealizada: noRealizadaUSD,
      blueActual,
      historial: estado.USD.historial,
      resumenDias: Object.values(estado.USD.resumenDias),
      cotizArranque, stockArranque,
      tenencia,
      // ── Comisiones por transferencias ────────────────────────────────────
      transferenciaComisiones: (()=>{
        const FECHA_CORTE2 = fechaDesde || "2026-04-14";
        const FECHA_HASTA2 = fechaHasta || "9999-12-31";

        // 1. Ops de transferencia (formulario principal + entre cuentas)
        const opsTransf = ops.filter(o =>
          o.tipo === "transferencia" &&
          o.fecha >= FECHA_CORTE2 && o.fecha <= FECHA_HASTA2
        );
        const comOps = opsTransf.reduce((s,o) => s + parse(o.datos?.tcom || o.tcom || 0), 0);

        // 2. Recaudadora
        const recaudFiltrada = (recaudTransf||[]).filter(t => t.fecha >= FECHA_CORTE2 && t.fecha <= FECHA_HASTA2);
        const comRecaudPagado = recaudFiltrada.filter(t=>t.estado==="pagado").reduce((s,t)=>s+Number(t.ganancia||0),0);
        const comRecaudAcred = recaudFiltrada.filter(t=>t.estado==="acreditado").reduce((s,t)=>s+Number(t.ganancia||0),0);
        const comRecaudPend = recaudFiltrada.filter(t=>t.estado==="pendiente").reduce((s,t)=>s+Number(t.ganancia||0),0);

        // Agrupar por semana para el gráfico
        const getMesKey2 = f => f.slice(0,7);
        const getSemKey2 = f => { const d=new Date(f); const day=d.getDay(); const diff=d.getDate()-day+(day===0?-6:1); const l=new Date(d); l.setDate(diff); return l.toISOString().split("T")[0]; };
        const semanas = {};
        opsTransf.forEach(o => {
          const wk = getSemKey2(o.fecha);
          if(!semanas[wk]) semanas[wk]={key:wk,ops:0,recaud:0};
          semanas[wk].ops += parse(o.datos?.tcom || o.tcom || 0);
        });
        recaudFiltrada.forEach(t => {
          const wk = getSemKey2(t.fecha);
          if(!semanas[wk]) semanas[wk]={key:wk,ops:0,recaud:0};
          semanas[wk].recaud += Number(t.ganancia||0);
        });
        const semanasArr = Object.values(semanas).sort((a,b)=>a.key.localeCompare(b.key));

        return {
          comOps, comRecaudPagado, comRecaudAcred, comRecaudPend,
          totalEfectivo: comOps + comRecaudPagado,
          totalTotal: comOps + comRecaudPagado + comRecaudAcred + comRecaudPend,
          semanasArr, opsTransf, recaudFiltrada
        };
      })(),
      // ── Comisiones por cheques ────────────────────────────────────────
      chequeComisiones: (()=>{
        const FECHA_CORTE3 = fechaDesde || "2026-04-14";
        const FECHA_HASTA3 = fechaHasta || "9999-12-31";

        const opsDia = ops.filter(o=>o.tipo==="cheque_dia"&&o.fecha>=FECHA_CORTE3&&o.fecha<=FECHA_HASTA3);
        // Devengado: por fecha de recepción del cheque
        const opsDifDevengado = ops.filter(o=>o.tipo==="cheque_dif"&&o.fecha>=FECHA_CORTE3&&o.fecha<=FECHA_HASTA3);
        // Percibido: por fecha de acreditación (dfa)
        const opsDifPercibido = ops.filter(o=>{
          if(o.tipo!=="cheque_dif") return false;
          const dfa = o.datos?.dfa||o.dfa||"";
          return dfa>=FECHA_CORTE3&&dfa<=FECHA_HASTA3;
        });

        const ganDif = o => {
          const dn=parse(o.datos?.dn||o.dn||0);
          const pago=parse(o.datos?.monto||o.monto||0);
          const tasa=parse(o.datos?.te||o.datos?.tasaEndoso||o.tasaEndoso||1.9)/100;
          return dn*(1-tasa)-pago;
        };

        // Cheque al día: comisión directa
        const comDia = opsDia.reduce((s,o)=>s+parse(o.datos?.ccom||o.ccom||0),0);
        // Diferidos devengado (fecha recepción)
        const comDifDevengado = opsDifDevengado.reduce((s,o)=>s+ganDif(o),0);
        // Diferidos percibido (fecha acreditación)
        const comDifPercibido = opsDifPercibido.reduce((s,o)=>s+ganDif(o),0);

        const totalDevengado = comDia + comDifDevengado;
        const totalPercibido = comDia + comDifPercibido;

        // Gráfico devengado (por fecha recepción)
        const datosGrafico = [
          ...opsDia.map(o=>({fecha:o.fecha,valor:parse(o.datos?.ccom||o.ccom||0),valor2:0})),
          ...opsDifDevengado.map(o=>({fecha:o.fecha,valor:0,valor2:ganDif(o)}))
        ].filter(d=>d.fecha);

        // Gráfico percibido (por fecha acreditación)
        const datosPercibido = [
          ...opsDia.map(o=>({fecha:o.fecha,valor:parse(o.datos?.ccom||o.ccom||0),valor2:0})),
          ...opsDifPercibido.map(o=>({fecha:o.datos?.dfa||o.dfa||o.fecha,valor:0,valor2:ganDif(o)}))
        ].filter(d=>d.fecha);

        return {
          comDia, comDifDevengado, comDifPercibido,
          totalDevengado, totalPercibido,
          datosGrafico, datosPercibido,
          opsDia, opsDif:opsDifDevengado, opsDifPercibido
        };
      })(),
      blueHistory: cierres.map(ci=>({fecha:ci.fecha,compra:parse(ci.cotiz_blue?.compra),venta:parse(ci.cotiz_blue?.venta)})).filter(b=>b.venta>0),
      // Nueva estructura multi-moneda
      monedas: {
        USD:  { ...estado.USD,  resumenDias: Object.values(estado.USD.resumenDias),  noRealizada: noRealizadaUSD,  unidad: "ARS", label: "💵 USD",  color: "#f59e0b" },
        USDT: { ...estado.USDT, resumenDias: Object.values(estado.USDT.resumenDias), noRealizada: noRealizadaUSDT, unidad: "USD", label: "🟡 USDT", color: "#fbbf24" },
        EUR:  { ...estado.EUR,  resumenDias: Object.values(estado.EUR.resumenDias),  noRealizada: null,            unidad: "ARS", label: "💶 EUR",  color: "#a78bfa" },
        BRL:  { ...estado.BRL,  resumenDias: Object.values(estado.BRL.resumenDias),  noRealizada: null,            unidad: "ARS", label: "🇧🇷 BRL",  color: "#4ade80" },
        GBP:  { ...estado.GBP,  resumenDias: Object.values(estado.GBP.resumenDias),  noRealizada: null,            unidad: "ARS", label: "🇬🇧 GBP",  color: "#e879f9" },
      },
    };
  }
  function calcularTenencia(cierres, movsCC, diferidos) {
    const FECHA_CORTE_T = "2026-04-14";
    const cierresFiltrados = cierres.filter(c => c.fecha >= FECHA_CORTE_T);
    if (cierresFiltrados.length < 2) return null;
    cierres = cierresFiltrados;

    // Saldo CC por moneda acumulado hasta una fecha
    function saldoCCHasta(fecha) {
      const s = {USD:0,ARS:0,BRL:0,GBP:0,EUR:0,USDT:0};
      (movsCC||[]).filter(m=>m.fecha<=fecha).forEach(m=>{
        const mon = String(m.moneda||"").trim().toUpperCase();
        if(s[mon]===undefined) return;
        const ing = m.tipo==="ingreso_transf"||m.tipo==="ingreso_dep";
        s[mon] += ing ? -Number(m.monto) : Number(m.monto);
      });
      return s;
    }

    // Dias de tenencia en CCs — para calcular promedio
    // Para cada movimiento de entrada, buscamos cuándo se canceló
    function calcDiasTenenciaCC() {
      const movsPorCliente = {};
      (movsCC||[]).filter(m=>m.fecha>=FECHA_CORTE_T).forEach(m=>{
        const key = m.cliente_id+"_"+m.moneda;
        if(!movsPorCliente[key]) movsPorCliente[key]=[];
        movsPorCliente[key].push({...m, monto:Number(m.monto)});
      });
      let totalDias=0, totalMonto=0;
      Object.values(movsPorCliente).forEach(movs=>{
        movs.sort((a,b)=>((a.fecha||"")+(a.hora||"")).localeCompare((b.fecha||"")+(b.hora||"")));
        let saldo=0;
        movs.forEach((mv,i)=>{
          const ing=mv.tipo==="ingreso_transf"||mv.tipo==="ingreso_dep";
          const antes=saldo;
          saldo += ing ? -mv.monto : mv.monto;
          // Si era deuda nuestra (negativo) y se redujo → alguien esperó
          if(antes<0&&saldo>antes&&i>0){
            const diasEsp = diasEntre(movs[i-1].fecha, mv.fecha);
            const montoEsp = Math.abs(antes);
            totalDias += diasEsp * montoEsp;
            totalMonto += montoEsp;
          }
        });
      });
      return totalMonto>0 ? (totalDias/totalMonto).toFixed(1) : null;
    }

    let ganUSD=0, ganARSCaja=0, ganARSCC=0, ganUSDCC=0;
    const detalleDias = [];

    for (let i=0; i<cierres.length-1; i++) {
      const c1 = cierres[i];
      const c2 = cierres[i+1];
      const sf1 = c1.saldos_finales || {};
      const blue1 = parse(c1.cotiz_blue?.venta) || parse(c1.cotiz_blue?.compra) || parse(c1.cotizaciones?.ARS) || 0;
      const blue2 = parse(c2.cotiz_blue?.venta) || parse(c2.cotiz_blue?.compra) || parse(c2.cotizaciones?.ARS) || 0;
      if (!blue1||!blue2) continue;
      const varBlue = blue2 - blue1;
      const pctBlue = varBlue / blue1;

      // Saldos CC hasta este cierre
      const ccFecha = saldoCCHasta(c1.fecha);

      // 1. USD físico en caja
      const usdFisico = parse(sf1.USD||0);
      const ganUSDFisicoDia = usdFisico * varBlue;
      ganUSD += ganUSDFisicoDia;

      // 2. USD en CCs (nos deben USD → positivo = ganamos si blue sube)
      const usdCC = ccFecha.USD || 0;
      const ganUSDCCDia = usdCC * varBlue;
      ganUSDCC += ganUSDCCDia;

      // 3. ARS físico en caja — costo de oportunidad vs dolarizarse
      // Si el blue sube y tenés ARS, perdés poder adquisitivo en USD
      const arsFisico = parse(sf1.ARS||0);
      const arsFisicoEnUSD = blue1 > 0 ? arsFisico / blue1 : 0;
      const ganARSFisicoDia = -(arsFisicoEnUSD * (blue2 - blue1)); // perdés USD si blue sube
      ganARSCaja += ganARSFisicoDia;

      // 4. ARS en CCs — mismo efecto que ARS en caja
      // arsCC > 0 = nos deben ARS → si blue sube esos ARS valen menos en USD
      // arsCC < 0 = les debemos ARS → si blue sube nos conviene (pagamos con ARS que se devalúan)
      const arsCC = ccFecha.ARS || 0;
      const arsCCEnUSD = blue1 > 0 ? arsCC / blue1 : 0;
      const ganARSCCDia = -(arsCCEnUSD * (blue2 - blue1));
      ganARSCC += ganARSCCDia;

      detalleDias.push({
        fecha: c1.fecha,
        blue1: Math.round(blue1),
        blue2: Math.round(blue2),
        varBlue: Math.round(varBlue),
        pctBlue: (pctBlue*100).toFixed(2),
        // Saldos
        usdFisico: Math.round(usdFisico),
        arsFisico: Math.round(arsFisico),
        usdCC: Math.round(usdCC),
        arsCC: Math.round(arsCC),
        // Efectos
        ganUSDFisico: Math.round(ganUSDFisicoDia),
        ganARSFisico: Math.round(ganARSFisicoDia),
        ganUSDCC: Math.round(ganUSDCCDia),
        ganARSCC: Math.round(ganARSCCDia),
        totalDia: Math.round(ganUSDFisicoDia + ganARSFisicoDia + ganUSDCCDia + ganARSCCDia),
      });
    }

    // Cheques cobrados con tasa
    const chequesCobrados = (diferidos||[]).filter(d=>d.cobrado && !d.manual && d.tm && Number(d.tm)>0);
    const totalChequesCobrados = chequesCobrados.reduce((s,d)=>s+(Number(d.ganancia)||0),0);
    const cantChequesCobrados = chequesCobrados.length;
    const cantChequesExcluidos = (diferidos||[]).filter(d=>d.cobrado && (d.manual || !d.tm || Number(d.tm)===0)).length;

    // Cheques pendientes — nominal a cobrar
    const chequesPendientes = (diferidos||[]).filter(d=>!d.cobrado && !d.manual && d.tm && Number(d.tm)>0);
    const totalChequesPendientes = chequesPendientes.reduce((s,d)=>s+(Number(d.nominal)||0),0);

    // Promedio dias tenencia CCs
    const diasPromedioCC = calcDiasTenenciaCC();

    const totalSinCheques = Math.round(ganUSD+ganARSCaja+ganARSCC+ganUSDCC);

    return {
      ganUSD: Math.round(ganUSD),
      ganUSDCC: Math.round(ganUSDCC),
      ganARSCaja: Math.round(ganARSCaja),
      ganARSCC: Math.round(ganARSCC),
      ganCheques: Math.round(totalChequesCobrados),
      cantChequesCobrados,
      cantChequesExcluidos,
      chequesPendientes: Math.round(totalChequesPendientes),
      cantChequesPendientes: chequesPendientes.length,
      diasPromedioCC,
      total: Math.round(totalSinCheques + totalChequesCobrados),
      detalleDias,
    };
  }

  if (cargando) return <div style={{color:"#64748b",padding:40,textAlign:"center"}}>Calculando CPP...</div>;
  if (error) return <div style={{color:"#f87171",padding:20}}>{error}</div>;
  if (!resultado) return null;

  const { stockUSD, cpp, gananciaRealizada, gananciaNoRealizada, blueActual, historial, resumenDias, cotizArranque, stockArranque, tenencia, monedas } = resultado;
  if (!monedas) return <div style={{color:"#f87171",padding:20}}>Error en el cálculo CPP. Revisá la consola del browser.</div>;

  // ── helpers de formato ───────────────────────────────────────────────────
  const fmtN = (v,dec=0) => v==null?"—":Number(v).toLocaleString("es-AR",{minimumFractionDigits:dec,maximumFractionDigits:dec});
  const fmtARS = v => v==null?"—":"$"+fmtN(Math.round(v));
  const fmtUSD2 = v => v==null?"—":"USD "+fmtN(v,2);
  const colorGan = v => v==null?"#4b5563":v>=0?"#4ade80":"#f87171";

  // ── Moneda seleccionada ──────────────────────────────────────────────────
  const monActiva = monedas[monedaSel] ? monedaSel : "USD";
  const mon = monedas[monActiva] || {stock:0,cpp:0,ganReal:0,historial:[],resumenDias:[],noRealizada:null,unidad:"ARS",label:"USD",color:"#f59e0b"};
  const ventas = (mon.historial||[]).filter(h=>h.tipo==="venta");
  const volVendido = ventas.reduce((s,v)=>s+v.monto,0);
  const ganProm = volVendido>0 ? mon.ganReal/volVendido : 0;
  const pctMargen = mon.cpp>0 && ganProm ? (ganProm/mon.cpp*100) : 0;

  return (
    <div style={{padding:"16px 16px 40px"}}>
      <div style={{fontSize:9,letterSpacing:4,color:"#f59e0b",marginBottom:4,fontWeight:600}}>ANÁLISIS DE OPERACIONES</div>
      <div style={{fontSize:18,fontWeight:700,color:"#e2e8f0",marginBottom:12}}>Costo Promedio Ponderado Móvil</div>

      {/* Filtro de fechas */}
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:20,background:"rgba(245,158,11,0.04)",border:"1px solid rgba(245,158,11,0.15)",borderRadius:10,padding:"12px 16px"}}>
        <span style={{fontSize:10,color:"#f59e0b",letterSpacing:1,fontWeight:700}}>PERÍODO</span>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <label style={{fontSize:10,color:"#94a3b8"}}>Desde</label>
          <input type="date" value={filtroDesde} onChange={e=>setFiltroDesde(e.target.value)}
            style={{background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"5px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:11,outline:"none"}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <label style={{fontSize:10,color:"#94a3b8"}}>Hasta</label>
          <input type="date" value={filtroHasta} onChange={e=>setFiltroHasta(e.target.value)}
            style={{background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"5px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:11,outline:"none"}}/>
        </div>
        <button onClick={()=>{setFiltroDesde("2026-04-14");setFiltroHasta(new Date().toISOString().split("T")[0]);}}
          style={{fontSize:10,padding:"5px 12px",borderRadius:6,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontFamily:"inherit"}}>
          Reset
        </button>
        <span style={{fontSize:10,color:"#9ca3af",marginLeft:"auto"}}>
          {mon.historial.filter(h=>h.fecha>=filtroDesde&&h.fecha<=filtroHasta).length} ops en el período
        </span>
      </div>

      {/* ── TABS ── */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:"1px solid #1f2937"}}>
        {[{id:"spread",l:"📈 Spread C/V"},{id:"transferencias",l:"💸 Transferencias"},{id:"cheques",l:"📋 Cheques"}].map(t=>(
          <button key={t.id} onClick={()=>setTabAnalisis(t.id)}
            style={{padding:"10px 24px",border:"none",borderBottom:"2px solid "+(tabAnalisis===t.id?"#f59e0b":"transparent"),
              background:"transparent",color:tabAnalisis===t.id?"#f59e0b":"#4b5563",
              cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,transition:"all 0.15s"}}>
            {t.l}
          </button>
        ))}
      </div>

         {tabAnalisis==="spread"&&resultado&&<PantallaCppDashboard resultado={resultado} fmtN={fmtN} colorGan={colorGan}/>}


      {tabAnalisis==="spread"&&(<>{/* Cards por moneda */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
        {Object.entries(monedas||{}).filter(([,m])=>m&&(m.historial?.length>0||m.stock>0)).map(([key,m])=>{
          const vts=m.historial.filter(h=>h.tipo==="venta");
          const vol=vts.reduce((s,v)=>s+v.monto,0);
          const gp=vol>0?m.ganReal/vol:0;
          const isSel=monedaSel===key;
          return (
            <div key={key} onClick={()=>setMonedaSel(key)}
              style={{background:isSel?`rgba(${key==="USD"?"245,158,11":key==="USDT"?"251,191,36":key==="EUR"?"167,139,250":key==="BRL"?"74,222,128":"232,121,249"},0.08)`:"rgba(255,255,255,0.02)",
                border:`1px solid ${isSel?m.color+"66":"rgba(255,255,255,0.07)"}`,
                borderRadius:12,padding:"14px 16px",cursor:"pointer",minWidth:150,flex:"1 1 150px",
                transition:"all 0.15s"}}>
              <div style={{fontSize:10,color:m.color,fontWeight:700,marginBottom:8}}>{m.label}</div>
              <div style={{fontSize:16,fontWeight:700,color:"#e2e8f0",fontFamily:"monospace",marginBottom:6}}>
                {m.unidad==="ARS"?"$":"USD "}{fmtN(Math.round(m.cpp),0)}
                <span style={{fontSize:10,color:"#94a3b8",fontWeight:400,marginLeft:4}}>CPP</span>
              </div>
              <div style={{fontSize:11,color:colorGan(m.ganReal),marginBottom:2,fontWeight:600}}>
                {m.unidad==="ARS"?"$":"USD "}{fmtN(Math.round(m.ganReal))} ganado
              </div>
              <div style={{fontSize:10,color:"#94a3b8",marginBottom:2}}>
                {vol>0?(m.ganReal/vol).toFixed(0)+" "+m.unidad+"/op":"—"} margen prom.
              </div>
              <div style={{fontSize:9,color:"#94a3b8",marginTop:4}}>{m.historial.length} ops · {vol.toFixed(0)} vendido</div>
            </div>
          );
        })}
      </div>

      {/* Detalle de la moneda seleccionada */}
      <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"18px 20px",marginBottom:20}}>
        <div style={{fontSize:10,letterSpacing:2,color:mon.color,marginBottom:14,fontWeight:700}}>{mon.label} — DETALLE</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:16}}>
          {(()=>{
            const volComp=mon.historial.filter(h=>h.tipo==="compra").reduce((s,h)=>s+h.monto,0);
            const ganPorUni=volVendido>0?mon.ganReal/volVendido:0;
            return [
              {l:"CPP ACTUAL",v:(mon.unidad==="ARS"?"$":"")+fmtN(Math.round(mon.cpp),0)+(mon.unidad==="USD"?" USD":""),c:mon.color,hint:"Costo promedio ponderado de tu inventario"},
              {l:"GANANCIA REALIZADA",v:(mon.unidad==="ARS"?"$":"USD ")+fmtN(Math.round(mon.ganReal)),c:colorGan(mon.ganReal),hint:"Suma de todas las ganancias de ventas cerradas"},
              {l:"MARGEN POR UNIDAD",v:ganPorUni?((mon.unidad==="ARS"?"$":"")+fmtN(Math.round(ganPorUni))+(mon.unidad==="USD"?" USD":"")):"—",c:ganPorUni>=0?"#4ade80":"#f87171",hint:"Ganancia promedio por "+monedaSel+" vendido"},
              {l:"MARGEN %",v:pctMargen?pctMargen.toFixed(2)+"%":"—",c:pctMargen>=1?"#4ade80":"#f59e0b",hint:"Margen sobre el CPP"},
              {l:"VOLUMEN COMPRADO",v:fmtN(volComp,0)+" "+monedaSel,c:"#38bdf8",hint:"Total comprado en el período"},
              {l:"VOLUMEN VENDIDO",v:fmtN(volVendido,0)+" "+monedaSel+" · "+ventas.length+" ventas",c:"#a78bfa",hint:"Total vendido en el período"},
            ];
          })().map(({l,v,c,hint})=>(
            <div key={l} style={{padding:"10px 12px",background:"rgba(255,255,255,0.02)",borderRadius:8,border:"1px solid rgba(255,255,255,0.04)"}}>
              <div style={{fontSize:9,color:"#94a3b8",letterSpacing:1,marginBottom:4}}>{l}</div>
              <div style={{fontSize:14,fontWeight:700,color:c,fontFamily:"monospace"}}>{v}</div>
            </div>
          ))}
        </div>

        {/* Historial de ops */}
        {mon.historial.length>0&&(
          <div>
            <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:8}}>HISTORIAL DE OPERACIONES</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{background:"#080d14"}}>
                    {["Fecha","Hora","Tipo","Monto","Cotiz.","CPP antes","CPP después","G. vs CPP","Stock","Cliente"].map(h=>(
                      <th key={h} style={{padding:"7px 10px",textAlign:"left",color:"#94a3b8",fontWeight:600,borderBottom:"1px solid #1f2937",fontSize:9,letterSpacing:1,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...mon.historial].reverse().map((h,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid #0a0a0a",background:h.tipo==="compra"?"rgba(56,189,248,0.03)":"rgba(74,222,128,0.03)"}}>
                      <td style={{padding:"7px 10px",color:"#64748b"}}>{h.fecha}</td>
                      <td style={{padding:"7px 10px",color:"#64748b",fontSize:10}}>{h.hora}</td>
                      <td style={{padding:"7px 10px"}}>
                        <span style={{fontSize:9,padding:"2px 8px",borderRadius:4,background:h.tipo==="compra"?"rgba(56,189,248,0.1)":"rgba(74,222,128,0.1)",color:h.tipo==="compra"?"#38bdf8":"#4ade80",fontWeight:700}}>{h.tipo.toUpperCase()}</span>
                      </td>
                      <td style={{padding:"7px 10px",fontFamily:"monospace",color:"#e2e8f0"}}>{fmtN(h.monto,2)}</td>
                      <td style={{padding:"7px 10px",fontFamily:"monospace",color:"#e2e8f0"}}>{mon.unidad==="ARS"?"$":""}{fmtN(h.cotizOp,2)}{mon.unidad==="USD"?" USD":""}</td>
                      <td style={{padding:"7px 10px",fontFamily:"monospace",color:"#9ca3af"}}>{mon.unidad==="ARS"?"$":""}{fmtN(h.cppAntes,2)}</td>
                      <td style={{padding:"7px 10px",fontFamily:"monospace",color:mon.color,fontWeight:700}}>{mon.unidad==="ARS"?"$":""}{fmtN(h.cppDespues,2)}</td>
                      <td style={{padding:"7px 10px",fontFamily:"monospace",color:colorGan(h.gananciaOp),fontWeight:h.gananciaOp!=null?700:400}}>
                        {h.gananciaOp!=null?(mon.unidad==="ARS"?"$":"")+fmtN(Math.round(h.gananciaOp)):"—"}
                      </td>
                      <td style={{padding:"7px 10px",fontFamily:"monospace",color:"#9ca3af"}}>{fmtN(h.stockDespues,2)}</td>
                      <td style={{padding:"7px 10px",color:"#64748b",fontSize:10}}>{h.cliente}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Resumen por día */}
      {(mon.resumenDias||[]).length>0&&(
        <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"18px 20px"}}>
          <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:12}}>RESUMEN POR DÍA — {monedaSel}</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr style={{background:"#080d14"}}>
                  {["Fecha","Compras","Ventas","G. realizada","G. vs mercado","CPP cierre","Stock cierre"].map(h=>(
                    <th key={h} style={{padding:"7px 10px",textAlign:"left",color:"#94a3b8",fontWeight:600,borderBottom:"1px solid #1f2937",fontSize:9,letterSpacing:1,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...mon.resumenDias].reverse().map((d,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid #0a0a0a"}}>
                    <td style={{padding:"7px 10px",color:"#64748b"}}>{d.fecha}</td>
                    <td style={{padding:"7px 10px",fontFamily:"monospace",color:"#38bdf8"}}>{d.compras>0?fmtN(d.compras,0):"—"}</td>
                    <td style={{padding:"7px 10px",fontFamily:"monospace",color:"#4ade80"}}>{d.ventas>0?fmtN(d.ventas,0):"—"}</td>
                    <td style={{padding:"7px 10px",fontFamily:"monospace",color:colorGan(d.ganancia)}}>{d.ganancia?(mon.unidad==="ARS"?"$":"")+fmtN(Math.round(d.ganancia)):"—"}</td>
                    <td style={{padding:"7px 10px",fontFamily:"monospace",color:colorGan(d.ganVsMercado)}}>{d.ganVsMercado?(mon.unidad==="ARS"?"$":"")+fmtN(Math.round(d.ganVsMercado)):"—"}</td>
                    <td style={{padding:"7px 10px",fontFamily:"monospace",color:mon.color,fontWeight:700}}>{mon.unidad==="ARS"?"$":""}{fmtN(d.cppFinal,2)}</td>
                    <td style={{padding:"7px 10px",fontFamily:"monospace",color:"#9ca3af"}}>{fmtN(d.stockFinal,2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}



      </>)}

      {/* ── SECCIÓN TRANSFERENCIAS ──────────────────────────────────── */}
      {tabAnalisis==="transferencias"&&resultado.transferenciaComisiones&&(()=>{
        const tc = resultado.transferenciaComisiones;
        const BAR_H = 80;
        const maxGan = Math.max(...tc.semanasArr.map(s=>s.ops+s.recaud),1);
        return (
          <div style={{marginTop:24}}>
            <div style={{fontSize:10,letterSpacing:3,color:"#38bdf8",marginBottom:16,fontWeight:700}}>💸 COMISIONES POR TRANSFERENCIAS</div>

            {/* KPIs */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
              {[
                {l:"OPERACIONES + ENTRE CC",v:tc.comOps,c:"#38bdf8",hint:"Comisiones registradas en tabla operaciones"},
                {l:"RECAUDADORA PAGADO",v:tc.comRecaudPagado,c:"#4ade80",hint:"Ganancia ya cobrada de recaudadora"},
                {l:"RECAUDADORA ACREDITADO",v:tc.comRecaudAcred,c:"#f59e0b",hint:"Acreditado pero sin pagar al cliente aún"},
                {l:"RECAUDADORA PENDIENTE",v:tc.comRecaudPend,c:"#f87171",hint:"Aún dentro de las 72hs"},
                {l:"TOTAL EFECTIVO",v:tc.totalEfectivo,c:"#e879f9",hint:"Operaciones + Recaudadora pagado"},
                {l:"TOTAL INCLUYENDO PENDIENTES",v:tc.totalTotal,c:"#a78bfa",hint:"Todo incluyendo acreditado y pendiente"},
              ].map(({l,v,c2,c,hint})=>(
                <div key={l} title={hint} style={{flex:"1 1 150px",background:"#0f1623",border:"1px solid #1f2937",borderRadius:10,padding:"12px 14px",cursor:"help"}}>
                  <div style={{fontSize:9,color:"#94a3b8",letterSpacing:1,marginBottom:4}}>{l}</div>
                  <div style={{fontSize:16,fontWeight:700,color:c,fontFamily:"monospace"}}>${fmtN(Math.round(v))}</div>
                </div>
              ))}
            </div>

            {/* Gráfico interactivo transferencias */}
            <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:14,padding:"18px 20px",marginBottom:14}}>
              <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:12}}>COMISIONES POR PERÍODO (ARS)</div>
              <GraficoBarras
                datos={[
                  ...tc.opsTransf.map(o=>({fecha:o.fecha,valor:parseFloat(o.datos?.tcom||o.tcom||0),valor2:0})),
                  ...tc.recaudFiltrada.map(t=>({fecha:t.fecha,valor:0,valor2:Number(t.ganancia||0)}))
                ].filter(d=>d.fecha)}
                fmtN={fmtN}
                colorPrincipal="#38bdf8"
                colorSecundario="#e879f9"
                labelPrincipal="Ops/Entre CC"
                labelSecundario="Recaudadora"
              />
            </div>

            {/* Listado de operaciones de transferencia */}
            {tc.opsTransf.length>0&&(
              <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:14,padding:"18px 20px",marginBottom:14}}>
                <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:12}}>OPERACIONES CON COMISIÓN ({tc.opsTransf.length})</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead>
                      <tr style={{background:"#080d14"}}>
                        {["Fecha","Hora","Monto","% Com.","Comisión","Cliente","Nota"].map(h=>(
                          <th key={h} style={{padding:"6px 10px",textAlign:"left",color:"#94a3b8",fontWeight:600,borderBottom:"1px solid #1f2937",fontSize:9,letterSpacing:1}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...tc.opsTransf].reverse().map((o,i)=>{
                        const tcom=parseFloat(o.datos?.tcom||o.tcom||0);
                        const tn=parseFloat(o.datos?.tn||o.tn||0);
                        const tpct=parseFloat(o.datos?.tpct||o.tpct||0);
                        return tcom>0?(
                          <tr key={i} style={{borderBottom:"1px solid #0a0a0a"}}>
                            <td style={{padding:"6px 10px",color:"#64748b"}}>{o.fecha}</td>
                            <td style={{padding:"6px 10px",color:"#64748b"}}>{o.hora||o.datos?.hora||""}</td>
                            <td style={{padding:"6px 10px",fontFamily:"monospace",color:"#e2e8f0"}}>${fmtN(Math.round(tn))}</td>
                            <td style={{padding:"6px 10px",color:"#9ca3af"}}>{tpct}%</td>
                            <td style={{padding:"6px 10px",fontFamily:"monospace",color:"#38bdf8",fontWeight:700}}>${fmtN(Math.round(tcom))}</td>
                            <td style={{padding:"6px 10px",color:"#94a3b8"}}>{o.datos?.cliente||o.cliente||""}</td>
                            <td style={{padding:"6px 10px",color:"#64748b",fontSize:10}}>{o.datos?.nota||o.nota||""}</td>
                          </tr>
                        ):null;
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Listado de recaudadora */}
            {tc.recaudFiltrada.length>0&&(
              <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:14,padding:"18px 20px"}}>
                <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:12}}>RECAUDADORA ({tc.recaudFiltrada.length})</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead>
                      <tr style={{background:"#080d14"}}>
                        {["Fecha","Cliente","Recaud.","Enviado","Ganancia","Estado"].map(h=>(
                          <th key={h} style={{padding:"6px 10px",textAlign:"left",color:"#94a3b8",fontWeight:600,borderBottom:"1px solid #1f2937",fontSize:9,letterSpacing:1}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...tc.recaudFiltrada].reverse().map((t,i)=>(
                        <tr key={i} style={{borderBottom:"1px solid #0a0a0a"}}>
                          <td style={{padding:"6px 10px",color:"#64748b"}}>{t.fecha}</td>
                          <td style={{padding:"6px 10px",color:"#e2e8f0",fontWeight:600}}>{t.cliente_nombre}</td>
                          <td style={{padding:"6px 10px"}}>
                            <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:t.recaudadora==="maltu"?"rgba(56,189,248,0.1)":"rgba(244,114,182,0.1)",color:t.recaudadora==="maltu"?"#38bdf8":"#f472b6",fontWeight:700}}>
                              {t.recaudadora?.toUpperCase()}
                            </span>
                          </td>
                          <td style={{padding:"6px 10px",fontFamily:"monospace",color:"#e2e8f0"}}>${fmtN(Math.round(t.monto_enviado))}</td>
                          <td style={{padding:"6px 10px",fontFamily:"monospace",color:"#4ade80",fontWeight:700}}>${fmtN(Math.round(t.ganancia))}</td>
                          <td style={{padding:"6px 10px"}}>
                            <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,
                              background:t.estado==="pagado"?"rgba(74,222,128,0.1)":t.estado==="acreditado"?"rgba(56,189,248,0.1)":"rgba(245,158,11,0.1)",
                              color:t.estado==="pagado"?"#4ade80":t.estado==="acreditado"?"#38bdf8":"#f59e0b",fontWeight:600}}>
                              {t.estado==="pagado"?"💰 Pagado":t.estado==="acreditado"?"✓ Acreditado":"⏳ Pendiente"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}


      {/* ── SECCIÓN CHEQUES ─────────────────────────────────────────── */}
      {tabAnalisis==="cheques"&&resultado.chequeComisiones&&(()=>{
        const ch = resultado.chequeComisiones;
        const parse2 = v => { try{return parseFloat(v||0)||0}catch{return 0} };
        const fmt2 = v => Number(v||0).toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:0});
        return (
          <div style={{marginTop:8}}>
            <div style={{fontSize:10,letterSpacing:3,color:"#c084fc",marginBottom:16,fontWeight:700}}>📋 COMISIONES POR CHEQUES</div>

            {/* Toggle devengado/percibido */}
            <ChequesCriterioSelector ch={ch} fmtN={fmtN}/>



            {/* Tabla cheques al día */}
            {ch.opsDia.length>0&&(
              <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:14,padding:"18px 20px",marginBottom:14}}>
                <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:12}}>CHEQUES AL DÍA ({ch.opsDia.length})</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead>
                      <tr style={{background:"#080d14"}}>
                        {["Fecha","Nominal","% Com.","Comisión","Cliente"].map(h=>(
                          <th key={h} style={{padding:"6px 10px",textAlign:"left",color:"#94a3b8",fontWeight:600,borderBottom:"1px solid #1f2937",fontSize:9,letterSpacing:1}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...ch.opsDia].reverse().map((o,i)=>(
                        <tr key={i} style={{borderBottom:"1px solid #0a0a0a"}}>
                          <td style={{padding:"6px 10px",color:"#64748b"}}>{o.fecha}</td>
                          <td style={{padding:"6px 10px",fontFamily:"monospace",color:"#e2e8f0"}}>${fmt2(parse2(o.datos?.cn||o.cn||0))}</td>
                          <td style={{padding:"6px 10px",color:"#9ca3af"}}>{parse2(o.datos?.cpct||o.cpct||0)}%</td>
                          <td style={{padding:"6px 10px",fontFamily:"monospace",color:"#38bdf8",fontWeight:700}}>${fmt2(parse2(o.datos?.ccom||o.ccom||0))}</td>
                          <td style={{padding:"6px 10px",color:"#94a3b8"}}>{o.datos?.cliente||o.cliente||""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabla cheques diferidos */}
            {ch.opsDif.length>0&&(
              <div style={{background:"#0f1623",border:"1px solid #1f2937",borderRadius:14,padding:"18px 20px"}}>
                <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:12}}>CHEQUES DIFERIDOS ({ch.opsDif.length})</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead>
                      <tr style={{background:"#080d14"}}>
                        {["Fecha","Nominal","Tasa","Acredita","Pagado","Ganancia","Cliente"].map(h=>(
                          <th key={h} style={{padding:"6px 10px",textAlign:"left",color:"#94a3b8",fontWeight:600,borderBottom:"1px solid #1f2937",fontSize:9,letterSpacing:1}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...ch.opsDif].reverse().map((o,i)=>{
                        const dn=parse2(o.datos?.dn||o.dn||0);
                        const pago=parse2(o.datos?.monto||o.monto||0);
                        const tasa=parse2(o.datos?.te||o.datos?.tasaEndoso||o.tasaEndoso||1.9);
                        const acred=dn*(1-tasa/100);
                        const gan=acred-pago;
                        return (
                          <tr key={i} style={{borderBottom:"1px solid #0a0a0a"}}>
                            <td style={{padding:"6px 10px",color:"#64748b"}}>{o.fecha}</td>
                            <td style={{padding:"6px 10px",fontFamily:"monospace",color:"#e2e8f0"}}>${fmt2(dn)}</td>
                            <td style={{padding:"6px 10px",color:"#9ca3af"}}>{tasa}%</td>
                            <td style={{padding:"6px 10px",fontFamily:"monospace",color:"#94a3b8"}}>${fmt2(Math.round(acred))}</td>
                            <td style={{padding:"6px 10px",fontFamily:"monospace",color:"#94a3b8"}}>${fmt2(pago)}</td>
                            <td style={{padding:"6px 10px",fontFamily:"monospace",color:gan>=0?"#4ade80":"#f87171",fontWeight:700}}>${fmt2(Math.round(gan))}</td>
                            <td style={{padding:"6px 10px",color:"#94a3b8"}}>{o.datos?.cliente||o.cliente||""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}
// ─────────────────────────────────────────────
// FIN PANTALLA ANÁLISIS CPP
// ─────────────────────────────────────────────
function LineChart({ data, color="#4ade80", height=100 }) {
  if (!data||data.length<2) return <div style={{height,display:"flex",alignItems:"center",justifyContent:"center",color:"#64748b",fontSize:11}}>Sin datos suficientes</div>;
  const w=500,h=height,pad=12;
  const vals=data.map(d=>d.y);
  const minV=Math.min(...vals),maxV=Math.max(...vals);
  const range=maxV-minV||1;
  const pts=data.map((d,i)=>{
    const x=pad+(i/(data.length-1))*(w-pad*2);
    const y=h-pad-((d.y-minV)/range)*(h-pad*2);
    return [x,y];
  });
  const path="M"+pts.map(p=>p.join(",")).join(" L");
  const area=path+" L"+pts[pts.length-1][0]+","+(h-pad)+" L"+pts[0][0]+","+(h-pad)+" Z";
  return (
    <svg viewBox={"0 0 "+w+" "+h} style={{width:"100%",height}}>
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill="url(#grad)"/>
      <path d={path} fill="none" stroke={color} strokeWidth="2"/>
      {pts.map((p,i)=>(
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color}/>
      ))}
    </svg>
  );
}

function FormOp({ onGuardar, onCancelar, fechaDefault, titulo, color="#fb923c", opInicial }) {
  const [f, setF] = useState({
    tipo: opInicial?.tipo||"compra", moneda: opInicial?.moneda||"USD",
    monto: opInicial?.monto?String(opInicial.monto):"", moneda2: opInicial?.moneda2||"ARS",
    monto2: opInicial?.monto2?String(opInicial.monto2):"",
    cotizacion: opInicial?.cotizacion?String(opInicial.cotizacion):"",
    cliente: opInicial?.cliente||"", nota: opInicial?.nota||"", hora: opInicial?.hora||"",
    cn: opInicial?.cn?String(opInicial.cn):"", cpct: opInicial?.cpct?String(opInicial.cpct):"",
    dn: opInicial?.dn?String(opInicial.dn):"", dtm:"58", dtg:"2.5",
    dfr: fechaDefault||hoy, dfa: opInicial?.dfa||"",
    tn: opInicial?.tn?String(opInicial.tn):"", tpct: opInicial?.tpct?String(opInicial.tpct):"",
    tcomFijo: opInicial?.tcomFijo?String(opInicial.tcomFijo):"", tmoneda: opInicial?.tmoneda||"ARS", ccOrigenId: opInicial?.ccOrigenId||"", ccDestinoId: opInicial?.ccDestinoId||"",
    ccOrigenBuscar:"", ccDestinoBuscar:"",
  });
  const sf = (k,v) => setF(x=>({...x,[k]:v}));
  const calcDif = useMemo(()=>{
    const n=parse(f.dn),tm=parse(f.dtm),tg=parse(f.dtg),dias=diasEntre(f.dfr,f.dfa);
    if (!n||!dias) return null;
    const postG=n*(1-tg/100),tasaD=(tm/100/360)*dias,mFinal=postG*(1-tasaD);
    return {n,postG,tasaD:tasaD*100,mFinal,ganancia:n-mFinal,dias};
  },[f.dn,f.dtm,f.dtg,f.dfr,f.dfa]);

  function construir() {
    const t=f.tipo;
    const hora=f.hora||new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    if (t==="compra"||t==="venta") {
      const m=parse(f.monto),m2=parse(f.monto2); if (!m||!m2) return null;
      return {tipo:t,hora,moneda:f.moneda,monto:m,moneda2:f.moneda2,monto2:m2,cotizacion:parse(f.cotizacion),cliente:f.cliente,nota:f.nota};
    }
    if (t==="cheque_dia") {
      const cn=parse(f.cn),cpct=parse(f.cpct); if (!cn||!cpct) return null;
      return {tipo:t,hora,cn,cpct,ccom:cn*cpct/100,monto:cn,cliente:f.cliente,nota:f.nota};
    }
    if (t==="cheque_dif") {
      if (!calcDif) return null;
      return {tipo:t,hora,dn:calcDif.n,montoFinal:calcDif.mFinal,dfa:f.dfa,monto:calcDif.mFinal,cliente:f.cliente,nota:f.nota};
    }
    if (t==="transferencia") {
      const tn=parse(f.tn),tcomFijo=parse(f.tcomFijo); if (!tn) return null;
      const neto=tn-tcomFijo;
      return {tipo:t,hora,tn,tpct:0,tcom:tcomFijo,tcomFijo,neto,monto:tcomFijo,ccOrigenId:f.ccOrigenId,ccDestinoId:f.ccDestinoId,cliente:f.cliente,nota:f.nota};
    }
    return null;
  }

  return (
    <div style={{background:"#0d0d0d",border:"1px solid "+color+"33",borderRadius:10,padding:16}}>
      {titulo&&<div style={{fontSize:10,letterSpacing:3,color,marginBottom:12}}>{titulo}</div>}
      <div style={{marginBottom:12,maxWidth:150}}><Lbl>Hora</Lbl><Inp placeholder="14:30" value={f.hora} onChange={e=>sf("hora",e.target.value)}/></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
        {Object.entries(TIPOS_OP).filter(([id])=>!id.startsWith("cc_")&&id!=="ajuste"&&id!=="cobro_dif").map(([id,t])=>(
          <button key={id} onClick={()=>sf("tipo",id)} style={S.btn(f.tipo===id,t.color)}>{t.label}</button>
        ))}
      </div>
      {(f.tipo==="compra"||f.tipo==="venta")&&(
        <div>
          <div style={S.grid("1fr 1fr",8)}>
            <div><Lbl>Moneda base</Lbl><MonedasSel value={f.moneda} onChange={v=>sf("moneda",v)}/></div>
            <div><Lbl>Moneda destino</Lbl><MonedasSel value={f.moneda2} onChange={v=>sf("moneda2",v)} exclude={f.moneda}/></div>
          </div>
          <div style={{marginTop:8,...S.grid("1fr 1fr 1fr",8)}}>
            <div><Lbl>Cantidad</Lbl><Inp type="number" placeholder="0" value={f.monto} onChange={e=>{sf("monto",e.target.value);const c=parse(f.cotizacion);if(c)sf("monto2",String(parse(e.target.value)*c));}}/></div>
            <div><Lbl>Cotizacion</Lbl><Inp type="number" placeholder="0" value={f.cotizacion} onChange={e=>{sf("cotizacion",e.target.value);const m=parse(f.monto);if(m)sf("monto2",String(m*parse(e.target.value)));}}/></div>
            <div><Lbl>Total</Lbl><Inp type="number" placeholder="0" value={f.monto2} onChange={e=>{sf("monto2",e.target.value);const m=parse(f.monto);if(m)sf("cotizacion",String(parse(e.target.value)/m));}}/></div>
          </div>
        </div>
      )}
      {f.tipo==="cheque_dia"&&(
        <div style={S.grid("1fr 1fr",8)}>
          <div><Lbl>Nominal ARS</Lbl><Inp type="number" value={f.cn} onChange={e=>sf("cn",e.target.value)}/></div>
          <div><Lbl>Comision %</Lbl><Inp type="number" value={f.cpct} onChange={e=>sf("cpct",e.target.value)}/></div>
          {f.cn&&f.cpct&&<div style={{gridColumn:"1/-1",background:"#0a1a0a",border:"1px solid #22c55e33",borderRadius:6,padding:"8px 10px",fontSize:12}}>
            Comision: <strong style={{color:"#4ade80"}}>${fmt(parse(f.cn)*parse(f.cpct)/100)}</strong> - Ingresa: <strong>${fmt(parse(f.cn))}</strong>
          </div>}
        </div>
      )}
      {f.tipo==="cheque_dif"&&(
        <div>
          <div style={S.grid("1fr 1fr 1fr",8)}>
            <div><Lbl>Tasa mercado %</Lbl><Inp type="number" value={f.dtm} onChange={e=>sf("dtm",e.target.value)}/></div>
            <div><Lbl>Tasa gestion %</Lbl><Inp type="number" value={f.dtg} onChange={e=>sf("dtg",e.target.value)}/></div>
            <div><Lbl>Nominal</Lbl><Inp type="number" value={f.dn} onChange={e=>sf("dn",e.target.value)}/></div>
            <div><Lbl>Fecha recepcion</Lbl><Inp type="date" value={f.dfr} onChange={e=>sf("dfr",e.target.value)}/></div>
            <div>
              <Lbl>F. vencimiento cheque</Lbl>
              <Inp type="date" value={f.dfv||""} onChange={e=>{
                sf("dfv",e.target.value);
                if(e.target.value) sf("dfa", sumarDiasHabiles(e.target.value, 2));
              }}/>
            </div>
            <div>
              <Lbl>F. acreditacion <span style={{fontSize:9,color:"#6366f1"}}>+2h habiles</span></Lbl>
              <Inp type="date" value={f.dfa} onChange={e=>sf("dfa",e.target.value)}/>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",paddingBottom:6}}><span style={{fontSize:11,color:"#9ca3af"}}>{calcDif?.dias||0}d</span></div>
          </div>
          {calcDif&&<div style={{marginTop:8,background:"#0a0a0a",border:"1px solid #c084fc33",borderRadius:8,padding:10,...S.grid("1fr 1fr 1fr 1fr",8),fontSize:11}}>
            {[["Post-gest.",fmt(calcDif.postG),"#9ca3af"],["Tasa",calcDif.tasaD.toFixed(2)+"%","#9ca3af"],["Pagas",fmt(calcDif.mFinal),"#f87171"],["Ganancia",fmt(calcDif.ganancia),"#4ade80"]].map(([k,v,c])=>(
              <div key={k}><div style={{color:"#94a3b8",marginBottom:2}}>{k}</div><div style={{color:c,fontWeight:700}}>${v}</div></div>
            ))}
          </div>}
        </div>
      )}
      {f.tipo==="transferencia"&&(()=>{
        const tn=parse(f.tn), pctOr=parse(f.tpctOrigen)||0;
        const comOr=tn*(pctOr/100), netoOr=tn-comOr;
        const clOrigen=clientes.find(x=>x.id===Number(f.ccOrigenId));
        const filtOrigen=clientes.filter(x=>(x.nombre+" "+x.apellido).toLowerCase().includes((f.ccOrigenBuscar||"").toLowerCase()));
        const totalDistribuido=tDestinos.reduce((s,d)=>s+parse(d.monto),0);
        const totalComDest=tDestinos.reduce((s,d)=>{const m=parse(d.monto),p=parse(d.pct)||0;return s+m*(p/100);},0);
        const ganTotal=comOr+totalComDest;
        const diferencia=netoOr-totalDistribuido;
        return (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={S.grid("1fr 1fr 1fr",8)}>
              <div><Lbl>Moneda</Lbl><MonedasSel value={f.tmoneda||"ARS"} onChange={v=>sf("tmoneda",v)}/></div>
              <div><Lbl>Monto total origen</Lbl><Inp type="number" placeholder="0" value={f.tn} onChange={e=>sf("tn",e.target.value)}/></div>
              <div><Lbl>% Comisión origen</Lbl><Inp type="number" placeholder="0" value={f.tpctOrigen||""} onChange={e=>sf("tpctOrigen",e.target.value)}/></div>
            </div>
            <div style={{position:"relative"}}>
              <Lbl>CC Origen (quien envía)</Lbl>
              <div style={{display:"flex",gap:4}}>
                {clOrigen&&!f.ccOrigenBuscar&&<div style={{flex:1,padding:"5px 8px",borderRadius:5,background:"rgba(248,113,113,0.08)",border:"1px solid #f8717133",fontSize:10,color:"#f87171",fontWeight:600}}>{clOrigen.nombre} {clOrigen.apellido}</div>}
                <input value={f.ccOrigenBuscar||""} onChange={e=>sf("ccOrigenBuscar",e.target.value)}
                  placeholder={clOrigen&&!f.ccOrigenBuscar?"Cambiar...":"Buscar origen..."}
                  style={{flex:1,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:5,padding:"5px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:10,outline:"none"}}/>
                {f.ccOrigenId&&<button onClick={()=>sf("ccOrigenId","")} style={{padding:"3px 6px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontSize:9}}>✕</button>}
              </div>
              {f.ccOrigenBuscar&&<DropdownCC buscar={f.ccOrigenBuscar} filtrados={filtOrigen} onSelect={cl=>{sf("ccOrigenId",String(cl.id));sf("ccOrigenBuscar","");}} onCrear={nombre=>setNuevoClienteCC({visible:true,nombre,socio:"Manuel Sala",onCreado:cl=>{sf("ccOrigenId",String(cl.id));}})}/>}
            </div>
            {tn>0&&<div style={{background:"#0a1220",border:"1px solid #3b82f633",borderRadius:6,padding:"8px 10px",fontSize:11,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
              <span style={{color:"#9ca3af"}}>Total enviado: <strong style={{color:"#e2e8f0"}}>{fmt(tn)}</strong></span>
              <span style={{color:"#9ca3af"}}>Com. origen ({pctOr}%): <strong style={{color:"#f59e0b"}}>-{fmt(comOr)}</strong></span>
              <span style={{color:"#9ca3af"}}>Neto a distribuir: <strong style={{color:"#4ade80"}}>{fmt(netoOr)}</strong></span>
            </div>}
            <div style={{borderTop:"1px solid #1f2937",paddingTop:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <Lbl>Destinos</Lbl>
                <button onClick={()=>setTDestinos(p=>[...p,{id:Date.now(),clienteId:"",buscar:"",monto:"",pct:"",nota:""}])}
                  style={{padding:"3px 10px",borderRadius:5,background:"rgba(74,222,128,0.1)",border:"1px solid #4ade8044",color:"#4ade80",fontFamily:"inherit",fontSize:10,cursor:"pointer",fontWeight:600}}>+ Agregar destino</button>
              </div>
              {tDestinos.map((dest,idx)=>{
                const clDest=clientes.find(x=>x.id===Number(dest.clienteId));
                const filtDest=clientes.filter(x=>(x.nombre+" "+x.apellido).toLowerCase().includes((dest.buscar||"").toLowerCase()));
                const mDest=parse(dest.monto),pDest=parse(dest.pct)||0,comDest=mDest*(pDest/100);
                return (
                  <div key={dest.id} style={{background:"#0a0f0a",border:"1px solid #1f2937",borderRadius:7,padding:10,marginBottom:8,display:"flex",flexDirection:"column",gap:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:10,color:"#9ca3af",fontWeight:600}}>Destino {idx+1}</span>
                      {tDestinos.length>1&&<button onClick={()=>setTDestinos(p=>p.filter(d=>d.id!==dest.id))} style={{padding:"2px 7px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#f87171",cursor:"pointer",fontSize:9}}>✕</button>}
                    </div>
                    <div style={{position:"relative"}}>
                      <div style={{display:"flex",gap:4}}>
                        {clDest&&!dest.buscar&&<div style={{flex:1,padding:"5px 8px",borderRadius:5,background:"rgba(74,222,128,0.08)",border:"1px solid #4ade8033",fontSize:10,color:"#4ade80",fontWeight:600}}>{clDest.nombre} {clDest.apellido}</div>}
                        <input value={dest.buscar||""} onChange={e=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,buscar:e.target.value}:d))}
                          placeholder={clDest&&!dest.buscar?"Cambiar cliente...":"Buscar cliente destino..."}
                          style={{flex:1,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:5,padding:"5px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:10,outline:"none"}}/>
                        {dest.clienteId&&<button onClick={()=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,clienteId:"",buscar:""}:d))} style={{padding:"3px 6px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontSize:9}}>✕</button>}
                      </div>
                      {dest.buscar&&<DropdownCC buscar={dest.buscar} filtrados={filtDest} onSelect={cl=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,clienteId:String(cl.id),buscar:""}:d))} onCrear={nombre=>setNuevoClienteCC({visible:true,nombre,socio:"Manuel Sala",onCreado:cl=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,clienteId:String(cl.id),buscar:""}:d))})}/>}
                    </div>
                    <div style={S.grid("1fr 1fr 1fr",6)}>
                      <div><Lbl>Monto a recibir</Lbl><Inp type="number" placeholder="0" value={dest.monto} onChange={e=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,monto:e.target.value}:d))}/></div>
                      <div><Lbl>% Comisión</Lbl><Inp type="number" placeholder="0" value={dest.pct} onChange={e=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,pct:e.target.value}:d))}/></div>
                      <div><Lbl>Nota</Lbl><Inp placeholder="opcional" value={dest.nota} onChange={e=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,nota:e.target.value}:d))}/></div>
                    </div>
                    {mDest>0&&<div style={{fontSize:10,color:"#9ca3af",display:"flex",gap:12}}>
                      <span>Recibe: <strong style={{color:"#e2e8f0"}}>{fmt(mDest)}</strong></span>
                      {pDest>0&&<span>Com ({pDest}%): <strong style={{color:"#f59e0b"}}>+{fmt(comDest)}</strong></span>}
                      <span>DEBE en CC: <strong style={{color:"#4ade80"}}>{fmt(mDest+comDest)}</strong></span>
                    </div>}
                  </div>
                );
              })}
            </div>
            {tn>0&&<div style={{background:"#0a1a0a",border:"1px solid #22c55e33",borderRadius:6,padding:"8px 12px",fontSize:11,display:"flex",flexDirection:"column",gap:4}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#9ca3af"}}>Neto a distribuir:</span><strong style={{color:"#e2e8f0"}}>{fmt(netoOr)}</strong></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#9ca3af"}}>Total distribuido:</span><strong style={{color:"#e2e8f0"}}>{fmt(totalDistribuido)}</strong></div>
              <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1f2937",paddingTop:4,marginTop:2}}>
                <span style={{color:Math.abs(diferencia)<0.01?"#6b7280":"#f87171",fontWeight:600}}>Diferencia:</span>
                <strong style={{color:Math.abs(diferencia)<0.01?"#4ade80":"#f87171"}}>{Math.abs(diferencia)<0.01?"✓ Cuadra":fmt(diferencia)}</strong>
              </div>
              {ganTotal>0&&<div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1f2937",paddingTop:4,marginTop:2}}>
                <span style={{color:"#f59e0b",fontWeight:600}}>Ganancia STS:</span>
                <strong style={{color:"#f59e0b"}}>{fmt(ganTotal)}</strong>
              </div>}
            </div>}
          </div>
        );
      })()}
      <div style={{marginTop:10,...S.grid("1fr 1fr",8)}}>
        <div><Lbl>Cliente</Lbl><Inp placeholder="(opcional)" value={f.cliente} onChange={e=>sf("cliente",e.target.value)}/></div>
        <div><Lbl>Nota</Lbl><Inp placeholder="..." value={f.nota} onChange={e=>sf("nota",e.target.value)}/></div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <button onClick={()=>{const d=construir();if(d)onGuardar(d);}} style={{flex:1,padding:11,borderRadius:7,background:"#0a0a0a",border:"1px solid "+color,color,fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>GUARDAR</button>
        {onCancelar&&<button onClick={onCancelar} style={{padding:"11px 16px",borderRadius:7,background:"transparent",border:"1px solid #1f2937",color:"#94a3b8",fontFamily:"inherit",fontSize:12,cursor:"pointer"}}>Cancelar</button>}
      </div>
    </div>
  );
}

function ModalCierre({ saldos, clientes, diferidos, inversiones=[], saldoCC, onCerrar, onCancelar, ultimaCotiz={}, ultimaBlue="" }) {
  const [cotiz, setCotiz] = useState({ ARS:ultimaCotiz.ARS||"", BRL:ultimaCotiz.BRL||"", GBP:ultimaCotiz.GBP||"", EUR:ultimaCotiz.EUR||"", USDT:"1" });
  const [cotizCompra, setCotizCompra] = useState(ultimaBlue?.compra||"");
  const [cotizVenta, setCotizVenta] = useState(ultimaBlue?.venta||"");
  const sc = (k,v) => setCotiz(c=>({...c,[k]:v}));
  // Calcular patrimonio total = caja fisica + CCs + cheques - inversiones
  const patrimonioTotal = useMemo(()=>{
    if (!parse(cotiz.ARS)) return null;
    const tots=Object.fromEntries(["USD","ARS","BRL","GBP","EUR","USDT"].map(mId=>[mId,(clientes||[]).reduce((s,cl)=>s+(saldoCC?saldoCC(cl)[mId]:0),0)]));
    const difPend=(diferidos||[]).filter(d=>!d.cobrado);
    const totalDif=difPend.reduce((s,d)=>{
        const te=parse(d.tasaEndoso||"0");
        if(te>0) return s+d.nominal*(1-te/100);
        return s+(d.mFinal||d.nominal);
      },0);
    // Inversiones activas - capital + intereses
    function calcIntC(monto,tasa,dias){return monto*(Math.pow(1+tasa/100,dias/365)-1);}
    const invsAct=(inversiones||[]).filter(x=>x.activa!==false&&x.estado!=="finalizada");
    const idsInvCierre=invsAct.map(x=>Number(x.cliente_id));
    const totalInv=invsAct.reduce((s,inv)=>{
      const hoyDate=new Date().toISOString().split("T")[0];
      const dias=Math.floor((new Date(hoyDate)-new Date(inv.fecha_inicio))/86400000);
      return s+inv.monto+calcIntC(inv.monto,inv.tasa,dias);
    },0);
    // Tots sin clientes en inversión (ya están en fila Inversiones)
    const totsCC=Object.fromEntries(["USD","ARS","BRL","GBP","EUR","USDT"].map(mId=>[mId,(clientes||[]).filter(c=>!idsInvCierre.includes(Number(c.id))).reduce((s,cl)=>s+(saldoCC?saldoCC(cl)[mId]:0),0)]));
    // Patrimonio = Caja + CC(sin inversores) + Cheques + Inversiones
    const patrimonioSaldos=Object.fromEntries(["USD","ARS","BRL","GBP","EUR","USDT"].map(mId=>[mId,(saldos[mId]||0)+totsCC[mId]+(mId==="ARS"?totalDif:0)-(mId==="USD"?totalInv:0)]));
    return {
      totalUSD: calcTotalUSD(patrimonioSaldos, cotiz),
      cajaUSD: calcTotalUSD(saldos, cotiz),
      saldosPatrimonio: patrimonioSaldos,
      totalDif,
      totalInv,
      totsCC,
      tots: totsCC,
    };
  },[saldos,cotiz,clientes,diferidos,inversiones]);
  const totalUSD = patrimonioTotal?.totalUSD||null;
  const monCotiz = MONEDAS.filter(m=>m.id!=="USD");
  return (
    <div style={{position:"fixed",inset:0,background:"#000000dd",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:500,background:"#0d0d0d",border:"1px solid #94a3b833",borderRadius:12,padding:20}}>
        <div style={{fontSize:11,letterSpacing:3,color:"#94a3b8",marginBottom:4}}>CIERRE DE CAJA</div>
        <div style={{fontSize:12,color:"#94a3b8",marginBottom:20}}>{fechaLarga}</div>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:9,letterSpacing:2,color:"#94a3b8",marginBottom:8}}>SALDOS FINALES</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {MONEDAS.map(m=>{ const v=saldos[m.id]||0; if(!v) return null;
              return <div key={m.id} style={{background:"#111",border:"1px solid "+m.color+"33",borderRadius:6,padding:"5px 10px"}}>
                <span style={{fontSize:9,color:m.color,marginRight:5}}>{m.id}</span>
                <span style={{fontWeight:700}}>{m.simbolo}{fmt(v)}</span>
              </div>;})}
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:9,letterSpacing:2,color:"#94a3b8",marginBottom:8}}>COTIZACIONES DE CIERRE</div>
          <div style={S.grid("1fr 1fr",8)}>
            {monCotiz.map(m=>(
              <div key={m.id}>
                <Lbl><span style={{color:m.color}}>{m.id}</span> {m.id==="ARS"?"— cuantos $ por 1 USD":m.id==="USDT"?"— siempre 1:1 USD":"— cuantos USD vale 1 "+m.id}</Lbl>
                <Inp type="number" 
                  placeholder={m.id==="ARS"?"1400":m.id==="USDT"?"1":m.id==="EUR"?"1.2":m.id==="GBP"?"1.27":m.id==="BRL"?"0.19":""} 
                  value={cotiz[m.id]||""} 
                  disabled={m.id==="USDT"}
                  onChange={e=>sc(m.id,e.target.value)} 
                  sx={{borderColor:m.color+"44",opacity:m.id==="USDT"?0.5:1}}/>
              </div>
            ))}
          </div>
          <div style={{marginTop:8,fontSize:10,color:"#9ca3af"}}>* ARS: pesos por USD (ej: 1400) | EUR/GBP/BRL: valor en USD (ej: EUR=1.2, BRL=0.19)</div>
          <div style={{marginTop:10,display:"flex",gap:8}}>
            <div style={{flex:1}}>
              <Lbl><span style={{color:"#f59e0b"}}>Cotizacion Compra</span></Lbl>
              <Inp type="number" placeholder="ej: 1380" value={cotizCompra} onChange={e=>setCotizCompra(e.target.value)}
                sx={{borderColor:"#f59e0b44"}}/>
            </div>
            <div style={{flex:1}}>
              <Lbl><span style={{color:"#4ade80"}}>Cotizacion Venta</span></Lbl>
              <Inp type="number" placeholder="ej: 1400" value={cotizVenta} onChange={e=>setCotizVenta(e.target.value)}
                sx={{borderColor:"#4ade8044"}}/>
            </div>
          </div>
          {cotizCompra&&cotizVenta&&<div style={{marginTop:6,fontSize:10,color:"#a5b4fc"}}>
            Spread: ${fmt(parse(cotizVenta)-parse(cotizCompra))} ({(((parse(cotizVenta)-parse(cotizCompra))/parse(cotizCompra))*100).toFixed(2)}%)
          </div>}
        </div>
        {totalUSD!==null&&patrimonioTotal&&(
          <div style={{marginBottom:16}}>
            <div style={{background:"#0a0a1a",border:"1px solid #6366f133",borderRadius:8,padding:12,marginBottom:8,textAlign:"center"}}>
              <div style={{fontSize:9,letterSpacing:3,color:"#818cf8",marginBottom:4}}>PATRIMONIO TOTAL EN USD</div>
              <div style={{fontSize:28,fontWeight:700,color:"#818cf8"}}>{fmtUSD(totalUSD)}</div>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>caja + cuentas corrientes + cheques</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1,background:"#0a1a0a",border:"1px solid #22c55e33",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"#94a3b8",marginBottom:3}}>CAJA FISICA</div>
                <div style={{fontSize:16,fontWeight:700,color:"#4ade80"}}>{fmtUSD(patrimonioTotal.cajaUSD)}</div>
              </div>
              <div style={{flex:1,background:"#0a0a1a",border:"1px solid #c084fc33",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"#94a3b8",marginBottom:3}}>CCs + CHEQUES</div>
                <div style={{fontSize:16,fontWeight:700,color:"#c084fc"}}>{fmtUSD(totalUSD-patrimonioTotal.cajaUSD)}</div>
              </div>
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>onCerrar(cotiz,totalUSD,{compra:parse(cotizCompra)||0,venta:parse(cotizVenta)||0})} disabled={!parse(cotiz.ARS)}
            style={{flex:1,padding:12,borderRadius:7,background:parse(cotiz.ARS)?"#052e16":"#0a0a0a",border:"1px solid "+(parse(cotiz.ARS)?"#4ade80":"#1f2937"),color:parse(cotiz.ARS)?"#4ade80":"#374151",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:parse(cotiz.ARS)?"pointer":"not-allowed"}}>
            CERRAR CAJA
          </button>
          <button onClick={onCancelar} style={{padding:"12px 16px",borderRadius:7,background:"transparent",border:"1px solid #1f2937",color:"#94a3b8",fontFamily:"inherit",fontSize:12,cursor:"pointer"}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    if(!email||!pass) { setError("Completa email y contrasena"); return; }
    setLoading(true); setError("");
    const { error:err } = await SB.auth.signInWithPassword({ email, password:pass });
    if (err) { setError("Email o contrasena incorrectos"); setLoading(false); }
    else { onLogin(); }
  }

  return (
    <div style={{minHeight:"100vh",background:"#07090f",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#6366f1,#34d399)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,color:"#fff",margin:"0 auto 16px",fontFamily:"'JetBrains Mono',monospace",boxShadow:"0 8px 32px rgba(99,102,241,0.4)"}}>S</div>
          <div style={{fontSize:20,fontWeight:700,color:"#e2e8f0",fontFamily:"'JetBrains Mono',monospace"}}>STS FINANCIERA</div>
          <div style={{fontSize:12,color:"#94a3b8",marginTop:4}}>Ingresa tus credenciales para continuar</div>
        </div>
        <form onSubmit={handleLogin} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:28}}>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:10,letterSpacing:1.5,color:"#64748b",textTransform:"uppercase",marginBottom:6,fontWeight:600}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="tu@email.com" autoComplete="email"
              style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"11px 14px",color:"#e2e8f0",fontFamily:"inherit",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{display:"block",fontSize:10,letterSpacing:1.5,color:"#64748b",textTransform:"uppercase",marginBottom:6,fontWeight:600}}>Contrasena</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
              placeholder="••••••••" autoComplete="current-password"
              style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"11px 14px",color:"#e2e8f0",fontFamily:"inherit",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
          {error&&<div style={{background:"rgba(244,63,94,0.1)",border:"1px solid rgba(244,63,94,0.3)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#f87171",marginBottom:16}}>{error}</div>}
          <button type="submit" disabled={loading} style={{width:"100%",padding:13,borderRadius:10,background:"linear-gradient(135deg,rgba(99,102,241,0.3),rgba(52,211,153,0.15))",border:"1px solid rgba(99,102,241,0.5)",color:"#a5b4fc",fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:loading?"not-allowed":"pointer",letterSpacing:1,transition:"all .2s",opacity:loading?0.6:1}}>
            {loading?"INGRESANDO...":"INGRESAR"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AppInterna({ usuario }) {
  const [rolUsuario, setRolUsuario] = useState("operador"); // default restringido
  const [hoyState, setHoyState] = useState(getHoy());
  // Actualizar fecha cada minuto por si la app queda abierta de un dia al otro
  useEffect(()=>{
    const t=setInterval(()=>setHoyState(getHoy()),60000);
    return()=>clearInterval(t);
  },[]);
  const hoy=hoyState;
  const [pant, setPant] = useState("ape");
  const [toast, setToast] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cajaIni, setCajaIni] = useState(Object.fromEntries(MONEDAS.map(m=>[m.id,""])));
  const [saldos, setSaldos] = useState(Object.fromEntries(MONEDAS.map(m=>[m.id,0])));
  const [ops, setOps] = useState([]);
  const [diferidos, setDiferidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteActivo, setClienteActivo] = useState(null);
  const [fact, setFact] = useState({ objetivo:"", meses:{} });
  const [posOvr, setPosOvr] = useState({});
  const [tradeHist, setTradeHist] = useState([]);
  const [diaId, setDiaId] = useState(null);
  const [cajaCerrada, setCajaCerrada] = useState(false);
  const [showModalCierre, setShowModalCierre] = useState(false);
  const [ultimaBlue, setUltimaBlue] = useState({compra:0,venta:0});
  const [ultimoRefresh, setUltimoRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [cierres, setCierres] = useState([]);
  const [editandoOp, setEditandoOp] = useState(null);
  const [histFecha, setHistFecha] = useState("");
  const [histOps, setHistOps] = useState([]);
  const [histModo, setHistModo] = useState("ver");
  const [histEditando, setHistEditando] = useState(null);
  const histDias = useMemo(()=>{
    const fechas = new Set(ops.map(o=>o.fecha));
    return [...fechas].sort().reverse();
  },[ops]);
  const [form, setForm] = useState({ tipo:"compra", moneda:"USD", monto:"", moneda2:"ARS", monto2:"", cotizacion:"", cliente:"", nota:"", cn:"", cpct:"", dn:"", dtm:"58", dtg:"2.5", dfr:hoy, dfv:"", dfa:"", tn:"", tpct:"", tcomFijo:"", tmoneda:"ARS", tpctOrigen:"", tpctDestino:"", ccOrigenBuscar:"", ccDestinoBuscar:"", baseImpactaCaja:"si", pagoCheqDif:"caja", pagoCheqDifCCId:"", pagoCheqDifCCBuscar:"" });
  const [formCC, setFormCC] = useState({ tipo:"ingreso_transf", moneda:"ARS", monto:"", nota:"", impactaCaja:true });
  const [tDestinos, setTDestinos] = useState([{id:1,clienteId:"",buscar:"",monto:"",pct:"",nota:""}]);
  const [trade, setTrade] = useState({ modo:"spread_pct", dir:"vendo_base", mBase:"USDT", mQuote:"USD", cant:"", pp:"", po:"", prp:"", pro:"", cCant:"", cPm:"", cPc:"", cCot:"" });
  const [mobileMenu, setMobileMenu] = useState(false);
  const [ultimaCotiz, setUltimaCotiz] = useState({ARS:"",BRL:"",GBP:"",EUR:"",USDT:"1"});
  const [gastos, setGastos] = useState([]);
  const [formGasto, setFormGasto] = useState({categoria:"Alquiler",monto:"",moneda:"ARS",nota:"",fecha:hoy,usaCC:false});
  const CATS_GASTO=["Alquiler","Expensas","Luz","Internet","Sueldos","Impuestos","Fondo de Reserva","Otros"];
  const [socios, setSocios] = useState([]);
  const [nuevoSocio, setNuevoSocio] = useState({nombre:"",monto:""});
  const [aportes, setAportes] = useState([]); // historial de aportes de capital
  const [nuevoAporte, setNuevoAporte] = useState({socioId:"",monto:"",fecha:hoy,nota:"",tipo:"caja"});
  const [mostrarAportes, setMostrarAportes] = useState(false);
  const [editSaldo, setEditSaldo] = useState(null);
  const [editSaldoV, setEditSaldoV] = useState("");
  const [editCell, setEditCell] = useState(null);
  const [editCellV, setEditCellV] = useState("");
  const [editFact, setEditFact] = useState(null);
  const [editFactV, setEditFactV] = useState("");
  const [nuevoMes, setNuevoMes] = useState("");
  const [formDifManual, setFormDifManual] = useState({cliente:"",nominal:"",fechaAcr:"",nota:""});
  const [mostrarFormDif, setMostrarFormDif] = useState(false);
  const [nuevoC, setNuevoC] = useState({ nombre:"", apellido:"", socio:"Manuel Sala" });
  const [busqCliente, setBusqCliente] = useState("");
  const [histDesde, setHistDesde] = useState("");
  const [histHasta, setHistHasta] = useState("");
  const [histFiltroTipo, setHistFiltroTipo] = useState("todos");
  const [histFiltroCliente, setHistFiltroCliente] = useState("");
  const [histModoVista, setHistModoVista] = useState("ops"); // ops | resumen
  const [editandoCliente, setEditandoCliente] = useState(null);
  const [editClienteV, setEditClienteV] = useState({nombre:"",apellido:"",socio:""});
  const [editandoMov, setEditandoMov] = useState(null);
  const [ccMonTab, setCcMonTab] = useState(null);
  const [ccFiltro, setCcFiltro] = useState({desde:"",hasta:""});
  const [cobrandoDif, setCobrandoDif] = useState(null); // id del cheque en proceso de cobro
  const [cobrandoDifCC, setCobrandoDifCC] = useState({modo:"caja",clienteId:"",buscar:""});
  const [mostrarOcultos, setMostrarOcultos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const ultimoInsertRef = useRef(null);
  const [nuevoClienteCC, setNuevoClienteCC] = useState({visible:false,nombre:"",socio:"Manuel Sala",contexto:null});
  const [filtroOps, setFiltroOps] = useState("todas");
  const [dragOverId, setDragOverId] = useState(null);
  const dragSrcId = useRef(null);
  const [desglose, setDesglose] = useState([]); // [{id, tipo:"efectivo"|clienteId|"op_simultanea", monto:"", impactaCaja:true, cotizSim:"", clienteSim:"", monedaSim:"USD", impactaCajaSim:true, clienteSimId:"", clienteSimBuscar:""}]
  const [refForm, setRefForm] = useState({activo:false, clienteId:"", buscar:"", cotizRef:"", cotizTuya:""});
  const [mostrarDesglose, setMostrarDesglose] = useState(false);
  const [pnlData, setPnlData] = useState([]);
  const [recaudTransf, setRecaudTransf] = useState([]);
  const [formRecaud, setFormRecaud] = useState({clienteId:"",clienteNombre:"",recaudadora:"maltu",montoEnviado:"",pctRecaud:1,pctComision:3,fecha:hoy,hora:"",nota:"",ccPagoId:""});
  const [mostrarFormRecaud, setMostrarFormRecaud] = useState(false);
  const [buscarClienteRecaud, setBuscarClienteRecaud] = useState("");
  const [buscarCCPago, setBuscarCCPago] = useState("");
  const [resolviendo, setResolviendo] = useState(null); // {opId, pi, monto, nota, op}
  const [resolverLineas, setResolverLineas] = useState([]); // [{id, tipo:"efectivo"|clienteId, monto:"", buscar:""}]
  const [buscarResolverDrop, setBuscarResolverDrop] = useState({});
  const [usdPendiente, setUsdPendiente] = useState({clienteId:"", buscar:"", monto:"", activo:false});
  const [buscarDesglose, setBuscarDesglose] = useState({});
  const [transCC, setTransCC] = useState({activo:false, destino:"", buscar:"", monto:"", moneda:"ARS", pctOrigen:"", pctDestino:""});
  const [convertirCC, setConvertirCC] = useState({activo:false, monedaOrigen:"USD", monedaDestino:"ARS", monto:"", cotiz:""});
  const [gastoCC, setGastoCC] = useState({activo:false, clienteId:"", buscar:""});
  const [liquidacion, setLiquidacion] = useState({
    pctReserva:"10", mostrando:false,
    patrimonioManual:"", reservaAcumulada:"", sociosCCMap:{}, sociosBuscar:{},
    periodo:"", fechaImpacto:"",
    empleados:[
      {id:1,nombre:"Roberto Spadafora",sueldoFijo:"",cotizSueldo:"",pctVariable:"5",tieneVariable:true,ccId:"",ccBuscar:""},
      {id:2,nombre:"Mauricio Sarquis",sueldoFijo:"",cotizSueldo:"",pctVariable:"",tieneVariable:false,ccId:"",ccBuscar:""}
    ]
  });
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [inversiones, setInversiones] = useState([]); // [{id, clienteId, clienteNombre, monto, tasa, fechaInicio, bloqueoDias, nota, activa}]
  const [nuevaInv, setNuevaInv] = useState({clienteId:"",clienteBuscar:"",monto:"",tasa:"8",bloqueoDias:"30",nota:""});
  const [exportCC, setExportCC] = useState({desde:"",hasta:"",mostrando:false}); // "todas" | "ops" | "ajustes"
  const [editMovV, setEditMovV] = useState({monto:"",nota:"",tipo:"",moneda:"ARS"});
  const SOCIOS_FIJOS=["Manuel Sala","Gonzalo Spadafora","Matias Speranza","STS"];


  const ORDEN_SOCIOS = {
    "Gonzalo Spadafora": 0,
    "Manuel Sala": 1,
    "Matias Speranza": 2,
    "STS": 3,
  };
  const sortClientes = (arr) => [...arr].sort((a,b) => {
    const oa = ORDEN_SOCIOS[a.socio] ?? 99;
    const ob = ORDEN_SOCIOS[b.socio] ?? 99;
    if (oa !== ob) return oa - ob;
    return (a.orden||0) - (b.orden||0); // dentro del mismo socio, orden manual
  });
  const notify = useCallback((msg,ok=true)=>{ setToast({msg,ok}); setTimeout(()=>setToast(null),2800); },[]);
  const setF = useCallback((k,v)=>setForm(f=>({...f,[k]:v})),[]);

  async function crearClienteRapido(nombre, socio, onCreado) {
    if(!nombre.trim()) return;
    const {data:nuevo} = await SB.from("clientes").insert({nombre:nombre.trim(),apellido:"",socio}).select().single();
    if(!nuevo) { notify("Error al crear cliente",false); return; }
    const cl={id:nuevo.id,nombre:nuevo.nombre,apellido:"",socio:nuevo.socio,oculto:false,movimientos:[]};
    setClientes(p=>sortClientes([...p,cl]));
    notify("Cliente creado");
    setNuevoClienteCC({visible:false,nombre:"",socio:"Manuel Sala",contexto:null});
    if(onCreado) onCreado(cl);
  }

  useEffect(()=>{
    async function cargar() {
      setCargando(true);
      try {
        // Asegurar sesion activa antes de cargar datos
        const {data:{session}} = await SB.auth.getSession();
        if (!session) { setCargando(false); return; }
        // Cargar rol del usuario
        if(usuario?.email){
          const {data:rolData} = await SB.from("usuarios_roles").select("rol").eq("email",usuario.email).single();
          if(rolData?.rol) setRolUsuario(rolData.rol);
        }
        // Dia de hoy - schema: id=fecha, caja_ini jsonb, abierta bool
        const {data:dia} = await SB.from("dias").select("*").eq("id",hoy).single();
        if (dia) {
          // Dia de hoy ya existe
          setDiaId(dia.id);
          const ci = dia.caja_ini || {};
          // Verificar si la caja fue abierta hoy
          // Chequear si hay valores en caja_ini (monedas) O en _saldos_finales
          const sf = ci._saldos_finales;
          const tieneMonedas = MONEDAS.some(m=>ci[m.id]&&ci[m.id]!=="");
          const tieneSaldos = sf && Object.values(sf).some(v=>Number(v)!==0);
          const cajaFueAbierta = tieneMonedas || tieneSaldos;
          if (cajaFueAbierta) {
            // Caja ya abierta: cargar saldos y ir al home
            setCajaIni(Object.fromEntries(MONEDAS.map(m=>[m.id, ci[m.id]||""])));
            if(sf) setSaldos(Object.fromEntries(MONEDAS.map(m=>[m.id, Number(sf[m.id])||0])));
            setPant("home");
          } else {
            // Dia existe pero caja no abierta: pre-cargar cajaIni desde ultimo cierre
            let ultimoCierreData = null;
            try { const r = await SB.from("cierres").select("*").order("fecha",{ascending:false}).limit(1).single(); ultimoCierreData=r.data; } catch(e){}
            if (ultimoCierreData?.saldos_finales) {
              setCajaIni(Object.fromEntries(MONEDAS.map(m=>[m.id, ultimoCierreData.saldos_finales[m.id]||""])));
            }
            // Ir a pantalla de apertura
            setPant("ape");
          }
          const ft = ci._fact; if (ft) setFact(ft);
          const po = ci._pos_ovr; if (po) setPosOvr(po);
        } else {
          // Dia nuevo: buscar ultimo cierre primero, si no hay buscar ultimo dia abierto
          let ultimoCierreData = null;
          try { const r = await SB.from("cierres").select("*").order("fecha",{ascending:false}).limit(1).single(); ultimoCierreData=r.data; } catch(e){}
          if (ultimoCierreData?.saldos_finales) {
            const sf = ultimoCierreData.saldos_finales;
            setCajaIni(Object.fromEntries(MONEDAS.map(m=>[m.id, sf[m.id]||""])));
          } else {
            let ultimoDia = null;
            try { const r = await SB.from("dias").select("*").order("id",{ascending:false}).limit(1).single(); ultimoDia=r.data; } catch(e){}
            if (ultimoDia?.caja_ini?._saldos_finales) {
              const sf = ultimoDia.caja_ini._saldos_finales;
              setCajaIni(Object.fromEntries(MONEDAS.map(m=>[m.id, sf[m.id]||""])));
            }
          }
        }
        // Operaciones - schema: id bigint, dia_id, hora, fecha, tipo, datos jsonb
        const {data:opsData} = await SB.from("operaciones").select("*").order("hora",{ascending:true});
        if (opsData) setOps(opsData.map(o=>({...(o.datos||{}), id:o.id, fecha:o.fecha||o.datos?.fecha, hora:o.hora||o.datos?.hora, tipo:o.tipo})));
        // Diferidos - schema: columnas propias (no jsonb datos)
        const {data:difs} = await SB.from("diferidos").select("*");
        if (difs) setDiferidos(difs.map(d=>({
          id:d.id, hora:d.hora, fecha:d.fecha, cliente:d.cliente,
          nominal:d.nominal, mFinal:d.m_final, ganancia:d.ganancia,
          fechaAcr:d.fecha_acr, tm:d.tm, dias:d.dias, cobrado:d.cobrado,
          nota:d.nota||"", manual:d.manual||false,
          fechaCobro:d.fecha_cobro||"", tasaEndoso:d.tasa_endoso||"", fechaVenc:d.fecha_venc||""
        })));
        // Clientes + movimientos - movimientos_cc tiene columnas propias
        const {data:cls} = await SB.from("clientes").select("*");
        const {data:movs} = await SB.from("movimientos_cc").select("*").order("id",{ascending:true}).limit(10000);
        if (cls) {
          const tresor=cls.find(x=>x.nombre==="TRESOR"||x.nombre==="Tresor");
          if(tresor) {
            const movsTresor=(movs||[]).filter(m=>Number(m.cliente_id)===Number(tresor.id));
            console.log("TRESOR id:",tresor.id,"movimientos cargados:",movsTresor.length,"de",movs?.length,"total");
            const salARS=movsTresor.reduce((s,m)=>{
              if(m.moneda!=="ARS") return s;
              const ing=m.tipo==="ingreso_transf"||m.tipo==="ingreso_dep";
              return s+(ing?-Number(m.monto):Number(m.monto));
            },0);
            console.log("TRESOR saldo ARS calculado:",salARS);
          }
          setClientes(sortClientes(cls).map(c=>({
          id:c.id, nombre:c.nombre, apellido:c.apellido, socio:c.socio, oculto:c.oculto||false,
          movimientos:(movs||[]).filter(m=>Number(m.cliente_id)===Number(c.id)).map(m=>({
            id:m.id, hora:m.hora, fecha:m.fecha, tipo:m.tipo,
            moneda:m.moneda, monto:Number(m.monto), nota:m.nota
          }))
        })));}
        // Facturacion
        const {data:factData} = await SB.from("facturacion").select("*").eq("id","config").single();
        if (factData) setFact({objetivo:String(factData.objetivo||""), meses:factData.meses||{}});
        // Pos overrides
        const {data:poData} = await SB.from("pos_overrides").select("*");
        if (poData) setPosOvr(Object.fromEntries(poData.map(p=>[p.id, p.valor])));
        // Gastos
        const {data:gastosData} = await SB.from("gastos").select("*").order("fecha",{ascending:false});
        if (gastosData) setGastos(gastosData);
        // Socios
        const {data:sociosData} = await SB.from("socios").select("*").order("nombre");
        if (sociosData) setSocios(sociosData);
        const {data:aportesData} = await SB.from("aportes_capital").select("*").order("fecha",{ascending:false});
        if (aportesData) setAportes(aportesData);
        const {data:pnlRows} = await SB.from("pnl_diario").select("*").order("fecha",{ascending:false});
        if (pnlRows) setPnlData(pnlRows);
        const {data:recaudRows} = await SB.from("recaudadora_transferencias").select("*").order("fecha",{ascending:false});
        if (recaudRows) setRecaudTransf(recaudRows);
        // Liquidaciones
        const {data:liqData} = await SB.from("liquidaciones").select("*").order("fecha",{ascending:false}).limit(12);
        if (liqData) setLiquidaciones(liqData);
        const {data:invData} = await SB.from("inversiones").select("*").order("fecha_inicio",{ascending:false});
        if (invData) setInversiones(invData.map(x=>({...x,clienteNombre:x.cliente_nombre||""})));
        // Cierres
        const {data:ciData} = await SB.from("cierres").select("*").order("fecha",{ascending:true});
        if (ciData) setCierres(ciData);
        // Pre-cargar ultima cotizacion del ultimo cierre
        if (ciData&&ciData.length>0) {
          const ult=ciData[ciData.length-1];
          if (ult.cotizaciones) setUltimaCotiz(prev=>({...prev,...ult.cotizaciones}));
        if (ult.cotiz_blue) setUltimaBlue(ult.cotiz_blue);
        }
        const {data:ciHoy,error:ciHoyErr} = await SB.from("cierres").select("id").eq("fecha",hoy).single();
        if (ciHoy&&!ciHoyErr) setCajaCerrada(true);
      } catch(e) { console.error("Error carga:",e); }
      setCargando(false);
    }
    cargar();
    // Auto-refresh cada 30 segundos - solo ops y CCs (sin resetear pantalla)
    // Auto-refresh eliminado - usar boton manual Actualizar
  },[]);

  const calcDif = useMemo(()=>{
    const n=parse(form.dn),tm=parse(form.dtm),tg=parse(form.dtg),dias=diasEntre(form.dfr,form.dfa);
    if (!n||!dias) return null;
    const postG=n*(1-tg/100),tasaD=(tm/100/360)*dias,mFinal=postG*(1-tasaD);
    return {n,tm,tg,dias,postG,tasaD:tasaD*100,mFinal,ganancia:n-mFinal};
  },[form.dn,form.dtm,form.dtg,form.dfr,form.dfa]);

  const calcTrade = useMemo(()=>{
    const {modo,dir,mBase,mQuote}=trade;
    if (modo==="cadena") {
      const c=parse(trade.cCant),pm=parse(trade.cPm),pc=parse(trade.cPc),cot=parse(trade.cCot);
      if (!c||!pm||!pc||!cot) return null;
      const uB=c*pm/100,uC=c*pc/100,ars=uC*cot;
      return {modo,cant:c,uB,uC,ars,tc:ars/c,ganancia:uB-uC,spread:pm-pc,mG:"USD"};
    }
    const cant=parse(trade.cant); if (!cant) return null;
    if (modo==="spread_pct") {
      const pm=parse(trade.pp),pc=parse(trade.po); if (!pm||!pc) return null;
      const mM=cant*pm/100,mC=cant*pc/100,gan=dir==="vendo_base"?mM-mC:mC-mM;
      return {modo,dir,cant,mM,mC,ganancia:gan,spread:dir==="vendo_base"?pm-pc:pc-pm,lM:dir==="vendo_base"?"Mercado paga":"Pagas al mercado",lC:dir==="vendo_base"?"Pagas al cliente":"Cobras al cliente",mG:mQuote};
    }
    if (modo==="spread_precio") {
      const pc=parse(trade.prp),pv=parse(trade.pro); if (!pc||!pv) return null;
      return {modo,cant,costo:cant*pc,ingreso:cant*pv,ganancia:cant*pv-cant*pc,spread:((pv-pc)/pc)*100,pc,pv,mG:mQuote};
    }
    return null;
  },[trade]);

  const saldoCC = useCallback((c)=>{
    const s={"USD":0,"ARS":0,"BRL":0,"GBP":0,"EUR":0,"USDT":0};
    // ingreso = recibo plata del cliente = le debo (negativo)
    // retiro = mando plata al cliente = me debe (positivo)
    (c?.movimientos||[]).forEach(mv=>{
      if(!mv||!mv.moneda||!mv.monto) return;
      const moneda=String(mv.moneda).trim().toUpperCase();
      const monto=Number(mv.monto)||0;
      const ing=mv.tipo==="ingreso_transf"||mv.tipo==="ingreso_dep";
      if(s[moneda]!==undefined) s[moneda]+=(ing?-monto:monto);
    });
    return s;
  },[]);

  const movPorMoneda = useMemo(()=>{
    const r=Object.fromEntries(MONEDAS.map(m=>[m.id,{ent:[],sal:[]}]));
    ops.filter(o=>o.fecha===hoy).forEach(op=>{
      const t=op.tipo;
      if (t==="compra")    { r[op.moneda]?.ent.push(op); r[op.moneda2]?.sal.push({...op,monto:op.monto2}); }
      else if (t==="venta"){ r[op.moneda]?.sal.push(op); r[op.moneda2]?.ent.push({...op,monto:op.monto2}); }
      else if (t==="cheque_dia"||t==="cobro_dif") r["ARS"]?.ent.push(op);
      else if (t==="cheque_dif") r["ARS"]?.sal.push(op);
      else if (t==="transferencia") r["ARS"]?.ent.push({...op,monto:op.tcom});
      else if (t==="ajuste") { (op.delta>0?r[op.moneda]?.ent:r[op.moneda]?.sal).push(op); }
      else if (t.startsWith("cc_")) { const ing=t==="cc_ingreso_transf"||t==="cc_ingreso_dep"; (ing?r[op.moneda]?.ent:r[op.moneda]?.sal).push(op); }
    });
    return r;
  },[ops]);

  async function leerSaldoFresco() {
    try {
      const {data} = await SB.from("dias").select("caja_ini").eq("id", hoy).single();
      const sf = data?.caja_ini?._saldos_finales;
      if (sf) return Object.fromEntries(MONEDAS.map(m => [m.id, Number(sf[m.id]) || 0]));
    } catch(e) {}
    return {...saldos};
  }

  async function guardarDia(ns, nf, no) {
    // Guardar facturacion y pos_overrides en sus tablas propias
    const nfinal = nf||fact;
    const nofinal = no||posOvr;
    await SB.from("facturacion").upsert({id:"config", objetivo:parse(nfinal.objetivo), meses:nfinal.meses, updated_at:new Date().toISOString()},{onConflict:"id"});
    // pos_overrides: upsert cada clave
    for (const [k,v] of Object.entries(nofinal)) {
      await SB.from("pos_overrides").upsert({id:k, valor:v, updated_at:new Date().toISOString()},{onConflict:"id"});
    }
    // dias: guardar saldos y caja_ini en caja_ini jsonb
    const cajaData = {...cajaIni, _saldos_finales:ns||saldos};
    await SB.from("dias").upsert({id:hoy, caja_ini:cajaData, abierta:true},{onConflict:"id"});
  }

  async function calcularPnlFifo(fechaCierre, cotizCierre, totalUSD, totalAyer) {
    // Cargar inventario FIFO del día anterior
    const {data:lotesAnt} = await SB.from("inventario_fifo").select("*").lt("fecha", fechaCierre).order("lote_id");
    // Reconstruir FIFO state
    const fifo = {USD:[], USDT:[], EUR:[], BRL:[], GBP:[]};
    (lotesAnt||[]).forEach(l => { if(fifo[l.moneda]) fifo[l.moneda].push({id:l.lote_id,costo_ars:Number(l.costo_ars),cantidad:Number(l.cantidad),fecha_compra:l.fecha_compra,hora_compra:l.hora_compra,cruce:l.cruce_origen}); });

    // Cargar ops del día ordenadas por hora
    const {data:opsData} = await SB.from("operaciones").select("tipo,datos,hora").eq("fecha", fechaCierre).order("hora");
    const opsHoy = (opsData||[]).map(o=>({...o.datos, tipo_op:o.tipo}));

    const pnl = {usdars:0, usdtars:0, usdtusd:0, eur:0, brl:0, gbp:0};
    const fee = {cheqdia:0, cheqdif:0, transf:0, canje:0};
    const detalleOps = [];
    let loteIdCounter = (lotesAnt||[]).reduce((m,l)=>Math.max(m,l.lote_id),0);

    const parseFn = v => { try{return parseFloat(v||0)||0}catch{return 0} };
    const cotizN = parseFn(cotizCierre?.ARS) || 1;

    const consumirFifo = (moneda, cantidad) => {
      let restante = cantidad;
      const consumidos = [];
      while(restante > 0.001 && fifo[moneda].length > 0) {
        const lote = fifo[moneda][0];
        if(lote.cantidad <= restante + 0.001) {
          consumidos.push({...lote, cantidad_consumida: lote.cantidad});
          restante -= lote.cantidad;
          fifo[moneda].shift();
        } else {
          consumidos.push({...lote, cantidad_consumida: restante});
          fifo[moneda][0] = {...lote, cantidad: lote.cantidad - restante};
          restante = 0;
        }
      }
      return consumidos;
    };

    for(const op of opsHoy) {
      const tipo = op.tipo_op;
      const moneda = op.moneda||"", moneda2 = op.moneda2||"";
      const monto = parseFn(op.monto), cotizOp = parseFn(op.cotizacion);

      if(tipo === "cheque_dia") {
        fee.cheqdia += parseFn(op.ccom) / cotizN;
      } else if(tipo === "cheque_dif") {
        const dn=parseFn(op.dn), pago=parseFn(op.monto), tasa=parseFn(op.te||op.tasaEndoso||1.9)/100;
        fee.cheqdif += (dn*(1-tasa)-pago)/cotizN;
      } else if(tipo === "transferencia") {
        fee.transf += parseFn(op.tcom)/cotizN;
      } else if(tipo === "venta" && moneda==="USD" && moneda2==="USD") {
        fee.canje += monto * parseFn(op.tpct||op.pct||0) / 100;
      } else if(tipo === "compra" && monto && cotizOp) {
        loteIdCounter++;
        let costoArs = 0;
        if(moneda==="USD" && moneda2==="ARS") costoArs=cotizOp;
        else if(moneda==="USDT" && moneda2==="ARS") costoArs=cotizOp;
        else if(moneda==="USDT" && moneda2==="USD") costoArs=cotizOp*cotizN;
        else if(moneda==="EUR" && moneda2==="ARS") costoArs=cotizOp;
        else if(moneda==="BRL" && moneda2==="ARS") costoArs=cotizOp;
        else if(moneda==="GBP" && moneda2==="ARS") costoArs=cotizOp;
        if(costoArs && fifo[moneda]) {
          fifo[moneda].push({id:loteIdCounter,costo_ars:costoArs,cantidad:monto,fecha_compra:fechaCierre,hora_compra:op.hora||"",cruce:`${moneda}/${moneda2}`});
        }
      } else if(tipo === "venta" && monto && cotizOp) {
        if(moneda==="USD" && moneda2==="ARS") {
          const cons=consumirFifo("USD",monto);
          cons.forEach(l=>{
            const ganArs=(cotizOp-l.costo_ars)*l.cantidad_consumida;
            const ganUsd=ganArs/cotizN;
            pnl.usdars+=ganUsd;
            detalleOps.push({cruce:"USD/ARS",monto:l.cantidad_consumida,cotiz_op:cotizOp,costo_fifo:l.costo_ars,ganancia_usd:ganUsd,ganancia_ars:ganArs,lote_ref:`Lote #${l.id} @ $${l.costo_ars?.toFixed(0)}`});
          });
        } else if(moneda==="USDT" && moneda2==="ARS") {
          const cons=consumirFifo("USDT",monto);
          cons.forEach(l=>{
            const ganArs=(cotizOp-l.costo_ars)*l.cantidad_consumida;
            const ganUsd=ganArs/cotizN;
            pnl.usdtars+=ganUsd;
            detalleOps.push({cruce:"USDT/ARS",monto:l.cantidad_consumida,cotiz_op:cotizOp,costo_fifo:l.costo_ars,ganancia_usd:ganUsd,ganancia_ars:ganArs,lote_ref:`Lote #${l.id} @ $${l.costo_ars?.toFixed(0)}`});
          });
        } else if(moneda==="USDT" && moneda2==="USD") {
          const cons=consumirFifo("USDT",monto);
          cons.forEach(l=>{
            const precioArs=cotizOp*cotizN;
            const ganArs=(precioArs-l.costo_ars)*l.cantidad_consumida;
            const ganUsd=ganArs/cotizN;
            pnl.usdtusd+=ganUsd;
            detalleOps.push({cruce:"USDT/USD",monto:l.cantidad_consumida,cotiz_op:cotizOp,costo_fifo:l.costo_ars/cotizN,ganancia_usd:ganUsd,ganancia_ars:ganArs,lote_ref:`Lote #${l.id} @ $${l.costo_ars?.toFixed(0)}`});
          });
        } else if(moneda==="EUR" && moneda2==="ARS") {
          const cons=consumirFifo("EUR",monto);
          cons.forEach(l=>{
            const ganArs=(cotizOp-l.costo_ars)*l.cantidad_consumida;
            const ganUsd=ganArs/cotizN;
            pnl.eur+=ganUsd;
            detalleOps.push({cruce:"EUR/ARS",monto:l.cantidad_consumida,cotiz_op:cotizOp,costo_fifo:l.costo_ars,ganancia_usd:ganUsd,ganancia_ars:ganArs,lote_ref:`Lote #${l.id} @ $${l.costo_ars?.toFixed(0)}`});
          });
        } else if(moneda==="BRL" && moneda2==="ARS") {
          const cons=consumirFifo("BRL",monto);
          cons.forEach(l=>{
            const ganArs=(cotizOp-l.costo_ars)*l.cantidad_consumida;
            const ganUsd=ganArs/cotizN;
            pnl.brl+=ganUsd;
            detalleOps.push({cruce:"BRL/ARS",monto:l.cantidad_consumida,cotiz_op:cotizOp,costo_fifo:l.costo_ars,ganancia_usd:ganUsd,ganancia_ars:ganArs,lote_ref:`Lote #${l.id} @ $${l.costo_ars?.toFixed(0)}`});
          });
        }
      }
    }

    // Guardar inventario FIFO actualizado
    const lotesNuevos = [];
    Object.entries(fifo).forEach(([moneda,lotes])=>{
      lotes.forEach(l=>{
        lotesNuevos.push({fecha:fechaCierre,moneda,lote_id:l.id,costo_ars:l.costo_ars,cantidad:l.cantidad,fecha_compra:l.fecha_compra,hora_compra:l.hora_compra,cruce_origen:l.cruce});
      });
    });
    // Borrar lotes anteriores del día y reemplazar
    await SB.from("inventario_fifo").delete().eq("fecha",fechaCierre);
    if(lotesNuevos.length>0) await SB.from("inventario_fifo").insert(lotesNuevos);

    // Calcular P&L
    const cierreAyer = cierres.filter(c=>c.fecha<fechaCierre).sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
    const nivel1 = totalUSD - (cierreAyer?.total_usd||totalUSD);
    const intermediacion = pnl.usdars+pnl.usdtars+pnl.usdtusd+pnl.eur+pnl.brl+pnl.gbp;
    const feeTotal = fee.cheqdia+fee.cheqdif+fee.transf+fee.canje;
    const posicion = nivel1 - intermediacion - feeTotal;

    const pnlRecord = {
      fecha:fechaCierre, nivel1, intermediacion,
      int_usdars:pnl.usdars, int_usdtars:pnl.usdtars, int_usdtusd:pnl.usdtusd,
      int_eur:pnl.eur, int_brl:pnl.brl, int_gbp:pnl.gbp,
      fee_total:feeTotal, fee_cheqdia:fee.cheqdia, fee_cheqdif:fee.cheqdif,
      fee_transf:fee.transf, fee_canje:fee.canje,
      posicion, detalle_ops:detalleOps,
      inventario_cierre:Object.fromEntries(Object.entries(fifo).map(([m,ls])=>[m,ls]))
    };
    await SB.from("pnl_diario").upsert(pnlRecord,{onConflict:"fecha"});
    return pnlRecord;
  }

  async function ejecutarCierre(cotiz, totalUSD, cotizBlue={compra:0,venta:0}) {
    const opsHoy=ops.filter(o=>o.fecha===hoy);
    const resumen=Object.fromEntries(Object.entries(TIPOS_OP).map(([id])=>[id,opsHoy.filter(o=>o.tipo===id).length]));
    const cierre={fecha:hoy,saldos_finales:saldos,saldos_iniciales:cajaIni,cotizaciones:cotiz,total_usd:totalUSD,ops_resumen:resumen,cotiz_blue:cotizBlue};
    await SB.from("cierres").upsert(cierre,{onConflict:"fecha"});
    setCierres(p=>{const sin=p.filter(c=>c.fecha!==hoy);return [...sin,cierre].sort((a,b)=>a.fecha.localeCompare(b.fecha));});
    // Calcular P&L FIFO al cerrar
    try { await calcularPnlFifo(hoy, cotiz, totalUSD, null); } catch(e) { console.error("P&L FIFO error:",e); }
    setCajaCerrada(true); setShowModalCierre(false);
    notify("Caja cerrada correctamente");
  }

  async function abrirCaja() {
    const s=Object.fromEntries(MONEDAS.map(m=>[m.id,parse(cajaIni[m.id])]));
    setSaldos(s);
    const cajaData = {...Object.fromEntries(MONEDAS.map(m=>[m.id,cajaIni[m.id]])), _saldos_finales:s};
    await SB.from("dias").upsert({id:hoy, caja_ini:cajaData, abierta:true},{onConflict:"id"});
    setDiaId(hoy); // Marcar que el dia fue abierto
    setPant("home"); notify("Caja abierta ✓");
  }

  async function resolverPendiente() {
    if (!resolviendo) return;
    const {opId, pi, monto, op} = resolviendo;
    const hora = new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    const moneda = op.moneda2 || "ARS";

    // Validar que el total de líneas cuadre con el monto pendiente
    const totalLineas = resolverLineas.reduce((s,l)=>s+parse(l.monto),0);
    if (Math.abs(totalLineas - monto) > 1) { notify("El total no cuadra con $"+fmt(monto),false); return; }

    let ns = await leerSaldoFresco();
    let cajaCambio = false;

    for (const linea of resolverLineas) {
      const montoLinea = parse(linea.monto);
      if (!montoLinea) continue;

      if (linea.tipo === "efectivo") {
        if (op.tipo === "venta") ns[moneda] = (ns[moneda]||0) + montoLinea;
        else ns[moneda] = (ns[moneda]||0) - montoLinea;
        cajaCambio = true;
      } else {
        // CC cliente
        const cId = Number(linea.tipo);
        if (!cId) continue;
        const tipoMov = op.tipo === "venta" ? "retiro_transf" : "ingreso_transf";
        const notaCC = `Resolución pendiente — ${op.tipo} ${fmt(op.monto)} ${op.moneda} ($${fmt(montoLinea)} ${moneda})`;
        const mv = {id:Date.now()+cId,hora,fecha:hoy,tipo:tipoMov,moneda,monto:montoLinea,nota:notaCC};
        await SB.from("movimientos_cc").insert({cliente_id:cId,hora,fecha:hoy,tipo:tipoMov,moneda,monto:montoLinea,nota:notaCC});
        setClientes(p=>p.map(cl=>cl.id!==cId?cl:{...cl,movimientos:[...cl.movimientos,mv]}));
      }
    }

    if (cajaCambio) { setSaldos(ns); await guardarDia(ns, null, null); }

    // Marcar pendiente como resuelto
    const opActualizada = {...op, pendientes: op.pendientes.map((p,i)=>i===pi?{...p,resuelto:true}:p)};
    await SB.from("operaciones").update({datos:opActualizada}).eq("id",opId);
    setOps(prev=>prev.map(o=>o.id!==opId?o:opActualizada));
    setResolviendo(null);
    setResolverLineas([]);
    setBuscarResolverDrop({});
    notify("Pendiente resuelto ✓");
  }

  async function registrarOp() {
    if (cajaCerrada) { notify("La caja esta cerrada",false); return; }
    if (guardando) { notify("Espera, procesando...",false); return; }
    setGuardando(true);
    ultimoInsertRef.current = Date.now();
    try {
    const {tipo}=form;
    const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    let opData=null, ns=await leerSaldoFresco();
    if (tipo==="compra"||tipo==="venta") {
      const m=parse(form.monto),m2=parse(form.monto2);
      if (!m||!m2) { notify("Ingresa montos validos",false); return; }
      // Validar desglose si está activo
      if (mostrarDesglose&&desglose.length>0) {
        const asignado=desglose.reduce((s,d)=>s+parse(d.monto),0);
        if (Math.abs(asignado-m2)>1) { notify("El desglose no cuadra con el total",false); return; }
      }
      // Impacto en caja base (moneda principal) - solo si no es pendiente CC
      if(form.baseImpactaCaja!=="no"){
        tipo==="compra"?(ns[form.moneda]+=m):(ns[form.moneda]-=m);
      }
      // Si hay desglose, procesar cada línea para la moneda2
      // Si no hay desglose, impacto normal en caja
      if (mostrarDesglose&&desglose.length>0) {
        for (const d of desglose) {
          const dm=parse(d.monto); if(!dm) continue;
          if (d.tipo==="pendiente") continue; // no impacta caja ni CC
          if (d.tipo==="efectivo") {
            // Efectivo siempre impacta caja
            tipo==="compra"?ns[form.moneda2]-=dm:ns[form.moneda2]+=dm;
          } else if (d.tipo==="op_simultanea") {
            // Operación simultánea mejorada — moneda configurable + impacta caja o CC
            const cotizSim = parse(d.cotizSim) || parse(form.cotizacion);
            if (!cotizSim) continue;
            const monSim = d.monedaSim || form.moneda; // moneda que se vende/compra
            const cantSim = dm / cotizSim; // cantidad de monSim que se mueven
            const horaSim = new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
            const tipoSim = tipo==="compra" ? "venta" : "compra";
            const impactaCajaSim = d.impactaCajaSim !== false; // default true

            if (tipo==="compra") {
              // Op principal es COMPRA → simultánea es VENTA de monSim al cliente
              // Los ARS del cliente financian la compra principal — NO van a caja física
              // Solo se mueve la monSim (sale de caja o queda pendiente en CC)
              if (impactaCajaSim) {
                // Sale de caja física
                ns[monSim] = (ns[monSim]||0) - cantSim;
              } else if (d.clienteSimId) {
                // Queda pendiente en CC — nosotros le debemos la monSim
                // ingreso_transf → saldo negativo = le debemos
                const cSimId = Number(d.clienteSimId);
                const notaCC = `Op. simultánea — venta ${fmt(cantSim)} ${monSim} pendiente entrega a $${fmt(cotizSim)}, vinculada a compra ${fmt(m)} ${form.moneda}`;
                await SB.from("movimientos_cc").insert({cliente_id:cSimId,hora:horaSim,fecha:hoy,tipo:"ingreso_transf",moneda:monSim,monto:cantSim,nota:notaCC});
                setClientes(p=>p.map(cl=>cl.id!==cSimId?cl:{...cl,movimientos:[...cl.movimientos,{id:Date.now(),hora:horaSim,fecha:hoy,tipo:"ingreso_transf",moneda:monSim,monto:cantSim,nota:notaCC}]}));
              }
            } else {
              // Op principal es VENTA → simultánea es COMPRA de monSim
              // Los ARS van al cliente por transferencia — NO tocan caja física
              // Solo se mueve la monSim (entra a caja o queda en CC)
              // monSim entra a caja o a CC del cliente
              if (impactaCajaSim) {
                ns[monSim] = (ns[monSim]||0) + cantSim;
              } else if (d.clienteSimId) {
                const cSimId = Number(d.clienteSimId);
                const notaCC = `Op. simultánea — compra ${fmt(cantSim)} ${monSim} vinculada a venta ${fmt(m)} ${form.moneda}`;
                // retiro_transf → saldo positivo = el cliente nos debe la monSim
                await SB.from("movimientos_cc").insert({cliente_id:cSimId,hora:horaSim,fecha:hoy,tipo:"retiro_transf",moneda:monSim,monto:cantSim,nota:notaCC});
                setClientes(p=>p.map(cl=>cl.id!==cSimId?cl:{...cl,movimientos:[...cl.movimientos,{id:Date.now(),hora:horaSim,fecha:hoy,tipo:"retiro_transf",moneda:monSim,monto:cantSim,nota:notaCC}]}));
              }
            }
            // Registrar la op simultánea en operaciones
            const opSimData = {
              tipo: tipoSim, hora: horaSim,
              moneda: monSim, monto: cantSim,
              moneda2: form.moneda2, monto2: dm,
              cotizacion: cotizSim,
              cliente: d.clienteSim || "",
              nota: "Op. simultánea — " + tipoSim + " " + fmt(cantSim) + " " + monSim + " a $" + fmt(cotizSim) + (impactaCajaSim?" (caja)":" (CC)"),
            };
            const {data:insSim} = await SB.from("operaciones").insert({
              dia_id: hoy, fecha: hoy, hora: horaSim, tipo: tipoSim, datos: opSimData
            }).select().single();
            if (insSim) setOps(p=>[...p,{...opSimData,id:insSim.id,fecha:hoy}]);
          } else {
            // Cliente CC
            const cId=Number(d.tipo);
            const cliente=clientes.find(cl=>cl.id===cId);
            if(!cliente) continue;
            // Venta de USD: cliente me transfiere ARS → él me debe (retiro_transf = yo le mandé, positivo para mí)
            // Compra de USD: yo/tercero le manda ARS → le debo (ingreso_transf = recibí plata, negativo para mí)
            const tipoMov=tipo==="venta"?"retiro_transf":"ingreso_transf";
            const horaCC=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
            const opDesc="Op. vinculada - "+(tipo==="venta"?"Venta":"Compra")+" "+fmt(m)+" "+form.moneda+(form.cliente?" ("+form.cliente+")":"");
            const mv={id:Date.now()+cId,hora:horaCC,fecha:hoy,tipo:tipoMov,moneda:form.moneda2,monto:dm,nota:opDesc};
            await SB.from("movimientos_cc").insert({cliente_id:cId,hora:mv.hora,fecha:mv.fecha,tipo:mv.tipo,moneda:mv.moneda,monto:mv.monto,nota:mv.nota});
            setClientes(p=>p.map(cl=>cl.id!==cId?cl:{...cl,movimientos:[...cl.movimientos,mv]}));
            if (d.impactaCaja) {
              tipo==="compra"?ns[form.moneda2]-=dm:ns[form.moneda2]+=dm;
            }
            // Acreditar moneda base en CC del cliente
            if (d.acreditarBase) {
              const montoBase=m; // monto en moneda base (ej: USD)
              // En venta: le damos USD al cliente → retiro_transf de USD en su CC (nos debe USD → positivo para nosotros)
              // En compra: recibimos USD del cliente → ingreso_transf de USD en su CC (le debemos USD → negativo para nosotros)  
              const tipoMovBase=tipo==="venta"?"ingreso_transf":"retiro_transf";
              const mvBase={id:Date.now()+cId+1,hora:horaCC,fecha:hoy,tipo:tipoMovBase,moneda:form.moneda,monto:montoBase,nota:"Op. vinculada - "+(tipo==="venta"?"Venta":"Compra")+" "+fmt(montoBase)+" "+form.moneda};
              await SB.from("movimientos_cc").insert({cliente_id:cId,hora:mvBase.hora,fecha:mvBase.fecha,tipo:mvBase.tipo,moneda:mvBase.moneda,monto:mvBase.monto,nota:mvBase.nota});
              setClientes(p=>p.map(cl=>cl.id!==cId?cl:{...cl,movimientos:[...cl.movimientos,mvBase]}));
            }
          }
        }
      } else {
        tipo==="compra"?ns[form.moneda2]-=m2:ns[form.moneda2]+=m2;
      }
      // Calcular impactoReal2: cuanto impacto la caja en moneda2
      let impactoReal2=m2; // por defecto todo
      if(mostrarDesglose&&desglose.length>0){
        impactoReal2=desglose.filter(d=>d.tipo!=="sincc"&&d.tipo!=="pendiente").reduce((s,d)=>{
          const dm=parse(d.monto); if(!dm) return s;
          if(d.tipo==="efectivo") return s+dm;
          return s+(d.impactaCaja?dm:0);
        },0);
      } else if(form.baseImpactaCaja==="no"){
        impactoReal2=0; // pendiente CC, no impacto caja en moneda2
      }
      const pendientesGuardar=mostrarDesglose?desglose.filter(d=>d.tipo==="pendiente").map(d=>({monto:parse(d.monto),nota:d.notaPendiente||"",resuelto:false})):[];
      opData={tipo,hora,moneda:form.moneda,monto:m,moneda2:form.moneda2,monto2:m2,impactoReal2,baseImpactaCaja:form.baseImpactaCaja||"si",cotizacion:parse(form.cotizacion),cliente:form.cliente,nota:form.nota,pendientes:pendientesGuardar};
      // Procesar base pendiente (no impacta caja)
      if(form.baseImpactaCaja==="no"&&usdPendiente.clienteId){
        const cPendId2=Number(usdPendiente.clienteId);
        const montoPend2=parse(form.monto);
        const horaPend2=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
        const notaPend2=(tipo==="compra"?"Compra":"Venta")+" "+fmt(montoPend2)+" "+form.moneda+" - pendiente entrega";
        // compra: cliente nos debe los USD → retiro_transf (DEBE = nos debe)
        // venta: nosotros le debemos los USD al cliente → ingreso_transf (HABER = le debemos)
        const tipoPend2=tipo==="compra"?"retiro_transf":"ingreso_transf";
        const mvPend2={id:Date.now()+998,hora:horaPend2,fecha:hoy,tipo:tipoPend2,moneda:form.moneda,monto:montoPend2,nota:notaPend2};
        await SB.from("movimientos_cc").insert({cliente_id:cPendId2,hora:horaPend2,fecha:hoy,tipo:tipoPend2,moneda:form.moneda,monto:montoPend2,nota:notaPend2});
        setClientes(p=>p.map(cl=>cl.id!==cPendId2?cl:{...cl,movimientos:[...cl.movimientos,mvPend2]}));
      }
      // Procesar USD pendiente de entrega (desglose)
      if(usdPendiente.activo&&usdPendiente.clienteId&&(parse(usdPendiente.monto)||parse(form.monto))){
        const cPendId=Number(usdPendiente.clienteId);
        const montoPend=parse(usdPendiente.monto)||parse(form.monto);
        const monPend=tipo==="venta"?form.moneda:form.moneda2;
        const horaPend=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
        const notaPend="Entrega diferida - "+(tipo==="venta"?"Venta":"Compra")+" "+fmt(montoPend)+" "+monPend;
        const mvPend={id:Date.now()+999,hora:horaPend,fecha:hoy,tipo:"retiro_transf",moneda:monPend,monto:montoPend,nota:notaPend};
        await SB.from("movimientos_cc").insert({cliente_id:cPendId,hora:horaPend,fecha:hoy,tipo:"retiro_transf",moneda:monPend,monto:montoPend,nota:notaPend});
        setClientes(p=>p.map(cl=>cl.id!==cPendId?cl:{...cl,movimientos:[...cl.movimientos,mvPend]}));
        setUsdPendiente({clienteId:"",buscar:"",monto:"",activo:false});
      }
      setF("monto",""); setF("monto2",""); setF("cotizacion","");
      setDesglose([]); setMostrarDesglose(false); setF("baseImpactaCaja","si");
    } else if (tipo==="cheque_dia") {
      const cn=parse(form.cn),cpct=parse(form.cpct);
      if (!cn||!cpct) { notify("Ingresa nominal y %",false); return; }
      ns.ARS+=cn;
      opData={tipo,hora,cn,cpct,ccom:cn*cpct/100,monto:cn,cliente:form.cliente,nota:form.nota};
      setF("cn",""); setF("cpct","");
    } else if (tipo==="cheque_dif") {
      if (!calcDif) { notify("Completa todos los campos",false); return; }
      const dif={id:Date.now(),hora,fecha:hoy,cliente:form.cliente,nominal:calcDif.n,mFinal:calcDif.mFinal,ganancia:calcDif.ganancia,fechaAcr:form.dfa,tm:parse(form.dtm),dias:calcDif.dias,cobrado:false};
      const {data:difIns}=await SB.from("diferidos").insert({hora:dif.hora,fecha:dif.fecha,cliente:dif.cliente||"",nominal:dif.nominal,m_final:dif.mFinal,ganancia:dif.ganancia,fecha_acr:dif.fechaAcr,fecha_venc:form.dfv||"",tm:dif.tm,dias:dif.dias,cobrado:false,fecha_cobro:"",tasa_endoso:""}).select().single();
      if(difIns) dif.id=difIns.id;
      setDiferidos(d=>[...d,dif]);
      opData={tipo,hora,dn:calcDif.n,montoFinal:calcDif.mFinal,dfa:form.dfa,monto:calcDif.mFinal,cliente:form.cliente,nota:form.nota,pagoCheqDif:form.pagoCheqDif,pagoCheqDifCCId:form.pagoCheqDifCCId};
      if(form.pagoCheqDif==="cc"&&form.pagoCheqDifCCId){
        // Pago a CC: genera ingreso_transf (le debemos al cliente)
        const cCCId=Number(form.pagoCheqDifCCId);
        const notaCC="Cheque diferido — nominal $"+fmt(calcDif.n)+" — pago $"+fmt(calcDif.mFinal)+" — acredita "+form.dfa;
        const mv={id:Date.now()+1,hora,fecha:hoy,tipo:"ingreso_transf",moneda:"ARS",monto:calcDif.mFinal,nota:notaCC};
        await SB.from("movimientos_cc").insert({cliente_id:cCCId,hora,fecha:hoy,tipo:"ingreso_transf",moneda:"ARS",monto:calcDif.mFinal,nota:notaCC});
        setClientes(p=>p.map(cl=>cl.id!==cCCId?cl:{...cl,movimientos:[...cl.movimientos,mv]}));
        notify("Cheque diferido registrado ✓ — acreditado en CC del cliente");
      } else {
        // Pago de caja física
        ns.ARS-=calcDif.mFinal;
        notify("Cheque diferido registrado ✓ — debitado de caja física");
      }
      setF("dn",""); setF("dfa",""); setF("pagoCheqDif","caja"); setF("pagoCheqDifCCId",""); setF("pagoCheqDifCCBuscar","");
    } else if (tipo==="transferencia") {
      const tn=parse(form.tn);
      if (!tn) { notify("Ingresa un monto",false); return; }
      const tMon=form.tmoneda||"ARS";
      const pctOrigen=parse(form.tpctOrigen)||0;
      const comOrigen=tn*(pctOrigen/100);
      const netoOrigen=tn-comOrigen;
      const destinos=tDestinos.filter(d=>d.clienteId&&parse(d.monto)>0);
      if(destinos.length===0){notify("Agregá al menos un destino",false);return;}
      // ── Verificar duplicados en transferencias ──────────────────────
      const ahoraMs = Date.now();
      const dosHorasMs = 2*60*60*1000;
      const posiblesDup = movsCC.filter(mv => {
        if(mv.tipo!=="retiro_transf") return false;
        const mvMs = new Date(mv.fecha+"T"+(mv.hora||"00:00").replace("p. m.","PM").replace("a. m.","AM")).getTime();
        if(isNaN(mvMs)||Math.abs(ahoraMs-mvMs)>dosHorasMs) return false;
        return destinos.some(d=>Number(d.clienteId)===mv.cliente_id&&Math.abs(parse(d.monto)-mv.monto)<1);
      });
      if(posiblesDup.length>0){
        const clDup=clientes.find(x=>x.id===posiblesDup[0].cliente_id)?.nombre||"cliente";
        const confirmDup=window.confirm("⚠ POSIBLE DUPLICADO\n\nYa existe una transferencia similar a "+clDup+" por $"+fmt(posiblesDup[0].monto)+" en las últimas 2 horas.\n\n¿Confirmar igualmente?");
        if(!confirmDup) return;
      }
      const nombreOrigen=clientes.find(x=>x.id===Number(form.ccOrigenId))?.nombre||"origen";
      const totalComDest=destinos.reduce((s,d)=>{const m=parse(d.monto),p=parse(d.pct)||0;return s+m*(p/100);},0);
      const gananciaFin=comOrigen+totalComDest;
      const nombresDestino=destinos.map(d=>clientes.find(x=>x.id===Number(d.clienteId))?.nombre||"dest").join(", ");
      opData={tipo,hora,tn,tpct:pctOrigen,tpctOrigen:pctOrigen,tcom:gananciaFin,netoOrigen,monto:gananciaFin,ccOrigenId:form.ccOrigenId,tmoneda:tMon,destinos:destinos.map(d=>({clienteId:d.clienteId,monto:parse(d.monto),pct:parse(d.pct)||0,nota:d.nota})),cliente:form.cliente,nota:form.nota};
      // Insertar operación primero para vincular movimientos CC con operacion_id
      setSaldos(ns);
      const {data:opIns}=await SB.from("operaciones").insert({dia_id:hoy,fecha:hoy,hora,tipo,datos:opData}).select().single();
      const opIdTransf=opIns?.id||null;
      if(opIns) setOps(p=>[...p,{...opData,id:opIns.id,fecha:hoy}]);
      // CC Origen: HABER por el neto (le debemos el neto)
      if(form.ccOrigenId){
        const cOrId=Number(form.ccOrigenId);
        const notaOr="Transf. → "+nombresDestino+" - neto "+fmt(netoOrigen)+" "+tMon+(pctOrigen?" (com "+pctOrigen+"%)":"");
        const mvOr={id:Date.now()+1,hora,fecha:hoy,tipo:"ingreso_transf",moneda:tMon,monto:netoOrigen,nota:notaOr};
        await SB.from("movimientos_cc").insert({cliente_id:cOrId,hora,fecha:hoy,tipo:"ingreso_transf",moneda:tMon,monto:netoOrigen,nota:notaOr,operacion_id:opIdTransf});
        setClientes(p=>p.map(cl=>cl.id!==cOrId?cl:{...cl,movimientos:[...cl.movimientos,mvOr]}));
      }
      // CC Destinos: DEBE por monto + comision de cada uno
      for(let i=0;i<destinos.length;i++){
        const d=destinos[i];
        const cDId=Number(d.clienteId);
        const mDest=parse(d.monto), pDest=parse(d.pct)||0, comDest=mDest*(pDest/100), totalDest=mDest+comDest;
        const clDest=clientes.find(x=>x.id===cDId);
        const notaDest=(d.nota||("Transf. de "+nombreOrigen+" - "+fmt(mDest)+" "+tMon+(pDest?" (com "+pDest+"%)":"")));
        const mvDest={id:Date.now()+(i+2),hora,fecha:hoy,tipo:"retiro_transf",moneda:tMon,monto:totalDest,nota:notaDest};
        await SB.from("movimientos_cc").insert({cliente_id:cDId,hora,fecha:hoy,tipo:"retiro_transf",moneda:tMon,monto:totalDest,nota:notaDest,operacion_id:opIdTransf});
        setClientes(p=>p.map(cl=>cl.id!==cDId?cl:{...cl,movimientos:[...cl.movimientos,mvDest]}));
      }
      setF("tn",""); setF("tpctOrigen",""); setF("ccOrigenId",""); setF("ccOrigenBuscar","");
      setTDestinos([{id:1,clienteId:"",buscar:"",monto:"",pct:"",nota:""}]);
      // Skip normal op insert — ya se insertó arriba
      opData=null;
    }
    if (!opData) return;
    setSaldos(ns);
    const {data:ins}=await SB.from("operaciones").insert({dia_id:hoy,fecha:hoy,hora,tipo,datos:opData}).select().single();
    if (ins) setOps(p=>[...p,{...opData,id:ins.id,fecha:hoy}]);

    // Comisión referidor en ARS
    if (refForm.activo && refForm.clienteId && refForm.cotizRef && refForm.cotizTuya && (tipo==="compra"||tipo==="venta")) {
      const cotizRef  = parse(refForm.cotizRef);
      const cotizTuya = parse(refForm.cotizTuya);
      const cantUSD   = parse(form.monto);
      if (cotizRef > 0 && cotizTuya > 0 && cantUSD > 0) {
        const comisionARS = Math.abs(cotizRef - cotizTuya) * cantUSD;
        if (comisionARS > 0) {
          const cRefId = Number(refForm.clienteId);
          const notaRef = `Comisión ref. ${tipo} ${fmt(cantUSD)} USD ($${fmt(cotizTuya)}→$${fmt(cotizRef)}) = $${fmt(Math.round(comisionARS))} ARS`;
          const mvRef = {id:Date.now(), hora, fecha:hoy, tipo:"ingreso_transf", moneda:"ARS", monto:comisionARS, nota:notaRef};
          await SB.from("movimientos_cc").insert({cliente_id:cRefId, hora, fecha:hoy, tipo:"ingreso_transf", moneda:"ARS", monto:comisionARS, nota:notaRef});
          setClientes(p=>p.map(cl=>cl.id!==cRefId?cl:{...cl,movimientos:[...cl.movimientos,mvRef]}));
        }
      }
      setRefForm({activo:false,clienteId:"",buscar:"",cotizRef:"",cotizTuya:""});
    }
    await guardarDia(ns,null,null);
    notify("Registrado"); setF("cliente",""); setF("nota","");
    } catch(e){ notify("Error al registrar",false); console.error(e); } finally { setGuardando(false); ultimoInsertRef.current=null; }
  }

  async function guardarEdicionOp(opOriginal, datosNuevos) {
    const act={...opOriginal,...datosNuevos,id:opOriginal.id,fecha:opOriginal.fecha};
    await SB.from("operaciones").update({hora:datosNuevos.hora,tipo:datosNuevos.tipo,datos:act}).eq("id",opOriginal.id);
    setOps(p=>p.map(o=>o.id!==opOriginal.id?o:act));
    setEditandoOp(null); notify("Operacion editada");
  }

  async function eliminarOpHoy(op) {
    const movsVinculados=[];
    // Buscar por operacion_id (nuevo) o por nota "Op. vinculada" (legacy)
    if(op.id){
      const {data:movsDB}=await SB.from("movimientos_cc").select("id,cliente_id").eq("operacion_id",op.id);
      (movsDB||[]).forEach(mv=>{
        const cl=clientes.find(x=>x.id===mv.cliente_id);
        if(cl) movsVinculados.push({clienteId:cl.id,mvId:mv.id,nombre:cl.nombre+" "+(cl.apellido||"")});
      });
    }
    // Fallback legacy: buscar por nota
    if(movsVinculados.length===0){
      clientes.forEach(cl=>{
        cl.movimientos.forEach(mv=>{
          if(mv.nota&&mv.nota.includes("Op. vinculada")&&mv.fecha===op.fecha&&mv.hora===op.hora){
            movsVinculados.push({clienteId:cl.id,mvId:mv.id,nombre:cl.nombre+" "+cl.apellido});
          }
        });
      });
    }
    // Para transferencias: buscar todos los movimientos CC del mismo dia+hora
    if(op.tipo==="transferencia"&&movsVinculados.length===0){
      const {data:movsTransf}=await SB.from("movimientos_cc").select("id,cliente_id,monto,moneda,tipo,nota").eq("fecha",op.fecha).eq("hora",op.hora||"");
      (movsTransf||[]).forEach(mv=>{
        const cl=clientes.find(x=>x.id===mv.cliente_id);
        if(cl&&!movsVinculados.find(m=>m.mvId===mv.id))
          movsVinculados.push({clienteId:cl.id,mvId:mv.id,nombre:cl.nombre+" "+(cl.apellido||""),monto:mv.monto,moneda:mv.moneda,tipo:mv.tipo});
      });
    }
    const detalleCC=movsVinculados.length>0
      ? "\n\nSe revertirán "+movsVinculados.length+" movimientos CC de:\n"+
        movsVinculados.map(m=>
          "• "+(m.nombre||"cliente")+(m.monto?" — "+(m.tipo==="ingreso_transf"?"HABER":"DEBE")+" "+( m.moneda||"")+" $"+fmt(m.monto):"")
        ).join("\n")
      : "";
    let baseImpacto=true;
    if(op.tipo==="compra"||op.tipo==="venta"){
      if(op.baseImpactaCaja!==undefined){
        baseImpacto=op.baseImpactaCaja!=="no";
        if(!window.confirm("Eliminar esta operacion? El saldo se va a revertir."+detalleCC)) return;
      } else {
        const monBase=op.moneda||"USD";
        const siImpacto=window.confirm(
          "Eliminar esta operacion?\n\n"+monBase+" impacto en tu caja fisica?\n\n"+
          "OK = Si (se revierte la caja)\nCancelar = No (no se toca la caja)"+detalleCC
        );
        if(siImpacto){
          baseImpacto=true;
        } else {
          const continuar=window.confirm("No se revierte la caja de "+monBase+". Confirmar eliminacion?");
          if(!continuar) return;
          baseImpacto=false;
        }
      }
    } else {
      if(!window.confirm("Eliminar esta operacion? El saldo se va a revertir."+detalleCC)) return;
    }
    const ns=await leerSaldoFresco();
    const t=op.tipo;
    // imp2: cuanto impacto REALMENTE la caja en moneda2
    // Usar impactoReal2 si existe (guardado al registrar), sino monto2 completo
    const imp2=op.impactoReal2!==undefined?Number(op.impactoReal2):Number(op.monto2||0);
    if (t==="compra"){
      if(baseImpacto) ns[op.moneda]=Number(ns[op.moneda]||0)-Number(op.monto||0);
      if(imp2>0) ns[op.moneda2]=Number(ns[op.moneda2]||0)+imp2;
    } else if (t==="venta"){
      if(baseImpacto) ns[op.moneda]=Number(ns[op.moneda]||0)+Number(op.monto||0);
      if(imp2>0) ns[op.moneda2]=Number(ns[op.moneda2]||0)-imp2;
    } else if (t==="cheque_dia") { ns.ARS=Number(ns.ARS||0)-Number(op.cn||0); }
    else if (t==="cheque_dif") { ns.ARS=Number(ns.ARS||0)+Number(op.montoFinal||op.monto||0); }
    else if (t==="transferencia") { /* comision no impacta caja */ }
    else if (t==="ajuste") { ns[op.moneda]=Number(ns[op.moneda]||0)-Number(op.delta||0); }
    else if (t==="cobro_dif") { ns[op.moneda]=Number(ns[op.moneda]||0)-Number(op.monto||0); }
    setSaldos(ns);
    const {error:delErr}=await SB.from("operaciones").delete().eq("id",op.id);
    if(delErr){ notify("Error al eliminar: "+delErr.message,false); return; }
    setOps(p=>p.filter(o=>o.id!==op.id));
    for(const mv of movsVinculados){
      await SB.from("movimientos_cc").delete().eq("id",mv.mvId);
      setClientes(p=>p.map(cl=>cl.id!==mv.clienteId?cl:{...cl,movimientos:cl.movimientos.filter(m=>m.id!==mv.mvId)}));
    }
    const {error:diaErr}=await guardarDia(ns,null,null);
    if(diaErr) console.error("Error guardando dia tras eliminar:",diaErr);
    notify("Eliminada"+(movsVinculados.length>0?" y movimientos CC revertidos":"")+" ✓");
  }

  async function cobrarDif(id, modo="caja", clienteId=null) {
    const d=diferidos.find(x=>x.id===id); if(!d) return;
    const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    // Monto a cobrar: si tiene tasa endoso usamos nominal*(1-tasaEndoso/100), sino nominal
    const te=parse(d.tasaEndoso||"0");
    const montoCobro=te>0?d.nominal*(1-te/100):d.nominal;
    await SB.from("diferidos").update({cobrado:true}).eq("id",id);
    setDiferidos(p=>p.map(x=>x.id===id?{...x,cobrado:true}:x));
    if(modo==="caja"){
      const ns=await leerSaldoFresco(); ns.ARS=(ns.ARS||0)+montoCobro;
      setSaldos(ns);
      const opData={tipo:"cobro_dif",hora,moneda:"ARS",monto:montoCobro,cliente:d.cliente,nota:"Cobro diferido $"+fmt(d.nominal)+(d.manual?" (manual)":"")};
      const {data:ins}=await SB.from("operaciones").insert({dia_id:hoy,fecha:hoy,hora,tipo:"cobro_dif",datos:opData}).select().single();
      if(ins) setOps(p=>[...p,{...opData,id:ins.id,fecha:hoy}]);
      await guardarDia(ns,null,null);
    } else if(modo==="cc"&&clienteId){
      // No impacta caja — genera retiro_transf en CC del comprador (nos debe)
      const cId=Number(clienteId);
      const clNombre=clientes.find(x=>x.id===cId)?.nombre||"cliente";
      const nota="Cheque diferido $"+fmt(d.nominal)+(te>0?" (endoso "+d.tasaEndoso+"%)":"")+" - "+d.cliente;
      const mv={id:Date.now(),hora,fecha:hoy,tipo:"retiro_transf",moneda:"ARS",monto:montoCobro,nota};
      await SB.from("movimientos_cc").insert({cliente_id:cId,hora,fecha:hoy,tipo:"retiro_transf",moneda:"ARS",monto:montoCobro,nota});
      setClientes(p=>p.map(cl=>cl.id!==cId?cl:{...cl,movimientos:[...cl.movimientos,mv]}));
      const opData={tipo:"cobro_dif",hora,moneda:"ARS",monto:montoCobro,cliente:d.cliente,nota:"Cobro diferido → CC "+clNombre+" $"+fmt(montoCobro)};
      const {data:ins}=await SB.from("operaciones").insert({dia_id:hoy,fecha:hoy,hora,tipo:"cobro_dif",datos:opData}).select().single();
      if(ins) setOps(p=>[...p,{...opData,id:ins.id,fecha:hoy}]);
    }
    setCobrandoDif(null);
    setCobrandoDifCC({modo:"caja",clienteId:"",buscar:""});
    notify("Cobrado"+(modo==="cc"?" → CC":""));
  }

  async function confirmarEditSaldo(mon) {
    const nv=parse(editSaldoV),delta=nv-saldos[mon];
    const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    const ns=await leerSaldoFresco(); ns[mon]=nv; setSaldos(ns);
    const opData={tipo:"ajuste",hora,moneda:mon,monto:Math.abs(delta),delta,nota:"Ajuste "+(delta>-1?"+":"")+fmt(delta)+" "+mon};
    const {data:ins}=await SB.from("operaciones").insert({dia_id:hoy,fecha:hoy,hora,tipo:"ajuste",datos:opData}).select().single();
    if (ins) setOps(p=>[...p,{...opData,id:ins.id,fecha:hoy}]);
    await guardarDia(ns,null,null); setEditSaldo(null); notify("Ajustado");
  }

  async function regMovCC(cId) {
    const monto=parse(formCC.monto); if (!monto) { notify("Ingresa un monto",false); return; }
    const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    const ing=formCC.tipo==="ingreso_transf"||formCC.tipo==="ingreso_dep";
    // Si impactaCaja=true, modificar el saldo fisico
    if (formCC.impactaCaja) {
      const ns=await leerSaldoFresco(); ns[formCC.moneda]=(ns[formCC.moneda]||0)+(ing?monto:-monto);
      setSaldos(ns);
      await guardarDia(ns,null,null);
    }
    const mv={id:Date.now(),hora,fecha:hoy,tipo:formCC.tipo,moneda:formCC.moneda,monto,nota:formCC.nota};
    await SB.from("movimientos_cc").insert({cliente_id:cId,hora:mv.hora,fecha:mv.fecha,tipo:mv.tipo,moneda:mv.moneda,monto:mv.monto,nota:mv.nota||""});
    setClientes(p=>p.map(c=>c.id!==cId?c:{...c,movimientos:[...c.movimientos,mv]}));
    setFormCC(f=>({...f,monto:"",nota:""})); notify("Movimiento registrado");
  }

  async function agregarCliente() {
    if (!nuevoC.nombre.trim()) { notify("Ingresa un nombre",false); return; }
    const {data}=await SB.from("clientes").insert({nombre:nuevoC.nombre.trim(),apellido:nuevoC.apellido.trim(),socio:nuevoC.socio}).select().single();
    if (data) setClientes(p=>[...p,{id:data.id,nombre:data.nombre,apellido:data.apellido,socio:data.socio,movimientos:[]}]);
    setNuevoC({nombre:"",apellido:"",socio:"Manuel Sala"}); notify("Cliente agregado");
  }

  async function eliminarCliente(id) {
    if (!window.confirm("Eliminar este cliente y todos sus movimientos?")) return;
    await SB.from("movimientos_cc").delete().eq("cliente_id",id);
    await SB.from("clientes").delete().eq("id",id);
    setClientes(p=>p.filter(c=>c.id!==id)); notify("Cliente eliminado");
  }

  function cargarHistorial(fecha) {
    setHistFecha(fecha); setHistOps(ops.filter(o=>o.fecha===fecha));
    setHistModo("ver"); setHistEditando(null);
  }

  async function recalcularCierre(fecha) {
    const {data:ci}=await SB.from("cierres").select("*").eq("fecha",fecha).single();
    if (!ci) return;
    const {data:diaData}=await SB.from("dias").select("*").eq("id",fecha).single();
    if (!diaData) return;
    const sf = (diaData.caja_ini||{})._saldos_finales || {};
    const nuevoTotal=calcTotalUSD(sf, ci.cotizaciones);
    await SB.from("cierres").update({saldos_finales:sf,total_usd:nuevoTotal}).eq("fecha",fecha);
    setCierres(p=>p.map(c=>c.fecha!==fecha?c:{...c,saldos_finales:diaData.saldos_finales,total_usd:nuevoTotal}));
    notify("Cierre recalculado");
  }

  async function agregarOpHistorial(datos) {
    const {data:ins}=await SB.from("operaciones").insert({dia_id:histFecha,fecha:histFecha,hora:datos.hora,tipo:datos.tipo,datos}).select().single();
    const nueva=ins?{...datos,id:ins.id,fecha:histFecha}:{...datos,id:Date.now(),fecha:histFecha};
    setOps(p=>[...p,nueva]);
    setHistOps(p=>[...p,nueva].sort((a,b)=>a.hora.localeCompare(b.hora)));
    await recalcularCierre(histFecha);
    setHistModo("ver"); notify("Operacion agregada");
  }

  async function editarOpHistorial(op, datos) {
    const act={...op,...datos,fecha:histFecha};
    await SB.from("operaciones").update({hora:datos.hora,tipo:datos.tipo,datos:act}).eq("id",op.id);
    setOps(p=>p.map(o=>o.id!==op.id?o:act));
    setHistOps(p=>p.map(o=>o.id!==op.id?o:act));
    await recalcularCierre(histFecha);
    setHistEditando(null); notify("Operacion editada");
  }

  async function eliminarOpHistorial(id) {
    if (!window.confirm("Eliminar esta operacion?")) return;
    await SB.from("operaciones").delete().eq("id",id);
    setOps(p=>p.filter(o=>o.id!==id));
    setHistOps(p=>p.filter(o=>o.id!==id));
    await recalcularCierre(histFecha); notify("Eliminada");
  }

  function renderOpRow(op, conAcc=false, esHoy=false) {
    const t=TIPOS_OP[op.tipo]||{label:op.tipo,icon:".",color:"#9ca3af"};
    const m=MONEDAS.find(x=>x.id===op.moneda);
    return (
      <div key={op.id} className="op-row" style={{borderBottom:"1px solid rgba(255,255,255,0.04)",padding:"8px 10px 8px 14px",display:"flex",gap:8,alignItems:"flex-start",borderLeft:"2px solid "+t.color+"55",marginBottom:2,borderRadius:"0 8px 8px 0"}}>
        <span style={{color:t.color,fontSize:13,marginTop:1,width:14}}>{t.icon}</span>
        <div style={{flex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:t.color,fontWeight:700}}>{t.label}</span>
              {op.pendientes&&op.pendientes.some(p=>!p.resuelto)&&(
                <span style={{fontSize:10,color:"#fb923c",background:"rgba(251,146,60,0.12)",border:"1px solid #fb923c44",borderRadius:4,padding:"1px 6px",fontWeight:700}}>⚠ PENDIENTE</span>
              )}
            </div>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              <span style={{fontSize:10,color:"#94a3b8"}}>{op.hora}</span>
              {(conAcc||esHoy)&&<>
                <button onClick={()=>esHoy?setEditandoOp(op):setHistEditando(op)} style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:"#0a1a2e",border:"1px solid #38bdf8",color:"#38bdf8",cursor:"pointer",fontFamily:"inherit"}}>editar</button>
                <button onClick={()=>esHoy?eliminarOpHoy(op):eliminarOpHistorial(op.id)} style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:"#1c0a0a",border:"1px solid #f43f5e",color:"#f43f5e",cursor:"pointer",fontFamily:"inherit"}}>borrar</button>
              </>}
            </div>
          </div>
          <div style={{fontSize:13,color:"#fff",fontWeight:700,marginTop:1}}>
            {op.tipo==="cheque_dia"&&"$"+fmt(op.cn)+" - "+op.cpct+"% - com.$"+fmt(op.ccom)}
            {op.tipo==="cheque_dif"&&"Pago $"+fmt(op.montoFinal)+" - nominal $"+fmt(op.dn)+" - acredita "+op.dfa}
            {op.tipo==="transferencia"&&"$"+fmt(op.tn)+" - "+op.tpct+"% - com.$"+fmt(op.tcom)}
            {(op.tipo==="compra"||op.tipo==="venta")&&fmt(op.monto)+" "+op.moneda+" -- "+fmt(op.monto2)+" "+op.moneda2}
            {!["cheque_dia","cheque_dif","transferencia","compra","venta"].includes(op.tipo)&&(m?.simbolo||"")+fmt(op.monto)+" "+(op.moneda||"")}
          </div>
          {(op.cliente||op.nota)&&<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{op.cliente?"👤 "+op.cliente:""}{op.cliente&&op.nota?" - ":""}{op.nota||""}</div>}
          {op.pendientes&&op.pendientes.length>0&&(
            <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:3}}>
              {op.pendientes.map((p,pi)=>(
                <div key={pi} style={{display:"flex",alignItems:"center",gap:6,background:p.resuelto?"rgba(74,222,128,0.05)":"rgba(251,146,60,0.07)",border:"1px solid "+(p.resuelto?"#4ade8033":"#fb923c44"),borderRadius:6,padding:"4px 10px"}}>
                  <span style={{fontSize:10,color:p.resuelto?"#4ade80":"#fb923c",fontWeight:700}}>{p.resuelto?"✓":"⏳"}</span>
                  <span style={{fontSize:11,color:p.resuelto?"#4ade80":"#fb923c",fontWeight:600}}>${fmt(p.monto)} ARS {p.resuelto?"(resuelto)":"pendiente"}</span>
                  {p.nota&&<span style={{fontSize:10,color:"#9ca3af"}}>— {p.nota}</span>}
                  {!p.resuelto&&(conAcc||esHoy)&&(
                    <button onClick={()=>{setResolviendo({opId:op.id,pi,monto:p.monto,nota:p.nota||"",op});setResolverLineas([{id:Date.now(),tipo:"efectivo",monto:"",buscar:""}]);setBuscarResolverDrop({});}}
                      style={{marginLeft:"auto",fontSize:10,padding:"2px 8px",borderRadius:4,background:"rgba(251,146,60,0.15)",border:"1px solid #fb923c66",color:"#fb923c",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                      Completar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const colorCC={ingreso_transf:"#34d399",ingreso_dep:"#34d399",retiro_transf:"#38bdf8",retiro_efectivo:"#f97316"};
  const labelCC={ingreso_transf:"Me transfirio",ingreso_dep:"Me deposito",retiro_transf:"Le transferi",retiro_efectivo:"Retire efectivo"};
  const labelBtn={ingreso_transf:"Recibi transferencia",ingreso_dep:"Recibi deposito",retiro_transf:"Envie transferencia",retiro_efectivo:"Entregue efectivo"};
  const esIngCC=formCC.tipo==="ingreso_transf"||formCC.tipo==="ingreso_dep";
  const opsHoy=ops.filter(o=>o.fecha===hoy);
  const ultimoCierre=cierres.length>0?cierres[cierres.length-1]:null;
  const penultimoCierre=cierres.length>1?cierres[cierres.length-2]:null;
  const varUSD=ultimoCierre&&penultimoCierre?ultimoCierre.total_usd-penultimoCierre.total_usd:null;
  const grafData=useMemo(()=>cierres.filter(c=>c.total_usd).map(c=>({x:c.fecha,y:c.total_usd})),[cierres]);

  const navItems=[
    {id:"home",label:"Dashboard",c:"#38bdf8"},
    {id:"ape",label:"Apertura",c:"#4ade80"},
    {id:"ops",label:"Operaciones",c:"#f59e0b"},
    {id:"libro",label:"Libro",c:"#38bdf8"},
    {id:"cartera",label:"Cartera",c:"#c084fc"},
    {id:"clientes",label:"Clientes"+(clientes.length?" ("+clientes.length+")":""),c:"#34d399"},
    {id:"posicion",label:"Posicion",c:"#e879f9"},
    {id:"historial",label:"Historial",c:"#fb923c"},
    {id:"evolucion",label:"Evolucion USD",c:"#4ade80"},
    {id:"resumen_socios",label:"Por socio",c:"#34d399"},
    {id:"gastos",label:"Gastos",c:"#f43f5e"},
    {id:"socios",label:"Socios",c:"#a78bfa"},
    {id:"referidores",label:"Referidores",c:"#fb923c"},
    {id:"inversiones",label:"Inversiones",c:"#2dd4bf"},
    {id:"analisis",label:"Análisis CPP",c:"#f59e0b"},
    {id:"cotizaciones",label:"Cotizaciones",c:"#38bdf8"},
    {id:"pnl",label:"P&L",c:"#f472b6"},
    {id:"recaudadora",label:"Recaudadora",c:"#e879f9"},
    {id:"cierre",label:cajaCerrada?"CERRADO":"Cierre",c:"#94a3b8"},
  ].filter(p=>rolUsuario==="admin"||!["evolucion","socios","cierre"].includes(p.id));

  // ===== HELPER BUSCADOR CC =====
  function DropdownCC({buscar, filtrados, onSelect, onCrear}) {
    if(!buscar) return null;
    return (
      <div style={{position:"absolute",left:0,right:0,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:300,maxHeight:150,overflowY:"auto",marginTop:2}}>
        {filtrados.map(cl=>(
          <div key={cl.id} onClick={()=>onSelect(cl)}
            style={{padding:"6px 10px",cursor:"pointer",fontSize:10,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>
            {cl.nombre} {cl.apellido}
          </div>
        ))}
        {filtrados.length===0&&(
          <div style={{padding:"6px 10px",fontSize:10,color:"#94a3b8",borderBottom:"1px solid #1a1a1a"}}>
            Sin resultados para "{buscar}"
          </div>
        )}
        <div onClick={()=>onCrear(buscar)}
          style={{padding:"6px 10px",cursor:"pointer",fontSize:10,color:"#4ade80",fontWeight:700,display:"flex",alignItems:"center",gap:4,background:"rgba(74,222,128,0.05)"}}>
          <span style={{fontSize:12}}>＋</span> Crear "{buscar}" como nuevo cliente
        </div>
      </div>
    );
  }
  // ===== REALTIME =====
  const recargarMovimientos = useCallback(async()=>{
    if(ultimoInsertRef.current && Date.now()-ultimoInsertRef.current < 1500) return;
    const {data:movs} = await SB.from("movimientos_cc").select("*").order("id",{ascending:true}).limit(10000);
    if(!movs) return;
    setClientes(prev=>prev.map(c=>({
      ...c,
      movimientos:(movs||[]).filter(m=>Number(m.cliente_id)===Number(c.id)).map(m=>({
        id:m.id,hora:m.hora,fecha:m.fecha,tipo:m.tipo,moneda:m.moneda,monto:Number(m.monto),nota:m.nota
      }))
    })));
  },[]);

  const recargarOperaciones = useCallback(async()=>{
    if(ultimoInsertRef.current && Date.now()-ultimoInsertRef.current < 1500) return;
    const {data:opsData} = await SB.from("operaciones").select("*").eq("dia_id",hoy).order("hora",{ascending:true});
    if(opsData) setOps(opsData.map(o=>({...(o.datos||{}),id:o.id,fecha:o.fecha||o.datos?.fecha,hora:o.hora||o.datos?.hora,tipo:o.tipo})));
  },[hoy]);

  const recargarDiferidos = useCallback(async()=>{
    if(ultimoInsertRef.current && Date.now()-ultimoInsertRef.current < 1500) return;
    const {data:difs} = await SB.from("diferidos").select("*").order("fecha_venc",{ascending:true});
    if(difs) setDiferidos(difs.map(d=>({
      id:d.id,cliente:d.cliente,nominal:Number(d.nominal),fechaEmision:d.fecha_emision,
      fechaVenc:d.fecha_venc,banco:d.banco||"",manual:d.manual||false,
      tasaEndoso:d.tasa_endoso||"",cobrado:d.cobrado||false,nota:d.nota||""
    })));
  },[]);

  const recargarDia = useCallback(async()=>{
    if(ultimoInsertRef.current && Date.now()-ultimoInsertRef.current < 1500) return;
    const {data:dia} = await SB.from("dias").select("*").eq("id",hoy).single();
    if(!dia) return;
    const sf=dia.caja_ini?._saldos_finales;
    if(sf) setSaldos(Object.fromEntries(MONEDAS.map(m=>[m.id,Number(sf[m.id])||0])));
  },[hoy]);

  useEffect(()=>{
    const channel = SB.channel("realtime_caja")
      .on("postgres_changes",{event:"*",schema:"public",table:"movimientos_cc"},()=>recargarMovimientos())
      .on("postgres_changes",{event:"*",schema:"public",table:"operaciones"},()=>recargarOperaciones())
      .on("postgres_changes",{event:"*",schema:"public",table:"diferidos"},()=>recargarDiferidos())
      .on("postgres_changes",{event:"*",schema:"public",table:"dias"},()=>recargarDia())
      .subscribe();
    return ()=>{ SB.removeChannel(channel); };
  },[recargarMovimientos,recargarOperaciones,recargarDiferidos,recargarDia]);
  // ===== FIN REALTIME =====

  if (cargando) return (
    <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:10,letterSpacing:4,color:"#4ade80",marginBottom:12}}>CAJA FINANCIERA</div>
        <div style={{color:"#64748b"}}>Cargando...</div>
      </div>
    </div>
  );

  return (
    <div style={S.app}>
      {/* Modal crear cliente rápido */}
      {nuevoClienteCC.visible&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setNuevoClienteCC(p=>({...p,visible:false}))}>
          <div style={{background:"#0f172a",border:"1px solid #1f2937",borderRadius:12,padding:24,width:300,display:"flex",flexDirection:"column",gap:14}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:13,fontWeight:700,color:"#4ade80"}}>Nuevo cliente</div>
            <div>
              <div style={{fontSize:10,color:"#94a3b8",marginBottom:4}}>NOMBRE</div>
              <input autoFocus value={nuevoClienteCC.nombre} onChange={e=>setNuevoClienteCC(p=>({...p,nombre:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&crearClienteRapido(nuevoClienteCC.nombre,nuevoClienteCC.socio,nuevoClienteCC.onCreado)}
                placeholder="Nombre del cliente"
                style={{width:"100%",background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"7px 10px",color:"#e2e8f0",fontFamily:"inherit",fontSize:11,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"#94a3b8",marginBottom:4}}>SOCIO</div>
              <select value={nuevoClienteCC.socio} onChange={e=>setNuevoClienteCC(p=>({...p,socio:e.target.value}))}
                style={{width:"100%",background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"7px 10px",color:"#e2e8f0",fontFamily:"inherit",fontSize:11,outline:"none"}}>
                {["Manuel Sala","Gonzalo Spadafora","Matias Speranza","STS"].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setNuevoClienteCC(p=>({...p,visible:false}))}
                style={{flex:1,padding:"8px",borderRadius:6,background:"transparent",border:"1px solid #374151",color:"#9ca3af",fontFamily:"inherit",fontSize:11,cursor:"pointer"}}>Cancelar</button>
              <button onClick={()=>crearClienteRapido(nuevoClienteCC.nombre,nuevoClienteCC.socio,nuevoClienteCC.onCreado)}
                style={{flex:1,padding:"8px",borderRadius:6,background:"#052e16",border:"1px solid #4ade80",color:"#4ade80",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer"}}>Crear</button>
            </div>
          </div>
        </div>
      )}
      {toast&&<div style={S.toast(toast.ok)}>{toast.msg}</div>}
      {resolviendo&&(()=>{
        const totalLineas=resolverLineas.reduce((s,l)=>s+parse(l.monto),0);
        const resta=resolviendo.monto-totalLineas;
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
            <div style={{background:"#0f1623",border:"1px solid #fb923c44",borderRadius:16,padding:24,width:440,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto"}}>
              <div style={{fontSize:14,fontWeight:700,color:"#fb923c",marginBottom:2}}>Completar pendiente</div>
              <div style={{fontSize:12,color:"#9ca3af",marginBottom:16}}>
                Total a resolver: <strong style={{color:"#fb923c"}}>${fmt(resolviendo.monto)} {resolviendo.op.moneda2||"ARS"}</strong>
                {resolviendo.nota&&<span> — {resolviendo.nota}</span>}
              </div>

              {/* Líneas de desglose */}
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
                {resolverLineas.map((linea,li)=>{
                  const clSel=linea.tipo!=="efectivo"?clientes.find(x=>x.id===Number(linea.tipo)):null;
                  const busqR=buscarResolverDrop[linea.id]||"";
                  const mostrarDropR=busqR.length>0;
                  const filtradosR=clientes.filter(cl=>!cl.oculto&&(cl.nombre+" "+cl.apellido).toLowerCase().includes(busqR.toLowerCase())).slice(0,8);
                  return (
                    <div key={linea.id} style={{display:"flex",gap:6,alignItems:"flex-start",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"8px 10px"}}>
                      {/* Selector tipo */}
                      <div style={{position:"relative",flexShrink:0}}>
                        {!busqR&&(
                          <div onClick={()=>setBuscarResolverDrop(b=>({...b,[linea.id]:" "}))}
                            style={{padding:"5px 10px",borderRadius:6,background:linea.tipo==="efectivo"?"rgba(74,222,128,0.08)":"rgba(99,102,241,0.08)",border:"1px solid "+(linea.tipo==="efectivo"?"#4ade8033":"#6366f133"),cursor:"pointer",fontSize:10,color:linea.tipo==="efectivo"?"#4ade80":"#a5b4fc",fontWeight:600,whiteSpace:"nowrap"}}>
                            {linea.tipo==="efectivo"?"💵 Efectivo":clSel?clSel.nombre+" "+clSel.apellido:"?"} ▾
                          </div>
                        )}
                        {busqR&&(
                          <input autoFocus value={busqR==" "?"":busqR}
                            onChange={e=>setBuscarResolverDrop(b=>({...b,[linea.id]:e.target.value}))}
                            placeholder="Buscar..." style={{...S.inp({width:130}),fontSize:11,padding:"5px 8px"}} />
                        )}
                        {mostrarDropR&&(
                          <div style={{position:"absolute",top:"100%",left:0,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:300,minWidth:170,maxHeight:160,overflowY:"auto",marginTop:2}}>
                            <div onClick={()=>{setResolverLineas(p=>p.map(x=>x.id!==linea.id?x:{...x,tipo:"efectivo"}));setBuscarResolverDrop(b=>({...b,[linea.id]:""}));}}
                              style={{padding:"7px 10px",cursor:"pointer",fontSize:11,color:"#4ade80",borderBottom:"1px solid #1a1a1a",fontWeight:600}}>💵 Efectivo</div>
                            {filtradosR.map(cl=>(
                              <div key={cl.id} onClick={()=>{setResolverLineas(p=>p.map(x=>x.id!==linea.id?x:{...x,tipo:String(cl.id)}));setBuscarResolverDrop(b=>({...b,[linea.id]:""}));}}
                                style={{padding:"7px 10px",cursor:"pointer",fontSize:11,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>
                                {cl.nombre} {cl.apellido}
                              </div>
                            ))}
                            {filtradosR.length===0&&busqR.trim()&&<div style={{padding:"7px 10px",fontSize:11,color:"#94a3b8"}}>Sin resultados</div>}
                          </div>
                        )}
                      </div>
                      {/* Monto */}
                      <input placeholder="Monto" value={linea.monto}
                        onChange={e=>setResolverLineas(p=>p.map(x=>x.id!==linea.id?x:{...x,monto:e.target.value}))}
                        style={{...S.inp(),flex:1,fontSize:12,padding:"5px 10px"}} />
                      {/* Borrar */}
                      {resolverLineas.length>1&&(
                        <button onClick={()=>setResolverLineas(p=>p.filter(x=>x.id!==linea.id))}
                          style={{padding:"4px 8px",borderRadius:5,background:"transparent",border:"1px solid #374151",color:"#f87171",cursor:"pointer",fontSize:11,flexShrink:0}}>✕</button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Agregar línea + indicador */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <button onClick={()=>setResolverLineas(p=>[...p,{id:Date.now(),tipo:"efectivo",monto:"",buscar:""}])}
                  style={{fontSize:11,padding:"4px 12px",borderRadius:6,background:"rgba(251,146,60,0.08)",border:"1px solid #fb923c44",color:"#fb923c",cursor:"pointer",fontFamily:"inherit"}}>+ Agregar línea</button>
                <span style={{fontSize:11,fontWeight:700,color:resta===0?"#4ade80":resta<0?"#f87171":"#f59e0b"}}>
                  {resta===0?"✓ Cuadra":resta>0?"Resta: $"+fmt(resta):"Excede: $"+fmt(Math.abs(resta))}
                </span>
              </div>

              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setResolviendo(null);setResolverLineas([]);setBuscarResolverDrop({});}}
                  style={{...S.btn(false),flex:1}}>Cancelar</button>
                <button onClick={resolverPendiente} disabled={Math.abs(resta)>1}
                  style={{...S.btn(Math.abs(resta)<=1,"#fb923c"),flex:1,fontWeight:700,opacity:Math.abs(resta)>1?0.4:1}}>Confirmar</button>
              </div>
            </div>
          </div>
        );
      })()}
      {showModalCierre&&<ModalCierre saldos={saldos} clientes={clientes} diferidos={diferidos} inversiones={inversiones} saldoCC={saldoCC} ultimaCotiz={ultimaCotiz} ultimaBlue={ultimaBlue} onCerrar={(cotiz,total,blue)=>{setUltimaCotiz(cotiz);setUltimaBlue(blue);ejecutarCierre(cotiz,total,blue);}} onCancelar={()=>setShowModalCierre(false)}/>}
      {editandoOp&&(
        <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto"}}>
            <FormOp fechaDefault={hoy} titulo="EDITAR OPERACION DE HOY" color="#38bdf8" opInicial={editandoOp}
              onGuardar={(d)=>guardarEdicionOp(editandoOp,d)} onCancelar={()=>setEditandoOp(null)}/>
          </div>
        </div>
      )}
      <nav style={S.nav}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginRight:16,flexShrink:0}}>
          <div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#6366f1,#34d399)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",letterSpacing:-1,fontFamily:"'JetBrains Mono',monospace",boxShadow:"0 4px 12px rgba(99,102,241,0.4)"}}>S</div>
          <div className="hide-mobile">
            <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",letterSpacing:.3,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>STS</div>
            <div style={{fontSize:9,color:"#9ca3af",letterSpacing:2,marginTop:1}}>FINANCIERA</div>
          </div>
        </div>
        <div style={{marginLeft:"auto",paddingRight:8,display:"flex",gap:6,alignItems:"center"}} className="hide-mobile">
          <button onClick={async()=>{
            setRefreshing(true);
            // Solo recargar operaciones del dia - NO recargar CCs para no pisar movimientos locales
            const {data:opsData}=await SB.from("operaciones").select("*").order("hora",{ascending:true});
            if(opsData) setOps(opsData.map(o=>({...(o.datos||{}),id:o.id,fecha:o.fecha||o.datos?.fecha,hora:o.hora||o.datos?.hora,tipo:o.tipo})));
            setUltimoRefresh(new Date());
            setRefreshing(false);
            notify("Operaciones actualizadas");
          }} style={{padding:"4px 8px",borderRadius:6,background:"transparent",border:"1px solid #1f2937",color:refreshing?"#4ade80":"#374151",fontFamily:"inherit",fontSize:11,cursor:"pointer"}}>
            {refreshing?"↻ ...":"↻ Actualizar"}
          </button>
          <button onClick={async()=>{ await SB.auth.signOut(); }} style={{padding:"4px 10px",borderRadius:6,background:"transparent",border:"1px solid rgba(255,255,255,0.08)",color:"#64748b",fontFamily:"inherit",fontSize:10,cursor:"pointer"}}>
            {usuario?.email?.split("@")[0]} - salir
          </button>
        </div>
        <div className="desktop-nav" style={{display:"flex",gap:1,flex:1,overflowX:"auto"}}>
          {navItems.map(n=>(
            <button key={n.id} className="nav-item" onClick={()=>setPant(n.id)} style={{
              padding:"6px 12px",borderRadius:8,border:"none",
              background:pant===n.id?"rgba(255,255,255,0.07)":"transparent",
              color:pant===n.id?n.c:"#475569",
              fontFamily:"inherit",fontSize:11,fontWeight:pant===n.id?600:500,
              cursor:"pointer",whiteSpace:"nowrap",position:"relative",
            }}>
              {n.label}
              {pant===n.id&&<div style={{position:"absolute",bottom:2,left:"50%",transform:"translateX(-50%)",width:16,height:2,background:n.c,borderRadius:2}}/>}
            </button>
          ))}
        </div>
        <div className="mobile-nav" style={{display:"none",flex:1,justifyContent:"flex-end",alignItems:"center",gap:8}}>
          <span style={{fontSize:12,fontWeight:600,color:navItems.find(n=>n.id===pant)?.c||"#e2e8f0",fontFamily:"'JetBrains Mono',monospace"}}>
            {navItems.find(n=>n.id===pant)?.label}
          </span>
          <button onClick={()=>setMobileMenu(v=>!v)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"7px 11px",color:"#94a3b8",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>
            {mobileMenu?"✕":"☰"}
          </button>
        </div>
      </nav>
      {mobileMenu&&(
        <div className="mobile-menu" style={{position:"fixed",inset:0,top:56,background:"rgba(6,8,16,0.97)",zIndex:99,padding:16,overflowY:"auto",backdropFilter:"blur(20px)"}}>
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>{setPant(n.id);setMobileMenu(false);}} style={{
              display:"block",width:"100%",textAlign:"left",
              padding:"14px 18px",marginBottom:6,borderRadius:12,
              border:"1px solid "+(pant===n.id?"rgba("+hexToRgb(n.c)+",0.3)":"rgba(255,255,255,0.06)"),
              background:pant===n.id?"rgba("+hexToRgb(n.c)+",0.08)":"rgba(255,255,255,0.02)",
              color:pant===n.id?n.c:"#64748b",
              fontFamily:"inherit",fontSize:14,fontWeight:pant===n.id?600:400,cursor:"pointer"
            }}>{n.label}</button>
          ))}
        </div>
      )}
      <main style={S.main}>

        {pant==="home"&&(()=>{
          const difPend=diferidos.filter(d=>!d.cobrado);
          const totalCheques=difPend.reduce((s,d)=>s+(d.mFinal||d.nominal),0);
          const vencHoy=difPend.filter(d=>diasEntre(hoy,d.fechaAcr)===0).length;
          const vencProx=difPend.filter(d=>{const dr=diasEntre(hoy,d.fechaAcr);return dr>0&&dr<=3;}).length;
          const tots=Object.fromEntries(MONEDAS.map(m=>[m.id,clientes.reduce((s,cl)=>s+saldoCC(cl)[m.id],0)]));
          return (
            <div>
              <div style={{marginBottom:24}}>
                <div style={{fontSize:11,color:"#9ca3af",marginBottom:2,fontFamily:"'JetBrains Mono',monospace"}}>Buenos días —</div>
                <div style={{fontSize:22,fontWeight:700,color:"#e2e8f0",letterSpacing:-.3}}>{fechaLarga}</div>
              </div>
              {cajaCerrada&&<div style={{background:"#1c0505",border:"1px solid #f43f5e33",borderRadius:10,padding:"10px 16px",marginBottom:16,fontSize:12,color:"#f87171",display:"flex",alignItems:"center",gap:8}}>
                <span>🔒</span> Caja cerrada — podés reabrir desde la solapa Cierre
              </div>}
              {!diaId&&<div style={{background:"#0a1a0a",border:"1px solid #34d39933",borderRadius:10,padding:"10px 16px",marginBottom:16,fontSize:12,color:"#34d399",display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setPant("ape")}>
                <span>☀️</span> La caja no fue abierta hoy — click para abrir
              </div>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:24}}>
                {MONEDAS.map(m=>{ const v=saldos[m.id]||0; return (
                  <div key={m.id} className="saldo-card" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba("+m.color+"ff,0.15)",borderRadius:14,padding:"16px 18px"}} onClick={()=>setPant("ops")}>
                    <div style={{fontSize:9,color:m.color,letterSpacing:2,marginBottom:6,fontWeight:700}}>{m.id}</div>
                    <div style={{fontSize:18,fontWeight:700,color:v<0?"#f87171":"#e2e8f0",fontFamily:"'JetBrains Mono',monospace"}}>{m.simbolo}{fmt(v)}</div>
                    <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>saldo actual</div>
                  </div>
                );})}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12,marginBottom:24}}>
                <div style={{background:"#0f1420",border:"1px solid #3b82f633",borderRadius:12,padding:16,cursor:"pointer"}} onClick={()=>setPant("ops")}>
                  <div style={{fontSize:10,color:"#9ca3af",marginBottom:8,fontWeight:600,letterSpacing:1}}>OPERACIONES HOY</div>
                  <div style={{fontSize:28,fontWeight:700,color:"#3b82f6",fontFamily:"'JetBrains Mono',monospace"}}>{opsHoy.length}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>registradas hoy</div>
                </div>
                <div style={{background:"#0f1420",border:"1px solid #c084fc33",borderRadius:12,padding:16,cursor:"pointer"}} onClick={()=>setPant("cartera")}>
                  <div style={{fontSize:10,color:"#9ca3af",marginBottom:8,fontWeight:600,letterSpacing:1}}>CHEQUES A COBRAR</div>
                  <div style={{fontSize:28,fontWeight:700,color:"#c084fc",fontFamily:"'JetBrains Mono',monospace"}}>{difPend.length}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>${fmt(totalCheques)} ARS total</div>
                  {(vencHoy>0||vencProx>0)&&<div style={{marginTop:8,fontSize:11,color:"#f59e0b",fontWeight:600}}>⚠ {vencHoy>0?vencHoy+" vencido/s":""}  {vencProx>0?vencProx+" por vencer":""}</div>}
                </div>
                <div style={{background:"#0f1420",border:"1px solid #34d39933",borderRadius:12,padding:16,cursor:"pointer"}} onClick={()=>setPant("posicion")}>
                  <div style={{fontSize:10,color:"#9ca3af",marginBottom:8,fontWeight:600,letterSpacing:1}}>POSICION CC</div>
                  <div style={{fontSize:28,fontWeight:700,color:tots.ARS>-1?"#34d399":"#f87171",fontFamily:"'JetBrains Mono',monospace"}}>{tots.ARS>-1?"+":""}{fmt(tots.ARS)}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>ARS neto en CCs</div>
                </div>
                <div style={{background:"#0f1420",border:"1px solid #f59e0b33",borderRadius:12,padding:16,cursor:"pointer"}} onClick={()=>setPant("clientes")}>
                  <div style={{fontSize:10,color:"#9ca3af",marginBottom:8,fontWeight:600,letterSpacing:1}}>CLIENTES</div>
                  <div style={{fontSize:28,fontWeight:700,color:"#f59e0b",fontFamily:"'JetBrains Mono',monospace"}}>{clientes.length}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>cuentas corrientes</div>
                </div>
              </div>
              {difPend.length>0&&(
                <Card sx={{border:"1px solid #c084fc22",marginBottom:16}}>
                  <div style={{fontSize:10,color:"#c084fc",fontWeight:700,letterSpacing:1,marginBottom:12}}>CHEQUES A COBRAR — cronograma</div>
                  {[...difPend].sort((a,b)=>a.fechaAcr?.localeCompare(b.fechaAcr)).map(d=>{
                    const dr=diasEntre(hoy,d.fechaAcr);
                    const venc=dr===0,urg=dr<=3&&!venc;
                    return <div key={d.id} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #1e2535",alignItems:"center"}}>
                      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontSize:12,fontWeight:700,color:"#64748b",fontFamily:"'JetBrains Mono',monospace",minWidth:90}}>{d.fechaAcr}</span>
                        {venc&&<span style={{fontSize:10,fontWeight:700,color:"#f43f5e",background:"#f43f5e15",padding:"2px 7px",borderRadius:4}}>VENCIDO</span>}
                        {urg&&<span style={{fontSize:10,fontWeight:700,color:"#f59e0b",background:"#f59e0b15",padding:"2px 7px",borderRadius:4}}>en {dr}d</span>}
                        {!venc&&!urg&&<span style={{fontSize:10,color:"#334155",background:"#1e2535",padding:"2px 7px",borderRadius:4}}>{dr}d</span>}
                        {d.cliente&&<span style={{fontSize:11,color:"#94a3b8"}}>👤 {d.cliente}</span>}
                      </div>
                      <span style={{fontSize:13,fontWeight:700,color:venc?"#f43f5e":urg?"#f59e0b":"#c084fc",fontFamily:"'JetBrains Mono',monospace"}}>${fmt(d.nominal)}</span>
                    </div>;
                  })}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",marginTop:4,borderTop:"2px solid #1e2535"}}>
                    <span style={{fontSize:11,fontWeight:700,color:"#64748b"}}>TOTAL</span>
                    <span style={{fontSize:14,fontWeight:700,color:"#c084fc",fontFamily:"'JetBrains Mono',monospace"}}>${fmt(totalCheques)}</span>
                  </div>
                </Card>
              )}
              <Card sx={{border:"1px solid #1e2535"}}>
                <div style={{fontSize:10,color:"#9ca3af",fontWeight:700,letterSpacing:1,marginBottom:12}}>ÚLTIMAS OPERACIONES</div>
                {opsHoy.length===0&&<div style={{color:"#334155",fontSize:12}}>Sin operaciones hoy</div>}
                {[...opsHoy].reverse().slice(0,5).map(op=>{
                  const t=TIPOS_OP[op.tipo]||{label:op.tipo,color:"#64748b"};
                  return <div key={op.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1e2535",alignItems:"center"}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:t.color,flexShrink:0}}/>
                      <span style={{fontSize:12,color:t.color,fontWeight:600}}>{t.label}</span>
                      {op.cliente&&<span style={{fontSize:11,color:"#94a3b8"}}>{op.cliente}</span>}
                    </div>
                    <span style={{fontSize:12,fontWeight:700,color:"#e2e8f0",fontFamily:"'JetBrains Mono',monospace"}}>{op.moneda} {fmt(op.monto)}</span>
                  </div>;
                })}
              </Card>
            </div>
          );
        })()}

        {pant==="ape"&&(
          <div>
            <div style={{fontSize:9,letterSpacing:4,color:"#6366f1",marginBottom:6,fontWeight:600}}>APERTURA DE CAJA</div>
            <div style={{fontSize:12,color:"#94a3b8",marginBottom:20}}>{fechaLarga}</div>
            <Card sx={{maxWidth:460}}>
              {MONEDAS.map(m=>(
                <div key={m.id} style={{marginBottom:11}}>
                  <Lbl>{m.id} - {m.label}</Lbl>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{color:m.color,fontWeight:700,width:20}}>{m.simbolo}</span>
                    <Inp type="number" placeholder="0" value={cajaIni[m.id]} onChange={e=>setCajaIni(c=>({...c,[m.id]:e.target.value}))}/>
                  </div>
                </div>
              ))}
              <button onClick={abrirCaja} style={{marginTop:8,width:"100%",padding:14,borderRadius:10,background:"linear-gradient(135deg,rgba(99,102,241,0.2),rgba(52,211,153,0.1))",border:"1px solid rgba(99,102,241,0.4)",color:"#a5b4fc",fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer",letterSpacing:2,transition:"all .2s"}}>ABRIR CAJA</button>
            </Card>
          </div>
        )}

        {pant==="ops"&&(
          <div className="grid-mobile-1" style={S.grid("1fr 1fr",18)}>
            <div>
              {cajaCerrada&&<div style={{background:"#1c0a0a",border:"1px solid #f43f5e44",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#f87171"}}>CAJA CERRADA - solo lectura</div>}
              <div style={{fontSize:10,letterSpacing:3,color:"#94a3b8",marginBottom:10}}>SALDOS</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:18}}>
                {MONEDAS.map(m=>{ const v=saldos[m.id]||0,ed=editSaldo===m.id&&!cajaCerrada;
                  return (
                    <div key={m.id} className="saldo-card" style={{flex:"1 1 120px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba("+hexToRgb(m.color)+",0.2)",borderRadius:12,padding:"12px 14px",cursor:cajaCerrada?"default":"pointer"}}
                      onClick={()=>{if(!cajaCerrada&&!ed){setEditSaldo(m.id);setEditSaldoV(String(v));}}}>
                      <div style={{fontSize:9,color:m.color,letterSpacing:2,marginBottom:3}}>{m.id}</div>
                      {ed?(
                        <input autoFocus type="number" value={editSaldoV} onChange={e=>setEditSaldoV(e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter")confirmarEditSaldo(m.id);if(e.key==="Escape")setEditSaldo(null);}}
                          onBlur={()=>confirmarEditSaldo(m.id)}
                          style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid "+m.color,outline:"none",color:"#fff",fontFamily:"inherit",fontSize:15,fontWeight:700}}/>
                      ):(
                        <div style={{fontSize:15,fontWeight:700,color:v<0?"#f87171":"#fff"}}>{m.simbolo}{fmt(v)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:10,letterSpacing:3,color:"#94a3b8"}}>MOVIMIENTOS HOY ({opsHoy.length})</div>
                <div style={{display:"flex",gap:4}}>
                  {[["todas","Todas"],["ops","Operaciones"],["ajustes","Ajustes"]].map(([v,lbl])=>(
                    <button key={v} onClick={()=>setFiltroOps(v)} style={{padding:"3px 8px",borderRadius:5,background:filtroOps===v?"rgba(255,255,255,0.08)":"transparent",border:"1px solid "+(filtroOps===v?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.05)"),color:filtroOps===v?"#e2e8f0":"#475569",fontFamily:"inherit",fontSize:10,cursor:"pointer"}}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{maxHeight:420,overflowY:"auto"}}>
                {opsHoy.length===0&&<div style={{color:"#64748b"}}>Sin operaciones</div>}
                {[...opsHoy].reverse()
                  .filter(op=>filtroOps==="todas"?true:filtroOps==="ajustes"?op.tipo==="ajuste":op.tipo!=="ajuste")
                  .map(op=>renderOpRow(op,false,!cajaCerrada))}
              </div>
            </div>
            {!cajaCerrada?(
              <Card>
                <div style={{fontSize:10,letterSpacing:3,color:"#f59e0b",marginBottom:12}}>NUEVA OPERACION</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
                  {Object.entries(TIPOS_OP).filter(([id])=>!id.startsWith("cc_")&&id!=="ajuste"&&id!=="cobro_dif").map(([id,t])=>(
                    <button key={id} onClick={()=>{setF("tipo",id);setMostrarDesglose(false);setDesglose([]);}} style={S.btn(form.tipo===id,t.color)}>{t.label}</button>
                  ))}
                </div>
                {(form.tipo==="compra"||form.tipo==="venta")&&(
                  <div>
                    <div style={S.grid("1fr 1fr",8)}>
                      <div><Lbl>Moneda base</Lbl><MonedasSel value={form.moneda} onChange={v=>setF("moneda",v)}/></div>
                      <div><Lbl>Moneda destino</Lbl><MonedasSel value={form.moneda2} onChange={v=>setF("moneda2",v)} exclude={form.moneda}/></div>
                    </div>
                    <div style={{marginTop:8,...S.grid("1fr 1fr 1fr",8)}}>
                      <div><Lbl>Cantidad</Lbl><Inp type="number" placeholder="0" value={form.monto} onChange={e=>{setF("monto",e.target.value);const c=parse(form.cotizacion);if(c)setF("monto2",String(parse(e.target.value)*c));}}/></div>
                      <div><Lbl>Cotizacion</Lbl><Inp type="number" placeholder="0" value={form.cotizacion} onChange={e=>{setF("cotizacion",e.target.value);const m=parse(form.monto);if(m)setF("monto2",String(m*parse(e.target.value)));}}/></div>
                      <div><Lbl>Total</Lbl><Inp type="number" placeholder="0" value={form.monto2} onChange={e=>{setF("monto2",e.target.value);const m=parse(form.monto);if(m)setF("cotizacion",String(parse(e.target.value)/m));}}/></div>
                    </div>
                    {/* Toggle impacto en caja de moneda base */}
                    <div style={{marginTop:10,marginBottom:4}}>
                      <div style={{fontSize:9,letterSpacing:2,color:"#94a3b8",marginBottom:6}}>
                        {form.tipo==="compra"?form.moneda+" ENTRAN A CAJA":form.moneda+" SALEN DE CAJA"}
                      </div>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <div style={{display:"flex",borderRadius:6,overflow:"hidden",border:"1px solid #1f2937"}}>
                          <button onClick={()=>{setF("baseImpactaCaja","si");setUsdPendiente(u=>({...u,activo:false,clienteId:"",buscar:"",monto:""}));}}
                            style={{padding:"5px 12px",background:form.baseImpactaCaja!=="no"?"rgba(74,222,128,0.12)":"transparent",color:form.baseImpactaCaja!=="no"?"#4ade80":"#475569",border:"none",fontFamily:"inherit",fontSize:11,cursor:"pointer",borderRight:"1px solid #1f2937",whiteSpace:"nowrap"}}>
                            ✓ Impacta caja
                          </button>
                          <button onClick={()=>{setF("baseImpactaCaja","no");setUsdPendiente(u=>({...u,activo:true}));}}
                            style={{padding:"5px 12px",background:form.baseImpactaCaja==="no"?"rgba(99,102,241,0.12)":"transparent",color:form.baseImpactaCaja==="no"?"#a5b4fc":"#475569",border:"none",fontFamily:"inherit",fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>
                            ⏳ Pendiente — CC
                          </button>
                        </div>
                        {form.baseImpactaCaja==="no"&&(()=>{
                          const clSel=clientes.find(x=>x.id===Number(usdPendiente.clienteId));
                          const filtrados=clientes.filter(x=>(x.nombre+" "+x.apellido).toLowerCase().includes((usdPendiente.buscar||"").toLowerCase()));
                          return (
                            <div style={{flex:1,minWidth:180,position:"relative"}}>
                              <div style={{display:"flex",gap:4}}>
                                {clSel&&!usdPendiente.buscar&&(
                                  <div style={{flex:1,padding:"5px 8px",borderRadius:5,background:"rgba(99,102,241,0.08)",border:"1px solid #6366f133",fontSize:10,color:"#a5b4fc",fontWeight:600}}>
                                    {clSel.nombre} {clSel.apellido}
                                  </div>
                                )}
                                <input value={usdPendiente.buscar||""} onChange={e=>setUsdPendiente(u=>({...u,buscar:e.target.value}))}
                                  placeholder={clSel?"Cambiar...":form.tipo==="compra"?"¿Quien nos debe los "+form.moneda+"?":"¿A quien le debemos los "+form.moneda+"?"}
                                  style={{flex:1,background:"#0a0a0a",border:"1px solid #6366f133",borderRadius:5,padding:"5px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:10,outline:"none"}}/>
                                {usdPendiente.clienteId&&<button onClick={()=>setUsdPendiente(u=>({...u,clienteId:"",buscar:""}))}
                                  style={{padding:"3px 6px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontSize:9}}>✕</button>}
                              </div>
                              <div style={{fontSize:9,color:"#6366f1",marginTop:3}}>
                                {form.tipo==="compra"
                                  ?"El cliente nos debe los "+form.moneda+" (DEBE en su CC)"
                                  :"Le debemos los "+form.moneda+" al cliente (HABER en su CC)"}
                              </div>
                              {usdPendiente.buscar&&filtrados.length>0&&(
                                <div style={{position:"absolute",left:0,right:0,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:200,maxHeight:120,overflowY:"auto",marginTop:2}}>
                                  {filtrados.map(cl=>(
                                    <div key={cl.id} onClick={()=>setUsdPendiente(u=>({...u,clienteId:String(cl.id),buscar:""}))}
                                      style={{padding:"6px 10px",cursor:"pointer",fontSize:10,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>
                                      {cl.nombre} {cl.apellido}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    {/* Desglose de pago */}
                    <div style={{marginTop:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <button onClick={()=>{
                          setMostrarDesglose(v=>!v);
                          if(!mostrarDesglose&&desglose.length===0) setDesglose([{id:Date.now(),tipo:"efectivo",monto:"",impactaCaja:true}]);
                        }} style={{padding:"5px 12px",borderRadius:6,background:mostrarDesglose?"rgba(245,158,11,0.15)":"rgba(255,255,255,0.03)",border:"1px solid "+(mostrarDesglose?"#f59e0b44":"rgba(255,255,255,0.08)"),color:mostrarDesglose?"#f59e0b":"#475569",fontFamily:"inherit",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                          {mostrarDesglose?"▾ Ocultar desglose":"+ Desglosar pago"}
                        </button>
                        {mostrarDesglose&&(()=>{
                          const total=parse(form.monto2)||0;
                          const asignado=desglose.reduce((s,d)=>s+parse(d.monto),0);
                          const resta=total-asignado;
                          return <span style={{fontSize:11,color:resta===0?"#4ade80":resta<0?"#f87171":"#f59e0b",fontWeight:700}}>
                            {resta===0?"✓ Cuadra":resta>0?"Resta: $"+fmt(resta):"Excede: $"+fmt(Math.abs(resta))}
                          </span>;
                        })()}
                      </div>
                      {mostrarDesglose&&(
                        <div style={{marginTop:8,background:"rgba(245,158,11,0.04)",border:"1px solid rgba(245,158,11,0.15)",borderRadius:8,padding:10}}>
                          <div style={{fontSize:9,letterSpacing:2,color:"#f59e0b",marginBottom:8}}>DESGLOSE — {form.moneda2} {fmt(parse(form.monto2)||0)}</div>
                          {desglose.map((d,i)=>(
                            <div key={d.id} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                              {/* Selector: efectivo o cliente con buscador */}
                              <div style={{flex:2,minWidth:140,position:"relative"}}>
                                {(()=>{
                                  const busq=buscarDesglose[d.id]||"";
                                  const clSel=d.tipo!=="efectivo"?clientes.find(x=>x.id===Number(d.tipo)):null;
                                  const filtrados=busq.trim().length===0?clientes:clientes.filter(x=>(x.nombre+" "+x.apellido).toLowerCase().includes(busq.trim().toLowerCase()));
                                  const mostrarDrop=busq.length>0;
                                  return (
                                    <div>
                                      <div style={{display:"flex",gap:4,alignItems:"center"}}>
                                        {/* Chip efectivo o nombre cliente seleccionado */}
                                        {!busq&&(
                                          <div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:5,background:d.tipo==="efectivo"?"rgba(74,222,128,0.08)":d.tipo==="pendiente"?"rgba(251,146,60,0.08)":"rgba(99,102,241,0.08)",border:"1px solid "+(d.tipo==="efectivo"?"#4ade8033":d.tipo==="pendiente"?"#fb923c33":"#6366f133"),flexShrink:0,cursor:"pointer"}}
                                            onClick={()=>setBuscarDesglose(b=>({...b,[d.id]:" "}))}>
                                            <span style={{fontSize:10,color:d.tipo==="efectivo"?"#4ade80":d.tipo==="op_simultanea"?"#f59e0b":"#a5b4fc",fontWeight:600}}>
                                              {d.tipo==="efectivo"?"💵 Efectivo":d.tipo==="op_simultanea"?"⇄ Op. simultánea":d.tipo==="pendiente"?"⏳ Pendiente":clSel?clSel.nombre+" "+clSel.apellido:"?"}
                                            </span>
                                            <span style={{fontSize:9,color:"#9ca3af"}}>▾</span>
                                          </div>
                                        )}
                                        <input
                                          value={busq.trim()===""&&busq.length>0?"":busq}
                                          onChange={e=>setBuscarDesglose(b=>({...b,[d.id]:e.target.value}))}
                                          onFocus={e=>{ if(!busq) setBuscarDesglose(b=>({...b,[d.id]:" "})); }}
                                          placeholder={busq?" ":"Cambiar..."}
                                          style={{flex:1,minWidth:0,background:"transparent",border:"none",borderBottom:busq?"1px solid #6366f1":"none",padding:"4px 0",color:"#e2e8f0",fontFamily:"inherit",fontSize:11,outline:"none",display:busq?"block":"none"}}/>
                                        {busq&&<button onClick={()=>setBuscarDesglose(b=>({...b,[d.id]:""}))}
                                          style={{padding:"2px 6px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontSize:10,flexShrink:0}}>✕</button>}
                                      </div>
                                      {mostrarDrop&&(
                                        <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:200,maxHeight:160,overflowY:"auto",marginTop:2}}>
                                          <div onClick={()=>{setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,tipo:"efectivo"}));setBuscarDesglose(b=>({...b,[d.id]:""}));}}
                                            style={{padding:"7px 10px",cursor:"pointer",fontSize:11,color:"#4ade80",borderBottom:"1px solid #1a1a1a",fontWeight:600}}>
                                            💵 Efectivo
                                          </div>
                                          <div onClick={()=>{setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,tipo:"op_simultanea",cotizSim:"",clienteSim:"",monedaSim:"USD",impactaCajaSim:true,clienteSimId:"",clienteSimBuscar:""}));setBuscarDesglose(b=>({...b,[d.id]:""}));}}
                                            style={{padding:"7px 10px",cursor:"pointer",fontSize:11,color:"#f59e0b",borderBottom:"1px solid #1a1a1a",fontWeight:600}}>
                                            ⇄ Op. simultánea
                                          </div>
                                          <div onClick={()=>{setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,tipo:"pendiente",notaPendiente:""}));setBuscarDesglose(b=>({...b,[d.id]:""}));}}
                                            style={{padding:"7px 10px",cursor:"pointer",fontSize:11,color:"#fb923c",borderBottom:"1px solid #1a1a1a",fontWeight:600}}>
                                            ⏳ Pendiente (sin asignar)
                                          </div>
                                          {filtrados.map(cl=>(
                                            <div key={cl.id} onClick={()=>{setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,tipo:String(cl.id)}));setBuscarDesglose(b=>({...b,[d.id]:""}));}}
                                              style={{padding:"7px 10px",cursor:"pointer",fontSize:11,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>
                                              {cl.nombre} {cl.apellido}
                                            </div>
                                          ))}
                                          {filtrados.length===0&&busq.trim()&&<div style={{padding:"7px 10px",fontSize:11,color:"#94a3b8"}}>Sin resultados para "{busq.trim()}"</div>}
                                          {busq.trim()&&(
                                            <div onClick={()=>setNuevoClienteCC({visible:true,nombre:busq.trim(),socio:"Manuel Sala",onCreado:cl=>{setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,tipo:String(cl.id)}));setBuscarDesglose(b=>({...b,[d.id]:""}));}})}
                                              style={{padding:"7px 10px",cursor:"pointer",fontSize:11,color:"#4ade80",fontWeight:700,display:"flex",alignItems:"center",gap:4,background:"rgba(74,222,128,0.05)"}}>
                                              <span style={{fontSize:13}}>＋</span> Crear "{busq.trim()}" como nuevo cliente
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                              {/* Monto */}
                              <Inp type="number" placeholder="Monto" value={d.monto}
                                onChange={e=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,monto:e.target.value}))}
                                sx={{flex:2,minWidth:100}}/>
                              {/* Campos extra para op simultánea */}
                              {d.tipo==="op_simultanea"&&(
                                <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0,minWidth:220,background:"rgba(245,158,11,0.04)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:7,padding:8}}>
                                  <div style={{fontSize:9,color:"#f59e0b",fontWeight:700,letterSpacing:1}}>⇄ OP. SIMULTÁNEA</div>
                                  {/* Moneda que se vende/compra */}
                                  <div>
                                    <div style={{fontSize:9,color:"#f59e0b",marginBottom:2}}>MONEDA</div>
                                    <select value={d.monedaSim||"USD"} onChange={e=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,monedaSim:e.target.value}))}
                                      style={{width:"100%",background:"#0a0a0a",border:"1px solid #f59e0b44",borderRadius:5,padding:"4px 8px",color:"#f59e0b",fontFamily:"inherit",fontSize:11,outline:"none"}}>
                                      {MONEDAS.map(m=><option key={m.id} value={m.id}>{m.id} — {m.label}</option>)}
                                    </select>
                                  </div>
                                  {/* Cotización */}
                                  <div>
                                    <div style={{fontSize:9,color:"#f59e0b",marginBottom:2}}>COTIZACIÓN</div>
                                    <input type="number" placeholder="cotiz." value={d.cotizSim||""}
                                      onChange={e=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,cotizSim:e.target.value}))}
                                      style={{width:"100%",background:"#0a0a0a",border:"1px solid #f59e0b44",borderRadius:5,padding:"4px 8px",color:"#f59e0b",fontFamily:"inherit",fontSize:11,outline:"none"}}/>
                                  </div>
                                  {/* Cliente — buscador CC o texto libre */}
                                  <div style={{position:"relative"}}>
                                    <div style={{fontSize:9,color:"#f59e0b",marginBottom:2}}>CLIENTE</div>
                                    <div style={{display:"flex",gap:4}}>
                                      {d.clienteSimId&&!d.clienteSimBuscar&&(()=>{
                                        const cl=clientes.find(x=>x.id===Number(d.clienteSimId));
                                        return cl?<div style={{flex:1,padding:"4px 8px",borderRadius:5,background:"rgba(245,158,11,0.08)",border:"1px solid #f59e0b44",fontSize:10,color:"#f59e0b",fontWeight:600}}>{cl.nombre} {cl.apellido}</div>:null;
                                      })()}
                                      <input type="text"
                                        placeholder={d.clienteSimId&&!d.clienteSimBuscar?"Cambiar...":"Buscar CC o escribir..."}
                                        value={d.clienteSimBuscar||d.clienteSim||""}
                                        onChange={e=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,clienteSimBuscar:e.target.value,clienteSim:e.target.value,clienteSimId:""}))}
                                        style={{flex:1,background:"#0a0a0a",border:"1px solid #f59e0b44",borderRadius:5,padding:"4px 8px",color:"#f59e0b",fontFamily:"inherit",fontSize:10,outline:"none"}}/>
                                    </div>
                                    {d.clienteSimBuscar&&(()=>{
                                      const filtSim=clientes.filter(cl=>(cl.nombre+" "+cl.apellido).toLowerCase().includes(d.clienteSimBuscar.toLowerCase()));
                                      return filtSim.length>0?(
                                        <div style={{position:"absolute",left:0,right:0,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:300,maxHeight:100,overflowY:"auto",marginTop:2}}>
                                          {filtSim.map(cl=>(
                                            <div key={cl.id} onClick={()=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,clienteSimId:String(cl.id),clienteSim:cl.nombre+" "+cl.apellido,clienteSimBuscar:""}))}
                                              style={{padding:"5px 10px",cursor:"pointer",fontSize:10,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>{cl.nombre} {cl.apellido}</div>
                                          ))}
                                        </div>
                                      ):null;
                                    })()}
                                  </div>
                                  {/* Impacta caja o va a CC */}
                                  <div>
                                    <div style={{fontSize:9,color:"#f59e0b",marginBottom:2}}>{d.monedaSim||"USD"} VA A</div>
                                    <div style={{display:"flex",borderRadius:6,overflow:"hidden",border:"1px solid #1f2937"}}>
                                      <button onClick={()=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,impactaCajaSim:true}))}
                                        style={{flex:1,padding:"5px",background:d.impactaCajaSim!==false?"rgba(245,158,11,0.12)":"transparent",color:d.impactaCajaSim!==false?"#f59e0b":"#475569",border:"none",fontFamily:"inherit",fontSize:9,cursor:"pointer",borderRight:"1px solid #1f2937"}}>
                                        💵 Caja física
                                      </button>
                                      <button onClick={()=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,impactaCajaSim:false}))}
                                        style={{flex:1,padding:"5px",background:d.impactaCajaSim===false?"rgba(99,102,241,0.12)":"transparent",color:d.impactaCajaSim===false?"#a5b4fc":"#475569",border:"none",fontFamily:"inherit",fontSize:9,cursor:"pointer"}}>
                                        👤 CC cliente
                                      </button>
                                    </div>
                                  </div>
                                  {/* Preview */}
                                  {d.monto&&d.cotizSim&&(()=>{
                                    const cotiz=parse(d.cotizSim);
                                    const monSim=d.monedaSim||"USD";
                                    const cantSim=parse(d.monto)/cotiz;
                                    const tipoSim=form.tipo==="compra"?"Venta":"Compra";
                                    return <div style={{fontSize:10,color:"#f59e0b",padding:"4px 7px",background:"rgba(245,158,11,0.08)",borderRadius:4,fontWeight:600}}>
                                      → {tipoSim} {fmt(cantSim)} {monSim} a ${fmt(cotiz)} {d.impactaCajaSim===false?"(→ CC)":"(→ caja)"}
                                    </div>;
                                  })()}
                                </div>
                              )}
                              {/* Impacta caja — solo para clientes */}
                              {d.tipo!=="efectivo"&&d.tipo!=="op_simultanea"&&(()=>{
                                const clSel=clientes.find(x=>x.id===Number(d.tipo));
                                const salCC=clSel?saldoCC(clSel):null;
                                const monBase=form.moneda2;
                                const salMon=salCC?salCC[monBase]:0;
                                return (
                                  <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
                                    {/* Saldo CC del cliente en la moneda de la operacion */}
                                    {salCC&&salMon!==0&&(
                                      <div style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:salMon>0?"rgba(74,222,128,0.08)":"rgba(248,113,113,0.08)",border:"1px solid "+(salMon>0?"#4ade8033":"#f8717133"),color:salMon>0?"#4ade80":"#f87171",whiteSpace:"nowrap"}}>
                                        CC: {salMon>0?"me debe":"le debo"} {MONEDAS.find(m=>m.id===monBase)?.simbolo}{fmt(Math.abs(salMon))}
                                      </div>
                                    )}
                                    {/* Toggle retira billetes / compensacion */}
                                    <div style={{display:"flex",borderRadius:5,overflow:"hidden",border:"1px solid #1f2937"}}>
                                      <button onClick={()=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,impactaCaja:true}))}
                                        style={{padding:"3px 7px",background:d.impactaCaja?"#4ade8022":"transparent",color:d.impactaCaja?"#4ade80":"#475569",border:"none",fontFamily:"inherit",fontSize:9,cursor:"pointer",borderRight:"1px solid #1f2937",whiteSpace:"nowrap"}}>
                                        💵 Retira
                                      </button>
                                      <button onClick={()=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,impactaCaja:false}))}
                                        style={{padding:"3px 7px",background:!d.impactaCaja?"#6366f122":"transparent",color:!d.impactaCaja?"#a5b4fc":"#475569",border:"none",fontFamily:"inherit",fontSize:9,cursor:"pointer",whiteSpace:"nowrap"}}>
                                        ⇄ Comp.
                                      </button>
                                    </div>
                                    {/* Acreditar moneda base en CC */}
                                    {(()=>{
                                      const salMonBase=salCC?salCC[form.moneda]:0;
                                      return (
                                        <div onClick={()=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,acreditarBase:!x.acreditarBase}))}
                                          style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",padding:"3px 7px",borderRadius:5,border:"1px solid "+(d.acreditarBase?"#f59e0b44":"#1f2937"),background:d.acreditarBase?"rgba(245,158,11,0.08)":"transparent"}}>
                                          <div style={{width:10,height:10,borderRadius:2,border:"2px solid "+(d.acreditarBase?"#f59e0b":"#475569"),background:d.acreditarBase?"#f59e0b":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                            {d.acreditarBase&&<span style={{color:"#000",fontSize:7,fontWeight:900}}>✓</span>}
                                          </div>
                                          <span style={{fontSize:9,color:d.acreditarBase?"#f59e0b":"#475569",whiteSpace:"nowrap"}}>
                                            +{form.moneda} CC
                                          </span>
                                          {salMonBase!==0&&<span style={{fontSize:8,color:salMonBase>0?"#4ade80":"#f87171"}}>
                                            ({salMonBase>0?"me debe":"le debo"} {fmt(Math.abs(salMonBase))})
                                          </span>}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })()}
                              {/* Borrar fila */}
                              {d.tipo==="pendiente"&&(
                                <input
                                  placeholder="Nota (ej: falta cuenta de X)"
                                  value={d.notaPendiente||""}
                                  onChange={e=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,notaPendiente:e.target.value}))}
                                  style={{...S.inp(),fontSize:11,padding:"5px 10px",flex:1,border:"1px solid #fb923c44",color:"#fb923c"}}
                                />
                              )}
                              <button onClick={()=>setDesglose(p=>p.filter(x=>x.id!==d.id))} style={{padding:"4px 8px",borderRadius:5,background:"transparent",border:"1px solid #374151",color:"#f87171",fontFamily:"inherit",fontSize:11,cursor:"pointer",flexShrink:0}}>✕</button>
                            </div>
                          ))}
                          <button onClick={()=>setDesglose(p=>[...p,{id:Date.now(),tipo:"efectivo",monto:"",impactaCaja:true}])}
                            style={{marginTop:4,padding:"5px 12px",borderRadius:5,background:"transparent",border:"1px dashed #374151",color:"#9ca3af",fontFamily:"inherit",fontSize:11,cursor:"pointer",width:"100%"}}>
                            + Agregar linea
                          </button>
                          {/* USD pendiente de entrega */}
                          {(form.tipo==="compra"||form.tipo==="venta")&&(
                            <div style={{marginTop:10,borderTop:"1px solid #1f2937",paddingTop:10}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                                <span style={{fontSize:9,letterSpacing:2,color:"#6366f1"}}>
                                  {form.tipo==="venta"?"USD A RECIBIR (entrega diferida)":"ARS A RECIBIR (entrega diferida)"}
                                </span>
                                <button onClick={()=>setUsdPendiente(u=>({...u,activo:!u.activo}))}
                                  style={{fontSize:9,padding:"2px 7px",borderRadius:4,background:usdPendiente.activo?"rgba(99,102,241,0.15)":"transparent",border:"1px solid "+(usdPendiente.activo?"#6366f1":"#374151"),color:usdPendiente.activo?"#a5b4fc":"#475569",cursor:"pointer",fontFamily:"inherit"}}>
                                  {usdPendiente.activo?"- Quitar":"+ Agregar"}
                                </button>
                              </div>
                              {usdPendiente.activo&&(()=>{
                                const clSel=clientes.find(x=>x.id===Number(usdPendiente.clienteId));
                                const filtrados=clientes.filter(x=>(x.nombre+" "+x.apellido).toLowerCase().includes((usdPendiente.buscar||"").toLowerCase()));
                                const monBase=form.tipo==="venta"?form.moneda:form.moneda2;
                                return (
                                  <div style={{background:"rgba(99,102,241,0.05)",border:"1px solid #6366f122",borderRadius:7,padding:8,position:"relative"}}>
                                    <div style={S.grid("1fr 100px",6)}>
                                      <div>
                                        <Lbl>Quien nos debe entregar</Lbl>
                                        <div style={{display:"flex",gap:4}}>
                                          {clSel&&!usdPendiente.buscar&&(
                                            <div style={{flex:1,padding:"5px 8px",borderRadius:5,background:"rgba(99,102,241,0.1)",border:"1px solid #6366f133",fontSize:10,color:"#a5b4fc",fontWeight:600}}>
                                              {clSel.nombre} {clSel.apellido}
                                            </div>
                                          )}
                                          <input value={usdPendiente.buscar||""} onChange={e=>setUsdPendiente(u=>({...u,buscar:e.target.value}))}
                                            placeholder={clSel&&!usdPendiente.buscar?"Cambiar...":"Buscar cliente..."}
                                            style={{flex:1,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:5,padding:"5px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:10,outline:"none"}}/>
                                          {usdPendiente.clienteId&&<button onClick={()=>setUsdPendiente(u=>({...u,clienteId:"",buscar:""}))}
                                            style={{padding:"3px 6px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontSize:9}}>✕</button>}
                                        </div>
                                        {usdPendiente.buscar&&filtrados.length>0&&(
                                          <div style={{position:"absolute",left:8,right:8,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:200,maxHeight:120,overflowY:"auto",marginTop:2}}>
                                            {filtrados.map(cl=>(
                                              <div key={cl.id} onClick={()=>setUsdPendiente(u=>({...u,clienteId:String(cl.id),buscar:""}))}
                                                style={{padding:"6px 10px",cursor:"pointer",fontSize:10,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>
                                                {cl.nombre} {cl.apellido}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <Lbl>Monto {monBase}</Lbl>
                                        <Inp type="number" placeholder={form.monto||"0"} value={usdPendiente.monto}
                                          onChange={e=>setUsdPendiente(u=>({...u,monto:e.target.value}))}/>
                                      </div>
                                    </div>
                                    {clSel&&<div style={{fontSize:9,color:"#6366f1",marginTop:4}}>
                                      Al registrar: {form.tipo==="venta"?"nos debe entregar":"nos debe pagar"} {usdPendiente.monto||form.monto} {monBase} → retiro_transf en su CC (nos debe)
                                    </div>}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {form.tipo==="cheque_dia"&&(<div style={S.grid("1fr 1fr",8)}>
                  <div><Lbl>Nominal ARS</Lbl><Inp type="number" value={form.cn} onChange={e=>setF("cn",e.target.value)}/></div>
                  <div><Lbl>Comision %</Lbl><Inp type="number" value={form.cpct} onChange={e=>setF("cpct",e.target.value)}/></div>
                  {form.cn&&form.cpct&&<div style={{gridColumn:"1/-1",background:"#0a1a0a",borderRadius:6,padding:"8px",fontSize:12}}>Com: <strong style={{color:"#4ade80"}}>${fmt(parse(form.cn)*parse(form.cpct)/100)}</strong></div>}
                </div>)}
                {form.tipo==="cheque_dif"&&(<div>
                  <div style={S.grid("1fr 1fr 1fr",8)}>
                    <div><Lbl>Tasa mercado %</Lbl><Inp type="number" value={form.dtm} onChange={e=>setF("dtm",e.target.value)}/></div>
                    <div><Lbl>Tasa gestion %</Lbl><Inp type="number" value={form.dtg} onChange={e=>setF("dtg",e.target.value)}/></div>
                    <div><Lbl>Nominal</Lbl><Inp type="number" value={form.dn} onChange={e=>setF("dn",e.target.value)}/></div>
                    <div><Lbl>F. recepcion</Lbl><Inp type="date" value={form.dfr} onChange={e=>setF("dfr",e.target.value)}/></div>
                    <div>
                      <Lbl>F. vencimiento cheque</Lbl>
                      <Inp type="date" value={form.dfv||""} onChange={e=>{
                        setF("dfv",e.target.value);
                        // Auto-calcular acreditacion = vencimiento + 2 dias habiles
                        if(e.target.value) setF("dfa", sumarDiasHabiles(e.target.value, 2));
                      }}/>
                    </div>
                    <div>
                      <Lbl>F. acreditacion <span style={{fontSize:9,color:"#6366f1"}}>+2h habiles</span></Lbl>
                      <Inp type="date" value={form.dfa} onChange={e=>setF("dfa",e.target.value)}/>
                    </div>
                    <div style={{display:"flex",alignItems:"flex-end",paddingBottom:6}}><span style={{fontSize:11,color:"#9ca3af"}}>{calcDif?.dias||0}d</span></div>
                  </div>
                  {calcDif&&<div style={{marginTop:8,background:"#0a0a0a",borderRadius:8,padding:10,...S.grid("1fr 1fr 1fr 1fr",6),fontSize:11}}>
                    {[["Post-gest.",fmt(calcDif.postG),"#9ca3af"],["Tasa",calcDif.tasaD.toFixed(2)+"%","#9ca3af"],["Pagas",fmt(calcDif.mFinal),"#f87171"],["Ganancia",fmt(calcDif.ganancia),"#4ade80"]].map(([k,v,c])=>(
                      <div key={k}><div style={{color:"#94a3b8",marginBottom:2}}>{k}</div><div style={{color:c,fontWeight:700}}>${v}</div></div>
                    ))}
                  </div>}
                  {/* Cómo pagás al cliente */}
                  <div style={{marginTop:10}}>
                    <Lbl>Pago al cliente</Lbl>
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      {[{v:"caja",l:"💵 Caja física"},{v:"cc",l:"🔄 CC del cliente"}].map(opt=>(
                        <button key={opt.v} type="button" onClick={()=>setF("pagoCheqDif",opt.v)}
                          style={{flex:1,padding:"7px",borderRadius:6,border:"1px solid "+(form.pagoCheqDif===opt.v?"#c084fc":"#1f2937"),
                            background:form.pagoCheqDif===opt.v?"rgba(192,132,252,0.1)":"transparent",
                            color:form.pagoCheqDif===opt.v?"#c084fc":"#4b5563",cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:700}}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                    {form.pagoCheqDif==="cc"&&(()=>{
                      const clCC=clientes.find(x=>x.id===Number(form.pagoCheqDifCCId));
                      const filtCC=clientes.filter(x=>(x.nombre+" "+(x.apellido||"")).toLowerCase().includes((form.pagoCheqDifCCBuscar||"").toLowerCase())).slice(0,8);
                      return (
                        <div style={{position:"relative"}}>
                          {clCC&&!form.pagoCheqDifCCBuscar?(
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <div style={{flex:1,padding:"6px 10px",background:"rgba(192,132,252,0.08)",border:"1px solid #c084fc44",borderRadius:6,fontSize:12,color:"#c084fc",fontWeight:600}}>
                                {clCC.nombre} {clCC.apellido||""}
                              </div>
                              <button type="button" onClick={()=>{setF("pagoCheqDifCCId","");setF("pagoCheqDifCCBuscar","");}}
                                style={{padding:"4px 8px",borderRadius:5,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontSize:11}}>✕</button>
                            </div>
                          ):(
                            <input placeholder="Buscar CC..." value={form.pagoCheqDifCCBuscar||""} onChange={e=>setF("pagoCheqDifCCBuscar",e.target.value)}
                              style={{width:"100%",background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"6px 10px",color:"#e2e8f0",fontFamily:"inherit",fontSize:12,outline:"none"}}/>
                          )}
                          {form.pagoCheqDifCCBuscar&&filtCC.length>0&&(
                            <div style={{position:"absolute",left:0,right:0,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:200,maxHeight:140,overflowY:"auto",marginTop:2}}>
                              {filtCC.map(cl=>(
                                <div key={cl.id} onClick={()=>{setF("pagoCheqDifCCId",String(cl.id));setF("pagoCheqDifCCBuscar","");}}
                                  style={{padding:"8px 12px",cursor:"pointer",fontSize:12,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>
                                  {cl.nombre} {cl.apellido||""}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>)}
                {form.tipo==="transferencia"&&(()=>{
                  const tn=parse(form.tn), pctOr=parse(form.tpctOrigen)||0;
                  const comOr=tn*(pctOr/100), netoOr=tn-comOr;
                  const clOrigen=clientes.find(x=>x.id===Number(form.ccOrigenId));
                  const filtOrigen=clientes.filter(x=>(x.nombre+" "+x.apellido).toLowerCase().includes((form.ccOrigenBuscar||"").toLowerCase()));
                  const totalDistribuido=tDestinos.reduce((s,d)=>s+parse(d.monto),0);
                  const totalComDest=tDestinos.reduce((s,d)=>{const m=parse(d.monto),p=parse(d.pct)||0;return s+m*(p/100);},0);
                  const ganTotal=comOr+totalComDest;
                  const diferencia=netoOr-totalDistribuido;
                  return (
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      <div style={S.grid("1fr 1fr 1fr",8)}>
                        <div><Lbl>Moneda</Lbl><MonedasSel value={form.tmoneda||"ARS"} onChange={v=>setF("tmoneda",v)}/></div>
                        <div><Lbl>Monto total origen</Lbl><Inp type="number" placeholder="0" value={form.tn} onChange={e=>setF("tn",e.target.value)}/></div>
                        <div><Lbl>% Comisión origen</Lbl><Inp type="number" placeholder="0" value={form.tpctOrigen||""} onChange={e=>setF("tpctOrigen",e.target.value)}/></div>
                      </div>
                      <div style={{position:"relative"}}>
                        <Lbl>CC Origen (quien envía)</Lbl>
                        <div style={{display:"flex",gap:4}}>
                          {clOrigen&&!form.ccOrigenBuscar&&<div style={{flex:1,padding:"5px 8px",borderRadius:5,background:"rgba(248,113,113,0.08)",border:"1px solid #f8717133",fontSize:10,color:"#f87171",fontWeight:600}}>{clOrigen.nombre} {clOrigen.apellido}</div>}
                          <input value={form.ccOrigenBuscar||""} onChange={e=>setF("ccOrigenBuscar",e.target.value)}
                            placeholder={clOrigen&&!form.ccOrigenBuscar?"Cambiar...":"Buscar origen..."}
                            style={{flex:1,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:5,padding:"5px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:10,outline:"none"}}/>
                          {form.ccOrigenId&&<button onClick={()=>setF("ccOrigenId","")} style={{padding:"3px 6px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontSize:9}}>✕</button>}
                        </div>
                        {form.ccOrigenBuscar&&<DropdownCC buscar={form.ccOrigenBuscar} filtrados={filtOrigen} onSelect={cl=>{setF("ccOrigenId",String(cl.id));setF("ccOrigenBuscar","");}} onCrear={nombre=>setNuevoClienteCC({visible:true,nombre,socio:"Manuel Sala",onCreado:cl=>{setF("ccOrigenId",String(cl.id));}})}/>}
                      </div>
                      {tn>0&&<div style={{background:"#0a1220",border:"1px solid #3b82f633",borderRadius:6,padding:"8px 10px",fontSize:11,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
                        <span style={{color:"#9ca3af"}}>Total enviado: <strong style={{color:"#e2e8f0"}}>{fmt(tn)}</strong></span>
                        <span style={{color:"#9ca3af"}}>Com. origen ({pctOr}%): <strong style={{color:"#f59e0b"}}>-{fmt(comOr)}</strong></span>
                        <span style={{color:"#9ca3af"}}>Neto a distribuir: <strong style={{color:"#4ade80"}}>{fmt(netoOr)}</strong></span>
                      </div>}
                      <div style={{borderTop:"1px solid #1f2937",paddingTop:10}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <Lbl>Destinos</Lbl>
                          <button onClick={()=>setTDestinos(p=>[...p,{id:Date.now(),clienteId:"",buscar:"",monto:"",pct:"",nota:""}])}
                            style={{padding:"3px 10px",borderRadius:5,background:"rgba(74,222,128,0.1)",border:"1px solid #4ade8044",color:"#4ade80",fontFamily:"inherit",fontSize:10,cursor:"pointer",fontWeight:600}}>+ Agregar destino</button>
                        </div>
                        {tDestinos.map((dest,idx)=>{
                          const clDest=clientes.find(x=>x.id===Number(dest.clienteId));
                          const filtDest=clientes.filter(x=>(x.nombre+" "+x.apellido).toLowerCase().includes((dest.buscar||"").toLowerCase()));
                          const mDest=parse(dest.monto),pDest=parse(dest.pct)||0,comDest=mDest*(pDest/100);
                          return (
                            <div key={dest.id} style={{background:"#0a0f0a",border:"1px solid #1f2937",borderRadius:7,padding:10,marginBottom:8,display:"flex",flexDirection:"column",gap:6}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <span style={{fontSize:10,color:"#9ca3af",fontWeight:600}}>Destino {idx+1}</span>
                                {tDestinos.length>1&&<button onClick={()=>setTDestinos(p=>p.filter(d=>d.id!==dest.id))} style={{padding:"2px 7px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#f87171",cursor:"pointer",fontSize:9}}>✕</button>}
                              </div>
                              <div style={{position:"relative"}}>
                                <div style={{display:"flex",gap:4}}>
                                  {clDest&&!dest.buscar&&<div style={{flex:1,padding:"5px 8px",borderRadius:5,background:"rgba(74,222,128,0.08)",border:"1px solid #4ade8033",fontSize:10,color:"#4ade80",fontWeight:600}}>{clDest.nombre} {clDest.apellido}</div>}
                                  <input value={dest.buscar||""} onChange={e=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,buscar:e.target.value}:d))}
                                    placeholder={clDest&&!dest.buscar?"Cambiar cliente...":"Buscar cliente destino..."}
                                    style={{flex:1,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:5,padding:"5px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:10,outline:"none"}}/>
                                  {dest.clienteId&&<button onClick={()=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,clienteId:"",buscar:""}:d))} style={{padding:"3px 6px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontSize:9}}>✕</button>}
                                </div>
                                {dest.buscar&&<DropdownCC buscar={dest.buscar} filtrados={filtDest} onSelect={cl=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,clienteId:String(cl.id),buscar:""}:d))} onCrear={nombre=>setNuevoClienteCC({visible:true,nombre,socio:"Manuel Sala",onCreado:cl=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,clienteId:String(cl.id),buscar:""}:d))})}/>}
                              </div>
                              <div style={S.grid("1fr 1fr 1fr",6)}>
                                <div><Lbl>Monto a recibir</Lbl><Inp type="number" placeholder="0" value={dest.monto} onChange={e=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,monto:e.target.value}:d))}/></div>
                                <div><Lbl>% Comisión</Lbl><Inp type="number" placeholder="0" value={dest.pct} onChange={e=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,pct:e.target.value}:d))}/></div>
                                <div><Lbl>Nota</Lbl><Inp placeholder="opcional" value={dest.nota} onChange={e=>setTDestinos(p=>p.map(d=>d.id===dest.id?{...d,nota:e.target.value}:d))}/></div>
                              </div>
                              {mDest>0&&<div style={{fontSize:10,color:"#9ca3af",display:"flex",gap:12}}>
                                <span>Recibe: <strong style={{color:"#e2e8f0"}}>{fmt(mDest)}</strong></span>
                                {pDest>0&&<span>Com ({pDest}%): <strong style={{color:"#f59e0b"}}>+{fmt(comDest)}</strong></span>}
                                <span>DEBE en CC: <strong style={{color:"#4ade80"}}>{fmt(mDest+comDest)}</strong></span>
                              </div>}
                            </div>
                          );
                        })}
                      </div>
                      {tn>0&&<div style={{background:"#0a1a0a",border:"1px solid #22c55e33",borderRadius:6,padding:"8px 12px",fontSize:11,display:"flex",flexDirection:"column",gap:4}}>
                        <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#9ca3af"}}>Neto a distribuir:</span><strong style={{color:"#e2e8f0"}}>{fmt(netoOr)}</strong></div>
                        <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#9ca3af"}}>Total distribuido:</span><strong style={{color:"#e2e8f0"}}>{fmt(totalDistribuido)}</strong></div>
                        <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1f2937",paddingTop:4,marginTop:2}}>
                          <span style={{color:Math.abs(diferencia)<0.01?"#6b7280":"#f87171",fontWeight:600}}>Diferencia:</span>
                          <strong style={{color:Math.abs(diferencia)<0.01?"#4ade80":"#f87171"}}>{Math.abs(diferencia)<0.01?"✓ Cuadra":fmt(diferencia)}</strong>
                        </div>
                        {ganTotal>0&&<div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1f2937",paddingTop:4,marginTop:2}}>
                          <span style={{color:"#f59e0b",fontWeight:600}}>Ganancia STS:</span>
                          <strong style={{color:"#f59e0b"}}>{fmt(ganTotal)}</strong>
                        </div>}
                      </div>}
                    </div>
                  );
                })()}
                <div style={{marginTop:10,...S.grid("1fr 1fr",8)}}>
                  <div><Lbl>Cliente</Lbl><Inp placeholder="(opcional)" value={form.cliente} onChange={e=>setF("cliente",e.target.value)}/></div>
                  <div><Lbl>Nota</Lbl><Inp placeholder="..." value={form.nota} onChange={e=>setF("nota",e.target.value)}/></div>
                </div>
                {(form.tipo==="compra"||form.tipo==="venta")&&(
                  <div style={{marginTop:8,background:"rgba(251,146,60,0.05)",border:"1px solid rgba(251,146,60,0.2)",borderRadius:8,padding:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:refForm.activo?10:0}}>
                      <button onClick={()=>setRefForm(p=>({...p,activo:!p.activo}))}
                        style={{padding:"4px 10px",borderRadius:5,background:refForm.activo?"rgba(251,146,60,0.15)":"transparent",border:"1px solid "+(refForm.activo?"#fb923c":"#374151"),color:refForm.activo?"#fb923c":"#6b7280",fontFamily:"inherit",fontSize:10,cursor:"pointer",fontWeight:600}}>
                        {refForm.activo?"⬡ Con referidor":"○ Sin referidor"}
                      </button>
                      {refForm.activo&&<span style={{fontSize:10,color:"#9ca3af"}}>Comisión → CC referidor en ARS automático</span>}
                    </div>
                    {refForm.activo&&(()=>{
                      const clRef=clientes.find(x=>x.id===Number(refForm.clienteId));
                      const filtRef=clientes.filter(x=>(x.nombre+" "+x.apellido).toLowerCase().includes((refForm.buscar||"").trim().toLowerCase()));
                      const cotizRef=parse(refForm.cotizRef),cotizTuya=parse(refForm.cotizTuya),cantUSD=parse(form.monto);
                      const comARS=cotizRef>0&&cotizTuya>0&&cantUSD>0?Math.abs(cotizRef-cotizTuya)*cantUSD:0;
                      return (
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                          <div style={{position:"relative",gridColumn:"1/3"}}>
                            <Lbl>Referidor</Lbl>
                            <div style={{display:"flex",gap:4}}>
                              {clRef&&!refForm.buscar&&<div style={{flex:1,padding:"5px 8px",borderRadius:5,background:"rgba(251,146,60,0.08)",border:"1px solid #fb923c44",fontSize:10,color:"#fb923c",fontWeight:600}}>{clRef.nombre} {clRef.apellido}</div>}
                              <input value={refForm.buscar||""} onChange={e=>setRefForm(p=>({...p,buscar:e.target.value}))}
                                placeholder={clRef&&!refForm.buscar?"Cambiar...":"Buscar referidor..."}
                                style={{flex:1,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:5,padding:"5px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:10,outline:"none"}}/>
                              {refForm.clienteId&&<button onClick={()=>setRefForm(p=>({...p,clienteId:"",buscar:""}))} style={{padding:"3px 6px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontSize:9}}>✕</button>}
                            </div>
                            {refForm.buscar&&filtRef.length>0&&(
                              <div style={{position:"absolute",left:0,right:0,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:200,maxHeight:120,overflowY:"auto",marginTop:2}}>
                                {filtRef.map(cl=>(
                                  <div key={cl.id} onClick={()=>setRefForm(p=>({...p,clienteId:String(cl.id),buscar:""}))}
                                    style={{padding:"6px 10px",cursor:"pointer",fontSize:10,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>{cl.nombre} {cl.apellido}</div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div><Lbl>Cotiz. referidor cobró</Lbl>
                            <input type="number" value={refForm.cotizRef||""} onChange={e=>setRefForm(p=>({...p,cotizRef:e.target.value}))}
                              placeholder="ej: 1430"
                              style={{width:"100%",background:"#0a0a0a",border:"1px solid #fb923c44",borderRadius:5,padding:"5px 8px",color:"#fb923c",fontFamily:"inherit",fontSize:11,outline:"none"}}/>
                          </div>
                          <div><Lbl>Tu cotización real</Lbl>
                            <input type="number" value={refForm.cotizTuya||""} onChange={e=>setRefForm(p=>({...p,cotizTuya:e.target.value}))}
                              placeholder="ej: 1420"
                              style={{width:"100%",background:"#0a0a0a",border:"1px solid #38bdf844",borderRadius:5,padding:"5px 8px",color:"#38bdf8",fontFamily:"inherit",fontSize:11,outline:"none"}}/>
                          </div>
                          {comARS>0&&(
                            <div style={{gridColumn:"1/-1",background:"rgba(251,146,60,0.08)",border:"1px solid rgba(251,146,60,0.2)",borderRadius:6,padding:"8px 12px",fontSize:11,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
                              <span style={{color:"#9ca3af"}}>Comisión: <strong style={{color:"#fb923c"}}>${fmt(Math.round(comARS))} ARS</strong></span>
                              <span style={{color:"#94a3b8",fontSize:10}}>{fmt(cantUSD)} USD × (${fmt(cotizRef)}-${fmt(cotizTuya)}) — op a ${fmt(cotizTuya)}</span>
                              <span style={{color:"#fb923c",fontSize:10,fontWeight:600}}>→ CC {clRef?clRef.nombre:"referidor"}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
                <button onClick={registrarOp} disabled={guardando} style={{marginTop:12,width:"100%",padding:11,borderRadius:7,background:guardando?"#0a0a0a":"#0a1a0a",border:"1px solid "+(guardando?"#374151":"#4ade80"),color:guardando?"#374151":"#4ade80",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:guardando?"not-allowed":"pointer",letterSpacing:2,opacity:guardando?0.5:1}}>{guardando?"PROCESANDO...":"REGISTRAR"}</button>
              </Card>
            ):(
              <Card sx={{border:"1px solid #f43f5e33",display:"flex",alignItems:"center",justifyContent:"center",minHeight:200}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:8}}>🔒</div>
                  <div style={{fontSize:12,color:"#f87171",fontWeight:700,marginBottom:6}}>CAJA CERRADA</div>
                  {ultimoCierre?.total_usd&&<div style={{marginTop:8,fontSize:16,color:"#4ade80",fontWeight:700}}>Total: {fmtUSD(ultimoCierre.total_usd)}</div>}
                </div>
              </Card>
            )}
          </div>
        )}

        {pant==="libro"&&(()=>{
          const movsCC_hoy = clientes.flatMap(cl=>
            cl.movimientos
              .filter(mv=>mv.fecha===hoy)
              .map(mv=>({...mv, clienteNombre:cl.nombre+" "+cl.apellido}))
          );
          const todosMovs = [
            ...opsHoy.map(op=>{
              const movs = [];
              const t = op.tipo;
              if(t==="compra"){
                const baseImp=op.baseImpactaCaja!=="no";
                const imp2=op.impactoReal2!==undefined?Number(op.impactoReal2):Number(op.monto2||0);
                const ccParte=Number(op.monto2||0)-imp2;
                // Buscar CCs vinculadas a esta op
                const ccsVinc=clientes.flatMap(cl=>cl.movimientos.filter(mv=>mv.nota&&mv.nota.includes("Op. vinculada")&&mv.fecha===op.fecha&&mv.hora===op.hora).map(mv=>cl.nombre+" "+cl.apellido)).filter((v,i,a)=>a.indexOf(v)===i);
                if(baseImp) movs.push({moneda:op.moneda,monto:op.monto,entrada:true,label:"Compra "+fmt(op.monto)+" "+op.moneda,detalle:op.cliente||(op.nota||""),esCaja:true});
                if(imp2>0) movs.push({moneda:op.moneda2,monto:imp2,entrada:false,label:"Pago efectivo — Compra "+fmt(op.monto)+" "+op.moneda,detalle:op.cliente||(op.nota||""),esCaja:true});
                if(ccParte>0) movs.push({moneda:op.moneda2,monto:ccParte,entrada:false,label:"Pago via CC — Compra "+fmt(op.monto)+" "+op.moneda,detalle:ccsVinc.length>0?ccsVinc.join(", "):(op.nota||""),esCaja:false,esCC:true});
              } else if(t==="venta"){
                const baseImpV=op.baseImpactaCaja!=="no";
                const imp2V=op.impactoReal2!==undefined?Number(op.impactoReal2):Number(op.monto2||0);
                const ccParteV=Number(op.monto2||0)-imp2V;
                const ccsVincV=clientes.flatMap(cl=>cl.movimientos.filter(mv=>mv.nota&&mv.nota.includes("Op. vinculada")&&mv.fecha===op.fecha&&mv.hora===op.hora).map(mv=>cl.nombre+" "+cl.apellido)).filter((v,i,a)=>a.indexOf(v)===i);
                if(baseImpV) movs.push({moneda:op.moneda,monto:op.monto,entrada:false,label:"Venta "+fmt(op.monto)+" "+op.moneda,detalle:op.cliente||(op.nota||""),esCaja:true});
                if(imp2V>0) movs.push({moneda:op.moneda2,monto:imp2V,entrada:true,label:"Cobro efectivo — Venta "+fmt(op.monto)+" "+op.moneda,detalle:op.cliente||(op.nota||""),esCaja:true});
                if(ccParteV>0) movs.push({moneda:op.moneda2,monto:ccParteV,entrada:true,label:"Cobro via CC — Venta "+fmt(op.monto)+" "+op.moneda,detalle:ccsVincV.length>0?ccsVincV.join(", "):(op.nota||""),esCaja:false,esCC:true});
              } else if(t==="cheque_dia"){
                movs.push({moneda:"ARS",monto:op.cn,entrada:true,label:"Cheque al día",detalle:op.cliente||(op.nota||"")});
              } else if(t==="cheque_dif"){
                movs.push({moneda:"ARS",monto:op.montoFinal||op.monto,entrada:false,label:"Cheque diferido (pago)",detalle:op.cliente||(op.nota||"")});
              } else if(t==="transferencia"){
                movs.push({moneda:"ARS",monto:op.tcom||op.monto,entrada:true,label:"Transferencia (comisión)",detalle:op.cliente||(op.nota||"")});
              } else if(t==="cobro_dif"){
                movs.push({moneda:"ARS",monto:op.monto,entrada:true,label:"Cobro diferido",detalle:op.cliente||(op.nota||"")});
              } else if(t==="ajuste"){
                movs.push({moneda:op.moneda,monto:Math.abs(op.delta||op.monto),entrada:(op.delta||0)>0,label:"Ajuste manual",detalle:op.nota||""});
              }
              return movs.map(mv=>({...mv,hora:op.hora,id:op.id+"_"+mv.moneda,origen:"op"}));
            }).flat(),
            ...movsCC_hoy
              .filter(mv=>mv.tipo==="cc_ingreso_transf"||mv.tipo==="cc_ingreso_dep"||mv.tipo==="cc_retiro_transf"||mv.tipo==="cc_retiro_efectivo")
              .map(mv=>{
                const ing=mv.tipo==="cc_ingreso_transf"||mv.tipo==="cc_ingreso_dep";
                return {moneda:mv.moneda,monto:mv.monto,entrada:ing,label:(ing?"Cobro CC":"Pago CC")+" — "+mv.clienteNombre,detalle:mv.nota||"",hora:mv.hora,id:"cc_"+mv.id,origen:"cc"};
              })
          ].sort((a,b)=>(a.hora||"").localeCompare(b.hora||""));

          const extractoPorMoneda = {};
          MONEDAS.forEach(m=>{
            const ini=parse(cajaIni[m.id]||0);
            let sal=ini;
            const filas=[{hora:"APERTURA",label:"Saldo inicial",entrada:true,monto:0,saldo:ini,detalle:"",id:"ini_"+m.id,origen:"ini"}];
            todosMovs.filter(mv=>mv.moneda===m.id).forEach(mv=>{
              // Los movimientos via CC no impactan el saldo de caja fisica
              if(!mv.esCC) sal+=mv.entrada?mv.monto:-mv.monto;
              filas.push({...mv,saldo:sal});
            });
            if(filas.length>1) extractoPorMoneda[m.id]={filas,ini,fin:sal,mon:m};
          });

          return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontSize:10,letterSpacing:3,color:"#38bdf8",marginBottom:2}}>LIBRO DE CAJA — {fechaLarga}</div>
                  <div style={{fontSize:11,color:"#94a3b8"}}>{opsHoy.length} operaciones · extracto con saldo corriente</div>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {MONEDAS.map(m=>{
                    const ini=parse(cajaIni[m.id]||0),fin=saldos[m.id]||0,dif=fin-ini;
                    if(!ini&&!fin) return null;
                    return <div key={m.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid "+m.color+"33",borderRadius:8,padding:"8px 12px"}}>
                      <div style={{fontSize:9,color:m.color,marginBottom:3,fontWeight:700}}>{m.id}</div>
                      <div style={{fontSize:12,fontWeight:700,color:"#e2e8f0"}}>{m.simbolo}{fmt(fin)}</div>
                      <div style={{fontSize:10,color:dif>0?"#4ade80":dif<0?"#f87171":"#475569"}}>{dif>0?"+":""}{m.simbolo}{fmt(dif)}</div>
                    </div>;
                  })}
                </div>
              </div>
              {Object.values(extractoPorMoneda).map(({filas,ini,fin,mon})=>(
                <Card key={mon.id} sx={{marginBottom:14,border:"1px solid "+mon.color+"22"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <span style={{fontSize:12,fontWeight:700,color:mon.color}}>{mon.id} — {mon.label}</span>
                    <span style={{fontSize:11,color:"#9ca3af"}}>{mon.simbolo}{fmt(ini)} → <strong style={{color:"#fff"}}>{mon.simbolo}{fmt(fin)}</strong>
                      <span style={{marginLeft:8,color:fin-ini>0?"#4ade80":fin-ini<0?"#f87171":"#475569",fontWeight:700}}>{fin-ini>0?"+":""}{mon.simbolo}{fmt(fin-ini)}</span>
                    </span>
                  </div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead>
                        <tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                          {["Hora","Concepto","Detalle","Entrada","Salida","Saldo"].map(h=>(
                            <th key={h} style={{textAlign:["Hora","Concepto","Detalle"].includes(h)?"left":"right",padding:"6px 8px",color:"#94a3b8",fontSize:9,fontWeight:600}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((f,i)=>(
                          <tr key={f.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:f.origen==="ini"?"rgba(255,255,255,0.02)":f.esCC?"rgba(99,102,241,0.03)":f.origen==="cc"?"rgba(99,102,241,0.04)":"transparent"}}>
                            <td style={{padding:"7px 8px",color:"#64748b",whiteSpace:"nowrap",fontSize:10}}>{f.hora}</td>
                            <td style={{padding:"7px 8px",color:f.esCC?"#a5b4fc":"#e2e8f0",fontWeight:f.origen==="ini"?600:400}}>
                              {f.origen==="cc"&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:"rgba(99,102,241,0.15)",color:"#a5b4fc",marginRight:6}}>CC</span>}
                              {f.esCC&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:"rgba(99,102,241,0.12)",color:"#a5b4fc",marginRight:6}}>⇄ CC</span>}
                              {f.esCaja&&f.origen!=="ini"&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:"rgba(74,222,128,0.08)",color:"#4ade80",marginRight:6}}>💵</span>}
                              {f.label}
                            </td>
                            <td style={{padding:"7px 8px",color:f.esCC?"#6366f1":"#4b5563",fontSize:10,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.detalle}</td>
                            <td style={{padding:"7px 8px",textAlign:"right",color:f.esCC?"#a5b4fc":"#4ade80",fontWeight:600}}>{f.entrada&&f.monto>0?mon.simbolo+fmt(f.monto):""}</td>
                            <td style={{padding:"7px 8px",textAlign:"right",color:f.esCC?"#a5b4fc":"#f87171",fontWeight:600}}>{!f.entrada&&f.monto>0?mon.simbolo+fmt(f.monto):""}</td>
                            <td style={{padding:"7px 8px",textAlign:"right",fontWeight:700,color:f.esCC?"#6b7280":f.saldo>0?"#e2e8f0":f.saldo<0?"#f87171":"#475569",fontFamily:"'JetBrains Mono',monospace",fontSize:f.esCC?10:11}}>{f.esCC?"—":mon.simbolo+fmt(f.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{borderTop:"2px solid rgba(255,255,255,0.1)"}}>
                          <td colSpan={3} style={{padding:"8px",fontSize:10,color:"#9ca3af",fontWeight:600}}>SALDO FINAL</td>
                          <td style={{padding:"8px",textAlign:"right",color:"#4ade80",fontWeight:700}}>{mon.simbolo}{fmt(filas.filter(f=>f.entrada&&f.monto>0).reduce((s,f)=>s+f.monto,0))}</td>
                          <td style={{padding:"8px",textAlign:"right",color:"#f87171",fontWeight:700}}>{mon.simbolo}{fmt(filas.filter(f=>!f.entrada&&f.monto>0).reduce((s,f)=>s+f.monto,0))}</td>
                          <td style={{padding:"8px",textAlign:"right",fontWeight:700,color:fin>0?"#4ade80":fin<0?"#f87171":"#475569",fontFamily:"'JetBrains Mono',monospace"}}>{mon.simbolo}{fmt(fin)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              ))}
              {Object.keys(extractoPorMoneda).length===0&&(
                <Card sx={{textAlign:"center",padding:40}}>
                  <div style={{fontSize:24,marginBottom:8}}>📒</div>
                  <div style={{color:"#64748b"}}>Sin movimientos hoy</div>
                </Card>
              )}
            </div>
          );
        })()}
        {pant==="cartera"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:10,letterSpacing:3,color:"#c084fc"}}>CARTERA DE DIFERIDOS</div>
              <button onClick={()=>setMostrarFormDif(v=>!v)} style={{padding:"7px 14px",borderRadius:6,background:mostrarFormDif?"#1c0a0a":"#0a0a1a",border:"1px solid "+(mostrarFormDif?"#f43f5e":"#c084fc"),color:mostrarFormDif?"#f87171":"#c084fc",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                {mostrarFormDif?"Cancelar":"+ Cheque a cobrar"}
              </button>
            </div>
            {mostrarFormDif&&(
              <Card sx={{marginBottom:16,border:"1px solid #c084fc44"}}>
                <div style={{fontSize:10,letterSpacing:3,color:"#c084fc",marginBottom:12}}>REGISTRAR CHEQUE A COBRAR</div>
                <div style={{fontSize:11,color:"#94a3b8",marginBottom:12}}>Solo para cheques ya entregados — no impacta saldo de caja, solo queda como activo a cobrar.</div>
                <div style={S.grid("1fr 1fr",10)}>
                  <div><Lbl>Cliente / Empresa</Lbl><Inp placeholder="Nombre..." value={formDifManual.cliente} onChange={e=>setFormDifManual(f=>({...f,cliente:e.target.value}))}/></div>
                  <div><Lbl>Nominal a cobrar $</Lbl><Inp type="number" placeholder="0" value={formDifManual.nominal} onChange={e=>setFormDifManual(f=>({...f,nominal:e.target.value}))}/></div>
                  <div><Lbl>Fecha de acreditacion</Lbl><Inp type="date" value={formDifManual.fechaAcr} onChange={e=>setFormDifManual(f=>({...f,fechaAcr:e.target.value}))}/></div>
                  <div><Lbl>Nota (opcional)</Lbl><Inp placeholder="..." value={formDifManual.nota} onChange={e=>setFormDifManual(f=>({...f,nota:e.target.value}))}/></div>
                </div>
                <button onClick={async()=>{
                  const nominal=parse(formDifManual.nominal);
                  if(!nominal||!formDifManual.fechaAcr){notify("Ingresa nominal y fecha",false);return;}
                  const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
                  const dif={hora,fecha:hoy,cliente:formDifManual.cliente,nominal,m_final:0,ganancia:0,fecha_acr:formDifManual.fechaAcr,tm:0,dias:diasEntre(hoy,formDifManual.fechaAcr),cobrado:false,nota:formDifManual.nota||"",manual:true};
                  const {data:ins}=await SB.from("diferidos").insert(dif).select().single();
                  if(ins) setDiferidos(p=>[...p,{id:ins.id,hora:ins.hora,fecha:ins.fecha,cliente:ins.cliente,nominal:ins.nominal,mFinal:ins.m_final,ganancia:ins.ganancia,fechaAcr:ins.fecha_acr,tm:ins.tm,dias:ins.dias,cobrado:ins.cobrado,nota:ins.nota,manual:ins.manual}]);
                  setFormDifManual({cliente:"",nominal:"",fechaAcr:"",nota:""});
                  setMostrarFormDif(false);
                  notify("Cheque registrado");
                }} style={{marginTop:12,padding:"10px 20px",borderRadius:7,background:"#0a0a1a",border:"1px solid #c084fc",color:"#c084fc",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  REGISTRAR
                </button>
              </Card>
            )}
            {diferidos.filter(d=>!d.cobrado).length===0&&<div style={{color:"#64748b",fontSize:12}}>Sin diferidos pendientes</div>}
            {[...diferidos.filter(d=>!d.cobrado)].sort((a,b)=>a.fechaAcr?.localeCompare(b.fechaAcr)).map(d=>{
              const dr=diasEntre(hoy,d.fechaAcr),venc=dr===0,urg=dr<=3&&!venc;
              return (
                <Card key={d.id} sx={{marginBottom:9,border:"1px solid "+(venc?"#f43f5e":urg?"#f59e0b":"#c084fc33")}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:7,marginBottom:5,alignItems:"center",flexWrap:"wrap"}}>
                        {d.manual&&<span style={{fontSize:9,color:"#c084fc",background:"#c084fc11",padding:"1px 6px",borderRadius:4,border:"1px solid #c084fc33"}}>MANUAL</span>}
                        {venc&&<span style={{fontSize:10,color:"#f43f5e",fontWeight:700}}>VENCIDO</span>}
                        {urg&&<span style={{fontSize:10,color:"#f59e0b",fontWeight:700}}>VENCE EN {dr}d</span>}
                        {!venc&&!urg&&<span style={{fontSize:10,color:"#9ca3af"}}>Acredita {d.fechaAcr} - {dr}d</span>}
                        {d.cliente&&<span style={{fontSize:10,color:"#9ca3af"}}>👤 {d.cliente}</span>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>
                        {/* Fila nominal */}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontSize:10,color:"#9ca3af"}}>Nominal</span>
                          <span style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>${fmt(d.nominal)}</span>
                        </div>
                        {/* Fila pagaste al cliente */}
                        {!d.manual&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontSize:10,color:"#9ca3af"}}>Pagaste al cliente</span>
                          <span style={{fontSize:12,fontWeight:600,color:"#f87171"}}>-${fmt(d.mFinal||d.nominal)}</span>
                        </div>}
                        {/* Fila empresa te paga - solo si tiene tasa endoso */}
                        {d.tasaEndoso&&parse(d.tasaEndoso)>0&&(()=>{
                          const empresaPaga=d.nominal*(1-parse(d.tasaEndoso)/100);
                          const gananciaNeta=empresaPaga-(d.mFinal||d.nominal);
                          return (<>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <span style={{fontSize:10,color:"#9ca3af"}}>Empresa te paga ({d.tasaEndoso}%)</span>
                              <span style={{fontSize:12,fontWeight:600,color:"#c084fc"}}>${fmt(empresaPaga)}</span>
                            </div>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid #1f2937",paddingTop:4}}>
                              <span style={{fontSize:10,color:"#4ade80",fontWeight:600}}>Ganancia neta</span>
                              <span style={{fontSize:13,fontWeight:700,color:gananciaNeta>-1?"#4ade80":"#f87171"}}>{gananciaNeta>-1?"+":"-"}${fmt(Math.abs(gananciaNeta))}</span>
                            </div>
                          </>);
                        })()}
                        {/* Si no tiene tasa endoso, mostrar ganancia basica */}
                        {(!d.tasaEndoso||parse(d.tasaEndoso)===0)&&!d.manual&&d.ganancia>0&&(
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid #1f2937",paddingTop:4}}>
                            <span style={{fontSize:10,color:"#4ade80",fontWeight:600}}>Ganancia estimada</span>
                            <span style={{fontSize:13,fontWeight:700,color:"#4ade80"}}>+${fmt(d.ganancia)}</span>
                          </div>
                        )}
                      </div>
                      {/* Alertas de fechas */}
                      {(d.fechaVenc||d.fechaAcr)&&(()=>{
                        const drVenc=d.fechaVenc?diasEntre(hoy,d.fechaVenc):null;
                        const drAcr=d.fechaAcr?diasEntre(hoy,d.fechaAcr):null;
                        return (
                          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                            {d.fechaVenc&&<div style={{padding:"3px 8px",borderRadius:5,background:drVenc===0?"rgba(244,63,94,0.15)":drVenc<=2?"rgba(245,158,11,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(drVenc===0?"#f43f5e44":drVenc<=2?"#f59e0b44":"#1f2937")}}>
                              <span style={{fontSize:9,color:"#9ca3af"}}>📋 Depositar: </span>
                              <span style={{fontSize:10,fontWeight:600,color:drVenc===0?"#f43f5e":drVenc<=2?"#f59e0b":"#9ca3af"}}>{d.fechaVenc}{drVenc!==null&&<span> ({drVenc===0?"HOY":drVenc+"d"})</span>}</span>
                            </div>}
                            {d.fechaAcr&&<div style={{padding:"3px 8px",borderRadius:5,background:drAcr===0?"rgba(99,102,241,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(drAcr===0?"#6366f144":"#1f2937")}}>
                              <span style={{fontSize:9,color:"#9ca3af"}}>💰 Acreditacion: </span>
                              <span style={{fontSize:10,fontWeight:600,color:drAcr===0?"#a5b4fc":"#9ca3af"}}>{d.fechaAcr}{drAcr!==null&&<span> ({drAcr===0?"HOY":drAcr+"d"})</span>}</span>
                            </div>}
                          </div>
                        );
                      })()}
                      <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:9,color:"#94a3b8"}}>COBRO:</span>
                          <input type="date" value={d.fechaCobro||""} onChange={async e=>{
                            const val=e.target.value;
                            await SB.from("diferidos").update({fecha_cobro:val}).eq("id",d.id);
                            setDiferidos(p=>p.map(x=>x.id!==d.id?x:{...x,fechaCobro:val}));
                          }} style={{background:"transparent",border:"1px solid #1f2937",borderRadius:4,padding:"2px 6px",color:"#9ca3af",fontFamily:"inherit",fontSize:10,cursor:"pointer"}}/>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:9,color:"#94a3b8"}}>TASA ENDOSO:</span>
                          <input type="number" placeholder="0" value={d.tasaEndoso||""} onChange={async e=>{
                            const val=e.target.value;
                            await SB.from("diferidos").update({tasa_endoso:val}).eq("id",d.id);
                            setDiferidos(p=>p.map(x=>x.id!==d.id?x:{...x,tasaEndoso:val}));
                          }} style={{background:"transparent",border:"1px solid #1f2937",borderRadius:4,padding:"2px 6px",color:"#9ca3af",fontFamily:"inherit",fontSize:10,width:50}}/>
                          <span style={{fontSize:9,color:"#94a3b8"}}>%</span>
                          {d.tasaEndoso&&parse(d.tasaEndoso)>0&&(()=>{
                            const neto=(d.mFinal||d.nominal)*(1-parse(d.tasaEndoso)/100);
                            return <span style={{fontSize:10,color:"#4ade80",fontWeight:700,marginLeft:6}}>→ ${fmt(neto)} neto</span>;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end",flexShrink:0}}>
                      <button onClick={()=>{setCobrandoDif(cobrandoDif===d.id?null:d.id);setCobrandoDifCC({modo:"caja",clienteId:"",buscar:""}); }}
                        style={{padding:"7px 12px",borderRadius:6,background:cobrandoDif===d.id?"#1a2e1a":"#052e16",border:"1px solid #4ade80",color:"#4ade80",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                        {cobrandoDif===d.id?"▾ Cobrar":"▸ Cobrar"}
                      </button>
                      {cobrandoDif===d.id&&(()=>{
                        const te=parse(d.tasaEndoso||"0");
                        const montoCobro=te>0?d.nominal*(1-te/100):d.nominal;
                        const clSel=clientes.find(x=>x.id===Number(cobrandoDifCC.clienteId));
                        const filtCC=clientes.filter(x=>(x.nombre+" "+x.apellido).toLowerCase().includes((cobrandoDifCC.buscar||"").toLowerCase()));
                        return (
                          <div style={{background:"#0a1a0a",border:"1px solid #22c55e33",borderRadius:8,padding:12,width:240,display:"flex",flexDirection:"column",gap:10}}>
                            <div style={{fontSize:10,color:"#4ade80",fontWeight:700}}>Monto a cobrar: ${fmt(montoCobro)}</div>
                            {/* Toggle caja / CC */}
                            <div style={{display:"flex",gap:6}}>
                              {["caja","cc"].map(m=>(
                                <button key={m} onClick={()=>setCobrandoDifCC(p=>({...p,modo:m}))}
                                  style={{flex:1,padding:"5px 0",borderRadius:5,fontFamily:"inherit",fontSize:10,fontWeight:700,cursor:"pointer",
                                    background:cobrandoDifCC.modo===m?"rgba(74,222,128,0.15)":"transparent",
                                    border:"1px solid "+(cobrandoDifCC.modo===m?"#4ade80":"#374151"),
                                    color:cobrandoDifCC.modo===m?"#4ade80":"#6b7280"}}>
                                  {m==="caja"?"🏦 Caja":"👤 CC"}
                                </button>
                              ))}
                            </div>
                            {/* Si es CC, selector de cliente */}
                            {cobrandoDifCC.modo==="cc"&&(
                              <div style={{position:"relative"}}>
                                <Lbl>Cliente comprador</Lbl>
                                <div style={{display:"flex",gap:4}}>
                                  {clSel&&!cobrandoDifCC.buscar&&<div style={{flex:1,padding:"4px 7px",borderRadius:5,background:"rgba(74,222,128,0.08)",border:"1px solid #4ade8033",fontSize:10,color:"#4ade80",fontWeight:600}}>{clSel.nombre} {clSel.apellido}</div>}
                                  <input value={cobrandoDifCC.buscar||""} onChange={e=>setCobrandoDifCC(p=>({...p,buscar:e.target.value}))}
                                    placeholder={clSel&&!cobrandoDifCC.buscar?"Cambiar...":"Buscar cliente..."}
                                    style={{flex:1,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:5,padding:"4px 7px",color:"#e2e8f0",fontFamily:"inherit",fontSize:10,outline:"none"}}/>
                                  {cobrandoDifCC.clienteId&&<button onClick={()=>setCobrandoDifCC(p=>({...p,clienteId:"",buscar:""}))} style={{padding:"2px 5px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontSize:9}}>✕</button>}
                                </div>
                                {cobrandoDifCC.buscar&&<DropdownCC buscar={cobrandoDifCC.buscar} filtrados={filtCC} onSelect={cl=>setCobrandoDifCC(p=>({...p,clienteId:String(cl.id),buscar:""}))} onCrear={nombre=>setNuevoClienteCC({visible:true,nombre,socio:"Manuel Sala",onCreado:cl=>setCobrandoDifCC(p=>({...p,clienteId:String(cl.id),buscar:""}))})}/>}
                              </div>
                            )}
                            {/* Botón confirmar */}
                            <button
                              disabled={cobrandoDifCC.modo==="cc"&&!cobrandoDifCC.clienteId}
                              onClick={()=>cobrarDif(d.id,cobrandoDifCC.modo,cobrandoDifCC.clienteId||null)}
                              style={{padding:"7px",borderRadius:6,background:cobrandoDifCC.modo==="cc"&&!cobrandoDifCC.clienteId?"#0a0a0a":"#052e16",border:"1px solid "+(cobrandoDifCC.modo==="cc"&&!cobrandoDifCC.clienteId?"#374151":"#4ade80"),color:cobrandoDifCC.modo==="cc"&&!cobrandoDifCC.clienteId?"#374151":"#4ade80",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:cobrandoDifCC.modo==="cc"&&!cobrandoDifCC.clienteId?"not-allowed":"pointer"}}>
                              ✓ Confirmar cobro {cobrandoDifCC.modo==="cc"?"→ CC":"→ Caja"}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {pant==="clientes"&&!clienteActivo&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#34d399",marginBottom:14}}>CUENTAS CORRIENTES</div>
            <Card sx={{marginBottom:14}}>
              <div style={{fontSize:10,letterSpacing:3,color:"#34d399",marginBottom:10}}>NUEVO CLIENTE</div>
              <div style={S.grid("1fr 1fr 1fr",8)}>
                <div><Lbl>Nombre</Lbl><Inp placeholder="Juan" value={nuevoC.nombre} onChange={e=>setNuevoC(n=>({...n,nombre:e.target.value}))}/></div>
                <div><Lbl>Apellido</Lbl><Inp placeholder="Garcia" value={nuevoC.apellido} onChange={e=>setNuevoC(n=>({...n,apellido:e.target.value}))}/></div>
                <div><Lbl>Socio</Lbl>
                  <Sel value={nuevoC.socio} onChange={e=>setNuevoC(n=>({...n,socio:e.target.value}))}>
                    {SOCIOS_FIJOS.map(s=><option key={s} value={s}>{s}</option>)}
                  </Sel>
                </div>
              </div>
              <button onClick={agregarCliente} style={{marginTop:9,padding:"8px 18px",borderRadius:6,background:"#052e16",border:"1px solid #34d399",color:"#34d399",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Agregar</button>
            </Card>
            <div style={{marginBottom:12}}>
              <Inp placeholder="Buscar cliente..." value={busqCliente} onChange={e=>setBusqCliente(e.target.value)} sx={{maxWidth:320,background:"#0d0d0d"}}/>
            </div>
            {editandoCliente&&(
              <Card sx={{marginBottom:14,border:"1px solid #38bdf833"}}>
                <div style={{fontSize:10,letterSpacing:3,color:"#38bdf8",marginBottom:10}}>EDITAR CLIENTE</div>
                <div style={S.grid("1fr 1fr 1fr",8)}>
                  <div><Lbl>Nombre</Lbl><Inp value={editClienteV.nombre} onChange={e=>setEditClienteV(v=>({...v,nombre:e.target.value}))}/></div>
                  <div><Lbl>Apellido</Lbl><Inp value={editClienteV.apellido} onChange={e=>setEditClienteV(v=>({...v,apellido:e.target.value}))}/></div>
                  <div><Lbl>Socio</Lbl>
                    <Sel value={editClienteV.socio} onChange={e=>setEditClienteV(v=>({...v,socio:e.target.value}))}>
                      {SOCIOS_FIJOS.map(s=><option key={s} value={s}>{s}</option>)}
                    </Sel>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <button onClick={async()=>{
                    await SB.from("clientes").update({nombre:editClienteV.nombre,apellido:editClienteV.apellido,socio:editClienteV.socio}).eq("id",editandoCliente);
                    setClientes(p=>p.map(x=>x.id!==editandoCliente?x:{...x,...editClienteV}));
                    setEditandoCliente(null); notify("Cliente actualizado");
                  }} style={{padding:"7px 16px",borderRadius:6,background:"#0a1a2e",border:"1px solid #38bdf8",color:"#38bdf8",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>Guardar</button>
                  <button onClick={()=>setEditandoCliente(null)} style={{padding:"7px 14px",borderRadius:6,background:"transparent",border:"1px solid #1f2937",color:"#94a3b8",fontFamily:"inherit",fontSize:12,cursor:"pointer"}}>Cancelar</button>
                </div>
              </Card>
            )}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:9}}>
              {clientes.filter(c=>{
                const q=busqCliente.toLowerCase();
                return !q||(c.nombre+" "+c.apellido).toLowerCase().includes(q)||(c.socio||"").toLowerCase().includes(q);
              }).map(c=>{ const sal=saldoCC(c);
                const colorSocio=c.socio==="Manuel Sala"?"#4ade80":c.socio==="Gonzalo Spadafora"?"#38bdf8":"#f59e0b";
                return (
                  <Card key={c.id} className="card-hover" style={{...S.card,position:"relative",cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div style={{fontSize:9,color:colorSocio,fontWeight:700}}>{c.socio||"Sin socio"}</div>
                      <div style={{display:"flex",gap:4}}>
                        <button onClick={e=>{e.stopPropagation();setEditandoCliente(c.id);setEditClienteV({nombre:c.nombre,apellido:c.apellido,socio:c.socio||"Manuel Sala"});}} style={{width:22,height:22,borderRadius:4,background:"transparent",border:"1px solid #38bdf8",color:"#38bdf8",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✎</button>
                        <button title={c.oculto?"Mostrar en Posición":"Ocultar en Posición"} onClick={async e=>{e.stopPropagation();const nuevo=!c.oculto;await SB.from("clientes").update({oculto:nuevo}).eq("id",c.id);setClientes(p=>p.map(x=>x.id===c.id?{...x,oculto:nuevo}:x));notify(nuevo?"Oculto en Posición":"Visible en Posición");}}
                          style={{width:22,height:22,borderRadius:4,background:c.oculto?"rgba(248,113,113,0.1)":"transparent",border:"1px solid "+(c.oculto?"#f87171":"#374151"),color:c.oculto?"#f87171":"#4b5563",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                          {c.oculto?"👁":"○"}
                        </button>
                        <button onClick={e=>{e.stopPropagation();eliminarCliente(c.id);}} style={{width:22,height:22,borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#94a3b8",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>x</button>
                      </div>
                    </div>
                    <div style={{cursor:"pointer"}} onClick={()=>{setClienteActivo(c.id);setFormCC({tipo:"ingreso_transf",moneda:"ARS",monto:"",nota:"",impactaCaja:true});}}>
                      <div style={{fontWeight:700,marginBottom:5}}>{c.nombre} {c.apellido}</div>
                      {MONEDAS.map(m=>{ const v=sal[m.id]; if(!v) return null;
                        return <div key={m.id} style={{fontSize:11,color:v>0?"#4ade80":"#f87171",marginBottom:2}}>{v>0?"Me debe":"Le debo"} {m.simbolo}{fmt(Math.abs(v))} {m.id}</div>;})}
                      {MONEDAS.every(m=>!sal[m.id])&&<div style={{fontSize:11,color:"#94a3b8"}}>Sin movimientos</div>}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {pant==="clientes"&&clienteActivo&&(()=>{
          const c=clientes.find(x=>x.id===clienteActivo); if(!c) return null;

          const sal=saldoCC(c);
          return (
            <div>
              <button onClick={()=>setClienteActivo(null)} style={{...S.btn(false),marginBottom:14}}>Volver</button>
              <div style={{fontSize:15,fontWeight:700,marginBottom:7}}>{c.nombre} {c.apellido}</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:18}}>
                {MONEDAS.map(m=>{ const v=sal[m.id]; if(!v) return null;
                  return <div key={m.id} style={{background:"#111",border:"1px solid "+(v>0?"#f4433633":"#22c55e33"),borderRadius:6,padding:"7px 11px"}}>
                    <div style={{fontSize:9,color:"#9ca3af",marginBottom:2}}>{m.id}</div>
                    <div style={{fontWeight:700,color:v>0?"#4ade80":"#f87171"}}>{v>0?"Me debe":"Le debo"} {m.simbolo}{fmt(Math.abs(v))}</div>
                  </div>;})}
              </div>
              <div className="grid-mobile-1" style={S.grid("1fr 1fr",18)}>
                <Card>
                  <div style={{marginBottom:9}}>
                    <div style={{fontSize:9,letterSpacing:2,color:"#34d399",marginBottom:5}}>RECIBIS PLATA</div>
                    <div style={{display:"flex",gap:5}}>
                      {[{id:"ingreso_transf",label:"Transferencia"},{id:"ingreso_dep",label:"Deposito"}].map(t=>(
                        <button key={t.id} onClick={()=>setFormCC(f=>({...f,tipo:t.id}))} style={{...S.btn(formCC.tipo===t.id,"#34d399"),flex:1}}>{t.label}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:9,letterSpacing:2,color:"#f97316",marginBottom:5}}>MANDAS PLATA</div>
                    <div style={{display:"flex",gap:5}}>
                      {[{id:"retiro_transf",label:"Transferencia",c:"#38bdf8"},{id:"retiro_efectivo",label:"Efectivo",c:"#f97316"}].map(t=>(
                        <button key={t.id} onClick={()=>{setFormCC(f=>({...f,tipo:t.id}));setTransCC(t=>({...t,activo:false}));}} style={{...S.btn(formCC.tipo===t.id&&!transCC.activo,t.c),flex:1}}>{t.label}</button>
                      ))}
                    </div>
                  </div>
                  {/* Convertir saldo */}
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:9,letterSpacing:2,color:"#2dd4bf",marginBottom:5}}>CONVERTIR SALDO</div>
                    <button onClick={()=>{setConvertirCC(cv=>({...cv,activo:!cv.activo}));setTransCC(t=>({...t,activo:false}));}}
                      style={{...S.btn(convertirCC.activo,"#2dd4bf"),width:"100%"}}>
                      ⇌ Convertir moneda en CC
                    </button>
                  </div>
                  {convertirCC.activo&&(()=>{
                    const salOrigen=saldoCC(c)[convertirCC.monedaOrigen]||0;
                    const montoOrigen=parse(convertirCC.monto)||Math.abs(salOrigen);
                    const cotiz=parse(convertirCC.cotiz)||1;
                    // Calcular montoDestino segun las monedas
                    const monO=convertirCC.monedaOrigen, monD=convertirCC.monedaDestino;
                    let montoDestino;
                    if(monO==="ARS"&&monD==="USD") montoDestino=montoOrigen/cotiz;
                    else if(monO==="USD"&&monD==="ARS") montoDestino=montoOrigen*cotiz;
                    else if(monO==="ARS"&&(monD==="EUR"||monD==="GBP")) montoDestino=montoOrigen/cotiz;
                    else if((monO==="EUR"||monO==="GBP")&&monD==="ARS") montoDestino=montoOrigen*cotiz;
                    else if(monO==="USD"&&(monD==="EUR"||monD==="GBP"||monD==="USDT")) montoDestino=montoOrigen*cotiz;
                    else if((monO==="EUR"||monO==="GBP"||monO==="USDT")&&monD==="USD") montoDestino=montoOrigen/cotiz;
                    else montoDestino=montoOrigen*cotiz;
                    // Determinar si le debemos o nos debe en moneda origen
                    const leDebemosOrigen=salOrigen<0; // negativo = le debemos
                    // Preview explicativo
                    const textoPreview=leDebemosOrigen
                      ? "Le debemos "+fmt(montoOrigen)+" "+monO+" → le pasamos a deber "+fmt(montoDestino)+" "+monD
                      : "Nos debe "+fmt(montoOrigen)+" "+monO+" → nos pasa a deber "+fmt(montoDestino)+" "+monD;
                    return (
                      <div style={{background:"rgba(45,212,191,0.05)",border:"1px solid rgba(45,212,191,0.2)",borderRadius:8,padding:10,marginBottom:12}}>
                        <div style={{fontSize:9,color:"#2dd4bf",letterSpacing:2,marginBottom:8}}>CONVERTIR EN CC DE {c.nombre}</div>
                        {/* Saldos actuales */}
                        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                          {MONEDAS.filter(m=>saldoCC(c)[m.id]!==0).map(m=>{
                            const sal=saldoCC(c)[m.id];
                            return <div key={m.id} style={{padding:"3px 8px",borderRadius:4,background:"rgba(255,255,255,0.03)",border:"1px solid #1f2937",fontSize:10}}>
                              <span style={{color:"#9ca3af"}}>{m.id}: </span>
                              <span style={{color:sal>0?"#4ade80":"#f87171",fontWeight:600}}>{sal>0?"nos debe ":"le debemos "}{m.simbolo}{fmt(Math.abs(sal))}</span>
                            </div>;
                          })}
                        </div>
                        <div style={S.grid("1fr 1fr",8)}>
                          <div><Lbl>De (moneda origen)</Lbl><MonedasSel value={convertirCC.monedaOrigen} onChange={v=>setConvertirCC(cv=>({...cv,monedaOrigen:v,monto:""}))}/></div>
                          <div><Lbl>A (moneda destino)</Lbl><MonedasSel value={convertirCC.monedaDestino} onChange={v=>setConvertirCC(cv=>({...cv,monedaDestino:v}))}/></div>
                          <div>
                            <Lbl>Monto a convertir ({monO})</Lbl>
                            <Inp type="number" placeholder={fmt(Math.abs(salOrigen))+" (saldo completo)"} value={convertirCC.monto}
                              onChange={e=>setConvertirCC(cv=>({...cv,monto:e.target.value}))}/>
                          </div>
                          <div>
                            <Lbl>Cotizacion ({monO}/{monD})</Lbl>
                            <Inp type="number" placeholder={monO==="ARS"||monD==="ARS"?"1400":"1"} value={convertirCC.cotiz}
                              onChange={e=>setConvertirCC(cv=>({...cv,cotiz:e.target.value}))}/>
                          </div>
                        </div>
                        {montoOrigen>0&&convertirCC.cotiz&&(
                          <div style={{marginTop:8,padding:"8px 10px",borderRadius:6,background:"rgba(45,212,191,0.08)",border:"1px solid #2dd4bf33",fontSize:11}}>
                            <div style={{color:"#2dd4bf",fontWeight:600,marginBottom:4}}>{textoPreview}</div>
                            <div style={{color:"#9ca3af",fontSize:10}}>
                              Cancela: {fmt(montoOrigen)} {monO} → Crea: {fmt(montoDestino)} {monD}
                            </div>
                          </div>
                        )}
                        <button onClick={async()=>{
                          if(!montoOrigen||!cotiz){notify("Completa monto y cotizacion",false);return;}
                          const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
                          const nota="Conversion "+fmt(montoOrigen)+" "+monO+" → "+fmt(montoDestino)+" "+monD+" (cotiz "+fmt(cotiz)+")";
                          // Movimiento 1: cancelar en moneda origen
                          // Si le debemos (neg) → retiro_transf sube el saldo hacia 0
                          // Si nos debe (pos) → ingreso_transf baja el saldo hacia 0
                          const tipoCancel=leDebemosOrigen?"retiro_transf":"ingreso_transf";
                          const {data:ins1}=await SB.from("movimientos_cc").insert({cliente_id:c.id,hora,fecha:hoy,tipo:tipoCancel,moneda:monO,monto:montoOrigen,nota}).select().single();
                          const mv1={id:ins1?.id||Date.now(),hora,fecha:hoy,tipo:tipoCancel,moneda:monO,monto:montoOrigen,nota};
                          setClientes(p=>p.map(cl=>cl.id!==c.id?cl:{...cl,movimientos:[...cl.movimientos,mv1]}));
                          // Movimiento 2: crear deuda en moneda destino (mismo sentido)
                          // Si le debíamos → ahora le debemos en destino → ingreso_transf
                          // Si nos debía → ahora nos debe en destino → retiro_transf
                          const tipoNuevo=leDebemosOrigen?"ingreso_transf":"retiro_transf";
                          const {data:ins2}=await SB.from("movimientos_cc").insert({cliente_id:c.id,hora,fecha:hoy,tipo:tipoNuevo,moneda:monD,monto:montoDestino,nota}).select().single();
                          const mv2={id:ins2?.id||Date.now()+1,hora,fecha:hoy,tipo:tipoNuevo,moneda:monD,monto:montoDestino,nota};
                          setClientes(p=>p.map(cl=>cl.id!==c.id?cl:{...cl,movimientos:[...cl.movimientos,mv2]}));
                          setConvertirCC({activo:false,monedaOrigen:"USD",monedaDestino:"ARS",monto:"",cotiz:""});
                          notify("Conversion registrada ✓");
                        }} style={{marginTop:10,width:"100%",padding:9,borderRadius:7,background:"rgba(45,212,191,0.1)",border:"1px solid #2dd4bf",color:"#2dd4bf",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                          ⇌ Confirmar conversion
                        </button>
                      </div>
                    );
                  })()}
                  {/* Transferencia entre CCs */}
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:9,letterSpacing:2,color:"#a78bfa",marginBottom:5}}>ENTRE CUENTAS</div>
                    <button onClick={()=>setTransCC(t=>({...t,activo:!t.activo}))}
                      style={{...S.btn(transCC.activo,"#a78bfa"),width:"100%"}}>
                      ⇄ Transferencia entre CCs
                    </button>
                  </div>
                  {transCC.activo?(
                    <div style={{background:"rgba(167,139,250,0.05)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:8,padding:10,marginBottom:10}}>
                      <div style={{fontSize:9,color:"#a78bfa",letterSpacing:2,marginBottom:8}}>ENVIAR A OTRA CC</div>
                      {/* Buscador CC destino */}
                      <div style={{position:"relative",marginBottom:8}}>
                        <Lbl>CC Destino</Lbl>
                        {(()=>{
                          const clDest=clientes.find(x=>x.id===Number(transCC.destino));
                          const filtrados=clientes.filter(x=>x.id!==c.id&&(x.nombre+" "+x.apellido).toLowerCase().includes(transCC.buscar.toLowerCase()));
                          return (
                            <div>
                              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                                {clDest&&!transCC.buscar&&(
                                  <div style={{flex:1,padding:"6px 8px",borderRadius:6,background:"rgba(167,139,250,0.1)",border:"1px solid #a78bfa44",fontSize:11,color:"#a78bfa",fontWeight:600}}>
                                    {clDest.nombre} {clDest.apellido}
                                  </div>
                                )}
                                <input value={transCC.buscar} onChange={e=>setTransCC(t=>({...t,buscar:e.target.value}))}
                                  placeholder={clDest&&!transCC.buscar?"Cambiar...":"Buscar cliente..."}
                                  style={{flex:1,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"6px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:11,outline:"none"}}/>
                              </div>
                              {transCC.buscar&&filtrados.length>0&&(
                                <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:200,maxHeight:140,overflowY:"auto",marginTop:2}}>
                                  {filtrados.map(cl=>(
                                    <div key={cl.id} onClick={()=>setTransCC(t=>({...t,destino:String(cl.id),buscar:""}))}
                                      style={{padding:"7px 10px",cursor:"pointer",fontSize:11,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>
                                      {cl.nombre} {cl.apellido}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div style={S.grid("80px 1fr",8)}>
                        <div><Lbl>Moneda</Lbl><MonedasSel value={transCC.moneda} onChange={v=>setTransCC(t=>({...t,moneda:v}))}/></div>
                        <div><Lbl>Monto</Lbl><Inp type="number" placeholder="0" value={transCC.monto} onChange={e=>setTransCC(t=>({...t,monto:e.target.value}))}/></div>
                      </div>
                      <div style={{...S.grid("1fr 1fr",8),marginTop:8}}>
                        <div>
                          <Lbl>% Com. origen <span style={{color:"#94a3b8",fontSize:9}}>(opcional)</span></Lbl>
                          <Inp type="number" placeholder="0" value={transCC.pctOrigen} onChange={e=>setTransCC(t=>({...t,pctOrigen:e.target.value}))}/>
                        </div>
                        <div>
                          <Lbl>% Com. destino <span style={{color:"#94a3b8",fontSize:9}}>(opcional)</span></Lbl>
                          <Inp type="number" placeholder="0" value={transCC.pctDestino} onChange={e=>setTransCC(t=>({...t,pctDestino:e.target.value}))}/>
                        </div>
                      </div>
                      {(transCC.pctOrigen||transCC.pctDestino)&&parse(transCC.monto)>0&&(()=>{
                        const m=parse(transCC.monto);
                        const comO=m*parse(transCC.pctOrigen)/100;
                        const comD=m*parse(transCC.pctDestino)/100;
                        return (
                          <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                            {transCC.pctOrigen&&<div style={{flex:1,padding:"4px 8px",borderRadius:5,background:"rgba(74,222,128,0.06)",border:"1px solid #4ade8022",fontSize:10}}>
                              <span style={{color:"#94a3b8"}}>Origen recibe: </span>
                              <span style={{color:"#4ade80",fontWeight:700}}>{MONEDAS.find(m=>m.id===transCC.moneda)?.simbolo}{fmt(m-comO)}</span>
                              <span style={{color:"#64748b"}}> (com. ${fmt(comO)})</span>
                            </div>}
                            {transCC.pctDestino&&<div style={{flex:1,padding:"4px 8px",borderRadius:5,background:"rgba(248,113,113,0.06)",border:"1px solid #f8717122",fontSize:10}}>
                              <span style={{color:"#94a3b8"}}>Destino debe: </span>
                              <span style={{color:"#f87171",fontWeight:700}}>{MONEDAS.find(m=>m.id===transCC.moneda)?.simbolo}{fmt(m+comD)}</span>
                              <span style={{color:"#64748b"}}> (com. ${fmt(comD)})</span>
                            </div>}
                          </div>
                        );
                      })()}
                      {/* Mostrar saldos de ambas CCs */}
                      {transCC.destino&&(()=>{
                        const clDest=clientes.find(x=>x.id===Number(transCC.destino));
                        const salOrigen=saldoCC(c)[transCC.moneda]||0;
                        const salDestino=clDest?saldoCC(clDest)[transCC.moneda]||0:0;
                        const mon=MONEDAS.find(m=>m.id===transCC.moneda);
                        return (
                          <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                            <div style={{flex:1,padding:"4px 8px",borderRadius:5,background:"rgba(255,255,255,0.03)",fontSize:10}}>
                              <span style={{color:"#9ca3af"}}>{c.nombre}: </span>
                              <span style={{color:salOrigen>0?"#4ade80":"#f87171",fontWeight:600}}>{mon?.simbolo}{fmt(salOrigen)}</span>
                            </div>
                            <div style={{flex:1,padding:"4px 8px",borderRadius:5,background:"rgba(255,255,255,0.03)",fontSize:10}}>
                              <span style={{color:"#9ca3af"}}>{clDest?.nombre}: </span>
                              <span style={{color:salDestino>0?"#4ade80":"#f87171",fontWeight:600}}>{mon?.simbolo}{fmt(salDestino)}</span>
                            </div>
                          </div>
                        );
                      })()}
                      <button onClick={async()=>{
                        const monto=parse(transCC.monto); if(!monto){notify("Ingresa un monto",false);return;}
                        if(!transCC.destino){notify("Elegi una CC destino",false);return;}
                        const cDestId=Number(transCC.destino);
                        const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
                        // Verificar duplicados
                        const ahoraMs2=Date.now();
                        const monto2=parse(transCC.monto);
                        const dupCC=(c.movimientos||[]).filter(mv=>{
                          if(mv.tipo!=="ingreso_transf"||mv.moneda!==transCC.moneda) return false;
                          const mvMs=new Date(hoy+"T"+(mv.hora||"00:00").replace("p. m.","PM").replace("a. m.","AM")).getTime();
                          return !isNaN(mvMs)&&Math.abs(ahoraMs2-mvMs)<2*60*60*1000&&Math.abs(mv.monto-monto2)<1;
                        });
                        if(dupCC.length>0){
                          const okDup=window.confirm("⚠ POSIBLE DUPLICADO\n\nYa existe una transferencia de $"+fmt(monto2)+" en esta CC en las últimas 2 horas.\n\n¿Confirmar igualmente?");
                          if(!okDup) return;
                        }
                        const pctO=parse(transCC.pctOrigen)||0;
                        const pctD=parse(transCC.pctDestino)||0;
                        const comO=monto*pctO/100;
                        const comD=monto*pctD/100;
                        const montoOrigen=monto-comO; // origen: sale menos (le cobrás al que envía)
                        const montoDestino=monto+comD; // destino: debe más (recibió el monto + tu comisión)
                        const clDest=clientes.find(x=>x.id===cDestId);
                        const nota="Transf. → "+(clDest?.nombre||"")+(pctO?" (com "+pctO+"%)":"");
                        const notaDest="Transf. ← "+c.nombre+(pctD?" (com "+pctD+"%)":"");
                        // CC origen: ingreso_transf por el neto que recibe
                        const mv1={id:Date.now(),hora,fecha:hoy,tipo:"ingreso_transf",moneda:transCC.moneda,monto:montoOrigen,nota};
                        await SB.from("movimientos_cc").insert({cliente_id:c.id,hora,fecha:hoy,tipo:"ingreso_transf",moneda:transCC.moneda,monto:montoOrigen,nota});
                        setClientes(p=>p.map(cl=>cl.id!==c.id?cl:{...cl,movimientos:[...cl.movimientos,mv1]}));
                        // CC destino: retiro_transf por el total + su comisión
                        const mv2={id:Date.now()+1,hora,fecha:hoy,tipo:"retiro_transf",moneda:transCC.moneda,monto:montoDestino,nota:notaDest};
                        await SB.from("movimientos_cc").insert({cliente_id:cDestId,hora,fecha:hoy,tipo:"retiro_transf",moneda:transCC.moneda,monto:montoDestino,nota:notaDest});
                        setClientes(p=>p.map(cl=>cl.id!==cDestId?cl:{...cl,movimientos:[...cl.movimientos,mv2]}));
                        // Registrar comisión en operaciones si hay comisión
                        const gananciaTransf = comO + comD;
                        if(gananciaTransf > 0){
                          const opTransf = {
                            tipo:"transferencia",hora,
                            tn:monto,
                            tpct:pctO||pctD,
                            tpctOrigen:pctO,
                            tcom:gananciaTransf,
                            monto:gananciaTransf,
                            tmoneda:transCC.moneda,
                            ccOrigenId:c.id,
                            cliente:c.nombre,
                            nota:`Entre CCs: ${c.nombre} → ${clientes.find(x=>x.id===cDestId)?.nombre||""} (com. ${fmt(gananciaTransf)} ${transCC.moneda})`,
                            destinos:[{clienteId:cDestId,monto,pct:pctD}]
                          };
                          const {data:opIns}=await SB.from("operaciones").insert({dia_id:hoy,fecha:hoy,hora,tipo:"transferencia",datos:opTransf}).select().single();
                          if(opIns) setOps(p=>[...p,{...opTransf,id:opIns.id,fecha:hoy}]);
                        }
                        setTransCC({activo:false,destino:"",buscar:"",monto:"",moneda:"ARS",pctOrigen:"",pctDestino:""});
                        notify("Transferencia entre CCs registrada ✓"+(gananciaTransf>0?" — comisión $"+fmt(gananciaTransf)+" registrada":""));
                      }} style={{marginTop:10,width:"100%",padding:9,borderRadius:7,background:"rgba(167,139,250,0.1)",border:"1px solid #a78bfa",color:"#a78bfa",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        ⇄ Confirmar transferencia
                      </button>
                    </div>
                  ):(
                    <>
                  <div style={S.grid("80px 1fr",8)}>
                    <div><Lbl>Moneda</Lbl><MonedasSel value={formCC.moneda} onChange={v=>setFormCC(f=>({...f,moneda:v}))}/></div>
                    <div><Lbl>Monto</Lbl><Inp type="number" placeholder="0" value={formCC.monto} onChange={e=>setFormCC(f=>({...f,monto:e.target.value}))}/></div>
                  </div>
                  <div style={{marginTop:8,marginBottom:10}}><Lbl>Nota</Lbl><Inp placeholder="Descripcion..." value={formCC.nota} onChange={e=>setFormCC(f=>({...f,nota:e.target.value}))}/></div>
                  <div onClick={()=>setFormCC(f=>({...f,impactaCaja:!f.impactaCaja}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,border:"1px solid "+(formCC.impactaCaja?"#f59e0b44":"rgba(255,255,255,0.06)"),background:formCC.impactaCaja?"rgba(245,158,11,0.08)":"transparent",cursor:"pointer",marginBottom:10,userSelect:"none"}}>
                    <div style={{width:16,height:16,borderRadius:4,border:"2px solid "+(formCC.impactaCaja?"#f59e0b":"#475569"),background:formCC.impactaCaja?"#f59e0b":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {formCC.impactaCaja&&<span style={{color:"#000",fontSize:11,fontWeight:900}}>✓</span>}
                    </div>
                    <div>
                      <div style={{fontSize:11,fontWeight:600,color:formCC.impactaCaja?"#f59e0b":"#475569"}}>Impacta caja fisica</div>
                      <div style={{fontSize:10,color:"#334155"}}>{formCC.impactaCaja?"Se suma/resta de tu caja":"Solo registro contable"}</div>
                    </div>
                  </div>
                  <button onClick={()=>regMovCC(c.id)} style={{width:"100%",padding:10,borderRadius:7,background:esIngCC?"#052e16":formCC.tipo==="retiro_transf"?"#0a1e2e":"#1c0a0a",border:"1px solid "+colorCC[formCC.tipo],color:colorCC[formCC.tipo],fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    {labelBtn[formCC.tipo]}
                  </button>
                    </>
                  )}
                </Card>
                <Card sx={{maxHeight:600,overflowY:"auto"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{fontSize:10,letterSpacing:3,color:"#9ca3af"}}>HISTORIAL ({c.movimientos.length})</div>
                    <button onClick={()=>setExportCC(e=>({...e,mostrando:!e.mostrando}))} style={{padding:"4px 10px",borderRadius:6,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.3)",color:"#a5b4fc",fontFamily:"inherit",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                      ⬇ Exportar PDF
                    </button>
                  </div>
                  {exportCC.mostrando&&(
                    <div style={{background:"rgba(99,102,241,0.05)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:8,padding:12,marginBottom:12}}>
                      <div style={{fontSize:9,letterSpacing:2,color:"#6366f1",marginBottom:8}}>RANGO DE FECHAS</div>
                      <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
                        <div style={{flex:1}}>
                          <Lbl>Desde</Lbl>
                          <Inp type="date" value={exportCC.desde} onChange={e=>setExportCC(x=>({...x,desde:e.target.value}))}/>
                        </div>
                        <div style={{flex:1}}>
                          <Lbl>Hasta</Lbl>
                          <Inp type="date" value={exportCC.hasta} onChange={e=>setExportCC(x=>({...x,hasta:e.target.value}))}/>
                        </div>
                        <button onClick={()=>{
                          // Filtrar movimientos por rango
                          const movsFiltrados=c.movimientos.filter(mv=>{
                            if(!mv.fecha) return true;
                            if(exportCC.desde&&mv.fecha<exportCC.desde) return false;
                            if(exportCC.hasta&&mv.fecha>exportCC.hasta) return false;
                            return true;
                          });
                          // Generar HTML para imprimir
                          const monedas=[...new Set(movsFiltrados.map(mv=>mv.moneda))];
                          let html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>CC ${c.nombre} ${c.apellido}</title><style>
                            body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:30px;}
                            h1{font-size:18px;margin-bottom:4px;}
                            h2{font-size:13px;color:#555;margin-top:20px;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px;}
                            .rango{font-size:11px;color:#888;margin-bottom:20px;}
                            table{width:100%;border-collapse:collapse;margin-bottom:16px;}
                            th{background:#f5f5f5;text-align:left;padding:6px 8px;font-size:10px;border-bottom:2px solid #ddd;}
                            td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;}
                            .debe{color:#16a34a;font-weight:700;}
                            .haber{color:#dc2626;font-weight:700;}
                            .saldo-pos{color:#16a34a;font-weight:700;}
                            .saldo-neg{color:#dc2626;font-weight:700;}
                            .saldo-final{margin-top:8px;text-align:right;font-size:13px;font-weight:700;}
                            .footer{margin-top:30px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:8px;}
                          </style></head><body>`;
                          html+=`<h1>Cuenta Corriente — ${c.nombre} ${c.apellido}</h1>`;
                          html+=`<div class="rango">Periodo: ${exportCC.desde||"inicio"} al ${exportCC.hasta||"hoy"} · STS</div>`;
                          monedas.forEach(monId=>{
                            const mon=MONEDAS.find(m=>m.id===monId);
                            const movsMon=movsFiltrados.filter(mv=>mv.moneda===monId).sort((a,b)=>((a.fecha||"")+(a.hora||"")).localeCompare((b.fecha||"")+(b.hora||"")));
                            // Calcular saldo histórico PREVIO al rango seleccionado
                            const movsHistoricos=exportCC.desde
                              ? c.movimientos.filter(mv=>mv.moneda===monId&&mv.fecha&&mv.fecha<exportCC.desde)
                              : [];
                            let saldo=movsHistoricos.reduce((s,mv)=>{
                              const ing=mv.tipo==="ingreso_transf"||mv.tipo==="ingreso_dep";
                              return s+(ing?-Number(mv.monto):Number(mv.monto));
                            },0);
                            const saldoInicial=saldo;
                            html+=`<h2>${monId}</h2><table><thead><tr><th>FECHA</th><th>CONCEPTO</th><th>NOTA</th><th style="text-align:right">DEBE</th><th style="text-align:right">HABER</th><th style="text-align:right">SALDO</th></tr></thead><tbody>`;
                            // Fila de saldo inicial si hay rango
                            if(exportCC.desde&&saldoInicial!==0){
                              const sc=saldoInicial>-1?"saldo-pos":"saldo-neg";
                              html+=`<tr style="background:#f9f9f9"><td colspan="5" style="color:#888;font-style:italic">Saldo anterior al ${exportCC.desde}</td><td style="text-align:right" class="${sc}">${saldoInicial>-1?"+":""}${mon?.simbolo||""}${saldoInicial.toLocaleString("es-AR")}</td></tr>`;
                            }
                            movsMon.forEach(mv=>{
                              const ing=mv.tipo==="ingreso_transf"||mv.tipo==="ingreso_dep";
                              saldo+=(ing?-mv.monto:mv.monto);
                              const debe=!ing?`<span class="debe">${mon?.simbolo||""}${mv.monto.toLocaleString("es-AR")}</span>`:"";
                              const haber=ing?`<span class="haber">${mon?.simbolo||""}${mv.monto.toLocaleString("es-AR")}</span>`:"";
                              const sClass=saldo>-1?"saldo-pos":"saldo-neg";
                              const labelMap={ingreso_transf:"Depósito",ingreso_dep:"Depósito",retiro_transf:"Retiro",retiro_efectivo:"Retiro efectivo"};
                              html+=`<tr><td>${mv.fecha||""}</td><td>${labelMap[mv.tipo]||mv.tipo}</td><td style="color:#888">${mv.nota||""}</td><td style="text-align:right">${debe}</td><td style="text-align:right">${haber}</td><td style="text-align:right" class="${sClass}">${saldo>-1?"+":""}${mon?.simbolo||""}${saldo.toLocaleString("es-AR")}</td></tr>`;
                            });
                            const sClass=saldo>-1?"saldo-pos":"saldo-neg";
                            html+=`</tbody></table><div class="saldo-final ${sClass}">Saldo final: ${saldo>-1?"Me debe":"Le debo"} ${mon?.simbolo||""}${Math.abs(saldo).toLocaleString("es-AR")} ${monId}</div>`;
                          });
                          html+=`<div class="footer">Generado por STS · ${hoy}</div></body></html>`;
                          const w=window.open("","_blank");
                          w.document.write(html);
                          w.document.close();
                          setTimeout(()=>w.print(),500);
                        }} style={{padding:"8px 14px",borderRadius:6,background:"rgba(99,102,241,0.2)",border:"1px solid #6366f1",color:"#a5b4fc",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                          Generar PDF
                        </button>
                      </div>
                      <div style={{fontSize:9,color:"#334155",marginTop:6}}>Deja vacío para exportar todo el historial</div>
                    </div>
                  )}
                  {editandoMov&&(
                    <div style={{background:"#0a1a2e",border:"1px solid #38bdf833",borderRadius:8,padding:10,marginBottom:12}}>
                      <div style={{fontSize:9,color:"#38bdf8",letterSpacing:2,marginBottom:8}}>EDITAR MOVIMIENTO</div>
                      <div style={{marginBottom:6}}>
                        <Sel value={editMovV.tipo} onChange={e=>setEditMovV(v=>({...v,tipo:e.target.value}))}>
                          {Object.entries({ingreso_transf:"Me transfirio",ingreso_dep:"Me deposito",retiro_transf:"Le transferi",retiro_efectivo:"Retire efectivo"}).map(([k,l])=><option key={k} value={k}>{l}</option>)}
                        </Sel>
                      </div>
                      <div style={S.grid("1fr 1fr",8)}>
                        <div><Lbl>Monto</Lbl><Inp type="number" value={editMovV.monto} onChange={e=>setEditMovV(v=>({...v,monto:e.target.value}))}/></div>
                        <div><Lbl>Moneda</Lbl><MonedasSel value={editMovV.moneda} onChange={val=>setEditMovV(v=>({...v,moneda:val}))}/></div>
                      </div>
                      <div style={{marginTop:6}}><Lbl>Nota</Lbl><Inp value={editMovV.nota} onChange={e=>setEditMovV(v=>({...v,nota:e.target.value}))}/></div>
                      <div style={{display:"flex",gap:6,marginTop:8}}>
                        <button onClick={async()=>{
                          const monto=parse(editMovV.monto); if(!monto) return;
                          await SB.from("movimientos_cc").update({tipo:editMovV.tipo,moneda:editMovV.moneda,monto,nota:editMovV.nota}).eq("id",editandoMov);
                          setClientes(p=>p.map(x=>x.id!==clienteActivo?x:{...x,movimientos:x.movimientos.map(m=>m.id!==editandoMov?m:{...m,tipo:editMovV.tipo,moneda:editMovV.moneda,monto,nota:editMovV.nota})}));
                          setEditandoMov(null); notify("Movimiento editado");
                        }} style={{flex:1,padding:"7px",borderRadius:6,background:"#0a1a2e",border:"1px solid #38bdf8",color:"#38bdf8",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer"}}>Guardar</button>
                        <button onClick={()=>setEditandoMov(null)} style={{padding:"7px 12px",borderRadius:6,background:"transparent",border:"1px solid #1f2937",color:"#94a3b8",fontFamily:"inherit",fontSize:11,cursor:"pointer"}}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  {(()=>{
                    // Tabs por moneda + filtro de fechas
                    const monedaConMovs=[...new Set(c.movimientos.map(mv=>mv.moneda))];
                    const monTabActiva=ccMonTab&&monedaConMovs.includes(ccMonTab)?ccMonTab:monedaConMovs[0];
                    const filtDesde=ccFiltro.desde||"";
                    const filtHasta=ccFiltro.hasta||"";
                    const monId=monTabActiva;
                    const mon=MONEDAS.find(m=>m.id===monId);
                    const movsMon=[...c.movimientos].filter(mv=>mv.moneda===monId).sort((a,b)=>((a.fecha||"")+(a.hora||"")).localeCompare((b.fecha||"")+(b.hora||"")));
                    // Saldo anterior al filtro
                    const movsAntes=filtDesde?movsMon.filter(mv=>(mv.fecha||"")<filtDesde):[];
                    let saldoAnterior=0;
                    movsAntes.forEach(mv=>{const ing=mv.tipo==="ingreso_transf"||mv.tipo==="ingreso_dep";saldoAnterior+=(ing?-mv.monto:mv.monto);});
                    // Movimientos filtrados
                    const movsFiltrados=movsMon.filter(mv=>{
                      if(filtDesde&&(mv.fecha||"")<filtDesde) return false;
                      if(filtHasta&&(mv.fecha||"")>filtHasta) return false;
                      return true;
                    });
                    let saldoCorriente=saldoAnterior;
                    const movsConSaldo=movsFiltrados.map(mv=>{
                      const ing=mv.tipo==="ingreso_transf"||mv.tipo==="ingreso_dep";
                      saldoCorriente+=(ing?-mv.monto:mv.monto);
                      return {...mv,saldoAcum:saldoCorriente};
                    });
                    const saldoFinal=saldoCorriente;
                    return (
                      <div>
                        {/* Tabs por moneda */}
                        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                          {monedaConMovs.map(mId=>{
                            const m=MONEDAS.find(x=>x.id===mId);
                            const activa=mId===monTabActiva;
                            const saldoM=saldoCC(c)[mId]||0;
                            return (
                              <button key={mId} onClick={()=>setCcMonTab(mId)}
                                style={{padding:"5px 14px",borderRadius:20,fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer",
                                  background:activa?"rgba(255,255,255,0.08)":"transparent",
                                  border:"1px solid "+(activa?(m?.color||"#6b7280"):"#1f2937"),
                                  color:activa?(m?.color||"#e2e8f0"):"#4b5563",
                                  transition:"all 0.15s"}}>
                                {mId}
                                {saldoM!==0&&<span style={{marginLeft:5,fontSize:9,color:saldoM>0?"#4ade80":"#f87171"}}>{saldoM>0?"+":""}{fmt(Math.round(saldoM))}</span>}
                              </button>
                            );
                          })}
                        </div>
                        {/* Filtros fecha */}
                        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
                          <span style={{fontSize:10,color:"#94a3b8"}}>Filtrar:</span>
                          <input type="date" value={ccFiltro.desde} onChange={e=>setCcFiltro(p=>({...p,desde:e.target.value}))}
                            style={{background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:5,padding:"4px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:10,outline:"none"}}/>
                          <span style={{fontSize:10,color:"#94a3b8"}}>→</span>
                          <input type="date" value={ccFiltro.hasta} onChange={e=>setCcFiltro(p=>({...p,hasta:e.target.value}))}
                            style={{background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:5,padding:"4px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:10,outline:"none"}}/>
                          {(ccFiltro.desde||ccFiltro.hasta)&&<button onClick={()=>setCcFiltro({desde:"",hasta:""})}
                            style={{padding:"3px 8px",borderRadius:5,background:"transparent",border:"1px solid #374151",color:"#9ca3af",fontFamily:"inherit",fontSize:9,cursor:"pointer"}}>✕ Limpiar</button>}
                          <span style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:saldoFinal>0?"#4ade80":saldoFinal<0?"#f87171":"#6b7280"}}>
                            {saldoFinal>0?"Me debe":"Le debo"} {mon?.simbolo}{fmt(Math.abs(saldoFinal))}
                          </span>
                        </div>
                        {/* Saldo anterior si hay filtro */}
                        {filtDesde&&<div style={{padding:"6px 10px",marginBottom:8,borderRadius:5,background:"rgba(255,255,255,0.03)",border:"1px solid #1f2937",fontSize:11,display:"flex",justifyContent:"space-between"}}>
                          <span style={{color:"#94a3b8"}}>Saldo anterior al {filtDesde}:</span>
                          <strong style={{color:saldoAnterior>0?"#4ade80":saldoAnterior<0?"#f87171":"#6b7280"}}>{saldoAnterior>0?"+":""}{mon?.simbolo}{fmt(saldoAnterior)}</strong>
                        </div>}
                        {/* Tabla movimientos */}
                        <div style={{overflowX:"auto"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                            <thead>
                              <tr style={{borderBottom:"1px solid #1f2937"}}>
                                <th style={{textAlign:"left",padding:"5px 8px",fontSize:9,color:"#94a3b8",fontWeight:600}}>FECHA</th>
                                <th style={{textAlign:"left",padding:"5px 8px",fontSize:9,color:"#94a3b8",fontWeight:600}}>CONCEPTO</th>
                                <th style={{textAlign:"right",padding:"5px 8px",fontSize:9,color:"#4ade80",fontWeight:600}}>DEBE</th>
                                <th style={{textAlign:"right",padding:"5px 8px",fontSize:9,color:"#f87171",fontWeight:600}}>HABER</th>
                                <th style={{textAlign:"right",padding:"5px 8px",fontSize:9,color:"#9ca3af",fontWeight:600}}>SALDO</th>
                                <th style={{padding:"5px 4px",fontSize:9,color:"#94a3b8",fontWeight:600}}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...movsConSaldo].reverse().map(mv=>{
                                const ing=mv.tipo==="ingreso_transf"||mv.tipo==="ingreso_dep";
                                const debe=!ing?mv.monto:null;
                                const haber=ing?mv.monto:null;
                                return (
                                  <tr key={mv.id} style={{borderBottom:"1px solid #0f0f0f",background:"rgba(255,255,255,0.01)"}}>
                                    <td style={{padding:"6px 8px",color:"#64748b",whiteSpace:"nowrap"}}>{mv.fecha||""}</td>
                                    <td style={{padding:"6px 8px",color:"#94a3b8"}}>
                                      {labelCC[mv.tipo]||mv.tipo}
                                      {mv.nota&&<span style={{color:"#334155",marginLeft:4}}>· {mv.nota}</span>}
                                    </td>
                                    <td style={{padding:"6px 8px",textAlign:"right",color:"#4ade80",fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>
                                      {debe?mon?.simbolo+fmt(debe):""}
                                    </td>
                                    <td style={{padding:"6px 8px",textAlign:"right",color:"#f87171",fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>
                                      {haber?mon?.simbolo+fmt(haber):""}
                                    </td>
                                    <td style={{padding:"6px 8px",textAlign:"right",color:mv.saldoAcum>0?"#4ade80":mv.saldoAcum<0?"#f87171":"#475569",fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>
                                      {mv.saldoAcum>0?"+":""}{mon?.simbolo}{fmt(mv.saldoAcum)}
                                    </td>
                                    <td style={{padding:"6px 4px",whiteSpace:"nowrap"}}>
                                      <button onClick={()=>{setEditandoMov(mv.id);setEditMovV({tipo:mv.tipo,monto:String(mv.monto),nota:mv.nota||"",moneda:mv.moneda});}} style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:"#0a1a2e",border:"1px solid #38bdf8",color:"#38bdf8",cursor:"pointer",fontFamily:"inherit",marginRight:3}}>editar</button>
                                      <button onClick={async()=>{
                                        const esTransCC2=mv.nota&&mv.nota.includes("Transf. entre CCs");
                                        if(esTransCC2){
                                          if(!window.confirm("Es una transferencia entre CCs. Se van a borrar los movimientos de AMBAS cuentas. Continuar?")) return;
                                          let borrados=0;
                                          for(const cl2 of clientes){
                                            if(cl2.id===clienteActivo) continue;
                                            for(const mv2 of cl2.movimientos){
                                              if(mv2.nota&&mv2.nota.includes("Transf. entre CCs")&&mv2.fecha===mv.fecha&&mv2.hora===mv.hora&&Number(mv2.monto)===Number(mv.monto)){
                                                await SB.from("movimientos_cc").delete().eq("id",mv2.id);
                                                setClientes(p=>p.map(x=>x.id!==cl2.id?x:{...x,movimientos:x.movimientos.filter(m=>m.id!==mv2.id)}));
                                                borrados++;
                                              }
                                            }
                                          }
                                          await SB.from("movimientos_cc").delete().eq("id",mv.id);
                                          setClientes(p=>p.map(x=>x.id!==clienteActivo?x:{...x,movimientos:x.movimientos.filter(m=>m.id!==mv.id)}));
                                          notify("Transf. entre CCs revertida en "+(borrados+1)+" cuentas");
                                        } else {
                                          if(!window.confirm("Eliminar este movimiento?")) return;
                                          await SB.from("movimientos_cc").delete().eq("id",mv.id);
                                          setClientes(p=>p.map(x=>x.id!==clienteActivo?x:{...x,movimientos:x.movimientos.filter(m=>m.id!==mv.id)}));
                                          notify("Eliminado");
                                        }
                                      }} style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:"#1c0a0a",border:"1px solid #f43f5e",color:"#f43f5e",cursor:"pointer",fontFamily:"inherit"}}>borrar</button>
                                    </td>
                                  </tr>
                                );
                              })}
                              {movsConSaldo.length===0&&<tr><td colSpan={6} style={{padding:"20px",textAlign:"center",color:"#64748b",fontSize:11}}>Sin movimientos en este período</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              </div>
            </div>
          );
        })()}

        {pant==="posicion"&&(()=>{
          const getS=(cId,mId)=>{ const k=cId+"_"+mId; return posOvr[k]!==undefined?posOvr[k]:(saldoCC(clientes.find(x=>x.id===cId))[mId]||0); };
          const tots=Object.fromEntries(MONEDAS.map(m=>[m.id,clientes.reduce((s,c)=>s+getS(c.id,m.id),0)]));
          const totsCC=Object.fromEntries(MONEDAS.map(m=>[m.id,tots[m.id]-((inversiones||[]).filter(x=>x.activa!==false&&x.estado!=="finalizada").reduce((s,x)=>{const cl=clientes.find(c=>Number(c.id)===Number(x.cliente_id));return s+(cl?saldoCC(cl)[m.id]||0:0);},0))]));
          const meses=Object.entries(fact.meses||{});
          const ganAcum=meses.reduce((s,[,v])=>s+parse(v),0),obj=parse(fact.objetivo);

          function generarImagen() {
            const difPend=diferidos.filter(d=>!d.cobrado);
            const totalDif=difPend.reduce((s,d)=>{
        const te=parse(d.tasaEndoso||"0");
        if(te>0) return s+d.nominal*(1-te/100);
        return s+(d.mFinal||d.nominal);
      },0);
            const patrimonioSaldos=Object.fromEntries(MONEDAS.map(m=>[m.id,(saldos[m.id]||0)+tots[m.id]+(m.id==="ARS"?totalDif:0)]));
            const COLS=MONEDAS.filter(m=>patrimonioSaldos[m.id]!==0||saldos[m.id]!==0||tots[m.id]!==0);
            const COLORES_SOCIO={"Manuel Sala":"#4ade80","Gonzalo Spadafora":"#38bdf8","Matias Speranza":"#f59e0b","STS":"#e879f9"};
            const SOCIOS=["Manuel Sala","Gonzalo Spadafora","Matias Speranza","STS"];

            // Calcular totales por socio
            const totSocio={};
            SOCIOS.forEach(s=>{totSocio[s]=Object.fromEntries(MONEDAS.map(m=>[m.id,0]));});
            clientes.forEach(cl=>{
              const socio=cl.socio||"Manuel Sala";
              if(!totSocio[socio]) return;
              const sal=saldoCC(cl);
              MONEDAS.forEach(m=>{ totSocio[socio][m.id]+=sal[m.id]||0; });
            });

            const W=800, PAD=36;
            const VERDE="#34d399", ROJO="#f87171", LILA="#a78bfa", GRIS="#475569", BLANCO="#e2e8f0", DIM="#64748b", BG="#07090f";

            // Altura dinamica
            const sociosActivos=SOCIOS.filter(s=>COLS.some(m=>totSocio[s][m.id]!==0));
            const H=380 + sociosActivos.length*70 + (difPend.length>0?80:0) + (ultimoCierre?.total_usd&&varUSD!==null?70:0);

            const canvas=document.createElement("canvas");
            canvas.width=W*2; canvas.height=H*2;
            const ctx=canvas.getContext("2d");
            ctx.scale(2,2);

            function txt(t,x,fy,size,color,align="left",bold=false){
              ctx.font=(bold?"600 ":"400 ")+size+"px 'Inter',system-ui,sans-serif";
              ctx.fillStyle=color; ctx.textAlign=align; ctx.fillText(t,x,fy);
            }
            function hline(fy,alpha=0.08){
              ctx.strokeStyle="rgba(255,255,255,"+alpha+")";
              ctx.lineWidth=1; ctx.beginPath();
              ctx.moveTo(PAD,fy); ctx.lineTo(W-PAD,fy); ctx.stroke();
            }
            function rect(x,fy,w,h,color,radius=8){
              ctx.fillStyle=color; ctx.beginPath();
              ctx.roundRect(x,fy,w,h,radius); ctx.fill();
            }

            // Fondo degradado
            const grad=ctx.createLinearGradient(0,0,0,H);
            grad.addColorStop(0,"#0a0c15"); grad.addColorStop(1,"#060810");
            ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);

            // Borde
            ctx.strokeStyle="rgba(99,102,241,0.3)"; ctx.lineWidth=1.5;
            ctx.beginPath(); ctx.roundRect(1,1,W-2,H-2,12); ctx.stroke();

            // Acento top
            const acent=ctx.createLinearGradient(0,0,W,0);
            acent.addColorStop(0,"#6366f1"); acent.addColorStop(1,"#34d399");
            ctx.fillStyle=acent; ctx.fillRect(PAD,0,W-PAD*2,3);

            let y=PAD+10;

            // Header
            rect(PAD,y-12,36,36,"rgba(99,102,241,0.85)",10);
            txt("S",PAD+11,y+12,17,BLANCO,"left",true);
            txt("STS FINANCIERA",PAD+48,y+5,15,BLANCO,"left",true);
            txt("RESUMEN DEL DIA",PAD+48,y+20,9,"#6366f1","left",true);
            txt(fechaLarga,W-PAD,y+12,10,DIM,"right");
            txt("Ops: "+opsHoy.length,W-PAD,y+24,9,"#6366f1","right",true);
            y+=46; hline(y,0.1); y+=20;

            // Caja fisica + Patrimonio en dos columnas
            const mid=W/2;
            txt("CAJA FISICA",PAD,y,9,VERDE,"left",true);
            txt("PATRIMONIO TOTAL",mid+10,y,9,LILA,"left",true);
            y+=16;
            COLS.forEach(m=>{
              const vF=saldos[m.id]||0, vP=patrimonioSaldos[m.id]||0;
              if(!vF&&!vP) return;
              // Col izq - caja
              rect(PAD,y-11,mid-PAD-10,20,"rgba(255,255,255,0.02)",4);
              txt(m.id,PAD+8,y,9,m.color,"left",true);
              txt(m.simbolo+fmt(vF),mid-20,y,12,vF<0?ROJO:BLANCO,"right",true);
              // Col der - patrimonio
              rect(mid+10,y-11,mid-PAD-10,20,"rgba(99,102,241,0.05)",4);
              txt(m.id,mid+18,y,9,m.color,"left",true);
              txt(m.simbolo+fmt(vP),W-PAD,y,12,vP<0?ROJO:LILA,"right",true);
              y+=22;
            });
            y+=10; hline(y,0.1); y+=20;

            // Por socio
            txt("POSICION POR SOCIO",PAD,y,9,"#38bdf8","left",true);
            y+=16;
            sociosActivos.forEach(socio=>{
              const col=COLORES_SOCIO[socio]||GRIS;
              const totS=totSocio[socio];
              const cantCli=clientes.filter(cl=>(cl.socio||"Manuel Sala")===socio&&COLS.some(m=>saldoCC(cl)[m.id]!==0)).length;
              rect(PAD,y-2,W-PAD*2,54,"rgba(255,255,255,0.02)",8);
              ctx.strokeStyle=col+"33"; ctx.lineWidth=1;
              ctx.beginPath(); ctx.roundRect(PAD,y-2,W-PAD*2,54,8); ctx.stroke();
              // Punto color
              ctx.fillStyle=col; ctx.beginPath();
              ctx.arc(PAD+16,y+22,5,0,Math.PI*2); ctx.fill();
              txt(socio,PAD+28,y+16,12,BLANCO,"left",true);
              txt(cantCli+" cliente"+(cantCli!==1?"s":""),PAD+28,y+30,9,DIM,"left");
              // Saldos
              let sx=W-PAD;
              [...COLS].reverse().forEach(m=>{
                const v=totS[m.id]; if(!v) return;
                const label=(v>0?"+ ":"- ")+m.simbolo+fmt(Math.abs(v))+" "+m.id;
                txt(label,sx,y+22,10,v>0?VERDE:ROJO,"right",true);
                sx-=ctx.measureText(label).width+20;
              });
              y+=64;
            });
            y+=4; hline(y,0.1); y+=20;

            // Cheques
            if(difPend.length>0){
              const venc=difPend.filter(d=>diasEntre(hoy,d.fechaAcr)===0).length;
              const prox=difPend.filter(d=>{const dr=diasEntre(hoy,d.fechaAcr);return dr>0&&dr<=3;}).length;
              txt("CHEQUES A COBRAR",PAD,y,9,"#c084fc","left",true);
              txt(difPend.length+" cheques",mid,y,9,DIM,"left");
              txt("$"+fmt(totalDif)+" ARS",W-PAD,y,11,"#c084fc","right",true);
              y+=18;
              if(venc>0){
                rect(PAD,y-10,120,16,"rgba(244,63,94,0.15)",4);
                txt(venc+" VENCIDO"+(venc>1?"S":""),PAD+6,y,9,ROJO,"left",true);
              }
              if(prox>0){
                rect(venc>0?PAD+130:PAD,y-10,150,16,"rgba(245,158,11,0.15)",4);
                txt(prox+" POR VENCER (<=3d)",venc>0?PAD+136:PAD+6,y,9,"#f59e0b","left",true);
              }
              y+=20;
            }

            // Evolucion vs dia anterior
            if(ultimoCierre?.total_usd&&varUSD!==null){
              hline(y,0.1); y+=16;
              const varColor=varUSD>-1?VERDE:ROJO;
              rect(PAD,y-2,W-PAD*2,42,"rgba(255,255,255,0.02)",6);
              txt("PATRIMONIO HOY",PAD+12,y+12,9,DIM,"left",true);
              txt(fmtUSD(ultimoCierre.total_usd),W/2,y+12,13,"#4ade80","center",true);
              txt((varUSD>-1?"+":"")+fmtUSD(varUSD)+" vs ayer",W-PAD-12,y+12,10,varColor,"right",true);
              txt(penultimoCierre?.total_usd?"Ayer: "+fmtUSD(penultimoCierre.total_usd):"",W-PAD-12,y+26,8,GRIS,"right");
              y+=50;
            }

            // Footer
            hline(y,0.05); y+=14;
            txt("Generado por STS  •  "+hoy,W/2,y,8,GRIS,"center");

            // Evolucion vs dia anterior
            if(ultimoCierre?.total_usd&&varUSD!==null){
              hline(y,0.1); y+=16;
              const varColor=varUSD>-1?VERDE:ROJO;
              rect(PAD,y-2,W-PAD*2,42,"rgba(255,255,255,0.02)",6);
              txt("PATRIMONIO HOY",PAD+12,y+12,9,DIM,"left",true);
              txt(fmtUSD(ultimoCierre.total_usd),W/2,y+12,13,"#4ade80","center",true);
              txt((varUSD>-1?"+":"")+fmtUSD(varUSD)+" vs ayer",W-PAD-12,y+12,10,varColor,"right",true);
              txt(penultimoCierre?.total_usd?"Ayer: "+fmtUSD(penultimoCierre.total_usd):"",W-PAD-12,y+26,8,GRIS,"right");
              y+=50;
            }

            // Footer
            hline(y,0.05); y+=14;
            txt("Generado por STS  •  "+hoy,W/2,y,8,GRIS,"center");

            const link=document.createElement("a");
            link.download="STS-resumen-"+hoy+".png";
            link.href=canvas.toDataURL("image/png");
            link.click();
            notify("Imagen descargada ✓");
          }

          return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:14}}>
                <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{fontSize:10,letterSpacing:3,color:"#e879f9"}}>POSICION CONSOLIDADA</div>
                  <button onClick={generarImagen} style={{padding:"5px 12px",borderRadius:7,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.3)",color:"#a5b4fc",fontFamily:"inherit",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    ⬇ Descargar resumen
                  </button>
                  <button onClick={()=>setMostrarOcultos(p=>!p)}
                    style={{padding:"5px 12px",borderRadius:7,background:mostrarOcultos?"rgba(248,113,113,0.1)":"rgba(255,255,255,0.04)",border:"1px solid "+(mostrarOcultos?"#f8717133":"#1f2937"),color:mostrarOcultos?"#f87171":"#4b5563",fontFamily:"inherit",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    {mostrarOcultos?"👁 Mostrando todos":"👁 Mostrar ocultos"}
                  </button>
                </div>
                <Card sx={{border:"1px solid #e879f933",minWidth:190}}>
                  <div style={{fontSize:10,letterSpacing:3,color:"#e879f9",marginBottom:10}}>FACTURACION</div>
                  {meses.map(([mes,val])=>(
                    <div key={mes} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid #1a1a1a"}}>
                      <span style={{fontSize:11,color:"#9ca3af"}}>{mes}</span>
                      {editFact===mes?(<input autoFocus type="number" value={editFactV} onChange={e=>setEditFactV(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter"){const nf={...fact,meses:{...fact.meses,[mes]:editFactV}};setFact(nf);guardarDia(null,nf,null);setEditFact(null);}if(e.key==="Escape")setEditFact(null);}}
                        onBlur={()=>{const nf={...fact,meses:{...fact.meses,[mes]:editFactV}};setFact(nf);guardarDia(null,nf,null);setEditFact(null);}}
                        style={{width:75,background:"transparent",border:"none",outline:"none",color:"#fff",fontFamily:"inherit",fontSize:12,fontWeight:700,textAlign:"right"}}/>
                      ):<span onClick={()=>{setEditFact(mes);setEditFactV(val);}} style={{fontSize:12,color:"#fff",fontWeight:700,cursor:"pointer"}}>{fmt(parse(val))}</span>}
                    </div>
                  ))}
                  <div style={{display:"flex",gap:3,marginTop:7}}>
                    <input placeholder="+ Mes" value={nuevoMes} onChange={e=>setNuevoMes(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter"&&nuevoMes.trim()){const nf={...fact,meses:{...fact.meses,[nuevoMes.trim()]:"0"}};setFact(nf);guardarDia(null,nf,null);setNuevoMes("");}}}
                      style={{flex:1,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:4,padding:"3px 6px",color:"#9ca3af",fontFamily:"inherit",fontSize:11,outline:"none"}}/>
                    <button onClick={()=>{if(!nuevoMes.trim())return;const nf={...fact,meses:{...fact.meses,[nuevoMes.trim()]:"0"}};setFact(nf);guardarDia(null,nf,null);setNuevoMes("");}} style={{padding:"3px 7px",borderRadius:4,background:"#0a0a0a",border:"1px solid #1f2937",color:"#9ca3af",cursor:"pointer",fontFamily:"inherit"}}>+</button>
                  </div>
                  <div style={{borderTop:"1px solid #1f2937",marginTop:7,paddingTop:7}}>
                    {[["Ganancia acum.",fmt(ganAcum),ganAcum>-1?"#4ade80":"#f87171"],["Objetivo",obj?fmt(obj):"clic","#9ca3af","__obj__"],["Resta",fmt(obj-ganAcum),obj-ganAcum<=0?"#4ade80":"#f87171"]].map(([k,v,c,ek])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}>
                        <span style={{fontSize:11,color:"#9ca3af"}}>{k}</span>
                        {editFact==="__obj__"&&ek?(<input autoFocus type="number" value={editFactV} onChange={e=>setEditFactV(e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter"){const nf={...fact,objetivo:editFactV};setFact(nf);guardarDia(null,nf,null);setEditFact(null);}if(e.key==="Escape")setEditFact(null);}}
                          onBlur={()=>{const nf={...fact,objetivo:editFactV};setFact(nf);guardarDia(null,nf,null);setEditFact(null);}}
                          style={{width:75,background:"transparent",border:"none",outline:"none",color:"#fff",fontFamily:"inherit",fontSize:12,fontWeight:700,textAlign:"right"}}/>
                        ):<span onClick={ek?()=>{setEditFact(ek);setEditFactV(fact.objetivo);}:undefined} style={{fontSize:12,color:c,fontWeight:700,cursor:ek?"pointer":"default"}}>{v}</span>}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"inherit"}}>
                  <thead><tr>
                    <th style={{textAlign:"left",padding:"7px 10px",borderBottom:"2px solid #1f2937",color:"#94a3b8",fontSize:10}}>CLIENTE</th>
                    {MONEDAS.map(m=><th key={m.id} style={{textAlign:"right",padding:"7px 10px",borderBottom:"2px solid #1f2937",color:m.color,fontSize:10}}>{m.id}</th>)}
                  </tr></thead>
                  <tbody>
                    {clientes.filter(c=>{
                      const tieneInv=inversiones.some(x=>x.activa!==false&&x.estado!=="finalizada"&&Number(x.cliente_id)===Number(c.id));
                      if(tieneInv) return false;
                      if(c.oculto===true&&!mostrarOcultos) return false;
                      return true;
                    }).map((c,i)=>(
                      <tr key={c.id}
                        draggable
                        onDragStart={e=>{ e.dataTransfer.effectAllowed="move"; e.dataTransfer.setData("text/plain", String(c.id)); dragSrcId.current=c.id; }}
                        onDragOver={e=>{ e.preventDefault(); e.dataTransfer.dropEffect="move"; setDragOverId(c.id); }}
                        onDragLeave={e=>{ if(!e.currentTarget.contains(e.relatedTarget)) setDragOverId(null); }}
                        onDragEnd={()=>{ setDragOverId(null); dragSrcId.current=null; }}
                        onDrop={e=>{
                          e.preventDefault();
                          const srcId=Number(e.dataTransfer.getData("text/plain"));
                          setDragOverId(null);
                          if(!srcId||srcId===c.id) return;
                          setClientes(prev=>{
                            const arr=[...prev];
                            const fromIdx=arr.findIndex(x=>x.id===srcId);
                            const toIdx=arr.findIndex(x=>x.id===c.id);
                            if(fromIdx<0||toIdx<0) return prev;
                            const [moved]=arr.splice(fromIdx,1);
                            arr.splice(toIdx,0,moved);
                            arr.forEach((cl,idx)=>{
                              SB.from("clientes").update({orden:idx}).eq("id",cl.id);
                            });
                            return arr;
                          });
                        }}
                        style={{background:dragOverId===c.id?"rgba(99,102,241,0.15)":i%2===0?"#0d0d0d":"#111",cursor:"grab",transition:"background 0.1s",outline:dragOverId===c.id?"1px solid rgba(99,102,241,0.5)":"none"}}>
                        <td style={{padding:"8px 10px",fontWeight:600}}>
                          <span style={{color:"#334155",marginRight:8,fontSize:12,userSelect:"none"}}>⠿</span>
                          {c.nombre} {c.apellido}
                        </td>
                        {MONEDAS.map(m=>{ const key=c.id+"_"+m.id,val=getS(c.id,m.id),isEd=editCell?.cId===c.id&&editCell?.mId===m.id;
                          return (<td key={m.id} style={{textAlign:"right",padding:"8px 10px",cursor:"pointer"}} onClick={()=>{if(!isEd){setEditCell({cId:c.id,mId:m.id});setEditCellV(String(val));}}}>
                            {isEd?(<input autoFocus type="number" value={editCellV} onChange={e=>setEditCellV(e.target.value)}
                              onKeyDown={e=>{if(e.key==="Enter"){const no={...posOvr,[key]:parse(editCellV)};setPosOvr(no);guardarDia(null,null,no);setEditCell(null);}if(e.key==="Escape")setEditCell(null);}}
                              onBlur={()=>{const no={...posOvr,[key]:parse(editCellV)};setPosOvr(no);guardarDia(null,null,no);setEditCell(null);}}
                              style={{width:85,background:"transparent",border:"none",borderBottom:"1px solid #a78bfa",outline:"none",color:"#fff",fontFamily:"inherit",fontSize:12,fontWeight:700,textAlign:"right"}}/>
                            ):(<span style={{color:val>0?"#4ade80":val<0?"#f87171":"#374151",fontWeight:val!==0?700:400}}>{val!==0?fmt(val):"—"}</span>)}
                          </td>);
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {(()=>{
                      const difPend=diferidos.filter(d=>!d.cobrado);
                      const totalDif=difPend.reduce((s,d)=>{
        const te=parse(d.tasaEndoso||"0");
        if(te>0) return s+d.nominal*(1-te/100);
        return s+(d.mFinal||d.nominal);
      },0);
                      // Patrimonio total = caja fisica + CCs + cheques a cobrar + inversiones
                      const invsActPat=(inversiones||[]).filter(x=>x.activa!==false&&x.estado!=="finalizada");
                      const totalInvPat=invsActPat.reduce((s,inv)=>{const d=Math.floor((new Date(hoy)-new Date(inv.fecha_inicio))/86400000);return s+inv.monto+inv.monto*(Math.pow(1+inv.tasa/100,d/365)-1);},0);
                      const invsActPos=(inversiones||[]).filter(x=>x.activa!==false&&x.estado!=="finalizada");const totalInvPos=invsActPos.reduce((s,inv)=>{const d=Math.floor((new Date(hoy)-new Date(inv.fecha_inicio))/86400000);return s+inv.monto+inv.monto*(Math.pow(1+inv.tasa/100,d/365)-1);},0);const patrimonioTot=Object.fromEntries(MONEDAS.map(m=>[m.id, (saldos[m.id]||0)+totsCC[m.id]+(m.id==="ARS"?totalDif:0)-(m.id==="USD"?totalInvPos:0)]));
                      return (<>
                        <tr style={{borderTop:"2px solid #1f2937",background:"#0a1a0a"}}>
                          <td style={{padding:"9px 10px",fontSize:9,color:"#4ade80",fontWeight:700,letterSpacing:1}}>CAJA OFICINA</td>
                          {MONEDAS.map(m=><td key={m.id} style={{textAlign:"right",padding:"9px 10px"}}>
                            <span style={{fontSize:13,fontWeight:700,color:saldos[m.id]>0?"#4ade80":saldos[m.id]<0?"#f87171":"#374151"}}>{saldos[m.id]!==0?fmt(saldos[m.id]):"—"}</span>
                          </td>)}
                        </tr>
                        <tr style={{borderTop:"1px solid #1f2937",background:"#0a0a0a"}}>
                          <td style={{padding:"9px 10px",fontSize:9,color:"#9ca3af"}}>TOTAL CC</td>
                          {MONEDAS.map(m=><td key={m.id} style={{textAlign:"right",padding:"9px 10px"}}>
                            <span style={{fontSize:13,fontWeight:700,color:totsCC[m.id]>0?"#4ade80":totsCC[m.id]<0?"#f87171":"#374151"}}>{totsCC[m.id]!==0?fmt(totsCC[m.id]):"—"}</span>
                          </td>)}
                        </tr>
                        {totalDif>0&&(
                          <tr style={{background:"#0a0a1a",borderTop:"1px solid #c084fc22"}}>
                            <td style={{padding:"9px 10px",fontSize:9,color:"#c084fc",cursor:"pointer"}} onClick={()=>setPant("cartera")}>
                              CHEQUES A COBRAR ({difPend.length}) ↗
                            </td>
                            {MONEDAS.map(m=><td key={m.id} style={{textAlign:"right",padding:"9px 10px"}}>
                              {m.id==="ARS"
                                ? <span style={{fontSize:13,fontWeight:700,color:"#c084fc"}}>{fmt(totalDif)}</span>
                                : <span style={{color:"#64748b"}}>—</span>}
                            </td>)}
                          </tr>
                        )}
                        {(()=>{
                          function calcIntPos(monto,tasa,dias){return monto*(Math.pow(1+tasa/100,dias/365)-1);}
                          const invsAct=inversiones.filter(x=>x.activa!==false&&x.estado!=="finalizada");
                          if(!invsAct.length) return null;
                          const totalInv=invsAct.reduce((s,inv)=>{
                            const d=Math.floor((new Date(hoy)-new Date(inv.fecha_inicio))/86400000);
                            return s+inv.monto+calcIntPos(inv.monto,inv.tasa,d);
                          },0);
                          const capInv=invsAct.reduce((s,inv)=>s+inv.monto,0);
                          return (
                            <tr style={{background:"#0a1a0f",borderTop:"1px solid #2dd4bf22"}}>
                              <td style={{padding:"9px 10px",fontSize:9,color:"#2dd4bf",cursor:"pointer"}} onClick={()=>setPant("inversiones")}>
                                <div>INVERSIONES ({invsAct.length}) ↗</div>
                                <div style={{fontSize:8,color:"#94a3b8",marginTop:2}}>Capital: {fmtUSD(capInv)}</div>
                              </td>
                              {MONEDAS.map(m=><td key={m.id} style={{textAlign:"right",padding:"9px 10px"}}>
                                {m.id==="USD"
                                  ?<span style={{fontSize:13,fontWeight:700,color:"#f87171"}}>-{fmt(totalInv)}</span>
                                  :<span style={{color:"#64748b"}}>—</span>}
                              </td>)}
                            </tr>
                          );
                        })()}
                        <tr style={{background:"#0d0d12",borderTop:"2px solid #6366f1"}}>
                          <td style={{padding:"10px 10px",fontSize:9,color:"#818cf8",fontWeight:700,letterSpacing:1}}>PATRIMONIO TOTAL</td>
                          {MONEDAS.map(m=><td key={m.id} style={{textAlign:"right",padding:"10px 10px"}}>
                            <span style={{fontSize:14,fontWeight:700,color:patrimonioTot[m.id]>0?"#818cf8":patrimonioTot[m.id]<0?"#f87171":"#374151"}}>{patrimonioTot[m.id]!==0?fmt(patrimonioTot[m.id]):"—"}</span>
                          </td>)}
                        </tr>
                      </>);
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })()}

        {pant==="historial"&&(()=>{
          // Filtrar ops por rango y filtros
          const opsFiltradas = ops.filter(op=>{
            if(histDesde && op.fecha < histDesde) return false;
            if(histHasta && op.fecha > histHasta) return false;
            if(histFiltroTipo!=="todos" && op.tipo!==histFiltroTipo) return false;
            if(histFiltroCliente && !(op.cliente||"").toLowerCase().includes(histFiltroCliente.toLowerCase())) return false;
            return true;
          }).sort((a,b)=>b.fecha?.localeCompare(a.fecha)||b.hora?.localeCompare(a.hora));

          // Totales del periodo
          const totPeriodo=Object.fromEntries(MONEDAS.map(m=>[m.id,0]));
          opsFiltradas.forEach(op=>{
            const t=op.tipo;
            if(t==="compra"){totPeriodo[op.moneda]+=op.monto;totPeriodo[op.moneda2]-=op.monto2;}
            else if(t==="venta"){totPeriodo[op.moneda]-=op.monto;totPeriodo[op.moneda2]+=op.monto2;}
            else if(t==="cheque_dia"||t==="cobro_dif") totPeriodo.ARS+=op.cn||op.monto;
            else if(t==="cheque_dif") totPeriodo.ARS-=op.montoFinal||op.monto;
            else if(t==="transferencia") totPeriodo.ARS+=op.tcom||op.monto;
            else if(t==="ajuste") totPeriodo[op.moneda]+=op.delta||0;
          });

          // Agrupar por fecha para vista de ops
          const porFecha={};
          opsFiltradas.forEach(op=>{ if(!porFecha[op.fecha]) porFecha[op.fecha]=[]; porFecha[op.fecha].push(op); });

          return (
            <div>
              <div style={{fontSize:10,letterSpacing:3,color:"#fb923c",marginBottom:4}}>HISTORIAL</div>
              <div style={{fontSize:12,color:"#9ca3af",marginBottom:18}}>Analiza, editá o agregá operaciones de cualquier periodo</div>

              {/* Filtros */}
              <Card sx={{marginBottom:16,border:"1px solid #fb923c22"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:10}}>
                  <div><Lbl>Desde</Lbl><Inp type="date" value={histDesde} onChange={e=>setHistDesde(e.target.value)}/></div>
                  <div><Lbl>Hasta</Lbl><Inp type="date" value={histHasta} onChange={e=>setHistHasta(e.target.value)}/></div>
                  <div><Lbl>Tipo</Lbl>
                    <Sel value={histFiltroTipo} onChange={e=>setHistFiltroTipo(e.target.value)}>
                      <option value="todos">Todos</option>
                      {Object.entries(TIPOS_OP).map(([id,t])=><option key={id} value={id}>{t.label}</option>)}
                    </Sel>
                  </div>
                  <div><Lbl>Cliente</Lbl><Inp placeholder="Buscar cliente..." value={histFiltroCliente} onChange={e=>setHistFiltroCliente(e.target.value)}/></div>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <button onClick={()=>{
                    const ahora=new Date(new Date().toLocaleString("en-US",{timeZone:"America/Argentina/Buenos_Aires"}));
                    const lunes=new Date(ahora); lunes.setDate(ahora.getDate()-ahora.getDay()+1);
                    setHistDesde(lunes.toISOString().split("T")[0]); setHistHasta(hoy);
                  }} style={{...S.btn(false,"#fb923c"),fontSize:10}}>Esta semana</button>
                  <button onClick={()=>{
                    const ahora=new Date(new Date().toLocaleString("en-US",{timeZone:"America/Argentina/Buenos_Aires"}));
                    setHistDesde(ahora.getFullYear()+"-"+String(ahora.getMonth()+1).padStart(2,"0")+"-01"); setHistHasta(hoy);
                  }} style={{...S.btn(false,"#fb923c"),fontSize:10}}>Este mes</button>
                  <button onClick={()=>{setHistDesde("");setHistHasta("");setHistFiltroTipo("todos");setHistFiltroCliente("");}} style={{...S.btn(false,"#64748b"),fontSize:10}}>Limpiar</button>
                  <span style={{fontSize:11,color:"#94a3b8",marginLeft:4}}>{opsFiltradas.length} operaciones</span>
                  <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                    <button onClick={()=>setHistModoVista("ops")} style={{...S.btn(histModoVista==="ops","#fb923c"),fontSize:10}}>Detalle</button>
                    <button onClick={()=>setHistModoVista("resumen")} style={{...S.btn(histModoVista==="resumen","#38bdf8"),fontSize:10}}>Resumen</button>
                  </div>
                </div>
              </Card>

              {/* Totales del periodo */}
              {opsFiltradas.length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
                  {MONEDAS.map(m=>{ const v=totPeriodo[m.id]; if(!v) return null;
                    return <div key={m.id} style={{background:"#0f1420",border:"1px solid "+m.color+"22",borderRadius:8,padding:"8px 14px"}}>
                      <div style={{fontSize:9,color:m.color,letterSpacing:2,marginBottom:2}}>{m.id}</div>
                      <div style={{fontSize:14,fontWeight:700,color:v>0?"#4ade80":"#f87171",fontFamily:"'JetBrains Mono',monospace"}}>{v>0?"+":""}{m.simbolo}{fmt(Math.abs(v))}</div>
                    </div>;
                  })}
                </div>
              )}

              {/* Vista detalle: por dia */}
              {histModoVista==="ops"&&(
                <div>
                  {/* Selector dia para editar */}
                  <Card sx={{marginBottom:14,border:"1px solid #1e2535"}}>
                    <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
                      <div style={{flex:"1 1 200px",maxWidth:300}}>
                        <Lbl>Dia para editar / agregar op</Lbl>
                        <Sel value={histFecha} onChange={e=>cargarHistorial(e.target.value)}>
                          <option value="">-- selecciona fecha --</option>
                          {histDias.map(d=><option key={d} value={d}>{fmtFecha(d)}{d===hoy?" (hoy)":""}{cierres.find(c=>c.fecha===d)?" ✓":""}</option>)}
                        </Sel>
                      </div>
                      {histFecha&&(
                        <button onClick={()=>setHistModo(m=>m==="agregar"?"ver":"agregar")} style={{padding:"8px 14px",borderRadius:7,background:histModo==="agregar"?"#1c0a0a":"#0a1a0a",border:"1px solid "+(histModo==="agregar"?"#f43f5e":"#fb923c"),color:histModo==="agregar"?"#f87171":"#fb923c",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                          {histModo==="agregar"?"Cancelar":"+ Agregar operacion"}
                        </button>
                      )}
                    </div>
                    {histFecha&&histModo==="agregar"&&(
                      <div style={{marginTop:14}}>
                        <FormOp fechaDefault={histFecha} titulo="NUEVA OPERACION EN FECHA PASADA" color="#fb923c" onGuardar={agregarOpHistorial} onCancelar={()=>setHistModo("ver")}/>
                      </div>
                    )}
                    {histEditando&&(
                      <div style={{marginTop:14}}>
                        <FormOp fechaDefault={histFecha} titulo="EDITAR OPERACION" color="#38bdf8" opInicial={histEditando} onGuardar={(d)=>editarOpHistorial(histEditando,d)} onCancelar={()=>setHistEditando(null)}/>
                      </div>
                    )}
                  </Card>

                  {opsFiltradas.length===0&&<div style={{color:"#334155",fontSize:12,textAlign:"center",padding:32}}>Sin operaciones en el periodo seleccionado</div>}
                  {Object.entries(porFecha).map(([fecha,fops])=>(
                    <div key={fecha} style={{marginBottom:20}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#fb923c"}}>{fmtFecha(fecha)}</div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <span style={{fontSize:10,color:"#9ca3af"}}>{fops.length} ops</span>
                          {cierres.find(c=>c.fecha===fecha)&&<span style={{fontSize:9,color:"#4ade80",background:"#4ade8015",padding:"1px 6px",borderRadius:4}}>CERRADO</span>}
                        </div>
                      </div>
                      <Card sx={{padding:0,overflow:"hidden"}}>
                        {fops.map((op,i)=>(
                          <div key={op.id} style={{borderBottom:i<fops.length-1?"1px solid #1e2535":"none"}}>
                            {renderOpRow(op,true,op.fecha===hoy&&!cajaCerrada)}
                          </div>
                        ))}
                      </Card>
                    </div>
                  ))}
                </div>
              )}

              {/* Vista resumen: por tipo */}
              {histModoVista==="resumen"&&(
                <div>
                  {Object.entries(TIPOS_OP).map(([tipo,t])=>{
                    const tOps=opsFiltradas.filter(o=>o.tipo===tipo);
                    if(!tOps.length) return null;
                    const totalARS=tOps.reduce((s,o)=>{
                      if(tipo==="cheque_dia"||tipo==="cobro_dif") return s+(o.cn||o.monto||0);
                      if(tipo==="transferencia") return s+(o.tcom||o.monto||0);
                      if(tipo==="compra"||tipo==="venta") return s+(o.monto||0);
                      return s+(o.monto||0);
                    },0);
                    return (
                      <Card key={tipo} sx={{marginBottom:10,border:"1px solid "+t.color+"22"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <div style={{width:8,height:8,borderRadius:"50%",background:t.color}}/>
                            <span style={{fontWeight:700,color:t.color}}>{t.label}</span>
                            <span style={{fontSize:11,color:"#94a3b8"}}>{tOps.length} ops</span>
                          </div>
                          <span style={{fontSize:13,fontWeight:700,color:"#e2e8f0",fontFamily:"'JetBrains Mono',monospace"}}>{fmt(totalARS)}</span>
                        </div>
                        <div style={{fontSize:11,color:"#94a3b8"}}>
                          {tOps.slice(0,3).map(op=>(
                            <div key={op.id} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderTop:"1px solid #1e2535"}}>
                              <span>{op.fecha} {op.cliente&&"— "+op.cliente}</span>
                              <span style={{color:"#94a3b8",fontFamily:"'JetBrains Mono',monospace"}}>{fmt(op.monto||0)}</span>
                            </div>
                          ))}
                          {tOps.length>3&&<div style={{color:"#334155",paddingTop:3,borderTop:"1px solid #1e2535"}}>...y {tOps.length-3} más</div>}
                        </div>
                      </Card>
                    );
                  })}
                  {opsFiltradas.length===0&&<div style={{color:"#334155",fontSize:12,textAlign:"center",padding:32}}>Sin operaciones en el periodo</div>}
                </div>
              )}
            </div>
          );
        })()}

        {pant==="evolucion"&&(()=>{
          const inversionBase=socios.reduce((s,x)=>s+parse(x.monto),0);
          const patrimonioActual=ultimoCierre?.total_usd||0;
          const gananciaVsBase=patrimonioActual-inversionBase;
          const pctVsBase=inversionBase>0?((gananciaVsBase/inversionBase)*100):0;

          // Agrupar cierres por mes
          const porMes={};
          [...cierres].forEach(c=>{
            const mes=c.fecha?.slice(0,7); // YYYY-MM
            if(!mes) return;
            if(!porMes[mes]) porMes[mes]={mes,cierres:[],liq:null};
            porMes[mes].cierres.push(c);
          });
          // Agregar liquidaciones al mes correspondiente (usar periodo si está definido)
          liquidaciones.forEach(l=>{
            const mes=l.periodo||l.fecha?.slice(0,7);
            if(mes){
              if(!porMes[mes]) porMes[mes]={mes,cierres:[],liq:null};
              porMes[mes].liq=l;
            }
          });
          const meses=Object.values(porMes).sort((a,b)=>b.mes.localeCompare(a.mes));

          return (
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#4ade80",marginBottom:4}}>EVOLUCION DE LA CAJA</div>
            <div style={{fontSize:12,color:"#94a3b8",marginBottom:20}}>Patrimonio total valuado en USD al cierre de cada dia</div>
            {cierres.length===0?(
              <div style={{background:"#0d0d0d",border:"1px dashed #1f2937",borderRadius:10,padding:32,textAlign:"center",color:"#64748b"}}>
                <div style={{fontSize:24,marginBottom:8}}>📊</div>
                <div>Todavia no hay cierres registrados</div>
                <div style={{fontSize:11,marginTop:4}}>Cierra el primer dia desde la pantalla Cierre</div>
              </div>
            ):(
              <div>
                {/* KPIs principales */}
                {(()=>{
                  const gPos=gananciaVsBase>-1;
                  const vPos=varUSD!==null&&varUSD>-1;
                  return (
                  <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
                    {(()=>{
                const totalFR=liquidaciones.reduce((s,l)=>s+(l.reserva||0),0);
                const totalRet=gastos.filter(g=>g.categoria==="Fondo de Reserva"&&g.moneda==="USD").reduce((s,g)=>s+Number(g.monto||0),0);
                const fondoDisp=Math.max(0,totalFR-totalRet);
                return totalFR>0?(
                  <Card sx={{flex:"1 1 160px",border:"1px solid #6366f133",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:4}}>FONDO DE RESERVA</div>
                    <div style={{fontSize:18,fontWeight:700,color:"#a5b4fc"}}>{fmtUSD(fondoDisp)}</div>
                    <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>disponible de {fmtUSD(totalFR)} acumulado</div>
                    {totalRet>0&&<div style={{fontSize:10,color:"#f87171",marginTop:2}}>-{fmtUSD(totalRet)} retirado</div>}
                  </Card>
                ):null;
              })()}
              {ultimoCierre&&<Card sx={{flex:"1 1 160px",border:"1px solid #4ade8033",textAlign:"center"}}>
                      <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:4}}>PATRIMONIO HOY</div>
                      <div style={{fontSize:22,fontWeight:700,color:"#4ade80"}}>{fmtUSD(patrimonioActual)}</div>
                      <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{fmtFecha(ultimoCierre.fecha)}</div>
                    </Card>}
                    <Card sx={{flex:"1 1 160px",border:"1px solid #a78bfa33",textAlign:"center"}}>
                      <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:4}}>INVERSION SOCIOS</div>
                      <div style={{fontSize:22,fontWeight:700,color:"#a78bfa"}}>{fmtUSD(inversionBase)}</div>
                      <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>base actual</div>
                    </Card>
                    <Card sx={{flex:"1 1 160px",border:"1px solid "+(gPos?"#4ade8033":"#f4433633"),textAlign:"center"}}>
                      <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:4}}>GANANCIA VS BASE</div>
                      <div style={{fontSize:22,fontWeight:700,color:gPos?"#4ade80":"#f87171"}}>{gPos?"+":""}{fmtUSD(gananciaVsBase)}</div>
                      <div style={{fontSize:10,color:gPos?"#4ade80":"#f87171",marginTop:2}}>{pctVsBase>-1?"+":""}{pctVsBase.toFixed(1)}%</div>
                    </Card>
                    {varUSD!==null&&<Card sx={{flex:"1 1 160px",border:"1px solid "+(vPos?"#4ade8033":"#f4433633"),textAlign:"center"}}>
                      <div style={{fontSize:9,color:"#94a3b8",letterSpacing:2,marginBottom:4}}>VS DIA ANTERIOR</div>
                      <div style={{fontSize:22,fontWeight:700,color:vPos?"#4ade80":"#f87171"}}>{vPos?"+":""}{fmtUSD(varUSD)}</div>
                      <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{vPos?"Subio":"Bajo"}</div>
                    </Card>}
                  </div>
                  );
                })()}

                {/* Grafico */}
                {grafData.length>1&&<Card sx={{marginBottom:18,border:"1px solid #4ade8022"}}>
                  <div style={{fontSize:9,letterSpacing:2,color:"#94a3b8",marginBottom:10}}>GRAFICO USD</div>
                  <LineChart data={grafData} color="#4ade80" height={120}/>
                  {/* Linea de inversion base */}
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#94a3b8",marginTop:4}}>
                    <span>{fmtFecha(grafData[0].x)}</span>
                    <span style={{color:"#a78bfa"}}>— Base: {fmtUSD(inversionBase)}</span>
                    <span>{fmtFecha(grafData[grafData.length-1].x)}</span>
                  </div>
                </Card>}

                {/* Resumen mensual */}
                <Card sx={{marginBottom:18,border:"1px solid #6366f133"}}>
                  <div style={{fontSize:9,letterSpacing:2,color:"#6366f1",marginBottom:12}}>RESUMEN MENSUAL</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"inherit"}}>
                      <thead><tr>
                        <th style={{textAlign:"left",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#94a3b8",fontSize:9}}>MES</th>
                        <th style={{textAlign:"right",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#94a3b8",fontSize:9}}>APERTURA</th>
                        <th style={{textAlign:"right",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#94a3b8",fontSize:9}}>CIERRE</th>
                        <th style={{textAlign:"right",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#4ade80",fontSize:9}}>GANANCIA</th>
                        <th style={{textAlign:"right",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#f59e0b",fontSize:9}}>SUELDO</th>
                        <th style={{textAlign:"right",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#c084fc",fontSize:9}}>RESERVA</th>
                        <th style={{textAlign:"right",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#38bdf8",fontSize:9}}>NETO SOCIOS</th>
                      </tr></thead>
                      <tbody>
                        {meses.map(({mes,cierres:mc,liq})=>{
                          const sorted=[...mc].sort((a,b)=>a.fecha.localeCompare(b.fecha));
                          const apertura=sorted[0]?.total_usd||0;
                          const cierre=sorted[sorted.length-1]?.total_usd||0;
                          const ganancia=cierre-apertura;
                          const sueldo=liq?.sueldo_empleado||0;
                          const reserva=liq?.reserva||0;
                          const neto=liq?.ganancia_neta||ganancia;
                          const [y,m]=mes.split("-");
                          const nombreMes=new Date(Number(y),Number(m)-1,1).toLocaleDateString("es-AR",{month:"long",year:"numeric"});
                          return (
                            <tr key={mes} style={{borderBottom:"1px solid #1a1a1a"}}>
                              <td style={{padding:"8px 8px",color:"#9ca3af",fontWeight:600,whiteSpace:"nowrap"}}>
                                {nombreMes}
                                {liq&&<span style={{marginLeft:6,fontSize:9,padding:"1px 5px",borderRadius:3,background:"rgba(99,102,241,0.15)",color:"#a5b4fc"}}>liquidado</span>}
                              </td>
                              <td style={{textAlign:"right",padding:"8px 8px",color:"#9ca3af",fontSize:11}}>{fmtUSD(apertura)}</td>
                              <td style={{textAlign:"right",padding:"8px 8px",color:"#e2e8f0",fontWeight:600}}>{fmtUSD(cierre)}</td>
                              <td style={{textAlign:"right",padding:"8px 8px",fontWeight:700,color:ganancia>-1?"#4ade80":"#f87171"}}>{ganancia>-1?"+":""}{fmtUSD(ganancia)}</td>
                              <td style={{textAlign:"right",padding:"8px 8px",color:sueldo>0?"#f59e0b":"#374151",fontSize:11}}>{sueldo>0?"-"+fmtUSD(sueldo):"—"}</td>
                              <td style={{textAlign:"right",padding:"8px 8px",color:reserva>0?"#c084fc":"#374151",fontSize:11}}>{reserva>0?"-"+fmtUSD(reserva):"—"}</td>
                              <td style={{textAlign:"right",padding:"8px 8px",fontWeight:700,color:neto>-1?"#38bdf8":"#f87171"}}>{neto>-1?"+":""}{fmtUSD(neto)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Historial detallado */}
                <Card>
                  <div style={{fontSize:9,letterSpacing:2,color:"#94a3b8",marginBottom:12}}>HISTORIAL DE CIERRES</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"inherit"}}>
                      <thead><tr>
                        <th style={{textAlign:"left",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#94a3b8",fontSize:9}}>FECHA</th>
                        <th style={{textAlign:"right",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#4ade80",fontSize:9}}>TOTAL USD</th>
                        <th style={{textAlign:"right",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#94a3b8",fontSize:9}}>VAR DIA</th>
                        <th style={{textAlign:"right",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#f59e0b",fontSize:9}}>TOMA GANANCIA</th>
                        <th style={{textAlign:"right",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#38bdf8",fontSize:9}}>FACTURACION NETA</th>
                      </tr></thead>
                      <tbody>
                        {[...cierres].reverse().map((c,i,arr)=>{
                          const prev=arr[i+1];
                          const varDia=prev&&c.total_usd&&prev.total_usd?c.total_usd-prev.total_usd:null;
                          const liqDelDia=liquidaciones.find(l=>l.fecha===c.fecha);
                          const tomaGanancia=liqDelDia?(liqDelDia.sueldo_empleado||0)+(liqDelDia.ganancia_neta||0):null;
                          const factNeta=tomaGanancia!==null&&c.total_usd?c.total_usd-tomaGanancia:null;
                          const vPos=varDia!==null&&varDia>-1;
                          return (
                            <tr key={c.fecha} style={{borderBottom:"1px solid #1a1a1a",background:liqDelDia?"rgba(99,102,241,0.05)":"transparent"}}>
                              <td style={{padding:"7px 8px",color:"#9ca3af"}}>
                                {fmtFecha(c.fecha)}
                                {liqDelDia&&<span style={{marginLeft:6,fontSize:9,padding:"1px 5px",borderRadius:3,background:"rgba(99,102,241,0.15)",color:"#a5b4fc"}}>liq</span>}
                              </td>
                              <td style={{textAlign:"right",padding:"7px 8px",fontWeight:700,color:"#4ade80"}}>{c.total_usd?fmtUSD(c.total_usd):"—"}</td>
                              <td style={{textAlign:"right",padding:"7px 8px",fontWeight:700,color:varDia===null?"#374151":vPos?"#4ade80":"#f87171",fontSize:11}}>
                                {varDia===null?"—":(vPos?"+":"")+fmtUSD(varDia)}
                              </td>
                              <td style={{textAlign:"right",padding:"7px 8px",color:tomaGanancia?"#f59e0b":"#374151",fontSize:11}}>
                                {tomaGanancia?"-"+fmtUSD(tomaGanancia):"—"}
                              </td>
                              <td style={{textAlign:"right",padding:"7px 8px",fontWeight:600,color:factNeta?"#38bdf8":"#374151",fontSize:11}}>
                                {factNeta?fmtUSD(factNeta):"—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </div>
          );
        })()}

        {pant==="cierre"&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#94a3b8",marginBottom:18}}>CIERRE - {fechaLarga}</div>
            {(()=>{
              const difPend=diferidos.filter(d=>!d.cobrado);
              const totalDif=difPend.reduce((s,d)=>{
        const te=parse(d.tasaEndoso||"0");
        if(te>0) return s+d.nominal*(1-te/100);
        return s+(d.mFinal||d.nominal);
      },0);
              const tots=Object.fromEntries(MONEDAS.map(m=>[m.id,clientes.reduce((s,c)=>s+saldoCC(c)[m.id],0)]));
              const patrimonioSaldos=Object.fromEntries(MONEDAS.map(m=>[m.id,(saldos[m.id]||0)+tots[m.id]+(m.id==="ARS"?totalDif:0)]));
              return (
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:18}}>
                  {MONEDAS.map(m=>{ const vFis=saldos[m.id]||0,vTot=patrimonioSaldos[m.id]; if(!vFis&&!vTot) return null;
                    return <div key={m.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba("+hexToRgb(m.color)+",0.2)",borderRadius:10,padding:"10px 14px",minWidth:110}}>
                      <div style={{fontSize:9,color:m.color,letterSpacing:2,marginBottom:6,fontWeight:700}}>{m.id}</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginBottom:2}}>Fisica: <span style={{color:"#e2e8f0",fontWeight:600}}>{m.simbolo}{fmt(vFis)}</span></div>
                      <div style={{fontSize:12,fontWeight:700,color:"#818cf8"}}>Total: {m.simbolo}{fmt(vTot)}</div>
                    </div>;
                  })}
                </div>
              );
            })()}
            <div style={S.grid("1fr 1fr",14)}>
              <Card>
                <div style={{fontSize:10,letterSpacing:3,color:"#9ca3af",marginBottom:12}}>SALDOS</div>
                <div style={{...S.grid("1fr 1fr 1fr 1fr",7),fontSize:9,color:"#94a3b8",marginBottom:6}}>
                  {["MON.","INICIAL","FINAL","DIF."].map(h=><span key={h}>{h}</span>)}
                </div>
                {MONEDAS.map(m=>{ const ini=parse(cajaIni[m.id]),fin=saldos[m.id]||0,dif=fin-ini;
                  return (<div key={m.id} style={{...S.grid("1fr 1fr 1fr 1fr",7),padding:"7px 0",borderBottom:"1px solid #1a1a1a",alignItems:"center"}}>
                    <span style={{fontSize:11,color:m.color,fontWeight:700}}>{m.id}</span>
                    <span style={{fontSize:12}}>{m.simbolo}{fmt(ini)}</span>
                    <span style={{fontSize:12,fontWeight:700}}>{m.simbolo}{fmt(fin)}</span>
                    <span style={{fontSize:12,fontWeight:700,color:dif>0?"#4ade80":dif<0?"#f87171":"#374151"}}>{dif>0?"+":""}{m.simbolo}{fmt(dif)}</span>
                  </div>);
                })}
              </Card>
              <Card>
                <div style={{fontSize:10,letterSpacing:3,color:"#9ca3af",marginBottom:12}}>OPERACIONES HOY ({opsHoy.length})</div>
                {Object.entries(TIPOS_OP).map(([id,t])=>{ const n=opsHoy.filter(o=>o.tipo===id).length; if(!n) return null;
                  return <div key={id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #1a1a1a"}}>
                    <span style={{fontSize:12,color:t.color}}>{t.label}</span><span style={{fontSize:12,color:"#9ca3af"}}>{n}x</span>
                  </div>;})}
                {opsHoy.length===0&&<div style={{color:"#64748b",fontSize:12}}>Sin operaciones</div>}
              </Card>
            </div>
            <div style={{marginTop:20}}>
              {!cajaCerrada?(
                <button onClick={()=>setShowModalCierre(true)} style={{padding:"14px 32px",borderRadius:9,background:"#0a0a0a",border:"2px solid #94a3b8",color:"#94a3b8",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:2}}>
                  CERRAR CAJA Y REGISTRAR COTIZACIONES
                </button>
              ):(
                <div>
                  <div style={{background:"#0a1a0a",border:"1px solid #4ade8044",borderRadius:9,padding:16,display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
                    <span style={{fontSize:24}}>🔒</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,color:"#4ade80",fontWeight:700}}>Caja cerrada correctamente</div>
                      {ultimoCierre?.total_usd&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Total en USD: <strong style={{color:"#4ade80"}}>{fmtUSD(ultimoCierre.total_usd)}</strong></div>}
                      {ultimoCierre?.cotizaciones&&<div style={{fontSize:10,color:"#94a3b8",marginTop:3}}>
                        {Object.entries(ultimoCierre.cotizaciones).filter(([,v])=>parse(v)).map(([k,v])=>k+": $"+fmt(v)).join(" | ")}
                      </div>}
                    </div>
                  </div>
                  <button onClick={async()=>{
                    if(!window.confirm("Reabrir la caja? Vas a poder seguir cargando operaciones.")) return;
                    await SB.from("cierres").delete().eq("fecha",hoy);
                    setCajaCerrada(false);
                    setCierres(p=>p.filter(c=>c.fecha!==hoy));
                    notify("Caja reabierta");
                  }} style={{padding:"10px 24px",borderRadius:9,background:"transparent",border:"1px solid #f59e0b",color:"#f59e0b",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    REABRIR CAJA
                  </button>
                </div>
              )}
            </div>
          </div>
        )}


        {pant==="resumen_socios"&&(()=>{
          const COLORES_SOCIO={"Manuel Sala":"#4ade80","Gonzalo Spadafora":"#38bdf8","Matias Speranza":"#f59e0b","STS":"#e879f9"};
          const resumen={};
          SOCIOS_FIJOS.forEach(s=>{resumen[s]={clientes:[],totalPorMoneda:Object.fromEntries(MONEDAS.map(m=>[m.id,0])),totalDeuda:0};});
          clientes.forEach(c=>{
            const socio=c.socio||"Manuel Sala";
            if(!resumen[socio]) return;
            const sal=saldoCC(c);
            const tieneMovs=MONEDAS.some(m=>sal[m.id]!==0);
            if(tieneMovs) resumen[socio].clientes.push({...c,sal});
            MONEDAS.forEach(m=>{ resumen[socio].totalPorMoneda[m.id]+=sal[m.id]||0; });
          });
          return (
            <div>
              <div style={{fontSize:10,letterSpacing:3,color:"#34d399",marginBottom:4}}>RESUMEN POR SOCIO</div>
              <div style={{fontSize:12,color:"#94a3b8",marginBottom:18}}>Posicion de cada socio con sus clientes</div>
              {SOCIOS_FIJOS.map(socio=>{
                const r=resumen[socio]; const col=COLORES_SOCIO[socio]||"#6b7280";
                const clientesConSaldo=r.clientes.filter(c=>MONEDAS.some(m=>c.sal[m.id]!==0));
                return (
                  <Card key={socio} sx={{marginBottom:14,border:"1px solid "+col+"33"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:col}}>{socio}</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{clientesConSaldo.length} clientes con saldo</div>
                      </div>
                      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                        {MONEDAS.map(m=>{ const v=r.totalPorMoneda[m.id]; if(!v) return null;
                          return <div key={m.id} style={{background:"#0d0d0d",border:"1px solid "+(v>0?m.color+"44":"#f4433633"),borderRadius:6,padding:"5px 10px"}}>
                            <div style={{fontSize:8,color:m.color,marginBottom:1}}>{m.id}</div>
                            <div style={{fontSize:12,fontWeight:700,color:v>0?"#4ade80":"#f87171"}}>{v>0?"Me deben":"Debo"} {m.simbolo}{fmt(Math.abs(v))}</div>
                          </div>;})}
                      </div>
                    </div>
                    {clientesConSaldo.length===0&&<div style={{fontSize:12,color:"#64748b"}}>Sin clientes con saldo</div>}
                    {clientesConSaldo.map(cl=>(
                      <div key={cl.id} style={{borderTop:"1px solid #1a1a1a",paddingTop:8,marginTop:8,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                        <div style={{fontWeight:600,fontSize:12,cursor:"pointer",color:"#e5e7eb"}} onClick={()=>{setPant("clientes");setClienteActivo(cl.id);setFormCC({tipo:"ingreso_transf",moneda:"ARS",monto:"",nota:""});}}>{cl.nombre} {cl.apellido}</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {MONEDAS.map(m=>{ const v=cl.sal[m.id]; if(!v) return null;
                            return <span key={m.id} style={{fontSize:11,color:v>0?"#4ade80":"#f87171",fontWeight:700}}>{v>0?"+":""}{m.simbolo}{fmt(v)} {m.id}</span>;})}
                        </div>
                      </div>
                    ))}
                  </Card>
                );
              })}
            </div>
          );
        })()}

        {pant==="gastos"&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#f43f5e",marginBottom:4}}>GASTOS</div>
            <div style={{fontSize:12,color:"#94a3b8",marginBottom:18}}>Registra tus gastos fijos y variables</div>
            <div className="grid-mobile-1" style={S.grid("1fr 1fr",18)}>
              <Card sx={{border:"1px solid #f43f5e33"}}>
                <div style={{fontSize:10,letterSpacing:3,color:"#f43f5e",marginBottom:12}}>NUEVO GASTO</div>
                <div style={{marginBottom:8}}><Lbl>Categoria</Lbl>
                  <Sel value={formGasto.categoria} onChange={e=>setFormGasto(f=>({...f,categoria:e.target.value}))}>
                    {CATS_GASTO.map(c=><option key={c} value={c}>{c}</option>)}
                  </Sel>
                </div>
                <div style={S.grid("1fr 1fr",8)}>
                  <div><Lbl>Monto</Lbl><Inp type="number" placeholder="0" value={formGasto.monto} onChange={e=>setFormGasto(f=>({...f,monto:e.target.value}))}/></div>
                  <div><Lbl>Moneda</Lbl><MonedasSel value={formGasto.moneda} onChange={v=>setFormGasto(f=>({...f,moneda:v}))}/></div>
                </div>
                <div style={{marginTop:8}}><Lbl>Fecha</Lbl><Inp type="date" value={formGasto.fecha} onChange={e=>setFormGasto(f=>({...f,fecha:e.target.value}))}/></div>
                <div style={{marginTop:8}}><Lbl>Nota</Lbl><Inp placeholder="Descripcion..." value={formGasto.nota} onChange={e=>setFormGasto(f=>({...f,nota:e.target.value}))}/></div>
                {/* Origen del pago */}
                <div style={{marginTop:10,marginBottom:10}}>
                  <div style={{fontSize:9,letterSpacing:2,color:"#9ca3af",marginBottom:6}}>SALE DE</div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setFormGasto(f=>({...f,usaCC:false}))}
                      style={{...S.btn(!formGasto.usaCC,"#f43f5e"),flex:1}}>💵 Caja fisica</button>
                    <button onClick={()=>setFormGasto(f=>({...f,usaCC:true}))}
                      style={{...S.btn(formGasto.usaCC,"#a78bfa"),flex:1}}>👤 Cuenta corriente</button>
                  </div>
                </div>
                {formGasto.usaCC&&(
                  <div style={{background:"rgba(167,139,250,0.05)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:8,padding:10,marginBottom:10,position:"relative"}}>
                    <Lbl>Quién pagó</Lbl>
                    {(()=>{
                      const clSel=clientes.find(x=>x.id===Number(gastoCC.clienteId));
                      const filtrados=clientes.filter(x=>(x.nombre+" "+x.apellido).toLowerCase().includes(gastoCC.buscar.toLowerCase()));
                      return (
                        <div>
                          <div style={{display:"flex",gap:4,alignItems:"center"}}>
                            {clSel&&!gastoCC.buscar&&(
                              <div style={{flex:1,padding:"6px 8px",borderRadius:6,background:"rgba(167,139,250,0.1)",border:"1px solid #a78bfa44",fontSize:11,color:"#a78bfa",fontWeight:600}}>
                                {clSel.nombre} {clSel.apellido}
                              </div>
                            )}
                            <input value={gastoCC.buscar} onChange={e=>setGastoCC(g=>({...g,buscar:e.target.value}))}
                              placeholder={clSel&&!gastoCC.buscar?"Cambiar...":"Buscar cliente..."}
                              style={{flex:1,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"6px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:11,outline:"none"}}/>
                          </div>
                          {gastoCC.buscar&&filtrados.length>0&&(
                            <div style={{position:"absolute",left:10,right:10,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:200,maxHeight:140,overflowY:"auto",marginTop:2}}>
                              {filtrados.map(cl=>(
                                <div key={cl.id} onClick={()=>setGastoCC(g=>({...g,clienteId:String(cl.id),buscar:""}))}
                                  style={{padding:"7px 10px",cursor:"pointer",fontSize:11,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>
                                  {cl.nombre} {cl.apellido}
                                </div>
                              ))}
                            </div>
                          )}
                          {clSel&&(()=>{
                            const sal=saldoCC(clSel)[formGasto.moneda]||0;
                            const mon=MONEDAS.find(m=>m.id===formGasto.moneda);
                            return sal!==0&&(
                              <div style={{marginTop:6,fontSize:10,color:sal>0?"#4ade80":"#f87171"}}>
                                Saldo actual: {sal>0?"me debe":"le debo"} {mon?.simbolo}{fmt(Math.abs(sal))}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                )}
                <button onClick={async()=>{
                  const monto=parse(formGasto.monto); if(!monto){notify("Ingresa un monto",false);return;}
                  if(formGasto.usaCC&&!gastoCC.clienteId){notify("Elegi un cliente",false);return;}
                  const g={categoria:formGasto.categoria,monto,moneda:formGasto.moneda,nota:formGasto.nota,fecha:formGasto.fecha};
                  const {data:ins}=await SB.from("gastos").insert(g).select().single();
                  if(ins) setGastos(p=>[ins,...p]);
                  if(formGasto.usaCC){
                    // El cliente pagó el gasto por nosotros → ingreso_transf en su CC (HABER = le debemos)
                    const cId=Number(gastoCC.clienteId);
                    const cl=clientes.find(x=>x.id===cId);
                    const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
                    const nota="Gasto: "+formGasto.categoria+(formGasto.nota?" - "+formGasto.nota:"");
                    const mv={id:Date.now(),hora,fecha:formGasto.fecha,tipo:"ingreso_transf",moneda:formGasto.moneda,monto,nota};
                    await SB.from("movimientos_cc").insert({cliente_id:cId,hora,fecha:formGasto.fecha,tipo:"ingreso_transf",moneda:formGasto.moneda,monto,nota});
                    setClientes(p=>p.map(x=>x.id!==cId?x:{...x,movimientos:[...x.movimientos,mv]}));
                  } else if(formGasto.categoria==="Fondo de Reserva"){
                    // Fondo de reserva: NO sale de caja física, es solo contable
                    notify("Retiro del Fondo de Reserva registrado — no impacta caja");
                  } else {
                    // Sale de caja fisica
                    const ns=await leerSaldoFresco(); ns[formGasto.moneda]=(ns[formGasto.moneda]||0)-monto;
                    setSaldos(ns); await guardarDia(ns,null,null);
                  }
                  setFormGasto(f=>({...f,monto:"",nota:""}));
                  setGastoCC({activo:false,clienteId:"",buscar:""});
                  notify("Gasto registrado");
                }} style={{marginTop:12,width:"100%",padding:10,borderRadius:7,background:"#1c0a0a",border:"1px solid #f43f5e",color:"#f87171",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  REGISTRAR GASTO
                </button>
              </Card>
              <Card sx={{maxHeight:500,overflowY:"auto"}}>
                <div style={{fontSize:10,letterSpacing:3,color:"#9ca3af",marginBottom:12}}>HISTORIAL ({gastos.length})</div>
                {gastos.length===0&&<div style={{color:"#64748b",fontSize:12}}>Sin gastos registrados</div>}
                {gastos.map(g=>{
                  const mon=MONEDAS.find(m=>m.id===g.moneda);
                  const esFondo=g.categoria==="Fondo de Reserva";
                  return (
                    <div key={g.id} style={{borderBottom:"1px solid #1a1a1a",padding:"8px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:11,color:esFondo?"#a5b4fc":"#f87171",fontWeight:700}}>{g.categoria}</span>
                          {esFondo&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:"rgba(99,102,241,0.15)",color:"#6366f1"}}>no impacta caja</span>}
                        </div>
                        <div style={{fontSize:13,fontWeight:700,color:"#fff",marginTop:1}}>{mon?.simbolo}{fmt(g.monto)} {g.moneda}</div>
                        {g.nota&&<div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{g.nota}</div>}
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:10,color:"#94a3b8"}}>{fmtFecha(g.fecha)}</div>
                        <button onClick={async()=>{
                          if(!window.confirm("Eliminar este gasto?")) return;
                          await SB.from("gastos").delete().eq("id",g.id);
                          setGastos(p=>p.filter(x=>x.id!==g.id));
                          notify("Eliminado");
                        }} style={{marginTop:4,fontSize:10,padding:"2px 7px",borderRadius:4,background:"#1c0a0a",border:"1px solid #f43f5e",color:"#f43f5e",cursor:"pointer",fontFamily:"inherit"}}>borrar</button>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
            {gastos.length>0&&(()=>{
              const porCat={};
              gastos.forEach(g=>{
                if(!porCat[g.categoria]) porCat[g.categoria]={};
                porCat[g.categoria][g.moneda]=(porCat[g.categoria][g.moneda]||0)+g.monto;
              });
              return (
                <Card sx={{marginTop:16}}>
                  <div style={{fontSize:10,letterSpacing:3,color:"#9ca3af",marginBottom:12}}>RESUMEN POR CATEGORIA</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {Object.entries(porCat).map(([cat,mons])=>(
                      <div key={cat} style={{background:"#0d0d0d",border:"1px solid #1f2937",borderRadius:8,padding:"10px 14px",minWidth:140}}>
                        <div style={{fontSize:10,color:"#f87171",fontWeight:700,marginBottom:6}}>{cat}</div>
                        {Object.entries(mons).map(([mon,v])=>{
                          const m=MONEDAS.find(x=>x.id===mon);
                          return <div key={mon} style={{fontSize:12,color:"#fff"}}>{m?.simbolo}{fmt(v)} <span style={{color:m?.color,fontSize:10}}>{mon}</span></div>;
                        })}
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })()}
          </div>
        )}

        {pant==="referidores"&&(()=>{
          const todosMovs=clientes.flatMap(cl=>
            cl.movimientos.filter(mv=>mv.nota&&mv.nota.includes("Comisión ref."))
              .map(mv=>({...mv,clienteNombre:cl.nombre+" "+cl.apellido,clienteId:cl.id}))
          );
          const porCliente={};
          todosMovs.forEach(mv=>{
            if(!porCliente[mv.clienteId]) porCliente[mv.clienteId]={id:mv.clienteId,nombre:mv.clienteNombre,totalARS:0,ops:[]};
            porCliente[mv.clienteId].totalARS+=Number(mv.monto);
            porCliente[mv.clienteId].ops.push(mv);
          });
          const referidores=Object.values(porCliente).sort((a,b)=>b.totalARS-a.totalARS);
          return (
            <div>
              <div style={{fontSize:10,letterSpacing:3,color:"#fb923c",marginBottom:16}}>REFERIDORES — COMISIONES ACUMULADAS</div>
              {referidores.length===0&&(
                <Card sx={{textAlign:"center",padding:40}}>
                  <div style={{fontSize:24,marginBottom:8}}>⬡</div>
                  <div style={{color:"#9ca3af",marginBottom:6}}>Sin comisiones registradas todavía</div>
                  <div style={{color:"#94a3b8",fontSize:11}}>Al registrar una operación con referidor, la comisión aparece acá automáticamente</div>
                </Card>
              )}
              {referidores.map(ref=>(
                <Card key={ref.id} sx={{marginBottom:12,border:"1px solid rgba(251,146,60,0.2)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"#fb923c"}}>{ref.nombre}</div>
                      <div style={{fontSize:10,color:"#9ca3af",marginTop:2}}>{ref.ops.length} operaciones</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:16,fontWeight:700,color:"#4ade80"}}>${fmt(Math.round(ref.totalARS))} ARS</div>
                      <div style={{fontSize:10,color:"#9ca3af"}}>acumulado</div>
                    </div>
                  </div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                      <thead><tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                        {["Fecha","Hora","Detalle","Comisión ARS"].map(h=>(
                          <th key={h} style={{padding:"5px 8px",textAlign:h==="Comisión ARS"?"right":"left",color:"#94a3b8",fontSize:9,fontWeight:600}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {[...ref.ops].sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||"")).map((mv,i)=>(
                          <tr key={mv.id||i} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:i%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                            <td style={{padding:"6px 8px",color:"#9ca3af"}}>{mv.fecha}</td>
                            <td style={{padding:"6px 8px",color:"#9ca3af"}}>{mv.hora}</td>
                            <td style={{padding:"6px 8px",color:"#e2e8f0",fontSize:10}}>{mv.nota}</td>
                            <td style={{padding:"6px 8px",textAlign:"right",fontWeight:600,color:"#4ade80"}}>${fmt(Math.round(Number(mv.monto)))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr style={{borderTop:"2px solid rgba(255,255,255,0.1)"}}>
                        <td colSpan={3} style={{padding:"7px 8px",fontSize:10,color:"#9ca3af",fontWeight:600}}>TOTAL ACUMULADO</td>
                        <td style={{padding:"7px 8px",textAlign:"right",fontWeight:700,color:"#4ade80"}}>${fmt(Math.round(ref.totalARS))} ARS</td>
                      </tr></tfoot>
                    </table>
                  </div>
                  <div style={{marginTop:10,display:"flex",justifyContent:"flex-end"}}>
                    <button onClick={async()=>{
                      if(!window.confirm(`Liquidar $${fmt(Math.round(ref.totalARS))} ARS a ${ref.nombre}?`)) return;
                      const hora2=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
                      const nota2=`Liquidación comisiones referidor — $${fmt(Math.round(ref.totalARS))} ARS`;
                      await SB.from("movimientos_cc").insert({cliente_id:ref.id,hora:hora2,fecha:hoy,tipo:"retiro_efectivo",moneda:"ARS",monto:ref.totalARS,nota:nota2});
                      setClientes(p=>p.map(cl=>cl.id!==ref.id?cl:{...cl,movimientos:[...cl.movimientos,{id:Date.now(),hora:hora2,fecha:hoy,tipo:"retiro_efectivo",moneda:"ARS",monto:ref.totalARS,nota:nota2}]}));
                      notify("Liquidación registrada");
                    }}
                      style={{padding:"7px 16px",borderRadius:6,background:"rgba(74,222,128,0.08)",border:"1px solid #4ade80",color:"#4ade80",fontFamily:"inherit",fontSize:11,cursor:"pointer",fontWeight:600}}>
                      ✓ Liquidar ${fmt(Math.round(ref.totalARS))} ARS
                    </button>
                  </div>
                </Card>
              ))}
              {referidores.length>0&&(
                <Card sx={{background:"rgba(251,146,60,0.04)",border:"1px solid rgba(251,146,60,0.15)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:11,color:"#9ca3af",fontWeight:600}}>TOTAL A PAGAR A REFERIDORES</span>
                    <span style={{fontSize:16,fontWeight:700,color:"#fb923c"}}>${fmt(Math.round(referidores.reduce((s,r)=>s+r.totalARS,0)))} ARS</span>
                  </div>
                </Card>
              )}
            </div>
          );
        })()}

        {pant==="inversiones"&&(()=>{
          // Calcular interés compuesto diario
          function calcInteres(monto, tasaAnual, dias) {
            return monto * (Math.pow(1 + tasaAnual/100, dias/365) - 1);
          }
          function diasEntreFechas(f1, f2) {
            return Math.floor((new Date(f2) - new Date(f1)) / 86400000);
          }
          const hoyDate = hoy;
          const invsActivas = inversiones.filter(x=>x.activa!==false);

          // Generar PDF para una inversión
          async function generarPDFInversion(inv) {
            const dias = diasEntreFechas(inv.fecha_inicio, hoyDate);
            const interes = calcInteres(inv.monto, inv.tasa, dias);
            const total = inv.monto + interes;
            const bloqueado = dias < inv.bloqueo_dias;
            const diasRestantes = inv.bloqueo_dias - dias;
            const cl = clientes.find(c=>c.id===Number(inv.cliente_id));
            const nombre = cl ? cl.nombre+" "+cl.apellido : inv.cliente_nombre||"Cliente";

            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
              body{font-family:Arial,sans-serif;max-width:600px;margin:40px auto;color:#1a1a2e;background:#fff;}
              .header{text-align:center;border-bottom:3px solid #2dd4bf;padding-bottom:20px;margin-bottom:30px;}
              .logo{font-size:28px;font-weight:900;color:#2dd4bf;letter-spacing:3px;}
              .sub{font-size:11px;color:#6b7280;letter-spacing:2px;margin-top:4px;}
              .title{font-size:18px;font-weight:700;margin:20px 0 6px;}
              .fecha{font-size:11px;color:#6b7280;}
              .card{background:#f8fafc;border-radius:10px;padding:20px;margin:16px 0;border:1px solid #e2e8f0;}
              .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;}
              .row:last-child{border-bottom:none;}
              .label{color:#6b7280;}
              .value{font-weight:600;color:#1a1a2e;}
              .highlight{font-size:22px;font-weight:900;color:#2dd4bf;text-align:center;margin:20px 0;}
              .status{display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;}
              .bloqueado{background:#fef3c7;color:#92400e;}
              .disponible{background:#d1fae5;color:#065f46;}
              .footer{text-align:center;margin-top:40px;font-size:10px;color:#9ca3af;border-top:1px solid #e2e8f0;padding-top:16px;}
              .bar-bg{background:#e2e8f0;border-radius:10px;height:8px;margin:8px 0;}
              .bar-fill{background:#2dd4bf;border-radius:10px;height:8px;}
            </style></head><body>
            <div class="header">
              <div class="logo">STS</div>
              <div class="sub">ESTADO DE INVERSIÓN</div>
            </div>
            <div class="title">Estimado/a ${nombre}</div>
            <div class="fecha">Reporte generado el ${new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})}</div>
            <div class="card">
              <div class="row"><span class="label">Capital invertido</span><span class="value">USD ${inv.monto.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
              <div class="row"><span class="label">Tasa anual</span><span class="value">${inv.tasa}% interés compuesto</span></div>
              <div class="row"><span class="label">Fecha de inicio</span><span class="value">${new Date(inv.fecha_inicio+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})}</span></div>
              <div class="row"><span class="label">Días transcurridos</span><span class="value">${dias} días</span></div>
              <div class="row"><span class="label">Estado</span><span class="value"><span class="status ${bloqueado?"bloqueado":"disponible"}">${bloqueado?"🔒 Bloqueado ("+diasRestantes+" días restantes)":"✓ Disponible para retiro"}</span></span></div>
            </div>
            <div class="highlight">USD ${total.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
            <div style="text-align:center;font-size:12px;color:#6b7280;">Capital + Intereses acumulados al día de hoy</div>
            <div class="card">
              <div class="row"><span class="label">Capital</span><span class="value">USD ${inv.monto.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
              <div class="row"><span class="label">Intereses generados</span><span class="value" style="color:#2dd4bf">+ USD ${interes.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
              <div class="row"><span class="label">Rentabilidad actual</span><span class="value" style="color:#2dd4bf">${((interes/inv.monto)*100).toFixed(3)}%</span></div>
              ${inv.nota?`<div class="row"><span class="label">Nota</span><span class="value">${inv.nota}</span></div>`:""}
            </div>
            <div class="bar-bg"><div class="bar-fill" style="width:${Math.min(100,(dias/365)*100)}%"></div></div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;"><span>Inicio</span><span>365 días (1 año)</span></div>
            <div class="footer">STS · Este reporte es informativo · Los valores se calculan sobre la base de interés compuesto anual del ${inv.tasa}%</div>
            </body></html>`;

            const w = window.open("","_blank");
            w.document.write(html);
            w.document.close();
            setTimeout(()=>w.print(), 500);
          }

          return (
            <div>
              <div style={{fontSize:10,letterSpacing:3,color:"#2dd4bf",marginBottom:4}}>INVERSIONES</div>
              <div style={{fontSize:12,color:"#94a3b8",marginBottom:18}}>Seguimiento de inversiones con tasa en USD</div>

              {/* Formulario nueva inversión */}
              <Card sx={{marginBottom:16,border:"1px solid #2dd4bf33"}}>
                <div style={{fontSize:10,letterSpacing:2,color:"#2dd4bf",marginBottom:12}}>NUEVA INVERSIÓN</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  {/* Cliente */}
                  <div style={{position:"relative",gridColumn:"1/-1"}}>
                    <Lbl>Cliente</Lbl>
                    <div style={{display:"flex",gap:4}}>
                      {nuevaInv.clienteId&&!nuevaInv.clienteBuscar&&(()=>{
                        const cl=clientes.find(x=>x.id===Number(nuevaInv.clienteId));
                        return cl?<div style={{flex:1,padding:"5px 8px",borderRadius:5,background:"rgba(45,212,191,0.08)",border:"1px solid #2dd4bf44",fontSize:10,color:"#2dd4bf",fontWeight:600}}>{cl.nombre} {cl.apellido}</div>:null;
                      })()}
                      <input value={nuevaInv.clienteBuscar||""} onChange={e=>setNuevaInv(p=>({...p,clienteBuscar:e.target.value,clienteId:""}))}
                        placeholder={nuevaInv.clienteId&&!nuevaInv.clienteBuscar?"Cambiar...":"Buscar cliente..."}
                        style={{flex:1,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:5,padding:"5px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:10,outline:"none"}}/>
                    </div>
                    {nuevaInv.clienteBuscar&&(()=>{
                      const filt=clientes.filter(c=>(c.nombre+" "+c.apellido).toLowerCase().includes(nuevaInv.clienteBuscar.toLowerCase()));
                      return filt.length>0?(
                        <div style={{position:"absolute",left:0,right:0,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:200,maxHeight:120,overflowY:"auto",marginTop:2}}>
                          {filt.map(cl=>(
                            <div key={cl.id} onClick={()=>setNuevaInv(p=>({...p,clienteId:String(cl.id),clienteBuscar:""}))}
                              style={{padding:"6px 10px",cursor:"pointer",fontSize:10,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>{cl.nombre} {cl.apellido}</div>
                          ))}
                        </div>
                      ):null;
                    })()}
                  </div>
                  <div><Lbl>Monto USD</Lbl><Inp type="number" placeholder="10000" value={nuevaInv.monto} onChange={e=>setNuevaInv(p=>({...p,monto:e.target.value}))}/></div>
                  <div><Lbl>Tasa anual %</Lbl><Inp type="number" placeholder="8" value={nuevaInv.tasa} onChange={e=>setNuevaInv(p=>({...p,tasa:e.target.value}))}/></div>
                  <div><Lbl>Bloqueo mínimo (días)</Lbl><Inp type="number" placeholder="30" value={nuevaInv.bloqueoDias} onChange={e=>setNuevaInv(p=>({...p,bloqueoDias:e.target.value}))}/></div>
                  <div><Lbl>Fecha inicio</Lbl><Inp type="date" value={nuevaInv.fechaInicio||hoy} onChange={e=>setNuevaInv(p=>({...p,fechaInicio:e.target.value}))}/></div>
                  <div style={{gridColumn:"1/-1"}}><Lbl>Nota (opcional)</Lbl><Inp placeholder="..." value={nuevaInv.nota} onChange={e=>setNuevaInv(p=>({...p,nota:e.target.value}))}/></div>
                </div>
                {/* Preview */}
                {nuevaInv.monto&&nuevaInv.tasa&&(()=>{
                  const m=parse(nuevaInv.monto), t=parse(nuevaInv.tasa);
                  const int30=calcInteres(m,t,30), int90=calcInteres(m,t,90), int365=calcInteres(m,t,365);
                  return (
                    <div style={{background:"rgba(45,212,191,0.05)",border:"1px solid rgba(45,212,191,0.2)",borderRadius:8,padding:"10px 14px",marginBottom:10,fontSize:11}}>
                      <div style={{color:"#2dd4bf",fontWeight:700,marginBottom:6}}>Proyección interés compuesto:</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                        {[[30,int30],[90,int90],[365,int365]].map(([d,i])=>(
                          <div key={d} style={{textAlign:"center",background:"rgba(45,212,191,0.06)",borderRadius:6,padding:"6px"}}>
                            <div style={{fontSize:9,color:"#9ca3af"}}>{d} días</div>
                            <div style={{fontWeight:700,color:"#2dd4bf"}}>+USD {i.toFixed(2)}</div>
                            <div style={{fontSize:9,color:"#94a3b8"}}>Total {(m+i).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <button onClick={async()=>{
                  const m=parse(nuevaInv.monto), t=parse(nuevaInv.tasa), bl=parse(nuevaInv.bloqueoDias)||30;
                  if(!nuevaInv.clienteId||!m||!t){notify("Completá cliente, monto y tasa",false);return;}
                  const cl=clientes.find(x=>x.id===Number(nuevaInv.clienteId));
                  const fInicio=nuevaInv.fechaInicio||hoy;
                  const invData={cliente_id:Number(nuevaInv.clienteId),cliente_nombre:cl?cl.nombre+" "+cl.apellido:"",monto:m,tasa:t,bloqueo_dias:bl,fecha_inicio:fInicio,nota:nuevaInv.nota||"",activa:true};
                  const {data:ins}=await SB.from("inversiones").insert(invData).select().single();
                  if(ins){
                    setInversiones(p=>[{...ins},...p]);
                    // Registrar en CC del cliente como ingreso (nos deposita USD)
                    const hora2=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
                    const notaCC=`Inversión ${t}% anual — ${bl} días bloqueo — USD ${fmt(m)}`;
                    await SB.from("movimientos_cc").insert({cliente_id:Number(nuevaInv.clienteId),hora:hora2,fecha:fInicio,tipo:"ingreso_transf",moneda:"USD",monto:m,nota:notaCC});
                    setClientes(p=>p.map(cl2=>cl2.id!==Number(nuevaInv.clienteId)?cl2:{...cl2,movimientos:[...cl2.movimientos,{id:Date.now(),hora:hora2,fecha:fInicio,tipo:"ingreso_transf",moneda:"USD",monto:m,nota:notaCC}]}));
                    setNuevaInv({clienteId:"",clienteBuscar:"",monto:"",tasa:"8",bloqueoDias:"30",nota:""});
                    notify("Inversión registrada ✓");
                  }
                }}
                  style={{width:"100%",padding:10,borderRadius:7,background:"rgba(45,212,191,0.08)",border:"1px solid #2dd4bf",color:"#2dd4bf",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  + REGISTRAR INVERSIÓN
                </button>
              </Card>

              {/* Lista de inversiones activas */}
              {invsActivas.length===0&&(
                <Card sx={{textAlign:"center",padding:40}}>
                  <div style={{fontSize:24,marginBottom:8}}>💎</div>
                  <div style={{color:"#64748b"}}>Sin inversiones activas</div>
                </Card>
              )}

              {invsActivas.map(inv=>{
                const dias=diasEntreFechas(inv.fecha_inicio,hoyDate);
                const interes=calcInteres(inv.monto,inv.tasa,dias);
                const total=inv.monto+interes;
                const bloqueado=dias<inv.bloqueo_dias;
                const pctCompletado=Math.min(100,(dias/365)*100);
                const cl=clientes.find(c=>c.id===Number(inv.cliente_id));
                const nombre=cl?cl.nombre+" "+cl.apellido:inv.cliente_nombre||"—";
                return (
                  <Card key={inv.id} sx={{marginBottom:12,border:"1px solid "+(bloqueado?"rgba(245,158,11,0.3)":"rgba(45,212,191,0.3)")}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>{nombre}</div>
                        <div style={{fontSize:10,color:"#9ca3af",marginTop:2}}>Inicio: {inv.fecha_inicio} · Tasa: {inv.tasa}% anual · Bloqueo: {inv.bloqueo_dias} días</div>
                        {inv.nota&&<div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{inv.nota}</div>}
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:18,fontWeight:900,color:"#2dd4bf"}}>USD {total.toFixed(2)}</div>
                        <div style={{fontSize:10,color:"#4ade80"}}>+USD {interes.toFixed(4)} intereses</div>
                        <div style={{marginTop:4}}>
                          <span style={{fontSize:9,padding:"2px 8px",borderRadius:10,fontWeight:700,background:bloqueado?"rgba(245,158,11,0.15)":"rgba(45,212,191,0.15)",color:bloqueado?"#f59e0b":"#2dd4bf"}}>
                            {bloqueado?`🔒 ${inv.bloqueo_dias-dias} días para desbloquear`:"✓ Disponible"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Barra de progreso */}
                    <div style={{background:"rgba(255,255,255,0.05)",borderRadius:10,height:6,marginBottom:10}}>
                      <div style={{background:bloqueado?"#f59e0b":"#2dd4bf",borderRadius:10,height:6,width:pctCompletado+"%",transition:"width 0.3s"}}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#9ca3af",marginBottom:12}}>
                      <span>{dias} días transcurridos</span>
                      <span>{pctCompletado.toFixed(1)}% del año</span>
                    </div>
                    {/* Detalles */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:12}}>
                      {[[`Capital`,`USD ${fmt(inv.monto)}`,"#e2e8f0"],[`Intereses`,`+USD ${interes.toFixed(4)}`,"#4ade80"],[`Rentabilidad`,`${((interes/inv.monto)*100).toFixed(3)}%`,"#2dd4bf"]].map(([l,v,c])=>(
                        <div key={l} style={{background:"rgba(255,255,255,0.02)",borderRadius:6,padding:"8px",textAlign:"center"}}>
                          <div style={{fontSize:9,color:"#9ca3af",marginBottom:2}}>{l}</div>
                          <div style={{fontSize:11,fontWeight:700,color:c}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Acciones */}
                    <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
                      <button onClick={()=>generarPDFInversion(inv)}
                        style={{padding:"6px 14px",borderRadius:6,background:"rgba(99,102,241,0.08)",border:"1px solid #6366f1",color:"#a5b4fc",fontFamily:"inherit",fontSize:11,cursor:"pointer",fontWeight:600}}>
                        📄 Enviar estado
                      </button>
                      {!bloqueado&&(
                        <button onClick={async()=>{
                          if(!window.confirm(`Liquidar inversión de ${nombre}?
Capital: USD ${fmt(inv.monto)}
Intereses: USD ${interes.toFixed(4)}
Total: USD ${total.toFixed(2)}`)) return;
                          const hora2=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
                          // Registrar devolución capital en CC
                          const notaK=`Liquidación inversión — capital USD ${fmt(inv.monto)}`;
                          await SB.from("movimientos_cc").insert({cliente_id:inv.cliente_id,hora:hora2,fecha:hoy,tipo:"retiro_transf",moneda:"USD",monto:inv.monto,nota:notaK});
                          // Registrar intereses en CC
                          const notaI=`Liquidación inversión — intereses ${inv.tasa}% anual por ${dias} días = USD ${interes.toFixed(4)}`;
                          await SB.from("movimientos_cc").insert({cliente_id:inv.cliente_id,hora:hora2,fecha:hoy,tipo:"retiro_transf",moneda:"USD",monto:interes,nota:notaI});
                          // Marcar inversión como inactiva
                          await SB.from("inversiones").update({activa:false}).eq("id",inv.id);
                          setInversiones(p=>p.map(x=>x.id!==inv.id?x:{...x,activa:false}));
                          setClientes(p=>p.map(cl2=>{
                            if(cl2.id!==Number(inv.cliente_id)) return cl2;
                            return {...cl2,movimientos:[...cl2.movimientos,
                              {id:Date.now(),hora:hora2,fecha:hoy,tipo:"retiro_transf",moneda:"USD",monto:inv.monto,nota:notaK},
                              {id:Date.now()+1,hora:hora2,fecha:hoy,tipo:"retiro_transf",moneda:"USD",monto:interes,nota:notaI}
                            ]};
                          }));
                          notify("Inversión liquidada ✓");
                        }}
                          style={{padding:"6px 14px",borderRadius:6,background:"rgba(45,212,191,0.08)",border:"1px solid #2dd4bf",color:"#2dd4bf",fontFamily:"inherit",fontSize:11,cursor:"pointer",fontWeight:600}}>
                          ✓ Liquidar USD {total.toFixed(2)}
                        </button>
                      )}
                      {bloqueado&&(
                        <button onClick={async()=>{
                          if(!window.confirm(`Retiro anticipado de ${nombre}?
SIN INTERESES — solo capital USD ${fmt(inv.monto)}
¿Confirmar?`)) return;
                          const hora2=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
                          const notaK=`Retiro anticipado inversión (sin intereses) — capital USD ${fmt(inv.monto)}`;
                          await SB.from("movimientos_cc").insert({cliente_id:inv.cliente_id,hora:hora2,fecha:hoy,tipo:"retiro_transf",moneda:"USD",monto:inv.monto,nota:notaK});
                          await SB.from("inversiones").update({activa:false}).eq("id",inv.id);
                          setInversiones(p=>p.map(x=>x.id!==inv.id?x:{...x,activa:false}));
                          setClientes(p=>p.map(cl2=>{
                            if(cl2.id!==Number(inv.cliente_id)) return cl2;
                            return {...cl2,movimientos:[...cl2.movimientos,{id:Date.now(),hora:hora2,fecha:hoy,tipo:"retiro_transf",moneda:"USD",monto:inv.monto,nota:notaK}]};
                          }));
                          notify("Retiro anticipado registrado");
                        }}
                          style={{padding:"6px 14px",borderRadius:6,background:"rgba(248,113,113,0.08)",border:"1px solid #f87171",color:"#f87171",fontFamily:"inherit",fontSize:11,cursor:"pointer",fontWeight:600}}>
                          ⚠ Retiro anticipado (sin intereses)
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}

              {/* Resumen total */}
              {invsActivas.length>0&&(()=>{
                const totalCapital=invsActivas.reduce((s,inv)=>s+inv.monto,0);
                const totalIntereses=invsActivas.reduce((s,inv)=>s+calcInteres(inv.monto,inv.tasa,diasEntreFechas(inv.fecha_inicio,hoyDate)),0);
                return (
                  <Card sx={{background:"rgba(45,212,191,0.04)",border:"1px solid rgba(45,212,191,0.2)"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                      {[["Inversiones activas",invsActivas.length+" clientes","#e2e8f0"],["Capital total","USD "+fmt(Math.round(totalCapital)),"#e2e8f0"],["Intereses acumulados","+USD "+totalIntereses.toFixed(2),"#4ade80"]].map(([l,v,c])=>(
                        <div key={l} style={{textAlign:"center"}}>
                          <div style={{fontSize:9,color:"#9ca3af",marginBottom:4}}>{l}</div>
                          <div style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })()}
            </div>
          );
        })()}

        {pant==="socios"&&(()=>{
          const total=socios.reduce((s,x)=>s+parse(x.monto),0);
          const COLORES=["#4ade80","#38bdf8","#f59e0b","#c084fc","#f87171","#34d399"];
          // Grafico de torta SVG
          function PieChart({data}) {
            if(!data.length) return null;
            const tot=data.reduce((s,d)=>s+d.v,0); if(!tot) return null;
            let ang=0; const cx=100,cy=100,r=80;
            const slices=data.map((d,i)=>{
              const pct=d.v/tot, startAng=ang, endAng=ang+pct*2*Math.PI;
              ang=endAng;
              const x1=cx+r*Math.sin(startAng),y1=cy-r*Math.cos(startAng);
              const x2=cx+r*Math.sin(endAng),y2=cy-r*Math.cos(endAng);
              const large=pct>0.5?1:0;
              return {path:"M"+cx+","+cy+" L"+x1+","+y1+" A"+r+","+r+" 0 "+large+",1 "+x2+","+y2+" Z",color:d.color,label:d.label,pct:(pct*100).toFixed(1)};
            });
            return (
              <svg viewBox="0 0 200 200" style={{width:200,height:200}}>
                {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} stroke="#111" strokeWidth="1"/>)}
              </svg>
            );
          }
          return (
            <div>
              <div style={{fontSize:10,letterSpacing:3,color:"#a78bfa",marginBottom:4}}>SOCIOS</div>
              <div style={{fontSize:12,color:"#94a3b8",marginBottom:18}}>Inversion y distribucion de capital</div>
              <div className="grid-mobile-1" style={S.grid("1fr 1fr",18)}>
                <Card sx={{border:"1px solid #a78bfa33"}}>
                  <div style={{fontSize:10,letterSpacing:3,color:"#a78bfa",marginBottom:12}}>AGREGAR SOCIO</div>
                  <div style={S.grid("1fr 1fr",8)}>
                    <div><Lbl>Nombre</Lbl><Inp placeholder="Sala" value={nuevoSocio.nombre} onChange={e=>setNuevoSocio(s=>({...s,nombre:e.target.value}))}/></div>
                    <div><Lbl>Inversion USD</Lbl><Inp type="number" placeholder="0" value={nuevoSocio.monto} onChange={e=>setNuevoSocio(s=>({...s,monto:e.target.value}))}/></div>
                  </div>
                  <button onClick={async()=>{
                    if(!nuevoSocio.nombre.trim()||!parse(nuevoSocio.monto)){notify("Completa nombre y monto",false);return;}
                    const {data:ins}=await SB.from("socios").insert({nombre:nuevoSocio.nombre.trim(),monto:parse(nuevoSocio.monto)}).select().single();
                    if(ins) setSocios(p=>[...p,ins]);
                    setNuevoSocio({nombre:"",monto:""});
                    notify("Socio agregado");
                  }} style={{marginTop:10,width:"100%",padding:10,borderRadius:7,background:"#0a0a1a",border:"1px solid #a78bfa",color:"#a78bfa",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    + AGREGAR
                  </button>

                  {/* Aportes de capital */}
                  <div style={{marginTop:20,borderTop:"1px solid #1f2937",paddingTop:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <div style={{fontSize:10,letterSpacing:3,color:"#34d399"}}>APORTES DE CAPITAL</div>
                      <button onClick={()=>setMostrarAportes(v=>!v)}
                        style={{fontSize:10,padding:"3px 10px",borderRadius:5,background:mostrarAportes?"rgba(52,211,153,0.1)":"transparent",border:"1px solid "+(mostrarAportes?"#34d39944":"#374151"),color:mostrarAportes?"#34d399":"#6b7280",cursor:"pointer",fontFamily:"inherit"}}>
                        {mostrarAportes?"▾ Ocultar":"+ Nuevo aporte"}
                      </button>
                    </div>
                    {mostrarAportes&&(
                      <div style={{background:"rgba(52,211,153,0.04)",border:"1px solid #34d39922",borderRadius:8,padding:12,marginBottom:12}}>
                        {/* Tipo de aporte */}
                        <div style={{display:"flex",gap:8,marginBottom:10}}>
                          {[{v:"caja",l:"💵 Caja física",hint:"Entra USD físico + sube inversión"},{v:"cc",l:"🔄 Desde CC",hint:"Reduce lo que le debés + sube inversión"}].map(opt=>(
                            <button key={opt.v} onClick={()=>setNuevoAporte(a=>({...a,tipo:opt.v}))}
                              title={opt.hint}
                              style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid "+(nuevoAporte.tipo===opt.v?"#34d399":"#1f2937"),
                                background:nuevoAporte.tipo===opt.v?"rgba(52,211,153,0.1)":"transparent",
                                color:nuevoAporte.tipo===opt.v?"#34d399":"#4b5563",
                                fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                              {opt.l}
                            </button>
                          ))}
                        </div>
                        {nuevoAporte.tipo==="cc"&&(
                          <div style={{fontSize:10,color:"#f59e0b",background:"rgba(245,158,11,0.06)",border:"1px solid #f59e0b22",borderRadius:6,padding:"6px 10px",marginBottom:8}}>
                            ⚠ Se generará un <strong>retiro_transf (DEBE)</strong> en la CC del socio para compensar el saldo
                          </div>
                        )}
                        <div style={S.grid("1fr 1fr",8)}>
                          <div>
                            <Lbl>Socio</Lbl>
                            <Sel value={nuevoAporte.socioId} onChange={e=>setNuevoAporte(a=>({...a,socioId:e.target.value}))}>
                              <option value="">-- Elegir --</option>
                              {socios.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </Sel>
                          </div>
                          <div><Lbl>Monto USD</Lbl><Inp type="number" placeholder="2000" value={nuevoAporte.monto} onChange={e=>setNuevoAporte(a=>({...a,monto:e.target.value}))}/></div>
                          <div><Lbl>Fecha</Lbl><Inp type="date" value={nuevoAporte.fecha} onChange={e=>setNuevoAporte(a=>({...a,fecha:e.target.value}))}/></div>
                          <div><Lbl>Nota</Lbl><Inp placeholder="Aporte de capital" value={nuevoAporte.nota} onChange={e=>setNuevoAporte(a=>({...a,nota:e.target.value}))}/></div>
                        </div>
                        <button onClick={async()=>{
                          const monto=parse(nuevoAporte.monto);
                          if(!nuevoAporte.socioId||!monto){notify("Completá socio y monto",false);return;}
                          const socio=socios.find(s=>String(s.id)===String(nuevoAporte.socioId));
                          if(!socio) return;
                          const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
                          const notaAporte=nuevoAporte.nota||(nuevoAporte.tipo==="cc"?"Conversión CC a capital":"Aporte de capital");
                          // 1. Registrar aporte
                          const {data:ins}=await SB.from("aportes_capital").insert({
                            socio_id:socio.id,socio_nombre:socio.nombre,
                            monto,fecha:nuevoAporte.fecha,nota:notaAporte,tipo:nuevoAporte.tipo
                          }).select().single();
                          if(ins) setAportes(p=>[ins,...p]);
                          // 2. Actualizar monto del socio
                          const nuevoMonto=parse(socio.monto)+monto;
                          await SB.from("socios").update({monto:nuevoMonto}).eq("id",socio.id);
                          setSocios(p=>p.map(x=>x.id!==socio.id?x:{...x,monto:nuevoMonto}));
                          if(nuevoAporte.tipo==="caja"){
                            // Caja física: entra USD
                            const ns=await leerSaldoFresco(); ns.USD=(ns.USD||0)+monto;
                            setSaldos(ns); await guardarDia(ns,null,null);
                            notify("Aporte registrado ✓ — USD ingresados a caja");
                          } else {
                            // Desde CC: generar retiro_transf (DEBE) en la CC del socio
                            // Buscar cliente CC del socio por nombre
                            // Mapa fijo de socios a sus CC
                            const SOCIO_CC_MAP = {
                              "GONZALO SPADAFORA": 121,
                              "MANUEL SALA": 130,
                              "MATIAS SPERANZA": 134,
                            };
                            const ccId = SOCIO_CC_MAP[socio.nombre.toUpperCase()];
                            const clSocio = ccId ? clientes.find(cl=>cl.id===ccId) : null;
                            if(clSocio){
                              const notaCC=`Conversión CC a capital — aporte USD ${monto.toLocaleString("es-AR")}`;
                              const mv={id:Date.now(),hora,fecha:nuevoAporte.fecha,tipo:"retiro_transf",moneda:"USD",monto,nota:notaCC};
                              await SB.from("movimientos_cc").insert({cliente_id:clSocio.id,hora,fecha:nuevoAporte.fecha,tipo:"retiro_transf",moneda:"USD",monto,nota:notaCC});
                              setClientes(p=>p.map(cl=>cl.id!==clSocio.id?cl:{...cl,movimientos:[...cl.movimientos,mv]}));
                              notify("Aporte registrado ✓ — CC del socio reducida en USD "+monto.toLocaleString("es-AR"));
                            } else {
                              notify("Aporte registrado ✓ — no se encontró CC del socio (buscalo manualmente)",false);
                            }
                          }
                          setNuevoAporte({socioId:"",monto:"",fecha:hoy,nota:"",tipo:"caja"});
                          setMostrarAportes(false);
                        }} style={{marginTop:10,width:"100%",padding:9,borderRadius:7,background:"rgba(52,211,153,0.08)",border:"1px solid #34d399",color:"#34d399",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                          ✓ Confirmar aporte
                        </button>
                      </div>
                    )}
                    {/* Historial de aportes */}
                    {aportes.length>0&&(
                      <div>
                        {aportes.slice(0,5).map(a=>(
                          <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #0f0f0f",fontSize:11}}>
                            <div>
                              <span style={{color:"#34d399",fontWeight:700}}>{a.socio_nombre}</span>
                              <span style={{color:"#94a3b8",marginLeft:8}}>{a.fecha}</span>
                              {a.nota&&<span style={{color:"#64748b",marginLeft:6}}>· {a.nota}</span>}
                            </div>
                            <span style={{color:"#34d399",fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>+{fmtUSD(a.monto)}</span>
                          </div>
                        ))}
                        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",marginTop:4,borderTop:"1px solid #1f2937"}}>
                          <span style={{fontSize:11,color:"#9ca3af"}}>Total aportado</span>
                          <span style={{fontSize:12,fontWeight:700,color:"#34d399"}}>{fmtUSD(aportes.reduce((s,a)=>s+Number(a.monto),0))}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{marginTop:16,borderTop:"1px solid #1f2937",paddingTop:16}}>
                    <div style={{fontSize:10,letterSpacing:3,color:"#a78bfa",marginBottom:10}}>DISTRIBUCIÓN ACTUAL</div>
                    {socios.map((s,i)=>(
                      <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid #1a1a1a"}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:COLORES[i%COLORES.length],flexShrink:0}}/>
                        <div style={{flex:1,fontWeight:700}}>{s.nombre}</div>
                        <input type="number" defaultValue={s.monto}
                          onBlur={async e=>{
                            const v=parse(e.target.value);
                            await SB.from("socios").update({monto:v}).eq("id",s.id);
                            setSocios(p=>p.map(x=>x.id!==s.id?x:{...x,monto:v}));
                            notify("Actualizado");
                          }}
                          style={{width:90,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:4,padding:"4px 6px",color:"#fff",fontFamily:"inherit",fontSize:12,textAlign:"right",outline:"none"}}/>
                        <span style={{fontSize:10,color:"#a78bfa",width:42,textAlign:"right"}}>{total?((parse(s.monto)/total)*100).toFixed(1)+"%":"0%"}</span>
                        <button onClick={async()=>{
                          if(!window.confirm("Eliminar este socio?")) return;
                          await SB.from("socios").delete().eq("id",s.id);
                          setSocios(p=>p.filter(x=>x.id!==s.id));
                          notify("Eliminado");
                        }} style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#94a3b8",cursor:"pointer",fontFamily:"inherit"}}>x</button>
                      </div>
                    ))}
                    {socios.length>0&&(
                      <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",marginTop:4}}>
                        <span style={{fontSize:12,fontWeight:700,color:"#9ca3af"}}>TOTAL</span>
                        <span style={{fontSize:14,fontWeight:700,color:"#a78bfa"}}>${fmt(total)}</span>
                      </div>
                    )}
                  </div>
                </Card>
                <Card sx={{border:"1px solid #a78bfa33",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  {socios.length===0?(
                    <div style={{color:"#64748b",fontSize:12,textAlign:"center"}}>Agrega socios para ver el grafico</div>
                  ):(
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:10,letterSpacing:3,color:"#9ca3af",marginBottom:16}}>DISTRIBUCION DE CAPITAL</div>
                      <PieChart data={socios.map((s,i)=>({label:s.nombre,v:parse(s.monto),color:COLORES[i%COLORES.length]}))}/>
                      <div style={{display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center",marginTop:16}}>
                        {socios.map((s,i)=>(
                          <div key={s.id} style={{display:"flex",alignItems:"center",gap:5,fontSize:11}}>
                            <div style={{width:8,height:8,borderRadius:"50%",background:COLORES[i%COLORES.length]}}/>
                            <span style={{color:"#9ca3af"}}>{s.nombre}</span>
                            <span style={{color:COLORES[i%COLORES.length],fontWeight:700}}>{total?((parse(s.monto)/total)*100).toFixed(1):0}%</span>
                          </div>
                        ))}
                      </div>
                      <div style={{marginTop:16,fontSize:11,color:"#94a3b8"}}>Total invertido: <strong style={{color:"#a78bfa"}}>${fmt(total)} USD</strong></div>
                    </div>
                  )}
                </Card>
              </div>
              {/* Liquidacion mensual */}
              {socios.length>0&&ultimoCierre?.total_usd&&(()=>{
                const patrimonioFinal=parse(liquidacion.patrimonioManual)||ultimoCierre.total_usd;
                const inversionTotal=total;
                // Calcular fondo de reserva automáticamente desde liquidaciones pasadas y gastos
                const totalFondoIngresado=liquidaciones.reduce((s,l)=>s+(l.reserva||0),0);
                const totalFondoRetirado=gastos.filter(g=>g.categoria==="Fondo de Reserva"&&g.moneda==="USD").reduce((s,g)=>s+Number(g.monto||0),0);
                const reservaAcumAnterior=Math.max(0,totalFondoIngresado-totalFondoRetirado);
                // Ganancia real = patrimonio final - inversión - reservas acumuladas de meses anteriores
                const gananciaBruta=patrimonioFinal-inversionTotal-reservaAcumAnterior;
                const empleadosCalc=(liquidacion.empleados||[]).map(emp=>{
                  const fijo=parse(emp.cotizSueldo)>0?parse(emp.sueldoFijo)/parse(emp.cotizSueldo):0;
                  const variable=emp.tieneVariable&&gananciaBruta>0?gananciaBruta*(parse(emp.pctVariable)/100):0;
                  return {...emp,fijo,variable,total:fijo+variable};
                });
                const totalEmpleado=empleadosCalc.reduce((s,e)=>s+e.total,0);
                const nuevaReserva=gananciaBruta>0?gananciaBruta*(parse(liquidacion.pctReserva)/100):0;
                const reserva=nuevaReserva; // para compatibilidad con el resto
                const reservaTotalAcum=reservaAcumAnterior+nuevaReserva;
                const gananciaNeta=gananciaBruta-totalEmpleado-nuevaReserva;
                return (
                  <div style={{marginTop:18}}>
                    <button onClick={()=>setLiquidacion(l=>({...l,mostrando:!l.mostrando}))}
                      style={{width:"100%",padding:"10px",borderRadius:8,background:liquidacion.mostrando?"rgba(99,102,241,0.1)":"rgba(255,255,255,0.02)",border:"1px solid "+(liquidacion.mostrando?"#6366f1":"rgba(255,255,255,0.08)"),color:liquidacion.mostrando?"#a5b4fc":"#475569",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:1}}>
                      {liquidacion.mostrando?"▾ LIQUIDACION MENSUAL":"📊 LIQUIDACION MENSUAL"}
                    </button>
                    {liquidacion.mostrando&&(
                      <Card sx={{marginTop:10,border:"1px solid #6366f133"}}>
                        {/* Periodo */}
                        <div style={{marginBottom:14}}>
                          <Lbl>Periodo al que corresponde</Lbl>
                          <Inp type="month" value={liquidacion.periodo} onChange={e=>setLiquidacion(l=>({...l,periodo:e.target.value}))}
                            placeholder="2026-03"/>
                          {liquidacion.periodo&&<div style={{fontSize:10,color:"#6366f1",marginTop:4}}>
                            {new Date(liquidacion.periodo+"-01").toLocaleDateString("es-AR",{month:"long",year:"numeric"}).toUpperCase()}
                          </div>}
                        </div>
                        <div style={{marginBottom:14}}>
                          <Lbl>Fecha de impacto <span style={{color:"#94a3b8",fontSize:9}}>(por defecto hoy)</span></Lbl>
                          <Inp type="date" value={liquidacion.fechaImpacto} onChange={e=>setLiquidacion(l=>({...l,fechaImpacto:e.target.value}))}/>
                        </div>
                        {/* Resumen patrimonial */}
                        <div style={{marginBottom:16}}>
                          <div style={{fontSize:10,letterSpacing:2,color:"#6366f1",marginBottom:8}}>RESUMEN PATRIMONIAL</div>
                          <div style={{marginBottom:10}}>
                            <Lbl>Monto de cierre USD <span style={{color:"#94a3b8",fontSize:9}}>(por defecto ultimo cierre)</span></Lbl>
                            <Inp type="number" placeholder={fmtUSD(ultimoCierre.total_usd)+" (ultimo cierre)"} value={liquidacion.patrimonioManual}
                              onChange={e=>setLiquidacion(l=>({...l,patrimonioManual:e.target.value}))}/>
                          </div>
                          {(()=>{
                            // Calcular fondo de reserva automáticamente
                            const totalIngresado=liquidaciones.reduce((s,l)=>s+(l.reserva||0),0);
                            const totalRetirado=gastos.filter(g=>g.categoria==="Fondo de Reserva"&&g.moneda==="USD").reduce((s,g)=>s+Number(g.monto||0),0);
                            const fondoDisponible=totalIngresado-totalRetirado;
                            return (
                              <div style={{marginBottom:10,background:"rgba(99,102,241,0.05)",border:"1px solid #6366f122",borderRadius:8,padding:"10px 12px"}}>
                                <div style={{fontSize:9,letterSpacing:2,color:"#6366f1",marginBottom:8,fontWeight:700}}>FONDO DE RESERVA</div>
                                <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:8}}>
                                  <div>
                                    <div style={{fontSize:9,color:"#94a3b8",marginBottom:2}}>Acumulado</div>
                                    <div style={{fontSize:13,fontWeight:700,color:"#a5b4fc"}}>{fmtUSD(totalIngresado)}</div>
                                  </div>
                                  <div>
                                    <div style={{fontSize:9,color:"#94a3b8",marginBottom:2}}>Retirado</div>
                                    <div style={{fontSize:13,fontWeight:700,color:"#f87171"}}>-{fmtUSD(totalRetirado)}</div>
                                  </div>
                                  <div>
                                    <div style={{fontSize:9,color:"#94a3b8",marginBottom:2}}>Disponible</div>
                                    <div style={{fontSize:13,fontWeight:700,color:fondoDisponible>0?"#4ade80":"#f87171"}}>{fmtUSD(fondoDisponible)}</div>
                                  </div>
                                </div>
                                <div style={{fontSize:10,color:"#6366f1",marginTop:3}}>
                                  Se resta automáticamente de la ganancia bruta
                                </div>
                                {reservaAcumAnterior>0&&<div style={{fontSize:10,color:"#6366f1",marginTop:3}}>
                                  Ganancia ajustada: USD {fmt(Math.round(gananciaBruta))} (sin el fondo de reserva)
                                </div>}
                              </div>
                            );
                          })()}
                          {[
                            ["Patrimonio final",fmtUSD(patrimonioFinal),"#4ade80"],
                            ["Inversion socios",fmtUSD(inversionTotal),"#9ca3af"],
                            ["Ganancia bruta",fmtUSD(gananciaBruta),gananciaBruta>-1?"#4ade80":"#f87171"],
                          ].map(([k,v,col])=>(
                            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #0f0f0f"}}>
                              <span style={{fontSize:12,color:"#9ca3af"}}>{k}</span>
                              <span style={{fontSize:12,fontWeight:700,color:col}}>{v}</span>
                            </div>
                          ))}
                        </div>
                        {/* Empleados */}
                        <div style={{marginBottom:16}}>
                          <div style={{fontSize:10,letterSpacing:2,color:"#f59e0b",marginBottom:10}}>EMPLEADOS</div>
                          {empleadosCalc.map((emp)=>{
                            const clEmp=clientes.find(x=>x.id===Number(emp.ccId));
                            const filtradosEmp=clientes.filter(x=>(x.nombre+" "+x.apellido).toLowerCase().includes((emp.ccBuscar||"").toLowerCase()));
                            const updEmp=(fields)=>setLiquidacion(l=>({...l,empleados:l.empleados.map(e=>e.id!==emp.id?e:{...e,...fields})}));
                            return (
                              <div key={emp.id} style={{background:"rgba(245,158,11,0.04)",border:"1px solid #f59e0b22",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                                  <input value={emp.nombre} onChange={e=>updEmp({nombre:e.target.value})}
                                    style={{flex:1,background:"transparent",border:"none",borderBottom:"1px solid #374151",padding:"2px 4px",color:"#f59e0b",fontFamily:"inherit",fontSize:12,fontWeight:700,outline:"none"}}/>
                                  <span style={{fontSize:13,fontWeight:700,color:"#f59e0b",marginLeft:12}}>{fmtUSD(emp.total)}</span>
                                </div>
                                <div style={S.grid("1fr 1fr",8)}>
                                  <div><Lbl>Fijo ARS</Lbl><Inp type="number" placeholder="0" value={emp.sueldoFijo} onChange={e=>updEmp({sueldoFijo:e.target.value})}/></div>
                                  <div><Lbl>Cotización</Lbl><Inp type="number" placeholder="1400" value={emp.cotizSueldo} onChange={e=>updEmp({cotizSueldo:e.target.value})}/></div>
                                </div>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,marginBottom:8}}>
                                  <button onClick={()=>updEmp({tieneVariable:!emp.tieneVariable})}
                                    style={{fontSize:10,padding:"3px 10px",borderRadius:5,background:emp.tieneVariable?"rgba(245,158,11,0.15)":"rgba(255,255,255,0.03)",border:"1px solid "+(emp.tieneVariable?"#f59e0b44":"#374151"),color:emp.tieneVariable?"#f59e0b":"#475569",cursor:"pointer",fontFamily:"inherit"}}>
                                    {emp.tieneVariable?"✓ Con variable":"+ Variable"}
                                  </button>
                                  {emp.tieneVariable&&(
                                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                                      <Inp type="number" placeholder="5" value={emp.pctVariable} onChange={e=>updEmp({pctVariable:e.target.value})} sx={{width:60}}/>
                                      <span style={{fontSize:10,color:"#9ca3af"}}>% → {fmtUSD(emp.variable)}</span>
                                    </div>
                                  )}
                                  {emp.fijo>0&&<span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>Fijo: {fmtUSD(emp.fijo)}{emp.tieneVariable?` + Var: ${fmtUSD(emp.variable)}`:""}</span>}
                                </div>
                                <div style={{position:"relative"}}>
                                  <Lbl>CC <span style={{color:"#94a3b8",fontSize:9}}>(acredita sueldo)</span></Lbl>
                                  <div style={{display:"flex",gap:4}}>
                                    {clEmp&&!emp.ccBuscar&&(
                                      <div style={{flex:1,padding:"5px 8px",borderRadius:6,background:"rgba(245,158,11,0.08)",border:"1px solid #f59e0b44",fontSize:11,color:"#f59e0b",fontWeight:600}}>
                                        {clEmp.nombre} {clEmp.apellido}
                                      </div>
                                    )}
                                    <input value={emp.ccBuscar||""} onChange={e=>updEmp({ccBuscar:e.target.value})}
                                      placeholder={clEmp&&!emp.ccBuscar?"Cambiar...":"Buscar CC..."}
                                      style={{flex:1,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"5px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:11,outline:"none"}}/>
                                    {emp.ccId&&<button onClick={()=>updEmp({ccId:"",ccBuscar:""})}
                                      style={{padding:"3px 7px",borderRadius:5,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontSize:10}}>✕</button>}
                                  </div>
                                  {emp.ccBuscar&&filtradosEmp.length>0&&(
                                    <div style={{position:"absolute",left:0,right:0,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:200,maxHeight:140,overflowY:"auto",marginTop:2}}>
                                      {filtradosEmp.map(cl=>(
                                        <div key={cl.id} onClick={()=>updEmp({ccId:String(cl.id),ccBuscar:""})}
                                          style={{padding:"7px 10px",cursor:"pointer",fontSize:11,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>
                                          {cl.nombre} {cl.apellido}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <button onClick={()=>setLiquidacion(l=>({...l,empleados:[...l.empleados,{id:Date.now(),nombre:"Nuevo empleado",sueldoFijo:"",cotizSueldo:"",pctVariable:"",tieneVariable:false,ccId:"",ccBuscar:""}]}))}
                            style={{fontSize:11,padding:"5px 14px",borderRadius:6,background:"rgba(245,158,11,0.06)",border:"1px solid #f59e0b33",color:"#f59e0b",cursor:"pointer",fontFamily:"inherit",width:"100%"}}>
                            + Agregar empleado
                          </button>
                          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderTop:"1px solid #1f2937",marginTop:8}}>
                            <span style={{fontSize:11,color:"#9ca3af"}}>Total empleados</span>
                            <span style={{fontSize:13,fontWeight:700,color:"#f59e0b"}}>{fmtUSD(totalEmpleado)}</span>
                          </div>
                        </div>
                        {/* Fondo de reserva */}
                        <div style={{marginBottom:16}}>
                          <div style={{fontSize:10,letterSpacing:2,color:"#c084fc",marginBottom:8}}>FONDO DE RESERVA STS</div>
                          <div style={S.grid("1fr 1fr",8)}>
                            <div><Lbl>% sobre ganancia</Lbl><Inp type="number" placeholder="10" value={liquidacion.pctReserva} onChange={e=>setLiquidacion(l=>({...l,pctReserva:e.target.value}))}/></div>
                            <div style={{display:"flex",flexDirection:"column",justifyContent:"flex-end",paddingBottom:6}}>
                              <span style={{fontSize:10,color:"#9ca3af"}}>Reserva</span>
                              <span style={{fontSize:13,fontWeight:700,color:"#c084fc"}}>{fmtUSD(reserva)}</span>
                            </div>
                          </div>
                        </div>
                        {/* Distribucion socios */}
                        <div style={{marginBottom:16}}>
                          <div style={{fontSize:10,letterSpacing:2,color:"#4ade80",marginBottom:8}}>DISTRIBUCION SOCIOS</div>
                          <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #1f2937",marginBottom:8}}>
                            <span style={{fontSize:12,color:"#9ca3af"}}>Ganancia neta a distribuir</span>
                            <span style={{fontSize:13,fontWeight:700,color:gananciaNeta>-1?"#4ade80":"#f87171"}}>{fmtUSD(gananciaNeta)}</span>
                          </div>
                          {socios.map((s,i)=>{
                            const pct=total?parse(s.monto)/total:0;
                            const parte=gananciaNeta>0?gananciaNeta*pct:0;
                            const ccId=liquidacion.sociosCCMap[s.id]||"";
                            const busq=liquidacion.sociosBuscar[s.id]||"";
                            const clSel=clientes.find(x=>x.id===Number(ccId));
                            const filtrados=clientes.filter(x=>(x.nombre+" "+x.apellido).toLowerCase().includes(busq.toLowerCase()));
                            return (
                              <div key={s.id} style={{padding:"8px 0",borderBottom:"1px solid #0f0f0f"}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                                    <div style={{width:8,height:8,borderRadius:"50%",background:COLORES[i%COLORES.length]}}/>
                                    <span style={{fontSize:12,color:"#9ca3af"}}>{s.nombre}</span>
                                    <span style={{fontSize:10,color:"#94a3b8"}}>({(pct*100).toFixed(1)}%)</span>
                                  </div>
                                  <span style={{fontSize:12,fontWeight:700,color:COLORES[i%COLORES.length]}}>{fmtUSD(parte)}</span>
                                </div>
                                <div style={{position:"relative"}}>
                                  <div style={{display:"flex",gap:4}}>
                                    {clSel&&!busq&&(
                                      <div style={{flex:1,padding:"4px 8px",borderRadius:5,background:"rgba(99,102,241,0.08)",border:"1px solid #6366f133",fontSize:10,color:"#a5b4fc",fontWeight:600}}>
                                        {clSel.nombre} {clSel.apellido}
                                      </div>
                                    )}
                                    <input value={busq} onChange={e=>setLiquidacion(l=>({...l,sociosBuscar:{...l.sociosBuscar,[s.id]:e.target.value}}))}
                                      placeholder={clSel&&!busq?"Cambiar CC...":"Buscar CC del socio..."}
                                      style={{flex:1,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:5,padding:"4px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:10,outline:"none"}}/>
                                    {ccId&&<button onClick={()=>setLiquidacion(l=>({...l,sociosCCMap:{...l.sociosCCMap,[s.id]:""},sociosBuscar:{...l.sociosBuscar,[s.id]:""}}))}
                                      style={{padding:"2px 6px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#9ca3af",cursor:"pointer",fontSize:9}}>✕</button>}
                                  </div>
                                  {busq&&filtrados.length>0&&(
                                    <div style={{position:"absolute",left:0,right:0,background:"#111",border:"1px solid #1f2937",borderRadius:6,zIndex:200,maxHeight:120,overflowY:"auto",marginTop:2}}>
                                      {filtrados.map(cl=>(
                                        <div key={cl.id} onClick={()=>setLiquidacion(l=>({...l,sociosCCMap:{...l.sociosCCMap,[s.id]:String(cl.id)},sociosBuscar:{...l.sociosBuscar,[s.id]:""}}))}
                                          style={{padding:"6px 10px",cursor:"pointer",fontSize:10,color:"#e2e8f0",borderBottom:"1px solid #1a1a1a"}}>
                                          {cl.nombre} {cl.apellido}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Boton confirmar */}
                        <div style={{display:"flex",gap:8,marginBottom:8}}>
                          <button onClick={()=>{
                            // Generar PDF de la liquidacion
                            const distribRows=socios.map((s,i)=>{
                              const pct=total?parse(s.monto)/total:0;
                              const parte=gananciaNeta>0?gananciaNeta*pct:0;
                              return `<tr><td>${s.nombre}</td><td style="text-align:right">${(pct*100).toFixed(1)}%</td><td style="text-align:right;color:#16a34a;font-weight:700">${fmtUSD(parte)}</td></tr>`;
                            }).join("");
                            const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Liquidacion ${hoy}</title><style>
                              body{font-family:Arial,sans-serif;font-size:13px;color:#111;margin:40px;max-width:600px;}
                              h1{font-size:20px;margin-bottom:4px;}h2{font-size:13px;color:#555;margin-top:24px;margin-bottom:8px;border-bottom:2px solid #eee;padding-bottom:4px;}
                              table{width:100%;border-collapse:collapse;margin-bottom:12px;}
                              th{background:#f5f5f5;text-align:left;padding:7px 10px;font-size:11px;border-bottom:2px solid #ddd;}
                              td{padding:6px 10px;border-bottom:1px solid #eee;}
                              .total{font-weight:700;font-size:14px;}.green{color:#16a34a;font-weight:700;}.red{color:#dc2626;font-weight:700;}
                              .footer{margin-top:40px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:8px;}
                            </style></head><body>
                            <h1>Liquidacion Mensual — STS</h1>
                            <p style="color:#666;font-size:12px">${fechaLarga}</p>
                            <h2>RESUMEN PATRIMONIAL</h2>
                            <table><tr><td>Patrimonio final</td><td style="text-align:right" class="green">${fmtUSD(patrimonioFinal)}</td></tr>
                            <tr><td>Inversion socios</td><td style="text-align:right">${fmtUSD(inversionTotal)}</td></tr>
                            <tr><td class="total">Ganancia bruta</td><td style="text-align:right" class="${gananciaBruta>-1?"green":"red"} total">${fmtUSD(gananciaBruta)}</td></tr></table>
                            <h2>DISTRIBUCION</h2>
                            <table>${empleadosCalc.map(emp=>`<tr><td>${emp.nombre}</td><td style="text-align:right">${emp.tieneVariable?"Fijo: "+fmtUSD(emp.fijo)+" + Var "+emp.pctVariable+"%: "+fmtUSD(emp.variable):"Fijo: "+fmtUSD(emp.fijo)}</td><td style="text-align:right;font-weight:700">${fmtUSD(emp.total)}</td></tr>`).join("")}<tr><td><strong>Total empleados</strong></td><td></td><td style="text-align:right;font-weight:700">${fmtUSD(totalEmpleado)}</td></tr>
                            <tr><td>Fondo reserva STS (${liquidacion.pctReserva}%)</td><td></td><td style="text-align:right;font-weight:700">${fmtUSD(reserva)}</td></tr>
                            <tr><td class="total">Ganancia neta socios</td><td></td><td style="text-align:right" class="${gananciaNeta>-1?"green":"red"} total">${fmtUSD(gananciaNeta)}</td></tr></table>
                            <h2>POR SOCIO</h2>
                            <table><thead><tr><th>Socio</th><th style="text-align:right">%</th><th style="text-align:right">Corresponde</th></tr></thead><tbody>${distribRows}</tbody></table>
                            <div class="footer">Generado por STS · ${hoy}</div>
                            </body></html>`;
                            const w=window.open("","_blank"); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500);
                          }} style={{flex:1,padding:10,borderRadius:7,background:"rgba(99,102,241,0.08)",border:"1px solid #6366f133",color:"#a5b4fc",fontFamily:"inherit",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                            📄 Ver PDF
                          </button>
                        </div>
                        <button onClick={async()=>{
                          if(!window.confirm("Confirmar liquidacion? Se registraran los movimientos en las CCs de socios y empleado.")) return;
                          const fechaLiq=liquidacion.fechaImpacto||hoy;
                          const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
                          const movimientosIds=[];
                          // 1. Sueldos empleados
                          for(const emp of empleadosCalc){
                            if(emp.total<=0) continue;
                            const notaEmp="Liquidacion mensual "+hoy+" - "+emp.nombre+" - Sueldo "+fmtUSD(emp.total)+(emp.tieneVariable?" (Fijo "+fmtUSD(emp.fijo)+" + Variable "+fmtUSD(emp.variable)+")":"");
                            if(emp.ccId){
                              const cEmpId=Number(emp.ccId);
                              const {data:mvEmpIns}=await SB.from("movimientos_cc").insert({cliente_id:cEmpId,hora,fecha:fechaLiq,tipo:"ingreso_transf",moneda:"USD",monto:emp.total,nota:notaEmp}).select().single();
                              const mvEmp={id:mvEmpIns?.id||Date.now(),hora,fecha:fechaLiq,tipo:"ingreso_transf",moneda:"USD",monto:emp.total,nota:notaEmp};
                              movimientosIds.push({tipo:"cc",id:mvEmpIns?.id,clienteId:cEmpId});
                              setClientes(p=>p.map(cl=>cl.id!==cEmpId?cl:{...cl,movimientos:[...cl.movimientos,mvEmp]}));
                            } else {
                              const g={categoria:"Sueldo",monto:emp.total,moneda:"USD",nota:notaEmp,fecha:hoy};
                              const {data:ins}=await SB.from("gastos").insert(g).select().single();
                              if(ins){ setGastos(p=>[ins,...p]); movimientosIds.push({tipo:"gasto",id:ins.id}); }
                              const ns=await leerSaldoFresco(); ns.USD=(ns.USD||0)-emp.total;
                              setSaldos(ns); await guardarDia(ns,null,null);
                            }
                          }
                          // 2. Acreditar ganancia en CC de cada socio (usando el mapa CC seleccionado)
                          const detalle=socios.map(s=>{
                            const pct=total?parse(s.monto)/total:0;
                            const parte=gananciaNeta>0?gananciaNeta*pct:0;
                            return {nombre:s.nombre,pct:(pct*100).toFixed(1),parte};
                          });
                          for(const s of socios){
                            const pct=total?parse(s.monto)/total:0;
                            const parte=gananciaNeta>0?gananciaNeta*pct:0;
                            if(parte<=0) continue;
                            const ccId=Number(liquidacion.sociosCCMap[s.id]);
                            if(!ccId) continue; // si no eligio CC, no acreditar
                            const nota="Liquidacion mensual "+hoy+" - Ganancia "+fmtUSD(parte);
                            const mvHora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
                            const {data:mvIns}=await SB.from("movimientos_cc").insert({cliente_id:ccId,hora:mvHora,fecha:fechaLiq,tipo:"ingreso_transf",moneda:"USD",monto:parte,nota}).select().single();
                            const mv={id:mvIns?.id||Date.now()+ccId,hora:mvHora,fecha:fechaLiq,tipo:"ingreso_transf",moneda:"USD",monto:parte,nota};
                            movimientosIds.push({tipo:"cc",id:mvIns?.id,clienteId:ccId});
                            setClientes(p=>p.map(cl=>cl.id!==ccId?cl:{...cl,movimientos:[...cl.movimientos,mv]}));
                          }
                          // 3. Guardar historial de liquidacion
                          const liq={fecha:fechaLiq,periodo:liquidacion.periodo||fechaLiq.slice(0,7),patrimonio_final:patrimonioFinal,inversion_socios:inversionTotal,ganancia_bruta:gananciaBruta,sueldo_empleado:totalEmpleado,reserva,ganancia_neta:gananciaNeta,detalle,movimientos_ids:movimientosIds};
                          const {data:liqIns}=await SB.from("liquidaciones").insert(liq).select().single();
                          if(liqIns) setLiquidaciones(p=>[liqIns,...p]);
                          notify("Liquidacion confirmada ✓");
                          setLiquidacion(l=>({...l,mostrando:false,patrimonioManual:"",sociosCCMap:{},sociosBuscar:{},periodo:"",fechaImpacto:"",empleados:l.empleados.map(e=>({...e,sueldoFijo:"",cotizSueldo:"",ccId:"",ccBuscar:""}))}));
                        }} disabled={gananciaBruta<=0}
                          style={{width:"100%",padding:12,borderRadius:8,background:gananciaBruta>0?"rgba(99,102,241,0.15)":"#0a0a0a",border:"1px solid "+(gananciaBruta>0?"#6366f1":"#1f2937"),color:gananciaBruta>0?"#a5b4fc":"#374151",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:gananciaBruta>0?"pointer":"not-allowed",letterSpacing:1}}>
                          CONFIRMAR LIQUIDACION
                        </button>
                      </Card>
                    )}
                    {/* Historial de liquidaciones */}
                    {liquidaciones.length>0&&(
                      <Card sx={{marginTop:14,border:"1px solid rgba(255,255,255,0.06)"}}>
                        <div style={{fontSize:10,letterSpacing:2,color:"#9ca3af",marginBottom:12}}>HISTORIAL DE LIQUIDACIONES</div>
                        {liquidaciones.map(liq=>(
                          <div key={liq.id} style={{borderBottom:"1px solid #1a1a1a",padding:"10px 0"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                              <div>
                              <span style={{fontSize:12,fontWeight:700,color:"#e2e8f0"}}>{fmtFecha(liq.fecha)}</span>
                              {liq.periodo&&liq.periodo!==liq.fecha?.slice(0,7)&&(
                                <span style={{marginLeft:8,fontSize:10,padding:"1px 6px",borderRadius:4,background:"rgba(99,102,241,0.15)",color:"#a5b4fc"}}>
                                  periodo: {new Date(liq.periodo+"-01").toLocaleDateString("es-AR",{month:"long",year:"numeric"})}
                                </span>
                              )}
                            </div>
                              <span style={{fontSize:12,fontWeight:700,color:liq.ganancia_neta>-1?"#4ade80":"#f87171"}}>Neto: {fmtUSD(liq.ganancia_neta)}</span>
                            </div>
                            <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:10,color:"#9ca3af"}}>
                              <span>Patrimonio: <strong style={{color:"#9ca3af"}}>{fmtUSD(liq.patrimonio_final)}</strong></span>
                              <span>Ganancia bruta: <strong style={{color:"#9ca3af"}}>{fmtUSD(liq.ganancia_bruta)}</strong></span>
                              <span>Empleado: <strong style={{color:"#f59e0b"}}>{fmtUSD(liq.sueldo_empleado)}</strong></span>
                              <span>Reserva: <strong style={{color:"#c084fc"}}>{fmtUSD(liq.reserva)}</strong></span>
                            </div>
                            {liq.detalle&&liq.detalle.length>0&&(
                              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
                                {liq.detalle.map((d,i)=>(
                                  <span key={i} style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:"rgba(74,222,128,0.08)",color:"#4ade80"}}>
                                    {d.nombre}: {fmtUSD(d.parte)}
                                  </span>
                                ))}
                              </div>
                            )}
                            <button onClick={async()=>{
                              if(!window.confirm("Revertir esta liquidacion? Se borraran los movimientos de CC y gastos generados.")) return;
                              // Borrar movimientos CC y gastos
                              const ids=liq.movimientos_ids||[];
                              for(const m of ids){
                                if(m.tipo==="cc"){
                                  await SB.from("movimientos_cc").delete().eq("id",m.id);
                                  setClientes(p=>p.map(cl=>cl.id!==m.clienteId?cl:{...cl,movimientos:cl.movimientos.filter(mv=>mv.id!==m.id)}));
                                } else if(m.tipo==="gasto"){
                                  await SB.from("gastos").delete().eq("id",m.id);
                                  setGastos(p=>p.filter(g=>g.id!==m.id));
                                }
                              }
                              await SB.from("liquidaciones").delete().eq("id",liq.id);
                              setLiquidaciones(p=>p.filter(x=>x.id!==liq.id));
                              notify("Liquidacion revertida ✓");
                            }} style={{marginTop:8,padding:"4px 10px",borderRadius:5,background:"rgba(244,63,94,0.08)",border:"1px solid #f43f5e44",color:"#f87171",fontFamily:"inherit",fontSize:10,cursor:"pointer"}}>
                              Revertir
                            </button>
                          </div>
                        ))}
                      </Card>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {pant==="analisis"&&<PantallaAnalisis/>}

        {pant==="cotizaciones"&&<PantallaCotizaciones/>}

        {pant==="pnl"&&<PantallaPnl pnlData={pnlData}/>}
        {pant==="recaudadora"&&<PantallaRecaudadora recaudTransf={recaudTransf} setRecaudTransf={setRecaudTransf} clientes={clientes} hoy={hoy} SB={SB} notify={notify}/>}

      </main>
    </div>
  );
}

export default function CajaFinanciera() {
  const [usuario, setUsuario] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(()=>{
    SB.auth.getSession().then(({data:{session}})=>{
      setUsuario(session?.user||null);
      setCheckingAuth(false);
    });
    const {data:{subscription}} = SB.auth.onAuthStateChange((_,session)=>{
      setUsuario(session?.user||null);
    });
    return ()=>subscription.unsubscribe();
  },[]);

  if (checkingAuth) return (
    <div style={{minHeight:"100vh",background:"#07090f",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg,#6366f1,#34d399)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"#fff",margin:"0 auto 16px",fontFamily:"'JetBrains Mono',monospace"}}>S</div>
        <div style={{color:"#334155",fontSize:12}}>Verificando sesion...</div>
      </div>
    </div>
  );

  if (!usuario) return <LoginScreen onLogin={()=>{}} />;
  return <AppInterna usuario={usuario} />;
}
