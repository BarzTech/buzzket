import { useState, useRef, useEffect, useCallback } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
  Ticket, Users, CreditCard, BarChart3, QrCode, LogOut,
  Plus, Check, X, Eye, EyeOff, Scan, Calendar, MapPin,
  MessageSquare, Settings, CheckCircle, XCircle, Clock,
  AlertCircle, Zap, RefreshCw, Send, UserPlus, Layers,
  DollarSign, TrendingUp
} from "lucide-react";

/* ─── global styles ──────────────────────────────────────────── */
const GFONTS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow-x:hidden}
body,*{font-family:'DM Sans',sans-serif}
.syne{font-family:'Syne',sans-serif}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:#0A0A12}
::-webkit-scrollbar-thumb{background:#252535;border-radius:2px}
input,select,textarea{outline:none;font-family:'DM Sans',sans-serif}
input[type=number]::-webkit-inner-spin-button{opacity:0}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
#qr-reader{background:transparent!important;border:none!important;padding:0!important;width:100%!important}
#qr-reader video{border-radius:12px!important;width:100%!important;max-height:280px!important;object-fit:cover!important}
#qr-reader__scan_region{background:transparent!important;border:none!important}
#qr-reader__dashboard{padding:10px 0 4px!important;background:transparent!important}
#qr-reader__dashboard_section_csr button,#qr-reader__camera_permission_button{background:linear-gradient(135deg,#F97316,#EF4444)!important;color:#fff!important;border:none!important;border-radius:10px!important;padding:9px 18px!important;cursor:pointer!important;font-family:'DM Sans'!important;font-size:13px!important;font-weight:600!important;width:100%!important;margin-top:4px!important}
#qr-reader__dashboard_section_swaplink{display:none!important}
#qr-reader select{background:#1A1A28!important;color:#fff!important;border:1px solid #2A2A40!important;border-radius:8px!important;padding:8px 10px!important;font-family:'DM Sans'!important;font-size:12px!important;width:100%!important;margin-bottom:8px!important}
#qr-reader__status_span{color:#71717A!important;font-size:11px!important;display:block!important;margin:6px 0!important;text-align:center!important}
#qr-reader img[alt="Info icon"]{display:none!important}
#qr-reader__header_message{color:#71717A!important;font-size:11px!important;text-align:center!important;margin-bottom:8px!important}
`;

/* ─── utils ──────────────────────────────────────────────────── */
const UGX = n => `UGX ${Number(n).toLocaleString()}`;
const newId = arr => arr.length ? Math.max(...arr.map(o => o.id)) + 1 : 1;

/* ─── colors ─────────────────────────────────────────────────── */
const C = {
  bg:"#08080F", surface:"#0F0F1A", card:"#131320", border:"#1E1E30",
  border2:"#2A2A40", accent:"#F97316", accent2:"#EF4444",
  green:"#10B981", blue:"#3B82F6", amber:"#F59E0B", purple:"#8B5CF6",
  text:"#FFFFFF", muted:"#71717A", dim:"#3F3F50",
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

/* ─── responsive hook ────────────────────────────────────────── */
function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

/* ─── shared ui ─────────────────────────────────────────────── */
function Badge({ status }) {
  const map = {
    pending: {bg:"rgba(245,158,11,0.12)",color:"#F59E0B",border:"rgba(245,158,11,0.25)"},
    approved:{bg:"rgba(16,185,129,0.12)",color:"#10B981",border:"rgba(16,185,129,0.25)"},
    rejected:{bg:"rgba(239,68,68,0.12)",color:"#EF4444",border:"rgba(239,68,68,0.25)"},
    published:{bg:"rgba(59,130,246,0.12)",color:"#3B82F6",border:"rgba(59,130,246,0.25)"},
    active:  {bg:"rgba(16,185,129,0.12)",color:"#10B981",border:"rgba(16,185,129,0.25)"},
    inactive:{bg:"rgba(113,113,122,0.12)",color:"#71717A",border:"rgba(113,113,122,0.25)"},
    used:    {bg:"rgba(113,113,122,0.12)",color:"#71717A",border:"rgba(113,113,122,0.25)"},
  };
  const s = map[status] || map.inactive;
  return (
    <span style={{background:s.bg,color:s.color,border:`1px solid ${s.border}`,
      borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:500,whiteSpace:"nowrap"}}>
      {status}
    </span>
  );
}

function Card({ children, style={} }) {
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,...style}}>{children}</div>;
}

function StatCard({ label, value, sub, icon:Icon, color }) {
  return (
    <Card style={{padding:16}}>
      <div style={{width:34,height:34,borderRadius:10,background:`${color}20`,
        display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10}}>
        <Icon size={15} style={{color}} />
      </div>
      <div className="syne" style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:2,lineHeight:1.1}}>{value}</div>
      <div style={{fontSize:11,color:C.muted}}>{label}</div>
      {sub && <div style={{fontSize:10,color,marginTop:3}}>{sub}</div>}
    </Card>
  );
}

function Modal({ title, onClose, children }) {
  const isMobile = useIsMobile();
  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",
      alignItems:isMobile?"flex-end":"center",justifyContent:"center",
      padding:isMobile?0:16,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(8px)"}}>
      <div style={{width:"100%",maxWidth:isMobile?"100%":440,
        background:C.surface,border:`1px solid ${C.border2}`,
        borderRadius:isMobile?"20px 20px 0 0":20,
        maxHeight:isMobile?"92vh":"85vh",display:"flex",flexDirection:"column",
        animation:"fadeIn 0.2s ease"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"16px 20px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <span className="syne" style={{color:C.text,fontWeight:700,fontSize:15}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",
            color:C.muted,cursor:"pointer",display:"flex",padding:4}}>
            <X size={16}/>
          </button>
        </div>
        <div style={{padding:"20px",overflowY:"auto",flex:1}}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:11,color:C.muted,fontWeight:500,
        marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</label>
      {children}
    </div>
  );
}

const inputSt = {
  width:"100%",padding:"11px 14px",borderRadius:10,
  background:"#1A1A28",border:`1px solid ${C.border2}`,
  color:C.text,fontSize:14,WebkitAppearance:"none",
};

function BtnPrimary({ children, onClick, full=false }) {
  return (
    <button onClick={onClick} style={{
      background:`linear-gradient(135deg,${C.accent},${C.accent2})`,color:"#fff",
      border:"none",borderRadius:10,padding:"11px 18px",fontSize:13,fontWeight:600,
      cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,
      width:full?"100%":"auto",justifyContent:full?"center":"flex-start",
    }}>{children}</button>
  );
}

function BtnGhost({ children, onClick, full=false, sm=false }) {
  return (
    <button onClick={onClick} style={{
      background:"transparent",color:C.muted,border:`1px solid ${C.border2}`,
      borderRadius:10,padding:sm?"7px 12px":"11px 16px",fontSize:sm?11:13,
      fontWeight:500,cursor:"pointer",display:"inline-flex",
      alignItems:"center",gap:6,width:full?"100%":"auto",
      justifyContent:full?"center":"flex-start",
    }}>{children}</button>
  );
}

function BtnSuccess({ children, onClick, sm=false }) {
  return (
    <button onClick={onClick} style={{
      background:C.green,color:"#fff",border:"none",borderRadius:10,
      padding:sm?"7px 12px":"11px 16px",fontSize:sm?11:13,fontWeight:600,
      cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,
    }}>{children}</button>
  );
}

function BtnDanger({ children, onClick, sm=false }) {
  return (
    <button onClick={onClick} style={{
      background:C.accent2,color:"#fff",border:"none",borderRadius:10,
      padding:sm?"7px 12px":"11px 16px",fontSize:sm?11:13,fontWeight:600,
      cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,
    }}>{children}</button>
  );
}

/* ─── navigation ─────────────────────────────────────────────── */
function Sidebar({ user, nav, active, setActive, onLogout }) {
  return (
    <div style={{width:210,flexShrink:0,background:C.surface,
      borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",
      padding:"20px 12px",height:"100vh",position:"sticky",top:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"0 8px",marginBottom:24}}>
        <div style={{width:32,height:32,borderRadius:10,flexShrink:0,
          background:`linear-gradient(135deg,${C.accent},${C.accent2})`,
          display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Ticket size={15} color="#fff"/>
        </div>
        <span className="syne" style={{fontSize:20,fontWeight:800,color:C.text,letterSpacing:"-0.5px"}}>buzzket</span>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,
        padding:"10px 12px",marginBottom:20}}>
        <div style={{fontSize:10,color:C.muted,marginBottom:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>
          {user.role==="admin"?"Super Admin":"Organiser"}
        </div>
        <div style={{fontSize:12,color:C.text,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
      </div>
      <nav style={{flex:1,display:"flex",flexDirection:"column",gap:2}}>
        {nav.map(item=>{
          const on=active===item.id;
          return (
            <button key={item.id} onClick={()=>setActive(item.id)} style={{
              display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
              borderRadius:10,border:"none",
              background:on?"rgba(249,115,22,0.12)":"transparent",
              color:on?C.accent:C.muted,cursor:"pointer",textAlign:"left",
              fontSize:13,fontWeight:on?600:400,
              borderLeft:on?`2px solid ${C.accent}`:"2px solid transparent",
            }}>
              <item.icon size={15}/>{item.label}
              {item.badge>0&&<span style={{marginLeft:"auto",background:C.amber,
                color:"#000",fontSize:10,fontWeight:700,borderRadius:10,padding:"1px 6px"}}>{item.badge}</span>}
            </button>
          );
        })}
      </nav>
      <button onClick={onLogout} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
        borderRadius:10,border:"none",background:"transparent",color:C.muted,cursor:"pointer",fontSize:13}}>
        <LogOut size={15}/>Sign out
      </button>
    </div>
  );
}

function MobileNav({ nav, active, setActive, onLogout }) {
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,
      background:C.surface,borderTop:`1px solid ${C.border}`,
      display:"flex",alignItems:"stretch",height:60,
      paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
      {nav.map(item=>{
        const on=active===item.id;
        return (
          <button key={item.id} onClick={()=>setActive(item.id)} style={{
            flex:1,display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"center",gap:2,border:"none",background:"transparent",
            color:on?C.accent:C.muted,cursor:"pointer",position:"relative",fontSize:9,
            fontWeight:on?600:400,
          }}>
            {item.badge>0&&<span style={{position:"absolute",top:7,left:"calc(50% + 5px)",
              background:C.amber,color:"#000",fontSize:8,borderRadius:10,
              padding:"1px 4px",fontWeight:700,lineHeight:1.4}}>{item.badge}</span>}
            <item.icon size={18}/>
            <span>{item.shortLabel||item.label}</span>
          </button>
        );
      })}
      <button onClick={onLogout} style={{flex:1,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",gap:2,border:"none",
        background:"transparent",color:C.muted,cursor:"pointer",fontSize:9}}>
        <LogOut size={18}/><span>Logout</span>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN TABS
═══════════════════════════════════════════════════════════════ */

function TabOrganisers({ orgs, setOrgs }) {
  const isMobile = useIsMobile();
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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,gap:12}}>
        <div>
          <div className="syne" style={{fontSize:isMobile?17:20,fontWeight:800,color:C.text,marginBottom:3}}>Organisers</div>
          <div style={{fontSize:12,color:C.muted}}>{orgs.length} accounts</div>
        </div>
        <BtnPrimary onClick={()=>setModal(true)}>
          <UserPlus size={13}/>{isMobile?"New":"New Organiser"}
        </BtnPrimary>
      </div>

      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {orgs.map(o=>(
            <Card key={o.id} style={{padding:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{color:C.text,fontWeight:600,fontSize:14,marginBottom:3}}>{o.name}</div>
                  <div style={{color:C.muted,fontSize:12}}>{o.email}</div>
                </div>
                <Badge status={o.active?"active":"inactive"}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 12px",marginBottom:12}}>
                <div style={{fontSize:11,color:C.muted}}><span style={{color:C.dim}}>Phone:</span> {o.phone}</div>
                <div style={{fontSize:11}}><span style={{color:C.dim,fontSize:11}}>Code: </span>
                  <span style={{fontFamily:"monospace",color:C.accent}}>{o.merchant}</span></div>
                <div style={{fontSize:11,color:C.muted}}><span style={{color:C.dim}}>Comm:</span> {o.commPct}% + {UGX(o.commFixed)}</div>
              </div>
              <button onClick={()=>toggle(o.id)} style={{
                fontSize:11,fontWeight:500,padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",
                background:o.active?"rgba(239,68,68,0.1)":"rgba(16,185,129,0.1)",
                color:o.active?"#EF4444":"#10B981",width:"100%",
              }}>{o.active?"Deactivate Account":"Activate Account"}</button>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
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
                      <span style={{fontFamily:"monospace",fontSize:12,color:C.accent,
                        background:"rgba(249,115,22,0.1)",padding:"3px 8px",borderRadius:6}}>{o.merchant}</span>
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
      )}

      {modal&&(
        <Modal title="Create Organiser Account" onClose={()=>setModal(false)}>
          <Field label="Organisation Name"><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={inputSt} placeholder="e.g. Pearl Events Ltd"/></Field>
          <Field label="Email Address"><input value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} style={inputSt} placeholder="org@email.com"/></Field>
          <Field label="Phone Number"><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} style={inputSt} placeholder="+256700000000"/></Field>
          <Field label="MTN / Airtel Merchant Code"><input value={form.merchant} onChange={e=>setForm(p=>({...p,merchant:e.target.value}))} style={inputSt} placeholder="e.g. 123456"/></Field>
          <Field label="Temporary Password"><input type="password" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} style={inputSt} placeholder="••••••••"/></Field>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <BtnGhost onClick={()=>setModal(false)} full>Cancel</BtnGhost>
            <BtnPrimary onClick={create} full>Create Account</BtnPrimary>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TabCommission({ orgs, setOrgs }) {
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState({});

  return (
    <div>
      <div style={{marginBottom:20}}>
        <div className="syne" style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:3}}>Commission Settings</div>
        <div style={{fontSize:12,color:C.muted}}>Per-organiser platform fees applied to every ticket sale</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {orgs.map(o=>(
          <Card key={o.id} style={{padding:18}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div style={{minWidth:0}}>
                <div style={{color:C.text,fontWeight:500,fontSize:14,marginBottom:2}}>{o.name}</div>
                <div style={{color:C.muted,fontSize:12}}>{o.email}</div>
              </div>
              {editing===o.id?(
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <input value={form.commPct} onChange={e=>setForm(p=>({...p,commPct:e.target.value}))}
                      style={{...inputSt,width:52,textAlign:"center",padding:"7px 8px"}} type="number"/>
                    <span style={{color:C.muted,fontSize:12}}>%</span>
                  </div>
                  <span style={{color:C.dim,fontSize:12}}>+</span>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <input value={form.commFixed} onChange={e=>setForm(p=>({...p,commFixed:e.target.value}))}
                      style={{...inputSt,width:88,textAlign:"center",padding:"7px 8px"}} type="number"/>
                    <span style={{color:C.muted,fontSize:12}}>UGX</span>
                  </div>
                  <BtnSuccess sm onClick={()=>{setOrgs(p=>p.map(x=>x.id===o.id?{...x,commPct:Number(form.commPct),commFixed:Number(form.commFixed)}:x));setEditing(null);}}>
                    <Check size={12}/>Save
                  </BtnSuccess>
                  <BtnGhost sm onClick={()=>setEditing(null)}><X size={12}/></BtnGhost>
                </div>
              ):(
                <div style={{display:"flex",alignItems:"center",gap:14}}>
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

function TabPayments({ orders, setOrders, events, tiers }) {
  const isMobile = useIsMobile();
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
      <div style={{marginBottom:20}}>
        <div className="syne" style={{fontSize:isMobile?17:20,fontWeight:800,color:C.text,marginBottom:3}}>Payment Approvals</div>
        <div style={{fontSize:12,color:C.muted}}>Cross-reference customer TIDs and approve or reject payments</div>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:18,overflowX:"auto",paddingBottom:4}}>
        {tabs.map(t=>{
          const on=filter===t; const c=count(t);
          return (
            <button key={t} onClick={()=>setFilter(t)} style={{
              padding:"7px 14px",borderRadius:10,border:`1px solid ${on?C.accent:C.border2}`,
              background:on?"rgba(249,115,22,0.1)":"transparent",
              color:on?C.accent:C.muted,fontSize:12,fontWeight:500,cursor:"pointer",
              display:"flex",alignItems:"center",gap:5,textTransform:"capitalize",whiteSpace:"nowrap",flexShrink:0,
            }}>
              {t}
              {c>0&&<span style={{fontSize:10,fontWeight:700,padding:"1px 5px",borderRadius:8,
                background:t==="pending"&&on?"rgba(245,158,11,0.25)":"rgba(255,255,255,0.08)",
                color:t==="pending"?C.amber:C.muted}}>{c}</span>}
            </button>
          );
        })}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {shown.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.muted,fontSize:13}}>No {filter} payments</div>}
        {shown.map(o=>{
          const ev=events.find(e=>e.id===o.eventId);
          const tier=tiers.find(t=>t.id===o.tierId);
          return (
            <Card key={o.id} style={{padding:16}}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                    <span style={{color:C.text,fontWeight:500,fontSize:14}}>{o.name}</span>
                    <Badge status={o.status}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 16px"}}>
                    <div style={{fontSize:12,color:C.muted}}><span style={{color:C.dim}}>Event:</span> {ev?.name}</div>
                    <div style={{fontSize:12,color:C.muted}}><span style={{color:C.dim}}>Tier:</span> {tier?.name} ×{o.qty}</div>
                    <div style={{fontSize:12,color:C.green,fontWeight:500}}>{UGX(o.total)}</div>
                    <div style={{fontSize:12,color:C.muted}}>{o.wa}</div>
                    <div style={{fontSize:11,fontFamily:"monospace",color:C.accent,gridColumn:"1/-1"}}>TID: {o.tid}</div>
                  </div>
                  <div style={{fontSize:11,color:C.dim,marginTop:6}}>{o.at}</div>
                  {o.reason&&<div style={{marginTop:8,fontSize:11,color:C.accent2,
                    background:"rgba(239,68,68,0.08)",padding:"4px 8px",borderRadius:6}}>Reason: {o.reason}</div>}
                </div>
                {o.status==="pending"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                    <BtnSuccess sm onClick={()=>approve(o.id)}><Check size={11}/>OK</BtnSuccess>
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
          <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Provide a reason — sent to the customer via WhatsApp.</p>
          <Field label="Rejection Reason">
            <input value={reason} onChange={e=>setReason(e.target.value)} style={inputSt} placeholder="e.g. TID not found in records"/>
          </Field>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <BtnGhost onClick={()=>setRejectId(null)} full>Cancel</BtnGhost>
            <BtnDanger onClick={reject}>Send Rejection</BtnDanger>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TabAdminSales({ orders, events, tiers, orgs }) {
  const isMobile = useIsMobile();
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
      <div style={{marginBottom:20}}>
        <div className="syne" style={{fontSize:isMobile?17:20,fontWeight:800,color:C.text,marginBottom:3}}>Sales Overview</div>
        <div style={{fontSize:12,color:C.muted}}>Platform-wide performance</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:20}}>
        <StatCard label="Total Revenue" value={isMobile?UGX(totalRev).replace("UGX ","")+"\nUGX":UGX(totalRev)} icon={DollarSign} color={C.green}/>
        <StatCard label="Commission" value={UGX(totalComm)} icon={TrendingUp} color={C.accent}/>
        <StatCard label="Tickets Sold" value={totalTickets} icon={Ticket} color={C.blue}/>
        <StatCard label="Pending" value={orders.filter(o=>o.status==="pending").length} icon={Clock} color={C.amber}/>
      </div>

      <Card>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`}}>
          <span className="syne" style={{color:C.text,fontWeight:700,fontSize:14}}>Event Performance</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Event","Organiser","Sold","Revenue","Commission"].map(h=>(
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

