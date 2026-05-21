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
