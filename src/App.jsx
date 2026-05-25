import { useState, useRef, useEffect } from "react";
import {
  Ticket, Users, CreditCard, BarChart3, QrCode, LogOut,
  Plus, Check, X, Eye, EyeOff, Scan, Calendar, MapPin,
  MessageSquare, Settings, CheckCircle, XCircle, Clock,
  AlertCircle, Zap, RefreshCw, Send, UserPlus, Layers,
  DollarSign, TrendingUp, ChevronRight, Phone, Shield,
  Activity, Star, Bell, Hash, Bot
} from "lucide-react";

/* ─── fonts ─────────────────────────────────────────────────── */
const GFONTS = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body,*{font-family:'DM Sans',sans-serif}
.syne{font-family:'Syne',sans-serif}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:#0A0A12}
::-webkit-scrollbar-thumb{background:#252535;border-radius:2px}
input,select,textarea{outline:none;font-family:'DM Sans',sans-serif}
input[type=number]::-webkit-inner-spin-button{opacity:0}`;

/* ─── utils ──────────────────────────────────────────────────── */
const UGX = n => `UGX ${Number(n).toLocaleString()}`;
const newId = arr => arr.length ? Math.max(...arr.map(o => o.id)) + 1 : 1;
const ticketId = () => `BZK-${Math.random().toString(36).slice(2,7).toUpperCase()}`;

/* ─── colors ─────────────────────────────────────────────────── */
const C = {
  bg:     "#08080F",
  surface:"#0F0F1A",
  card:   "#131320",
  border: "#1E1E30",
  border2:"#2A2A40",
  accent: "#F97316",
  accent2:"#EF4444",
  green:  "#10B981",
  blue:   "#3B82F6",
  amber:  "#F59E0B",
  purple: "#8B5CF6",
  text:   "#FFFFFF",
  muted:  "#71717A",
  dim:    "#3F3F50",
};

/* ─── seed data ──────────────────────────────────────────────── */
const SEED_ORGS = [
  {id:1,name:"Kampala Events Ltd",email:"kampala@events.ug",password:"pass123",phone:"+256701234567",merchant:"KE4521",commPct:5,commFixed:2000,active:true},
  {id:2,name:"Nile Promotions",email:"nile@promo.ug",password:"pass456",phone:"+256782345678",merchant:"NP7823",commPct:4,commFixed:1500,active:true},
];
const SEED_EVENTS = [
  {id:1,orgId:1,name:"Afrobeats Night",venue:"Kampala Serena Hotel",date:"2025-06-14",time:"20:00",capacity:500,status:"published"},
  {id:2,orgId:1,name:"Jazz & Wine Evening",venue:"Garden City Rooftop",date:"2025-06-28",time:"18:00",capacity:200,status:"published"},
  {id:3,orgId:2,name:"Comedy Nite Vol. 5",venue:"Entebbe Resort",date:"2025-07-05",time:"19:00",capacity:350,status:"published"},
];
const SEED_TIERS = [
  {id:1,eventId:1,name:"VIP",price:80000,total:100,sold:45},
  {id:2,eventId:1,name:"Regular",price:30000,total:400,sold:178},
  {id:3,eventId:2,name:"VIP",price:120000,total:50,sold:22},
  {id:4,eventId:2,name:"Regular",price:50000,total:150,sold:67},
  {id:5,eventId:3,name:"VIP",price:60000,total:80,sold:33},
  {id:6,eventId:3,name:"Regular",price:25000,total:270,sold:121},
];
const SEED_ORDERS = [
  {id:1,name:"John Mukasa",wa:"+256701111111",eventId:1,tierId:2,qty:2,total:60000,tid:"TID8473625910",status:"approved",at:"20 May, 14:32"},
  {id:2,name:"Sarah Namukasa",wa:"+256782222222",eventId:1,tierId:1,qty:1,total:80000,tid:"TID9182736450",status:"pending",at:"21 May, 09:15"},
  {id:3,name:"David Ochieng",wa:"+256753333333",eventId:2,tierId:3,qty:2,total:240000,tid:"TID1029384756",status:"pending",at:"21 May, 11:47"},
  {id:4,name:"Grace Atim",wa:"+256774444444",eventId:3,tierId:6,qty:1,total:25000,tid:"TID5647382910",status:"rejected",at:"21 May, 13:20"},
  {id:5,name:"Peter Ssali",wa:"+256765555555",eventId:1,tierId:2,qty:3,total:90000,tid:"TID2938471650",status:"approved",at:"22 May, 08:00"},
];
const SEED_TICKETS = [
  {id:"BZK-A1B2C",orderId:1,name:"John Mukasa",eventId:1,tierId:2,used:false,scannedAt:null},
  {id:"BZK-D3E4F",orderId:1,name:"John Mukasa",eventId:1,tierId:2,used:true,scannedAt:"20 May, 20:15"},
  {id:"BZK-G5H6I",orderId:5,name:"Peter Ssali",eventId:1,tierId:2,used:false,scannedAt:null},
  {id:"BZK-J7K8L",orderId:5,name:"Peter Ssali",eventId:1,tierId:2,used:false,scannedAt:null},
  {id:"BZK-M9N0P",orderId:5,name:"Peter Ssali",eventId:1,tierId:2,used:false,scannedAt:null},
];

/* ─── shared ui ─────────────────────────────────────────────── */
const s = (obj) => obj; // inline style helper (identity, for readability)

function Badge({status}) {
  const map = {
    pending:{bg:"rgba(245,158,11,0.12)",color:"#F59E0B",border:"rgba(245,158,11,0.25)"},
    approved:{bg:"rgba(16,185,129,0.12)",color:"#10B981",border:"rgba(16,185,129,0.25)"},
    rejected:{bg:"rgba(239,68,68,0.12)",color:"#EF4444",border:"rgba(239,68,68,0.25)"},
    published:{bg:"rgba(59,130,246,0.12)",color:"#3B82F6",border:"rgba(59,130,246,0.25)"},
    active:{bg:"rgba(16,185,129,0.12)",color:"#10B981",border:"rgba(16,185,129,0.25)"},
    inactive:{bg:"rgba(113,113,122,0.12)",color:"#71717A",border:"rgba(113,113,122,0.25)"},
    used:{bg:"rgba(113,113,122,0.12)",color:"#71717A",border:"rgba(113,113,122,0.25)"},
    valid:{bg:"rgba(16,185,129,0.12)",color:"#10B981",border:"rgba(16,185,129,0.25)"},
  };
  const m = map[status] || map.inactive;
  return (
    <span style={{background:m.bg,color:m.color,border:`1px solid ${m.border}`,
      borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:500,whiteSpace:"nowrap"}}>
      {status}
    </span>
  );
}

function Card({children,style={}}) {
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,...style}}>
      {children}
    </div>
  );
}

function StatCard({label,value,sub,icon:Icon,color}) {
  return (
    <Card style={{padding:20}}>
      <div style={{width:36,height:36,borderRadius:10,background:`${color}20`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
        <Icon size={16} style={{color}} />
      </div>
      <div className="syne" style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:2}}>{value}</div>
      <div style={{fontSize:12,color:C.muted}}>{label}</div>
      {sub && <div style={{fontSize:11,color,marginTop:4}}>{sub}</div>}
    </Card>
  );
}

function Modal({title,onClose,children,wide=false}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",
      padding:16,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(6px)"}}>
      <div style={{width:"100%",maxWidth:wide?640:420,background:C.surface,border:`1px solid ${C.border2}`,borderRadius:20,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"16px 24px",borderBottom:`1px solid ${C.border}`}}>
          <span className="syne" style={{color:C.text,fontWeight:700,fontSize:15}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",display:"flex"}}>
            <X size={16} />
          </button>
        </div>
        <div style={{padding:24}}>{children}</div>
      </div>
    </div>
  );
}

function Field({label,children}) {
  return (
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:11,color:C.muted,fontWeight:500,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width:"100%",padding:"10px 14px",borderRadius:10,
  background:"#1A1A28",border:`1px solid ${C.border2}`,
  color:C.text,fontSize:13,
};

function BtnPrimary({children,onClick,full=false,sm=false}) {
  return (
    <button onClick={onClick} style={{
      background:`linear-gradient(135deg,${C.accent},${C.accent2})`,color:"#fff",border:"none",
      borderRadius:10,padding:sm?"8px 14px":"10px 18px",fontSize:sm?12:13,fontWeight:600,
      cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,
      width:full?"100%":"auto",justifyContent:full?"center":"flex-start",
      transition:"opacity 0.15s"
    }}>{children}</button>
  );
}

function BtnGhost({children,onClick,sm=false,full=false,color}) {
  return (
    <button onClick={onClick} style={{
      background:"transparent",color:color||C.muted,
      border:`1px solid ${C.border2}`,borderRadius:10,
      padding:sm?"6px 12px":"10px 16px",fontSize:sm?11:13,fontWeight:500,
      cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,
      width:full?"100%":"auto",justifyContent:full?"center":"flex-start",
    }}>{children}</button>
  );
}

function BtnSuccess({children,onClick,sm=false}) {
  return (
    <button onClick={onClick} style={{
      background:C.green,color:"#fff",border:"none",borderRadius:10,
      padding:sm?"6px 12px":"10px 16px",fontSize:sm?11:13,fontWeight:600,
      cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,
    }}>{children}</button>
  );
}

function BtnDanger({children,onClick,sm=false}) {
  return (
    <button onClick={onClick} style={{
      background:C.accent2,color:"#fff",border:"none",borderRadius:10,
      padding:sm?"6px 12px":"10px 16px",fontSize:sm?11:13,fontWeight:600,
      cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,
    }}>{children}</button>
  );
}

/* ─── sidebar ────────────────────────────────────────────────── */
function Sidebar({user,nav,active,setActive,onLogout}) {
  return (
    <div style={{width:210,flexShrink:0,background:C.surface,borderRight:`1px solid ${C.border}`,
      display:"flex",flexDirection:"column",padding:"20px 12px",minHeight:"100vh"}}>
      {/* logo */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"0 8px",marginBottom:28}}>
        <div style={{width:32,height:32,borderRadius:10,background:`linear-gradient(135deg,${C.accent},${C.accent2})`,
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Ticket size={15} color="#fff" />
        </div>
        <span className="syne" style={{fontSize:20,fontWeight:800,color:C.text,letterSpacing:"-0.5px"}}>buzzket</span>
      </div>

      {/* user pill */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 12px",marginBottom:20}}>
        <div style={{fontSize:10,color:C.muted,marginBottom:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>
          {user.role==="admin"?"Super Admin":"Organiser"}
        </div>
        <div style={{fontSize:12,color:C.text,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
      </div>

      {/* nav */}
      <nav style={{flex:1,display:"flex",flexDirection:"column",gap:2}}>
        {nav.map(item => {
          const on = active===item.id;
          return (
            <button key={item.id} onClick={()=>setActive(item.id)} style={{
              display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,border:"none",
              background:on?"rgba(249,115,22,0.12)":"transparent",
              color:on?C.accent:C.muted,
              cursor:"pointer",textAlign:"left",fontSize:13,fontWeight:on?600:400,
              borderLeft:on?`2px solid ${C.accent}`:"2px solid transparent",
              transition:"all 0.15s",
            }}>
              <item.icon size={15} />
              {item.label}
              {item.badge>0 && (
                <span style={{marginLeft:"auto",background:C.amber,color:"#000",fontSize:10,fontWeight:700,
                  borderRadius:10,padding:"1px 6px"}}>{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <button onClick={onLogout} style={{
        display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,
        border:"none",background:"transparent",color:C.muted,cursor:"pointer",fontSize:13,
        transition:"color 0.15s",
      }}><LogOut size={15} />Sign out</button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN TABS
═══════════════════════════════════════════════════════════════ */

/* ── Admin: Organisers ── */
function TabOrganisers({orgs,setOrgs}) {
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({name:"",email:"",phone:"",merchant:"",password:""});

  const create=()=>{
    if(!form.name||!form.email||!form.password)return;
    setOrgs(p=>[...p,{id:newId(p),...form,commPct:5,commFixed:2000,active:true}]);
    setForm({name:"",email:"",phone:"",merchant:"",password:""});
    setModal(false);
  };
  const toggle=id=>setOrgs(p=>p.map(o=>o.id===id?{...o,active:!o.active}:o));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <div className="syne" style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>Organisers</div>
          <div style={{fontSize:13,color:C.muted}}>{orgs.length} registered accounts</div>
        </div>
        <BtnPrimary onClick={()=>setModal(true)}><UserPlus size={13}/>New Organiser</BtnPrimary>
      </div>

      <Card>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Organisation","Email","Phone","Merchant Code","Commission","Status","Action"].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"10px 16px",fontSize:11,color:C.muted,fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgs.map(o=>(
                <tr key={o.id} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:"12px 16px",color:C.text,fontSize:13,fontWeight:500}}>{o.name}</td>
                  <td style={{padding:"12px 16px",color:C.muted,fontSize:12}}>{o.email}</td>
                  <td style={{padding:"12px 16px",color:C.muted,fontSize:12}}>{o.phone}</td>
                  <td style={{padding:"12px 16px"}}>
                    <span style={{fontFamily:"monospace",fontSize:12,color:C.accent,background:"rgba(249,115,22,0.1)",padding:"3px 8px",borderRadius:6}}>{o.merchant}</span>
                  </td>
                  <td style={{padding:"12px 16px",color:C.muted,fontSize:12}}>{o.commPct}% + {UGX(o.commFixed)}</td>
                  <td style={{padding:"12px 16px"}}><Badge status={o.active?"active":"inactive"}/></td>
                  <td style={{padding:"12px 16px"}}>
                    <button onClick={()=>toggle(o.id)} style={{
                      fontSize:11,fontWeight:500,padding:"5px 10px",borderRadius:8,border:"none",cursor:"pointer",
                      background:o.active?"rgba(239,68,68,0.1)":"rgba(16,185,129,0.1)",
                      color:o.active?"#EF4444":"#10B981",
                    }}>{o.active?"Deactivate":"Activate"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {modal&&(
        <Modal title="Create Organiser Account" onClose={()=>setModal(false)}>
          <Field label="Organisation Name"><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={inputStyle} placeholder="e.g. Pearl Events Ltd"/></Field>
          <Field label="Email Address"><input value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} style={inputStyle} placeholder="org@email.com"/></Field>
          <Field label="Phone Number"><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} style={inputStyle} placeholder="+256700000000"/></Field>
          <Field label="MTN/Airtel Merchant Code"><input value={form.merchant} onChange={e=>setForm(p=>({...p,merchant:e.target.value}))} style={inputStyle} placeholder="e.g. 123456"/></Field>
          <Field label="Temporary Password"><input type="password" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} style={inputStyle} placeholder="••••••••"/></Field>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <BtnGhost onClick={()=>setModal(false)} full>Cancel</BtnGhost>
            <BtnPrimary onClick={create} full>Create Account</BtnPrimary>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Admin: Commission ── */
function TabCommission({orgs,setOrgs}) {
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState({});

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div className="syne" style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>Commission Settings</div>
        <div style={{fontSize:13,color:C.muted}}>Configure per-organiser platform fees applied to every ticket sale</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {orgs.map(o=>(
          <Card key={o.id} style={{padding:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
              <div>
                <div style={{color:C.text,fontWeight:500,fontSize:14,marginBottom:3}}>{o.name}</div>
                <div style={{color:C.muted,fontSize:12}}>{o.email}</div>
              </div>
              {editing===o.id?(
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <input value={form.commPct} onChange={e=>setForm(p=>({...p,commPct:e.target.value}))}
                      style={{...inputStyle,width:56,textAlign:"center",padding:"6px 8px"}} type="number"/>
                    <span style={{color:C.muted,fontSize:12}}>%</span>
                  </div>
                  <span style={{color:C.dim,fontSize:12}}>+</span>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <input value={form.commFixed} onChange={e=>setForm(p=>({...p,commFixed:e.target.value}))}
                      style={{...inputStyle,width:90,textAlign:"center",padding:"6px 8px"}} type="number"/>
                    <span style={{color:C.muted,fontSize:12}}>UGX</span>
                  </div>
                  <BtnSuccess sm onClick={()=>{setOrgs(p=>p.map(x=>x.id===o.id?{...x,commPct:Number(form.commPct),commFixed:Number(form.commFixed)}:x));setEditing(null);}}>
                    <Check size={12}/>Save
                  </BtnSuccess>
                  <BtnGhost sm onClick={()=>setEditing(null)}><X size={12}/></BtnGhost>
                </div>
              ):(
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <div style={{textAlign:"right"}}>
                    <div style={{color:C.text,fontWeight:600,fontSize:14}}>{o.commPct}% + {UGX(o.commFixed)}</div>
                    <div style={{color:C.muted,fontSize:11}}>per ticket</div>
                  </div>
                  <BtnGhost sm onClick={()=>{setEditing(o.id);setForm({commPct:o.commPct,commFixed:o.commFixed});}}>Edit</BtnGhost>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ── Admin: Payments ── */
function TabPayments({orders,setOrders,events,tiers}) {
  const [filter,setFilter]=useState("pending");
  const [rejectId,setRejectId]=useState(null);
  const [reason,setReason]=useState("");

  const approve=id=>setOrders(p=>p.map(o=>o.id===id?{...o,status:"approved"}:o));
  const reject=()=>{
    setOrders(p=>p.map(o=>o.id===rejectId?{...o,status:"rejected",reason}:o));
    setRejectId(null);setReason("");
  };

  const tabs=["pending","approved","rejected","all"];
  const count=t=>t==="all"?orders.length:orders.filter(o=>o.status===t).length;
  const shown=filter==="all"?orders:orders.filter(o=>o.status===filter);

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div className="syne" style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>Payment Approvals</div>
        <div style={{fontSize:13,color:C.muted}}>Cross-reference customer TIDs and approve or reject payments</div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {tabs.map(t=>{
          const on=filter===t;
          const c=count(t);
          return (
            <button key={t} onClick={()=>setFilter(t)} style={{
              padding:"8px 16px",borderRadius:10,border:`1px solid ${on?C.accent:C.border2}`,
              background:on?"rgba(249,115,22,0.1)":"transparent",
              color:on?C.accent:C.muted,fontSize:12,fontWeight:500,cursor:"pointer",
              display:"flex",alignItems:"center",gap:6,textTransform:"capitalize",
            }}>
              {t}
              {c>0&&<span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:8,
                background:t==="pending"&&on?"rgba(245,158,11,0.25)":"rgba(255,255,255,0.08)",
                color:t==="pending"?C.amber:C.muted}}>{c}</span>}
            </button>
          );
        })}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {shown.length===0&&<div style={{textAlign:"center",padding:"48px 0",color:C.muted}}>No {filter} payments</div>}
        {shown.map(o=>{
          const ev=events.find(e=>e.id===o.eventId);
          const tier=tiers.find(t=>t.id===o.tierId);
          return (
            <Card key={o.id} style={{padding:18}}>
              <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <span style={{color:C.text,fontWeight:500,fontSize:14}}>{o.name}</span>
                    <Badge status={o.status}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 24px"}}>
                    <div style={{fontSize:12,color:C.muted}}><span style={{color:C.dim}}>Event:</span> {ev?.name}</div>
                    <div style={{fontSize:12,color:C.muted}}><span style={{color:C.dim}}>Tier:</span> {tier?.name} × {o.qty}</div>
                    <div style={{fontSize:12,color:C.green,fontWeight:500}}><span style={{color:C.dim,fontWeight:400}}>Amount: </span>{UGX(o.total)}</div>
                    <div style={{fontSize:12,color:C.muted}}><span style={{color:C.dim}}>WhatsApp:</span> {o.wa}</div>
                    <div style={{fontSize:12,fontFamily:"monospace",color:C.accent}}>TID: {o.tid}</div>
                    <div style={{fontSize:11,color:C.dim}}>{o.at}</div>
                  </div>
                  {o.reason&&<div style={{marginTop:8,fontSize:11,color:C.accent2,background:"rgba(239,68,68,0.08)",padding:"4px 8px",borderRadius:6}}>Rejection reason: {o.reason}</div>}
                </div>
                {o.status==="pending"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                    <BtnSuccess sm onClick={()=>approve(o.id)}><Check size={11}/>Approve</BtnSuccess>
                    <BtnDanger sm onClick={()=>setRejectId(o.id)}><X size={11}/>Reject</BtnDanger>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {rejectId&&(
        <Modal title="Reject Payment" onClose={()=>setRejectId(null)}>
          <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Provide a reason — this will be sent to the customer via WhatsApp.</p>
          <Field label="Rejection Reason">
            <input value={reason} onChange={e=>setReason(e.target.value)} style={inputStyle} placeholder="e.g. TID not found in records"/>
          </Field>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <BtnGhost onClick={()=>setRejectId(null)} full>Cancel</BtnGhost>
            <BtnDanger onClick={reject} style={{flex:1}}>Send Rejection</BtnDanger>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Admin: Sales ── */
function TabAdminSales({orders,events,tiers,orgs}) {
  const approved=orders.filter(o=>o.status==="approved");
  const totalRev=approved.reduce((s,o)=>s+o.total,0);
  const totalTickets=approved.reduce((s,o)=>s+o.qty,0);
  const totalComm=approved.reduce((s,o)=>{
    const tier=tiers.find(t=>t.id===o.tierId);
    const ev=events.find(e=>e.id===o.eventId);
    const org=orgs.find(g=>g.id===ev?.orgId);
    if(!tier||!org)return s;
    return s+(tier.price*org.commPct/100+org.commFixed)*o.qty;
  },0);

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div className="syne" style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>Sales Overview</div>
        <div style={{fontSize:13,color:C.muted}}>Platform-wide performance across all events and organisers</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        <StatCard label="Total Revenue" value={UGX(totalRev)} icon={DollarSign} color={C.green}/>
        <StatCard label="Platform Commission" value={UGX(totalComm)} icon={TrendingUp} color={C.accent}/>
        <StatCard label="Tickets Sold" value={totalTickets} icon={Ticket} color={C.blue}/>
        <StatCard label="Pending Payments" value={orders.filter(o=>o.status==="pending").length} icon={Clock} color={C.amber}/>
      </div>

      <Card>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`}}>
          <span className="syne" style={{color:C.text,fontWeight:700,fontSize:14}}>Event Performance</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Event","Organiser","Tickets Sold","Gross Revenue","Buzzket Commission"].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"10px 16px",fontSize:11,color:C.muted,fontWeight:500}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map(ev=>{
                const evOrders=approved.filter(o=>o.eventId===ev.id);
                const org=orgs.find(o=>o.id===ev.orgId);
                const sold=evOrders.reduce((s,o)=>s+o.qty,0);
                const rev=evOrders.reduce((s,o)=>s+o.total,0);
                const comm=evOrders.reduce((s,o)=>{
                  const tier=tiers.find(t=>t.id===o.tierId);
                  if(!tier||!org)return s;
                  return s+(tier.price*org.commPct/100+org.commFixed)*o.qty;
                },0);
                return (
                  <tr key={ev.id} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"12px 16px"}}>
                      <div style={{color:C.text,fontSize:13,fontWeight:500}}>{ev.name}</div>
                      <div style={{color:C.dim,fontSize:11}}>{ev.date}</div>
                    </td>
                    <td style={{padding:"12px 16px",color:C.muted,fontSize:12}}>{org?.name}</td>
                    <td style={{padding:"12px 16px",color:C.text,fontSize:13,fontWeight:600}}>{sold}</td>
                    <td style={{padding:"12px 16px",color:C.green,fontSize:13,fontWeight:600}}>{UGX(rev)}</td>
                    <td style={{padding:"12px 16px",color:C.accent,fontSize:13,fontWeight:600}}>{UGX(comm)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── Admin: WhatsApp Bot Preview ── */
function TabBotPreview({events,tiers,orders,setOrders}) {
  const [msgs,setMsgs]=useState([{from:"bot",text:"👋 Welcome to *Buzzket*!\n\nReply with a number:\n1. Browse Events\n2. My Tickets\n3. Help"}]);
  const [input,setInput]=useState("");
  const [step,setStep]=useState("welcome");
  const [selEvent,setSelEvent]=useState(null);
  const [selTier,setSelTier]=useState(null);
  const [qty,setQty]=useState(1);
  const [custName,setCustName]=useState("");
  const bottomRef=useRef();

  const addMsg=(from,text)=>setMsgs(p=>[...p,{from,text,id:Date.now()+Math.random()}]);
  const botSay=(text,delay=400)=>setTimeout(()=>addMsg("bot",text),delay);

  useEffect(()=>{setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),50);},[msgs]);

  const reset=()=>{
    setMsgs([{from:"bot",text:"👋 Welcome to *Buzzket*!\n\nReply with a number:\n1. Browse Events\n2. My Tickets\n3. Help"}]);
    setStep("welcome");setSelEvent(null);setSelTier(null);setQty(1);setCustName("");setInput("");
  };

  const send=()=>{
    const v=input.trim(); if(!v)return;
    setInput(""); addMsg("user",v);

    if(step==="welcome"){
      if(v==="1"){
        setStep("event_list");
        const list=events.map((e,i)=>`${i+1}. *${e.name}*\n   📍 ${e.venue} · 📅 ${e.date}`).join("\n\n");
        botSay(`🎉 *Available Events:*\n\n${list}\n\nReply with a number.`);
      } else if(v==="2") botSay("You have no tickets yet. Buy one first!");
      else if(v==="3") botSay("📞 Help & Support:\nPhone: +256700000000\nEmail: help@buzzket.ug\nHours: Mon–Sun 8am–10pm EAT");
      else botSay("Please reply with *1*, *2*, or *3*.");
    } else if(step==="event_list"){
      const ev=events[parseInt(v)-1];
      if(!ev){botSay("Invalid choice. Please reply with a valid number.");return;}
      setSelEvent(ev);setStep("tier_select");
      const evTiers=tiers.filter(t=>t.eventId===ev.id);
      const tierList=evTiers.map((t,i)=>`${i+1}. *${t.name}* — ${UGX(t.price)} (${t.total-t.sold} left)`).join("\n");
      botSay(`🎵 *${ev.name}*\n📍 ${ev.venue}\n📅 ${ev.date} at ${ev.time}\n\n*Ticket Options:*\n${tierList}\n\nReply with a number.`);
    } else if(step==="tier_select"){
      const evTiers=tiers.filter(t=>t.eventId===selEvent.id);
      const tier=evTiers[parseInt(v)-1];
      if(!tier){botSay("Invalid choice.");return;}
      setSelTier(tier);setStep("qty");
      botSay(`How many *${tier.name}* tickets do you need?\n(Reply with a number, max 5)`);
    } else if(step==="qty"){
      const n=parseInt(v);
      if(!n||n<1||n>5){botSay("Please enter a number between 1 and 5.");return;}
      setQty(n);setStep("name");
      botSay(`Please provide your *full name* for the ticket(s).`);
    } else if(step==="name"){
      setCustName(v);setStep("payment");
      const total=selTier.price*qty;
      botSay(`✅ *Order Summary*\nEvent: ${selEvent.name}\nTier: ${selTier.name} × ${qty}\nTotal: *${UGX(total)}*\n\n💳 *Payment Instructions*\n\n*MTN MoMo:*\nDial *165*3# → Pay Bill\n→ Merchant Code: *123456*\n→ Amount: ${total}\n→ Confirm with PIN\n\n*Airtel Money:*\nDial *185*9# → Make Payment\n→ Merchant Code: *123456*\n→ Amount: ${total} → Confirm\n\n⚠️ After paying, reply here with your *Transaction ID (TID)* from the SMS confirmation.`);
    } else if(step==="payment"){
      if(!v.toUpperCase().startsWith("TID")){
        botSay("Please reply with your *Transaction ID* — it starts with 'TID' and is in your Mobile Money SMS confirmation.");return;
      }
      if(orders.find(o=>o.tid===v)){
        botSay("⚠️ This Transaction ID has already been submitted. Please check and try again, or contact support.");return;
      }
      setStep("waiting");
      const newOrd={id:newId(orders),name:custName,wa:"+256700000000 (preview)",
        eventId:selEvent.id,tierId:selTier.id,qty,total:selTier.price*qty,
        tid:v,status:"pending",at:"Just now"};
      setOrders(p=>[...p,newOrd]);
      botSay(`✅ Thank you, *${custName}*!\n\nYour TID *${v}* has been received and sent for verification. ⏳\n\nYou will receive your ticket(s) here on WhatsApp once payment is confirmed.\n\nThis usually takes a few minutes.`);
    } else if(step==="waiting"){
      if(v.toLowerCase()==="my tickets") botSay("Your payment is still being verified. You'll receive your tickets here as soon as it's confirmed.");
      else botSay("Your payment is being processed. Type *help* if you need assistance.");
    }
  };

  const formatText=text=>text.split(/\*([^*]+)\*/g).map((t,i)=>i%2===1?<strong key={i} style={{color:"#fff"}}>{t}</strong>:t);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <div className="syne" style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>WhatsApp Bot Preview</div>
          <div style={{fontSize:13,color:C.muted}}>Simulate the full customer purchase experience via WhatsApp</div>
        </div>
        <BtnGhost onClick={reset} sm><RefreshCw size={12}/>Reset</BtnGhost>
      </div>

      <div style={{display:"flex",justifyContent:"center"}}>
        <div style={{width:340,background:C.surface,border:`2px solid ${C.border2}`,borderRadius:28,overflow:"hidden",display:"flex",flexDirection:"column",height:580}}>
          {/* WA header */}
          <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},${C.accent2})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Ticket size={15} color="#fff"/>
            </div>
            <div>
              <div style={{color:C.text,fontSize:13,fontWeight:600}}>Buzzket</div>
              <div style={{color:C.green,fontSize:11}}>● Online</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:8,background:C.bg}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.from==="user"?"flex-end":"flex-start"}}>
                <div style={{
                  maxWidth:"80%",padding:"8px 12px",borderRadius:14,fontSize:12,lineHeight:1.5,whiteSpace:"pre-line",
                  background:m.from==="user"?C.accent:C.card,
                  color:m.from==="user"?"#fff":"#C4C4D0",
                  borderBottomRightRadius:m.from==="user"?4:14,
                  borderBottomLeftRadius:m.from==="bot"?4:14,
                }}>
                  {formatText(m.text)}
                </div>
              </div>
            ))}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div style={{background:C.card,borderTop:`1px solid ${C.border}`,padding:"10px 12px",display:"flex",gap:8,flexShrink:0}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
              style={{flex:1,background:C.surface,border:`1px solid ${C.border2}`,borderRadius:20,
                padding:"8px 14px",color:C.text,fontSize:12}}
              placeholder="Type a message..."/>
            <button onClick={send} style={{width:34,height:34,borderRadius:"50%",border:"none",cursor:"pointer",
              background:`linear-gradient(135deg,${C.accent},${C.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Send size={13} color="#fff"/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ORGANISER TABS
═══════════════════════════════════════════════════════════════ */

/* ── Organiser: Events ── */
function TabEvents({user,events,setEvents,tiers,setTiers}) {
  const mine=events.filter(e=>e.orgId===user.id);
  const [eModal,setEModal]=useState(false);
  const [tModal,setTModal]=useState(null);
  const [eForm,setEForm]=useState({name:"",venue:"",date:"",time:"",capacity:""});
  const [tForm,setTForm]=useState({name:"",price:"",total:""});

  const createEvent=()=>{
    if(!eForm.name||!eForm.venue||!eForm.date)return;
    setEvents(p=>[...p,{id:newId(p),orgId:user.id,...eForm,capacity:Number(eForm.capacity)||100,status:"published"}]);
    setEForm({name:"",venue:"",date:"",time:"",capacity:""});setEModal(false);
  };
  const addTier=()=>{
    if(!tForm.name||!tForm.price)return;
    setTiers(p=>[...p,{id:newId(p),eventId:tModal,name:tForm.name,price:Number(tForm.price),total:Number(tForm.total)||100,sold:0}]);
    setTForm({name:"",price:"",total:""});setTModal(null);
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <div className="syne" style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>My Events</div>
          <div style={{fontSize:13,color:C.muted}}>{mine.length} events</div>
        </div>
        <BtnPrimary onClick={()=>setEModal(true)}><Plus size={13}/>New Event</BtnPrimary>
      </div>

      {mine.length===0&&<div style={{textAlign:"center",padding:"64px 0",color:C.muted}}>No events yet. Create your first one!</div>}

      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {mine.map(ev=>{
          const evTiers=tiers.filter(t=>t.eventId===ev.id);
          const totalSold=evTiers.reduce((s,t)=>s+t.sold,0);
          const totalRev=evTiers.reduce((s,t)=>s+t.sold*t.price,0);
          return (
            <Card key={ev.id} style={{padding:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <span className="syne" style={{color:C.text,fontWeight:700,fontSize:15}}>{ev.name}</span>
                    <Badge status={ev.status}/>
                  </div>
                  <div style={{display:"flex",gap:16,color:C.muted,fontSize:12}}>
                    <span style={{display:"flex",alignItems:"center",gap:4}}><MapPin size={11}/>{ev.venue}</span>
                    <span style={{display:"flex",alignItems:"center",gap:4}}><Calendar size={11}/>{ev.date} · {ev.time}</span>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div className="syne" style={{color:C.text,fontWeight:800,fontSize:18}}>{totalSold}</div>
                  <div style={{color:C.green,fontSize:12,fontWeight:500}}>{UGX(totalRev)}</div>
                  <div style={{color:C.muted,fontSize:10}}>sold / revenue</div>
                </div>
              </div>

              {evTiers.length>0&&(
                <div style={{marginBottom:14,display:"flex",flexDirection:"column",gap:8}}>
                  {evTiers.map(t=>{
                    const pct=Math.min((t.sold/t.total)*100,100);
                    return (
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{color:C.muted,fontSize:11,width:70,flexShrink:0}}>{t.name}</span>
                        <div style={{flex:1,height:5,borderRadius:4,background:C.border2}}>
                          <div style={{height:5,borderRadius:4,width:`${pct}%`,background:`linear-gradient(90deg,${C.accent},${C.accent2})`,transition:"width 0.4s"}}/>
                        </div>
                        <span style={{color:C.muted,fontSize:11,width:52,textAlign:"right"}}>{t.sold}/{t.total}</span>
                        <span style={{color:C.dim,fontSize:11,width:90,textAlign:"right"}}>{UGX(t.price)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <BtnGhost sm onClick={()=>setTModal(ev.id)}><Plus size={11}/>Add Ticket Tier</BtnGhost>
            </Card>
          );
        })}
      </div>

      {eModal&&(
        <Modal title="Create New Event" onClose={()=>setEModal(false)}>
          <Field label="Event Name"><input value={eForm.name} onChange={e=>setEForm(p=>({...p,name:e.target.value}))} style={inputStyle} placeholder="e.g. Afrobeats Night"/></Field>
          <Field label="Venue"><input value={eForm.venue} onChange={e=>setEForm(p=>({...p,venue:e.target.value}))} style={inputStyle} placeholder="e.g. Kampala Serena Hotel"/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Date"><input type="date" value={eForm.date} onChange={e=>setEForm(p=>({...p,date:e.target.value}))} style={inputStyle}/></Field>
            <Field label="Time"><input type="time" value={eForm.time} onChange={e=>setEForm(p=>({...p,time:e.target.value}))} style={inputStyle}/></Field>
          </div>
          <Field label="Total Capacity"><input type="number" value={eForm.capacity} onChange={e=>setEForm(p=>({...p,capacity:e.target.value}))} style={inputStyle} placeholder="e.g. 500"/></Field>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <BtnGhost onClick={()=>setEModal(false)} full>Cancel</BtnGhost>
            <BtnPrimary onClick={createEvent} full>Create Event</BtnPrimary>
          </div>
        </Modal>
      )}

      {tModal&&(
        <Modal title="Add Ticket Tier" onClose={()=>setTModal(null)}>
          <Field label="Tier Name"><input value={tForm.name} onChange={e=>setTForm(p=>({...p,name:e.target.value}))} style={inputStyle} placeholder="e.g. VIP, Regular, VVIP, Student"/></Field>
          <Field label="Price (UGX)"><input type="number" value={tForm.price} onChange={e=>setTForm(p=>({...p,price:e.target.value}))} style={inputStyle} placeholder="e.g. 50000"/></Field>
          <Field label="Quantity Available"><input type="number" value={tForm.total} onChange={e=>setTForm(p=>({...p,total:e.target.value}))} style={inputStyle} placeholder="e.g. 200"/></Field>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <BtnGhost onClick={()=>setTModal(null)} full>Cancel</BtnGhost>
            <BtnPrimary onClick={addTier} full>Add Tier</BtnPrimary>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Organiser: Sales ── */
function TabOrgSales({user,orders,events,tiers,orgs}) {
  const myEventIds=events.filter(e=>e.orgId===user.id).map(e=>e.id);
  const myOrders=orders.filter(o=>myEventIds.includes(o.eventId));
  const approved=myOrders.filter(o=>o.status==="approved");
  const org=orgs.find(o=>o.id===user.id);

  const grossRev=approved.reduce((s,o)=>s+o.total,0);
  const comm=approved.reduce((s,o)=>{
    const tier=tiers.find(t=>t.id===o.tierId);
    if(!tier||!org)return s;
    return s+(tier.price*org.commPct/100+org.commFixed)*o.qty;
  },0);
  const netRev=grossRev-comm;

  return (
    <div>
      <div style={{marginBottom:24}}>
        <div className="syne" style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>Sales & Revenue</div>
        <div style={{fontSize:13,color:C.muted}}>Your earnings summary and transaction history</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        <StatCard label="Gross Revenue" value={UGX(grossRev)} icon={DollarSign} color={C.green}/>
        <StatCard label="Platform Commission" value={UGX(comm)} icon={TrendingUp} color={C.accent} sub={`${org?.commPct}% + ${UGX(org?.commFixed||0)} per ticket`}/>
        <StatCard label="Your Net Earnings" value={UGX(netRev)} icon={Zap} color={C.blue}/>
      </div>

      <Card>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`}}>
          <span className="syne" style={{color:C.text,fontWeight:700,fontSize:14}}>Transaction History</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Customer","Event","Tier","Qty","Amount","TID","Status","Date"].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"10px 16px",fontSize:11,color:C.muted,fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myOrders.length===0&&(
                <tr><td colSpan={8} style={{textAlign:"center",padding:"40px 0",color:C.muted,fontSize:13}}>No transactions yet</td></tr>
              )}
              {myOrders.map(o=>{
                const ev=events.find(e=>e.id===o.eventId);
                const tier=tiers.find(t=>t.id===o.tierId);
                return (
                  <tr key={o.id} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"12px 16px"}}>
                      <div style={{color:C.text,fontSize:13}}>{o.name}</div>
                      <div style={{color:C.dim,fontSize:11}}>{o.wa}</div>
                    </td>
                    <td style={{padding:"12px 16px",color:C.muted,fontSize:12}}>{ev?.name}</td>
                    <td style={{padding:"12px 16px",color:C.muted,fontSize:12}}>{tier?.name}</td>
                    <td style={{padding:"12px 16px",color:C.muted,fontSize:12}}>{o.qty}</td>
                    <td style={{padding:"12px 16px",color:C.green,fontSize:13,fontWeight:500}}>{UGX(o.total)}</td>
                    <td style={{padding:"12px 16px",fontFamily:"monospace",color:C.accent,fontSize:11}}>{o.tid}</td>
                    <td style={{padding:"12px 16px"}}><Badge status={o.status}/></td>
                    <td style={{padding:"12px 16px",color:C.dim,fontSize:11}}>{o.at}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ── Organiser: QR Scanner ── */
function TabScanner({user,events,tickets,setTickets,tiers}) {
  const mine=events.filter(e=>e.orgId===user.id);
  const [selEv,setSelEv]=useState(mine[0]?.id||null);
  const [scanInput,setScanInput]=useState("");
  const [result,setResult]=useState(null);
  const [scanning,setScanning]=useState(false);

  const evTickets=tickets.filter(t=>t.eventId===selEv);
  const checkedIn=evTickets.filter(t=>t.used).length;

  const doScan=(tid)=>{
    const id=(tid||scanInput).trim().toUpperCase();
    if(!id)return;
    setScanning(true);setResult(null);
    setTimeout(()=>{
      const ticket=tickets.find(t=>t.id===id);
      if(!ticket) setResult({status:"invalid",id});
      else if(ticket.eventId!==selEv) setResult({status:"wrong_event",ticket});
      else if(ticket.used) setResult({status:"used",ticket});
      else {
        const now=new Date().toLocaleTimeString("en-UG",{hour:"2-digit",minute:"2-digit"});
        setTickets(p=>p.map(t=>t.id===id?{...t,used:true,scannedAt:now}:t));
        const tier=tiers.find(t=>t.id===ticket.tierId);
        setResult({status:"valid",ticket:{...ticket,tierName:tier?.name},scannedAt:now});
      }
      setScanning(false);setScanInput("");
    },800);
  };

  const simulateScan=()=>{
    const unscanned=evTickets.filter(t=>!t.used);
    if(unscanned.length>0) doScan(unscanned[0].id);
    else setResult({status:"invalid",id:"DEMO-00000"});
  };

  return (
    <div style={{maxWidth:520,margin:"0 auto"}}>
      <div style={{marginBottom:24}}>
        <div className="syne" style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>QR Scanner</div>
        <div style={{fontSize:13,color:C.muted}}>Real-time ticket check-in at your event gate</div>
      </div>

      {/* Event select */}
      <Card style={{padding:16,marginBottom:16}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:500}}>Select Event</div>
        <select value={selEv||""} onChange={e=>{setSelEv(Number(e.target.value));setResult(null);}}
          style={{...inputStyle}}>
          {mine.map(e=><option key={e.id} value={e.id}>{e.name} — {e.date}</option>)}
        </select>
      </Card>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
        {[
          {label:"Checked In",val:checkedIn,color:C.green},
          {label:"Remaining",val:evTickets.length-checkedIn,color:C.accent},
          {label:"Total Tickets",val:evTickets.length,color:C.blue},
        ].map(s=>(
          <Card key={s.label} style={{padding:14,textAlign:"center"}}>
            <div className="syne" style={{fontSize:24,fontWeight:800,color:s.color,marginBottom:2}}>{s.val}</div>
            <div style={{fontSize:11,color:C.muted}}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Scanner area */}
      <Card style={{padding:20,marginBottom:16}}>
        {/* Camera placeholder */}
        <div style={{borderRadius:12,height:160,background:C.bg,border:`2px dashed ${C.border2}`,
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",marginBottom:16}}>
          {scanning?(
            <div style={{textAlign:"center"}}>
              <div style={{width:36,height:36,borderRadius:"50%",border:`2px solid ${C.accent}`,
                borderTopColor:"transparent",margin:"0 auto 10px",animation:"spin 0.8s linear infinite"}}/>
              <div style={{color:C.muted,fontSize:13}}>Scanning...</div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ):(
            <>
              <QrCode size={44} style={{color:C.dim,marginBottom:10}}/>
              <div style={{color:C.muted,fontSize:12}}>Camera scans happen on real device</div>
            </>
          )}
        </div>

        {/* Manual input */}
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <input value={scanInput} onChange={e=>setScanInput(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==="Enter"&&doScan()}
            placeholder="Enter Ticket ID (e.g. BZK-A1B2C)"
            style={{...inputStyle,flex:1,fontFamily:"monospace",fontSize:12}}/>
          <BtnPrimary onClick={()=>doScan()}><Scan size={13}/></BtnPrimary>
        </div>

        <button onClick={simulateScan} style={{
          width:"100%",padding:"8px 0",borderRadius:10,background:"transparent",
          border:`1px dashed ${C.border2}`,color:C.muted,fontSize:11,cursor:"pointer",
        }}>↓ Simulate a scan (demo)</button>
      </Card>

      {/* Result */}
      {result&&(()=>{
        const cfg={
          valid:{bg:"rgba(16,185,129,0.08)",border:C.green,icon:<CheckCircle size={36} style={{color:C.green}}/>,
            title:"✓ Valid Ticket",titleColor:C.green},
          used:{bg:"rgba(249,115,22,0.08)",border:C.accent,icon:<AlertCircle size={36} style={{color:C.amber}}/>,
            title:"Already Scanned",titleColor:C.amber},
          invalid:{bg:"rgba(239,68,68,0.08)",border:C.accent2,icon:<XCircle size={36} style={{color:C.accent2}}/>,
            title:"Invalid Ticket",titleColor:C.accent2},
          wrong_event:{bg:"rgba(239,68,68,0.08)",border:C.accent2,icon:<XCircle size={36} style={{color:C.accent2}}/>,
            title:"Wrong Event",titleColor:C.accent2},
        }[result.status];
        return (
          <div style={{background:cfg.bg,border:`2px solid ${cfg.border}`,borderRadius:16,padding:24,textAlign:"center",marginBottom:16}}>
            <div style={{marginBottom:12}}>{cfg.icon}</div>
            <div className="syne" style={{fontSize:18,fontWeight:800,color:cfg.titleColor,marginBottom:8}}>{cfg.title}</div>
            {result.status==="valid"&&<>
              <div style={{fontSize:16,fontWeight:600,color:C.text}}>{result.ticket.name}</div>
              <div style={{color:C.muted,fontSize:13,marginTop:4}}>{result.ticket.tierName} · {result.ticket.id}</div>
              <div style={{color:C.green,fontSize:12,marginTop:6}}>Checked in at {result.scannedAt}</div>
            </>}
            {result.status==="used"&&<>
              <div style={{fontSize:15,color:C.text}}>{result.ticket.name}</div>
              <div style={{color:C.muted,fontSize:12,marginTop:4}}>First scanned: {result.ticket.scannedAt}</div>
              <div style={{color:C.accent2,fontSize:11,fontWeight:600,marginTop:6}}>⚠️ Do not allow entry</div>
            </>}
            {(result.status==="invalid"||result.status==="wrong_event")&&<>
              <div style={{color:C.muted,fontSize:13}}>{result.status==="wrong_event"?"This ticket belongs to a different event":"Ticket ID not recognised in system"}</div>
            </>}
            <button onClick={()=>setResult(null)} style={{marginTop:14,background:"transparent",border:"none",
              color:C.muted,fontSize:12,cursor:"pointer"}}>Scan next →</button>
          </div>
        );
      })()}

      {/* Recent check-ins */}
      {evTickets.filter(t=>t.used).length>0&&(
        <Card style={{padding:16}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:500}}>Recent Check-ins</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {evTickets.filter(t=>t.used).slice(-5).reverse().map(t=>(
              <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:C.text,fontSize:13}}>{t.name}</span>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{color:C.dim,fontSize:11,fontFamily:"monospace"}}>{t.id}</span>
                  <span style={{color:C.green,fontSize:11}}>{t.scannedAt}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════════════════════════ */
function Login({onLogin,orgs}) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [show,setShow]=useState(false);
  const [err,setErr]=useState("");

  const handle=e=>{
    e.preventDefault();
    if(email==="admin@buzzket.ug"&&password==="admin123"){onLogin({role:"admin",name:"Buzzket Admin",id:0});return;}
    const org=orgs.find(o=>o.email===email&&o.password===password);
    if(org){if(!org.active){setErr("Account deactivated. Contact admin.");return;}onLogin({role:"organiser",...org});return;}
    setErr("Invalid email or password.");
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:16,position:"relative",overflow:"hidden"}}>
      {/* glow */}
      <div style={{position:"absolute",top:"30%",left:"50%",transform:"translateX(-50%)",
        width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(249,115,22,0.08),transparent 70%)",pointerEvents:"none"}}/>

      <div style={{width:"100%",maxWidth:360,position:"relative"}}>
        {/* logo */}
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:12,marginBottom:10}}>
            <div style={{width:44,height:44,borderRadius:14,background:`linear-gradient(135deg,${C.accent},${C.accent2})`,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Ticket size={22} color="#fff"/>
            </div>
            <span className="syne" style={{fontSize:32,fontWeight:800,color:C.text,letterSpacing:"-1px"}}>buzzket</span>
          </div>
          <div style={{fontSize:13,color:C.muted}}>Uganda's Event Ticketing Platform</div>
        </div>

        <Card style={{padding:28}}>
          <div className="syne" style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:4}}>Welcome back</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:22}}>Sign in to your dashboard</div>

          {err&&(
            <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,
              padding:"10px 14px",fontSize:12,color:"#FCA5A5",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <AlertCircle size={13}/>{err}
            </div>
          )}

          <form onSubmit={handle}>
            <Field label="Email Address">
              <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setErr("");}} style={inputStyle} placeholder="your@email.com"/>
            </Field>
            <Field label="Password">
              <div style={{position:"relative"}}>
                <input type={show?"text":"password"} value={password} onChange={e=>{setPassword(e.target.value);setErr("");}}
                  style={{...inputStyle,paddingRight:40}} placeholder="••••••••"/>
                <button type="button" onClick={()=>setShow(!show)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                  background:"none",border:"none",color:C.muted,cursor:"pointer",display:"flex"}}>
                  {show?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
            </Field>
            <button type="submit" style={{
              width:"100%",padding:"12px 0",borderRadius:10,border:"none",
              background:`linear-gradient(135deg,${C.accent},${C.accent2})`,
              color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:8,
            }}>Sign In →</button>
          </form>

          <div style={{borderTop:`1px solid ${C.border}`,marginTop:20,paddingTop:16}}>
            <div style={{fontSize:11,color:C.dim,textAlign:"center",marginBottom:8}}>Quick demo login</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <button onClick={()=>{setEmail("admin@buzzket.ug");setPassword("admin123");}} style={{
                padding:"8px 12px",borderRadius:8,background:"transparent",border:`1px solid ${C.border2}`,
                color:C.muted,fontSize:11,cursor:"pointer",transition:"color 0.15s",
              }}>🔑 Admin</button>
              <button onClick={()=>{setEmail("kampala@events.ug");setPassword("pass123");}} style={{
                padding:"8px 12px",borderRadius:8,background:"transparent",border:`1px solid ${C.border2}`,
                color:C.muted,fontSize:11,cursor:"pointer",
              }}>🎪 Organiser</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARDS
═══════════════════════════════════════════════════════════════ */
function AdminDash({user,logout,...shared}) {
  const [tab,setTab]=useState("organisers");
  const pendingCount=shared.orders.filter(o=>o.status==="pending").length;

  const nav=[
    {id:"organisers",label:"Organisers",icon:Users},
    {id:"commission",label:"Commission",icon:Settings},
    {id:"payments",label:"Payments",icon:CreditCard,badge:pendingCount},
    {id:"sales",label:"Sales",icon:BarChart3},
    {id:"bot",label:"Bot Preview",icon:MessageSquare},
  ];

  return (
    <div style={{display:"flex",minHeight:"100vh",background:C.bg}}>
      <style>{GFONTS}</style>
      <Sidebar user={user} nav={nav} active={tab} setActive={setTab} onLogout={logout}/>
      <main style={{flex:1,overflowY:"auto",padding:32}}>
        {tab==="organisers"&&<TabOrganisers orgs={shared.orgs} setOrgs={shared.setOrgs}/>}
        {tab==="commission"&&<TabCommission orgs={shared.orgs} setOrgs={shared.setOrgs}/>}
        {tab==="payments"&&<TabPayments orders={shared.orders} setOrders={shared.setOrders} events={shared.events} tiers={shared.tiers}/>}
        {tab==="sales"&&<TabAdminSales orders={shared.orders} events={shared.events} tiers={shared.tiers} orgs={shared.orgs}/>}
        {tab==="bot"&&<TabBotPreview events={shared.events} tiers={shared.tiers} orders={shared.orders} setOrders={shared.setOrders}/>}
      </main>
    </div>
  );
}

function OrgDash({user,logout,...shared}) {
  const [tab,setTab]=useState("events");
  const nav=[
    {id:"events",label:"My Events",icon:Layers},
    {id:"sales",label:"Sales",icon:BarChart3},
    {id:"scanner",label:"QR Scanner",icon:QrCode},
  ];

  return (
    <div style={{display:"flex",minHeight:"100vh",background:C.bg}}>
      <style>{GFONTS}</style>
      <Sidebar user={user} nav={nav} active={tab} setActive={setTab} onLogout={logout}/>
      <main style={{flex:1,overflowY:"auto",padding:32}}>
        {tab==="events"&&<TabEvents user={user} events={shared.events} setEvents={shared.setEvents} tiers={shared.tiers} setTiers={shared.setTiers}/>}
        {tab==="sales"&&<TabOrgSales user={user} orders={shared.orders} events={shared.events} tiers={shared.tiers} orgs={shared.orgs}/>}
        {tab==="scanner"&&<TabScanner user={user} events={shared.events} tickets={shared.tickets} setTickets={shared.setTickets} tiers={shared.tiers}/>}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════ */
export default function App() { 
  const [user,setUser]=useState(null);
  const [orgs,setOrgs]=useState(SEED_ORGS);
  const [events,setEvents]=useState(SEED_EVENTS);
  const [tiers,setTiers]=useState(SEED_TIERS);
  const [orders,setOrders]=useState(SEED_ORDERS);
  const [tickets,setTickets]=useState(SEED_TICKETS);

  const shared={orgs,setOrgs,events,setEvents,tiers,setTiers,orders,setOrders,tickets,setTickets};
  const logout=()=>setUser(null);

  if(!user) return <Login onLogin={setUser} orgs={orgs}/>;
  if(user.role==="admin") return <AdminDash user={user} logout={logout} {...shared}/>;
  return <OrgDash user={user} logout={logout} {...shared}/>;
}