function TabBotPreview({ events, tiers, orders, setOrders }) {
  const isMobile = useIsMobile();
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
  useEffect(()=>{setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),60);},[msgs]);

  const reset=()=>{
    setMsgs([{from:"bot",text:"👋 Welcome to *Buzzket*!\n\nReply with a number:\n1. Browse Events\n2. My Tickets\n3. Help"}]);
    setStep("welcome");setSelEvent(null);setSelTier(null);setQty(1);setCustName("");setInput("");
  };

  const send=()=>{
    const v=input.trim();if(!v)return;
    setInput("");addMsg("user",v);

    if(step==="welcome"){
      if(v==="1"){setStep("event_list");botSay(`🎉 *Available Events:*\n\n${events.map((e,i)=>`${i+1}. *${e.name}*\n   📍 ${e.venue} · 📅 ${e.date}`).join("\n\n")}\n\nReply with a number.`);}
      else if(v==="2") botSay("You have no confirmed tickets yet.");
      else if(v==="3") botSay("📞 Help:\nPhone: +256700000000\nEmail: help@buzzket.ug");
      else botSay("Please reply with *1*, *2*, or *3*.");
    }
    else if(step==="event_list"){
      const ev=events[parseInt(v)-1];
      if(!ev){botSay("Invalid choice. Reply with a valid number.");return;}
      setSelEvent(ev);setStep("tier_select");
      const t=tiers.filter(t=>t.eventId===ev.id);
      botSay(`🎵 *${ev.name}*\n📍 ${ev.venue}\n📅 ${ev.date} at ${ev.time}\n\n*Ticket Options:*\n${t.map((t,i)=>`${i+1}. *${t.name}* — ${UGX(t.price)} (${t.total-t.sold} left)`).join("\n")}\n\nReply with a number.`);
    }
    else if(step==="tier_select"){
      const t=tiers.filter(t=>t.eventId===selEvent.id)[parseInt(v)-1];
      if(!t){botSay("Invalid choice.");return;}
      setSelTier(t);setStep("qty");
      botSay(`How many *${t.name}* tickets? (Max 5)`);
    }
    else if(step==="qty"){
      const n=parseInt(v);
      if(!n||n<1||n>5){botSay("Please enter a number between 1 and 5.");return;}
      setQty(n);setStep("name");botSay("Please provide your *full name* for the ticket(s).");
    }
    else if(step==="name"){
      setCustName(v);setStep("payment");
      const total=selTier.price*qty;
      botSay(`✅ *Order Summary*\nEvent: ${selEvent.name}\nTier: ${selTier.name} × ${qty}\nTotal: *${UGX(total)}*\n\n💳 *Payment Instructions*\n\n*MTN MoMo:*\nDial *165*3# → Pay Bill\n→ Merchant Code: *123456*\n→ Amount: ${total} → Confirm PIN\n\n*Airtel Money:*\nDial *185*9# → Make Payment\n→ Merchant Code: *123456*\n→ Amount: ${total} → Confirm\n\n⚠️ Save your Transaction ID (TID) from the SMS, then reply with it here.`);
    }
    else if(step==="payment"){
      if(!v.toUpperCase().startsWith("TID")){botSay("Please reply with your *Transaction ID* — starts with 'TID', found in your MoMo SMS.");return;}
      if(orders.find(o=>o.tid===v)){botSay("⚠️ This TID has already been submitted. Check your TID or contact support.");return;}
      setStep("waiting");
      setOrders(p=>[...p,{id:newId(p),name:custName,wa:"+256700000000 (preview)",
        eventId:selEvent.id,tierId:selTier.id,qty,total:selTier.price*qty,tid:v,status:"pending",at:"Just now"}]);
      botSay(`✅ Thank you, *${custName}*!\n\nYour TID *${v}* has been received. ⏳\n\nYour ticket(s) will be sent here once payment is verified.`);
    }
    else if(step==="waiting"){
      botSay("Your payment is being verified. Type *help* if you need assistance.");
    }
  };

  const fmtText=text=>text.split(/\*([^*]+)\*/g).map((t,i)=>i%2===1?<strong key={i} style={{color:"#fff"}}>{t}</strong>:t);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div className="syne" style={{fontSize:isMobile?17:20,fontWeight:800,color:C.text,marginBottom:3}}>WhatsApp Bot Preview</div>
          <div style={{fontSize:12,color:C.muted}}>Simulate the customer purchase experience</div>
        </div>
        <BtnGhost onClick={reset} sm><RefreshCw size={12}/>Reset</BtnGhost>
      </div>

      <div style={{display:"flex",justifyContent:"center"}}>
        <div style={{width:"100%",maxWidth:340,background:C.surface,
          border:`2px solid ${C.border2}`,borderRadius:24,overflow:"hidden",
          display:"flex",flexDirection:"column",height:560}}>
          <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:"12px 16px",
            display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
            <div style={{width:36,height:36,borderRadius:"50%",flexShrink:0,
              background:`linear-gradient(135deg,${C.accent},${C.accent2})`,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Ticket size={15} color="#fff"/>
            </div>
            <div>
              <div style={{color:C.text,fontSize:13,fontWeight:600}}>Buzzket</div>
              <div style={{color:C.green,fontSize:11}}>● Online</div>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:8,background:C.bg}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",justifyContent:m.from==="user"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"80%",padding:"8px 12px",borderRadius:14,fontSize:12,
                  lineHeight:1.55,whiteSpace:"pre-line",
                  background:m.from==="user"?C.accent:C.card,
                  color:m.from==="user"?"#fff":"#C4C4D0",
                  borderBottomRightRadius:m.from==="user"?3:14,
                  borderBottomLeftRadius:m.from==="bot"?3:14}}>
                  {fmtText(m.text)}
                </div>
              </div>
            ))}
            <div ref={bottomRef}/>
          </div>
          <div style={{background:C.card,borderTop:`1px solid ${C.border}`,
            padding:"10px 12px",display:"flex",gap:8,flexShrink:0}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
              style={{flex:1,background:C.surface,border:`1px solid ${C.border2}`,borderRadius:20,
                padding:"8px 14px",color:C.text,fontSize:12}}
              placeholder="Type a message..."/>
            <button onClick={send} style={{width:34,height:34,borderRadius:"50%",border:"none",
              cursor:"pointer",background:`linear-gradient(135deg,${C.accent},${C.accent2})`,
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
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

function TabEvents({ user, events, setEvents, tiers, setTiers }) {
  const isMobile = useIsMobile();
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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,gap:12}}>
        <div>
          <div className="syne" style={{fontSize:isMobile?17:20,fontWeight:800,color:C.text,marginBottom:3}}>My Events</div>
          <div style={{fontSize:12,color:C.muted}}>{mine.length} events</div>
        </div>
        <BtnPrimary onClick={()=>setEModal(true)}><Plus size={13}/>{isMobile?"New":"New Event"}</BtnPrimary>
      </div>

      {mine.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:C.muted}}>No events yet. Create your first one!</div>}

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {mine.map(ev=>{
          const evTiers=tiers.filter(t=>t.eventId===ev.id);
          const totalSold=evTiers.reduce((s,t)=>s+t.sold,0);
          const totalRev=evTiers.reduce((s,t)=>s+t.sold*t.price,0);
          return (
            <Card key={ev.id} style={{padding:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div style={{flex:1,minWidth:0,marginRight:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                    <span className="syne" style={{color:C.text,fontWeight:700,fontSize:15}}>{ev.name}</span>
                    <Badge status={ev.status}/>
                  </div>
                  <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:isMobile?4:14,color:C.muted,fontSize:12}}>
                    <span style={{display:"flex",alignItems:"center",gap:4}}><MapPin size={11}/>{ev.venue}</span>
                    <span style={{display:"flex",alignItems:"center",gap:4}}><Calendar size={11}/>{ev.date}{ev.time?" · "+ev.time:""}</span>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div className="syne" style={{color:C.text,fontWeight:800,fontSize:isMobile?16:18}}>{totalSold}</div>
                  <div style={{color:C.green,fontSize:12,fontWeight:500}}>{UGX(totalRev)}</div>
                  <div style={{color:C.muted,fontSize:10}}>sold / revenue</div>
                </div>
              </div>
              {evTiers.length>0&&(
                <div style={{marginBottom:12,display:"flex",flexDirection:"column",gap:7}}>
                  {evTiers.map(t=>{
                    const pct=Math.min((t.sold/t.total)*100,100);
                    return (
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{color:C.muted,fontSize:11,width:64,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
                        <div style={{flex:1,height:5,borderRadius:4,background:C.border2}}>
                          <div style={{height:5,borderRadius:4,width:`${pct}%`,background:`linear-gradient(90deg,${C.accent},${C.accent2})`,transition:"width 0.4s"}}/>
                        </div>
                        <span style={{color:C.muted,fontSize:11,width:48,textAlign:"right",flexShrink:0}}>{t.sold}/{t.total}</span>
                        <span style={{color:C.dim,fontSize:11,width:80,textAlign:"right",flexShrink:0}}>{UGX(t.price)}</span>
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
          <Field label="Event Name"><input value={eForm.name} onChange={e=>setEForm(p=>({...p,name:e.target.value}))} style={inputSt} placeholder="e.g. Afrobeats Night"/></Field>
          <Field label="Venue"><input value={eForm.venue} onChange={e=>setEForm(p=>({...p,venue:e.target.value}))} style={inputSt} placeholder="e.g. Kampala Serena Hotel"/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Date"><input type="date" value={eForm.date} onChange={e=>setEForm(p=>({...p,date:e.target.value}))} style={inputSt}/></Field>
            <Field label="Time"><input type="time" value={eForm.time} onChange={e=>setEForm(p=>({...p,time:e.target.value}))} style={inputSt}/></Field>
          </div>
          <Field label="Total Capacity"><input type="number" value={eForm.capacity} onChange={e=>setEForm(p=>({...p,capacity:e.target.value}))} style={inputSt} placeholder="e.g. 500"/></Field>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <BtnGhost onClick={()=>setEModal(false)} full>Cancel</BtnGhost>
            <BtnPrimary onClick={createEvent} full>Create Event</BtnPrimary>
          </div>
        </Modal>
      )}

      {tModal&&(
        <Modal title="Add Ticket Tier" onClose={()=>setTModal(null)}>
          <Field label="Tier Name"><input value={tForm.name} onChange={e=>setTForm(p=>({...p,name:e.target.value}))} style={inputSt} placeholder="e.g. VIP, Regular, Student"/></Field>
          <Field label="Price (UGX)"><input type="number" value={tForm.price} onChange={e=>setTForm(p=>({...p,price:e.target.value}))} style={inputSt} placeholder="e.g. 50000"/></Field>
          <Field label="Quantity Available"><input type="number" value={tForm.total} onChange={e=>setTForm(p=>({...p,total:e.target.value}))} style={inputSt} placeholder="e.g. 200"/></Field>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <BtnGhost onClick={()=>setTModal(null)} full>Cancel</BtnGhost>
            <BtnPrimary onClick={addTier} full>Add Tier</BtnPrimary>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TabOrgSales({ user, orders, events, tiers, orgs }) {
  const isMobile = useIsMobile();
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

  return (
    <div>
      <div style={{marginBottom:20}}>
        <div className="syne" style={{fontSize:isMobile?17:20,fontWeight:800,color:C.text,marginBottom:3}}>Sales & Revenue</div>
        <div style={{fontSize:12,color:C.muted}}>Your earnings summary</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        <StatCard label="Gross Revenue" value={UGX(grossRev)} icon={DollarSign} color={C.green}/>
        <StatCard label="Commission" value={UGX(comm)} icon={TrendingUp} color={C.accent}
          sub={`${org?.commPct}% + ${UGX(org?.commFixed||0)}/ticket`}/>
        <StatCard label="Net Earnings" value={UGX(grossRev-comm)} icon={Zap} color={C.blue}/>
        <StatCard label="Tickets Sold" value={approved.reduce((s,o)=>s+o.qty,0)} icon={Ticket} color={C.purple}/>
      </div>

      <Card>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`}}>
          <span className="syne" style={{color:C.text,fontWeight:700,fontSize:14}}>Transactions</span>
        </div>
        {myOrders.length===0?(
          <div style={{textAlign:"center",padding:"40px 0",color:C.muted,fontSize:13}}>No transactions yet</div>
        ):(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:580}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${C.border}`}}>
                  {["Customer","Event","Tier","Qty","Amount","TID","Status","Date"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"10px 14px",fontSize:11,color:C.muted,fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myOrders.map(o=>{
                  const ev=events.find(e=>e.id===o.eventId);
                  const tier=tiers.find(t=>t.id===o.tierId);
                  return (
                    <tr key={o.id} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"11px 14px"}}>
                        <div style={{color:C.text,fontSize:13}}>{o.name}</div>
                        <div style={{color:C.dim,fontSize:11}}>{o.wa}</div>
                      </td>
                      <td style={{padding:"11px 14px",color:C.muted,fontSize:12,whiteSpace:"nowrap"}}>{ev?.name}</td>
                      <td style={{padding:"11px 14px",color:C.muted,fontSize:12}}>{tier?.name}</td>
                      <td style={{padding:"11px 14px",color:C.muted,fontSize:12}}>{o.qty}</td>
                      <td style={{padding:"11px 14px",color:C.green,fontSize:13,fontWeight:500}}>{UGX(o.total)}</td>
                      <td style={{padding:"11px 14px",fontFamily:"monospace",color:C.accent,fontSize:11}}>{o.tid}</td>
                      <td style={{padding:"11px 14px"}}><Badge status={o.status}/></td>
                      <td style={{padding:"11px 14px",color:C.dim,fontSize:11,whiteSpace:"nowrap"}}>{o.at}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── QR Scanner (real camera via html5-qrcode) ─────────────── */
function TabScanner({ user, events, tickets, setTickets, tiers }) {
  const isMobile = useIsMobile();
  const mine=events.filter(e=>e.orgId===user.id);
  const [selEv,setSelEv]=useState(mine[0]?.id||null);
  const [scanInput,setScanInput]=useState("");
  const [result,setResult]=useState(null);
  const [scanning,setScanning]=useState(false);
  const [camActive,setCamActive]=useState(false);
  const [camError,setCamError]=useState("");
  const scannerRef=useRef(null);
  const lastScanRef=useRef(null); // debounce duplicate scans

  const evTickets=tickets.filter(t=>t.eventId===selEv);
  const checkedIn=evTickets.filter(t=>t.used).length;

  // Use a ref for the latest processTicket so scanner callback always calls fresh version
  const processRef=useRef(null);
  processRef.current=(ticketId)=>{
    const id=ticketId.trim().toUpperCase().replace(/\s/g,"");
    if(lastScanRef.current===id)return; // prevent duplicate within 2 sec
    lastScanRef.current=id;
    setTimeout(()=>{lastScanRef.current=null;},2000);

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
  };

  const doManualScan=()=>{
    if(!scanInput.trim())return;
    setScanning(true);
    setTimeout(()=>{processRef.current(scanInput);setScanning(false);setScanInput("");},600);
  };

  const simulateScan=()=>{
    const u=evTickets.filter(t=>!t.used);
    if(u.length>0)processRef.current(u[0].id);
    else setResult({status:"invalid",id:"DEMO-NONE"});
  };

  const stopCamera=useCallback(()=>{
    if(scannerRef.current){
      scannerRef.current.clear().catch(()=>{});
      scannerRef.current=null;
    }
    setCamActive(false);setCamError("");
    // remove any leftover qr-reader children
    const el=document.getElementById("qr-reader");
    if(el)el.innerHTML="";
  },[]);

  const startCamera=useCallback(()=>{
    stopCamera();setCamError("");
    try {
      const scanner=new Html5QrcodeScanner(
        "qr-reader",
        {fps:15,qrbox:{width:240,height:240},rememberLastUsedCamera:true,
         aspectRatio:1.0,showTorchButtonIfSupported:true,
         videoConstraints:{facingMode:"environment"}},
        false
      );
      scanner.render(
        (text)=>processRef.current(text),
        ()=>{}
      );
      scannerRef.current=scanner;
      setCamActive(true);
    } catch(e){
      setCamError("Could not start camera. Please allow camera permissions in your browser settings.");
    }
  },[stopCamera]);

  // clean up on unmount
  useEffect(()=>()=>stopCamera(),[stopCamera]);

  // stop camera when switching event
  useEffect(()=>{stopCamera();setResult(null);},[selEv]);

  const ResCard=({status})=>{
    const cfg={
      valid:{bg:"rgba(16,185,129,0.08)",border:C.green,icon:<CheckCircle size={40} style={{color:C.green}}/>,title:"✓ Valid Ticket",tc:C.green},
      used: {bg:"rgba(249,115,22,0.08)",border:C.amber,icon:<AlertCircle size={40} style={{color:C.amber}}/>,title:"Already Scanned",tc:C.amber},
      invalid:{bg:"rgba(239,68,68,0.08)",border:C.accent2,icon:<XCircle size={40} style={{color:C.accent2}}/>,title:"Invalid Ticket",tc:C.accent2},
      wrong_event:{bg:"rgba(239,68,68,0.08)",border:C.accent2,icon:<XCircle size={40} style={{color:C.accent2}}/>,title:"Wrong Event",tc:C.accent2},
    }[status]||{};
    return (
      <div style={{background:cfg.bg,border:`2px solid ${cfg.border}`,borderRadius:16,
        padding:24,textAlign:"center",animation:"fadeIn 0.2s ease"}}>
        <div style={{marginBottom:12}}>{cfg.icon}</div>
        <div className="syne" style={{fontSize:20,fontWeight:800,color:cfg.tc,marginBottom:10}}>{cfg.title}</div>
        {result.status==="valid"&&<>
          <div style={{fontSize:18,fontWeight:600,color:C.text}}>{result.ticket.name}</div>
          <div style={{color:C.muted,fontSize:13,marginTop:4}}>{result.ticket.tierName} · {result.ticket.id}</div>
          <div style={{color:C.green,fontSize:12,marginTop:6,fontWeight:500}}>Checked in · {result.scannedAt}</div>
        </>}
        {result.status==="used"&&<>
          <div style={{fontSize:15,color:C.text}}>{result.ticket.name}</div>
          <div style={{color:C.muted,fontSize:12,marginTop:4}}>First scanned: {result.ticket.scannedAt}</div>
          <div style={{color:C.accent2,fontSize:12,fontWeight:700,marginTop:6}}>⚠️ Do not allow entry</div>
        </>}
        {(result.status==="invalid"||result.status==="wrong_event")&&
          <div style={{color:C.muted,fontSize:13}}>{result.status==="wrong_event"?"Ticket belongs to a different event":"Ticket ID not recognised"}</div>}
        <button onClick={()=>setResult(null)} style={{marginTop:14,background:"transparent",
          border:"none",color:C.muted,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>
          Scan next →
        </button>
      </div>
    );
  };

  return (
    <div style={{maxWidth:520,margin:"0 auto"}}>
      <div style={{marginBottom:20}}>
        <div className="syne" style={{fontSize:isMobile?17:20,fontWeight:800,color:C.text,marginBottom:3}}>QR Scanner</div>
        <div style={{fontSize:12,color:C.muted}}>Real-time ticket check-in</div>
      </div>

      <Card style={{padding:14,marginBottom:14}}>
        <div style={{fontSize:10,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:500}}>Select Event</div>
        <select value={selEv||""} onChange={e=>{setSelEv(Number(e.target.value));setResult(null);}}
          style={{...inputSt,padding:"10px 12px"}}>
          {mine.length===0&&<option value="">No events yet</option>}
          {mine.map(e=><option key={e.id} value={e.id}>{e.name} — {e.date}</option>)}
        </select>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[{l:"Checked In",v:checkedIn,c:C.green},{l:"Remaining",v:evTickets.length-checkedIn,c:C.accent},{l:"Total",v:evTickets.length,c:C.blue}].map(s=>(
          <Card key={s.l} style={{padding:12,textAlign:"center"}}>
            <div className="syne" style={{fontSize:22,fontWeight:800,color:s.c,marginBottom:2}}>{s.v}</div>
            <div style={{fontSize:10,color:C.muted}}>{s.l}</div>
          </Card>
        ))}
      </div>

      <Card style={{padding:18,marginBottom:14}}>
        {/* Camera area */}
        {!camActive?(
          <div style={{borderRadius:12,height:150,background:C.bg,border:`2px dashed ${C.border2}`,
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",marginBottom:14}}>
            <QrCode size={40} style={{color:C.dim,marginBottom:8}}/>
            <div style={{color:C.muted,fontSize:12,marginBottom:4}}>Camera not started</div>
            {camError&&<div style={{color:C.accent2,fontSize:11,textAlign:"center",padding:"0 16px",marginBottom:8}}>{camError}</div>}
          </div>
        ):(
          <div style={{marginBottom:14}}>
            <div id="qr-reader" style={{borderRadius:12,overflow:"hidden",background:C.bg}}/>
          </div>
        )}

        <div style={{display:"flex",gap:8,marginBottom:10}}>
          {!camActive
            ?<BtnPrimary onClick={startCamera} full><Scan size={13}/>Start Camera</BtnPrimary>
            :<BtnGhost onClick={stopCamera} full><X size={13}/>Stop Camera</BtnGhost>
          }
        </div>

        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <input value={scanInput} onChange={e=>setScanInput(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==="Enter"&&doManualScan()}
            placeholder="Or type Ticket ID (e.g. BZK-A1B2C)"
            style={{...inputSt,flex:1,fontFamily:"monospace",fontSize:12,padding:"9px 12px"}}/>
          <button onClick={doManualScan} style={{background:`linear-gradient(135deg,${C.accent},${C.accent2})`,
            color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",cursor:"pointer",
            display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,flexShrink:0}}>
            {scanning?<div style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.4)",
              borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>:<Scan size={13}/>}
          </button>
        </div>

        <button onClick={simulateScan} style={{width:"100%",padding:"8px 0",borderRadius:10,
          background:"transparent",border:`1px dashed ${C.border2}`,
          color:C.muted,fontSize:11,cursor:"pointer"}}>
          ↓ Simulate scan (demo — no camera needed)
        </button>
      </Card>

      {result&&<ResCard status={result.status}/>}

      {evTickets.filter(t=>t.used).length>0&&(
        <Card style={{padding:16,marginTop:14}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:500}}>Recent Check-ins</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {evTickets.filter(t=>t.used).slice(-5).reverse().map(t=>(
              <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <span style={{color:C.text,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
                <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                  <span style={{color:C.dim,fontSize:11,fontFamily:"monospace"}}>{t.id}</span>
                  <span style={{color:C.green,fontSize:11,whiteSpace:"nowrap"}}>{t.scannedAt}</span>
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
function Login({ onLogin, orgs }) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [show,setShow]=useState(false);
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);

  const handle=e=>{
    e.preventDefault();
    setLoading(true);
    setTimeout(()=>{
      setLoading(false);
      if(email==="admin@buzzket.ug"&&password==="admin123"){
        onLogin({role:"admin",name:"Buzzket Admin",id:0});return;
      }
      const org=orgs.find(o=>o.email===email&&o.password===password);
      if(org){
        if(!org.active){setErr("This account has been deactivated. Contact the admin.");return;}
        onLogin({role:"organiser",...org});return;
      }
      setErr("Invalid email or password. Please try again.");
    },600);
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",
      justifyContent:"center",padding:16,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:"25%",left:"50%",transform:"translateX(-50%)",
        width:500,height:500,borderRadius:"50%",
        background:"radial-gradient(circle,rgba(249,115,22,0.07),transparent 70%)",pointerEvents:"none"}}/>

      <div style={{width:"100%",maxWidth:360,position:"relative"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:12,marginBottom:8}}>
            <div style={{width:44,height:44,borderRadius:14,flexShrink:0,
              background:`linear-gradient(135deg,${C.accent},${C.accent2})`,
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
            <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",
              borderRadius:10,padding:"10px 14px",fontSize:13,color:"#FCA5A5",
              marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <AlertCircle size={14}/>{err}
            </div>
          )}

          <form onSubmit={handle}>
            <Field label="Email Address">
              <input type="email" value={email} autoComplete="email"
                onChange={e=>{setEmail(e.target.value);setErr("");}}
                style={inputSt} placeholder="your@email.com"/>
            </Field>

            <Field label="Password">
              {/* fixed: wrapper is position:relative, button absolutely positioned */}
              <div style={{position:"relative",display:"flex",alignItems:"center"}}>
                <input type={show?"text":"password"} value={password} autoComplete="current-password"
                  onChange={e=>{setPassword(e.target.value);setErr("");}}
                  style={{...inputSt,paddingRight:44}}
                  placeholder="••••••••"/>
                <button type="button" onClick={()=>setShow(s=>!s)}
                  style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                    background:"none",border:"none",color:C.muted,cursor:"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    padding:4,lineHeight:0}}>
                  {show?<EyeOff size={16}/>:<Eye size={16}/>}
                </button>
              </div>
            </Field>

            <button type="submit" disabled={loading} style={{
              width:"100%",padding:"13px 0",borderRadius:10,border:"none",marginTop:8,
              background:loading?C.border2:`linear-gradient(135deg,${C.accent},${C.accent2})`,
              color:"#fff",fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              transition:"background 0.2s",
            }}>
              {loading&&<div style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",
                borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>}
              {loading?"Signing in…":"Sign In →"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARDS
═══════════════════════════════════════════════════════════════ */
function AdminDash({ user, logout, ...shared }) {
  const [tab,setTab]=useState("organisers");
  const isMobile=useIsMobile();
  const pending=shared.orders.filter(o=>o.status==="pending").length;

  const nav=[
    {id:"organisers",label:"Organisers",shortLabel:"Orgs",icon:Users},
    {id:"commission",label:"Commission",shortLabel:"Comms",icon:Settings},
    {id:"payments",label:"Payments",shortLabel:"Payments",icon:CreditCard,badge:pending},
    {id:"sales",label:"Sales",shortLabel:"Sales",icon:BarChart3},
    {id:"bot",label:"Bot Preview",shortLabel:"Bot",icon:MessageSquare},
  ];

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:C.bg}}>
      <style>{GFONTS}</style>
      {!isMobile&&<Sidebar user={user} nav={nav} active={tab} setActive={setTab} onLogout={logout}/>}
      <main style={{flex:1,overflowY:"auto",padding:isMobile?"16px 14px 80px":"32px"}}>
        {tab==="organisers"&&<TabOrganisers orgs={shared.orgs} setOrgs={shared.setOrgs}/>}
        {tab==="commission"&&<TabCommission orgs={shared.orgs} setOrgs={shared.setOrgs}/>}
        {tab==="payments"&&<TabPayments orders={shared.orders} setOrders={shared.setOrders} events={shared.events} tiers={shared.tiers}/>}
        {tab==="sales"&&<TabAdminSales orders={shared.orders} events={shared.events} tiers={shared.tiers} orgs={shared.orgs}/>}
        {tab==="bot"&&<TabBotPreview events={shared.events} tiers={shared.tiers} orders={shared.orders} setOrders={shared.setOrders}/>}
      </main>
      {isMobile&&<MobileNav nav={nav} active={tab} setActive={setTab} onLogout={logout}/>}
    </div>
  );
}

function OrgDash({ user, logout, ...shared }) {
  const [tab,setTab]=useState("events");
  const isMobile=useIsMobile();

  const nav=[
    {id:"events",label:"My Events",shortLabel:"Events",icon:Layers},
    {id:"sales",label:"Sales",shortLabel:"Sales",icon:BarChart3},
    {id:"scanner",label:"QR Scanner",shortLabel:"Scanner",icon:QrCode},
  ];

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",background:C.bg}}>
      <style>{GFONTS}</style>
      {!isMobile&&<Sidebar user={user} nav={nav} active={tab} setActive={setTab} onLogout={logout}/>}
      <main style={{flex:1,overflowY:"auto",padding:isMobile?"16px 14px 80px":"32px"}}>
        {tab==="events"&&<TabEvents user={user} events={shared.events} setEvents={shared.setEvents} tiers={shared.tiers} setTiers={shared.setTiers}/>}
        {tab==="sales"&&<TabOrgSales user={user} orders={shared.orders} events={shared.events} tiers={shared.tiers} orgs={shared.orgs}/>}
        {tab==="scanner"&&<TabScanner user={user} events={shared.events} tickets={shared.tickets} setTickets={shared.setTickets} tiers={shared.tiers}/>}
      </main>
      {isMobile&&<MobileNav nav={nav} active={tab} setActive={setTab} onLogout={logout}/>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [user,setUser]=useState(null);
  const [orgs,setOrgs]=useState(SEED_ORGS);
  const [events,setEvents]=useState(SEED_EVENTS);
  const [tiers,setTiers]=useState(SEED_TIERS);
  const [orders,setOrders]=useState(SEED_ORDERS);
  const [tickets,setTickets]=useState(SEED_TICKETS);

  const shared={orgs,setOrgs,events,setEvents,tiers,setTiers,orders,setOrders,tickets,setTickets};

  if(!user) return <><style>{GFONTS}</style><Login onLogin={setUser} orgs={orgs}/></>;
  if(user.role==="admin") return <AdminDash user={user} logout={()=>setUser(null)} {...shared}/>;
  return <OrgDash user={user} logout={()=>setUser(null)} {...shared}/>;
}
