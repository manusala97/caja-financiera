import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
  ajuste:             { label:"Ajuste",               icon:"A", color:"#6b7280" },
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
// Siempre usar horario Argentina (UTC-3)
const ahoraAR = new Date(new Date().toLocaleString("en-US", {timeZone:"America/Argentina/Buenos_Aires"}));
const hoy = ahoraAR.getFullYear()+"-"+String(ahoraAR.getMonth()+1).padStart(2,"0")+"-"+String(ahoraAR.getDate()).padStart(2,"0");
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
  lbl:   { display:"block", fontSize:10, letterSpacing:1.5, color:"#475569", textTransform:"uppercase", marginBottom:5, fontWeight:600 },
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

function LineChart({ data, color="#4ade80", height=100 }) {
  if (!data||data.length<2) return <div style={{height,display:"flex",alignItems:"center",justifyContent:"center",color:"#374151",fontSize:11}}>Sin datos suficientes</div>;
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
      const tn=parse(f.tn),tpct=parse(f.tpct); if (!tn||!tpct) return null;
      return {tipo:t,hora,tn,tpct,tcom:tn*tpct/100,monto:tn*tpct/100,cliente:f.cliente,nota:f.nota};
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
            <div><Lbl>Fecha acreditacion</Lbl><Inp type="date" value={f.dfa} onChange={e=>sf("dfa",e.target.value)}/></div>
            <div style={{display:"flex",alignItems:"flex-end",paddingBottom:6}}><span style={{fontSize:11,color:"#6b7280"}}>{calcDif?.dias||0}d</span></div>
          </div>
          {calcDif&&<div style={{marginTop:8,background:"#0a0a0a",border:"1px solid #c084fc33",borderRadius:8,padding:10,...S.grid("1fr 1fr 1fr 1fr",8),fontSize:11}}>
            {[["Post-gest.",fmt(calcDif.postG),"#9ca3af"],["Tasa",calcDif.tasaD.toFixed(2)+"%","#9ca3af"],["Pagas",fmt(calcDif.mFinal),"#f87171"],["Ganancia",fmt(calcDif.ganancia),"#4ade80"]].map(([k,v,c])=>(
              <div key={k}><div style={{color:"#4b5563",marginBottom:2}}>{k}</div><div style={{color:c,fontWeight:700}}>${v}</div></div>
            ))}
          </div>}
        </div>
      )}
      {f.tipo==="transferencia"&&(
        <div style={S.grid("1fr 1fr",8)}>
          <div><Lbl>Monto</Lbl><Inp type="number" value={f.tn} onChange={e=>sf("tn",e.target.value)}/></div>
          <div><Lbl>Comision %</Lbl><Inp type="number" value={f.tpct} onChange={e=>sf("tpct",e.target.value)}/></div>
          {f.tn&&f.tpct&&<div style={{gridColumn:"1/-1",background:"#0a1a0a",border:"1px solid #22c55e33",borderRadius:6,padding:"8px 10px",fontSize:12}}>
            Ingresa: <strong style={{color:"#4ade80"}}>${fmt(parse(f.tn)*parse(f.tpct)/100)}</strong>
          </div>}
        </div>
      )}
      <div style={{marginTop:10,...S.grid("1fr 1fr",8)}}>
        <div><Lbl>Cliente</Lbl><Inp placeholder="(opcional)" value={f.cliente} onChange={e=>sf("cliente",e.target.value)}/></div>
        <div><Lbl>Nota</Lbl><Inp placeholder="..." value={f.nota} onChange={e=>sf("nota",e.target.value)}/></div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <button onClick={()=>{const d=construir();if(d)onGuardar(d);}} style={{flex:1,padding:11,borderRadius:7,background:"#0a0a0a",border:"1px solid "+color,color,fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>GUARDAR</button>
        {onCancelar&&<button onClick={onCancelar} style={{padding:"11px 16px",borderRadius:7,background:"transparent",border:"1px solid #1f2937",color:"#4b5563",fontFamily:"inherit",fontSize:12,cursor:"pointer"}}>Cancelar</button>}
      </div>
    </div>
  );
}

