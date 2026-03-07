import { useState, useCallback, useMemo, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SB = createClient(
  "https://aauyrjwytyxabjxyaech.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhdXlyand5dHl4YWJqeHlhZWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NDc2MzcsImV4cCI6MjA4ODQyMzYzN30.KgsY8Oyn17eZrxHODj5jDXba-XrGx1H1bSh68jlSmmw"
);

const MONEDAS = [
  { id:"USD",  simbolo:"$",  color:"#4ade80", label:"Dólares" },
  { id:"ARS",  simbolo:"$",  color:"#f59e0b", label:"Pesos"   },
  { id:"BRL",  simbolo:"R$", color:"#34d399", label:"Reales"  },
  { id:"GBP",  simbolo:"£",  color:"#a78bfa", label:"Libras"  },
  { id:"EUR",  simbolo:"€",  color:"#60a5fa", label:"Euros"   },
  { id:"USDT", simbolo:"₮",  color:"#2dd4bf", label:"USDT"    },
];

const TIPOS_OP = {
  compra:             { label:"Compra",               icon:"↓", color:"#4ade80" },
  venta:              { label:"Venta",                icon:"↑", color:"#f87171" },
  cheque_dia:         { label:"Cheque al día",        icon:"✓", color:"#fb923c" },
  cheque_dif:         { label:"Cheque diferido",      icon:"◷", color:"#c084fc" },
  transferencia:      { label:"Transferencia",        icon:"⇄", color:"#38bdf8" },
  ajuste:             { label:"Ajuste",               icon:"✎", color:"#6b7280" },
  cobro_dif:          { label:"Cobro diferido",       icon:"✓", color:"#c084fc" },
  cc_ingreso_transf:  { label:"CC Transf. recibida", icon:"↓", color:"#34d399" },
  cc_ingreso_dep:     { label:"CC Depósito recibido",icon:"↓", color:"#34d399" },
  cc_retiro_transf:   { label:"CC Transf. enviada",  icon:"↙", color:"#38bdf8" },
  cc_retiro_efectivo: { label:"CC Retiro efectivo",  icon:"↑", color:"#f97316" },
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
const diasEntre = (a,b) => { if(!a||!b) return 0; return Math.max(0,Math.round((new Date(b)-new Date(a))/86400000)); };
const hoy = new Date().toISOString().split("T")[0];
const fechaLarga = new Date().toLocaleDateString("es-AR",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
const fmtFecha = (f) => f ? new Date(f+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short",year:"numeric",month:"short",day:"numeric"}) : "";

const S = {
  app:   { minHeight:"100vh", background:"#080808", color:"#e5e7eb", fontFamily:"'Courier New',monospace", fontSize:13 },
  nav:   { background:"#0d0d0d", borderBottom:"1px solid #1a1a1a", padding:"0 12px", display:"flex", gap:3, overflowX:"auto", alignItems:"center", height:46 },
  main:  { maxWidth:1200, margin:"0 auto", padding:"20px 14px" },
  card:  { background:"#111", border:"1px solid #1f2937", borderRadius:10, padding:16 },
  inp:   (x={}) => ({ width:"100%", background:"#0a0a0a", border:"1px solid #1f2937", borderRadius:6, padding:"8px 10px", color:"#e5e7eb", fontFamily:"inherit", fontSize:13, outline:"none", boxSizing:"border-box", ...x }),
  lbl:   { display:"block", fontSize:10, letterSpacing:2, color:"#4b5563", textTransform:"uppercase", marginBottom:4 },
  btn:   (on,c="#4ade80") => ({ padding:"5px 12px", borderRadius:6, border:"1px solid", borderColor:on?c:"#1f2937", background:on?c+"18":"transparent", color:on?c:"#4b5563", fontFamily:"inherit", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }),
  grid:  (cols,gap=12) => ({ display:"grid", gridTemplateColumns:cols, gap }),
  toast: (ok) => ({ position:"fixed", bottom:20, right:20, zIndex:9999, background:ok?"#052e16":"#1c0a0a", border:"1px solid "+(ok?"#34d399":"#f43f5e"), color:ok?"#34d399":"#f87171", padding:"10px 18px", borderRadius:8, fontSize:13, fontWeight:700 }),
};

const Lbl = ({children}) => <span style={S.lbl}>{children}</span>;
const Inp = ({sx,...p}) => <input style={S.inp(sx)} {...p}/>;
const Sel = ({children,...p}) => <select style={S.inp()} {...p}>{children}</select>;
const Card = ({children,sx,...p}) => <div style={{...S.card,...sx}} {...p}>{children}</div>;
const MonedasSel = ({value,onChange,exclude}) => (
  <Sel value={value} onChange={e=>onChange(e.target.value)}>
    {MONEDAS.filter(m=>m.id!==exclude).map(m=><option key={m.id} value={m.id}>{m.id} — {m.label}</option>)}
  </Sel>
);

// ── Formulario de operación reutilizable ──────────────────────────────────────
function FormOp({ onGuardar, onCancelar, fechaDefault, titulo, color="#fb923c", opInicial }) {
  const [f, setF] = useState({
    tipo: opInicial?.tipo || "compra",
    moneda: opInicial?.moneda || "USD",
    monto: opInicial?.monto ? String(opInicial.monto) : "",
    moneda2: opInicial?.moneda2 || "ARS",
    monto2: opInicial?.monto2 ? String(opInicial.monto2) : "",
    cotizacion: opInicial?.cotizacion ? String(opInicial.cotizacion) : "",
    cliente: opInicial?.cliente || "",
    nota: opInicial?.nota || "",
    hora: opInicial?.hora || "",
    cn: opInicial?.cn ? String(opInicial.cn) : "",
    cpct: opInicial?.cpct ? String(opInicial.cpct) : "",
    dn: opInicial?.dn ? String(opInicial.dn) : "",
    dtm: "58", dtg: "2.5",
    dfr: fechaDefault || hoy,
    dfa: opInicial?.dfa || "",
    tn: opInicial?.tn ? String(opInicial.tn) : "",
    tpct: opInicial?.tpct ? String(opInicial.tpct) : "",
  });
  const sf = (k,v) => setF(x=>({...x,[k]:v}));

  const calcDif = useMemo(()=>{
    const n=parse(f.dn),tm=parse(f.dtm),tg=parse(f.dtg),dias=diasEntre(f.dfr,f.dfa);
    if (!n||!dias) return null;
    const postG=n*(1-tg/100),tasaD=(tm/360)*dias,mFinal=postG*(1-tasaD);
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
    <div style={{background:"#0d0d0d",border:`1px solid ${color}33`,borderRadius:10,padding:16}}>
      {titulo&&<div style={{fontSize:10,letterSpacing:3,color,marginBottom:12}}>{titulo}</div>}
      <div style={{marginBottom:12,maxWidth:150}}><Lbl>Hora</Lbl><Inp placeholder="14:30" value={f.hora} onChange={e=>sf("hora",e.target.value)}/></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
        {Object.entries(TIPOS_OP).filter(([id])=>!id.startsWith("cc_")&&id!=="ajuste"&&id!=="cobro_dif").map(([id,t])=>(
          <button key={id} onClick={()=>sf("tipo",id)} style={S.btn(f.tipo===id,t.color)}>{t.icon} {t.label}</button>
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
            <div><Lbl>Cotización</Lbl><Inp type="number" placeholder="0" value={f.cotizacion} onChange={e=>{sf("cotizacion",e.target.value);const m=parse(f.monto);if(m)sf("monto2",String(m*parse(e.target.value)));}}/></div>
            <div><Lbl>Total</Lbl><Inp type="number" placeholder="0" value={f.monto2} onChange={e=>{sf("monto2",e.target.value);const m=parse(f.monto);if(m)sf("cotizacion",String(parse(e.target.value)/m));}}/></div>
          </div>
        </div>
      )}
      {f.tipo==="cheque_dia"&&(
        <div style={S.grid("1fr 1fr",8)}>
          <div><Lbl>Nominal ARS</Lbl><Inp type="number" value={f.cn} onChange={e=>sf("cn",e.target.value)}/></div>
          <div><Lbl>Comisión %</Lbl><Inp type="number" value={f.cpct} onChange={e=>sf("cpct",e.target.value)}/></div>
          {f.cn&&f.cpct&&<div style={{gridColumn:"1/-1",background:"#0a1a0a",border:"1px solid #22c55e33",borderRadius:6,padding:"8px 10px",fontSize:12}}>
            Comisión: <strong style={{color:"#4ade80"}}>${fmt(parse(f.cn)*parse(f.cpct)/100)}</strong> · Ingresa: <strong>${fmt(parse(f.cn))}</strong>
          </div>}
        </div>
      )}
      {f.tipo==="cheque_dif"&&(
        <div>
          <div style={S.grid("1fr 1fr 1fr",8)}>
            <div><Lbl>Tasa mercado %</Lbl><Inp type="number" value={f.dtm} onChange={e=>sf("dtm",e.target.value)}/></div>
            <div><Lbl>Tasa gestión %</Lbl><Inp type="number" value={f.dtg} onChange={e=>sf("dtg",e.target.value)}/></div>
            <div><Lbl>Nominal</Lbl><Inp type="number" value={f.dn} onChange={e=>sf("dn",e.target.value)}/></div>
            <div><Lbl>Fecha recepción</Lbl><Inp type="date" value={f.dfr} onChange={e=>sf("dfr",e.target.value)}/></div>
            <div><Lbl>Fecha acreditación</Lbl><Inp type="date" value={f.dfa} onChange={e=>sf("dfa",e.target.value)}/></div>
            <div style={{display:"flex",alignItems:"flex-end",paddingBottom:6}}><span style={{fontSize:11,color:"#6b7280"}}>{calcDif?.dias||0}d</span></div>
          </div>
          {calcDif&&<div style={{marginTop:8,background:"#0a0a0a",border:"1px solid #c084fc33",borderRadius:8,padding:10,...S.grid("1fr 1fr 1fr 1fr",8),fontSize:11}}>
            {[["Post-gest.",fmt(calcDif.postG),"#9ca3af"],["Tasa",calcDif.tasaD.toFixed(2)+"%","#9ca3af"],["Pagás",fmt(calcDif.mFinal),"#f87171"],["Ganancia",fmt(calcDif.ganancia),"#4ade80"]].map(([k,v,c])=>(
              <div key={k}><div style={{color:"#4b5563",marginBottom:2}}>{k}</div><div style={{color:c,fontWeight:700}}>${v}</div></div>
            ))}
          </div>}
        </div>
      )}
      {f.tipo==="transferencia"&&(
        <div style={S.grid("1fr 1fr",8)}>
          <div><Lbl>Monto</Lbl><Inp type="number" value={f.tn} onChange={e=>sf("tn",e.target.value)}/></div>
          <div><Lbl>Comisión %</Lbl><Inp type="number" value={f.tpct} onChange={e=>sf("tpct",e.target.value)}/></div>
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
        <button onClick={()=>{const d=construir();if(d)onGuardar(d);}} style={{flex:1,padding:11,borderRadius:7,background:"#0a0a0a",border:`1px solid ${color}`,color,fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>✓ GUARDAR</button>
        {onCancelar&&<button onClick={onCancelar} style={{padding:"11px 16px",borderRadius:7,background:"transparent",border:"1px solid #1f2937",color:"#4b5563",fontFamily:"inherit",fontSize:12,cursor:"pointer"}}>Cancelar</button>}
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function CajaFinanciera() {
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

  // Editar ops de hoy
  const [editandoOp, setEditandoOp] = useState(null);

  // Historial
  const [histFecha, setHistFecha] = useState("");
  const [histOps, setHistOps] = useState([]);
  const [histModo, setHistModo] = useState("ver");
  const [histEditando, setHistEditando] = useState(null);
  const histDias = useMemo(()=>{
    const fechas = new Set(ops.map(o=>o.fecha));
    return [...fechas].sort().reverse();
  },[ops]);

  const [form, setForm] = useState({ tipo:"compra", moneda:"USD", monto:"", moneda2:"ARS", monto2:"", cotizacion:"", cliente:"", nota:"", cn:"", cpct:"", dn:"", dtm:"58", dtg:"2.5", dfr:hoy, dfa:"", tn:"", tpct:"" });
  const [formCC, setFormCC] = useState({ tipo:"ingreso_transf", moneda:"ARS", monto:"", nota:"" });
  const [trade, setTrade] = useState({ modo:"spread_pct", dir:"vendo_base", mBase:"USDT", mQuote:"USD", cant:"", pp:"", po:"", prp:"", pro:"", cCant:"", cPm:"", cPc:"", cCot:"" });

  const [editSaldo, setEditSaldo] = useState(null);
  const [editSaldoV, setEditSaldoV] = useState("");
  const [editCell, setEditCell] = useState(null);
  const [editCellV, setEditCellV] = useState("");
  const [editFact, setEditFact] = useState(null);
  const [editFactV, setEditFactV] = useState("");
  const [nuevoMes, setNuevoMes] = useState("");
  const [nuevoC, setNuevoC] = useState({ nombre:"", apellido:"" });

  const notify = useCallback((msg,ok=true)=>{ setToast({msg,ok}); setTimeout(()=>setToast(null),2800); },[]);
  const setF = useCallback((k,v)=>setForm(f=>({...f,[k]:v})),[]);

  // ── Carga inicial Supabase ───────────────────────────────────────────────────
  useEffect(()=>{
    async function cargar() {
      try {
        // Día de hoy
        const {data:dia} = await SB.from("dias").select("*").eq("fecha",hoy).single();
        if (dia) {
          setDiaId(dia.id);
          setCajaIni(dia.saldos_iniciales||Object.fromEntries(MONEDAS.map(m=>[m.id,""])));
          setSaldos(dia.saldos_finales||Object.fromEntries(MONEDAS.map(m=>[m.id,0])));
          setFact(dia.facturacion||{objetivo:"",meses:{}});
          setPosOvr(dia.pos_overrides||{});
          if (dia.saldos_finales) setPant("ops");
        }
        // Operaciones
        const {data:opsData} = await SB.from("operaciones").select("*").order("hora",{ascending:true});
        if (opsData) setOps(opsData.map(o=>({...o.datos, id:o.id, fecha:o.fecha, hora:o.hora, tipo:o.tipo})));
        // Diferidos
        const {data:difs} = await SB.from("diferidos").select("*");
        if (difs) setDiferidos(difs.map(d=>d.datos));
        // Clientes
        const {data:cls} = await SB.from("clientes").select("*,movimientos_cc(*)");
        if (cls) setClientes(cls.map(c=>({id:c.id,nombre:c.nombre,apellido:c.apellido,movimientos:(c.movimientos_cc||[]).map(m=>m.datos)})));
      } catch(e) { console.error(e); }
      setCargando(false);
    }
    cargar();
  },[]);

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const calcDif = useMemo(()=>{
    const n=parse(form.dn),tm=parse(form.dtm),tg=parse(form.dtg),dias=diasEntre(form.dfr,form.dfa);
    if (!n||!dias) return null;
    const postG=n*(1-tg/100),tasaD=(tm/360)*dias,mFinal=postG*(1-tasaD);
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
      return {modo,dir,cant,mM,mC,ganancia:gan,spread:dir==="vendo_base"?pm-pc:pc-pm,lM:dir==="vendo_base"?"Mercado te paga":"Le pagás al mercado",lC:dir==="vendo_base"?"Le pagás al cliente":"Le cobrás al cliente",mG:mQuote};
    }
    if (modo==="spread_precio") {
      const pc=parse(trade.prp),pv=parse(trade.pro); if (!pc||!pv) return null;
      return {modo,cant,costo:cant*pc,ingreso:cant*pv,ganancia:cant*pv-cant*pc,spread:((pv-pc)/pc)*100,pc,pv,mG:mQuote};
    }
    return null;
  },[trade]);

  const saldoCC = useCallback((c)=>{
    const s=Object.fromEntries(MONEDAS.map(m=>[m.id,0]));
    (c?.movimientos||[]).forEach(mv=>{ const ing=mv.tipo==="ingreso_transf"||mv.tipo==="ingreso_dep"; s[mv.moneda]=(s[mv.moneda]||0)+(ing?mv.monto:-mv.monto); });
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

  // ── Guardar día en Supabase ───────────────────────────────────────────────────
  async function guardarDia(nuevosSaldos, nuevaFact, nuevosOvr) {
    const payload = {
      fecha: hoy,
      saldos_iniciales: cajaIni,
      saldos_finales: nuevosSaldos || saldos,
      facturacion: nuevaFact || fact,
      pos_overrides: nuevosOvr || posOvr,
    };
    const {data} = await SB.from("dias").upsert(payload, {onConflict:"fecha"}).select().single();
    if (data) setDiaId(data.id);
  }

  // ── Acciones ─────────────────────────────────────────────────────────────────
  async function abrirCaja() {
    const s = Object.fromEntries(MONEDAS.map(m=>[m.id,parse(cajaIni[m.id])]));
    setSaldos(s);
    await guardarDia(s, null, null);
    setPant("ops"); notify("✅ Caja abierta");
  }

  async function registrarOp() {
    const {tipo}=form;
    const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    let opData = null;
    let nuevosSaldos = {...saldos};

    if (tipo==="compra"||tipo==="venta") {
      const m=parse(form.monto),m2=parse(form.monto2);
      if (!m||!m2) { notify("Ingresá montos válidos",false); return; }
      tipo==="compra"?(nuevosSaldos[form.moneda]+=m,nuevosSaldos[form.moneda2]-=m2):(nuevosSaldos[form.moneda]-=m,nuevosSaldos[form.moneda2]+=m2);
      opData={tipo,hora,moneda:form.moneda,monto:m,moneda2:form.moneda2,monto2:m2,cotizacion:parse(form.cotizacion),cliente:form.cliente,nota:form.nota};
      setF("monto",""); setF("monto2",""); setF("cotizacion","");
    } else if (tipo==="cheque_dia") {
      const cn=parse(form.cn),cpct=parse(form.cpct);
      if (!cn||!cpct) { notify("Ingresá nominal y %",false); return; }
      nuevosSaldos.ARS+=cn;
      opData={tipo,hora,cn,cpct,ccom:cn*cpct/100,monto:cn,cliente:form.cliente,nota:form.nota};
      setF("cn",""); setF("cpct","");
    } else if (tipo==="cheque_dif") {
      if (!calcDif) { notify("Completá todos los campos",false); return; }
      nuevosSaldos.ARS-=calcDif.mFinal;
      const dif={id:Date.now(),hora,fecha:hoy,cliente:form.cliente,nominal:calcDif.n,mFinal:calcDif.mFinal,ganancia:calcDif.ganancia,fechaAcr:form.dfa,tm:parse(form.dtm),dias:calcDif.dias,cobrado:false};
      await SB.from("diferidos").insert({datos:dif});
      setDiferidos(d=>[...d,dif]);
      opData={tipo,hora,dn:calcDif.n,montoFinal:calcDif.mFinal,dfa:form.dfa,monto:calcDif.mFinal,cliente:form.cliente,nota:form.nota};
      setF("dn",""); setF("dfa","");
    } else if (tipo==="transferencia") {
      const tn=parse(form.tn),tpct=parse(form.tpct);
      if (!tn||!tpct) { notify("Ingresá monto y %",false); return; }
      nuevosSaldos.ARS+=tn*tpct/100;
      opData={tipo,hora,tn,tpct,tcom:tn*tpct/100,monto:tn*tpct/100,cliente:form.cliente,nota:form.nota};
      setF("tn",""); setF("tpct","");
    }

    if (!opData) return;
    setSaldos(nuevosSaldos);
    const {data:ins} = await SB.from("operaciones").insert({fecha:hoy,hora,tipo,datos:opData}).select().single();
    if (ins) setOps(p=>[...p,{...opData,id:ins.id,fecha:hoy}]);
    await guardarDia(nuevosSaldos, null, null);
    notify("✅ Registrado"); setF("cliente",""); setF("nota","");
  }

  // ── Editar/eliminar operación de hoy ─────────────────────────────────────────
  async function guardarEdicionOp(opOriginal, datosNuevos) {
    const actualizada = {...opOriginal, ...datosNuevos, id:opOriginal.id, fecha:opOriginal.fecha};
    await SB.from("operaciones").update({hora:datosNuevos.hora, tipo:datosNuevos.tipo, datos:actualizada}).eq("id",opOriginal.id);
    setOps(p=>p.map(o=>o.id!==opOriginal.id?o:actualizada));
    setEditandoOp(null);
    notify("✅ Operación editada");
  }

  async function eliminarOpHoy(op) {
    if (!window.confirm("¿Eliminás esta operación? Los saldos NO se revierten automáticamente.")) return;
    await SB.from("operaciones").delete().eq("id",op.id);
    setOps(p=>p.filter(o=>o.id!==op.id));
    notify("✅ Eliminada");
  }

  async function cobrarDif(id) {
    const d=diferidos.find(x=>x.id===id); if(!d) return;
    const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    const nuevosSaldos={...saldos,ARS:saldos.ARS+d.nominal};
    setSaldos(nuevosSaldos);
    await SB.from("diferidos").update({datos:{...d,cobrado:true}}).eq("datos->>id",String(id));
    setDiferidos(p=>p.map(x=>x.id===id?{...x,cobrado:true}:x));
    const opData={tipo:"cobro_dif",hora,moneda:"ARS",monto:d.nominal,cliente:d.cliente,nota:"Cobro diferido $"+fmt(d.nominal)};
    const {data:ins} = await SB.from("operaciones").insert({fecha:hoy,hora,tipo:"cobro_dif",datos:opData}).select().single();
    if (ins) setOps(p=>[...p,{...opData,id:ins.id,fecha:hoy}]);
    await guardarDia(nuevosSaldos, null, null);
    notify("✅ Cobrado");
  }

  async function confirmarEditSaldo(mon) {
    const nv=parse(editSaldoV),delta=nv-saldos[mon];
    const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    const nuevosSaldos={...saldos,[mon]:nv};
    setSaldos(nuevosSaldos);
    const opData={tipo:"ajuste",hora,moneda:mon,monto:Math.abs(delta),delta,nota:"Ajuste "+(delta>=0?"+":"")+fmt(delta)+" "+mon};
    const {data:ins} = await SB.from("operaciones").insert({fecha:hoy,hora,tipo:"ajuste",datos:opData}).select().single();
    if (ins) setOps(p=>[...p,{...opData,id:ins.id,fecha:hoy}]);
    await guardarDia(nuevosSaldos, null, null);
    setEditSaldo(null); notify("✅ Ajustado");
  }

  async function regMovCC(cId) {
    const monto=parse(formCC.monto); if (!monto) { notify("Ingresá un monto",false); return; }
    const hora=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    const ing=formCC.tipo==="ingreso_transf"||formCC.tipo==="ingreso_dep";
    const nuevosSaldos={...saldos,[formCC.moneda]:saldos[formCC.moneda]+(ing?monto:-monto)};
    setSaldos(nuevosSaldos);
    const mv={id:Date.now(),hora,fecha:hoy,tipo:formCC.tipo,moneda:formCC.moneda,monto,nota:formCC.nota};
    await SB.from("movimientos_cc").insert({cliente_id:cId,datos:mv});
    setClientes(p=>p.map(c=>c.id!==cId?c:{...c,movimientos:[...c.movimientos,mv]}));
    await guardarDia(nuevosSaldos, null, null);
    setFormCC(f=>({...f,monto:"",nota:""}));
    notify("✅ Movimiento registrado");
  }

  async function agregarCliente() {
    if (!nuevoC.nombre.trim()) { notify("Ingresá un nombre",false); return; }
    const {data} = await SB.from("clientes").insert({nombre:nuevoC.nombre.trim(),apellido:nuevoC.apellido.trim()}).select().single();
    if (data) setClientes(p=>[...p,{id:data.id,nombre:data.nombre,apellido:data.apellido,movimientos:[]}]);
    setNuevoC({nombre:"",apellido:""}); notify("✅ Cliente agregado");
  }

  async function eliminarCliente(id) {
    if (!window.confirm("¿Eliminás este cliente y todos sus movimientos?")) return;
    await SB.from("movimientos_cc").delete().eq("cliente_id",id);
    await SB.from("clientes").delete().eq("id",id);
    setClientes(p=>p.filter(c=>c.id!==id));
    notify("✅ Cliente eliminado");
  }

  // ── Historial ─────────────────────────────────────────────────────────────────
  function cargarHistorial(fecha) {
    setHistFecha(fecha);
    setHistOps(ops.filter(o=>o.fecha===fecha));
    setHistModo("ver"); setHistEditando(null);
  }

  async function agregarOpHistorial(datos) {
    const {data:ins} = await SB.from("operaciones").insert({fecha:histFecha,hora:datos.hora,tipo:datos.tipo,datos}).select().single();
    const nueva = ins ? {...datos,id:ins.id,fecha:histFecha} : {...datos,id:Date.now(),fecha:histFecha};
    setOps(p=>[...p,nueva]);
    setHistOps(p=>[...p,nueva].sort((a,b)=>a.hora.localeCompare(b.hora)));
    setHistModo("ver"); notify("✅ Operación agregada");
  }

  async function editarOpHistorial(op, datos) {
    const actualizada={...op,...datos,fecha:histFecha};
    await SB.from("operaciones").update({hora:datos.hora,tipo:datos.tipo,datos:actualizada}).eq("id",op.id);
    setOps(p=>p.map(o=>o.id!==op.id?o:actualizada));
    setHistOps(p=>p.map(o=>o.id!==op.id?o:actualizada));
    setHistEditando(null); notify("✅ Operación editada");
  }

  async function eliminarOpHistorial(id) {
    if (!window.confirm("¿Eliminás esta operación?")) return;
    await SB.from("operaciones").delete().eq("id",id);
    setOps(p=>p.filter(o=>o.id!==id));
    setHistOps(p=>p.filter(o=>o.id!==id));
    notify("✅ Eliminada");
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  function renderOpRow(op, conAcciones=false, esHoy=false) {
    const t=TIPOS_OP[op.tipo]||{label:op.tipo,icon:"·",color:"#6b7280"};
    const m=MONEDAS.find(x=>x.id===op.moneda);
    return (
      <div key={op.id} style={{borderBottom:"1px solid #1a1a1a",padding:"7px 0",display:"flex",gap:8,alignItems:"flex-start"}}>
        <span style={{color:t.color,fontSize:14,marginTop:1}}>{t.icon}</span>
        <div style={{flex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
            <span style={{fontSize:11,color:t.color,fontWeight:700}}>{t.label}</span>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              <span style={{fontSize:10,color:"#4b5563"}}>{op.hora}</span>
              {(conAcciones||esHoy)&&<>
                <button onClick={()=>esHoy?setEditandoOp(op):setHistEditando(op)}
                  style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:"#0a1a2e",border:"1px solid #38bdf8",color:"#38bdf8",cursor:"pointer",fontFamily:"inherit"}}>✎</button>
                <button onClick={()=>esHoy?eliminarOpHoy(op):eliminarOpHistorial(op.id)}
                  style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:"#1c0a0a",border:"1px solid #f43f5e",color:"#f43f5e",cursor:"pointer",fontFamily:"inherit"}}>✕</button>
              </>}
            </div>
          </div>
          <div style={{fontSize:13,color:"#fff",fontWeight:700,marginTop:1}}>
            {op.tipo==="cheque_dia"&&`$${fmt(op.cn)} · ${op.cpct}% · com.$${fmt(op.ccom)}`}
            {op.tipo==="cheque_dif"&&`Pagó $${fmt(op.montoFinal)} · nominal $${fmt(op.dn)} · acredita ${op.dfa}`}
            {op.tipo==="transferencia"&&`$${fmt(op.tn)} · ${op.tpct}% · com.$${fmt(op.tcom)}`}
            {(op.tipo==="compra"||op.tipo==="venta")&&`${fmt(op.monto)} ${op.moneda} ↔ ${fmt(op.monto2)} ${op.moneda2}`}
            {!["cheque_dia","cheque_dif","transferencia","compra","venta"].includes(op.tipo)&&`${m?.simbolo}${fmt(op.monto)} ${op.moneda||""}`}
          </div>
          {(op.cliente||op.nota)&&<div style={{fontSize:11,color:"#4b5563",marginTop:1}}>{op.cliente?"👤 "+op.cliente:""}{op.cliente&&op.nota?" · ":""}{op.nota||""}</div>}
        </div>
      </div>
    );
  }

  const colorCC={ingreso_transf:"#34d399",ingreso_dep:"#34d399",retiro_transf:"#38bdf8",retiro_efectivo:"#f97316"};
  const labelCC={ingreso_transf:"↓ Me transfirió",ingreso_dep:"↓ Me depositó",retiro_transf:"↙ Le transferí",retiro_efectivo:"↑ Retiré efectivo"};
  const labelBtn={ingreso_transf:"↓ Recibí transferencia",ingreso_dep:"↓ Recibí depósito",retiro_transf:"↙ Envié transferencia",retiro_efectivo:"↑ Entregué efectivo"};
  const esIngCC=formCC.tipo==="ingreso_transf"||formCC.tipo==="ingreso_dep";
  const opsHoy=ops.filter(o=>o.fecha===hoy);

  const navItems=[
    {id:"ape",label:"Apertura",c:"#4ade80"},{id:"ops",label:"Operaciones",c:"#f59e0b"},
    {id:"libro",label:"Libro",c:"#38bdf8"},{id:"cartera",label:"Cartera",c:"#c084fc"},
    {id:"clientes",label:`Clientes${clientes.length?" ("+clientes.length+")":""}`,c:"#34d399"},
    {id:"trade",label:"⚡ Trade",c:"#f43f5e"},{id:"posicion",label:"Posición",c:"#e879f9"},
    {id:"historial",label:"📅 Historial",c:"#fb923c"},
    {id:"cierre",label:"Cierre",c:"#94a3b8"},
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

      {/* Modal editar op de hoy */}
      {editandoOp&&(
        <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontSize:11,color:"#38bdf8",marginBottom:10}}>✎ Editando operación de las {editandoOp.hora}</div>
            <FormOp
              fechaDefault={hoy}
              titulo="EDITAR OPERACIÓN DE HOY"
              color="#38bdf8"
              opInicial={editandoOp}
              onGuardar={(d)=>guardarEdicionOp(editandoOp,d)}
              onCancelar={()=>setEditandoOp(null)}
            />
          </div>
        </div>
      )}

      <nav style={S.nav}>
        <span style={{fontSize:9,letterSpacing:3,color:"#4b5563",marginRight:6,whiteSpace:"nowrap"}}>CAJA</span>
        {navItems.map(n=><button key={n.id} onClick={()=>setPant(n.id)} style={S.btn(pant===n.id,n.c)}>{n.label}</button>)}
      </nav>
      <main style={S.main}>

        {/* APERTURA */}
        {pant==="ape"&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#4ade80",marginBottom:4}}>APERTURA DE CAJA</div>
            <div style={{fontSize:12,color:"#4b5563",marginBottom:20}}>{fechaLarga}</div>
            <Card sx={{maxWidth:460}}>
              {MONEDAS.map(m=>(
                <div key={m.id} style={{marginBottom:11}}>
                  <Lbl>{m.id} — {m.label}</Lbl>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{color:m.color,fontWeight:700,width:20}}>{m.simbolo}</span>
                    <Inp type="number" placeholder="0" value={cajaIni[m.id]} onChange={e=>setCajaIni(c=>({...c,[m.id]:e.target.value}))}/>
                  </div>
                </div>
              ))}
              <button onClick={abrirCaja} style={{marginTop:8,width:"100%",padding:12,borderRadius:8,background:"#052e16",border:"1px solid #4ade80",color:"#4ade80",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:2}}>▶ ABRIR CAJA</button>
            </Card>
          </div>
        )}

        {/* OPERACIONES */}
        {pant==="ops"&&(
          <div style={S.grid("1fr 1fr",18)}>
            <div>
              <div style={{fontSize:10,letterSpacing:3,color:"#4b5563",marginBottom:10}}>SALDOS</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:18}}>
                {MONEDAS.map(m=>{ const v=saldos[m.id]||0,ed=editSaldo===m.id;
                  return (
                    <div key={m.id} style={{flex:"1 1 120px",background:"#111",border:"1px solid "+m.color+"33",borderRadius:8,padding:"10px 12px",cursor:ed?"default":"pointer"}}
                      onClick={()=>{if(!ed){setEditSaldo(m.id);setEditSaldoV(String(v));}}}>
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
              <div style={{fontSize:10,letterSpacing:3,color:"#4b5563",marginBottom:8}}>
                MOVIMIENTOS HOY ({opsHoy.length})
                <span style={{fontSize:9,color:"#374151",marginLeft:8}}>✎ editar · ✕ eliminar</span>
              </div>
              <div style={{maxHeight:420,overflowY:"auto"}}>
                {opsHoy.length===0&&<div style={{color:"#374151"}}>Sin operaciones</div>}
                {[...opsHoy].reverse().map(op=>renderOpRow(op,false,true))}
              </div>
            </div>
            <Card>
              <div style={{fontSize:10,letterSpacing:3,color:"#f59e0b",marginBottom:12}}>NUEVA OPERACIÓN</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
                {Object.entries(TIPOS_OP).filter(([id])=>!id.startsWith("cc_")&&id!=="ajuste"&&id!=="cobro_dif").map(([id,t])=>(
                  <button key={id} onClick={()=>setF("tipo",id)} style={S.btn(form.tipo===id,t.color)}>{t.icon} {t.label}</button>
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
                    <div><Lbl>Cotización</Lbl><Inp type="number" placeholder="0" value={form.cotizacion} onChange={e=>{setF("cotizacion",e.target.value);const m=parse(form.monto);if(m)setF("monto2",String(m*parse(e.target.value)));}}/></div>
                    <div><Lbl>Total</Lbl><Inp type="number" placeholder="0" value={form.monto2} onChange={e=>{setF("monto2",e.target.value);const m=parse(form.monto);if(m)setF("cotizacion",String(parse(e.target.value)/m));}}/></div>
                  </div>
                </div>
              )}
              {form.tipo==="cheque_dia"&&(
                <div style={S.grid("1fr 1fr",8)}>
                  <div><Lbl>Nominal ARS</Lbl><Inp type="number" value={form.cn} onChange={e=>setF("cn",e.target.value)}/></div>
                  <div><Lbl>Comisión %</Lbl><Inp type="number" value={form.cpct} onChange={e=>setF("cpct",e.target.value)}/></div>
                  {form.cn&&form.cpct&&<div style={{gridColumn:"1/-1",background:"#0a1a0a",border:"1px solid #22c55e33",borderRadius:6,padding:"8px",fontSize:12}}>
                    Com: <strong style={{color:"#4ade80"}}>${fmt(parse(form.cn)*parse(form.cpct)/100)}</strong> · Ingresa: <strong>${fmt(parse(form.cn))}</strong>
                  </div>}
                </div>
              )}
              {form.tipo==="cheque_dif"&&(
                <div>
                  <div style={S.grid("1fr 1fr 1fr",8)}>
                    <div><Lbl>Tasa mercado %</Lbl><Inp type="number" value={form.dtm} onChange={e=>setF("dtm",e.target.value)}/></div>
                    <div><Lbl>Tasa gestión %</Lbl><Inp type="number" value={form.dtg} onChange={e=>setF("dtg",e.target.value)}/></div>
                    <div><Lbl>Nominal</Lbl><Inp type="number" value={form.dn} onChange={e=>setF("dn",e.target.value)}/></div>
                    <div><Lbl>Fecha recepción</Lbl><Inp type="date" value={form.dfr} onChange={e=>setF("dfr",e.target.value)}/></div>
                    <div><Lbl>Fecha acreditación</Lbl><Inp type="date" value={form.dfa} onChange={e=>setF("dfa",e.target.value)}/></div>
                    <div style={{display:"flex",alignItems:"flex-end",paddingBottom:6}}><span style={{fontSize:11,color:"#6b7280"}}>{calcDif?.dias||0}d</span></div>
                  </div>
                  {calcDif&&<div style={{marginTop:8,background:"#0a0a0a",border:"1px solid #c084fc33",borderRadius:8,padding:10,...S.grid("1fr 1fr 1fr 1fr",6),fontSize:11}}>
                    {[["Post-gest.",fmt(calcDif.postG),"#9ca3af"],["Tasa",calcDif.tasaD.toFixed(2)+"%","#9ca3af"],["Pagás",fmt(calcDif.mFinal),"#f87171"],["Ganancia",fmt(calcDif.ganancia),"#4ade80"]].map(([k,v,c])=>(
                      <div key={k}><div style={{color:"#4b5563",marginBottom:2}}>{k}</div><div style={{color:c,fontWeight:700}}>${v}</div></div>
                    ))}
                  </div>}
                </div>
              )}
              {form.tipo==="transferencia"&&(
                <div style={S.grid("1fr 1fr",8)}>
                  <div><Lbl>Monto</Lbl><Inp type="number" value={form.tn} onChange={e=>setF("tn",e.target.value)}/></div>
                  <div><Lbl>Comisión %</Lbl><Inp type="number" value={form.tpct} onChange={e=>setF("tpct",e.target.value)}/></div>
                  {form.tn&&form.tpct&&<div style={{gridColumn:"1/-1",background:"#0a1a0a",border:"1px solid #22c55e33",borderRadius:6,padding:"8px",fontSize:12}}>
                    Ingresa: <strong style={{color:"#4ade80"}}>${fmt(parse(form.tn)*parse(form.tpct)/100)}</strong>
                  </div>}
                </div>
              )}
              <div style={{marginTop:10,...S.grid("1fr 1fr",8)}}>
                <div><Lbl>Cliente</Lbl><Inp placeholder="(opcional)" value={form.cliente} onChange={e=>setF("cliente",e.target.value)}/></div>
                <div><Lbl>Nota</Lbl><Inp placeholder="..." value={form.nota} onChange={e=>setF("nota",e.target.value)}/></div>
              </div>
              <button onClick={registrarOp} style={{marginTop:12,width:"100%",padding:11,borderRadius:7,background:"#0a1a0a",border:"1px solid #4ade80",color:"#4ade80",fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:2}}>✓ REGISTRAR</button>
            </Card>
          </div>
        )}

        {/* LIBRO */}
        {pant==="libro"&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#38bdf8",marginBottom:4}}>LIBRO DIARIO</div>
            <div style={{fontSize:12,color:"#4b5563",marginBottom:16}}>{fechaLarga} · {opsHoy.length} operaciones</div>
            <Card sx={{marginBottom:14,border:"1px solid #1e3a4a"}}>
              <div style={{fontSize:10,letterSpacing:3,color:"#38bdf8",marginBottom:10}}>▶ APERTURA</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {MONEDAS.map(m=>{ const v=parse(cajaIni[m.id]); if(!v) return null;
                  return <div key={m.id} style={{background:"#0a0a0a",border:"1px solid #1f2937",borderRadius:6,padding:"6px 10px"}}>
                    <span style={{fontSize:9,color:m.color,marginRight:6}}>{m.id}</span><span style={{fontWeight:700}}>{m.simbolo}{fmt(v)}</span>
                  </div>;})}
                {MONEDAS.every(m=>!parse(cajaIni[m.id]))&&<span style={{color:"#374151"}}>Caja en cero</span>}
              </div>
            </Card>
            {MONEDAS.map(m=>{ const mv=movPorMoneda[m.id]; if(!mv.ent.length&&!mv.sal.length) return null;
              const tE=mv.ent.reduce((s,o)=>s+(o.monto||0),0),tS=mv.sal.reduce((s,o)=>s+(o.monto||0),0);
              return (
                <Card key={m.id} sx={{marginBottom:10,border:"1px solid "+m.color+"22"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <span style={{fontSize:11,fontWeight:700,color:m.color}}>{m.id}</span>
                    <span style={{fontSize:11,color:"#6b7280"}}>{m.simbolo}{fmt(parse(cajaIni[m.id]))} → <strong style={{color:"#fff"}}>{fmt(saldos[m.id])}</strong></span>
                  </div>
                  <div style={S.grid("1fr 1fr",10)}>
                    <div><div style={{fontSize:9,color:"#4ade80",marginBottom:5}}>ENTRADAS +{m.simbolo}{fmt(tE)}</div>
                      {mv.ent.map(o=><div key={o.id} style={{fontSize:11,color:"#9ca3af",padding:"2px 0",borderBottom:"1px solid #1a1a1a"}}>{o.hora} · {TIPOS_OP[o.tipo]?.label} · <span style={{color:"#4ade80"}}>{m.simbolo}{fmt(o.monto)}</span></div>)}
                    </div>
                    <div><div style={{fontSize:9,color:"#f87171",marginBottom:5}}>SALIDAS -{m.simbolo}{fmt(tS)}</div>
                      {mv.sal.map(o=><div key={o.id} style={{fontSize:11,color:"#9ca3af",padding:"2px 0",borderBottom:"1px solid #1a1a1a"}}>{o.hora} · {TIPOS_OP[o.tipo]?.label} · <span style={{color:"#f87171"}}>{m.simbolo}{fmt(o.monto)}</span></div>)}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* CARTERA */}
        {pant==="cartera"&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#c084fc",marginBottom:18}}>CARTERA DE DIFERIDOS</div>
            {diferidos.filter(d=>!d.cobrado).length===0&&<div style={{color:"#374151"}}>Sin diferidos pendientes</div>}
            {[...diferidos.filter(d=>!d.cobrado)].sort((a,b)=>a.fechaAcr?.localeCompare(b.fechaAcr)).map(d=>{
              const dr=diasEntre(hoy,d.fechaAcr),venc=dr===0,urg=dr<=3&&!venc;
              return (
                <Card key={d.id} sx={{marginBottom:9,border:"1px solid "+(venc?"#f43f5e":urg?"#f59e0b":"#c084fc33")}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{display:"flex",gap:7,marginBottom:5,alignItems:"center"}}>
                        {venc&&<span style={{fontSize:10,background:"#f43f5e22",color:"#f43f5e",padding:"2px 7px",borderRadius:4,fontWeight:700}}>VENCIDO</span>}
                        {urg&&<span style={{fontSize:10,background:"#f59e0b22",color:"#f59e0b",padding:"2px 7px",borderRadius:4,fontWeight:700}}>VENCE EN {dr}d</span>}
                        {!venc&&!urg&&<span style={{fontSize:10,color:"#6b7280"}}>Acredita {d.fechaAcr} · {dr}d</span>}
                      </div>
                      <div style={{fontSize:14,fontWeight:700}}>${fmt(d.nominal)} <span style={{fontSize:11,color:"#6b7280"}}>nominal</span></div>
                      <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>Pagaste ${fmt(d.mFinal)} · Ganancia ${fmt(d.ganancia)} · {d.tm}% mercado{d.cliente?" · 👤 "+d.cliente:""}</div>
                    </div>
                    <button onClick={()=>cobrarDif(d.id)} style={{padding:"7px 12px",borderRadius:6,background:"#052e16",border:"1px solid #4ade80",color:"#4ade80",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer"}}>✓ Cobrar</button>
                  </div>
                </Card>
              );
            })}
            {diferidos.filter(d=>d.cobrado).length>0&&(
              <div style={{marginTop:20}}>
                <div style={{fontSize:10,letterSpacing:3,color:"#4b5563",marginBottom:8}}>COBRADOS</div>
                {diferidos.filter(d=>d.cobrado).map(d=>(
                  <div key={d.id} style={{padding:"6px 0",borderBottom:"1px solid #1a1a1a",fontSize:12,color:"#374151"}}>✓ ${fmt(d.nominal)} · {d.cliente||"—"} · {d.fechaAcr}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CLIENTES */}
        {pant==="clientes"&&!clienteActivo&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#34d399",marginBottom:18}}>CUENTAS CORRIENTES</div>
            <Card sx={{maxWidth:380,marginBottom:18}}>
              <div style={{fontSize:10,letterSpacing:3,color:"#34d399",marginBottom:10}}>NUEVO CLIENTE</div>
              <div style={S.grid("1fr 1fr",8)}>
                <div><Lbl>Nombre</Lbl><Inp placeholder="Juan" value={nuevoC.nombre} onChange={e=>setNuevoC(n=>({...n,nombre:e.target.value}))}/></div>
                <div><Lbl>Apellido</Lbl><Inp placeholder="García" value={nuevoC.apellido} onChange={e=>setNuevoC(n=>({...n,apellido:e.target.value}))}/></div>
              </div>
              <button onClick={agregarCliente} style={{marginTop:9,width:"100%",padding:9,borderRadius:6,background:"#052e16",border:"1px solid #34d399",color:"#34d399",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Agregar cliente</button>
            </Card>
            {clientes.length===0&&<div style={{color:"#374151"}}>Sin clientes</div>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:9}}>
              {clientes.map(c=>{ const sal=saldoCC(c);
                return (
                  <Card key={c.id} sx={{position:"relative"}}>
                    <button onClick={e=>{e.stopPropagation();eliminarCliente(c.id);}} title="Eliminar cliente"
                      style={{position:"absolute",top:9,right:9,width:20,height:20,borderRadius:4,background:"transparent",border:"1px solid #374151",color:"#4b5563",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>✕</button>
                    <div style={{cursor:"pointer",paddingRight:26}} onClick={()=>{setClienteActivo(c.id);setFormCC({tipo:"ingreso_transf",moneda:"ARS",monto:"",nota:""});}}>
                      <div style={{fontWeight:700,marginBottom:7}}>{c.nombre} {c.apellido}</div>
                      {MONEDAS.map(m=>{ const v=sal[m.id]; if(!v) return null;
                        return <div key={m.id} style={{fontSize:11,color:v>0?"#f87171":"#4ade80",marginBottom:2}}>{v>0?"Le debés":"Te debe"} {m.simbolo}{fmt(Math.abs(v))} {m.id}</div>;})}
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
              <button onClick={()=>setClienteActivo(null)} style={{...S.btn(false),marginBottom:14}}>← Volver</button>
              <div style={{fontSize:15,fontWeight:700,marginBottom:7}}>{c.nombre} {c.apellido}</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:18}}>
                {MONEDAS.map(m=>{ const v=sal[m.id]; if(!v) return null;
                  return <div key={m.id} style={{background:"#111",border:"1px solid "+(v>0?"#f4433633":"#22c55e33"),borderRadius:6,padding:"7px 11px"}}>
                    <div style={{fontSize:9,color:"#6b7280",marginBottom:2}}>{m.id}</div>
                    <div style={{fontWeight:700,color:v>0?"#f87171":"#4ade80"}}>{v>0?"Le debés":"Te debe"} {m.simbolo}{fmt(Math.abs(v))}</div>
                  </div>;})}
              </div>
              <div style={S.grid("1fr 1fr",18)}>
                <Card>
                  <div style={{fontSize:10,letterSpacing:3,color:"#34d399",marginBottom:12}}>NUEVO MOVIMIENTO</div>
                  <div style={{marginBottom:9}}>
                    <div style={{fontSize:9,letterSpacing:2,color:"#34d399",marginBottom:5}}>INGRESO — RECIBÍS PLATA</div>
                    <div style={{display:"flex",gap:5}}>
                      {[{id:"ingreso_transf",label:"↓ Transferencia"},{id:"ingreso_dep",label:"↓ Depósito"}].map(t=>(
                        <button key={t.id} onClick={()=>setFormCC(f=>({...f,tipo:t.id}))} style={{...S.btn(formCC.tipo===t.id,"#34d399"),flex:1}}>{t.label}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:9,letterSpacing:2,color:"#f97316",marginBottom:5}}>RETIRO / PAGO — MANDÁS PLATA</div>
                    <div style={{display:"flex",gap:5}}>
                      {[{id:"retiro_transf",label:"↙ Transferencia",c:"#38bdf8"},{id:"retiro_efectivo",label:"↑ Efectivo",c:"#f97316"}].map(t=>(
                        <button key={t.id} onClick={()=>setFormCC(f=>({...f,tipo:t.id}))} style={{...S.btn(formCC.tipo===t.id,t.c),flex:1}}>{t.label}</button>
                      ))}
                    </div>
                  </div>
                  <div style={S.grid("80px 1fr",8)}>
                    <div><Lbl>Moneda</Lbl><MonedasSel value={formCC.moneda} onChange={v=>setFormCC(f=>({...f,moneda:v}))}/></div>
                    <div><Lbl>Monto</Lbl><Inp type="number" placeholder="0" value={formCC.monto} onChange={e=>setFormCC(f=>({...f,monto:e.target.value}))}/></div>
                  </div>
                  <div style={{marginTop:8,marginBottom:10}}><Lbl>Nota</Lbl><Inp placeholder="Descripción..." value={formCC.nota} onChange={e=>setFormCC(f=>({...f,nota:e.target.value}))}/></div>
                  <button onClick={()=>regMovCC(c.id)} style={{width:"100%",padding:10,borderRadius:7,background:esIngCC?"#052e16":formCC.tipo==="retiro_transf"?"#0a1e2e":"#1c0a0a",border:"1px solid "+colorCC[formCC.tipo],color:colorCC[formCC.tipo],fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    {labelBtn[formCC.tipo]}
                  </button>
                </Card>
                <Card sx={{maxHeight:460,overflowY:"auto"}}>
                  <div style={{fontSize:10,letterSpacing:3,color:"#6b7280",marginBottom:12}}>HISTORIAL COMPLETO ({c.movimientos.length})</div>
                  {c.movimientos.length===0&&<div style={{color:"#374151"}}>Sin movimientos</div>}
                  {[...c.movimientos].reverse().map(mv=>{ const mon=MONEDAS.find(m=>m.id===mv.moneda);
                    return (
                      <div key={mv.id} style={{borderBottom:"1px solid #1a1a1a",paddingBottom:9,marginBottom:9}}>
                        <div style={{display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontSize:12,fontWeight:700,color:colorCC[mv.tipo]||"#6b7280"}}>{labelCC[mv.tipo]||mv.tipo}</span>
                          <span style={{fontSize:10,color:"#4b5563"}}>{mv.fecha} {mv.hora}</span>
                        </div>
                        <div style={{fontSize:13,fontWeight:700,color:"#fff",marginTop:2}}>{mon?.simbolo}{fmt(mv.monto)} {mv.moneda}</div>
                        {mv.nota&&<div style={{fontSize:11,color:"#4b5563",marginTop:1}}>{mv.nota}</div>}
                      </div>
                    );
                  })}
                </Card>
              </div>
            </div>
          );
        })()}

        {/* TRADE */}
        {pant==="trade"&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#f43f5e",marginBottom:4}}>⚡ MESA DE NEGOCIACIÓN</div>
            <div style={{fontSize:12,color:"#4b5563",marginBottom:18}}>Cálculo informativo — no impacta en caja</div>
            <div style={S.grid("1fr 1fr",18)}>
              <Card sx={{border:"1px solid #f43f5e33"}}>
                <Lbl>Tipo de operación</Lbl>
                <div style={{display:"flex",gap:5,marginBottom:14}}>
                  {[["spread_pct","% nominal","USDT↔USD/ARS"],["spread_precio","Por precio","USD↔ARS"],["cadena","Cadena","USDT→USD→ARS"]].map(([id,lbl,sub])=>(
                    <button key={id} onClick={()=>setTrade(t=>({...t,modo:id}))} style={{flex:1,padding:"8px 4px",borderRadius:7,border:"1px solid",borderColor:trade.modo===id?"#f43f5e":"#1f2937",background:trade.modo===id?"#f43f5e18":"transparent",color:trade.modo===id?"#f87171":"#4b5563",fontFamily:"inherit",cursor:"pointer",textAlign:"center"}}>
                      <div style={{fontSize:11,fontWeight:700}}>{lbl}</div><div style={{fontSize:9,marginTop:1,opacity:.7}}>{sub}</div>
                    </button>
                  ))}
                </div>
                {trade.modo==="cadena"&&(
                  <div>
                    <div style={{display:"flex",gap:5,alignItems:"center",background:"#0d0d0d",borderRadius:6,padding:"7px 10px",marginBottom:12,fontSize:11}}>
                      <span style={{color:"#2dd4bf",fontWeight:700}}>USDT</span><span style={{color:"#374151"}}>─{trade.cPm||"?"}%▶</span>
                      <span style={{color:"#4ade80",fontWeight:700}}>USD</span><span style={{color:"#374151"}}>─${trade.cCot||"?"}▶</span>
                      <span style={{color:"#f59e0b",fontWeight:700}}>ARS</span>
                    </div>
                    <div style={{marginBottom:8}}><Lbl>Cantidad USDT</Lbl><Inp type="number" placeholder="50000" value={trade.cCant} onChange={e=>setTrade(t=>({...t,cCant:e.target.value}))}/></div>
                    <div style={S.grid("1fr 1fr",8)}>
                      <div><Lbl>Mercado te paga %</Lbl><Inp type="number" placeholder="1.5" value={trade.cPm} onChange={e=>setTrade(t=>({...t,cPm:e.target.value}))} sx={{color:"#4ade80"}}/></div>
                      <div><Lbl>Le reconocés %</Lbl><Inp type="number" placeholder="1.0" value={trade.cPc} onChange={e=>setTrade(t=>({...t,cPc:e.target.value}))} sx={{color:"#f87171"}}/></div>
                    </div>
                    <div style={{marginTop:7}}><Lbl>Cotización USD→ARS</Lbl><Inp type="number" placeholder="1425" value={trade.cCot} onChange={e=>setTrade(t=>({...t,cCot:e.target.value}))} sx={{color:"#fde68a"}}/></div>
                  </div>
                )}
                {trade.modo==="spread_pct"&&(
                  <div>
                    <div style={{display:"flex",gap:5,marginBottom:12}}>
                      {[["vendo_base","↓ Vende "+trade.mBase],["compro_base","↑ Compra "+trade.mBase]].map(([id,lbl])=>(
                        <button key={id} onClick={()=>setTrade(t=>({...t,dir:id}))} style={{...S.btn(trade.dir===id,"#38bdf8"),flex:1}}>{lbl}</button>
                      ))}
                    </div>
                    <div style={S.grid("1fr 1fr",8)}>
                      <div><Lbl>Moneda base</Lbl><MonedasSel value={trade.mBase} onChange={v=>setTrade(t=>({...t,mBase:v}))}/></div>
                      <div><Lbl>Cotización en</Lbl><MonedasSel value={trade.mQuote} onChange={v=>setTrade(t=>({...t,mQuote:v}))} exclude={trade.mBase}/></div>
                    </div>
                    <div style={{marginTop:7,...S.grid("1fr 1fr 1fr",8)}}>
                      <div><Lbl>Cantidad</Lbl><Inp type="number" value={trade.cant} onChange={e=>setTrade(t=>({...t,cant:e.target.value}))}/></div>
                      <div><Lbl>{trade.dir==="vendo_base"?"Mercado %":"Cobra %"}</Lbl><Inp type="number" value={trade.pp} onChange={e=>setTrade(t=>({...t,pp:e.target.value}))} sx={{color:"#4ade80"}}/></div>
                      <div><Lbl>{trade.dir==="vendo_base"?"Cliente %":"Cobro %"}</Lbl><Inp type="number" value={trade.po} onChange={e=>setTrade(t=>({...t,po:e.target.value}))} sx={{color:"#f87171"}}/></div>
                    </div>
                  </div>
                )}
                {trade.modo==="spread_precio"&&(
                  <div>
                    <div style={S.grid("1fr 1fr",8)}>
                      <div><Lbl>Moneda base</Lbl><MonedasSel value={trade.mBase} onChange={v=>setTrade(t=>({...t,mBase:v}))}/></div>
                      <div><Lbl>Cotización en</Lbl><MonedasSel value={trade.mQuote} onChange={v=>setTrade(t=>({...t,mQuote:v}))} exclude={trade.mBase}/></div>
                    </div>
                    <div style={{marginTop:7,...S.grid("1fr 1fr 1fr",8)}}>
                      <div><Lbl>Cantidad</Lbl><Inp type="number" value={trade.cant} onChange={e=>setTrade(t=>({...t,cant:e.target.value}))}/></div>
                      <div><Lbl>Precio compra</Lbl><Inp type="number" value={trade.prp} onChange={e=>setTrade(t=>({...t,prp:e.target.value}))} sx={{color:"#4ade80"}}/></div>
                      <div><Lbl>Precio venta</Lbl><Inp type="number" value={trade.pro} onChange={e=>setTrade(t=>({...t,pro:e.target.value}))} sx={{color:"#f87171"}}/></div>
                    </div>
                  </div>
                )}
                {calcTrade?(
                  <div style={{marginTop:14,background:calcTrade.ganancia>0?"#0a1a0a":"#1c0a0a",border:"1px solid "+(calcTrade.ganancia>0?"#22c55e44":"#f4433644"),borderRadius:8,padding:12}}>
                    {calcTrade.modo==="cadena"&&<div style={{textAlign:"center",marginBottom:10}}>
                      <div style={{fontSize:9,color:"#a78bfa",letterSpacing:2,marginBottom:3}}>TIPO DE CAMBIO IMPLÍCITO</div>
                      <div style={{fontSize:22,fontWeight:700,color:"#c4b5fd"}}>1 USDT = ${fmt(calcTrade.tc)} ARS</div>
                    </div>}
                    <div style={{...S.grid("1fr 1fr 1fr",7),fontSize:11,marginBottom:10}}>
                      {calcTrade.modo==="cadena"&&[["USD mercado",fmt(calcTrade.uB)+" USD","#4ade80"],["USD cliente",fmt(calcTrade.uC)+" USD","#f87171"],["ARS entregás","$"+fmt(calcTrade.ars),"#fde68a"]].map(([k,v,c])=><div key={k}><div style={{color:"#4b5563",marginBottom:1}}>{k}</div><div style={{color:c,fontWeight:700}}>{v}</div></div>)}
                      {calcTrade.modo==="spread_pct"&&[[calcTrade.lM,fmt(calcTrade.mM)+" "+trade.mQuote,"#4ade80"],[calcTrade.lC,fmt(calcTrade.mC)+" "+trade.mQuote,"#f87171"],["Spread",calcTrade.spread.toFixed(2)+"%","#f59e0b"]].map(([k,v,c])=><div key={k}><div style={{color:"#4b5563",marginBottom:1}}>{k}</div><div style={{color:c,fontWeight:700}}>{v}</div></div>)}
                      {calcTrade.modo==="spread_precio"&&[["Costo",fmt(calcTrade.costo)+" "+trade.mQuote,"#f87171"],["Ingreso",fmt(calcTrade.ingreso)+" "+trade.mQuote,"#4ade80"],["Spread",calcTrade.spread.toFixed(2)+"%","#f59e0b"]].map(([k,v,c])=><div key={k}><div style={{color:"#4b5563",marginBottom:1}}>{k}</div><div style={{color:c,fontWeight:700}}>{v}</div></div>)}
                    </div>
                    <div style={{borderTop:"1px solid #1f2937",paddingTop:9,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:9,color:"#6b7280",marginBottom:2}}>{calcTrade.ganancia>0?"✅ Ganancia neta":"⚠ Pérdida"}</div>
                        <div style={{fontSize:20,fontWeight:700,color:calcTrade.ganancia>0?"#4ade80":"#f43f5e"}}>{calcTrade.ganancia>0?"+":""}{fmt(calcTrade.ganancia)} {calcTrade.mG}</div>
                      </div>
                      <button onClick={()=>{const h=new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});setTradeHist(p=>[{id:Date.now(),hora:h,mBase:trade.mBase,mQuote:trade.mQuote,...calcTrade},...p]);notify("✅ Guardado");}} style={{padding:"8px 13px",borderRadius:6,background:"#0a1a0a",border:"1px solid #22c55e",color:"#4ade80",fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer"}}>💾 Guardar</button>
                    </div>
                  </div>
                ):(
                  <div style={{marginTop:14,background:"#0d0d0d",border:"1px dashed #1f2937",borderRadius:8,padding:18,textAlign:"center",color:"#374151",fontSize:12}}>Completá los campos para ver el resultado</div>
                )}
              </Card>
              <Card sx={{maxHeight:560,overflowY:"auto"}}>
                <div style={{fontSize:10,letterSpacing:3,color:"#6b7280",marginBottom:12}}>NEGOCIACIONES ({tradeHist.length})</div>
                {tradeHist.length===0&&<div style={{color:"#374151",fontSize:12}}>Sin negociaciones</div>}
                {tradeHist.map(t=>{ const mq=MONEDAS.find(m=>m.id===t.mG);
                  return (<div key={t.id} style={{borderBottom:"1px solid #1a1a1a",paddingBottom:9,marginBottom:9}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:12,fontWeight:700}}>{t.modo==="cadena"?fmt(t.cant)+" USDT→ARS":fmt(t.cant)+" "+t.mBase+"↔"+t.mQuote}</span>
                      <span style={{fontSize:10,color:"#4b5563"}}>{t.hora}</span>
                    </div>
                    <div style={{fontSize:13,fontWeight:700,color:t.ganancia>0?"#4ade80":"#f43f5e"}}>{t.ganancia>0?"+":""}{mq?.simbolo}{fmt(t.ganancia)} {t.mG} · {t.spread?.toFixed(2)}%</div>
                  </div>);
                })}
              </Card>
            </div>
          </div>
        )}

        {/* POSICIÓN */}
        {pant==="posicion"&&(()=>{
          const getS=(cId,mId)=>{ const k=cId+"_"+mId; return posOvr[k]!==undefined?posOvr[k]:(saldoCC(clientes.find(x=>x.id===cId))[mId]||0); };
          const tots=Object.fromEntries(MONEDAS.map(m=>[m.id,clientes.reduce((s,c)=>s+getS(c.id,m.id),0)]));
          const meses=Object.entries(fact.meses||{});
          const ganAcum=meses.reduce((s,[,v])=>s+parse(v),0),obj=parse(fact.objetivo);
          return (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:14}}>
                <div>
                  <div style={{fontSize:10,letterSpacing:3,color:"#e879f9"}}>POSICIÓN CONSOLIDADA</div>
                  <div style={{fontSize:12,color:"#4b5563",marginTop:2}}>{fechaLarga}</div>
                </div>
                <Card sx={{border:"1px solid #e879f933",minWidth:190}}>
                  <div style={{fontSize:10,letterSpacing:3,color:"#e879f9",marginBottom:10}}>FACTURACIÓN</div>
                  {meses.map(([mes,val])=>(
                    <div key={mes} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid #1a1a1a"}}>
                      <span style={{fontSize:11,color:"#9ca3af"}}>{mes}</span>
                      {editFact===mes?(
                        <input autoFocus type="number" value={editFactV} onChange={e=>setEditFactV(e.target.value)}
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
                    {[["Ganancia acum.",fmt(ganAcum),ganAcum>=0?"#4ade80":"#f87171"],["Objetivo",obj?fmt(obj):"— clic","#9ca3af","__obj__"],["Resta",fmt(obj-ganAcum),obj-ganAcum<=0?"#4ade80":"#f87171"]].map(([k,v,c,ek])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}>
                        <span style={{fontSize:11,color:"#6b7280"}}>{k}</span>
                        {editFact==="__obj__"&&ek?(
                          <input autoFocus type="number" value={editFactV} onChange={e=>setEditFactV(e.target.value)}
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
                    <th style={{textAlign:"left",padding:"7px 10px",borderBottom:"2px solid #1f2937",color:"#4b5563",fontSize:10,letterSpacing:2}}>CLIENTE</th>
                    {MONEDAS.map(m=><th key={m.id} style={{textAlign:"right",padding:"7px 10px",borderBottom:"2px solid #1f2937",color:m.color,fontSize:10,letterSpacing:2}}>{m.id}</th>)}
                  </tr></thead>
                  <tbody>
                    {clientes.length===0&&<tr><td colSpan={7} style={{padding:28,textAlign:"center",color:"#374151"}}>No hay clientes</td></tr>}
                    {clientes.map((c,i)=>(
                      <tr key={c.id} style={{background:i%2===0?"#0d0d0d":"#111"}}>
                        <td style={{padding:"8px 10px",fontWeight:600}}>{c.nombre} {c.apellido}</td>
                        {MONEDAS.map(m=>{ const key=c.id+"_"+m.id,val=getS(c.id,m.id),isEd=editCell?.cId===c.id&&editCell?.mId===m.id;
                          return (<td key={m.id} style={{textAlign:"right",padding:"8px 10px",cursor:"pointer"}} onClick={()=>{if(!isEd){setEditCell({cId:c.id,mId:m.id});setEditCellV(String(val));}}}>
                            {isEd?(<input autoFocus type="number" value={editCellV} onChange={e=>setEditCellV(e.target.value)}
                              onKeyDown={e=>{if(e.key==="Enter"){const no={...posOvr,[key]:parse(editCellV)};setPosOvr(no);guardarDia(null,null,no);setEditCell(null);}if(e.key==="Escape")setEditCell(null);}}
                              onBlur={()=>{const no={...posOvr,[key]:parse(editCellV)};setPosOvr(no);guardarDia(null,null,no);setEditCell(null);}}
                              style={{width:85,background:"transparent",border:"none",borderBottom:"1px solid #a78bfa",outline:"none",color:"#fff",fontFamily:"inherit",fontSize:12,fontWeight:700,textAlign:"right"}}/>
                            ):(<span style={{color:val>0?"#4ade80":val<0?"#f87171":"#374151",fontWeight:val!==0?700:400,borderBottom:posOvr[key]!==undefined?"1px dashed #a78bfa":"none"}}>{val!==0?fmt(val):"—"}</span>)}
                          </td>);
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{borderTop:"2px solid #374151",background:"#0a0a0a"}}>
                    <td style={{padding:"9px 10px",fontSize:9,letterSpacing:2,color:"#6b7280"}}>TOTAL</td>
                    {MONEDAS.map(m=><td key={m.id} style={{textAlign:"right",padding:"9px 10px"}}>
                      <span style={{fontSize:13,fontWeight:700,color:tots[m.id]>0?"#4ade80":tots[m.id]<0?"#f87171":"#374151"}}>{tots[m.id]!==0?fmt(tots[m.id]):"—"}</span>
                    </td>)}
                  </tr></tfoot>
                </table>
              </div>
              <div style={{marginTop:8,fontSize:10,color:"#374151"}}>🟢 te deben · 🔴 les debés · violeta = editado · clic para editar</div>
            </div>
          );
        })()}

        {/* HISTORIAL */}
        {pant==="historial"&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#fb923c",marginBottom:4}}>📅 HISTORIAL</div>
            <div style={{fontSize:12,color:"#4b5563",marginBottom:18}}>Consultá, agregá, editá o eliminá operaciones de días anteriores</div>
            <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:20,flexWrap:"wrap"}}>
              <div style={{flex:"1 1 240px",maxWidth:340}}>
                <Lbl>Elegí un día</Lbl>
                <Sel value={histFecha} onChange={e=>cargarHistorial(e.target.value)}>
                  <option value="">-- seleccioná una fecha --</option>
                  {histDias.length===0&&<option disabled>Registrá operaciones primero</option>}
                  {histDias.map(d=><option key={d} value={d}>{fmtFecha(d)}{d===hoy?" (hoy)":""}</option>)}
                </Sel>
              </div>
              {histFecha&&(
                <button onClick={()=>setHistModo(m=>m==="agregar"?"ver":"agregar")} style={{padding:"8px 16px",borderRadius:7,background:histModo==="agregar"?"#1c0a0a":"#0a1a0a",border:"1px solid "+(histModo==="agregar"?"#f43f5e":"#fb923c"),color:histModo==="agregar"?"#f87171":"#fb923c",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  {histModo==="agregar"?"✕ Cancelar":"+ Agregar operación"}
                </button>
              )}
            </div>
            {histFecha&&histModo==="agregar"&&(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:11,color:"#fb923c",marginBottom:10}}>Agregando en: <strong>{fmtFecha(histFecha)}</strong></div>
                <FormOp fechaDefault={histFecha} titulo="NUEVA OPERACIÓN EN FECHA PASADA" color="#fb923c" onGuardar={agregarOpHistorial} onCancelar={()=>setHistModo("ver")}/>
              </div>
            )}
            {histEditando&&(
              <div style={{marginBottom:20}}>
                <div style={{fontSize:11,color:"#38bdf8",marginBottom:10}}>✎ Editando operación de las {histEditando.hora}</div>
                <FormOp fechaDefault={histFecha} titulo="EDITAR OPERACIÓN" color="#38bdf8" opInicial={histEditando} onGuardar={(d)=>editarOpHistorial(histEditando,d)} onCancelar={()=>setHistEditando(null)}/>
              </div>
            )}
            {histFecha&&!histEditando&&histModo==="ver"&&(
              <div>
                {histOps.length===0&&<div style={{color:"#374151"}}>Sin operaciones ese día — podés agregar con el botón de arriba</div>}
                {histOps.length>0&&<>
                  <div style={{fontSize:10,letterSpacing:3,color:"#4b5563",marginBottom:10}}>OPERACIONES ({histOps.length}) <span style={{fontSize:9,color:"#374151"}}>· ✎ editar · ✕ eliminar</span></div>
                  {histOps.map(op=>renderOpRow(op,true,false))}
                </>}
              </div>
            )}
            {!histFecha&&<div style={{color:"#374151",fontSize:12}}>
              {histDias.length===0?"Todavía no hay días registrados. Abrí la caja y registrá operaciones primero.":"Seleccioná un día para ver o editar sus operaciones."}
            </div>}
          </div>
        )}

        {/* CIERRE */}
        {pant==="cierre"&&(
          <div>
            <div style={{fontSize:10,letterSpacing:3,color:"#94a3b8",marginBottom:18}}>CIERRE — {fechaLarga}</div>
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
                    <span style={{fontSize:12,color:t.color}}>{t.icon} {t.label}</span><span style={{fontSize:12,color:"#6b7280"}}>{n}x</span>
                  </div>;})}
                {opsHoy.length===0&&<div style={{color:"#374151",fontSize:12}}>Sin operaciones</div>}
              </Card>
              {diferidos.filter(d=>!d.cobrado).length>0&&(
                <Card>
                  <div style={{fontSize:10,letterSpacing:3,color:"#c084fc",marginBottom:12}}>DIFERIDOS PENDIENTES</div>
                  {diferidos.filter(d=>!d.cobrado).map(d=>(
                    <div key={d.id} style={{padding:"5px 0",borderBottom:"1px solid #1a1a1a"}}>
                      <div style={{fontSize:12,fontWeight:700}}>${fmt(d.nominal)}</div>
                      <div style={{fontSize:11,color:"#6b7280"}}>{d.cliente||"—"} · {d.fechaAcr}</div>
                    </div>
                  ))}
                  <div style={{marginTop:8,fontSize:12,color:"#c084fc",fontWeight:700}}>Total: ${fmt(diferidos.filter(d=>!d.cobrado).reduce((s,d)=>s+d.nominal,0))}</div>
                </Card>
              )}
              {(()=>{ const deudas=MONEDAS.map(m=>({m,tot:clientes.reduce((s,c)=>s+(saldoCC(c)[m.id]||0),0)})).filter(x=>x.tot!==0); if(!deudas.length) return null;
                return (<Card>
                  <div style={{fontSize:10,letterSpacing:3,color:"#34d399",marginBottom:12}}>CUENTAS CORRIENTES</div>
                  {deudas.map(({m,tot})=>(
                    <div key={m.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #1a1a1a"}}>
                      <span style={{fontSize:11,color:m.color}}>{m.id}</span>
                      <span style={{fontSize:12,fontWeight:700,color:tot>0?"#f87171":"#4ade80"}}>{tot>0?"Les debés":"Te deben"} {m.simbolo}{fmt(Math.abs(tot))}</span>
                    </div>
                  ))}
                </Card>);
              })()}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