function ModalCierre({ saldos, clientes, diferidos, saldoCC, onCerrar, onCancelar, ultimaCotiz={} }) {
  const [cotiz, setCotiz] = useState({ ARS:ultimaCotiz.ARS||"", BRL:ultimaCotiz.BRL||"", GBP:ultimaCotiz.GBP||"", EUR:ultimaCotiz.EUR||"", USDT:"1" });
  const sc = (k,v) => setCotiz(c=>({...c,[k]:v}));
  // Calcular patrimonio total = caja fisica + CCs + cheques a cobrar
  const patrimonioTotal = useMemo(()=>{
    if (!parse(cotiz.ARS)) return null;
    const tots=Object.fromEntries(["USD","ARS","BRL","GBP","EUR","USDT"].map(mId=>[mId,(clientes||[]).reduce((s,cl)=>s+(saldoCC?saldoCC(cl)[mId]:0),0)]));
    const difPend=(diferidos||[]).filter(d=>!d.cobrado);
    const totalDif=difPend.reduce((s,d)=>s+(d.mFinal||d.nominal),0);
    const patrimonioSaldos=Object.fromEntries(["USD","ARS","BRL","GBP","EUR","USDT"].map(mId=>[mId,(saldos[mId]||0)+tots[mId]+(mId==="ARS"?totalDif:0)]));
    return {
      totalUSD: calcTotalUSD(patrimonioSaldos, cotiz),
      cajaUSD: calcTotalUSD(saldos, cotiz),
      saldosPatrimonio: patrimonioSaldos,
      totalDif,
      tots,
    };
  },[saldos,cotiz,clientes,diferidos]);
  const totalUSD = patrimonioTotal?.totalUSD||null;
  const monCotiz = MONEDAS.filter(m=>m.id!=="USD");
  return (
    <div style={{position:"fixed",inset:0,background:"#000000dd",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:500,background:"#0d0d0d",border:"1px solid #94a3b833",borderRadius:12,padding:20}}>
        <div style={{fontSize:11,letterSpacing:3,color:"#94a3b8",marginBottom:4}}>CIERRE DE CAJA</div>
        <div style={{fontSize:12,color:"#4b5563",marginBottom:20}}>{fechaLarga}</div>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:9,letterSpacing:2,color:"#4b5563",marginBottom:8}}>SALDOS FINALES</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {MONEDAS.map(m=>{ const v=saldos[m.id]||0; if(!v) return null;
              return <div key={m.id} style={{background:"#111",border:"1px solid "+m.color+"33",borderRadius:6,padding:"5px 10px"}}>
                <span style={{fontSize:9,color:m.color,marginRight:5}}>{m.id}</span>
                <span style={{fontWeight:700}}>{m.simbolo}{fmt(v)}</span>
              </div>;})}
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:9,letterSpacing:2,color:"#4b5563",marginBottom:8}}>COTIZACIONES DE CIERRE</div>
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
          <div style={{marginTop:8,fontSize:10,color:"#374151"}}>* ARS: pesos por USD (ej: 1400) | EUR/GBP/BRL: valor en USD (ej: EUR=1.2, BRL=0.19)</div>
        </div>
        {totalUSD!==null&&patrimonioTotal&&(
          <div style={{marginBottom:16}}>
            <div style={{background:"#0a0a1a",border:"1px solid #6366f133",borderRadius:8,padding:12,marginBottom:8,textAlign:"center"}}>
              <div style={{fontSize:9,letterSpacing:3,color:"#818cf8",marginBottom:4}}>PATRIMONIO TOTAL EN USD</div>
              <div style={{fontSize:28,fontWeight:700,color:"#818cf8"}}>{fmtUSD(totalUSD)}</div>
              <div style={{fontSize:10,color:"#4b5563",marginTop:4}}>caja + cuentas corrientes + cheques</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1,background:"#0a1a0a",border:"1px solid #22c55e33",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"#4b5563",marginBottom:3}}>CAJA FÍSICA</div>
                <div style={{fontSize:16,fontWeight:700,color:"#4ade80"}}>{fmtUSD(patrimonioTotal.cajaUSD)}</div>
              </div>
              <div style={{flex:1,background:"#0a0a1a",border:"1px solid #c084fc33",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"#4b5563",marginBottom:3}}>CCs + CHEQUES</div>
                <div style={{fontSize:16,fontWeight:700,color:"#c084fc"}}>{fmtUSD(totalUSD-patrimonioTotal.cajaUSD)}</div>
              </div>
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>onCerrar(cotiz,totalUSD)} disabled={!parse(cotiz.ARS)}
            style={{flex:1,padding:12,borderRadius:7,background:parse(cotiz.ARS)?"#052e16":"#0a0a0a",border:"1px solid "+(parse(cotiz.ARS)?"#4ade80":"#1f2937"),color:parse(cotiz.ARS)?"#4ade80":"#374151",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:parse(cotiz.ARS)?"pointer":"not-allowed"}}>
            CERRAR CAJA
          </button>
          <button onClick={onCancelar} style={{padding:"12px 16px",borderRadius:7,background:"transparent",border:"1px solid #1f2937",color:"#4b5563",fontFamily:"inherit",fontSize:12,cursor:"pointer"}}>Cancelar</button>
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
    if(!email||!pass) { setError("Completá email y contraseña"); return; }
    setLoading(true); setError("");
    const { error:err } = await SB.auth.signInWithPassword({ email, password:pass });
    if (err) { setError("Email o contraseña incorrectos"); setLoading(false); }
    else { onLogin(); }
  }

  return (
    <div style={{minHeight:"100vh",background:"#07090f",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#6366f1,#34d399)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,color:"#fff",margin:"0 auto 16px",fontFamily:"'JetBrains Mono',monospace",boxShadow:"0 8px 32px rgba(99,102,241,0.4)"}}>S</div>
          <div style={{fontSize:20,fontWeight:700,color:"#e2e8f0",fontFamily:"'JetBrains Mono',monospace"}}>STS FINANCIERA</div>
          <div style={{fontSize:12,color:"#475569",marginTop:4}}>Ingresá tus credenciales para continuar</div>
        </div>
        <form onSubmit={handleLogin} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:28}}>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:10,letterSpacing:1.5,color:"#475569",textTransform:"uppercase",marginBottom:6,fontWeight:600}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="tu@email.com" autoComplete="email"
              style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"11px 14px",color:"#e2e8f0",fontFamily:"inherit",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{display:"block",fontSize:10,letterSpacing:1.5,color:"#475569",textTransform:"uppercase",marginBottom:6,fontWeight:600}}>Contraseña</label>
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
  const [form, setForm] = useState({ tipo:"compra", moneda:"USD", monto:"", moneda2:"ARS", monto2:"", cotizacion:"", cliente:"", nota:"", cn:"", cpct:"", dn:"", dtm:"58", dtg:"2.5", dfr:hoy, dfa:"", tn:"", tpct:"" });
  const [formCC, setFormCC] = useState({ tipo:"ingreso_transf", moneda:"ARS", monto:"", nota:"", impactaCaja:true });
  const [trade, setTrade] = useState({ modo:"spread_pct", dir:"vendo_base", mBase:"USDT", mQuote:"USD", cant:"", pp:"", po:"", prp:"", pro:"", cCant:"", cPm:"", cPc:"", cCot:"" });
  const [mobileMenu, setMobileMenu] = useState(false);
  const [ultimaCotiz, setUltimaCotiz] = useState({ARS:"",BRL:"",GBP:"",EUR:"",USDT:"1"});
  const [gastos, setGastos] = useState([]);
  const [formGasto, setFormGasto] = useState({categoria:"Alquiler",monto:"",moneda:"ARS",nota:"",fecha:hoy});
  const CATS_GASTO=["Alquiler","Expensas","Luz","Internet","Sueldos","Impuestos","Otros"];
  const [socios, setSocios] = useState([]);
  const [nuevoSocio, setNuevoSocio] = useState({nombre:"",monto:""});
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
  const [filtroOps, setFiltroOps] = useState("todas");
  const [dragOverId, setDragOverId] = useState(null);
  const dragSrcId = useRef(null);
  const [desglose, setDesglose] = useState([]); // [{id, tipo:"efectivo"|clienteId, monto:"", impactaCaja:true}]
  const [mostrarDesglose, setMostrarDesglose] = useState(false);
  const [exportCC, setExportCC] = useState({desde:"",hasta:"",mostrando:false}); // "todas" | "ops" | "ajustes"
  const [editMovV, setEditMovV] = useState({monto:"",nota:"",tipo:"",moneda:"ARS"});
  const SOCIOS_FIJOS=["Manuel Sala","Gonzalo Spadafora","Matias Speranza","STS"];

  const notify = useCallback((msg,ok=true)=>{ setToast({msg,ok}); setTimeout(()=>setToast(null),2800); },[]);
  const setF = useCallback((k,v)=>setForm(f=>({...f,[k]:v})),[]);

  useEffect(()=>{
    async function cargar() {
      try {
        // Asegurar sesion activa antes de cargar datos
        const {data:{session}} = await SB.auth.getSession();
        if (!session) { setCargando(false); return; }
        // Dia de hoy - schema: id=fecha, caja_ini jsonb, abierta bool
        const {data:dia} = await SB.from("dias").select("*").eq("id",hoy).single();
        if (dia) {
          // Dia de hoy ya existe
          setDiaId(dia.id);
          const ci = dia.caja_ini || {};
          setCajaIni(Object.fromEntries(MONEDAS.map(m=>[m.id, ci[m.id]||""])));
          const sf = ci._saldos_finales;
          if (sf) { setSaldos(sf); setPant("home"); }
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
          fechaCobro:d.fecha_cobro||"", tasaEndoso:d.tasa_endoso||""
        })));
        // Clientes + movimientos - movimientos_cc tiene columnas propias
        const {data:cls} = await SB.from("clientes").select("*");
        const {data:movs} = await SB.from("movimientos_cc").select("*");
        if (cls) setClientes(cls.sort((a,b)=>(a.orden||0)-(b.orden||0)).map(c=>({
          id:c.id, nombre:c.nombre, apellido:c.apellido, socio:c.socio,
          movimientos:(movs||[]).filter(m=>Number(m.cliente_id)===Number(c.id)).map(m=>({
            id:m.id, hora:m.hora, fecha:m.fecha, tipo:m.tipo,
            moneda:m.moneda, monto:Number(m.monto), nota:m.nota
          }))
        })));
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
        // Cierres
        const {data:ciData} = await SB.from("cierres").select("*").order("fecha",{ascending:true});
        if (ciData) setCierres(ciData);
        // Pre-cargar ultima cotizacion del ultimo cierre
        if (ciData&&ciData.length>0) {
          const ult=ciData[ciData.length-1];
          if (ult.cotizaciones) setUltimaCotiz(prev=>({...prev,...ult.cotizaciones}));
        }
        const {data:ciHoy,error:ciHoyErr} = await SB.from("cierres").select("id").eq("fecha",hoy).single();
        if (ciHoy&&!ciHoyErr) setCajaCerrada(true);
      } catch(e) { console.error("Error carga:",e); }
      setCargando(false);
    }
    cargar();
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

  async function ejecutarCierre(cotiz, totalUSD) {
    const opsHoy=ops.filter(o=>o.fecha===hoy);
    const resumen=Object.fromEntries(Object.entries(TIPOS_OP).map(([id])=>[id,opsHoy.filter(o=>o.tipo===id).length]));
    const cierre={fecha:hoy,saldos_finales:saldos,saldos_iniciales:cajaIni,cotizaciones:cotiz,total_usd:totalUSD,ops_resumen:resumen};
    await SB.from("cierres").upsert(cierre,{onConflict:"fecha"});
    setCierres(p=>{const sin=p.filter(c=>c.fecha!==hoy);return [...sin,cierre].sort((a,b)=>a.fecha.localeCompare(b.fecha));});
    setCajaCerrada(true); setShowModalCierre(false);
    notify("Caja cerrada correctamente");
  }

  async function abrirCaja() {
    const s=Object.fromEntries(MONEDAS.map(m=>[m.id,parse(cajaIni[m.id])]));
    setSaldos(s);
    const cajaData = {...Object.fromEntries(MONEDAS.map(m=>[m.id,cajaIni[m.id]])), _saldos_finales:s};
    await SB.from("dias").upsert({id:hoy, caja_ini:cajaData, abierta:true},{onConflict:"id"});
    setPant("home"); notify("Caja abierta ✓");
  }

  async function registrarOp() {
    if (cajaCerrada) { notify("La caja esta cerrada",false); return; }
    const {tipo}=form;
    const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    let opData=null, ns={...saldos};
    if (tipo==="compra"||tipo==="venta") {
      const m=parse(form.monto),m2=parse(form.monto2);
      if (!m||!m2) { notify("Ingresa montos validos",false); return; }
      // Validar desglose si está activo
      if (mostrarDesglose&&desglose.length>0) {
        const asignado=desglose.reduce((s,d)=>s+parse(d.monto),0);
        if (Math.abs(asignado-m2)>1) { notify("El desglose no cuadra con el total",false); return; }
      }
      // Impacto en caja base (moneda principal)
      tipo==="compra"?(ns[form.moneda]+=m):(ns[form.moneda]-=m);
      // Si hay desglose, procesar cada línea para la moneda2
      // Si no hay desglose, impacto normal en caja
      if (mostrarDesglose&&desglose.length>0) {
        for (const d of desglose) {
          const dm=parse(d.monto); if(!dm) continue;
          if (d.tipo==="efectivo") {
            // Efectivo siempre impacta caja
            tipo==="compra"?ns[form.moneda2]-=dm:ns[form.moneda2]+=dm;
          } else {
            // Cliente CC
            const cId=Number(d.tipo);
            const cliente=clientes.find(cl=>cl.id===cId);
            if(!cliente) continue;
            // Venta de USD: cliente me transfiere ARS → él me debe (retiro_transf = yo le mandé, positivo para mí)
            // Compra de USD: yo/tercero le manda ARS → le debo (ingreso_transf = recibí plata, negativo para mí)
            const tipoMov=tipo==="venta"?"retiro_transf":"ingreso_transf";
            const horaCC=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
            const mv={id:Date.now()+cId,hora:horaCC,fecha:hoy,tipo:tipoMov,moneda:form.moneda2,monto:dm,nota:form.nota||""};
            await SB.from("movimientos_cc").insert({cliente_id:cId,hora:mv.hora,fecha:mv.fecha,tipo:mv.tipo,moneda:mv.moneda,monto:mv.monto,nota:mv.nota});
            setClientes(p=>p.map(cl=>cl.id!==cId?cl:{...cl,movimientos:[...cl.movimientos,mv]}));
            if (d.impactaCaja) {
              tipo==="compra"?ns[form.moneda2]-=dm:ns[form.moneda2]+=dm;
            }
          }
        }
      } else {
        tipo==="compra"?ns[form.moneda2]-=m2:ns[form.moneda2]+=m2;
      }
      opData={tipo,hora,moneda:form.moneda,monto:m,moneda2:form.moneda2,monto2:m2,cotizacion:parse(form.cotizacion),cliente:form.cliente,nota:form.nota};
      setF("monto",""); setF("monto2",""); setF("cotizacion","");
      setDesglose([]); setMostrarDesglose(false);
    } else if (tipo==="cheque_dia") {
      const cn=parse(form.cn),cpct=parse(form.cpct);
      if (!cn||!cpct) { notify("Ingresa nominal y %",false); return; }
      ns.ARS+=cn;
      opData={tipo,hora,cn,cpct,ccom:cn*cpct/100,monto:cn,cliente:form.cliente,nota:form.nota};
      setF("cn",""); setF("cpct","");
    } else if (tipo==="cheque_dif") {
      if (!calcDif) { notify("Completa todos los campos",false); return; }
      ns.ARS-=calcDif.mFinal;
      const dif={id:Date.now(),hora,fecha:hoy,cliente:form.cliente,nominal:calcDif.n,mFinal:calcDif.mFinal,ganancia:calcDif.ganancia,fechaAcr:form.dfa,tm:parse(form.dtm),dias:calcDif.dias,cobrado:false};
      const {data:difIns}=await SB.from("diferidos").insert({hora:dif.hora,fecha:dif.fecha,cliente:dif.cliente||"",nominal:dif.nominal,m_final:dif.mFinal,ganancia:dif.ganancia,fecha_acr:dif.fechaAcr,tm:dif.tm,dias:dif.dias,cobrado:false,fecha_cobro:"",tasa_endoso:""}).select().single();
      if(difIns) dif.id=difIns.id;
      setDiferidos(d=>[...d,dif]);
      opData={tipo,hora,dn:calcDif.n,montoFinal:calcDif.mFinal,dfa:form.dfa,monto:calcDif.mFinal,cliente:form.cliente,nota:form.nota};
      setF("dn",""); setF("dfa","");
    } else if (tipo==="transferencia") {
      const tn=parse(form.tn),tpct=parse(form.tpct);
      if (!tn||!tpct) { notify("Ingresa monto y %",false); return; }
      ns.ARS+=tn*tpct/100;
      opData={tipo,hora,tn,tpct,tcom:tn*tpct/100,monto:tn*tpct/100,cliente:form.cliente,nota:form.nota};
      setF("tn",""); setF("tpct","");
    }
    if (!opData) return;
    setSaldos(ns);
    const {data:ins}=await SB.from("operaciones").insert({dia_id:hoy,fecha:hoy,hora,tipo,datos:opData}).select().single();
    if (ins) setOps(p=>[...p,{...opData,id:ins.id,fecha:hoy}]);
    await guardarDia(ns,null,null);
    notify("Registrado"); setF("cliente",""); setF("nota","");
  }

  async function guardarEdicionOp(opOriginal, datosNuevos) {
    const act={...opOriginal,...datosNuevos,id:opOriginal.id,fecha:opOriginal.fecha};
    await SB.from("operaciones").update({hora:datosNuevos.hora,tipo:datosNuevos.tipo,datos:act}).eq("id",opOriginal.id);
    setOps(p=>p.map(o=>o.id!==opOriginal.id?o:act));
    setEditandoOp(null); notify("Operacion editada");
  }

  async function eliminarOpHoy(op) {
    if (!window.confirm("Eliminar esta operacion? El saldo se va a revertir.")) return;
    // Revertir el impacto en saldos
    const ns={...saldos};
    const t=op.tipo;
    if (t==="compra")    { ns[op.moneda]-=op.monto; ns[op.moneda2]+=op.monto2; }
    else if (t==="venta"){ ns[op.moneda]+=op.monto; ns[op.moneda2]-=op.monto2; }
    else if (t==="cheque_dia") { ns.ARS-=op.cn; }
    else if (t==="cheque_dif") { ns.ARS+=op.montoFinal||op.monto; }
    else if (t==="transferencia") { ns.ARS-=op.tcom||op.monto; }
    else if (t==="ajuste") { ns[op.moneda]-=op.delta; }
    else if (t==="cobro_dif") { ns[op.moneda]-=op.monto; }
    // cc_ingreso/retiro no impactan saldo fisico
    setSaldos(ns);
    await SB.from("operaciones").delete().eq("id",op.id);
    setOps(p=>p.filter(o=>o.id!==op.id));
    await guardarDia(ns,null,null);
    notify("Eliminada y saldo revertido");
  }

  async function cobrarDif(id) {
    const d=diferidos.find(x=>x.id===id); if(!d) return;
    const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    const ns={...saldos,ARS:saldos.ARS+d.nominal};
    setSaldos(ns);
    await SB.from("diferidos").update({cobrado:true}).eq("id",id);
    setDiferidos(p=>p.map(x=>x.id===id?{...x,cobrado:true}:x));
    const opData={tipo:"cobro_dif",hora,moneda:"ARS",monto:d.nominal,cliente:d.cliente,nota:"Cobro diferido $"+fmt(d.nominal)+(d.manual?" (manual)":"")};
    const {data:ins}=await SB.from("operaciones").insert({dia_id:hoy,fecha:hoy,hora,tipo:"cobro_dif",datos:opData}).select().single();
    if (ins) setOps(p=>[...p,{...opData,id:ins.id,fecha:hoy}]);
    await guardarDia(ns,null,null); notify("Cobrado");
  }

  async function confirmarEditSaldo(mon) {
    const nv=parse(editSaldoV),delta=nv-saldos[mon];
    const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    const ns={...saldos,[mon]:nv}; setSaldos(ns);
    const opData={tipo:"ajuste",hora,moneda:mon,monto:Math.abs(delta),delta,nota:"Ajuste "+(delta>=0?"+":"")+fmt(delta)+" "+mon};
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
      const ns={...saldos,[formCC.moneda]:saldos[formCC.moneda]+(ing?monto:-monto)};
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
    const t=TIPOS_OP[op.tipo]||{label:op.tipo,icon:".",color:"#6b7280"};
    const m=MONEDAS.find(x=>x.id===op.moneda);
    return (
      <div key={op.id} className="op-row" style={{borderBottom:"1px solid rgba(255,255,255,0.04)",padding:"8px 10px 8px 14px",display:"flex",gap:8,alignItems:"flex-start",borderLeft:"2px solid "+t.color+"55",marginBottom:2,borderRadius:"0 8px 8px 0"}}>
        <span style={{color:t.color,fontSize:13,marginTop:1,width:14}}>{t.icon}</span>
        <div style={{flex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
            <span style={{fontSize:11,color:t.color,fontWeight:700}}>{t.label}</span>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              <span style={{fontSize:10,color:"#4b5563"}}>{op.hora}</span>
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
          {(op.cliente||op.nota)&&<div style={{fontSize:11,color:"#4b5563",marginTop:1}}>{op.cliente?"👤 "+op.cliente:""}{op.cliente&&op.nota?" - ":""}{op.nota||""}</div>}
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
    {id:"trade",label:"Trade",c:"#f43f5e"},
    {id:"posicion",label:"Posicion",c:"#e879f9"},
    {id:"historial",label:"Historial",c:"#fb923c"},
    {id:"evolucion",label:"Evolucion USD",c:"#4ade80"},
    {id:"resumen_socios",label:"Por socio",c:"#34d399"},
    {id:"gastos",label:"Gastos",c:"#f43f5e"},
    {id:"socios",label:"Socios",c:"#a78bfa"},
    {id:"cierre",label:cajaCerrada?"CERRADO":"Cierre",c:"#94a3b8"},
  ];

  if (cargando) return (
    <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:10,letterSpacing:4,color:"#4ade80",marginBottom:12}}>CAJA FINANCIERA</div>
        <div style={{color:"#374151"}}>Cargando...</div>
      </div>
    </div>
  );

  return (
    <div style={S.app}>
      {toast&&<div style={S.toast(toast.ok)}>{toast.msg}</div>}
      {showModalCierre&&<ModalCierre saldos={saldos} clientes={clientes} diferidos={diferidos} saldoCC={saldoCC} ultimaCotiz={ultimaCotiz} onCerrar={(cotiz,total)=>{setUltimaCotiz(cotiz);ejecutarCierre(cotiz,total);}} onCancelar={()=>setShowModalCierre(false)}/>}
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
            <div style={{fontSize:9,color:"#475569",letterSpacing:2,marginTop:1}}>FINANCIERA</div>
          </div>
        </div>
        <div style={{marginLeft:"auto",paddingRight:8}} className="hide-mobile">
          <button onClick={async()=>{ await SB.auth.signOut(); }} style={{padding:"4px 10px",borderRadius:6,background:"transparent",border:"1px solid rgba(255,255,255,0.08)",color:"#475569",fontFamily:"inherit",fontSize:10,cursor:"pointer"}}>
            {usuario?.email?.split("@")[0]} · salir
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
                <div style={{fontSize:11,color:"#64748b",marginBottom:2,fontFamily:"'JetBrains Mono',monospace"}}>Buenos días —</div>
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
                    <div style={{fontSize:10,color:"#475569",marginTop:4}}>saldo actual</div>
                  </div>
                );})}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12,marginBottom:24}}>
                <div style={{background:"#0f1420",border:"1px solid #3b82f633",borderRadius:12,padding:16,cursor:"pointer"}} onClick={()=>setPant("ops")}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:8,fontWeight:600,letterSpacing:1}}>OPERACIONES HOY</div>
                  <div style={{fontSize:28,fontWeight:700,color:"#3b82f6",fontFamily:"'JetBrains Mono',monospace"}}>{opsHoy.length}</div>
                  <div style={{fontSize:11,color:"#475569",marginTop:4}}>registradas hoy</div>
                </div>
                <div style={{background:"#0f1420",border:"1px solid #c084fc33",borderRadius:12,padding:16,cursor:"pointer"}} onClick={()=>setPant("cartera")}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:8,fontWeight:600,letterSpacing:1}}>CHEQUES A COBRAR</div>
                  <div style={{fontSize:28,fontWeight:700,color:"#c084fc",fontFamily:"'JetBrains Mono',monospace"}}>{difPend.length}</div>
                  <div style={{fontSize:11,color:"#475569",marginTop:4}}>${fmt(totalCheques)} ARS total</div>
                  {(vencHoy>0||vencProx>0)&&<div style={{marginTop:8,fontSize:11,color:"#f59e0b",fontWeight:600}}>⚠ {vencHoy>0?vencHoy+" vencido/s":""}  {vencProx>0?vencProx+" por vencer":""}</div>}
                </div>
                <div style={{background:"#0f1420",border:"1px solid #34d39933",borderRadius:12,padding:16,cursor:"pointer"}} onClick={()=>setPant("posicion")}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:8,fontWeight:600,letterSpacing:1}}>POSICION CC</div>
                  <div style={{fontSize:28,fontWeight:700,color:tots.ARS>=0?"#34d399":"#f87171",fontFamily:"'JetBrains Mono',monospace"}}>{tots.ARS>=0?"+":""}{fmt(tots.ARS)}</div>
                  <div style={{fontSize:11,color:"#475569",marginTop:4}}>ARS neto en CCs</div>
                </div>
                <div style={{background:"#0f1420",border:"1px solid #f59e0b33",borderRadius:12,padding:16,cursor:"pointer"}} onClick={()=>setPant("clientes")}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:8,fontWeight:600,letterSpacing:1}}>CLIENTES</div>
                  <div style={{fontSize:28,fontWeight:700,color:"#f59e0b",fontFamily:"'JetBrains Mono',monospace"}}>{clientes.length}</div>
                  <div style={{fontSize:11,color:"#475569",marginTop:4}}>cuentas corrientes</div>
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
                        <span style={{fontSize:12,fontWeight:700,color:"#475569",fontFamily:"'JetBrains Mono',monospace",minWidth:90}}>{d.fechaAcr}</span>
                        {venc&&<span style={{fontSize:10,fontWeight:700,color:"#f43f5e",background:"#f43f5e15",padding:"2px 7px",borderRadius:4}}>VENCIDO</span>}
                        {urg&&<span style={{fontSize:10,fontWeight:700,color:"#f59e0b",background:"#f59e0b15",padding:"2px 7px",borderRadius:4}}>en {dr}d</span>}
                        {!venc&&!urg&&<span style={{fontSize:10,color:"#334155",background:"#1e2535",padding:"2px 7px",borderRadius:4}}>{dr}d</span>}
                        {d.cliente&&<span style={{fontSize:11,color:"#64748b"}}>👤 {d.cliente}</span>}
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
                <div style={{fontSize:10,color:"#64748b",fontWeight:700,letterSpacing:1,marginBottom:12}}>ÚLTIMAS OPERACIONES</div>
                {opsHoy.length===0&&<div style={{color:"#334155",fontSize:12}}>Sin operaciones hoy</div>}
                {[...opsHoy].reverse().slice(0,5).map(op=>{
                  const t=TIPOS_OP[op.tipo]||{label:op.tipo,color:"#64748b"};
                  return <div key={op.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1e2535",alignItems:"center"}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:t.color,flexShrink:0}}/>
                      <span style={{fontSize:12,color:t.color,fontWeight:600}}>{t.label}</span>
                      {op.cliente&&<span style={{fontSize:11,color:"#475569"}}>{op.cliente}</span>}
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
            <div style={{fontSize:12,color:"#4b5563",marginBottom:20}}>{fechaLarga}</div>
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
              <div style={{fontSize:10,letterSpacing:3,color:"#4b5563",marginBottom:10}}>SALDOS</div>
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
                <div style={{fontSize:10,letterSpacing:3,color:"#4b5563"}}>MOVIMIENTOS HOY ({opsHoy.length})</div>
                <div style={{display:"flex",gap:4}}>
                  {[["todas","Todas"],["ops","Operaciones"],["ajustes","Ajustes"]].map(([v,lbl])=>(
                    <button key={v} onClick={()=>setFiltroOps(v)} style={{padding:"3px 8px",borderRadius:5,background:filtroOps===v?"rgba(255,255,255,0.08)":"transparent",border:"1px solid "+(filtroOps===v?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.05)"),color:filtroOps===v?"#e2e8f0":"#475569",fontFamily:"inherit",fontSize:10,cursor:"pointer"}}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{maxHeight:420,overflowY:"auto"}}>
                {opsHoy.length===0&&<div style={{color:"#374151"}}>Sin operaciones</div>}
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
                              {/* Tipo: efectivo o cliente */}
                              <select value={d.tipo} onChange={e=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,tipo:e.target.value}))}
                                style={{flex:2,minWidth:120,background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"6px 8px",color:"#e2e8f0",fontFamily:"inherit",fontSize:11}}>
                                <option value="efectivo">💵 Efectivo</option>
                                {clientes.map(cl=><option key={cl.id} value={String(cl.id)}>{cl.nombre} {cl.apellido}</option>)}
                              </select>
                              {/* Monto */}
                              <Inp type="number" placeholder="Monto" value={d.monto}
                                onChange={e=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,monto:e.target.value}))}
                                sx={{flex:2,minWidth:100}}/>
                              {/* Impacta caja — solo para clientes */}
                              {d.tipo!=="efectivo"&&(
                                <div onClick={()=>setDesglose(p=>p.map(x=>x.id!==d.id?x:{...x,impactaCaja:!x.impactaCaja}))}
                                  style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",padding:"4px 8px",borderRadius:5,border:"1px solid "+(d.impactaCaja?"#4ade8044":"#1f2937"),background:d.impactaCaja?"rgba(74,222,128,0.05)":"transparent",flexShrink:0}}>
                                  <div style={{width:12,height:12,borderRadius:3,border:"2px solid "+(d.impactaCaja?"#4ade80":"#475569"),background:d.impactaCaja?"#4ade80":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                    {d.impactaCaja&&<span style={{color:"#000",fontSize:8,fontWeight:900,lineHeight:1}}>✓</span>}
                                  </div>
                                  <span style={{fontSize:9,color:d.impactaCaja?"#4ade80":"#475569",whiteSpace:"nowrap"}}>Caja</span>
                                </div>
                              )}
                              {/* Borrar fila */}
                              <button onClick={()=>setDesglose(p=>p.filter(x=>x.id!==d.id))} style={{padding:"4px 8px",borderRadius:5,background:"transparent",border:"1px solid #374151",color:"#f87171",fontFamily:"inherit",fontSize:11,cursor:"pointer",flexShrink:0}}>✕</button>
                            </div>
                          ))}
                          <button onClick={()=>setDesglose(p=>[...p,{id:Date.now(),tipo:"efectivo",monto:"",impactaCaja:true}])}
                            style={{marginTop:4,padding:"5px 12px",borderRadius:5,background:"transparent",border:"1px dashed #374151",color:"#6b7280",fontFamily:"inherit",fontSize:11,cursor:"pointer",width:"100%"}}>
                            + Agregar línea
                          </button>
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
                    <div><Lbl>F. acreditacion</Lbl><Inp type="date" value={form.dfa} onChange={e=>setF("dfa",e.target.value)}/></div>
                    <div style={{display:"flex",alignItems:"flex-end",paddingBottom:6}}><span style={{fontSize:11,color:"#6b7280"}}>{calcDif?.dias||0}d</span></div>
                  </div>
                  {calcDif&&<div style={{marginTop:8,background:"#0a0a0a",borderRadius:8,padding:10,...S.grid("1fr 1fr 1fr 1fr",6),fontSize:11}}>
                    {[["Post-gest.",fmt(calcDif.postG),"#9ca3af"],["Tasa",calcDif.tasaD.toFixed(2)+"%","#9ca3af"],["Pagas",fmt(calcDif.mFinal),"#f87171"],["Ganancia",fmt(calcDif.ganancia),"#4ade80"]].map(([k,v,c])=>(
                      <div key={k}><div style={{color:"#4b5563",marginBottom:2}}>{k}</div><div style={{color:c,fontWeight:700}}>${v}</div></div>
                    ))}
                  </div>}
                </div>)}
                {form.tipo==="transferencia"&&(<div style={S.grid("1fr 1fr",8)}>
                  <div><Lbl>Monto</Lbl><Inp type="number" value={form.tn} onChange={e=>setF("tn",e.target.value)}/></div>
                  <div><Lbl>Comision %</Lbl><Inp type="number" value={form.tpct} onChange={e=>setF("tpct",e.target.value)}/></div>
                  {form.tn&&form.tpct&&<div style={{gridColumn:"1/-1",background:"#0a1a0a",borderRadius:6,padding:"8px",fontSize:12}}>Ingresa: <strong style={{color:"#4ade80"}}>${fmt(parse(form.tn)*parse(form.tpct)/100)}</strong></div>}
                </div>)}
                <div style={{marginTop:10,...S.grid("1fr 1fr",8)}}>
                  <div><Lbl>Cliente</Lbl><Inp placeholder="(opcional)" value={form.cliente} onChange={e=>setF("cliente",e.target.value)}/></div>
                  <div><Lbl>Nota</Lbl><Inp placeholder="..." value={form.nota} onChange={e=>setF("nota",e.target.value)}/></div>
                </div>
                <button onClick={registrarOp} style={{marginTop:12,width:"100%",padding:11,borderRadius:7,background:"#0a1a0a",border:"1px solid #4ade80",color:"#4ade80",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:2}}>REGISTRAR</button>
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

        {pant==="libro"&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#38bdf8",marginBottom:16}}>LIBRO DIARIO - {fechaLarga} - {opsHoy.length} ops</div>
            <Card sx={{marginBottom:14}}>
              <div style={{fontSize:10,letterSpacing:3,color:"#38bdf8",marginBottom:10}}>APERTURA</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {MONEDAS.map(m=>{ const v=parse(cajaIni[m.id]); if(!v) return null;
                  return <div key={m.id} style={{background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"6px 10px"}}>
                    <span style={{fontSize:9,color:m.color,marginRight:6}}>{m.id}</span><span style={{fontWeight:700}}>{m.simbolo}{fmt(v)}</span>
                  </div>;})}
              </div>
            </Card>
            {MONEDAS.map(m=>{ const mv=movPorMoneda[m.id]; if(!mv.ent.length&&!mv.sal.length) return null;
              const tE=mv.ent.reduce((s,o)=>s+(o.monto||0),0),tS=mv.sal.reduce((s,o)=>s+(o.monto||0),0);
              return (
                <Card key={m.id} sx={{marginBottom:10,border:"1px solid "+m.color+"22"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <span style={{fontSize:11,fontWeight:700,color:m.color}}>{m.id}</span>
                    <span style={{fontSize:11,color:"#6b7280"}}>{m.simbolo}{fmt(parse(cajaIni[m.id]))} -&gt; <strong style={{color:"#fff"}}>{fmt(saldos[m.id])}</strong></span>
                  </div>
                  <div style={S.grid("1fr 1fr",10)}>
                    <div><div style={{fontSize:9,color:"#4ade80",marginBottom:5}}>ENTRADAS +{m.simbolo}{fmt(tE)}</div>
                      {mv.ent.map(o=><div key={o.id} style={{fontSize:11,color:"#9ca3af",padding:"2px 0",borderBottom:"1px solid #1a1a1a"}}>{o.hora} - {TIPOS_OP[o.tipo]?.label} - <span style={{color:"#4ade80"}}>{m.simbolo}{fmt(o.monto)}</span></div>)}
                    </div>
                    <div><div style={{fontSize:9,color:"#f87171",marginBottom:5}}>SALIDAS -{m.simbolo}{fmt(tS)}</div>
                      {mv.sal.map(o=><div key={o.id} style={{fontSize:11,color:"#9ca3af",padding:"2px 0",borderBottom:"1px solid #1a1a1a"}}>{o.hora} - {TIPOS_OP[o.tipo]?.label} - <span style={{color:"#f87171"}}>{m.simbolo}{fmt(o.monto)}</span></div>)}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

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
                <div style={{fontSize:11,color:"#4b5563",marginBottom:12}}>Solo para cheques ya entregados — no impacta saldo de caja, solo queda como activo a cobrar.</div>
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
            {diferidos.filter(d=>!d.cobrado).length===0&&<div style={{color:"#374151",fontSize:12}}>Sin diferidos pendientes</div>}
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
                        {!venc&&!urg&&<span style={{fontSize:10,color:"#6b7280"}}>Acredita {d.fechaAcr} - {dr}d</span>}
                        {d.cliente&&<span style={{fontSize:10,color:"#9ca3af"}}>👤 {d.cliente}</span>}
                      </div>
                      <div style={{display:"flex",alignItems:"baseline",gap:12,flexWrap:"wrap"}}>
                        <div>
                          <span style={{fontSize:13,fontWeight:700,color:"#c084fc"}}>${fmt(d.mFinal||d.nominal)}</span>
                          <span style={{fontSize:10,color:"#6b7280",marginLeft:4}}>a cobrar</span>
                        </div>
                        {!d.manual&&<div>
                          <span style={{fontSize:11,color:"#6b7280"}}>${fmt(d.nominal)}</span>
                          <span style={{fontSize:9,color:"#4b5563",marginLeft:3}}>nominal</span>
                        </div>}
                        {!d.manual&&d.ganancia>0&&<div>
                          <span style={{fontSize:11,color:"#4ade80"}}>+${fmt(d.ganancia)}</span>
                          <span style={{fontSize:9,color:"#4b5563",marginLeft:3}}>ganancia</span>
                        </div>}
                      </div>
                      <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:9,color:"#4b5563"}}>COBRO:</span>
                          <input type="date" value={d.fechaCobro||""} onChange={async e=>{
                            const val=e.target.value;
                            await SB.from("diferidos").update({fecha_cobro:val}).eq("id",d.id);
                            setDiferidos(p=>p.map(x=>x.id!==d.id?x:{...x,fechaCobro:val}));
                          }} style={{background:"transparent",border:"1px solid #1f2937",borderRadius:4,padding:"2px 6px",color:"#9ca3af",fontFamily:"inherit",fontSize:10,cursor:"pointer"}}/>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:9,color:"#4b5563"}}>TASA ENDOSO:</span>
                          <input type="number" placeholder="0" value={d.tasaEndoso||""} onChange={async e=>{
                            const val=e.target.value;
                            await SB.from("diferidos").update({tasa_endoso:val}).eq("id",d.id);
                            setDiferidos(p=>p.map(x=>x.id!==d.id?x:{...x,tasaEndoso:val}));
                          }} style={{background:"transparent",border:"1px solid #1f2937",borderRadius:4,padding:"2px 6px",color:"#9ca3af",fontFamily:"inherit",fontSize:10,width:50}}/>
                          <span style={{fontSize:9,color:"#4b5563"}}>%</span>
                          {d.tasaEndoso&&parse(d.tasaEndoso)>0&&(()=>{
                            const neto=(d.mFinal||d.nominal)*(1-parse(d.tasaEndoso)/100);
                            return <span style={{fontSize:10,color:"#4ade80",fontWeight:700,marginLeft:6}}>→ ${fmt(neto)} neto</span>;
                          })()}
                        </div>
                      </div>
                    </div>
                    <button onClick={()=>cobrarDif(d.id)} style={{padding:"7px 12px",borderRadius:6,background:"#052e16",border:"1px solid #4ade80",color:"#4ade80",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>Cobrar</button>
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
                  <button onClick={()=>setEditandoCliente(null)} style={{padding:"7px 14px",borderRadius:6,background:"transparent",border:"1px solid #1f2937",color:"#4b5563",fontFamily:"inherit",fontSize:12,cursor:"pointer"}}>Cancelar</button>
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
                        <button onClick={e=>{e.stopPropagation();eliminarCliente(c.id);}} style={{width:22,height:22,borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#4b5563",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>x</button>
                      </div>
                    </div>
                    <div style={{cursor:"pointer"}} onClick={()=>{setClienteActivo(c.id);setFormCC({tipo:"ingreso_transf",moneda:"ARS",monto:"",nota:"",impactaCaja:true});}}>
                      <div style={{fontWeight:700,marginBottom:5}}>{c.nombre} {c.apellido}</div>
                      {MONEDAS.map(m=>{ const v=sal[m.id]; if(!v) return null;
                        return <div key={m.id} style={{fontSize:11,color:v>0?"#4ade80":"#f87171",marginBottom:2}}>{v>0?"Me debe":"Le debo"} {m.simbolo}{fmt(Math.abs(v))} {m.id}</div>;})}
                      {MONEDAS.every(m=>!sal[m.id])&&<div style={{fontSize:11,color:"#374151"}}>Sin movimientos</div>}
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
                    <div style={{fontSize:9,color:"#6b7280",marginBottom:2}}>{m.id}</div>
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
                        <button key={t.id} onClick={()=>setFormCC(f=>({...f,tipo:t.id}))} style={{...S.btn(formCC.tipo===t.id,t.c),flex:1}}>{t.label}</button>
                      ))}
                    </div>
                  </div>
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
                      <div style={{fontSize:11,fontWeight:600,color:formCC.impactaCaja?"#f59e0b":"#475569"}}>Impacta caja física</div>
                      <div style={{fontSize:10,color:"#334155"}}>{formCC.impactaCaja?"Se suma/resta de tu caja":"Solo registro contable"}</div>
                    </div>
                  </div>
                  <button onClick={()=>regMovCC(c.id)} style={{width:"100%",padding:10,borderRadius:7,background:esIngCC?"#052e16":formCC.tipo==="retiro_transf"?"#0a1e2e":"#1c0a0a",border:"1px solid "+colorCC[formCC.tipo],color:colorCC[formCC.tipo],fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    {labelBtn[formCC.tipo]}
                  </button>
                </Card>
                <Card sx={{maxHeight:600,overflowY:"auto"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{fontSize:10,letterSpacing:3,color:"#6b7280"}}>HISTORIAL ({c.movimientos.length})</div>
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
                          html+=`<div class="rango">Período: ${exportCC.desde||"inicio"} al ${exportCC.hasta||"hoy"} · STS Financiera</div>`;
                          monedas.forEach(monId=>{
                            const mon=MONEDAS.find(m=>m.id===monId);
                            const movsMon=movsFiltrados.filter(mv=>mv.moneda===monId).sort((a,b)=>((a.fecha||"")+(a.hora||"")).localeCompare((b.fecha||"")+(b.hora||"")));
                            let saldo=0;
                            html+=`<h2>${monId}</h2><table><thead><tr><th>FECHA</th><th>CONCEPTO</th><th>NOTA</th><th style="text-align:right">DEBE</th><th style="text-align:right">HABER</th><th style="text-align:right">SALDO</th></tr></thead><tbody>`;
                            movsMon.forEach(mv=>{
                              const ing=mv.tipo==="ingreso_transf"||mv.tipo==="ingreso_dep";
                              saldo+=(ing?-mv.monto:mv.monto);
                              const debe=!ing?`<span class="debe">${mon?.simbolo||""}${mv.monto.toLocaleString("es-AR")}</span>`:"";
                              const haber=ing?`<span class="haber">${mon?.simbolo||""}${mv.monto.toLocaleString("es-AR")}</span>`:"";
                              const sClass=saldo>=0?"saldo-pos":"saldo-neg";
                              const labelMap={ingreso_transf:"Me transfirio",ingreso_dep:"Me deposito",retiro_transf:"Le transferi",retiro_efectivo:"Retire efectivo"};
                              html+=`<tr><td>${mv.fecha||""}</td><td>${labelMap[mv.tipo]||mv.tipo}</td><td style="color:#888">${mv.nota||""}</td><td style="text-align:right">${debe}</td><td style="text-align:right">${haber}</td><td style="text-align:right" class="${sClass}">${saldo>=0?"+":""}${mon?.simbolo||""}${saldo.toLocaleString("es-AR")}</td></tr>`;
                            });
                            const sClass=saldo>=0?"saldo-pos":"saldo-neg";
                            html+=`</tbody></table><div class="saldo-final ${sClass}">Saldo final: ${saldo>=0?"Me debe":"Le debo"} ${mon?.simbolo||""}${Math.abs(saldo).toLocaleString("es-AR")} ${monId}</div>`;
                          });
                          html+=`<div class="footer">Generado por STS Financiera · ${hoy}</div></body></html>`;
                          const w=window.open("","_blank");
                          w.document.write(html);
                          w.document.close();
                          setTimeout(()=>w.print(),500);
                        }} style={{padding:"8px 14px",borderRadius:6,background:"rgba(99,102,241,0.2)",border:"1px solid #6366f1",color:"#a5b4fc",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                          Generar PDF
                        </button>
                      </div>
                      <div style={{fontSize:9,color:"#334155",marginTop:6}}>Dejá vacío para exportar todo el historial</div>
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
                        <button onClick={()=>setEditandoMov(null)} style={{padding:"7px 12px",borderRadius:6,background:"transparent",border:"1px solid #1f2937",color:"#4b5563",fontFamily:"inherit",fontSize:11,cursor:"pointer"}}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  {(()=>{
                    // Agrupar movimientos por moneda para mostrar tabla debe/haber con saldo corriente
                    const monedaConMovs=[...new Set(c.movimientos.map(mv=>mv.moneda))];
                    return monedaConMovs.map(monId=>{
                      const mon=MONEDAS.find(m=>m.id===monId);
                      const movsMon=[...c.movimientos].filter(mv=>mv.moneda===monId).sort((a,b)=>((a.fecha||"")+(a.hora||"")).localeCompare((b.fecha||"")+(b.hora||"")));
                      // Calcular saldo corriente
                      let saldoCorriente=0;
                      const movsConSaldo=movsMon.map(mv=>{
                        const ing=mv.tipo==="ingreso_transf"||mv.tipo==="ingreso_dep";
                        saldoCorriente+=(ing?-mv.monto:mv.monto);
                        return {...mv,saldoAcum:saldoCorriente};
                      });
                      const saldoFinal=saldoCorriente;
                      return (
                        <div key={monId} style={{marginBottom:20}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <span style={{fontSize:11,fontWeight:700,color:mon?.color||"#6b7280",letterSpacing:2}}>{monId}</span>
                            <span style={{fontSize:12,fontWeight:700,color:saldoFinal>0?"#4ade80":saldoFinal<0?"#f87171":"#6b7280"}}>
                              {saldoFinal>0?"Me debe":"Le debo"} {mon?.simbolo}{fmt(Math.abs(saldoFinal))}
                            </span>
                          </div>
                          <div style={{overflowX:"auto"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                              <thead>
                                <tr style={{borderBottom:"1px solid #1f2937"}}>
                                  <th style={{textAlign:"left",padding:"5px 8px",fontSize:9,color:"#4b5563",fontWeight:600}}>FECHA</th>
                                  <th style={{textAlign:"left",padding:"5px 8px",fontSize:9,color:"#4b5563",fontWeight:600}}>CONCEPTO</th>
                                  <th style={{textAlign:"right",padding:"5px 8px",fontSize:9,color:"#4ade80",fontWeight:600}}>DEBE</th>
                                  <th style={{textAlign:"right",padding:"5px 8px",fontSize:9,color:"#f87171",fontWeight:600}}>HABER</th>
                                  <th style={{textAlign:"right",padding:"5px 8px",fontSize:9,color:"#6b7280",fontWeight:600}}>SALDO</th>
                                  <th style={{padding:"5px 4px",fontSize:9,color:"#4b5563",fontWeight:600}}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...movsConSaldo].reverse().map(mv=>{
                                  const ing=mv.tipo==="ingreso_transf"||mv.tipo==="ingreso_dep";
                                  // debe = me debe (retiro = le mande plata)
                                  // haber = le debo (ingreso = me mando plata)
                                  const debe=!ing?mv.monto:null;
                                  const haber=ing?mv.monto:null;
                                  return (
                                    <tr key={mv.id} style={{borderBottom:"1px solid #0f0f0f",background:"rgba(255,255,255,0.01)"}}>
                                      <td style={{padding:"6px 8px",color:"#475569",whiteSpace:"nowrap"}}>{mv.fecha||""}</td>
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
                                          if(!window.confirm("Eliminar este movimiento?")) return;
                                          await SB.from("movimientos_cc").delete().eq("id",mv.id);
                                          setClientes(p=>p.map(x=>x.id!==clienteActivo?x:{...x,movimientos:x.movimientos.filter(m=>m.id!==mv.id)}));
                                          notify("Eliminado");
                                        }} style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:"#1c0a0a",border:"1px solid #f43f5e",color:"#f43f5e",cursor:"pointer",fontFamily:"inherit"}}>borrar</button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </Card>
              </div>
            </div>
          );
        })()}

        {pant==="trade"&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#f43f5e",marginBottom:18}}>MESA DE NEGOCIACION - calculo informativo</div>
            <div className="grid-mobile-1" style={S.grid("1fr 1fr",18)}>
              <Card sx={{border:"1px solid #f43f5e33"}}>
                <div style={{display:"flex",gap:5,marginBottom:14}}>
                  {[["spread_pct","% nominal"],["spread_precio","Por precio"],["cadena","Cadena USDT-USD-ARS"]].map(([id,lbl])=>(
                    <button key={id} onClick={()=>setTrade(t=>({...t,modo:id}))} style={{...S.btn(trade.modo===id,"#f43f5e"),flex:1}}>{lbl}</button>
                  ))}
                </div>
                {trade.modo==="cadena"&&(<div>
                  <div style={{marginBottom:8}}><Lbl>Cantidad USDT</Lbl><Inp type="number" value={trade.cCant} onChange={e=>setTrade(t=>({...t,cCant:e.target.value}))}/></div>
                  <div style={S.grid("1fr 1fr",8)}>
                    <div><Lbl>Mercado te paga %</Lbl><Inp type="number" value={trade.cPm} onChange={e=>setTrade(t=>({...t,cPm:e.target.value}))} sx={{color:"#4ade80"}}/></div>
                    <div><Lbl>Le reconoces %</Lbl><Inp type="number" value={trade.cPc} onChange={e=>setTrade(t=>({...t,cPc:e.target.value}))} sx={{color:"#f87171"}}/></div>
                  </div>
                  <div style={{marginTop:7}}><Lbl>Cotizacion USD-ARS</Lbl><Inp type="number" value={trade.cCot} onChange={e=>setTrade(t=>({...t,cCot:e.target.value}))}/></div>
                </div>)}
                {trade.modo==="spread_pct"&&(<div>
                  <div style={{display:"flex",gap:5,marginBottom:12}}>
                    {[["vendo_base","Vende "+trade.mBase],["compro_base","Compra "+trade.mBase]].map(([id,lbl])=>(
                      <button key={id} onClick={()=>setTrade(t=>({...t,dir:id}))} style={{...S.btn(trade.dir===id,"#38bdf8"),flex:1}}>{lbl}</button>
                    ))}
                  </div>
                  <div style={S.grid("1fr 1fr",8)}>
                    <div><Lbl>Moneda base</Lbl><MonedasSel value={trade.mBase} onChange={v=>setTrade(t=>({...t,mBase:v}))}/></div>
                    <div><Lbl>Cotizacion en</Lbl><MonedasSel value={trade.mQuote} onChange={v=>setTrade(t=>({...t,mQuote:v}))} exclude={trade.mBase}/></div>
                  </div>
                  <div style={{marginTop:7,...S.grid("1fr 1fr 1fr",8)}}>
                    <div><Lbl>Cantidad</Lbl><Inp type="number" value={trade.cant} onChange={e=>setTrade(t=>({...t,cant:e.target.value}))}/></div>
                    <div><Lbl>Mercado %</Lbl><Inp type="number" value={trade.pp} onChange={e=>setTrade(t=>({...t,pp:e.target.value}))} sx={{color:"#4ade80"}}/></div>
                    <div><Lbl>Cliente %</Lbl><Inp type="number" value={trade.po} onChange={e=>setTrade(t=>({...t,po:e.target.value}))} sx={{color:"#f87171"}}/></div>
                  </div>
                </div>)}
                {trade.modo==="spread_precio"&&(<div>
                  <div style={S.grid("1fr 1fr",8)}>
                    <div><Lbl>Moneda base</Lbl><MonedasSel value={trade.mBase} onChange={v=>setTrade(t=>({...t,mBase:v}))}/></div>
                    <div><Lbl>Cotizacion en</Lbl><MonedasSel value={trade.mQuote} onChange={v=>setTrade(t=>({...t,mQuote:v}))} exclude={trade.mBase}/></div>
                  </div>
                  <div style={{marginTop:7,...S.grid("1fr 1fr 1fr",8)}}>
                    <div><Lbl>Cantidad</Lbl><Inp type="number" value={trade.cant} onChange={e=>setTrade(t=>({...t,cant:e.target.value}))}/></div>
                    <div><Lbl>Precio compra</Lbl><Inp type="number" value={trade.prp} onChange={e=>setTrade(t=>({...t,prp:e.target.value}))} sx={{color:"#4ade80"}}/></div>
                    <div><Lbl>Precio venta</Lbl><Inp type="number" value={trade.pro} onChange={e=>setTrade(t=>({...t,pro:e.target.value}))} sx={{color:"#f87171"}}/></div>
                  </div>
                </div>)}
                {calcTrade?(
                  <div style={{marginTop:14,background:calcTrade.ganancia>0?"#0a1a0a":"#1c0a0a",border:"1px solid "+(calcTrade.ganancia>0?"#22c55e44":"#f4433644"),borderRadius:8,padding:12}}>
                    <div style={{borderTop:"1px solid #1f2937",paddingTop:9,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:9,color:"#6b7280",marginBottom:2}}>{calcTrade.ganancia>0?"Ganancia":"Perdida"}</div>
                        <div style={{fontSize:20,fontWeight:700,color:calcTrade.ganancia>0?"#4ade80":"#f43f5e"}}>{calcTrade.ganancia>0?"+":""}{fmt(calcTrade.ganancia)} {calcTrade.mG}</div>
                      </div>
                      <button onClick={()=>{const h=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});setTradeHist(p=>[{id:Date.now(),hora:h,...calcTrade},...p]);notify("Guardado");}} style={{padding:"8px 13px",borderRadius:6,background:"#0a1a0a",border:"1px solid #22c55e",color:"#4ade80",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer"}}>Guardar</button>
                    </div>
                  </div>
                ):(
                  <div style={{marginTop:14,background:"#0d0d0d",border:"1px dashed #1f2937",borderRadius:8,padding:18,textAlign:"center",color:"#374151",fontSize:12}}>Completa los campos</div>
                )}
              </Card>
              <Card sx={{maxHeight:560,overflowY:"auto"}}>
                <div style={{fontSize:10,letterSpacing:3,color:"#6b7280",marginBottom:12}}>NEGOCIACIONES ({tradeHist.length})</div>
                {tradeHist.map(t=>(
                  <div key={t.id} style={{borderBottom:"1px solid #1a1a1a",paddingBottom:9,marginBottom:9}}>
                    <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,fontWeight:700}}>{fmt(t.cant)} {t.mBase||""}={t.mQuote||""}</span><span style={{fontSize:10,color:"#4b5563"}}>{t.hora}</span></div>
                    <div style={{fontSize:13,fontWeight:700,color:t.ganancia>0?"#4ade80":"#f43f5e"}}>{t.ganancia>0?"+":""}{fmt(t.ganancia)} {t.mG}</div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {pant==="posicion"&&(()=>{
          const getS=(cId,mId)=>{ const k=cId+"_"+mId; return posOvr[k]!==undefined?posOvr[k]:(saldoCC(clientes.find(x=>x.id===cId))[mId]||0); };
          const tots=Object.fromEntries(MONEDAS.map(m=>[m.id,clientes.reduce((s,c)=>s+getS(c.id,m.id),0)]));
          const meses=Object.entries(fact.meses||{});
          const ganAcum=meses.reduce((s,[,v])=>s+parse(v),0),obj=parse(fact.objetivo);

          function generarImagen() {
            const difPend=diferidos.filter(d=>!d.cobrado);
            const totalDif=difPend.reduce((s,d)=>s+(d.mFinal||d.nominal),0);
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
              const varColor=varUSD>=0?VERDE:ROJO;
              rect(PAD,y-2,W-PAD*2,42,"rgba(255,255,255,0.02)",6);
              txt("PATRIMONIO HOY",PAD+12,y+12,9,DIM,"left",true);
              txt(fmtUSD(ultimoCierre.total_usd),W/2,y+12,13,"#4ade80","center",true);
              txt((varUSD>=0?"+":"")+fmtUSD(varUSD)+" vs ayer",W-PAD-12,y+12,10,varColor,"right",true);
              txt(penultimoCierre?.total_usd?"Ayer: "+fmtUSD(penultimoCierre.total_usd):"",W-PAD-12,y+26,8,GRIS,"right");
              y+=50;
            }

            // Footer
            hline(y,0.05); y+=14;
            txt("Generado por STS Financiera  •  "+hoy,W/2,y,8,GRIS,"center");

            // Evolucion vs dia anterior
            if(ultimoCierre?.total_usd&&varUSD!==null){
              hline(y,0.1); y+=16;
              const varColor=varUSD>=0?VERDE:ROJO;
              rect(PAD,y-2,W-PAD*2,42,"rgba(255,255,255,0.02)",6);
              txt("PATRIMONIO HOY",PAD+12,y+12,9,DIM,"left",true);
              txt(fmtUSD(ultimoCierre.total_usd),W/2,y+12,13,"#4ade80","center",true);
              txt((varUSD>=0?"+":"")+fmtUSD(varUSD)+" vs ayer",W-PAD-12,y+12,10,varColor,"right",true);
              txt(penultimoCierre?.total_usd?"Ayer: "+fmtUSD(penultimoCierre.total_usd):"",W-PAD-12,y+26,8,GRIS,"right");
              y+=50;
            }

            // Footer
            hline(y,0.05); y+=14;
            txt("Generado por STS Financiera  •  "+hoy,W/2,y,8,GRIS,"center");

            const link=document.createElement("a");
            link.download="STS-resumen-"+hoy+".png";
            link.href=canvas.toDataURL("image/png");
            link.click();
            notify("Imagen descargada ✓");
          }

          return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:14}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontSize:10,letterSpacing:3,color:"#e879f9"}}>POSICION CONSOLIDADA</div>
                  <button onClick={generarImagen} style={{padding:"5px 12px",borderRadius:7,background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.3)",color:"#a5b4fc",fontFamily:"inherit",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    ⬇ Descargar resumen
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
                    <button onClick={()=>{if(!nuevoMes.trim())return;const nf={...fact,meses:{...fact.meses,[nuevoMes.trim()]:"0"}};setFact(nf);guardarDia(null,nf,null);setNuevoMes("");}} style={{padding:"3px 7px",borderRadius:4,background:"#0a0a0a",border:"1px solid #1f2937",color:"#6b7280",cursor:"pointer",fontFamily:"inherit"}}>+</button>
                  </div>
                  <div style={{borderTop:"1px solid #1f2937",marginTop:7,paddingTop:7}}>
                    {[["Ganancia acum.",fmt(ganAcum),ganAcum>=0?"#4ade80":"#f87171"],["Objetivo",obj?fmt(obj):"clic","#9ca3af","__obj__"],["Resta",fmt(obj-ganAcum),obj-ganAcum<=0?"#4ade80":"#f87171"]].map(([k,v,c,ek])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}>
                        <span style={{fontSize:11,color:"#6b7280"}}>{k}</span>
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
                    <th style={{textAlign:"left",padding:"7px 10px",borderBottom:"2px solid #1f2937",color:"#4b5563",fontSize:10}}>CLIENTE</th>
                    {MONEDAS.map(m=><th key={m.id} style={{textAlign:"right",padding:"7px 10px",borderBottom:"2px solid #1f2937",color:m.color,fontSize:10}}>{m.id}</th>)}
                  </tr></thead>
                  <tbody>
                    {clientes.map((c,i)=>(
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
                      const totalDif=difPend.reduce((s,d)=>s+(d.mFinal||d.nominal),0);
                      // Patrimonio total = caja fisica + CCs + cheques a cobrar
                      const patrimonioTot=Object.fromEntries(MONEDAS.map(m=>[m.id, (saldos[m.id]||0)+tots[m.id]+(m.id==="ARS"?totalDif:0)]));
                      return (<>
                        <tr style={{borderTop:"2px solid #1f2937",background:"#0a1a0a"}}>
                          <td style={{padding:"9px 10px",fontSize:9,color:"#4ade80",fontWeight:700,letterSpacing:1}}>CAJA OFICINA</td>
                          {MONEDAS.map(m=><td key={m.id} style={{textAlign:"right",padding:"9px 10px"}}>
                            <span style={{fontSize:13,fontWeight:700,color:saldos[m.id]>0?"#4ade80":saldos[m.id]<0?"#f87171":"#374151"}}>{saldos[m.id]!==0?fmt(saldos[m.id]):"—"}</span>
                          </td>)}
                        </tr>
                        <tr style={{borderTop:"1px solid #1f2937",background:"#0a0a0a"}}>
                          <td style={{padding:"9px 10px",fontSize:9,color:"#6b7280"}}>TOTAL CC</td>
                          {MONEDAS.map(m=><td key={m.id} style={{textAlign:"right",padding:"9px 10px"}}>
                            <span style={{fontSize:13,fontWeight:700,color:tots[m.id]>0?"#4ade80":tots[m.id]<0?"#f87171":"#374151"}}>{tots[m.id]!==0?fmt(tots[m.id]):"—"}</span>
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
                                : <span style={{color:"#374151"}}>—</span>}
                            </td>)}
                          </tr>
                        )}
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
              <div style={{fontSize:12,color:"#64748b",marginBottom:18}}>Analizá, editá o agregá operaciones de cualquier período</div>

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
                  <span style={{fontSize:11,color:"#64748b",marginLeft:4}}>{opsFiltradas.length} operaciones</span>
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

                  {opsFiltradas.length===0&&<div style={{color:"#334155",fontSize:12,textAlign:"center",padding:32}}>Sin operaciones en el período seleccionado</div>}
                  {Object.entries(porFecha).map(([fecha,fops])=>(
                    <div key={fecha} style={{marginBottom:20}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#fb923c"}}>{fmtFecha(fecha)}</div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <span style={{fontSize:10,color:"#475569"}}>{fops.length} ops</span>
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
                            <span style={{fontSize:11,color:"#475569"}}>{tOps.length} ops</span>
                          </div>
                          <span style={{fontSize:13,fontWeight:700,color:"#e2e8f0",fontFamily:"'JetBrains Mono',monospace"}}>{fmt(totalARS)}</span>
                        </div>
                        <div style={{fontSize:11,color:"#475569"}}>
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
                  {opsFiltradas.length===0&&<div style={{color:"#334155",fontSize:12,textAlign:"center",padding:32}}>Sin operaciones en el período</div>}
                </div>
              )}
            </div>
          );
        })()}

        {pant==="evolucion"&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#4ade80",marginBottom:4}}>EVOLUCION DE LA CAJA</div>
            <div style={{fontSize:12,color:"#4b5563",marginBottom:20}}>Patrimonio total valuado en USD al cierre de cada dia</div>
            {cierres.length===0?(
              <div style={{background:"#0d0d0d",border:"1px dashed #1f2937",borderRadius:10,padding:32,textAlign:"center",color:"#374151"}}>
                <div style={{fontSize:24,marginBottom:8}}>📊</div>
                <div>Todavia no hay cierres registrados</div>
                <div style={{fontSize:11,marginTop:4}}>Cierra el primer dia desde la pantalla Cierre</div>
              </div>
            ):(
              <div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
                  {ultimoCierre&&<Card sx={{flex:"1 1 160px",border:"1px solid #4ade8033",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"#4b5563",letterSpacing:2,marginBottom:4}}>ULTIMO CIERRE</div>
                    <div style={{fontSize:22,fontWeight:700,color:"#4ade80"}}>{fmtUSD(ultimoCierre.total_usd)}</div>
                    <div style={{fontSize:10,color:"#4b5563",marginTop:2}}>{fmtFecha(ultimoCierre.fecha)}</div>
                  </Card>}
                  {varUSD!==null&&<Card sx={{flex:"1 1 160px",border:"1px solid "+(varUSD>=0?"#4ade8033":"#f4433633"),textAlign:"center"}}>
                    <div style={{fontSize:9,color:"#4b5563",letterSpacing:2,marginBottom:4}}>VS DIA ANTERIOR</div>
                    <div style={{fontSize:22,fontWeight:700,color:varUSD>=0?"#4ade80":"#f87171"}}>{varUSD>=0?"+":""}{fmtUSD(varUSD)}</div>
                    <div style={{fontSize:10,color:"#4b5563",marginTop:2}}>{varUSD>=0?"Subio":"Bajo"}</div>
                  </Card>}
                  {cierres.length>=2&&<Card sx={{flex:"1 1 160px",border:"1px solid #38bdf833",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"#4b5563",letterSpacing:2,marginBottom:4}}>DESDE EL INICIO</div>
                    <div style={{fontSize:22,fontWeight:700,color:"#38bdf8"}}>{((cierres[cierres.length-1].total_usd/cierres[0].total_usd-1)*100).toFixed(1)}%</div>
                    <div style={{fontSize:10,color:"#4b5563",marginTop:2}}>{cierres.length} cierres</div>
                  </Card>}
                </div>
                {grafData.length>=2&&<Card sx={{marginBottom:18,border:"1px solid #4ade8022"}}>
                  <div style={{fontSize:9,letterSpacing:2,color:"#4b5563",marginBottom:10}}>GRAFICO USD</div>
                  <LineChart data={grafData} color="#4ade80" height={120}/>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#374151",marginTop:4}}>
                    <span>{fmtFecha(grafData[0].x)}</span>
                    <span>{fmtFecha(grafData[grafData.length-1].x)}</span>
                  </div>
                </Card>}
                <Card>
                  <div style={{fontSize:9,letterSpacing:2,color:"#4b5563",marginBottom:12}}>HISTORIAL DE CIERRES</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"inherit"}}>
                      <thead><tr>
                        <th style={{textAlign:"left",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#4b5563",fontSize:9}}>FECHA</th>
                        {MONEDAS.map(m=><th key={m.id} style={{textAlign:"right",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:m.color,fontSize:9}}>{m.id}</th>)}
                        <th style={{textAlign:"right",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#4ade80",fontSize:9}}>TOTAL USD</th>
                        <th style={{textAlign:"right",padding:"6px 8px",borderBottom:"1px solid #1f2937",color:"#4b5563",fontSize:9}}>VAR</th>
                      </tr></thead>
                      <tbody>
                        {[...cierres].reverse().map((c,i,arr)=>{
                          const prev=arr[i+1];
                          const variacion=prev&&c.total_usd&&prev.total_usd?c.total_usd-prev.total_usd:null;
                          return (
                            <tr key={c.fecha} style={{borderBottom:"1px solid #1a1a1a"}}>
                              <td style={{padding:"7px 8px",color:"#9ca3af"}}>{fmtFecha(c.fecha)}</td>
                              {MONEDAS.map(m=>{ const v=c.saldos_finales?.[m.id]||0;
                                return <td key={m.id} style={{textAlign:"right",padding:"7px 8px",color:v!==0?"#fff":"#374151",fontSize:11}}>{v!==0?fmt(v):"—"}</td>;
                              })}
                              <td style={{textAlign:"right",padding:"7px 8px",fontWeight:700,color:"#4ade80"}}>{c.total_usd?fmtUSD(c.total_usd):"—"}</td>
                              <td style={{textAlign:"right",padding:"7px 8px",fontWeight:700,color:variacion===null?"#374151":variacion>=0?"#4ade80":"#f87171",fontSize:11}}>
                                {variacion===null?"—":(variacion>=0?"+":"")+fmtUSD(variacion)}
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
        )}

        {pant==="cierre"&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#94a3b8",marginBottom:18}}>CIERRE - {fechaLarga}</div>
            {(()=>{
              const difPend=diferidos.filter(d=>!d.cobrado);
              const totalDif=difPend.reduce((s,d)=>s+(d.mFinal||d.nominal),0);
              const tots=Object.fromEntries(MONEDAS.map(m=>[m.id,clientes.reduce((s,c)=>s+saldoCC(c)[m.id],0)]));
              const patrimonioSaldos=Object.fromEntries(MONEDAS.map(m=>[m.id,(saldos[m.id]||0)+tots[m.id]+(m.id==="ARS"?totalDif:0)]));
              return (
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:18}}>
                  {MONEDAS.map(m=>{ const vFis=saldos[m.id]||0,vTot=patrimonioSaldos[m.id]; if(!vFis&&!vTot) return null;
                    return <div key={m.id} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba("+hexToRgb(m.color)+",0.2)",borderRadius:10,padding:"10px 14px",minWidth:110}}>
                      <div style={{fontSize:9,color:m.color,letterSpacing:2,marginBottom:6,fontWeight:700}}>{m.id}</div>
                      <div style={{fontSize:11,color:"#4b5563",marginBottom:2}}>Física: <span style={{color:"#e2e8f0",fontWeight:600}}>{m.simbolo}{fmt(vFis)}</span></div>
                      <div style={{fontSize:12,fontWeight:700,color:"#818cf8"}}>Total: {m.simbolo}{fmt(vTot)}</div>
                    </div>;
                  })}
                </div>
              );
            })()}
            <div style={S.grid("1fr 1fr",14)}>
              <Card>
                <div style={{fontSize:10,letterSpacing:3,color:"#6b7280",marginBottom:12}}>SALDOS</div>
                <div style={{...S.grid("1fr 1fr 1fr 1fr",7),fontSize:9,color:"#4b5563",marginBottom:6}}>
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
                <div style={{fontSize:10,letterSpacing:3,color:"#6b7280",marginBottom:12}}>OPERACIONES HOY ({opsHoy.length})</div>
                {Object.entries(TIPOS_OP).map(([id,t])=>{ const n=opsHoy.filter(o=>o.tipo===id).length; if(!n) return null;
                  return <div key={id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #1a1a1a"}}>
                    <span style={{fontSize:12,color:t.color}}>{t.label}</span><span style={{fontSize:12,color:"#6b7280"}}>{n}x</span>
                  </div>;})}
                {opsHoy.length===0&&<div style={{color:"#374151",fontSize:12}}>Sin operaciones</div>}
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
                      {ultimoCierre?.total_usd&&<div style={{fontSize:11,color:"#4b5563",marginTop:2}}>Total en USD: <strong style={{color:"#4ade80"}}>{fmtUSD(ultimoCierre.total_usd)}</strong></div>}
                      {ultimoCierre?.cotizaciones&&<div style={{fontSize:10,color:"#374151",marginTop:3}}>
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
              <div style={{fontSize:12,color:"#4b5563",marginBottom:18}}>Posicion de cada socio con sus clientes</div>
              {SOCIOS_FIJOS.map(socio=>{
                const r=resumen[socio]; const col=COLORES_SOCIO[socio]||"#6b7280";
                const clientesConSaldo=r.clientes.filter(c=>MONEDAS.some(m=>c.sal[m.id]!==0));
                return (
                  <Card key={socio} sx={{marginBottom:14,border:"1px solid "+col+"33"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:col}}>{socio}</div>
                        <div style={{fontSize:11,color:"#4b5563",marginTop:2}}>{clientesConSaldo.length} clientes con saldo</div>
                      </div>
                      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                        {MONEDAS.map(m=>{ const v=r.totalPorMoneda[m.id]; if(!v) return null;
                          return <div key={m.id} style={{background:"#0d0d0d",border:"1px solid "+(v>0?m.color+"44":"#f4433633"),borderRadius:6,padding:"5px 10px"}}>
                            <div style={{fontSize:8,color:m.color,marginBottom:1}}>{m.id}</div>
                            <div style={{fontSize:12,fontWeight:700,color:v>0?"#4ade80":"#f87171"}}>{v>0?"Me deben":"Debo"} {m.simbolo}{fmt(Math.abs(v))}</div>
                          </div>;})}
                      </div>
                    </div>
                    {clientesConSaldo.length===0&&<div style={{fontSize:12,color:"#374151"}}>Sin clientes con saldo</div>}
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
            <div style={{fontSize:12,color:"#4b5563",marginBottom:18}}>Registra tus gastos fijos y variables</div>
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
                <button onClick={async()=>{
                  const monto=parse(formGasto.monto); if(!monto){notify("Ingresa un monto",false);return;}
                  const g={categoria:formGasto.categoria,monto,moneda:formGasto.moneda,nota:formGasto.nota,fecha:formGasto.fecha};
                  const {data:ins}=await SB.from("gastos").insert(g).select().single();
                  if(ins) setGastos(p=>[ins,...p]);
                  setFormGasto(f=>({...f,monto:"",nota:""}));
                  notify("Gasto registrado");
                }} style={{marginTop:12,width:"100%",padding:10,borderRadius:7,background:"#1c0a0a",border:"1px solid #f43f5e",color:"#f87171",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  REGISTRAR GASTO
                </button>
              </Card>
              <Card sx={{maxHeight:500,overflowY:"auto"}}>
                <div style={{fontSize:10,letterSpacing:3,color:"#6b7280",marginBottom:12}}>HISTORIAL ({gastos.length})</div>
                {gastos.length===0&&<div style={{color:"#374151",fontSize:12}}>Sin gastos registrados</div>}
                {gastos.map(g=>{
                  const mon=MONEDAS.find(m=>m.id===g.moneda);
                  return (
                    <div key={g.id} style={{borderBottom:"1px solid #1a1a1a",padding:"8px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontSize:11,color:"#f87171",fontWeight:700}}>{g.categoria}</div>
                        <div style={{fontSize:13,fontWeight:700,color:"#fff",marginTop:1}}>{mon?.simbolo}{fmt(g.monto)} {g.moneda}</div>
                        {g.nota&&<div style={{fontSize:11,color:"#4b5563",marginTop:1}}>{g.nota}</div>}
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:10,color:"#4b5563"}}>{fmtFecha(g.fecha)}</div>
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
                  <div style={{fontSize:10,letterSpacing:3,color:"#6b7280",marginBottom:12}}>RESUMEN POR CATEGORIA</div>
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
              <div style={{fontSize:12,color:"#4b5563",marginBottom:18}}>Inversion y distribucion de capital</div>
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
                  <div style={{marginTop:20}}>
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
                        }} style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#4b5563",cursor:"pointer",fontFamily:"inherit"}}>x</button>
                      </div>
                    ))}
                    {socios.length>0&&(
                      <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",marginTop:4}}>
                        <span style={{fontSize:12,fontWeight:700,color:"#6b7280"}}>TOTAL</span>
                        <span style={{fontSize:14,fontWeight:700,color:"#a78bfa"}}>${fmt(total)}</span>
                      </div>
                    )}
                  </div>
                </Card>
                <Card sx={{border:"1px solid #a78bfa33",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  {socios.length===0?(
                    <div style={{color:"#374151",fontSize:12,textAlign:"center"}}>Agrega socios para ver el grafico</div>
                  ):(
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:10,letterSpacing:3,color:"#6b7280",marginBottom:16}}>DISTRIBUCION DE CAPITAL</div>
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
                      <div style={{marginTop:16,fontSize:11,color:"#4b5563"}}>Total invertido: <strong style={{color:"#a78bfa"}}>${fmt(total)} USD</strong></div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          );
        })()}

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
        <div style={{color:"#334155",fontSize:12}}>Verificando sesión...</div>
      </div>
    </div>
  );

  if (!usuario) return <LoginScreen onLogin={()=>{}} />;
  return <AppInterna usuario={usuario} />;
}
