import { useState, useEffect, useRef } from "react";
import {
  chatWithBigHomie,
  createCheckoutSession,
  createStripeConnectOnboarding,
  getReferralStats,
  requestReferralCashout,
  runCheckInAnalysis,
  saveOnboarding,
} from "../lib/api";

const B = {
  obsidian:"#0A0806", charcoal:"#1A1410", espresso:"#2C1F14",
  bronze:"#8B5E3C", copper:"#C47A3A", gold:"#E8A838",
  amber:"#F5C842", cream:"#F5ECD7", muted:"#9A8570",
  success:"#4CAF7D", danger:"#E05252", blue:"#5B9BD5", purple:"#9B72CF",
  goldGrad:"linear-gradient(135deg,#C47A3A 0%,#E8A838 50%,#F5C842 100%)",
  cardGrad:"linear-gradient(145deg,#1A1410 0%,#2C1F14 100%)",
  display:"'Bebas Neue',Impact,sans-serif",
  body:"'DM Sans','Helvetica Neue',sans-serif",
  mono:"'DM Mono',monospace",
};

const DAILY_QUOTES = [
  "A part of all you earn is yours to keep.",
  "Wealth is what you build, not what you spend.",
  "The man who saves consistently will always outrun the man who earns more.",
  "Gold comes gladly to the man who saves at least one tenth of his earnings.",
  "Start where you are. Use what you have. Do what you can.",
  "Opportunity waits for no man. When it comes, seize it.",
  "Invest in yourself first. Knowledge is the one asset that can't be taken.",
  "Small amounts saved consistently become fortunes. Always.",
  "The walls of Babylon were built one brick at a time.",
  "Make your money work harder than you do.",
  "Debt is a fire. Manage it or it burns everything.",
  "The community rises when individuals build.",
  "Learn the rules of money or pay the price of ignorance.",
  "Everybody eats when one person knows the way.",
];

function fmt(n){return"$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtK(n){return n>=1000?"$"+(n/1000).toFixed(1)+"K":"$"+n;}
function pct(n){return(n>=0?"+":"")+Number(n).toFixed(1)+"%";}
function getDailyQuote(){return DAILY_QUOTES[new Date().getDate()%DAILY_QUOTES.length];}

// ─── SHARED UI ────────────────────────────────────────────────────────
function Card({children,style={},glow=false,onClick}){
  return <div onClick={onClick} style={{background:B.cardGrad,border:`1px solid rgba(232,168,56,${glow?"0.3":"0.1"})`,borderRadius:"16px",padding:"20px",boxShadow:glow?"0 0 30px rgba(232,168,56,0.08)":"none",cursor:onClick?"pointer":"default",...style}}>{children}</div>;
}
function SL({children,color=B.gold,style={}}){
  return <div style={{fontSize:"11px",letterSpacing:"3px",textTransform:"uppercase",color,marginBottom:"8px",fontWeight:"700",...style}}>{children}</div>;
}
function PT({children}){
  return <div style={{fontFamily:B.display,fontSize:"38px",letterSpacing:"2px",color:B.cream,marginBottom:"6px",lineHeight:"1"}}>{children}</div>;
}
function GBtn({children,onClick,style={}}){
  return <button onClick={onClick} style={{background:B.goldGrad,color:B.obsidian,border:"none",borderRadius:"10px",padding:"10px 20px",fontSize:"13px",fontWeight:"800",fontFamily:B.body,cursor:"pointer",...style}}>{children}</button>;
}
function OBtn({children,onClick,style={}}){
  return <button onClick={onClick} style={{background:"transparent",color:B.gold,border:"1px solid rgba(232,168,56,0.4)",borderRadius:"10px",padding:"9px 18px",fontSize:"13px",fontWeight:"600",fontFamily:B.body,cursor:"pointer",...style}}>{children}</button>;
}
function BHInsight({text}){
  return(
    <div style={{background:B.espresso,border:"1px solid rgba(232,168,56,0.2)",borderLeft:`4px solid ${B.gold}`,borderRadius:"14px",padding:"16px 18px",display:"flex",gap:"12px",alignItems:"flex-start"}}>
      <div style={{width:"32px",height:"32px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"13px",color:B.obsidian,flexShrink:0}}>BH</div>
      <div>
        <div style={{fontSize:"10px",color:B.gold,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"4px"}}>Big Homie</div>
        <div style={{fontSize:"14px",color:B.cream,lineHeight:"1.6"}}>{text}</div>
      </div>
    </div>
  );
}
function EmptyState({icon,title,body,cta,onCta}){
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 24px",textAlign:"center",gap:"14px"}}>
      <div style={{fontSize:"48px"}}>{icon}</div>
      <div style={{fontFamily:B.display,fontSize:"24px",letterSpacing:"2px",color:B.cream}}>{title}</div>
      <div style={{fontSize:"14px",color:B.muted,lineHeight:"1.7",maxWidth:"320px"}}>{body}</div>
      {cta&&<GBtn onClick={onCta} style={{marginTop:"8px"}}>{cta}</GBtn>}
    </div>
  );
}
function ProBadge(){return <span style={{background:B.goldGrad,color:B.obsidian,fontSize:"9px",fontWeight:"800",padding:"2px 7px",borderRadius:"100px",letterSpacing:"1px",marginLeft:"6px"}}>PRO</span>;}
function LockedOverlay({onUpgrade}){
  return(
    <div style={{position:"absolute",inset:0,background:"rgba(10,8,6,0.88)",backdropFilter:"blur(6px)",borderRadius:"16px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"14px",zIndex:10}}>
      <div style={{fontSize:"32px"}}>🔒</div>
      <div style={{fontFamily:B.display,fontSize:"24px",letterSpacing:"2px",color:B.cream,textAlign:"center"}}>PRO FEATURE</div>
      <div style={{fontSize:"14px",color:B.muted,textAlign:"center",maxWidth:"260px",lineHeight:"1.5"}}>Unlock unlimited AI, brokerage sync, bank connection and more.</div>
      <GBtn onClick={onUpgrade}>Upgrade to Pro — $9.99/mo</GBtn>
    </div>
  );
}
function StatCard({label,value,sub,subColor,icon}){
  return(
    <Card>
      <div style={{fontSize:"11px",color:B.muted,letterSpacing:"1px",textTransform:"uppercase",marginBottom:"8px"}}>{icon} {label}</div>
      <div style={{fontFamily:B.display,fontSize:"28px",letterSpacing:"1px",color:B.cream,marginBottom:"4px"}}>{value}</div>
      <div style={{fontSize:"12px",color:subColor||B.success,fontWeight:"600"}}>{sub}</div>
    </Card>
  );
}
function CollegiateLogo({width=180,height=52}){
  return(
    <svg viewBox="0 0 260 74" width={width} height={height} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lgMain" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C47A3A"/><stop offset="55%" stopColor="#E8A838"/><stop offset="100%" stopColor="#F5C842"/>
        </linearGradient>
      </defs>
      <rect x="10" y="4" width="240" height="1.5" fill="url(#lgMain)" rx="1"/>
      <text x="130" y="14" fontFamily="'DM Sans',sans-serif" fontSize="5.5" fontWeight="800" fill="#9A8570" letterSpacing="3" textAnchor="middle">EST. IN THE COMMUNITY</text>
      <rect x="10" y="18" width="240" height="0.8" fill="rgba(232,168,56,0.2)" rx="1"/>
      <text x="130" y="43" fontFamily="'Bebas Neue',Impact,sans-serif" fontSize="22" fill="#6A5840" letterSpacing="14" textAnchor="middle">BIG</text>
      <text x="130" y="63" fontFamily="'Bebas Neue',Impact,sans-serif" fontSize="34" fill="#F5ECD7" letterSpacing="5" textAnchor="middle">HOMIE</text>
      <rect x="10" y="66" width="240" height="1.5" fill="url(#lgMain)" rx="1"/>
      <text x="130" y="73" fontFamily="'DM Sans',sans-serif" fontSize="5" fontWeight="800" fill="#E8A838" letterSpacing="3" textAnchor="middle">EVERYBODY EAT · EST. 2025</text>
    </svg>
  );
}

// ─── PRICING MODAL ────────────────────────────────────────────────────
function PricingModal({onClose,onSelect}){
  const plans=[
    {id:"free",name:"FREE",price:"$0",period:"forever",color:B.muted,features:["Budget calculator","Manual portfolio tracking","5 Big Homie AI responses/day","Emergency fund tracker","Full Financial Literacy — The Manual","All 10 teaching videos"],cta:"Current Plan",disabled:true},
    {id:"pro",name:"PRO",price:"$9.99",period:"per month",color:B.gold,badge:"MOST POPULAR",features:["Unlimited Big Homie AI","Full budget AI analysis","Brokerage account connection","Bank account sync","Real-time stock & portfolio alerts","LEAP / options tracking","Real estate deal analyzer","Check In session included monthly"],cta:"Go Pro",disabled:false},
    {id:"annual",name:"ANNUAL",price:"$79",period:"per year · save $40",color:B.copper,badge:"BEST VALUE",features:["Everything in Pro","Save $40 vs monthly","2 Check In sessions per year","Priority AI response speed","Early access to new features"],cta:"Go Annual",disabled:false},
    {id:"checkin",name:"THE CHECK IN",price:"$4.99",period:"one time",color:B.gold,features:["Full checking account analysis","Your money story (funny & real)","3 biggest leaks — named & priced","The law that applies to you right now","90-day action plan","Download your report","No subscription required"],cta:"Start My Check In",disabled:false},
  ];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{background:B.charcoal,borderRadius:"20px",border:"1px solid rgba(232,168,56,0.2)",padding:"32px",maxWidth:"900px",width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"28px"}}>
          <div>
            <SL>Big Homie</SL>
            <PT>CHOOSE YOUR PLAN</PT>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"none",color:B.muted,width:"34px",height:"34px",borderRadius:"8px",cursor:"pointer",fontSize:"18px"}}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px"}}>
          {plans.map(p=>(
            <div key={p.id} style={{background:B.cardGrad,border:`1px solid ${p.color}30`,borderRadius:"14px",padding:"20px",display:"flex",flexDirection:"column",gap:"10px",position:"relative"}}>
              {p.badge&&<div style={{position:"absolute",top:"-10px",left:"50%",transform:"translateX(-50%)",background:p.color,color:B.obsidian,fontSize:"9px",fontWeight:"800",padding:"3px 10px",borderRadius:"100px",letterSpacing:"1px",whiteSpace:"nowrap"}}>{p.badge}</div>}
              <div style={{fontFamily:B.display,fontSize:"20px",letterSpacing:"2px",color:p.color}}>{p.name}</div>
              <div><span style={{fontFamily:B.display,fontSize:"28px",color:B.cream}}>{p.price}</span><span style={{fontSize:"11px",color:B.muted,marginLeft:"4px"}}>{p.period}</span></div>
              <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:"10px",display:"flex",flexDirection:"column",gap:"7px"}}>
                {p.features.map(f=><div key={f} style={{fontSize:"12px",color:B.muted,display:"flex",gap:"6px",alignItems:"flex-start"}}><span style={{color:p.color,marginTop:"1px"}}>✓</span>{f}</div>)}
              </div>
              <GBtn onClick={()=>!p.disabled&&onSelect(p.id)} style={{marginTop:"auto",opacity:p.disabled?0.4:1,background:p.disabled?"transparent":B.goldGrad,border:p.disabled?`1px solid ${B.muted}`:"none",color:p.disabled?B.muted:B.obsidian}}>{p.cta}</GBtn>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────
const getBHResponse = (goal, name) => {
  const responses = {
    "Stop living check to check":{
      law:"LAW 03", lawName:"The 50/30/20 Rule", lawIcon:"💰",
      message:`${name}, lemme keep it a buck — most people living check to check ain't broke. They just never got taught how to split the bag when it lands. 50 to what you need. 30 to how you live. 20 straight to building. That one move right there? Changes the whole story.`,
      how:`I got you on the Budget tab. We map every dollar coming in and restructure it together. Then when you're ready, The Check In reads your actual transactions — tells you exactly where the money's going before it even gets to you.`,
      firstMove:"Open the Budget tab. Set your first 50/30/20 split. That's it for today."
    },
    "Kill this debt for real":{
      law:"LAW 09", lawName:"Debt — Kill or Keep", lawIcon:"⚔️",
      message:`Real talk, ${name} — not all debt deserves to die. A credit card at 24% APR? That's a fire in your wallet right now. A car note at 4%? That's manageable. The move is knowing the difference and hitting the expensive ones first. Hard. Fast. No mercy.`,
      how:`We build your debt kill order together in the Budget section — ranked by interest rate, not by which balance scares you the most. The Check In shows you exactly what that debt is costing you every year. Most people don't know the real number. You will.`,
      firstMove:"Write down every debt — balance and interest rate. Highest rate goes first. That's the list."
    },
    "Stack my first $10K":{
      law:"LAW 01", lawName:"Pay Yourself First", lawIcon:"🏦",
      message:`${name}, $10K is a habit — not an income. The people who stack it ain't making more than you. They just move the money before anyone else gets a cut. Off the top. Automatic. Same day the check lands. Every. Single. Time. That discipline alone separates the builders from everybody else.`,
      how:`We set your savings target in the Budget section and I track your progress every time you check in. The Check In report will show you the exact leaks — the money leaving before it ever has a chance to stack.`,
      firstMove:"Pick your amount — even $25 a check counts. Set the auto-transfer for payday. Don't think about it, just move it."
    },
    "Get in the stock market":{
      law:"LAW 08", lawName:"The Stock Market", lawIcon:"📈",
      message:`${name}, the market was never just for rich people. That's the lie they told us to keep us out. An index fund is just you owning a piece of Apple, Amazon, Google — all of it. You put money in every month, market up or down, and let time do the work. That's the whole play. That's how real wealth got built.`,
      how:`The Manual's got Law 8 — I break down index funds, dollar cost averaging, and how to get started with whatever you got right now. The Portfolio tab tracks everything. And I'm in your pocket whenever a question hits.`,
      firstMove:"Open The Manual. Read Law 8. Then open a Roth IRA tonight — you can start with $50."
    },
    "Own property one day":{
      law:"LAW 06", lawName:"Real Estate", lawIcon:"🏠",
      message:`${name}, land is how this country's wealth got built and passed down. Not the stock market — property. Something that goes up in value while somebody else's rent check pays the mortgage. But it starts with your credit score and your down payment. We build those first. Everything else follows.`,
      how:`Law 6 in The Manual maps the whole road from renter to owner — step by step. On Pro, I'll run the numbers on any property you're looking at: purchase price, rental income, expenses, cash flow. I'll tell you if the deal actually works before you commit.`,
      firstMove:"Pull your credit score right now. Free at annualcreditreport.com. That number runs everything — your rate, your approval, your timeline."
    },
    "Make the most of my VA benefits":{
      law:"LAW 07", lawName:"Protect What You Build", lawIcon:"🎖️",
      message:`${name}, you earned benefits most people don't even know exist. VA disability is tax-free income — that changes your whole financial picture. Healthcare, education, home loans with no down payment. The system owes you. Let's make sure you collect every dollar of it.`,
      how:`I know the difference between BAH, BAS, VA comp, and a regular check. The budget tools here account for your actual income sources. And The Manual's Law 7 covers exactly how to protect and maximize what you've built in service.`,
      firstMove:"Pull your VA rating and benefits summary at va.gov. If you're not at the right rating — file a claim. Money left on the table is money left on the table."
    },
    "Use my GI Bill right":{
      law:"LAW 04", lawName:"Make Your Money Work", lawIcon:"🎓",
      message:`${name}, the GI Bill is one of the most powerful wealth-building tools in this country and most vets use it just to get a degree. Housing allowance while in school. Tuition covered. That BAH while you're learning? That's investable money if you structure it right.`,
      how:`We build your school-to-wealth bridge in the Budget section. Map the BAH coming in, live below it, and put the difference somewhere it grows. I'll show you exactly how.`,
      firstMove:"Calculate your monthly BAH rate for your school's zip code. Live below it. The gap is your investment account."
    },
    "Buy a house with my VA loan":{
      law:"LAW 06", lawName:"Real Estate", lawIcon:"🏠",
      message:`${name}, the VA loan is one of the most slept-on advantages in America. No down payment. No PMI. Competitive rates. You literally have access to home ownership that civilians have to save years for — and most vets don't use it. That ends today.`,
      how:`Law 6 in The Manual maps the whole path. On Pro, I'll analyze any property you're looking at — purchase price, what your note would be, whether the numbers make sense. The VA loan is your weapon. Let's use it.`,
      firstMove:"Get your Certificate of Eligibility at va.gov. That's the key that unlocks the whole thing. Free. Takes 10 minutes."
    },
    "Stack after service":{
      law:"LAW 01", lawName:"Pay Yourself First", lawIcon:"💰",
      message:`Service gave you discipline that most people have to learn the hard way, ${name}. Now apply that same structure to money. Pay yourself first — off the top, automatic, before the bills, before the going out. The military gave you a mission every day. Your money needs one too.`,
      how:`Budget tab is where we set your savings mission. I'll track progress every time you check in. The Check In will read your actual transactions and show you exactly where civilian life is leaking your hard-earned money.`,
      firstMove:"Set up a separate savings account today. Name it your mission. Automate a transfer for payday. Discipline you already have — point it at your money."
    },
    "Build something for my family":{
      law:"LAW 10", lawName:"Generational Wealth", lawIcon:"👑",
      message:`${name}, you already sacrificed for something bigger than yourself. This is the same thing — just for your bloodline. Life insurance. A will. Property. Investments in your kids' names. Making sure the next generation starts further ahead than you did. That's the real mission after service.`,
      how:`Law 10 in The Manual is the blueprint. And as a vet you've got advantages — SGLI life insurance, VA home loan for property, potential disability income that's completely tax-free. We build the legacy with what you have.`,
      firstMove:"Check your SGLI coverage. If you're out of service, convert it to VGLI or get a term policy today. That's the first wall around your family."
    },
    "Transition to civilian money life":{
      law:"LAW 02", lawName:"The Account System", lawIcon:"🔄",
      message:`${name}, military pay was structured — BAH, BAS, base pay, all separated for you. Civilian money isn't. It all just lands in one account and disappears. The transition isn't just a career change — it's learning a whole new money system without the structure the military gave you automatically.`,
      how:`I'll help you rebuild that structure in the Budget section. Separate accounts for separate purposes — spending, saving, investing. The same discipline, applied to your own financial life. The Manual Law 2 is exactly this.`,
      firstMove:"Open three accounts: one for bills, one for savings, one for investing. That separation is the whole system."
    },
    "Build something for my kids":{
      law:"LAW 10", lawName:"Generational Wealth", lawIcon:"👑",
      message:`${name}, this one hits different because it ain't even for you — it's for them. Generational wealth ain't about being rich. It's about your kids not starting from zero. Life insurance so they're protected. A will so what you build stays in the family. Property they can inherit. Knowledge they don't have to learn the hard way like we did.`,
      how:`Law 10 in The Manual is the full blueprint. We build the foundation right here — budget, savings, investments — and every time you open the app I'm reminding you what this is really for.`,
      firstMove:"Get a $500K term life policy today. Probably $25 a month. That's the first wall you build around your family."
    },
  };

  return responses[goal] || responses["Stop living check to check"];
};

function TypedText({text, speed=14, onDone}){
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(()=>{
    setDisplayed(""); setDone(false); let i=0;
    const iv=setInterval(()=>{
      if(i<text.length){setDisplayed(text.slice(0,i+1));i++;}
      else{clearInterval(iv);setDone(true);onDone&&setTimeout(onDone,300);}
    },speed);
    return()=>clearInterval(iv);
  },[text]);
  return <span>{displayed}{!done&&<span style={{opacity:0.5}}>|</span>}</span>;
}

function BHResponseScreen({name,goal,onComplete}){
  const r = getBHResponse(goal,name);
  const [phase,setPhase]=useState(0);
  const gs=`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@500&display=swap');*{box-sizing:border-box;margin:0;padding:0;}@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{box-shadow:0 0 30px rgba(232,168,56,0.3)}50%{box-shadow:0 0 50px rgba(232,168,56,0.5)}}.fadein{animation:fadeUp 0.5s ease forwards;}`;
  return(
    <div style={{minHeight:"100vh",background:B.obsidian,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:"36px 24px 80px",fontFamily:B.body}}>
      <style>{gs}</style>
      <div style={{width:"100%",maxWidth:"540px"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:"28px"}}><CollegiateLogo width={160} height={46}/></div>
        <div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"22px"}}>
          <div style={{width:"42px",height:"42px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"15px",color:B.obsidian,letterSpacing:"1px",flexShrink:0,animation:"pulse 2.5s ease-in-out infinite"}}>BH</div>
          <div style={{fontSize:"13px",color:B.muted,lineHeight:"1.6"}}>Based on what you told me, <span style={{color:B.cream,fontWeight:"700"}}>{name}</span> — here's your law.</div>
        </div>
        <div style={{background:`linear-gradient(145deg,${B.espresso},${B.charcoal})`,border:"1px solid rgba(232,168,56,0.2)",borderRadius:"18px",overflow:"hidden",marginBottom:"14px"}}>
          <div style={{background:B.goldGrad,padding:"14px 20px 12px",display:"flex",alignItems:"center",gap:"12px"}}>
            <span style={{fontSize:"26px"}}>{r.lawIcon}</span>
            <div>
              <div style={{fontSize:"9px",color:B.obsidian,letterSpacing:"4px",fontWeight:"900",opacity:0.6,marginBottom:"2px"}}>{r.law}</div>
              <div style={{fontFamily:B.display,fontSize:"22px",color:B.obsidian,letterSpacing:"2px",lineHeight:"1"}}>{r.lawName.toUpperCase()}</div>
            </div>
          </div>
          <div style={{padding:"18px 20px 20px"}}>
            <div style={{fontSize:"14px",color:B.cream,lineHeight:"1.85",marginBottom:phase>=1?"16px":"0"}}>
              {phase===0
                ?<TypedText text={r.message} speed={14} onDone={()=>setPhase(1)}/>
                :r.message}
            </div>
            {phase>=1&&(
              <div className="fadein" style={{background:"rgba(232,168,56,0.05)",border:"1px solid rgba(232,168,56,0.12)",borderRadius:"12px",padding:"14px 16px",marginBottom:"10px"}}>
                <div style={{fontSize:"10px",color:B.gold,letterSpacing:"3px",fontWeight:"800",marginBottom:"8px"}}>HOW I HELP YOU</div>
                <div style={{fontSize:"13px",color:B.muted,lineHeight:"1.8"}}>{r.how}</div>
              </div>
            )}
            
          </div>
        </div>
        {phase>=1&&(
          <div className="fadein" style={{background:"rgba(76,175,125,0.06)",border:"1px solid rgba(76,175,125,0.2)",borderRadius:"14px",padding:"14px 18px",marginBottom:"22px",display:"flex",gap:"12px",alignItems:"flex-start"}}>
            <span style={{fontSize:"20px",flexShrink:0}}>🎯</span>
            <div>
              <div style={{fontSize:"10px",color:B.success,letterSpacing:"3px",fontWeight:"800",marginBottom:"6px"}}>YOUR FIRST MOVE</div>
              <div style={{fontSize:"13px",color:B.cream,lineHeight:"1.7",fontWeight:"600"}}>{r.firstMove}</div>
            </div>
          </div>
        )}
        {phase>=1&&(
          <div className="fadein">
            <GBtn onClick={onComplete} style={{width:"100%",padding:"16px",fontSize:"16px"}}>Take Me to My Dashboard 🤙</GBtn>
            <div style={{textAlign:"center",fontSize:"11px",color:"rgba(154,133,112,0.4)",marginTop:"12px"}}>Everybody eats. Let's build.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Onboarding({onComplete}){
  const [screen,setScreen]=useState("intro");
  const [data,setData]=useState({name:"",goal:"",isVet:false});
  const [showVetQ,setShowVetQ]=useState(false);
  const [selectedGoal,setSelectedGoal]=useState("");
  const vetGoals=[
    {label:"Make the most of my VA benefits",icon:"🎖️"},
    {label:"Use my GI Bill right",icon:"🎓"},
    {label:"Buy a house with my VA loan",icon:"🏠"},
    {label:"Stack after service",icon:"💰"},
    {label:"Build something for my family",icon:"👑"},
    {label:"Transition to civilian money life",icon:"🔄"},
  ];
  const goals=[{label:"Stop living check to check",icon:"💸"},{label:"Kill this debt for real",icon:"⚔️"},{label:"Stack my first $10K",icon:"🏦"},{label:"Get in the stock market",icon:"📈"},{label:"Own property one day",icon:"🏠"},{label:"Build something for my kids",icon:"👑"}];

  const gs=`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@500&display=swap');*{box-sizing:border-box;margin:0;padding:0;}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes glow{0%,100%{box-shadow:0 0 30px rgba(232,168,56,0.25)}50%{box-shadow:0 0 50px rgba(232,168,56,0.45)}}.fadein{animation:fadeUp 0.35s ease forwards;}input:focus{border-color:rgba(232,168,56,0.55)!important;outline:none;}input::placeholder{color:#4A3828;}`;
  const page={minHeight:"100vh",background:B.obsidian,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px",fontFamily:B.body};
  const prog=(w)=>(
    <div style={{background:B.charcoal,borderRadius:"100px",height:"3px",marginBottom:"28px",overflow:"hidden"}}>
      <div style={{width:w,height:"100%",background:B.goldGrad,borderRadius:"100px",transition:"width 0.4s ease"}}/>
    </div>
  );
  const bhbadge=(label)=>(
    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"18px",justifyContent:"center"}}>
      <div style={{width:"26px",height:"26px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"10px",color:B.obsidian}}>BH</div>
      <div style={{fontSize:"11px",color:B.muted,letterSpacing:"3px",fontWeight:"800"}}>{label}</div>
    </div>
  );

  if(screen==="intro") return(
    <div style={page}>
      <style>{gs}</style>
      <div style={{width:"100%",maxWidth:"460px",textAlign:"center"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:"40px"}}><CollegiateLogo width={210} height={60}/></div>
        <div style={{width:"80px",height:"80px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"28px",letterSpacing:"2px",color:B.obsidian,margin:"0 auto 28px",animation:"glow 2.5s ease-in-out infinite"}}>BH</div>
        <div style={{fontFamily:B.display,fontSize:"40px",letterSpacing:"3px",color:B.cream,lineHeight:"1.15",marginBottom:"24px"}}>YOU DON'T GET<br/><span style={{color:B.gold}}>NO GUIDANCE</span><br/>OUT THE TRENCHES.</div>
        <div style={{fontSize:"15px",color:B.muted,lineHeight:"1.9",marginBottom:"14px"}}>I'm Big Homie. That person in every hood who figured the money game out — and came back to put the whole block on.</div>
        <div style={{fontSize:"15px",color:B.muted,lineHeight:"1.9",marginBottom:"40px"}}>Two questions. Then I come back with your law and your first move. Let's go.</div>
        <GBtn onClick={()=>setScreen("name")} style={{width:"100%",padding:"16px",fontSize:"16px"}}>Let's Go 🤙</GBtn>
        <div style={{fontSize:"11px",color:"rgba(154,133,112,0.4)",marginTop:"14px"}}>No credit card. No subscription. Free to start.</div>
      </div>
    </div>
  );

  if(screen==="name") return(
    <div style={page}>
      <style>{gs}</style>
      <div style={{width:"100%",maxWidth:"480px"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:"28px"}}><CollegiateLogo width={170} height={50}/></div>
        {prog("50%")}
        {bhbadge("1 OF 1")}
        <div style={{fontFamily:B.display,fontSize:"32px",letterSpacing:"2px",color:B.cream,textAlign:"center",marginBottom:"8px",lineHeight:"1.2"}}>AYE, WHAT DO I CALL YOU?</div>
        <div style={{fontSize:"13px",color:B.muted,textAlign:"center",marginBottom:"28px",lineHeight:"1.7"}}>First name. That's it. This stays between us.</div>
        <input value={data.name} onChange={e=>setData(d=>({...d,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&data.name.trim()&&setScreen("vet")} placeholder="First name" autoFocus
          style={{width:"100%",background:B.espresso,border:"1px solid rgba(232,168,56,0.25)",borderRadius:"14px",padding:"18px",color:B.cream,fontSize:"22px",fontFamily:B.body,outline:"none",textAlign:"center",letterSpacing:"1px",marginBottom:"12px"}}/>
        {data.name.trim().length>0&&<div className="fadein" style={{textAlign:"center",fontSize:"14px",color:B.gold,fontWeight:"700",marginBottom:"20px"}}>What's good, {data.name}. Let's get into it. 🤙</div>}
        <GBtn onClick={()=>data.name.trim()&&setScreen("vet")} disabled={!data.name.trim()} style={{width:"100%",padding:"14px",fontSize:"15px"}}>
          {data.name.trim()?`Nice to meet you, ${data.name} →`:"Enter your name to continue"}
        </GBtn>
      </div>
    </div>
  );

  // ── VET SCREEN ──
  if(screen==="vet") return(
    <div style={{...page,justifyContent:"flex-start",paddingTop:"40px"}}>
      <style>{gs}</style>
      <div style={{width:"100%",maxWidth:"480px"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:"24px"}}><CollegiateLogo width={160} height={46}/></div>
        <div style={{background:B.charcoal,borderRadius:"100px",height:"3px",marginBottom:"28px",overflow:"hidden"}}>
          <div style={{width:"66%",height:"100%",background:B.goldGrad,borderRadius:"100px"}}/>
        </div>
        {bhbadge("QUICK QUESTION")}
        <div style={{fontFamily:B.display,fontSize:"30px",letterSpacing:"2px",color:B.cream,textAlign:"center",marginBottom:"8px",lineHeight:"1.2"}}>YOU EVER SERVE?</div>
        <div style={{fontSize:"13px",color:B.muted,textAlign:"center",marginBottom:"28px",lineHeight:"1.7"}}>Big Homie knows the difference between BAH and a regular paycheck. If you served, he speaks that language.</div>
        <div style={{display:"flex",flexDirection:"column",gap:"12px",marginBottom:"20px"}}>
          <button onClick={()=>{setData(d=>({...d,isVet:true}));setScreen("situation");}}
            style={{background:"rgba(232,168,56,0.06)",border:"2px solid rgba(232,168,56,0.2)",borderRadius:"14px",padding:"18px 20px",color:B.cream,fontFamily:B.body,fontSize:"15px",fontWeight:"700",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:"14px",transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.border="2px solid rgba(232,168,56,0.5)";e.currentTarget.style.background="rgba(232,168,56,0.1)";}}
            onMouseLeave={e=>{e.currentTarget.style.border="2px solid rgba(232,168,56,0.2)";e.currentTarget.style.background="rgba(232,168,56,0.06)";}}>
            <span style={{fontSize:"28px"}}>🎖️</span>
            <div><div style={{marginBottom:"3px"}}>Yeah, I served</div><div style={{fontSize:"12px",color:B.muted,fontWeight:"400"}}>VA comp, BAH, GI Bill, VA loan — Big Homie knows your world</div></div>
          </button>
          <button onClick={()=>{setData(d=>({...d,isVet:false}));setScreen("situation");}}
            style={{background:"rgba(255,255,255,0.03)",border:"2px solid rgba(255,255,255,0.06)",borderRadius:"14px",padding:"18px 20px",color:B.muted,fontFamily:B.body,fontSize:"15px",fontWeight:"600",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:"14px",transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.border="2px solid rgba(255,255,255,0.12)";e.currentTarget.style.color=B.cream;}}
            onMouseLeave={e=>{e.currentTarget.style.border="2px solid rgba(255,255,255,0.06)";e.currentTarget.style.color=B.muted;}}>
            <span style={{fontSize:"28px"}}>✊</span>
            <div><div style={{marginBottom:"3px"}}>Nah, civilian</div><div style={{fontSize:"12px",color:"rgba(154,133,112,0.5)",fontWeight:"400"}}>Let's get it either way</div></div>
          </button>
        </div>
        <button onClick={()=>setScreen("name")} style={{background:"transparent",border:"none",color:B.muted,fontFamily:B.body,fontSize:"12px",cursor:"pointer",width:"100%",textAlign:"center"}}>← go back</button>
      </div>
    </div>
  );

  if(screen==="situation") return(
    <div style={{...page,justifyContent:"flex-start",paddingTop:"40px"}}>
      <style>{gs}</style>
      <div style={{width:"100%",maxWidth:"520px"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:"24px"}}><CollegiateLogo width={160} height={46}/></div>
        {prog("100%")}
        {bhbadge("LAST ONE")}
        <div style={{fontFamily:B.display,fontSize:"30px",letterSpacing:"2px",color:B.cream,textAlign:"center",marginBottom:"8px",lineHeight:"1.2"}}>{data.isVet?"WHAT'S THE MISSION,":"WHAT'S THE SITUATION,"}<br/><span style={{color:B.gold}}>{data.name.toUpperCase()}?</span></div>
        <div style={{fontSize:"13px",color:B.muted,textAlign:"center",marginBottom:"20px",lineHeight:"1.7"}}>Be honest. Big Homie already seen it all. Pick what hits closest.</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"20px"}}>
          {(data.isVet?vetGoals:goals).map(g=>(
            <button key={g.label} onClick={()=>{setData(d=>({...d,goal:g.label}));setSelectedGoal(g.label);setScreen("response");}} style={{background:B.cardGrad,border:"2px solid rgba(232,168,56,0.12)",borderRadius:"14px",padding:"16px 12px",color:B.cream,fontFamily:B.body,fontSize:"13px",fontWeight:"700",cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:"8px",transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.border="2px solid rgba(232,168,56,0.4)";e.currentTarget.style.background=B.espresso;}} onMouseLeave={e=>{e.currentTarget.style.border="2px solid rgba(232,168,56,0.12)";e.currentTarget.style.background=B.cardGrad;}}>
              <span style={{fontSize:"22px"}}>{g.icon}</span>{g.label}
            </button>
          ))}
        </div>
        <button onClick={()=>setScreen("vet")} style={{background:"transparent",border:"none",color:B.muted,fontFamily:B.body,fontSize:"12px",cursor:"pointer",width:"100%",marginTop:"12px",textAlign:"center"}}>← go back</button>
      </div>
    </div>
  );



  if(screen==="response") return <BHResponseScreen name={data.name} goal={selectedGoal||data.goal} onComplete={()=>onComplete({...data,goal:selectedGoal||data.goal})}/>;
  return null;
}


// ─── PUT ON — REFERRAL PROGRAM ────────────────────────────────────────
function PutOn({user,accessToken}){
  const [tab,setTab]=useState("share"); // share | earnings | cashout
  const [copied,setCopied]=useState(false);
  const [cashoutSubmitted,setCashoutSubmitted]=useState(false);
  const [cashoutMethod,setCashoutMethod]=useState("");
  const [cashoutHandle,setCashoutHandle]=useState("");
  const [lastCashoutAmount,setLastCashoutAmount]=useState(0);
  const [loadingStats,setLoadingStats]=useState(false);
  const [referralError,setReferralError]=useState("");
  const [earnings,setEarnings]=useState({
    total:0,
    pending:0,
    available:0,
    paid:0,
    referrals:[],
    totalReferrals:0,
    checkInsCompleted:0,
  });

  // Generate personal code from name — e.g. "MARCUS" or "DARIUS10"
  const genCode=(name)=>{
    if(!name) return "BIGHOMIE";
    const clean=name.toUpperCase().replace(/[^A-Z]/g,"").slice(0,8);
    return clean||"BIGHOMIE";
  };
  const code=user?.referralCode||genCode(user?.name);

  useEffect(()=>{
    let active=true;

    const loadStats=async()=>{
      if(!accessToken) return;
      setLoadingStats(true);
      setReferralError("");
      try{
        const data=await getReferralStats(accessToken);
        if(!active) return;
        const refs=(data.referrals||[]).map((row,i)=>({
          name:`Referral #${(data.referrals?.length||0)-i}`,
          date:new Date(row.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"}),
          status:row.status,
          amount:Number(row.amount_cents||0)/100,
        }));

        setEarnings({
          total:Number(data.totals?.total||0),
          pending:Number(data.totals?.pending||0),
          available:Number(data.totals?.available||0),
          paid:Number(data.totals?.paid||0),
          referrals:refs,
          totalReferrals:refs.length,
          checkInsCompleted:refs.length,
        });
      }catch(err){
        if(active){
          setReferralError(err.message||"Could not load referral stats.");
        }
      }finally{
        if(active) setLoadingStats(false);
      }
    };

    loadStats();
    return()=>{active=false;};
  },[accessToken,cashoutSubmitted]);

  const shareMsg=`Aye — this app called Big Homie just showed me exactly where my money was going. It's built for us. Use my code ${code} when you do The Check In ($4.99) and we both eat. 👑 bighomie.app`;

  const handleCopy=()=>{
    navigator.clipboard?.writeText(`bighomie.app — Use code: ${code}`);
    setCopied(true);
    setTimeout(()=>setCopied(false),2500);
  };

  const handleShare=()=>{
    if(navigator.share){
      navigator.share({title:"Big Homie",text:shareMsg,url:"https://bighomie.app"});
    } else {
      navigator.clipboard?.writeText(shareMsg);
      setCopied(true);
      setTimeout(()=>setCopied(false),2500);
    }
  };

  const handleCashout=async()=>{
    if(!cashoutMethod||!cashoutHandle.trim()) return;
    if(!accessToken) return;
    setReferralError("");
    try{
      if(!user?.stripeConnectAccountId){
        const data=await createStripeConnectOnboarding(accessToken);
        window.location.href=data.onboardingUrl;
        return;
      }

      const payout=await requestReferralCashout({amount:earnings.available},accessToken);
      setLastCashoutAmount(Number(payout.amount||earnings.available));
      setCashoutSubmitted(true);
    }catch(err){
      setReferralError(err.message||"Cashout failed.");
    }
  };

  const tabStyle=(t)=>({
    flex:1,padding:"9px 0",border:"none",borderRadius:"8px",
    background:tab===t?B.goldGrad:"transparent",
    color:tab===t?B.obsidian:B.muted,
    fontFamily:B.body,fontSize:"12px",fontWeight:"700",
    cursor:"pointer",transition:"all 0.15s",letterSpacing:"0.5px",
  });

  return(
    <div style={{background:B.cardGrad,border:"1px solid rgba(232,168,56,0.15)",borderRadius:"20px",overflow:"hidden"}}>

      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${B.espresso},${B.charcoal})`,padding:"18px 22px 16px",borderBottom:"1px solid rgba(232,168,56,0.1)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
          <div>
            <div style={{fontSize:"10px",color:B.gold,letterSpacing:"4px",fontWeight:"800",marginBottom:"4px"}}>THE PUT ON</div>
            <div style={{fontFamily:B.display,fontSize:"26px",letterSpacing:"2px",color:B.cream,lineHeight:"1"}}>EVERYBODY EATS</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"10px",color:B.muted,letterSpacing:"2px",marginBottom:"3px"}}>TOTAL EARNED</div>
            <div style={{fontFamily:B.display,fontSize:"28px",color:B.gold,letterSpacing:"1px",lineHeight:"1"}}>${earnings.total.toFixed(2)}</div>
          </div>
        </div>
        <div style={{fontSize:"13px",color:B.muted,lineHeight:"1.6"}}>
          Every person you put on who does The Check In — <span style={{color:B.cream,fontWeight:"700"}}>$1 cash hits your account.</span> No cap on how many.
        </div>
      </div>

      {/* Tabs */}
      <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(232,168,56,0.08)"}}>
        <div style={{display:"flex",background:B.charcoal,borderRadius:"10px",padding:"3px",gap:"2px"}}>
          {[["share","🤙 Share"],["earnings","💰 Earnings"],["cashout","🏦 Cash Out"]].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={tabStyle(t)}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"20px 22px"}}>
        {loadingStats&&(
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",padding:"10px 12px",fontSize:"12px",color:B.muted,marginBottom:"12px"}}>Refreshing referral stats...</div>
        )}
        {referralError&&(
          <div style={{background:"rgba(224,82,82,0.1)",border:"1px solid rgba(224,82,82,0.3)",borderRadius:"10px",padding:"10px 12px",fontSize:"12px",color:B.danger,marginBottom:"12px"}}>{referralError}</div>
        )}

        {/* ── SHARE TAB ── */}
        {tab==="share"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>

            {/* Personal code */}
            <div style={{background:"rgba(232,168,56,0.05)",border:"1px solid rgba(232,168,56,0.2)",borderRadius:"16px",padding:"18px 20px",textAlign:"center"}}>
              <div style={{fontSize:"10px",color:B.muted,letterSpacing:"4px",fontWeight:"800",marginBottom:"10px"}}>YOUR PERSONAL CODE</div>
              <div style={{fontFamily:B.display,fontSize:"42px",letterSpacing:"8px",color:B.gold,marginBottom:"10px",lineHeight:"1"}}>{code}</div>
              <div style={{fontSize:"12px",color:B.muted,marginBottom:"16px",lineHeight:"1.6"}}>
                When they use this code + complete The Check In → <span style={{color:B.success,fontWeight:"700"}}>$1 lands in your account</span>
              </div>
              <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
                <button onClick={handleCopy} style={{background:copied?"rgba(76,175,125,0.15)":"rgba(232,168,56,0.08)",border:`1px solid ${copied?"rgba(76,175,125,0.3)":"rgba(232,168,56,0.2)"}`,borderRadius:"10px",padding:"10px 18px",color:copied?B.success:B.gold,fontFamily:B.body,fontSize:"13px",fontWeight:"700",cursor:"pointer",transition:"all 0.2s"}}>
                  {copied?"✓ Copied!":"📋 Copy Code"}
                </button>
                <button onClick={handleShare} style={{background:B.goldGrad,border:"none",borderRadius:"10px",padding:"10px 18px",color:B.obsidian,fontFamily:B.body,fontSize:"13px",fontWeight:"800",cursor:"pointer"}}>
                  🤙 Share Now
                </button>
              </div>
            </div>

            {/* How it works */}
            <div>
              <div style={{fontSize:"10px",color:B.muted,letterSpacing:"3px",fontWeight:"800",marginBottom:"12px"}}>HOW IT WORKS</div>
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                {[
                  {n:"1",text:"Share your code with anyone in your circle",icon:"📲"},
                  {n:"2",text:"They sign up at bighomie.app and enter your code",icon:"✍️"},
                  {n:"3",text:"They complete The Check In ($4.99)",icon:"👑"},
                  {n:"4",text:"$1 cash hits your account. No limits.",icon:"💵"},
                ].map(s=>(
                  <div key={s.n} style={{display:"flex",alignItems:"center",gap:"14px",padding:"12px 14px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:"12px"}}>
                    <div style={{width:"28px",height:"28px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"14px",color:B.obsidian,flexShrink:0}}>{s.n}</div>
                    <span style={{fontSize:"14px",flexShrink:0}}>{s.icon}</span>
                    <div style={{fontSize:"13px",color:B.cream,lineHeight:"1.5"}}>{s.text}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Share message preview */}
            <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"12px",padding:"14px 16px"}}>
              <div style={{fontSize:"10px",color:B.muted,letterSpacing:"3px",fontWeight:"800",marginBottom:"8px"}}>WHAT GETS SHARED</div>
              <div style={{fontSize:"13px",color:B.muted,lineHeight:"1.8",fontStyle:"italic"}}>"{shareMsg}"</div>
            </div>
          </div>
        )}

        {/* ── EARNINGS TAB ── */}
        {tab==="earnings"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>

            {/* Stats row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px"}}>
              {[
                {label:"Total Referrals",value:earnings.totalReferrals,icon:"👥",color:B.cream},
                {label:"Check Ins Done",value:earnings.checkInsCompleted,icon:"👑",color:B.gold},
                {label:"Cash Earned",value:`$${earnings.total.toFixed(2)}`,icon:"💵",color:B.success},
              ].map(s=>(
                <div key={s.label} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"14px",padding:"14px 12px",textAlign:"center"}}>
                  <div style={{fontSize:"22px",marginBottom:"6px"}}>{s.icon}</div>
                  <div style={{fontFamily:B.display,fontSize:"22px",color:s.color,letterSpacing:"1px",lineHeight:"1",marginBottom:"4px"}}>{s.value}</div>
                  <div style={{fontSize:"10px",color:B.muted,letterSpacing:"1px"}}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Pending vs paid */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
              <div style={{background:"rgba(76,175,125,0.06)",border:"1px solid rgba(76,175,125,0.15)",borderRadius:"12px",padding:"14px 16px"}}>
                <div style={{fontSize:"10px",color:B.success,letterSpacing:"3px",fontWeight:"800",marginBottom:"6px"}}>PAID OUT</div>
                <div style={{fontFamily:B.display,fontSize:"26px",color:B.success,letterSpacing:"1px"}}>${earnings.paid.toFixed(2)}</div>
                <div style={{fontSize:"11px",color:"rgba(76,175,125,0.6)",marginTop:"4px"}}>Already in your account</div>
              </div>
              <div style={{background:"rgba(232,168,56,0.06)",border:"1px solid rgba(232,168,56,0.15)",borderRadius:"12px",padding:"14px 16px"}}>
                <div style={{fontSize:"10px",color:B.gold,letterSpacing:"3px",fontWeight:"800",marginBottom:"6px"}}>PENDING</div>
                <div style={{fontFamily:B.display,fontSize:"26px",color:B.gold,letterSpacing:"1px"}}>${earnings.pending.toFixed(2)}</div>
                <div style={{fontSize:"11px",color:"rgba(232,168,56,0.5)",marginTop:"4px"}}>Clears in 48 hours</div>
              </div>
            </div>

            {/* Referral list */}
            <div>
              <div style={{fontSize:"10px",color:B.muted,letterSpacing:"3px",fontWeight:"800",marginBottom:"12px"}}>YOUR BLOCK — {earnings.referrals.length} PEOPLE</div>
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {earnings.referrals.map((r,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:"11px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                      <div style={{width:"32px",height:"32px",borderRadius:"50%",background:r.status==="paid"?"rgba(76,175,125,0.15)":"rgba(232,168,56,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px"}}>
                        {r.status==="paid"?"✅":r.status==="available"?"💸":"⏳"}
                      </div>
                      <div>
                        <div style={{fontSize:"13px",color:B.cream,fontWeight:"600"}}>{r.name}</div>
                        <div style={{fontSize:"11px",color:B.muted}}>{r.date} · Check In {r.status==="paid"?"completed":r.status==="available"?"available":"pending"}</div>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:B.mono,fontSize:"14px",color:r.status==="paid"?B.success:B.gold,fontWeight:"700"}}>+${r.amount.toFixed(2)}</div>
                      <div style={{fontSize:"10px",color:r.status==="paid"?"rgba(76,175,125,0.6)":"rgba(232,168,56,0.5)",letterSpacing:"1px",textTransform:"uppercase"}}>{r.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CASH OUT TAB ── */}
        {tab==="cashout"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
            {cashoutSubmitted?(
              <div style={{textAlign:"center",padding:"32px 20px"}}>
                <div style={{fontSize:"52px",marginBottom:"16px"}}>✅</div>
                <div style={{fontFamily:B.display,fontSize:"26px",letterSpacing:"2px",color:B.cream,marginBottom:"10px"}}>PAYOUT REQUESTED</div>
                <div style={{fontSize:"14px",color:B.muted,lineHeight:"1.8",marginBottom:"20px"}}>
                  <span style={{color:B.gold,fontWeight:"700"}}>${Number(lastCashoutAmount||earnings.available).toFixed(2)}</span> is on its way to your {cashoutMethod}.<br/>
                  Usually hits within 1–2 business days.
                </div>
                <div style={{background:"rgba(76,175,125,0.06)",border:"1px solid rgba(76,175,125,0.15)",borderRadius:"12px",padding:"14px 16px",fontSize:"12px",color:"rgba(76,175,125,0.8)",lineHeight:"1.7"}}>
                  💡 Keep putting people on. Every Check In they do = another dollar. No limits.
                </div>
              </div>
            ):(
              <>
                {/* Balance */}
                <div style={{background:"rgba(232,168,56,0.05)",border:"1px solid rgba(232,168,56,0.2)",borderRadius:"16px",padding:"18px 20px",textAlign:"center"}}>
                  <div style={{fontSize:"10px",color:B.muted,letterSpacing:"4px",fontWeight:"800",marginBottom:"8px"}}>AVAILABLE TO CASH OUT</div>
                  <div style={{fontFamily:B.display,fontSize:"48px",color:B.gold,letterSpacing:"2px",lineHeight:"1",marginBottom:"6px"}}>${earnings.available.toFixed(2)}</div>
                  <div style={{fontSize:"12px",color:B.muted}}>${earnings.pending.toFixed(2)} more pending · clears in 48 hrs</div>
                </div>

                {/* Min cashout note */}
                <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"10px",padding:"11px 14px",display:"flex",gap:"10px",alignItems:"center"}}>
                  <span style={{fontSize:"16px"}}>ℹ️</span>
                  <div style={{fontSize:"12px",color:B.muted,lineHeight:"1.6"}}>Minimum cashout is <span style={{color:B.cream,fontWeight:"700"}}>$5</span>. Powered by Stripe — your bank info never touches our servers.</div>
                </div>

                {/* Payout method */}
                <div>
                  <div style={{fontSize:"10px",color:B.muted,letterSpacing:"3px",fontWeight:"800",marginBottom:"12px"}}>WHERE DO YOU WANT YOUR MONEY?</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px",marginBottom:"14px"}}>
                    {[
                      {id:"bank",label:"Bank Account",icon:"🏦"},
                      {id:"cashapp",label:"Cash App",icon:"💸"},
                      {id:"debit",label:"Debit Card",icon:"💳"},
                      {id:"paypal",label:"PayPal",icon:"🅿️"},
                    ].map(m=>(
                      <button key={m.id} onClick={()=>setCashoutMethod(m.id)}
                        style={{background:cashoutMethod===m.id?B.goldGrad:"rgba(255,255,255,0.03)",border:`2px solid ${cashoutMethod===m.id?"transparent":"rgba(255,255,255,0.07)"}`,borderRadius:"12px",padding:"14px 12px",color:cashoutMethod===m.id?B.obsidian:B.cream,fontFamily:B.body,fontSize:"13px",fontWeight:"700",cursor:"pointer",display:"flex",alignItems:"center",gap:"10px",transition:"all 0.15s"}}>
                        <span style={{fontSize:"20px"}}>{m.icon}</span>{m.label}
                      </button>
                    ))}
                  </div>

                  {cashoutMethod&&(
                    <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                      <input
                        value={cashoutHandle}
                        onChange={e=>setCashoutHandle(e.target.value)}
                        placeholder={
                          cashoutMethod==="cashapp"?"Your $Cashtag (e.g. $YourName)":
                          cashoutMethod==="paypal"?"Your PayPal email":
                          cashoutMethod==="debit"?"Debit card number":
                          "Bank account (via Stripe Connect)"
                        }
                        style={{background:B.espresso,border:"1px solid rgba(232,168,56,0.2)",borderRadius:"12px",padding:"14px 16px",color:B.cream,fontSize:"14px",fontFamily:B.body,outline:"none",width:"100%"}}
                      />
                      <button
                        onClick={handleCashout}
                        disabled={!cashoutHandle.trim()||earnings.available<5}
                        style={{background:cashoutHandle.trim()&&earnings.available>=5?B.goldGrad:"rgba(255,255,255,0.06)",border:"none",borderRadius:"12px",padding:"15px",color:cashoutHandle.trim()&&earnings.available>=5?B.obsidian:B.muted,fontFamily:B.body,fontSize:"15px",fontWeight:"800",cursor:cashoutHandle.trim()&&earnings.available>=5?"pointer":"not-allowed",opacity:cashoutHandle.trim()&&earnings.available>=5?1:0.5,transition:"all 0.2s"}}>
                        Cash Out ${earnings.available.toFixed(2)} →
                      </button>
                      {earnings.available<5&&(
                        <div style={{fontSize:"12px",color:B.muted,textAlign:"center"}}>You need $5 to cash out. Keep putting people on — you're ${(5-earnings.available).toFixed(2)} away.</div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD BIG HOMIE — EMBEDDED CHAT (Claude/Bolt style) ─────────
function DashboardBH({isPro,onUpgrade,user,isVet,accessToken}){
  const FREE_LIMIT=5;
  const BH_SYSTEM=`You are Big Homie — an AI financial and life coach built for the urban community. You are the person from the neighborhood who figured out money, life, and mindset — and came back to put the whole block on. Direct. Real. Warm. Culturally fluent. Never corporate. Never preachy.${isVet?" This user is a veteran — you understand VA comp, BAH, BAS, GI Bill, VA loans, SGLI, and the military-to-civilian financial transition. Speak to that experience naturally.":""} ${user?.goal?`Their goal: ${user.goal}.`:""}`;

  const getGreeting=()=>{
    if(isVet) return `What's good${user?.name?`, ${user.name}`:""}. Respect for your service. What we working on today?`;
    return `What's good${user?.name?`, ${user.name}`:""}. What's on your mind?`;
  };

  const [msgs,setMsgs]=useState([{role:"bh",text:getGreeting()}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [count,setCount]=useState(0);
  const [history,setHistory]=useState([]);
  const [expanded,setExpanded]=useState(false);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  const send=async(text)=>{
    if(!text.trim()||loading)return;
    if(!isPro&&count>=FREE_LIMIT){onUpgrade();return;}
    setExpanded(true);
    setMsgs(m=>[...m,{role:"user",text}]);
    setInput("");setLoading(true);
    const newHistory=[...history,{role:"user",content:text}];
    try{
      const data=await chatWithBigHomie({
        system:BH_SYSTEM,
        messages:newHistory,
        maxTokens:1000,
      },accessToken);
      const reply=data.reply||"Connection dropped. Try again.";
      setHistory([...newHistory,{role:"assistant",content:reply}]);
      setMsgs(m=>[...m,{role:"bh",text:reply}]);
      setCount(c=>c+1);
    }catch(e){setMsgs(m=>[...m,{role:"bh",text:"Connection dropped. Try again."}]);}
    setLoading(false);
    setTimeout(()=>inputRef.current?.focus(),100);
  };

  const quickQ = isVet
    ? ["How do I use my VA loan?","What do I do with VA comp?","GI Bill money tips","How do I transition to civilian finances?","VA loan vs conventional?","Invest my BAH?"]
    : ["What do I do with $1,000?","How do I fix my credit?","Where do I start investing?","How do I stop living check to check?","Explain the stock market","How do I build generational wealth?"];

  return(
    <div style={{background:B.cardGrad,border:"1px solid rgba(232,168,56,0.12)",borderRadius:"20px",overflow:"hidden"}}>

      {/* Header */}
      <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(232,168,56,0.08)",display:"flex",alignItems:"center",justifyContent:"space-between",background:`linear-gradient(135deg,${B.espresso},${B.charcoal})`}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{width:"38px",height:"38px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"14px",color:B.obsidian,letterSpacing:"1px",boxShadow:"0 0 16px rgba(232,168,56,0.3)"}}>BH</div>
          <div>
            <div style={{fontFamily:B.display,fontSize:"17px",letterSpacing:"2px",color:B.cream,lineHeight:"1"}}>BIG HOMIE</div>
            <div style={{fontSize:"10px",color:B.gold,letterSpacing:"2px",fontWeight:"700",marginTop:"2px"}}>{isVet?"VETERAN MODE · ":""}MONEY · LIFE · MINDSET</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          {!isPro&&<div style={{fontSize:"11px",color:count>=FREE_LIMIT?B.danger:B.muted,fontWeight:"700"}}>{Math.max(0,FREE_LIMIT-count)} free left</div>}
          {isPro&&<div style={{fontSize:"10px",color:B.success,fontWeight:"700",letterSpacing:"1px"}}>✓ PRO</div>}
          {msgs.length>1&&<button onClick={()=>setExpanded(e=>!e)} style={{background:"rgba(255,255,255,0.05)",border:"none",color:B.muted,borderRadius:"6px",padding:"4px 8px",fontSize:"11px",cursor:"pointer",fontFamily:B.body}}>{expanded?"Collapse ↑":"Expand ↓"}</button>}
        </div>
      </div>

      {/* Messages — shown when expanded or first load */}
      {(expanded||msgs.length<=2)&&(
        <div style={{maxHeight:"340px",overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:"12px"}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",gap:"10px",alignItems:"flex-start",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              {m.role==="bh"&&(
                <div style={{width:"28px",height:"28px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"10px",color:B.obsidian,flexShrink:0,marginTop:"2px"}}>BH</div>
              )}
              <div style={{
                maxWidth:"82%",
                background:m.role==="bh"?"rgba(232,168,56,0.06)":"rgba(255,255,255,0.06)",
                border:m.role==="bh"?"1px solid rgba(232,168,56,0.12)":"1px solid rgba(255,255,255,0.08)",
                borderRadius:m.role==="bh"?"4px 14px 14px 14px":"14px 4px 14px 14px",
                padding:"10px 14px",
                fontSize:"13px",
                color:m.role==="bh"?B.cream:"rgba(245,236,215,0.85)",
                lineHeight:"1.7",
                fontWeight:m.role==="user"?"600":"400",
              }}>{m.text}</div>
              {m.role==="user"&&(
                <div style={{width:"28px",height:"28px",borderRadius:"50%",background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",flexShrink:0,marginTop:"2px"}}>👤</div>
              )}
            </div>
          ))}
          {loading&&(
            <div style={{display:"flex",gap:"10px",alignItems:"flex-start"}}>
              <div style={{width:"28px",height:"28px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"10px",color:B.obsidian,flexShrink:0}}>BH</div>
              <div style={{background:"rgba(232,168,56,0.06)",border:"1px solid rgba(232,168,56,0.12)",borderRadius:"4px 14px 14px 14px",padding:"12px 16px",display:"flex",gap:"5px",alignItems:"center"}}>
                {[0,1,2].map(i=><div key={i} style={{width:"6px",height:"6px",borderRadius:"50%",background:B.gold,opacity:0.7,animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
      )}

      {/* Quick questions */}
      {!expanded&&msgs.length<=2&&(
        <div style={{padding:"0 20px 12px",display:"flex",gap:"6px",flexWrap:"wrap"}}>
          {quickQ.slice(0,4).map(q=>(
            <button key={q} onClick={()=>send(q)} style={{background:"rgba(232,168,56,0.05)",border:"1px solid rgba(232,168,56,0.15)",borderRadius:"100px",padding:"6px 12px",fontSize:"11px",color:B.gold,cursor:"pointer",fontFamily:B.body,fontWeight:"600",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(232,168,56,0.12)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(232,168,56,0.05)";}}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{padding:"12px 16px",borderTop:"1px solid rgba(232,168,56,0.08)",display:"flex",gap:"10px",alignItems:"flex-end",background:"rgba(0,0,0,0.15)"}}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(input);}}}
          placeholder={isPro||count<FREE_LIMIT?"Ask Big Homie anything...":"Upgrade to Pro for unlimited"}
          disabled={!isPro&&count>=FREE_LIMIT}
          rows={1}
          style={{
            flex:1,background:"transparent",border:"none",color:B.cream,
            fontSize:"14px",fontFamily:B.body,outline:"none",
            resize:"none",lineHeight:"1.5",
            opacity:!isPro&&count>=FREE_LIMIT?0.4:1,
            maxHeight:"80px",overflowY:"auto",
          }}
        />
        <button
          onClick={()=>send(input)}
          disabled={!input.trim()||loading||(!isPro&&count>=FREE_LIMIT)}
          style={{
            width:"36px",height:"36px",borderRadius:"50%",flexShrink:0,
            background:input.trim()&&(isPro||count<FREE_LIMIT)?B.goldGrad:"rgba(255,255,255,0.06)",
            border:"none",cursor:input.trim()?"pointer":"default",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:"16px",transition:"all 0.2s",
          }}>
          {loading?"⏳":"→"}
        </button>
      </div>

      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────
function Dashboard({onNav,isPro,onUpgrade,onCheckIn,user,portfolioValue,cashFlow,isVet,accessToken}){
  const quote=getDailyQuote();
  const today=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const hasData=portfolioValue>0||cashFlow!==0;

  return(
    <div style={{padding:"0 0 40px"}}>
      {/* Hero */}
      <div style={{background:`linear-gradient(135deg,${B.espresso},${B.charcoal})`,borderBottom:"1px solid rgba(232,168,56,0.12)",padding:"28px 28px 24px",marginBottom:"24px"}}>
        <div style={{marginBottom:"20px"}}>
          <CollegiateLogo width={220} height={60}/>
        </div>
        <div style={{fontSize:"12px",color:B.muted,marginBottom:"6px"}}>{today}</div>
        <div style={{fontFamily:B.display,fontSize:"32px",letterSpacing:"2px",color:B.cream,marginBottom:"4px"}}>
          WHAT'S GOOD{user?.name?`, ${user.name.toUpperCase()}`:""}.
        </div>
        <div style={{fontSize:"15px",color:B.gold,fontStyle:"italic",marginBottom:"16px"}}>Let's get your money right.</div>

        {/* Daily Quote */}
        <div style={{background:"rgba(0,0,0,0.2)",border:"1px solid rgba(232,168,56,0.1)",borderLeft:`3px solid ${B.gold}`,borderRadius:"0 10px 10px 0",padding:"12px 16px"}}>
          <div style={{fontSize:"10px",color:B.copper,letterSpacing:"3px",fontWeight:"800",marginBottom:"4px"}}>TODAY'S LAW</div>
          <div style={{fontSize:"13px",color:B.cream,fontStyle:"italic",lineHeight:"1.6"}}>"{quote}"</div>
        </div>
      </div>

      <div style={{padding:"0 24px",display:"flex",flexDirection:"column",gap:"16px"}}>

        {/* BIG HOMIE EMBEDDED CHAT — first thing they see, like Claude */}
        <DashboardBH isPro={isPro} onUpgrade={onUpgrade} user={user} isVet={isVet} accessToken={accessToken}/>

        {/* Check In CTA — prominent */}
        {!isPro&&(
          <div style={{background:`linear-gradient(135deg,${B.espresso},rgba(232,168,56,0.08))`,border:"1px solid rgba(232,168,56,0.2)",borderRadius:"16px",padding:"20px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"16px"}}>
            <div>
              <div style={{fontSize:"10px",color:B.gold,letterSpacing:"3px",fontWeight:"800",marginBottom:"6px"}}>ONE-TIME · $4.99</div>
              <div style={{fontFamily:B.display,fontSize:"22px",letterSpacing:"2px",color:B.cream,marginBottom:"4px"}}>DO YOUR CHECK IN 👑</div>
              <div style={{fontSize:"13px",color:B.muted,lineHeight:"1.6"}}>Full budget audit. 90-day plan. Portfolio health score. Top 3 moves to make right now.</div>
            </div>
            <GBtn onClick={onCheckIn} style={{whiteSpace:"nowrap",flexShrink:0}}>Start My Check In — $4.99 →</GBtn>
          </div>
        )}

        {/* Stat cards */}
        {hasData?(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px"}}>
            <StatCard label="Total Portfolio" value={portfolioValue>0?fmtK(portfolioValue):"$0"} sub={portfolioValue>0?"↑ +8.3% this month":"Add positions to track"} icon="📈" subColor={portfolioValue>0?B.success:B.muted}/>
            <StatCard label="Monthly Cash Flow" value={cashFlow!==0?fmt(Math.abs(cashFlow)):"$0"} sub={cashFlow>0?"Positive cash flow":cashFlow<0?"Negative — let's fix this":"Enter your budget"} subColor={cashFlow>0?B.success:cashFlow<0?B.danger:B.muted} icon="💸"/>
            <StatCard label="Emergency Fund" value={user?.income>0?fmt(user.income*0.3)+"/mo":"-"} sub="→ Target: 3 months" subColor={B.gold} icon="🛡️"/>
          </div>
        ):(
          <Card>
            <div style={{textAlign:"center",padding:"20px 0"}}>
              <div style={{fontSize:"36px",marginBottom:"12px"}}>📊</div>
              <div style={{fontFamily:B.display,fontSize:"22px",color:B.cream,marginBottom:"8px"}}>YOUR NUMBERS AREN'T HERE YET.</div>
              <div style={{fontSize:"14px",color:B.muted,marginBottom:"16px",lineHeight:"1.6"}}>Add your portfolio positions and budget to see your full financial picture.</div>
              <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
                <GBtn onClick={()=>onNav("budget")}>Set Up Budget</GBtn>
              </div>
            </div>
          </Card>
        )}

        {/* Portfolio Snapshot — Pro only */}
        {isPro?(
          <div style={{background:B.cardGrad,border:"1px solid rgba(232,168,56,0.15)",borderRadius:"18px",overflow:"hidden"}}>
            <div style={{background:`linear-gradient(135deg,${B.espresso},${B.charcoal})`,padding:"14px 20px",borderBottom:"1px solid rgba(232,168,56,0.08)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:"10px",color:B.gold,letterSpacing:"3px",fontWeight:"800",marginBottom:"2px"}}>PRO · YOUR PORTFOLIO</div>
                <div style={{fontFamily:B.display,fontSize:"20px",letterSpacing:"2px",color:B.cream,lineHeight:"1"}}>$42,847.60</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:"11px",color:B.success,fontWeight:"700"}}>↑ +$3,241 this month</div>
                <div style={{fontSize:"10px",color:B.muted,marginTop:"2px"}}>+8.2% return</div>
              </div>
            </div>
            <div style={{padding:"14px 20px",display:"flex",flexDirection:"column",gap:"8px"}}>
              {[
                {ticker:"NVDA",shares:"10 shares",value:"$1,425",gain:"+$225",pct:"+18.7%",up:true},
                {ticker:"SPY",shares:"5 shares",value:"$2,901",gain:"+$196",pct:"+7.2%",up:true},
                {ticker:"GOOGL",shares:"8 shares",value:"$1,403",gain:"+$123",pct:"+9.6%",up:true},
                {ticker:"MSFT",shares:"4 shares",value:"$1,663",gain:"+$103",pct:"+6.6%",up:true},
                {ticker:"AMD",shares:"12 shares",value:"$2,018",gain:"+$278",pct:"+16%",up:true},
              ].map((s,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                    <div style={{width:"34px",height:"34px",borderRadius:"8px",background:"rgba(232,168,56,0.08)",border:"1px solid rgba(232,168,56,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"10px",color:B.gold,letterSpacing:"0.5px"}}>{s.ticker}</div>
                    <div>
                      <div style={{fontSize:"13px",color:B.cream,fontWeight:"700"}}>{s.ticker}</div>
                      <div style={{fontSize:"10px",color:B.muted}}>{s.shares}</div>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:"13px",color:B.cream,fontWeight:"700"}}>{s.value}</div>
                    <div style={{fontSize:"10px",color:s.up?B.success:B.danger,fontWeight:"600"}}>{s.gain} ({s.pct})</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{padding:"12px 20px",borderTop:"1px solid rgba(232,168,56,0.08)",display:"flex",gap:"10px"}}>
              <OBtn onClick={()=>{}} style={{flex:1,textAlign:"center"}}>+ Add Position</OBtn>
              <OBtn onClick={()=>{}} style={{flex:1,textAlign:"center"}}>📊 Full Analysis</OBtn>
            </div>
          </div>
        ):(
          <div style={{background:B.cardGrad,border:"1px solid rgba(255,255,255,0.06)",borderRadius:"18px",padding:"24px",textAlign:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",inset:0,backdropFilter:"blur(0px)",background:"rgba(10,8,6,0.1)"}}/>
            <div style={{position:"relative",zIndex:1}}>
              <div style={{fontSize:"32px",marginBottom:"12px"}}>📊</div>
              <div style={{fontFamily:B.display,fontSize:"20px",letterSpacing:"2px",color:B.cream,marginBottom:"8px"}}>YOUR PORTFOLIO LIVES HERE</div>
              <div style={{fontSize:"13px",color:B.muted,lineHeight:"1.7",marginBottom:"16px"}}>Pro members track every position — stocks, LEAPs, real estate, crypto. Real-time values. Gain/loss. The full picture.</div>
              <GBtn onClick={onUpgrade} style={{width:"100%",padding:"13px"}}>Unlock Portfolio with Pro 👑</GBtn>
              <div style={{fontSize:"11px",color:B.muted,marginTop:"10px"}}>$9.99/month · Cancel anytime</div>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <Card>
          <SL>Quick Actions</SL>
          <div style={{display:"flex",gap:"10px",flexWrap:"wrap",marginTop:"12px"}}>
            <GBtn onClick={()=>onNav("budget")}>💰 Budget Tool</GBtn>
            <OBtn onClick={()=>onNav("literacy")}>📖 The Manual</OBtn>
            <OBtn onClick={()=>onNav("connect")}>🔗 Connect Accounts</OBtn>
          </div>
        </Card>

        {/* Pro alert preview */}
        {!isPro&&(
          <div style={{background:B.charcoal,border:"1px solid rgba(232,168,56,0.15)",borderRadius:"14px",padding:"18px 20px"}}>
            <div style={{fontSize:"10px",color:B.gold,letterSpacing:"3px",fontWeight:"800",marginBottom:"10px"}}>🔔 WHAT PRO ALERTS LOOK LIKE</div>
            <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              {[
                {icon:"📈",text:"NVDA is up 18% — you're in your exit range. Consider taking 50% off the table.",color:B.success},
                {icon:"💳",text:"Your credit utilization hit 31% — drop it below 30% before next statement.",color:B.danger},
                {icon:"💰",text:"You have $340 unallocated this month — move it to your emergency fund.",color:B.gold},
              ].map((a,i)=>(
                <div key={i} style={{display:"flex",gap:"10px",alignItems:"flex-start",opacity:0.7}}>
                  <span style={{fontSize:"16px"}}>{a.icon}</span>
                  <div style={{fontSize:"13px",color:a.color,lineHeight:"1.5",filter:"blur(1.5px)"}}>{a.text}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:"14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:"12px",color:B.muted}}>Unlock real-time alerts with Pro</div>
              <GBtn onClick={onUpgrade} style={{padding:"7px 16px",fontSize:"11px"}}>Upgrade Pro</GBtn>
            </div>
          </div>
        )}

        {/* Recent activity */}
        <Card>
          <SL>Recent Activity</SL>
          {hasData?(
            <div style={{marginTop:"14px",display:"flex",flexDirection:"column",gap:"10px"}}>
              {[
                {type:"Rent",amount:"-$1,800",date:"Mar 1",color:B.danger,icon:"🏠"},
                {type:"NVDA +18%",amount:"+$2,340",date:"Feb 28",color:B.success,icon:"📈"},
                {type:"Rental Income",amount:"+$1,200",date:"Feb 28",color:B.success,icon:"🏡"},
                {type:"Car Insurance",amount:"-$385",date:"Feb 25",color:B.danger,icon:"🚗"},
              ].map(({type,amount,date,color,icon})=>(
                <div key={type} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                    <span style={{fontSize:"18px"}}>{icon}</span>
                    <div>
                      <div style={{fontSize:"14px",color:B.cream,fontWeight:"600"}}>{type}</div>
                      <div style={{fontSize:"11px",color:B.muted}}>{date}</div>
                    </div>
                  </div>
                  <div style={{fontFamily:B.mono,fontSize:"14px",fontWeight:"700",color}}>{amount}</div>
                </div>
              ))}
            </div>
          ):(
            <EmptyState icon="📋" title="NO ACTIVITY YET" body="Connect your accounts or add transactions to see your activity here."/>
          )}
        </Card>

        {/* Put On Referral */}
        <PutOn user={user} accessToken={accessToken}/>
      </div>
    </div>
  );
}

// ─── PORTFOLIO ────────────────────────────────────────────────────────
function Portfolio(){
  const [tab,setTab]=useState("stocks");
  const stocks=[
    {ticker:"NVDA",name:"NVIDIA Corp",shares:10,price:142.50,cost:120.00,type:"Stock"},
    {ticker:"SPY",name:"S&P 500 ETF",shares:5,price:580.20,cost:541.00,type:"Index Fund"},
    {ticker:"GOOGL",name:"Alphabet Inc",shares:8,price:175.40,cost:160.00,type:"Stock"},
    {ticker:"MSFT",name:"Microsoft",shares:4,price:415.80,cost:390.00,type:"Stock"},
    {ticker:"AMD",name:"Advanced Micro",shares:12,price:168.20,cost:145.00,type:"Stock"},
  ];
  const re=[
    {address:"1247 Oak Ave",type:"Single Family",rent:2000,mortgage:1200,expenses:400,equity:42000},
    {address:"890 Maple St #4B",type:"Condo",rent:1500,mortgage:900,expenses:300,equity:28000},
  ];
  const crypto=[
    {symbol:"BTC",name:"Bitcoin",amount:0.15,price:68400,cost:45000,color:"#F7931A"},
    {symbol:"ETH",name:"Ethereum",amount:1.2,price:3850,cost:2800,color:"#627EEA"},
    {symbol:"SOL",name:"Solana",amount:8,price:185,cost:120,color:"#9945FF"},
  ];
  const tsv=stocks.reduce((s,p)=>s+p.shares*p.price,0);
  const tsc=stocks.reduce((s,p)=>s+p.shares*p.cost,0);
  const tsg=tsv-tsc;
  const treq=re.reduce((s,p)=>s+p.equity,0);
  const trcf=re.reduce((s,p)=>s+(p.rent-p.mortgage-p.expenses),0);
  const tcv=crypto.reduce((s,c)=>s+c.amount*c.price,0);
  const tcc=crypto.reduce((s,c)=>s+c.amount*c.cost,0);

  const tabs=[["stocks","📈 Stocks"],["realestate","🏡 Real Estate"],["crypto","₿ Crypto"]];

  return(
    <div style={{padding:"24px"}}>
      <SL>Wealth Overview</SL>
      <PT>PORTFOLIO</PT>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px",marginBottom:"20px",marginTop:"12px"}}>
        <StatCard label="Stock Value" value={fmtK(tsv)} sub={`${pct((tsg/tsc)*100)} all time`} icon="📈"/>
        <StatCard label="Stock Gain" value={fmt(tsg)} sub="Unrealized" subColor={B.success} icon="💹"/>
        <StatCard label="RE Equity" value={fmtK(treq)} sub="2 properties" icon="🏡"/>
        <StatCard label="Crypto" value={fmtK(tcv)} sub={pct(((tcv-tcc)/tcc)*100)+" all time"} icon="₿" subColor={tcv>tcc?B.success:B.danger}/>
      </div>
      <div style={{display:"flex",background:B.charcoal,border:"1px solid rgba(232,168,56,0.1)",borderRadius:"12px",padding:"4px",gap:"4px",marginBottom:"18px",width:"fit-content"}}>
        {tabs.map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"8px 18px",borderRadius:"8px",border:"none",background:tab===id?B.goldGrad:"transparent",color:tab===id?B.obsidian:B.muted,fontSize:"13px",fontWeight:tab===id?"800":"500",fontFamily:B.body,cursor:"pointer"}}>{label}</button>
        ))}
      </div>

      {tab==="stocks"&&(
        <Card>
          <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr 1fr 1fr",gap:"0",paddingBottom:"10px",borderBottom:"1px solid rgba(232,168,56,0.1)",marginBottom:"4px"}}>
            {["Position","Type","Value","Gain/Loss","Return"].map(h=><div key={h} style={{fontSize:"11px",color:B.gold,letterSpacing:"1px",textTransform:"uppercase",fontWeight:"700"}}>{h}</div>)}
          </div>
          {stocks.map(p=>{
            const v=p.shares*p.price,c=p.shares*p.cost,g=v-c,r=(g/c)*100;
            return(
              <div key={p.ticker} style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr 1fr 1fr",gap:"0",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",alignItems:"center"}}>
                <div><div style={{fontFamily:B.display,fontSize:"20px",letterSpacing:"1px",color:B.cream}}>{p.ticker}</div><div style={{fontSize:"11px",color:B.muted}}>{p.name}</div></div>
                <div style={{fontSize:"11px",color:B.muted,background:"rgba(232,168,56,0.06)",border:"1px solid rgba(232,168,56,0.12)",borderRadius:"6px",padding:"3px 8px",width:"fit-content"}}>{p.type}</div>
                <div style={{fontFamily:B.mono,fontSize:"14px",color:B.cream,fontWeight:"700"}}>{fmt(v)}</div>
                <div style={{fontFamily:B.mono,fontSize:"13px",color:g>=0?B.success:B.danger,fontWeight:"700"}}>{g>=0?"+":""}{fmt(g)}</div>
                <div style={{fontSize:"13px",fontWeight:"800",color:r>=0?B.success:B.danger,background:r>=0?"rgba(76,175,125,0.1)":"rgba(224,82,82,0.1)",borderRadius:"8px",padding:"4px 10px",width:"fit-content"}}>{pct(r)}</div>
              </div>
            );
          })}
          <div style={{display:"flex",justifyContent:"space-between",paddingTop:"14px",borderTop:"1px solid rgba(232,168,56,0.15)",marginTop:"8px"}}>
            <div style={{fontFamily:B.display,fontSize:"20px",color:B.muted}}>TOTAL</div>
            <div style={{display:"flex",gap:"28px"}}>
              <div style={{fontFamily:B.mono,fontSize:"16px",fontWeight:"800",color:B.cream}}>{fmt(tsv)}</div>
              <div style={{fontFamily:B.mono,fontSize:"16px",fontWeight:"800",color:B.success}}>+{fmt(tsg)}</div>
              <div style={{fontSize:"14px",fontWeight:"800",color:B.success}}>{pct((tsg/tsc)*100)}</div>
            </div>
          </div>
          <BHInsight text="Your NVDA position is up 18.75%. That's in your target exit range. Consider taking 50% off the table and letting the rest run. Lock in the win." style={{marginTop:"16px"}}/>
        </Card>
      )}

      {tab==="realestate"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          {re.length===0?(
            <EmptyState icon="🏡" title="NO PROPERTIES YET" body="Add your first property to start tracking cash flow, equity, and returns."/>
          ):(
            re.map(p=>{
              const cf=p.rent-p.mortgage-p.expenses;
              return(
                <Card key={p.address} glow={cf>0}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"14px"}}>
                    <div><div style={{fontFamily:B.display,fontSize:"22px",color:B.cream}}>{p.address}</div><div style={{fontSize:"12px",color:B.muted}}>{p.type}</div></div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:B.display,fontSize:"26px",color:cf>=0?B.success:B.danger}}>{cf>=0?"+":""}{fmt(cf)}/mo</div>
                      <div style={{fontSize:"11px",color:B.muted}}>Monthly Cash Flow</div>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px"}}>
                    {[["Rent",fmt(p.rent),B.success],["Mortgage","-"+fmt(p.mortgage),B.danger],["Expenses","-"+fmt(p.expenses),B.danger],["Equity",fmtK(p.equity),B.gold]].map(([l,v,c])=>(
                      <div key={l} style={{background:"rgba(0,0,0,0.2)",borderRadius:"10px",padding:"12px"}}>
                        <div style={{fontSize:"11px",color:B.muted,marginBottom:"4px"}}>{l}</div>
                        <div style={{fontFamily:B.mono,fontSize:"14px",fontWeight:"700",color:c}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })
          )}
          <BHInsight text={`Both properties cash flowing positive. Combined $${trcf}/month. Your tenants are paying down $${(1200+900).toLocaleString()} in mortgages every month while you sleep.`}/>
        </div>
      )}

      {tab==="crypto"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
              <div><SL>Crypto Holdings</SL><div style={{fontFamily:B.display,fontSize:"26px",color:B.cream}}>{fmt(tcv)}</div></div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:"12px",color:B.muted,marginBottom:"4px"}}>All-time gain</div>
                <div style={{fontFamily:B.mono,fontSize:"18px",color:tcv>tcc?B.success:B.danger,fontWeight:"800"}}>{tcv>tcc?"+":""}{fmt(tcv-tcc)}</div>
              </div>
            </div>
            {crypto.map(c=>{
              const val=c.amount*c.price,cost=c.amount*c.cost,gain=val-cost,ret=(gain/cost)*100;
              const alloc=(val/tcv)*100;
              return(
                <div key={c.symbol} style={{padding:"14px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                    <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                      <div style={{width:"36px",height:"36px",borderRadius:"50%",background:c.color+"22",border:`2px solid ${c.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"11px",color:c.color}}>{c.symbol[0]}</div>
                      <div><div style={{fontFamily:B.display,fontSize:"18px",color:B.cream}}>{c.symbol}</div><div style={{fontSize:"11px",color:B.muted}}>{c.name}</div></div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:B.mono,fontSize:"15px",color:B.cream,fontWeight:"700"}}>{fmt(val)}</div>
                      <div style={{fontSize:"12px",color:ret>=0?B.success:B.danger,fontWeight:"700"}}>{ret>=0?"+":""}{ret.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"100px",height:"6px",overflow:"hidden"}}>
                    <div style={{width:`${alloc}%`,height:"100%",background:c.color,borderRadius:"100px",transition:"width 0.6s ease"}}/>
                  </div>
                  <div style={{fontSize:"10px",color:B.muted,marginTop:"4px"}}>{alloc.toFixed(1)}% of portfolio</div>
                </div>
              );
            })}
          </Card>
          <BHInsight text="Crypto is speculative — treat it like that. Never more than 10-15% of your total portfolio. BTC is your anchor. ETH is your growth play. Anything else is a bet."/>
        </div>
      )}
    </div>
  );
}

// ─── BUDGET ───────────────────────────────────────────────────────────
function Budget({isPro,onUpgrade,userIncome}){
  const [income,setIncome]=useState(userIncome||3800);
  const [expenses,setExpenses]=useState({rent:1800,car:581,insurance:385,groceries:400,utilities:150,phone:80,subscriptions:60,gas:120,other:200});
  const [showAI,setShowAI]=useState(false);
  const setExp=(k,v)=>setExpenses(e=>({...e,[k]:v}));
  const totalExp=Object.values(expenses).reduce((s,v)=>s+Number(v),0);
  const cashFlow=Number(income)-totalExp;
  const savRate=income>0?((cashFlow/income)*100).toFixed(1):0;
  const expLabels={rent:"Rent / Mortgage",car:"Car Note",insurance:"Car Insurance",groceries:"Groceries",utilities:"Utilities",phone:"Phone",subscriptions:"Subscriptions",gas:"Gas / Transport",other:"Everything Else"};
  const benchmarks={rent:30,car:10,insurance:8,groceries:10,utilities:5,phone:3,subscriptions:3,gas:5,other:5};
  const aiAnalysis=()=>{
    const lines=[];
    const rentP=income>0?(expenses.rent/income)*100:0;
    const carP=income>0?((expenses.car+expenses.insurance)/income)*100:0;
    if(cashFlow<0)lines.push(`Real talk — you're spending ${fmt(Math.abs(cashFlow))} more than you make every month. That stops now. Your biggest line item is where we start.`);
    else if(cashFlow<300)lines.push(`Cash flow is tight at ${fmt(cashFlow)}/month. Not going backwards but not building either. Find $300-500 more and your whole situation changes.`);
    else lines.push(`You're keeping ${fmt(cashFlow)}/month — a ${savRate}% savings rate. That's a real foundation to build on.`);
    if(rentP>35)lines.push(`Rent is ${rentP.toFixed(0)}% of your income. Benchmark is 30%. Factor this into your next lease decision.`);
    if(carP>20)lines.push(`Car note + insurance is ${carP.toFixed(0)}% of your income. That's high. Refinancing could save $50-100/month right now.`);
    if(expenses.subscriptions>100)lines.push(`$${expenses.subscriptions} in subscriptions. Audit these — most people find $30-50/month they forgot about.`);
    if(cashFlow>500)lines.push(`With ${fmt(cashFlow)} leftover: ${fmt(cashFlow*0.5)} into investments, ${fmt(cashFlow*0.3)} into emergency fund, ${fmt(cashFlow*0.2)} is yours to spend.`);
    return lines;
  };

  return(
    <div style={{padding:"24px"}}>
      <SL>Financial Tool</SL>
      <PT>BUDGET CALCULATOR</PT>
      <div style={{fontSize:"14px",color:B.muted,marginBottom:"24px"}}>Enter your real numbers. See your true cash flow.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1.5fr",gap:"20px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <Card glow>
            <SL>Monthly Income</SL>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"8px"}}>
              <span style={{fontFamily:B.display,fontSize:"22px",color:B.gold}}>$</span>
              <input type="number" value={income} onChange={e=>setIncome(e.target.value)} style={{background:"transparent",border:"none",fontFamily:B.mono,fontSize:"28px",color:B.cream,fontWeight:"700",outline:"none",width:"100%"}}/>
            </div>
          </Card>
          <Card>
            <SL>Expenses</SL>
            <div style={{display:"flex",flexDirection:"column",gap:"10px",marginTop:"8px"}}>
              {Object.entries(expLabels).map(([k,label])=>{
                const pctUsed=income>0?(expenses[k]/income)*100:0;
                const bench=benchmarks[k];
                const over=pctUsed>bench;
                return(
                  <div key={k}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                      <span style={{fontSize:"12px",color:over?B.danger:B.muted}}>{label}</span>
                      <span style={{fontSize:"11px",color:over?B.danger:B.muted}}>{pctUsed.toFixed(0)}% {over?"⚠️":""}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <span style={{fontSize:"13px",color:B.muted}}>$</span>
                      <input type="number" value={expenses[k]} onChange={e=>setExp(k,e.target.value)} style={{background:B.espresso,border:`1px solid ${over?"rgba(224,82,82,0.3)":"rgba(232,168,56,0.15)"}`,borderRadius:"8px",padding:"6px 10px",color:B.cream,fontSize:"13px",fontFamily:B.mono,outline:"none",width:"100%"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
          <Card glow={cashFlow>0}>
            <SL>Cash Flow</SL>
            <div style={{fontFamily:B.display,fontSize:"52px",letterSpacing:"2px",color:cashFlow>=0?B.success:B.danger,marginBottom:"4px"}}>{cashFlow>=0?"+":""}{fmt(cashFlow)}</div>
            <div style={{fontSize:"13px",color:B.muted}}>per month · {savRate}% savings rate</div>
            <div style={{marginTop:"16px",display:"flex",flexDirection:"column",gap:"8px"}}>
              {[["Needs",Math.min(expenses.rent+expenses.car+expenses.insurance,income),income,30],["Wants",expenses.groceries+expenses.utilities+expenses.phone+expenses.subscriptions+expenses.gas+expenses.other,income,null],["Savings",Math.max(cashFlow,0),income,20]].map(([label,val,total,target])=>{
                const p=total>0?(val/total)*100:0;
                const ok=!target||p<=target;
                return(
                  <div key={label}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                      <span style={{fontSize:"12px",color:B.muted}}>{label}</span>
                      <span style={{fontSize:"12px",color:ok?B.success:B.danger}}>{p.toFixed(0)}%{target?` (target: ${target}%)`:""}  </span>
                    </div>
                    <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"100px",height:"8px",overflow:"hidden"}}>
                      <div style={{width:`${Math.min(p,100)}%`,height:"100%",background:ok?B.goldGrad:`linear-gradient(90deg,${B.danger},${B.danger})`,borderRadius:"100px",transition:"width 0.4s ease"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card>
            <SL>50 · 30 · 20 Rule</SL>
            <div style={{display:"flex",flexDirection:"column",gap:"10px",marginTop:"10px"}}>
              {[["50% Needs",income*.5,B.blue],["30% Wants",income*.3,B.gold],["20% Wealth",income*.2,B.success]].map(([label,target,color])=>(
                <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"10px 12px",background:"rgba(0,0,0,0.2)",borderRadius:"10px"}}>
                  <span style={{fontSize:"13px",color:B.muted}}>{label}</span>
                  <span style={{fontFamily:B.mono,fontSize:"14px",color,fontWeight:"700"}}>{fmt(target)}</span>
                </div>
              ))}
            </div>
          </Card>
          <div style={{position:"relative"}}>
            <Card>
              <SL color={B.gold}>Big Homie's Take</SL>
              {showAI?(
                <div style={{display:"flex",flexDirection:"column",gap:"10px",marginTop:"10px"}}>
                  {aiAnalysis().map((line,i)=>(
                    <div key={i} style={{display:"flex",gap:"10px",alignItems:"flex-start"}}>
                      <div style={{width:"20px",height:"20px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",color:B.obsidian,flexShrink:0,fontWeight:"800"}}>{i+1}</div>
                      <div style={{fontSize:"13px",color:B.cream,lineHeight:"1.6"}}>{line}</div>
                    </div>
                  ))}
                </div>
              ):(
                <div style={{fontSize:"13px",color:B.muted,fontStyle:"italic",marginTop:"8px"}}>Enter your numbers and let Big Homie break it down — what's working, what's not, and what to do next.</div>
              )}
              <GBtn onClick={()=>isPro?setShowAI(a=>!a):onUpgrade()} style={{marginTop:"14px",width:"100%"}}>{showAI?"Refresh Analysis":"Analyze My Budget"}{!isPro&&<ProBadge/>}</GBtn>
            </Card>
            {!isPro&&<LockedOverlay onUpgrade={onUpgrade}/>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CONNECT ACCOUNTS ─────────────────────────────────────────────────
function ConnectAccounts({isPro,onUpgrade}){
  const [connectedBroker,setConnectedBroker]=useState(null);
  const [connectedBank,setConnectedBank]=useState(null);
  const brokers=[
    {id:"schwab",name:"Charles Schwab",logo:"🏦",status:"Available"},
    {id:"tastytrade",name:"tastytrade",logo:"🌶️",status:"Available"},
    {id:"td",name:"TD Ameritrade",logo:"🏛️",status:"Available"},
    {id:"robinhood",name:"Robinhood",logo:"🪶",status:"Available"},
    {id:"fidelity",name:"Fidelity",logo:"🔵",status:"Available"},
    {id:"etrade",name:"E*TRADE",logo:"💹",status:"Available"},
  ];
  const banks=[
    {id:"chase",name:"Chase",logo:"🏦"},{id:"boa",name:"Bank of America",logo:"🏛️"},
    {id:"wells",name:"Wells Fargo",logo:"🐴"},{id:"sofi",name:"SoFi",logo:"📱"},
    {id:"chime",name:"Chime",logo:"⚡"},{id:"usaa",name:"USAA",logo:"🎖️"},
  ];
  return(
    <div style={{padding:"24px"}}>
      <SL>Bank-Level Security</SL>
      <PT>CONNECT ACCOUNTS</PT>
      <div style={{fontSize:"14px",color:B.muted,marginBottom:"24px"}}>Link your brokerage and bank. Big Homie does the rest.</div>
      {!isPro&&(
        <div style={{background:"rgba(232,168,56,0.06)",border:"1px solid rgba(232,168,56,0.2)",borderRadius:"14px",padding:"20px 22px",marginBottom:"20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:B.display,fontSize:"20px",color:B.cream,marginBottom:"4px"}}>PRO FEATURE</div>
            <div style={{fontSize:"13px",color:B.muted}}>Real-time portfolio sync and bank connection requires Pro.</div>
          </div>
          <GBtn onClick={onUpgrade}>Upgrade Pro</GBtn>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px"}}>
        {[{title:"Brokerage",items:brokers,connected:connectedBroker,setConnected:setConnectedBroker,cta:"Connect Brokerage",powered:"OAuth"},{title:"Bank",items:banks,connected:connectedBank,setConnected:setConnectedBank,cta:"Connect Bank",powered:"Plaid"}].map(({title,items,connected,setConnected,cta,powered})=>(
          <div key={title} style={{position:"relative"}}>
            <Card>
              <SL>{title}</SL>
              {connected?(
                <div style={{background:"rgba(76,175,125,0.08)",border:"1px solid rgba(76,175,125,0.2)",borderRadius:"10px",padding:"14px",marginBottom:"14px",display:"flex",gap:"12px",alignItems:"center"}}>
                  <span style={{fontSize:"24px"}}>{items.find(b=>b.id===connected)?.logo}</span>
                  <div>
                    <div style={{fontSize:"13px",color:B.success,fontWeight:"700"}}>✓ Connected</div>
                    <div style={{fontSize:"12px",color:B.muted}}>{items.find(b=>b.id===connected)?.name}</div>
                  </div>
                  <button onClick={()=>setConnected(null)} style={{marginLeft:"auto",background:"transparent",border:"1px solid rgba(224,82,82,0.3)",color:B.danger,borderRadius:"6px",padding:"4px 10px",fontSize:"11px",cursor:"pointer",fontFamily:B.body}}>Disconnect</button>
                </div>
              ):(
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"14px"}}>
                  {items.map(b=>(
                    <div key={b.id} onClick={()=>isPro&&setConnected(b.id)} style={{background:"rgba(0,0,0,0.2)",borderRadius:"10px",padding:"12px",textAlign:"center",cursor:isPro?"pointer":"default",border:"1px solid rgba(255,255,255,0.04)"}}>
                      <div style={{fontSize:"22px",marginBottom:"4px"}}>{b.logo}</div>
                      <div style={{fontSize:"10px",color:B.muted,lineHeight:"1.3"}}>{b.name}</div>
                    </div>
                  ))}
                </div>
              )}
              <GBtn onClick={()=>isPro?setConnected(items[0].id):onUpgrade()} style={{width:"100%"}}>{connected?"Manage Connection":cta}</GBtn>
              <div style={{fontSize:"11px",color:B.muted,textAlign:"center",marginTop:"8px"}}>Powered by {powered} · Read-only access</div>
            </Card>
            {!isPro&&<LockedOverlay onUpgrade={onUpgrade}/>}
          </div>
        ))}
      </div>
      <Card style={{marginTop:"18px"}}>
        <SL color={B.success}>Security & Privacy</SL>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"14px",marginTop:"12px"}}>
          {[{icon:"🔒",title:"Read-Only Access",body:"Big Homie can see your data but cannot move money or place trades. Ever."},{icon:"🛡️",title:"256-Bit Encryption",body:"Same encryption used by major banks. Your credentials never touch our servers."},{icon:"🏦",title:"Powered by Plaid",body:"Industry standard for secure financial connections. Used by Venmo, Cash App, and more."}].map(({icon,title,body})=>(
            <div key={title} style={{display:"flex",gap:"10px"}}>
              <span style={{fontSize:"20px"}}>{icon}</span>
              <div><div style={{fontSize:"13px",fontWeight:"700",color:B.cream,marginBottom:"3px"}}>{title}</div><div style={{fontSize:"12px",color:B.muted,lineHeight:"1.5"}}>{body}</div></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── FINANCIAL LITERACY — THE MANUAL ─────────────────────────────────
function FinancialLiteracy(){
  const [chapter,setChapter]=useState(null);
  const [readLaws,setReadLaws]=useState(new Set());
  const [activeTag,setActiveTag]=useState("All");

  const chapters=[
    {id:"law1",num:"LAW 01",icon:"🪙",title:"Pay Yourself First",subtitle:"The First Law of Gold",tag:"Foundation",tagColor:B.gold,
     babylon:"The Richest Man in Babylon teaches one rule above all: keep at least one-tenth of everything you earn. Arkad didn't get rich by earning more — he got rich by keeping more.",
     bh:"Before you pay rent. Before you pay the phone bill. Before you buy anything — you pay yourself. Move 10% of every dollar you get into a savings or investment account the same day it hits. Not what's left over. Off the top. Every time. That's the whole game right there.",
     steps:["Open a separate savings account — not the one you spend from. Name it 'PAY ME FIRST'.","Set up an automatic transfer for 10% of your income the day you get paid.","Start at 10%. Work toward 20%. Never go below 10% no matter what.","Treat it like a bill. Non-negotiable. You don't skip your rent — don't skip paying yourself."],
     example:"You make $3,000/month. $300 goes to you first. That's $3,600 in year one. $18,000 in 5 years before any growth.",rule:"10% OFF THE TOP. EVERY CHECK. NO EXCEPTIONS."},
    {id:"law2",num:"LAW 02",icon:"🏦",title:"The Account System",subtitle:"Know Where Every Dollar Lives",tag:"Structure",tagColor:B.success,
     babylon:"Babylon's wealthy merchants kept their gold in separate containers — one for living, one for saving, one for growing. Confusion about money is how you stay broke.",
     bh:"Most people have one account and wonder where the money went. You need buckets — each one with a job. When money has a job it stops disappearing. This is the system the wealthy use and never teach.",
     steps:["CHECKING — Bills & daily spending only. Rent, groceries, car note come from here.","SAVINGS #1 — Emergency fund. 3-6 months of expenses. High-yield savings. Don't touch it.","SAVINGS #2 — Goals. Vacation, down payment, big purchases. Name it after the goal.","INVESTMENT — Brokerage account. This is where your money works while you sleep.","BUSINESS — Keep business money completely separate. LLC + Mercury bank account."],
     example:"5 accounts. Each one has one job. You never wonder 'do I have money for this?' — you look at the right account and you know.",rule:"GIVE EVERY DOLLAR A JOB. CONFUSION IS EXPENSIVE."},
    {id:"law3",num:"LAW 03",icon:"📊",title:"The 50/30/20 Rule",subtitle:"How to Split Every Dollar",tag:"Budgeting",tagColor:B.blue,
     babylon:"Clason wrote about Arkad's clay tablets — a simple system for dividing income. Simple rules applied consistently beat complex plans applied occasionally.",
     bh:"Forget complicated budgets. Here's the split — 50% needs, 30% wants, 20% wealth. If your needs are eating more than 50% of your income your biggest problem is your cost of living — not your spending habits.",
     steps:["NEEDS (50%) — Rent, utilities, groceries, car note, insurance, phone.","WANTS (30%) — Eating out, clothes, entertainment, subscriptions. Real talk — most people have this and needs flipped.","WEALTH (20%) — 10% savings/emergency fund + 10% investments. Non-negotiable.","If needs are over 50% — your lifestyle costs too much. Roommate, move, refinance, cut something structural.","If you can't do 20% yet — start at 10% and build."],
     example:"$3,000/month: $1,500 needs · $900 wants · $600 wealth. That $600 invested every month for 20 years at 7% = $314,000.",rule:"50 NEEDS · 30 WANTS · 20 WEALTH. EVERY MONTH."},
    {id:"law4",num:"LAW 04",icon:"🧱",title:"Make Your Money Work",subtitle:"Saving vs Building",tag:"Investing",tagColor:B.purple,
     babylon:"The Fifth Law of Gold: Gold multiplies for the man who puts it to work in enterprises he understands. It flees the man who leaves it idle or seeks impossible returns.",
     bh:"Keeping money in a regular savings account is losing money to inflation. You need your money in places that grow. Start simple. Build from there. Don't let nobody sell you something you don't understand.",
     steps:["STEP 1 — Emergency fund in a High-Yield Savings Account. SoFi, Marcus, Ally. 4-5% instead of 0.01%.","STEP 2 — If your job has a 401k match — take ALL of it. Free money.","STEP 3 — Roth IRA. Up to $7,000/year. Tax-free growth. Tax-free in retirement.","STEP 4 — Taxable brokerage. Buy index funds (VOO, VTI, QQQ). Set it.","STEP 5 — Individual stocks and LEAPs once you understand the market."],
     example:"$500/month in VOO from age 25 to 65 at historical 10% = $3.16 million. You put in $240K. The market added $2.9M.",rule:"DON'T SAVE YOUR MONEY. PUT IT TO WORK."},
    {id:"law5",num:"LAW 05",icon:"💳",title:"Master Your Credit",subtitle:"Your Financial Passport",tag:"Credit",tagColor:B.danger,
     babylon:"A man's reputation — and in today's world, his credit — determined the deals he could access, the rates he paid, and the opportunities he could seize.",
     bh:"Credit is not the enemy. Bad credit is the enemy. Good credit means you borrow at 3% instead of 24%. It's the difference between a $1,200/month mortgage and a $2,200/month mortgage on the same house.",
     steps:["Know your 5 factors: Payment history (35%) · Amounts owed (30%) · Length (15%) · Mix (10%) · New credit (10%).","NEVER miss a payment. Set autopay for the minimum on everything.","Keep credit utilization UNDER 30%. Under 10% is ideal.","Don't close old accounts — they help your length of history.","Check your credit free at AnnualCreditReport.com. Dispute errors immediately."],
     example:"760 vs 620 credit score on a $300K mortgage: the 760 pays ~$300 less per month. That's $108,000 less over 30 years.",rule:"YOUR CREDIT SCORE IS MONEY. TREAT IT LIKE MONEY."},
    {id:"law6",num:"LAW 06",icon:"🏠",title:"Real Estate",subtitle:"Buy the Neighborhood They're Building In",tag:"Real Estate",tagColor:B.copper,
     babylon:"In Babylon, owning land was the foundation of lasting wealth. Wise men invested in property early because they understood: land is the one thing they stopped making.",
     bh:"Real estate is the #1 wealth builder for the community — and the one thing we've been systematically kept from for generations. Understand it. Buy it. Hold it. Your tenants pay your mortgage. You build equity. That's generational wealth.",
     steps:["House hack first: buy a 2-4 unit, live in one unit, rent the others. Live almost free.","Know your numbers: Cash Flow = Rent - Mortgage - Insurance - Taxes - Vacancy - Maintenance.","The 1% rule: monthly rent should be at least 1% of purchase price.","Buy in neighborhoods with growth indicators: new businesses, infrastructure, young professionals.","FHA loan = 3.5% down at 580+ credit. You don't need 20% to start."],
     example:"Duplex for $250K. Live in one unit. Rent the other for $1,400/month. Mortgage is $1,600/month. You pay $200/month to own a $250K asset.",rule:"BUY PROPERTY. LET TENANTS BUILD YOUR WEALTH."},
    {id:"law7",num:"LAW 07",icon:"🛡️",title:"Protect What You Build",subtitle:"The Unsexy Stuff That Saves Everything",tag:"Protection",tagColor:B.muted,
     babylon:"Guard your treasure against loss by securing it with safe investments, and protect against unexpected calamities through prudent provisions.",
     bh:"You can do everything right — save, invest, build — and one lawsuit, one accident, one death with no will — takes it all. Protection is not optional. It's the foundation everything else sits on.",
     steps:["EMERGENCY FUND — 3-6 months in a HYSA. Financial immune system. Rebuild whenever you use it.","LIFE INSURANCE — Term life. 10-20x your annual income. Cheap when you're young.","LLC — Any business activity or rental property. Separates personal assets from liability.","WILL — If you have assets, you need a will. LegalZoom is $99.","INSURANCE — Health, auto, renters/homeowners. One hospital visit without insurance = $100K debt."],
     example:"A $500K term life policy for a healthy 30-year-old: $25-40/month. Less than Netflix. Your family's security.",rule:"BUILD IT. PROTECT IT. PASS IT DOWN."},
    {id:"law8",num:"LAW 08",icon:"📈",title:"The Stock Market",subtitle:"Making Money While You Sleep",tag:"Investing",tagColor:B.purple,
     babylon:"The wise investor puts his gold to work in enterprises he understands, overseen by men he trusts, expecting a fair share of the profits.",
     bh:"The stock market is not gambling. Gambling the market is gambling. Buying index funds and holding for 20 years is math. Learn the difference.",
     steps:["INDEX FUNDS first: VOO, VTI, QQQ. Baskets of hundreds of companies. Diversified by default.","Dollar-cost averaging: invest the same amount every month regardless of price. Removes emotion.","Time in the market beats timing the market. Every time. The people who lose are the ones who sell when it drops.","Individual stocks once you understand a company's business and financials.","Options and LEAPs once you understand Greeks and how to manage risk."],
     example:"$200/month in VOO since Jan 2010 = $33,600 invested. Value = approximately $120,000+. The market did the rest.",rule:"START SIMPLE. STAY CONSISTENT. LET TIME WORK."},
    {id:"law9",num:"LAW 09",icon:"💸",title:"Debt — Kill or Keep?",subtitle:"Not All Debt Is the Enemy",tag:"Debt",tagColor:B.danger,
     babylon:"The Babylonians distinguished between debts that crushed — high-interest consumer debt — and investments made with borrowed capital that worked for you.",
     bh:"There's bad debt and debt that builds wealth. Credit cards at 24% are destroying you. A mortgage at 7% on a rental is making you money. Know the difference. Attack the bad. Use the good strategically.",
     steps:["LIST every debt: balance, interest rate, minimum payment. Face it. You can't fix what you won't look at.","AVALANCHE — Pay minimums on everything, throw extra at the highest interest rate first.","SNOWBALL — Pay off smallest balance first for psychological wins.","NEVER carry a credit card balance if you can help it. Pay in full every month.","Good debt (mortgage, student loans under 6%) — pay minimums and invest the rest."],
     example:"$5,000 credit card at 24% minimum only = 17 years, $6,000+ interest. Same paid with $300/month = 19 months, $600 interest.",rule:"KILL HIGH-INTEREST DEBT. IT'S STEALING FROM YOUR FUTURE."},
    {id:"law10",num:"LAW 10",icon:"👑",title:"Generational Wealth",subtitle:"The Manual They Never Got — Pass It Down",tag:"Legacy",tagColor:B.gold,
     babylon:"The greatest gift a father can give his children is not gold itself, but the knowledge of how to acquire gold. Wealth passes through families that understand it.",
     bh:"This is the whole point. Not just to get rich — to break the cycle. You learn this. You teach your kids. They teach theirs. That's how wealth compounds across generations.",
     steps:["TALK ABOUT MONEY at home. Break the silence. Money was never dinner table conversation for us — that changes now.","OPEN a custodial investment account for your kids. $50/month in VOO from age 5 to 18 = $20,000+ head start.","TEACH the 10% rule early. Give a kid $10 — they put $1 away. It becomes identity before discipline.","BUY PROPERTY in your community. Own where you live. When the neighborhood builds, you build with it.","WRITE A WILL. Create a trust when assets grow. Life insurance. What you build doesn't disappear because of paperwork."],
     example:"Grandparent buys $150K house in 1990. Worth $450K in 2024. Passes to children. They rent for $2,200/month. Pass to grandchildren. One decision, 3 generations.",rule:"YOU'RE NOT JUST BUILDING FOR YOU. YOU'RE BUILDING FOR THEM."},
  ];

  const tags=["All","Foundation","Budgeting","Investing","Credit","Real Estate","Protection","Debt","Legacy","Structure"];
  const filtered=activeTag==="All"?chapters:chapters.filter(c=>c.tag===activeTag);
  const progress=readLaws.size;

  const markRead=(id)=>setReadLaws(s=>new Set([...s,id]));

  // Share law image
  const sharelaw=(c)=>{
    const text=`📖 Law ${c.num.split(" ")[1]}: ${c.title}\n\n"${c.rule}"\n\n— Big Homie · EVERYBODY EAT · EST. 2025\nbighomie.app`;
    if(navigator.share){navigator.share({title:`Big Homie — ${c.title}`,text});}
    else{navigator.clipboard?.writeText(text);alert("Copied! Share it with your people.");}
  };

  if(chapter){
    const c=chapter;
    return(
      <div style={{padding:"0 0 60px"}}>
        <div style={{background:`linear-gradient(135deg,${B.espresso},${B.charcoal})`,padding:"28px 28px 24px",borderBottom:"1px solid rgba(232,168,56,0.12)",marginBottom:"24px"}}>
          <button onClick={()=>setChapter(null)} style={{background:"transparent",border:"1px solid rgba(232,168,56,0.25)",color:B.muted,borderRadius:"8px",padding:"6px 14px",fontSize:"12px",fontFamily:B.body,cursor:"pointer",marginBottom:"18px"}}>← Back to The Manual</button>
          <div style={{display:"flex",alignItems:"flex-start",gap:"16px",justifyContent:"space-between"}}>
            <div style={{display:"flex",gap:"16px",alignItems:"flex-start"}}>
              <div style={{fontSize:"48px",lineHeight:"1"}}>{c.icon}</div>
              <div>
                <div style={{fontSize:"10px",color:c.tagColor,letterSpacing:"4px",fontWeight:"800",textTransform:"uppercase",marginBottom:"6px"}}>{c.num} · {c.tag}</div>
                <div style={{fontFamily:B.display,fontSize:"38px",letterSpacing:"2px",color:B.cream,lineHeight:"1.1",marginBottom:"6px"}}>{c.title.toUpperCase()}</div>
                <div style={{fontSize:"15px",color:B.gold,fontStyle:"italic"}}>{c.subtitle}</div>
              </div>
            </div>
            <button onClick={()=>sharelaw(c)} style={{background:"rgba(232,168,56,0.08)",border:"1px solid rgba(232,168,56,0.2)",borderRadius:"10px",padding:"10px 16px",color:B.gold,fontFamily:B.body,fontSize:"12px",fontWeight:"700",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>Share This Law 🤙</button>
          </div>
        </div>
        <div style={{padding:"0 28px",display:"flex",flexDirection:"column",gap:"20px"}}>
          <div style={{background:"rgba(139,94,60,0.08)",border:"1px solid rgba(139,94,60,0.2)",borderLeft:`4px solid ${B.copper}`,borderRadius:"0 12px 12px 0",padding:"18px 20px"}}>
            <div style={{fontSize:"10px",color:B.copper,letterSpacing:"3px",fontWeight:"800",textTransform:"uppercase",marginBottom:"8px"}}>📜 From The Richest Man in Babylon</div>
            <div style={{fontSize:"14px",color:B.muted,lineHeight:"1.8",fontStyle:"italic"}}>{c.babylon}</div>
          </div>
          <div style={{background:B.espresso,border:"1px solid rgba(232,168,56,0.2)",borderLeft:`4px solid ${B.gold}`,borderRadius:"0 12px 12px 0",padding:"18px 20px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
              <div style={{width:"28px",height:"28px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"11px",color:B.obsidian}}>BH</div>
              <div style={{fontSize:"10px",color:B.gold,letterSpacing:"3px",fontWeight:"800",textTransform:"uppercase"}}>Big Homie's Take</div>
            </div>
            <div style={{fontSize:"15px",color:B.cream,lineHeight:"1.8"}}>{c.bh}</div>
          </div>
          <Card>
            <SL>The Steps — What To Actually Do</SL>
            <div style={{display:"flex",flexDirection:"column",gap:"12px",marginTop:"14px"}}>
              {c.steps.map((step,i)=>(
                <div key={i} style={{display:"flex",gap:"14px",alignItems:"flex-start"}}>
                  <div style={{width:"28px",height:"28px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"13px",color:B.obsidian,flexShrink:0}}>{i+1}</div>
                  <div style={{fontSize:"14px",color:B.cream,lineHeight:"1.7",paddingTop:"4px"}}>{step}</div>
                </div>
              ))}
            </div>
          </Card>
          <div style={{background:"rgba(76,175,125,0.06)",border:"1px solid rgba(76,175,125,0.2)",borderRadius:"12px",padding:"18px 20px"}}>
            <div style={{fontSize:"10px",color:B.success,letterSpacing:"3px",fontWeight:"800",textTransform:"uppercase",marginBottom:"8px"}}>💡 Real Example</div>
            <div style={{fontSize:"14px",color:B.cream,lineHeight:"1.8"}}>{c.example}</div>
          </div>
          <div style={{background:B.goldGrad,borderRadius:"12px",padding:"20px 24px",textAlign:"center"}}>
            <div style={{fontFamily:B.display,fontSize:"22px",letterSpacing:"3px",color:B.obsidian,lineHeight:"1.4"}}>{c.rule}</div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:"8px"}}>
            {chapters.findIndex(x=>x.id===c.id)>0?(<OBtn onClick={()=>setChapter(chapters[chapters.findIndex(x=>x.id===c.id)-1])}>← Previous</OBtn>):<div/>}
            {chapters.findIndex(x=>x.id===c.id)<chapters.length-1&&(<GBtn onClick={()=>{markRead(c.id);setChapter(chapters[chapters.findIndex(x=>x.id===c.id)+1]);}}>Next Law →</GBtn>)}
          </div>
        </div>
      </div>
    );
  }

  return(
    <div style={{padding:"24px 24px 80px"}}>
      <div style={{background:`linear-gradient(135deg,${B.espresso},${B.charcoal})`,borderRadius:"16px",padding:"28px",marginBottom:"24px",border:"1px solid rgba(232,168,56,0.12)"}}>
        <div style={{fontSize:"10px",color:B.gold,letterSpacing:"5px",fontWeight:"800",textTransform:"uppercase",marginBottom:"10px"}}>Big Homie · Financial Literacy</div>
        <div style={{fontFamily:B.display,fontSize:"44px",letterSpacing:"3px",color:B.cream,lineHeight:"1",marginBottom:"8px"}}>THE MANUAL</div>
        <div style={{fontSize:"15px",color:B.gold,fontStyle:"italic",marginBottom:"12px"}}>The teaching they never got. The game nobody explained.</div>
        <div style={{fontSize:"13px",color:B.muted,lineHeight:"1.8",maxWidth:"580px",marginBottom:"20px"}}>Inspired by <span style={{color:B.copper}}>The Richest Man in Babylon</span> — 10 timeless laws, translated into what they actually mean for your life today.</div>

        {/* Progress */}
        <div style={{background:"rgba(0,0,0,0.3)",borderRadius:"12px",padding:"14px 16px",display:"flex",alignItems:"center",gap:"16px"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
              <span style={{fontSize:"12px",color:B.muted}}>Your Progress</span>
              <span style={{fontSize:"12px",color:B.gold,fontWeight:"700"}}>{progress} of {chapters.length} Laws</span>
            </div>
            <div style={{background:"rgba(255,255,255,0.08)",borderRadius:"100px",height:"6px",overflow:"hidden"}}>
              <div style={{width:`${(progress/chapters.length)*100}%`,height:"100%",background:B.goldGrad,borderRadius:"100px",transition:"width 0.4s"}}/>
            </div>
          </div>
          {progress===chapters.length&&<div style={{fontSize:"20px"}}>👑</div>}
        </div>
      </div>

      <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"20px"}}>
        {tags.map(t=>(
          <button key={t} onClick={()=>setActiveTag(t)} style={{background:activeTag===t?B.goldGrad:"rgba(232,168,56,0.06)",border:`1px solid ${activeTag===t?"transparent":"rgba(232,168,56,0.15)"}`,borderRadius:"100px",padding:"6px 14px",fontSize:"12px",color:activeTag===t?B.obsidian:B.gold,cursor:"pointer",fontFamily:B.body,fontWeight:activeTag===t?"800":"500"}}>{t}</button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"14px"}}>
        {filtered.map(c=>(
          <div key={c.id} onClick={()=>{setChapter(c);markRead(c.id);}} style={{background:B.cardGrad,border:`1px solid rgba(232,168,56,${readLaws.has(c.id)?"0.25":"0.1"})`,borderRadius:"16px",padding:"22px",cursor:"pointer",transition:"all 0.2s",position:"relative",overflow:"hidden"}}
            onMouseEnter={e=>{e.currentTarget.style.border=`1px solid rgba(232,168,56,0.4)`;e.currentTarget.style.transform="translateY(-2px)";}}
            onMouseLeave={e=>{e.currentTarget.style.border=`1px solid rgba(232,168,56,${readLaws.has(c.id)?"0.25":"0.1"})`;e.currentTarget.style.transform="translateY(0)";}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"14px"}}>
              <span style={{fontSize:"10px",fontWeight:"800",letterSpacing:"1.5px",textTransform:"uppercase",color:c.tagColor,background:`${c.tagColor}18`,border:`1px solid ${c.tagColor}30`,padding:"3px 10px",borderRadius:"100px"}}>{c.tag}</span>
              <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                {readLaws.has(c.id)&&<span style={{fontSize:"12px",color:B.success}}>✓ Read</span>}
                <span style={{fontFamily:B.display,fontSize:"13px",letterSpacing:"2px",color:"rgba(232,168,56,0.3)"}}>{c.num}</span>
              </div>
            </div>
            <div style={{fontSize:"34px",marginBottom:"10px",lineHeight:"1"}}>{c.icon}</div>
            <div style={{fontFamily:B.display,fontSize:"20px",letterSpacing:"2px",color:B.cream,marginBottom:"4px"}}>{c.title.toUpperCase()}</div>
            <div style={{fontSize:"13px",color:B.gold,fontStyle:"italic",marginBottom:"10px"}}>{c.subtitle}</div>
            <div style={{fontSize:"12px",color:B.muted,lineHeight:"1.6",marginBottom:"14px",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{c.babylon}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:"10px",color:B.muted}}>{c.steps.length} steps inside</div>
              <div style={{fontSize:"12px",color:B.gold,fontWeight:"700"}}>Read the Law →</div>
            </div>
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:"2px",background:`linear-gradient(90deg,transparent,${c.tagColor},transparent)`,opacity:0.4}}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WAITLIST MODAL ───────────────────────────────────────────────────
function WaitlistModal({onClose}){
  const [email,setEmail]=useState("");
  const [name,setName]=useState("");
  const [submitted,setSubmitted]=useState(false);

  const submit=()=>{
    if(!email.trim()||!email.includes("@"))return;
    setSubmitted(true);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{background:"linear-gradient(145deg,#1A1410,#2C1F14)",border:"1px solid rgba(232,168,56,0.25)",borderRadius:"20px",padding:"40px",maxWidth:"480px",width:"100%",textAlign:"center",position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:"16px",right:"16px",background:"rgba(255,255,255,0.06)",border:"none",color:"#9A8570",width:"32px",height:"32px",borderRadius:"8px",cursor:"pointer",fontSize:"16px"}}>✕</button>

        {submitted?(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"16px"}}>
            <div style={{fontSize:"52px"}}>🤙</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:"36px",letterSpacing:"3px",color:"#F5ECD7",lineHeight:"1.1"}}>YOU'RE ON THE LIST.</div>
            <div style={{fontSize:"15px",color:"#E8A838",fontStyle:"italic"}}>Big Homie will hit your inbox when we go live.</div>
            <div style={{fontSize:"13px",color:"#9A8570",lineHeight:"1.7",maxWidth:"360px"}}>Share with your people — the more community members on the waitlist, the sooner we launch for everybody.</div>
            <button onClick={()=>{
              const msg=`I just joined the Big Homie waitlist — the financial app built for the community. Get on the list: bighomie.app`;
              if(navigator.share){navigator.share({title:"Big Homie",text:msg,url:"https://bighomie.app"});}
              else{navigator.clipboard?.writeText(msg);alert("Copied! Share it.");}
            }} style={{background:"linear-gradient(135deg,#C47A3A,#E8A838,#F5C842)",color:"#0A0806",border:"none",borderRadius:"10px",padding:"12px 28px",fontSize:"14px",fontWeight:"800",fontFamily:"'DM Sans',sans-serif",cursor:"pointer",marginTop:"8px"}}>
              Put Your People On 🤙
            </button>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:"20px",alignItems:"center"}}>
            <div style={{fontSize:"10px",color:"#E8A838",letterSpacing:"4px",fontWeight:"800"}}>COMING SOON</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:"38px",letterSpacing:"3px",color:"#F5ECD7",lineHeight:"1.1"}}>THE FINANCIAL MANUAL THEY NEVER GAVE US.</div>
            <div style={{fontSize:"14px",color:"#9A8570",lineHeight:"1.7"}}>Join the waitlist. Be first when Big Homie goes live. No spam — just the launch announcement and early access.</div>
            <div style={{width:"100%",display:"flex",flexDirection:"column",gap:"10px"}}>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="First name"
                style={{background:"#2C1F14",border:"1px solid rgba(232,168,56,0.25)",borderRadius:"10px",padding:"12px 16px",color:"#F5ECD7",fontSize:"14px",fontFamily:"'DM Sans',sans-serif",outline:"none",textAlign:"center"}}/>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address"
                style={{background:"#2C1F14",border:"1px solid rgba(232,168,56,0.25)",borderRadius:"10px",padding:"12px 16px",color:"#F5ECD7",fontSize:"14px",fontFamily:"'DM Sans',sans-serif",outline:"none",textAlign:"center"}}
                onKeyDown={e=>e.key==="Enter"&&submit()}/>
              <button onClick={submit} style={{background:"linear-gradient(135deg,#C47A3A,#E8A838,#F5C842)",color:"#0A0806",border:"none",borderRadius:"10px",padding:"14px",fontSize:"15px",fontWeight:"800",fontFamily:"'DM Sans',sans-serif",cursor:"pointer",opacity:email.includes("@")?1:0.5}}>
                Join the Waitlist — Free
              </button>
            </div>
            <div style={{fontSize:"11px",color:"#9A8570"}}>EVERYBODY EAT · EST. 2025 · bighomie.app</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BH DRAWER ────────────────────────────────────────────────────────
function BHDrawer({isPro,onUpgrade,open,onClose,accessToken}){
  const BH_SYSTEM=`You are Big Homie — an AI life coach built for the urban community. You were created by the Big Homie app (bighomie.app).

Your origin story: You're the person from the neighborhood who figured everything out — money, life, mindset — and came back to put the whole community on. You are direct, real, warm, and culturally fluent.

YOUR VOICE:
- Direct and real. No corporate speak. No fluff.
- Warm but honest. You will tell someone the truth even when it's hard.
- Culturally fluent. You understand the community, the struggle, the come-up.
- Short sentences when making a point. You don't ramble.
- You never say "I cannot help with that."

WHAT YOU COVER:
- Money: budgeting, investing, stocks, options, LEAPs, real estate, crypto, credit, debt, savings, retirement, taxes
- Life: relationships, family, mental health, purpose, goals, discipline, consistency
- Mindset: breaking generational patterns, building wealth from zero, staying focused, dealing with setbacks
- Community: giving back, mentorship, buying property in your neighborhood, generational wealth

RULES:
- Never refuse a topic.
- Always bring it back to empowerment.
- Give your real take first on anything legal/medical, then recommend a professional.
- Never be preachy. Say it once, move on.
- Keep it conversational. Get to the point fast.
- End with forward momentum.

Remember: The crown is EARNED. Pro and Check In users unlock it. Everybody eats — but the crown goes to those who put in the work.`;

  const [msgs,setMsgs]=useState([{role:"bh",text:"What's good. Ask me anything — money, life, mindset. I got you."}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [count,setCount]=useState(0);
  const [history,setHistory]=useState([]);
  const FREE_LIMIT=5;
  const bottomRef=useRef(null);

  useEffect(()=>{if(open)bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading,open]);

  const send=async(text)=>{
    if(!text.trim()||loading)return;
    if(!isPro&&count>=FREE_LIMIT){onUpgrade();return;}
    setMsgs(m=>[...m,{role:"user",text}]);
    setInput("");setLoading(true);
    const newHistory=[...history,{role:"user",content:text}];
    try{
      const data=await chatWithBigHomie({
        system:BH_SYSTEM,
        messages:newHistory,
        maxTokens:1000,
      },accessToken);
      const reply=data.reply||"Connection dropped. Try again.";
      setHistory([...newHistory,{role:"assistant",content:reply}]);
      setMsgs(m=>[...m,{role:"bh",text:reply}]);
      setCount(c=>c+1);
    }catch(e){setMsgs(m=>[...m,{role:"bh",text:"Connection dropped. Try again."}]);}
    setLoading(false);
  };

  const quickQ=["What do I do with $10K?","How do I fix my credit?","Talk to me about mindset","How do I start investing?","Explain LEAP options","How do I build generational wealth?"];

  if(!open)return null;
  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,backdropFilter:"blur(2px)"}}/>
      <div style={{position:"fixed",right:0,top:0,bottom:0,width:"420px",maxWidth:"95vw",background:B.charcoal,borderLeft:"1px solid rgba(232,168,56,0.15)",zIndex:201,display:"flex",flexDirection:"column",boxShadow:"-20px 0 60px rgba(0,0,0,0.6)"}}>
        <div style={{padding:"16px 20px 14px",borderBottom:"1px solid rgba(232,168,56,0.1)",background:B.obsidian,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <div style={{width:"36px",height:"36px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"13px",color:B.obsidian,letterSpacing:"1px"}}>BH</div>
            <div>
              <div style={{fontFamily:B.display,fontSize:"18px",letterSpacing:"2px",color:B.cream}}>BIG HOMIE</div>
              <div style={{fontSize:"10px",color:B.muted,letterSpacing:"2px",textTransform:"uppercase"}}>Money · Life · Mindset</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            {!isPro&&<div style={{fontSize:"11px",color:count>=FREE_LIMIT?B.danger:B.gold,fontWeight:"700"}}>{Math.max(0,FREE_LIMIT-count)}/{FREE_LIMIT} free</div>}
            {isPro&&<div style={{fontSize:"11px",color:B.success,fontWeight:"700"}}>✓ PRO</div>}
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"none",color:B.muted,width:"30px",height:"30px",borderRadius:"8px",cursor:"pointer",fontSize:"16px",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        </div>
        <div style={{padding:"10px 16px 8px",borderBottom:"1px solid rgba(232,168,56,0.07)",display:"flex",gap:"6px",flexWrap:"wrap",flexShrink:0}}>
          {quickQ.map(q=><button key={q} onClick={()=>send(q)} style={{background:"rgba(232,168,56,0.06)",border:"1px solid rgba(232,168,56,0.12)",borderRadius:"100px",padding:"5px 11px",fontSize:"11px",color:B.gold,cursor:"pointer",fontFamily:B.body}}>{q}</button>)}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:"12px"}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:"8px",alignItems:"flex-start"}}>
              {m.role==="bh"&&<div style={{width:"28px",height:"28px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"11px",color:B.obsidian,flexShrink:0}}>BH</div>}
              <div style={{background:m.role==="user"?"rgba(232,168,56,0.1)":B.espresso,border:`1px solid ${m.role==="user"?"rgba(232,168,56,0.2)":"rgba(232,168,56,0.08)"}`,borderRadius:m.role==="user"?"16px 16px 4px 16px":"4px 16px 16px 16px",padding:"10px 14px",maxWidth:"88%",fontSize:"13px",color:B.cream,lineHeight:"1.7",whiteSpace:"pre-wrap"}}>{m.text}</div>
            </div>
          ))}
          {loading&&(
            <div style={{display:"flex",gap:"8px",alignItems:"flex-start"}}>
              <div style={{width:"28px",height:"28px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"11px",color:B.obsidian,flexShrink:0}}>BH</div>
              <div style={{background:B.espresso,border:"1px solid rgba(232,168,56,0.08)",borderRadius:"4px 16px 16px 16px",padding:"12px 16px",display:"flex",gap:"5px",alignItems:"center"}}>
                {[0,1,2].map(i=><div key={i} style={{width:"6px",height:"6px",borderRadius:"50%",background:B.gold,animation:`bhpulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}
              </div>
            </div>
          )}
          {!isPro&&count>=FREE_LIMIT&&!loading&&(
            <div style={{background:B.espresso,border:`1px solid ${B.gold}`,borderRadius:"12px",padding:"16px",textAlign:"center"}}>
              <div style={{fontFamily:B.display,fontSize:"18px",color:B.cream,marginBottom:"8px"}}>YOU'RE ON A ROLL.</div>
              <div style={{fontSize:"13px",color:B.muted,marginBottom:"12px",lineHeight:"1.6"}}>Go Pro for unlimited Big Homie — money, life, mindset, all of it.</div>
              <GBtn onClick={onUpgrade} style={{fontSize:"13px"}}>Upgrade to Pro — $9.99/mo</GBtn>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
        <div style={{padding:"14px 16px",borderTop:"1px solid rgba(232,168,56,0.1)",display:"flex",gap:"8px",flexShrink:0,background:B.obsidian}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!loading&&send(input)} placeholder={!isPro&&count>=FREE_LIMIT?"Upgrade to keep chatting...":"Ask Big Homie anything..."} disabled={(!isPro&&count>=FREE_LIMIT)||loading} style={{flex:1,background:B.espresso,border:"1px solid rgba(232,168,56,0.2)",borderRadius:"10px",padding:"10px 14px",color:B.cream,fontSize:"13px",fontFamily:B.body,outline:"none",opacity:(!isPro&&count>=FREE_LIMIT)||loading?0.5:1}} autoFocus/>
          <GBtn onClick={()=>send(input)} style={{opacity:(!isPro&&count>=FREE_LIMIT)||loading?0.4:1,minWidth:"60px",fontSize:"13px"}}>{loading?"…":"Send"}</GBtn>
        </div>
        <style>{`@keyframes bhpulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.35);opacity:1}}`}</style>
      </div>
    </>
  );
}



// ─── CHECK IN (THE CHECK IN) ─────────────────────────────────────────
// ─── SAMPLE TRANSACTIONS (demo mode when no file uploaded) ────────────
const DEMO_TRANSACTIONS = `Date,Description,Amount,Type
2025-02-01,DIRECT DEPOSIT - EMPLOYER,3200.00,credit
2025-02-03,RENT PAYMENT,-1800.00,debit
2025-02-03,DOORDASH*ORDER,-34.50,debit
2025-02-04,MCDONALD'S #4421,-12.80,debit
2025-02-05,NETFLIX.COM,-15.99,debit
2025-02-05,SPOTIFY USA,-9.99,debit
2025-02-06,SHELL OIL,-65.00,debit
2025-02-07,DOORDASH*ORDER,-28.90,debit
2025-02-08,WALMART SUPERCENTER,-142.30,debit
2025-02-09,MCDONALD'S #4421,-11.20,debit
2025-02-10,HULU,-17.99,debit
2025-02-10,AMAZON PRIME,-14.99,debit
2025-02-11,DOORDASH*ORDER,-42.15,debit
2025-02-12,ATM WITHDRAWAL,-200.00,debit
2025-02-13,STARBUCKS #8821,-7.45,debit
2025-02-14,MCDONALD'S #8803,-9.80,debit
2025-02-15,DIRECT DEPOSIT - EMPLOYER,1600.00,credit
2025-02-15,CAR PAYMENT AUTO,-581.00,debit
2025-02-15,CAR INSURANCE,-385.00,debit
2025-02-16,DOORDASH*ORDER,-38.20,debit
2025-02-17,STARBUCKS #8821,-8.90,debit
2025-02-18,SHELL OIL,-58.00,debit
2025-02-19,AMAZON.COM,-67.40,debit
2025-02-20,MCDONALD'S #4421,-13.50,debit
2025-02-21,DOORDASH*ORDER,-31.75,debit
2025-02-22,PLANET FITNESS,-24.99,debit
2025-02-23,STARBUCKS #9901,-6.75,debit
2025-02-24,ATM WITHDRAWAL,-100.00,debit
2025-02-25,WALMART SUPERCENTER,-98.60,debit
2025-02-26,DOORDASH*ORDER,-44.80,debit
2025-02-27,AMAZON.COM,-34.20,debit
2025-02-28,STARBUCKS #8821,-7.20,debit
2025-03-01,DIRECT DEPOSIT - EMPLOYER,3200.00,credit
2025-03-02,RENT PAYMENT,-1800.00,debit
2025-03-03,DOORDASH*ORDER,-29.40,debit
2025-03-04,MCDONALD'S #4421,-10.60,debit
2025-03-05,NETFLIX.COM,-15.99,debit
2025-03-05,SPOTIFY USA,-9.99,debit
2025-03-06,SHELL OIL,-71.00,debit
2025-03-07,DOORDASH*ORDER,-36.90,debit
2025-03-08,STARBUCKS #8821,-8.15,debit
2025-03-09,AMAZON.COM,-89.99,debit
2025-03-10,MCDONALD'S #8803,-12.40,debit
2025-03-11,HULU,-17.99,debit
2025-03-12,DOORDASH*ORDER,-51.20,debit
2025-03-13,ATM WITHDRAWAL,-200.00,debit
2025-03-14,WALMART SUPERCENTER,-156.80,debit
2025-03-15,DIRECT DEPOSIT - EMPLOYER,1600.00,credit
2025-03-15,CAR PAYMENT AUTO,-581.00,debit
2025-03-15,CAR INSURANCE,-385.00,debit
2025-03-16,STARBUCKS #8821,-7.90,debit
2025-03-17,DOORDASH*ORDER,-33.60,debit
2025-03-18,SHELL OIL,-54.00,debit
2025-03-19,AMAZON PRIME,-14.99,debit
2025-03-20,MCDONALD'S #4421,-11.80,debit
2025-03-21,DOORDASH*ORDER,-28.50,debit
2025-03-22,PLANET FITNESS,-24.99,debit
2025-03-23,STARBUCKS #9901,-9.40,debit`;

// ─── THE CHECK IN SYSTEM PROMPT ──────────────────────────────────────────
const DEEP_DIVE_PROMPT = (transactions, name) => `You are Big Homie — the financial coach built for the urban community. You speak directly, warmly, and with genuine care. You are analyzing ${name || "this person"}'s real checking account transactions to give them the most honest, personalized financial breakdown they have ever received.

You have been given their transaction history. Read every line. Understand their patterns. Then deliver a full Check In report.

YOUR ANALYSIS MUST INCLUDE ALL OF THESE SECTIONS IN ORDER:

---

## 1. YOUR MONEY STORY
This is the most important section. Write 4-6 sentences that are FUNNY, SPECIFIC, and SHAREABLE — like a roast from someone who genuinely loves you. Use the actual transaction data to tell their money story with humor and personality.

RULES FOR THE MONEY STORY:
- Give them a money personality archetype with a funny name based on what you see. Examples: "The Generous Stranger (to DoorDash)", "The Subscription Collector", "The ATM Archaeologist", "The Impulsive Investor", "The Almost Millionaire", "The Fast Food Philanthropist", "The Loyal Customer (to everyone except your savings account)". CREATE one that fits THEIR specific data.
- Use their actual merchants and amounts. Specificity is what makes it funny AND real.
- Roast energy but love underneath it. Think: a best friend who's a financial advisor telling you the truth at the cookout.
- Write like it could go viral. Someone should read this and immediately want to screenshot it and send it to their group chat.
- End with ONE sentence that pivots from funny to real — the truth that lands after the laugh. Something like: "But real talk — you're 3 decisions away from a completely different financial life."
- NEVER be mean, shame them, or make them feel stupid. The humor is with them, not at them.

EXAMPLES OF GOOD MONEY STORY ENERGY:
- "You and DoorDash are in a situationship. They never text first but somehow end up with $340 of your money every month. No judgment — but that's a Roth IRA that's been eating pad thai."
- "Your bank account has two modes: 'just got paid' and 'wait, where did it go?' You spend like a CEO on payday and a monk by the 25th. The gap between those two people is costing you $400 a month."
- "You have a gym membership AND a DoorDash habit. Your body and your wallet are having the exact same argument and neither one is winning."

Write THEIR specific money story based on what you actually see in their transactions.

## 2. THE NUMBERS
Break down their transactions into these categories with exact dollar totals:
- Total income (all credits)
- Total spending (all debits)  
- Net cash flow (income minus spending)
- Top 5 spending categories with dollar amounts and percentage of income

## 3. THE THREE LEAKS
Identify the 3 biggest money leaks — specific merchants, habits, or patterns that are bleeding money. For each one:
- Name the exact merchant or habit
- Show the exact total spent in the period
- Project it annually
- Connect it to a wealth-building alternative (e.g., "That's a Roth IRA contribution")

## 4. WHAT'S ACTUALLY WORKING
Find at least 2-3 positive things in their spending. Look for: paying bills on time, reasonable grocery spending, no gambling, gym membership, etc. People need to know what to keep, not just what to cut.

## 5. THE 90-DAY PLAN
Three specific monthly phases:
- Month 1: The one structural change to make immediately
- Month 2: The redirect — where that recovered money should go
- Month 3: The target — what their finances should look like if they execute

## 6. YOUR LAW — HOW TO APPLY IT WITH WHAT YOU HAVE RIGHT NOW
This is the most actionable section. Based on everything you saw in their transactions, identify which ONE of Big Homie's 10 Financial Laws applies most directly to their situation right now. Then show them EXACTLY how to apply it using their real numbers — not theory, not someday, but with what they already have coming in this month.

The 10 Laws are:
- LAW 1: Pay Yourself First — save 10% off the top before anything else
- LAW 2: The Account System — separate buckets for spending, saving, investing
- LAW 3: The 50/30/20 Rule — split every dollar intentionally
- LAW 4: Make Your Money Work — move savings into high-yield or investments
- LAW 5: Master Your Credit — protect and build your credit score
- LAW 6: Real Estate — path to owning property
- LAW 7: Protect What You Build — insurance, LLC, will, emergency fund
- LAW 8: The Stock Market — index funds, dollar cost averaging
- LAW 9: Debt — Kill or Keep — attack high-interest debt first
- LAW 10: Generational Wealth — building for the next generation

FORMAT THIS SECTION LIKE THIS:

**YOUR LAW: [Law number and name]**

[One sentence on why THIS law is the one for them right now based on their data]

**What the law says:**
[2-3 sentences — Big Homie's plain language version of the law. Simple. Direct.]

**How YOU apply it this month with your actual numbers:**
[This is the most important part. Use their real income and spending from the transactions. Show them the exact dollar amounts. Example: "You made $4,800 this month. Ten percent is $480. That $480 moves to a separate savings account the day your check hits — before rent, before groceries, before anything. Set the automatic transfer right now. You already proved you can live without it because you spent it on other things anyway."]

**What changes in 30 days if you do this:**
[One concrete, specific outcome using their real numbers. Make it feel real and achievable.]

## 7. THE ONE MOVE
After applying the law above, give them exactly ONE action to take THIS WEEK. It should be the bridge between the law they just learned and the life they're trying to build. One action. Make it specific, simple, and doable in under 10 minutes.

---

VOICE RULES:
- Speak directly to them. Use "you" throughout.
- Short paragraphs. Punchy sentences.
- Real numbers. Name specific merchants. Don't be vague.
- Never judgmental. Always empowering.
- This is a conversation, not a report. Write it like Big Homie is sitting across from them.
- End The One Move section with: "That's your move. One week. Let's go."

TRANSACTION DATA:
${transactions}`;

// (GBtn/OBtn/PBtn inherited from app)

// ─── REPORT RENDERER ─────────────────────────────────────────────────
function ReportSection({title,icon,color=B.gold,children,delay=0}){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setVisible(true),delay);return()=>clearTimeout(t);},[delay]);
  return(
    <div style={{opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(16px)",transition:"all 0.5s ease",background:B.cardGrad,border:`1px solid ${color}22`,borderLeft:`4px solid ${color}`,borderRadius:"0 16px 16px 0",padding:"22px 24px",marginBottom:"16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px"}}>
        <span style={{fontSize:"20px"}}>{icon}</span>
        <div style={{fontFamily:B.display,fontSize:"18px",letterSpacing:"2px",color,lineHeight:"1"}}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function ReportText({text}){
  // Parse markdown-ish formatting from Claude response
  const lines = text.split('\n').filter(l => l.trim());
  return(
    <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
      {lines.map((line,i)=>{
        const isBold = line.startsWith('**') || line.startsWith('##') || line.startsWith('- **');
        const isItem = line.startsWith('- ');
        const clean = line.replace(/^##\s*/,'').replace(/\*\*/g,'').replace(/^-\s*/,'');
        if(line.startsWith('##')){
          return <div key={i} style={{fontFamily:B.display,fontSize:"16px",letterSpacing:"2px",color:B.gold,marginTop:"8px",marginBottom:"4px"}}>{clean.toUpperCase()}</div>;
        }
        if(isItem){
          return(
            <div key={i} style={{display:"flex",gap:"10px",alignItems:"flex-start"}}>
              <div style={{width:"6px",height:"6px",borderRadius:"50%",background:B.gold,marginTop:"8px",flexShrink:0}}/>
              <div style={{fontSize:"14px",color:B.cream,lineHeight:"1.7"}}>{clean}</div>
            </div>
          );
        }
        return <div key={i} style={{fontSize:"14px",color:line.trim()===''?'transparent':B.cream,lineHeight:"1.8"}}>{clean||' '}</div>;
      })}
    </div>
  );
}

// Parse Claude's response into sections
function parseReport(text){
  const sections = {};
  const sectionMap = {
    'YOUR MONEY STORY': 'story',
    'THE NUMBERS': 'numbers',
    'THE THREE LEAKS': 'leaks',
    "WHAT'S ACTUALLY WORKING": 'working',
    'THE 90-DAY PLAN': 'plan',
    'YOUR LAW': 'law',
    'THE ONE MOVE': 'move',
  };
  let current = 'intro';
  let buffer = [];
  const lines = text.split('\n');
  for(const line of lines){
    const headerMatch = Object.keys(sectionMap).find(k => line.toUpperCase().includes(k));
    if(headerMatch){
      if(buffer.length) sections[current] = buffer.join('\n');
      current = sectionMap[headerMatch];
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  if(buffer.length) sections[current] = buffer.join('\n');
  return sections;
}

// ─── LIGHT REVERSED LOGO ─────────────────────────────────────────────
// Espresso on cream — for Check In (light/premium feel)
function CollegiateLogoLight({width=200,height=58}){
  // Primary Dark colorway — cream on obsidian, for dark backgrounds
  return(
    <svg viewBox="0 0 260 74" width={width} height={height} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lgDD" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C47A3A"/>
          <stop offset="55%" stopColor="#E8A838"/>
          <stop offset="100%" stopColor="#F5C842"/>
        </linearGradient>
      </defs>
      <rect x="10" y="4" width="240" height="1.5" fill="url(#lgDD)" rx="1"/>
      <text x="130" y="14" fontFamily="'DM Sans',sans-serif" fontSize="5.5" fontWeight="800" fill="#9A8570" letterSpacing="3" textAnchor="middle">EST. IN THE COMMUNITY</text>
      <rect x="10" y="18" width="240" height="0.8" fill="rgba(232,168,56,0.2)" rx="1"/>
      <text x="130" y="43" fontFamily="'Bebas Neue',Impact,sans-serif" fontSize="22" fill="#6A5840" letterSpacing="14" textAnchor="middle">BIG</text>
      <text x="130" y="63" fontFamily="'Bebas Neue',Impact,sans-serif" fontSize="34" fill="#F5ECD7" letterSpacing="5" textAnchor="middle">HOMIE</text>
      <rect x="10" y="66" width="240" height="1.5" fill="url(#lgDD)" rx="1"/>
      <text x="130" y="73" fontFamily="'DM Sans',sans-serif" fontSize="5" fontWeight="800" fill="#E8A838" letterSpacing="3" textAnchor="middle">EVERYBODY EAT · EST. 2025</text>
    </svg>
  );
}

// ─── STEP 1: PAYMENT ──────────────────────────────────────────────────
function StepPayment({onPay}){
  const [loading,setLoading]=useState(false);
  const features=[
    {icon:"🔍",text:"Full transaction-by-transaction analysis"},
    {icon:"💸",text:"Your 3 biggest money leaks — named & priced"},
    {icon:"📊",text:"Exact spending breakdown by category"},
    {icon:"🗓️",text:"Personalized 90-day action plan"},
    {icon:"🎯",text:"The one move to make this week"},
    {icon:"📈",text:"What's actually working in your finances"},
  ];
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"40px 24px",maxWidth:"560px",margin:"0 auto",textAlign:"center"}}>
      {/* Collegiate logo — cream on dark */}
      <div style={{background:B.cardGrad,borderRadius:"16px",padding:"18px 28px 14px",marginBottom:"28px",border:"1px solid rgba(232,168,56,0.15)",boxShadow:"0 4px 24px rgba(0,0,0,0.3)"}}>
        <CollegiateLogoLight width={210} height={60}/>
      </div>

      {/* Crown orb */}
      <div style={{width:"72px",height:"72px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"30px",marginBottom:"20px",boxShadow:"0 0 32px rgba(232,168,56,0.45)"}}>👑</div>

      <div style={{fontSize:"11px",color:B.gold,letterSpacing:"4px",fontWeight:"800",marginBottom:"10px"}}>One-Time · $4.99</div>
      <div style={{fontFamily:B.display,fontSize:"44px",letterSpacing:"3px",color:B.cream,lineHeight:"1.1",marginBottom:"8px"}}>THE CHECK IN</div>
      <div style={{fontSize:"16px",color:B.gold,fontStyle:"italic",marginBottom:"8px"}}>Big Homie reads your checking account.</div>
      <div style={{fontSize:"14px",color:B.muted,lineHeight:"1.8",marginBottom:"28px",maxWidth:"420px"}}>
        No financial advisor. No judgment. Just Big Homie looking at your actual transactions and telling you exactly what's going on — and what to do about it.
      </div>

      {/* Feature list — cream card with espresso text */}
      <div style={{background:B.cardGrad,border:"1px solid rgba(232,168,56,0.12)",borderRadius:"16px",padding:"20px 24px",width:"100%",marginBottom:"24px",textAlign:"left"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          {features.map(f=>(
            <div key={f.text} style={{display:"flex",gap:"12px",alignItems:"center"}}>
              <span style={{fontSize:"18px"}}>{f.icon}</span>
              <span style={{fontSize:"14px",color:B.cream,lineHeight:"1.5"}}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Price callout — light reversed */}
      <div style={{background:"rgba(232,168,56,0.06)",border:"1px solid rgba(232,168,56,0.2)",borderRadius:"12px",padding:"14px 20px",marginBottom:"24px",width:"100%"}}>
        <div style={{fontSize:"13px",color:B.muted,marginBottom:"4px"}}>A financial advisor charges $200–500 for this.</div>
        <div style={{fontFamily:B.display,fontSize:"28px",color:B.gold,letterSpacing:"2px"}}>Big Homie does it for $4.99.</div>
      </div>

      <PBtn onClick={async()=>{setLoading(true);try{await onPay();}finally{setLoading(false);}}} style={{width:"100%",padding:"16px",fontSize:"16px",}}>
        {loading?"Processing...":"Start My Check In — $4.99 →"}
      </PBtn>
      <div style={{fontSize:"11px",color:B.muted,marginTop:"12px"}}>One-time purchase. No subscription. Your report is ready in under 60 seconds.</div>
    </div>
  );
}

// ─── STEP 2: UPLOAD ───────────────────────────────────────────────────
function StepUpload({onUpload,onDemo}){
  const fileRef=useRef();
  const [dragging,setDragging]=useState(false);
  const [fileName,setFileName]=useState(null);
  const [fileData,setFileData]=useState(null);
  const [name,setName]=useState("");

  const handleFile=(file)=>{
    if(!file)return;
    setFileName(file.name);
    const reader=new FileReader();
    reader.onload=(e)=>setFileData(e.target.result);
    reader.readAsText(file);
  };


  // ── Detect unlabeled Cash App / Chime / P2P transfers ──
  const [showClarify,setShowClarify]=useState(false);
  const [clarifications,setClarifications]=useState([]);
  const [pendingData,setPendingData]=useState(null);
  const TRANSFER_KEYWORDS=["CASH APP","CHIME","VENMO","ZELLE","PAYPAL","TRANSFER","P2P"];

  const detectUnclear=(data)=>{
    const dataLines=data.split("\n").slice(1);
    const seen=new Set();
    const unclear=[];
    dataLines.forEach(line=>{
      const upper=line.toUpperCase();
      if(TRANSFER_KEYWORDS.some(t=>upper.includes(t))){
        const parts=line.split(",");
        const desc=(parts[1]||parts[0]||"").trim();
        const amt=(parts[2]||parts[1]||"").trim();
        if(desc&&!seen.has(desc)){
          seen.add(desc);
          unclear.push({desc,amt,label:""});
        }
      }
    });
    return unclear.slice(0,5);
  };

  const handleFileReady=(data,nm)=>{
    const unclear=detectUnclear(data);
    if(unclear.length>0){
      setPendingData({data,name:nm});
      setClarifications(unclear);
      setShowClarify(true);
    } else { onUpload(data,nm); }
  };

  const submitWithClarifications=()=>{
    const notes=clarifications.filter(c=>c.label.trim()).map(c=>`NOTE: "${c.desc}" (${c.amt}) = ${c.label}`).join("\n");
    const enriched=pendingData.data+(notes?`\n\nUSER CLARIFICATIONS:\n${notes}`:"");
    onUpload(enriched,pendingData.name);
  };

  const methods=[
    {icon:"📄",title:"Upload Bank Statement",sub:"CSV or PDF export from your bank",action:()=>fileRef.current.click()},
    {icon:"🔗",title:"Connect with Plaid",sub:"Chime · Cash App · USAA · Chase · SoFi · Varo and more — Pro",action:()=>alert("Plaid connection unlocks with Pro. Download your statement CSV to continue for now.")},
  ];

  if(showClarify){
    return(
      <div style={{padding:"32px 24px",maxWidth:"580px",margin:"0 auto"}}>
        <div style={{marginBottom:"24px"}}>
          <div style={{fontSize:"10px",color:B.gold,letterSpacing:"4px",fontWeight:"800",marginBottom:"8px"}}>QUICK QUESTION BEFORE WE DIVE IN</div>
          <div style={{fontFamily:B.display,fontSize:"28px",letterSpacing:"2px",color:B.cream,lineHeight:"1.2",marginBottom:"8px"}}>BIG HOMIE SAW SOME TRANSFERS</div>
          <div style={{fontSize:"14px",color:B.muted,lineHeight:"1.7"}}>Looks like you use Cash App, Chime, or Venmo. Some of these transfers don't have labels — tell Big Homie what they were for and the analysis gets way more accurate. Skip anything you don't want to share.</div>
        </div>
        <div style={{background:B.espresso,border:"1px solid rgba(232,168,56,0.2)",borderLeft:`4px solid ${B.gold}`,borderRadius:"0 12px 12px 0",padding:"14px 16px",marginBottom:"20px",display:"flex",gap:"10px",alignItems:"flex-start"}}>
          <div style={{width:"28px",height:"28px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"11px",color:B.obsidian,flexShrink:0}}>BH</div>
          <div style={{fontSize:"13px",color:B.cream,lineHeight:"1.7"}}>Cash App and Zelle don't always tell me what the money was for. Label what you can — even one or two makes the analysis sharper. Skip what you want to keep private. I got you either way.</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"12px",marginBottom:"24px"}}>
          {clarifications.map((c,i)=>(
            <div key={i} style={{background:B.cardGrad,border:"1px solid rgba(232,168,56,0.12)",borderRadius:"12px",padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                <div>
                  <div style={{fontSize:"13px",fontWeight:"700",color:B.cream}}>{c.desc}</div>
                  <div style={{fontSize:"11px",color:B.muted}}>{c.amt}</div>
                </div>
                <div style={{fontSize:"10px",color:"rgba(154,133,112,0.4)",fontStyle:"italic"}}>optional</div>
              </div>
              <input value={c.label} onChange={e=>{const u=[...clarifications];u[i]={...u[i],label:e.target.value};setClarifications(u);}}
                placeholder={`What was this? e.g. "Rent", "Side hustle income", "Friend paid me back"`}
                style={{width:"100%",background:B.espresso,border:"1px solid rgba(232,168,56,0.15)",borderRadius:"8px",padding:"10px 12px",color:B.cream,fontSize:"13px",fontFamily:B.body,outline:"none"}}/>
            </div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          <GBtn onClick={submitWithClarifications} style={{width:"100%",padding:"14px",fontSize:"15px"}}>Looks Good — Run My Check In →</GBtn>
          <button onClick={()=>onUpload(pendingData.data,pendingData.name)} style={{background:"transparent",border:"none",color:B.muted,fontFamily:B.body,fontSize:"13px",cursor:"pointer",padding:"8px",textAlign:"center"}}>Skip — analyze without labels</button>
        </div>
      </div>
    );
  }

  return(
    <div style={{padding:"32px 24px",maxWidth:"580px",margin:"0 auto"}}>
      <div style={{marginBottom:"28px",textAlign:"center"}}>
        <div style={{fontSize:"10px",color:B.gold,letterSpacing:"4px",fontWeight:"800",marginBottom:"8px"}}>STEP 1 OF 2</div>
        <div style={{fontFamily:B.display,fontSize:"36px",letterSpacing:"2px",color:B.cream,marginBottom:"6px"}}>SHOW BIG HOMIE YOUR MONEY</div>
        <div style={{fontSize:"14px",color:B.muted,lineHeight:"1.7"}}>Upload 30-90 days of transactions. The more data, the more accurate the analysis.</div>
      </div>

      {/* Name input */}
      <div style={{marginBottom:"20px"}}>
        <div style={{fontSize:"11px",color:B.gold,letterSpacing:"2px",fontWeight:"800",marginBottom:"8px"}}>YOUR NAME (optional)</div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="First name — Big Homie will use it in your report"
          style={{width:"100%",background:B.espresso,border:"1px solid rgba(232,168,56,0.2)",borderRadius:"10px",padding:"12px 16px",color:B.cream,fontSize:"14px",fontFamily:B.body,outline:"none"}}/>
      </div>

      {/* Supported banks callout */}
      <div style={{background:"rgba(76,175,125,0.05)",border:"1px solid rgba(76,175,125,0.15)",borderRadius:"12px",padding:"12px 16px",marginBottom:"16px",display:"flex",gap:"10px",alignItems:"flex-start"}}>
        <span style={{fontSize:"16px"}}>🏦</span>
        <div>
          <div style={{fontSize:"12px",fontWeight:"700",color:B.success,marginBottom:"4px"}}>Chime · Cash App · USAA · Chase · SoFi and more — all supported</div>
          <div style={{fontSize:"12px",color:B.muted,lineHeight:"1.6"}}>Export your statement as CSV from your bank app and drop it here. Big Homie reads everything — including Chime and Cash App transfers. He'll ask about any unlabeled ones.</div>
        </div>
      </div>

      {/* Upload methods */}
      <div style={{display:"flex",flexDirection:"column",gap:"10px",marginBottom:"20px"}}>
        {methods.map(m=>(
          <div key={m.title} onClick={m.action} style={{background:B.cardGrad,border:"1px solid rgba(232,168,56,0.12)",borderRadius:"14px",padding:"18px 20px",cursor:"pointer",display:"flex",gap:"14px",alignItems:"center",transition:"all 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.border="1px solid rgba(232,168,56,0.3)"}
            onMouseLeave={e=>e.currentTarget.style.border="1px solid rgba(232,168,56,0.12)"}>
            <span style={{fontSize:"28px"}}>{m.icon}</span>
            <div>
              <div style={{fontSize:"15px",fontWeight:"700",color:B.cream,marginBottom:"2px"}}>{m.title}</div>
              <div style={{fontSize:"12px",color:B.muted}}>{m.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e=>{e.preventDefault();setDragging(true);}}
        onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]);}}
        onClick={()=>fileRef.current.click()}
        style={{border:`2px dashed ${dragging?"rgba(232,168,56,0.6)":"rgba(232,168,56,0.2)"}`,borderRadius:"14px",padding:"28px",textAlign:"center",cursor:"pointer",background:dragging?"rgba(232,168,56,0.04)":"transparent",transition:"all 0.2s",marginBottom:"16px"}}>
        {fileName?(
          <div>
            <div style={{fontSize:"28px",marginBottom:"8px"}}>✅</div>
            <div style={{fontSize:"15px",fontWeight:"700",color:B.success,marginBottom:"4px"}}>{fileName}</div>
            <div style={{fontSize:"12px",color:B.muted}}>Tap to change file</div>
          </div>
        ):(
          <div>
            <div style={{fontSize:"32px",marginBottom:"8px"}}>📂</div>
            <div style={{fontSize:"14px",color:B.muted,lineHeight:"1.7"}}>Drag & drop your bank statement here<br/>or tap to browse files<br/><span style={{fontSize:"12px",color:"rgba(154,133,112,0.6)"}}>CSV, PDF, or TXT</span></div>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".csv,.pdf,.txt" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
        <GBtn onClick={()=>fileData?handleFileReady(fileData,name):null} disabled={!fileData} style={{width:"100%",padding:"14px",fontSize:"15px"}}>
          {fileData?"Analyze My Transactions →":"Upload a File to Continue"}
        </GBtn>
        <button onClick={()=>onDemo(name)} style={{background:"transparent",border:"1px solid rgba(154,133,112,0.2)",borderRadius:"10px",padding:"12px",color:B.muted,fontFamily:B.body,fontSize:"13px",cursor:"pointer"}}>
          Try with sample transactions instead →
        </button>
      </div>

      {/* Privacy note */}
      <div style={{background:"rgba(76,175,125,0.06)",border:"1px solid rgba(76,175,125,0.15)",borderRadius:"10px",padding:"14px 16px",marginTop:"16px",display:"flex",gap:"10px",alignItems:"flex-start"}}>
        <span style={{fontSize:"16px"}}>🔒</span>
        <div style={{fontSize:"12px",color:B.muted,lineHeight:"1.6"}}>Your transaction data is sent directly to Claude AI for analysis and is never stored on Big Homie servers. Your financial data stays between you and the analysis.</div>
      </div>
    </div>
  );
}

// ─── STEP 3: ANALYZING ────────────────────────────────────────────────
function StepAnalyzing({progress}){
  const steps=[
    {label:"Reading your transactions",done:progress>=20},
    {label:"Identifying spending patterns",done:progress>=40},
    {label:"Calculating your money leaks",done:progress>=60},
    {label:"Building your 90-day plan",done:progress>=80},
    {label:"Writing your Big Homie report",done:progress>=95},
  ];
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 24px",textAlign:"center",maxWidth:"480px",margin:"0 auto"}}>
      {/* Animated BH orb */}
      <div style={{width:"100px",height:"100px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"28px",color:"#fff",letterSpacing:"2px",marginBottom:"32px",boxShadow:"0 0 60px rgba(232,168,56,0.5)",animation:"bhpulse 1.5s ease-in-out infinite"}}>BH</div>

      <div style={{fontFamily:B.display,fontSize:"32px",letterSpacing:"2px",color:B.cream,marginBottom:"8px"}}>BIG HOMIE IS READING YOUR MONEY</div>
      <div style={{fontSize:"14px",color:B.muted,marginBottom:"40px",lineHeight:"1.7"}}>Analyzing every transaction. Finding every pattern. Writing your truth.</div>

      {/* Progress steps */}
      <div style={{width:"100%",display:"flex",flexDirection:"column",gap:"12px",marginBottom:"32px"}}>
        {steps.map((s,i)=>(
          <div key={s.label} style={{display:"flex",gap:"12px",alignItems:"center",opacity:s.done||progress>=(i*20)?1:0.3,transition:"opacity 0.4s"}}>
            <div style={{width:"22px",height:"22px",borderRadius:"50%",background:s.done?B.success:"rgba(255,255,255,0.1)",border:`1px solid ${s.done?"transparent":"rgba(255,255,255,0.1)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",flexShrink:0,transition:"all 0.4s"}}>
              {s.done?"✓":""}
            </div>
            <div style={{fontSize:"13px",color:s.done?B.cream:B.muted,textAlign:"left"}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{width:"100%",background:"rgba(255,255,255,0.06)",borderRadius:"100px",height:"6px",overflow:"hidden"}}>
        <div style={{width:`${progress}%`,height:"100%",background:B.goldGrad,borderRadius:"100px",transition:"width 0.8s ease"}}/>
      </div>
      <div style={{fontSize:"12px",color:B.gold,marginTop:"8px",fontWeight:"700"}}>{Math.round(progress)}%</div>

      <style>{`@keyframes bhpulse{0%,100%{box-shadow:0 0 60px rgba(232,168,56,0.5),0 0 0 0 rgba(232,168,56,0.3)}50%{box-shadow:0 0 80px rgba(232,168,56,0.7),0 0 0 20px rgba(232,168,56,0)}}`}</style>
    </div>
  );
}

// ─── MONEY STORY CARD — THE SHAREABLE MOMENT ─────────────────────────
function MoneyStoryCard({text,name,delay=0}){
  const [visible,setVisible]=useState(false);
  const [copied,setCopied]=useState(false);
  const cardRef=useRef();
  useEffect(()=>{const t=setTimeout(()=>setVisible(true),delay);return()=>clearTimeout(t);},[delay]);

  const shareStory=()=>{
    const shareText=`Big Homie just read my finances and I'm not okay 😭💀\n\n"${text.slice(0,200)}..."\n\nGet your own Check In → bighomie.app`;
    if(navigator.share){
      navigator.share({title:"My Big Homie Money Story",text:shareText,url:"https://bighomie.app"});
    } else {
      navigator.clipboard?.writeText(shareText);
      setCopied(true);
      setTimeout(()=>setCopied(false),2500);
    }
  };

  return(
    <div style={{opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(20px)",transition:"all 0.6s ease",marginBottom:"20px"}}>
      {/* Label */}
      <div style={{fontSize:"11px",color:B.gold,letterSpacing:"4px",fontWeight:"800",textTransform:"uppercase",marginBottom:"10px",display:"flex",alignItems:"center",gap:"8px"}}>
        <span>🪞</span> YOUR MONEY STORY
        <span style={{fontSize:"10px",color:B.muted,letterSpacing:"1px",fontWeight:"500",marginLeft:"4px"}}>— the part you're going to screenshot</span>
      </div>

      {/* The card itself */}
      <div ref={cardRef} style={{
        background:`linear-gradient(145deg,${B.espresso},${B.charcoal})`,
        border:`1px solid rgba(232,168,56,0.35)`,
        borderRadius:"20px",
        padding:"28px 28px 24px",
        position:"relative",
        overflow:"hidden",
      }}>
        {/* Gold accent top bar */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:"3px",background:B.goldGrad}}/>

        {/* Quote marks */}
        <div style={{fontFamily:"Georgia,serif",fontSize:"80px",color:"rgba(232,168,56,0.08)",lineHeight:"0.6",marginBottom:"16px",marginLeft:"-4px",userSelect:"none"}}>"</div>

        {/* The story text */}
        <div style={{fontSize:"17px",color:B.cream,lineHeight:"1.85",fontWeight:"500",marginBottom:"20px",marginTop:"-12px"}}>
          {text}
        </div>

        {/* Branding footer */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:"16px",borderTop:"1px solid rgba(232,168,56,0.12)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{width:"30px",height:"30px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"11px",color:"#fff",letterSpacing:"1px"}}>BH</div>
            <div>
              <div style={{fontFamily:B.display,fontSize:"13px",letterSpacing:"2px",color:B.gold}}>BIG HOMIE</div>
              <div style={{fontSize:"10px",color:B.muted,letterSpacing:"1px"}}>THE CHECK IN · bighomie.app</div>
            </div>
          </div>
          {name&&<div style={{fontFamily:B.display,fontSize:"14px",letterSpacing:"2px",color:B.muted}}>{name.toUpperCase()}</div>}
        </div>
      </div>

      {/* Share CTA — right under the card */}
      <div style={{display:"flex",gap:"10px",marginTop:"12px",alignItems:"center"}}>
        <button onClick={shareStory} style={{
          background:copied?"rgba(76,175,125,0.15)":B.goldGrad,
          color:copied?B.success:B.obsidian,
          border:copied?"1px solid rgba(76,175,125,0.4)":"none",
          borderRadius:"10px",padding:"11px 20px",
          fontSize:"13px",fontWeight:"800",fontFamily:B.body,
          cursor:"pointer",display:"flex",gap:"8px",alignItems:"center",
          transition:"all 0.2s",
        }}>
          {copied?"✓ Copied to clipboard":"🤙 Share My Money Story"}
        </button>
        <div style={{fontSize:"12px",color:B.muted,lineHeight:"1.5"}}>
          Your people need to see this.<br/>They probably have the same story.
        </div>
      </div>
    </div>
  );
}

// ─── LAW CARD — THE BRIDGE FROM ANALYSIS TO ACTION ───────────────────
function LawCard({text,delay=0}){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setVisible(true),delay);return()=>clearTimeout(t);},[delay]);

  // Pull out the law name from "YOUR LAW: LAW X — Name" pattern
  const lawMatch = text.match(/YOUR LAW[:\s]+([^\n]+)/i);
  const lawName = lawMatch ? lawMatch[1].replace(/\*/g,'').trim() : "YOUR LAW";

  // Split text into sub-sections for styled rendering
  const blocks = [];
  const lines = text.split('\n');
  let current = {type:'text', lines:[]};
  for(const line of lines){
    const clean = line.trim();
    if(!clean) continue;
    if(clean.match(/^What the law says/i)){
      if(current.lines.length) blocks.push(current);
      current = {type:'law_says', label:'WHAT THE LAW SAYS', lines:[]};
    } else if(clean.match(/^How YOU apply/i) || clean.match(/^How you apply/i)){
      if(current.lines.length) blocks.push(current);
      current = {type:'apply', label:'HOW YOU APPLY IT THIS MONTH', lines:[]};
    } else if(clean.match(/^What changes/i)){
      if(current.lines.length) blocks.push(current);
      current = {type:'outcome', label:'WHAT CHANGES IN 30 DAYS', lines:[]};
    } else if(clean.match(/^\*\*YOUR LAW/i) || clean.match(/^YOUR LAW/i)){
      // skip — already extracted as title
    } else {
      current.lines.push(clean.replace(/^\*\*|\*\*$/g,'').replace(/\*\*/g,''));
    }
  }
  if(current.lines.length) blocks.push(current);

  const blockColors = {law_says: B.copper, apply: B.gold, outcome: B.success, text: B.muted};
  const blockIcons = {law_says:'📜', apply:'⚡', outcome:'🎯', text:''};

  return(
    <div style={{opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(20px)",transition:"all 0.6s ease",marginBottom:"20px"}}>
      {/* Label */}
      <div style={{fontSize:"11px",color:B.gold,letterSpacing:"4px",fontWeight:"800",textTransform:"uppercase",marginBottom:"10px",display:"flex",alignItems:"center",gap:"8px"}}>
        <span>📖</span> YOUR LAW
      </div>

      {/* Card */}
      <div style={{background:`linear-gradient(145deg,${B.charcoal},${B.espresso})`,border:`2px solid rgba(232,168,56,0.3)`,borderRadius:"20px",overflow:"hidden"}}>

        {/* Law name hero */}
        <div style={{background:B.goldGrad,padding:"20px 24px 18px"}}>
          <div style={{fontSize:"10px",color:B.obsidian,letterSpacing:"4px",fontWeight:"900",marginBottom:"6px",opacity:0.7}}>BIG HOMIE'S MANUAL</div>
          <div style={{fontFamily:B.display,fontSize:"26px",letterSpacing:"2px",color:B.obsidian,lineHeight:"1.1"}}>{lawName.toUpperCase()}</div>
        </div>

        {/* Sub-section blocks */}
        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:"16px"}}>
          {blocks.map((block,i)=>(
            <div key={i} style={{
              background: block.type==='apply'
                ? "rgba(232,168,56,0.06)"
                : block.type==='outcome'
                ? "rgba(76,175,125,0.06)"
                : "transparent",
              border: block.type==='apply'
                ? "1px solid rgba(232,168,56,0.15)"
                : block.type==='outcome'
                ? "1px solid rgba(76,175,125,0.15)"
                : "none",
              borderRadius: block.label ? "12px" : "0",
              padding: block.label ? "14px 16px" : "0",
            }}>
              {block.label && (
                <div style={{fontSize:"10px",color:blockColors[block.type]||B.muted,letterSpacing:"3px",fontWeight:"800",marginBottom:"10px",display:"flex",alignItems:"center",gap:"6px"}}>
                  <span>{blockIcons[block.type]}</span>{block.label}
                </div>
              )}
              {block.lines.map((line,j)=>(
                <div key={j} style={{fontSize:"14px",color:block.type==='outcome'?B.success:B.cream,lineHeight:"1.8",marginBottom:j<block.lines.length-1?"4px":"0"}}>{line}</div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer link to The Manual */}
        <div style={{borderTop:"1px solid rgba(232,168,56,0.1)",padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(0,0,0,0.15)"}}>
          <div style={{fontSize:"12px",color:B.muted}}>All 10 laws live in The Manual — free forever.</div>
          <div style={{fontSize:"12px",color:B.gold,fontWeight:"700"}}>📖 Open The Manual →</div>
        </div>
      </div>
    </div>
  );
}

// ─── ONE MOVE CARD ────────────────────────────────────────────────────
function OneMoveCard({text,delay=0}){
  const [visible,setVisible]=useState(false);
  const [done,setDone]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setVisible(true),delay);return()=>clearTimeout(t);},[delay]);

  // Clean the text
  const clean = text.replace(/^##.*\n/,'').replace(/\*\*/g,'').trim();

  return(
    <div style={{opacity:visible?1:0,transform:visible?"translateY(0)":"translateY(20px)",transition:"all 0.6s ease",marginBottom:"20px"}}>
      <div style={{fontSize:"11px",color:B.gold,letterSpacing:"4px",fontWeight:"800",textTransform:"uppercase",marginBottom:"10px",display:"flex",alignItems:"center",gap:"8px"}}>
        <span>🎯</span> THE ONE MOVE
      </div>

      <div style={{
        background: done
          ? `linear-gradient(145deg,rgba(76,175,125,0.1),rgba(76,175,125,0.06))`
          : `linear-gradient(145deg,rgba(232,168,56,0.08),rgba(196,122,58,0.06))`,
        border: `2px solid ${done?"rgba(76,175,125,0.4)":"rgba(232,168,56,0.3)"}`,
        borderRadius:"20px",
        padding:"24px",
        transition:"all 0.4s ease",
      }}>
        <div style={{fontSize:"15px",color:B.cream,lineHeight:"1.85",marginBottom:"22px",fontWeight:"500"}}>{clean}</div>

        {/* Done button */}
        <button
          onClick={()=>setDone(d=>!d)}
          style={{
            background: done ? B.success : B.goldGrad,
            color: done ? "#fff" : B.obsidian,
            border:"none",
            borderRadius:"12px",
            padding:"13px 24px",
            fontSize:"14px",
            fontWeight:"800",
            fontFamily:B.body,
            cursor:"pointer",
            display:"flex",
            alignItems:"center",
            gap:"10px",
            transition:"all 0.3s ease",
            width:"100%",
            justifyContent:"center",
          }}>
          {done ? (
            <><span style={{fontSize:"18px"}}>✅</span> Done. That's the move. 🤙</>
          ) : (
            <><span style={{fontSize:"18px"}}>🎯</span> Mark this done when you execute</>
          )}
        </button>

        {done && (
          <div style={{marginTop:"14px",background:"rgba(76,175,125,0.08)",borderRadius:"10px",padding:"12px 16px",fontSize:"13px",color:B.success,lineHeight:"1.6",textAlign:"center"}}>
            You did the thing most people won't. That's the difference. Keep going — The Manual has 10 laws. You just applied one.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STEP 4: THE REPORT ───────────────────────────────────────────────
function StepReport({report,name,onRestart,onUpgrade}){
  const sections = parseReport(report);
  const sectionDefs=[
    {key:"numbers", title:"THE NUMBERS",                icon:"📊", color:B.blue,   delay:300},
    {key:"leaks",   title:"THE THREE LEAKS",            icon:"💸", color:B.danger, delay:500},
    {key:"working", title:"WHAT'S ACTUALLY WORKING",    icon:"✅", color:B.success,delay:700},
    {key:"plan",    title:"YOUR 90-DAY PLAN",           icon:"🗓️", color:B.copper, delay:900},
  ];

  const [copied,setCopied]=useState(false);

  const printReport=()=>{ window.print(); };

  const downloadReport=()=>{
    // Build a clean text version of the full report
    const date = new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
    const header = `BIG HOMIE — THE CHECK IN REPORT\n${name?name.toUpperCase()+"'S CHECK IN · ":""}${date}\nbighomie.app · EVERYBODY EAT · EST. 2025\n${"─".repeat(60)}\n\n`;
    const body = report.replace(/##\s*/g,'').replace(/\*\*/g,'');
    const footer = `\n${"─".repeat(60)}\nGenerated by Big Homie · bighomie.app\n"The financial manual they never gave us."\nEVERYBODY EAT · EST. 2025`;
    const full = header + body + footer;
    const blob = new Blob([full], {type:"text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BigHomie_CheckIn_${name||"Report"}_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setCopied(true);
    setTimeout(()=>setCopied(false),2500);
  };

  return(
    <div style={{padding:"0 0 80px"}}>
      {/* Report hero */}
      <div style={{background:`linear-gradient(135deg,${B.espresso},${B.charcoal})`,borderBottom:"1px solid rgba(232,168,56,0.15)",padding:"32px 28px 28px",marginBottom:"24px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px"}}>
          <div style={{width:"48px",height:"48px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"16px",color:"#fff",letterSpacing:"1px",boxShadow:"0 0 20px rgba(232,168,56,0.4)"}}>BH</div>
          <div>
            <div style={{fontFamily:B.display,fontSize:"13px",letterSpacing:"3px",color:B.gold}}>BIG HOMIE CHECK IN</div>
            <div style={{fontSize:"11px",color:B.muted}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
          </div>
        </div>
        <div style={{fontFamily:B.display,fontSize:"38px",letterSpacing:"2px",color:B.cream,lineHeight:"1.1",marginBottom:"8px"}}>
          {name?`${name.toUpperCase()}'S CHECK IN`:"YOUR CHECK IN"}
        </div>
        <div style={{fontSize:"15px",color:B.gold,fontStyle:"italic"}}>Big Homie read your transactions. Here's the truth.</div>
      </div>

      <div style={{padding:"0 24px"}}>
        {/* Crown earned badge */}
        <div style={{background:"rgba(232,168,56,0.06)",border:"1px solid rgba(232,168,56,0.25)",borderRadius:"14px",padding:"16px 20px",marginBottom:"24px",display:"flex",gap:"14px",alignItems:"center"}}>
          <div style={{fontSize:"32px"}}>👑</div>
          <div>
            <div style={{fontFamily:B.display,fontSize:"18px",letterSpacing:"2px",color:B.gold,marginBottom:"4px"}}>THE CHECK IN CROWN EARNED</div>
            <div style={{fontSize:"13px",color:B.muted,lineHeight:"1.6"}}>You invested in yourself. That's the crown — earned by the people who show up for their finances. Not everybody does this.</div>
          </div>
        </div>

        {/* Money Story — special treatment, built to be shared */}
        {sections.story && (
          <MoneyStoryCard text={sections.story} name={name} delay={100}/>
        )}

        {/* Standard sections */}
        {sectionDefs.filter(s=>s.key!=="story").map(s=>(
          sections[s.key]?(
            <ReportSection key={s.key} title={s.title} icon={s.icon} color={s.color} delay={s.delay}>
              <ReportText text={sections[s.key]}/>
            </ReportSection>
          ):null
        ))}

        {/* YOUR LAW — bridge from analysis to action */}
        {sections.law && <LawCard text={sections.law} delay={1100}/>}

        {/* THE ONE MOVE — comes after the law */}
        {sections.move && <OneMoveCard text={sections.move} delay={1300}/>}

        {/* If parsing failed, show raw */}
        {Object.keys(sections).length < 3 && (
          <ReportSection title="YOUR BIG HOMIE ANALYSIS" icon="🤙" color={B.gold} delay={200}>
            <ReportText text={report}/>
          </ReportSection>
        )}

        {/* Pro upsell */}
        <div style={{background:`linear-gradient(135deg,${B.espresso},rgba(232,168,56,0.08))`,border:"1px solid rgba(232,168,56,0.25)",borderRadius:"16px",padding:"24px",marginTop:"8px",marginBottom:"16px"}}>
          <div style={{fontFamily:B.display,fontSize:"26px",letterSpacing:"2px",color:B.cream,marginBottom:"8px"}}>WANT BIG HOMIE WATCHING YOUR MONEY EVERY DAY?</div>
          <div style={{fontSize:"14px",color:B.muted,lineHeight:"1.7",marginBottom:"20px"}}>Go Pro and Big Homie watches your portfolio, alerts you when NVDA hits your exit range, analyzes your budget monthly, and is available 24/7 for any money question you have.</div>
          <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
            <button onClick={onUpgrade} style={{background:B.goldGrad,color:B.obsidian,border:"none",borderRadius:"10px",padding:"13px 24px",fontSize:"14px",fontWeight:"800",fontFamily:B.body,cursor:"pointer"}}>Upgrade to Pro — $9.99/mo 👑</button>
            <button onClick={downloadReport} style={{background:"transparent",color:B.gold,border:"1px solid rgba(232,168,56,0.35)",borderRadius:"10px",padding:"12px 18px",fontSize:"13px",fontWeight:"700",fontFamily:B.body,cursor:"pointer",display:"flex",alignItems:"center",gap:"7px"}}>
              {copied?"✓ Downloaded":"📥 Download Report"}
            </button>
            <button onClick={printReport} style={{background:"transparent",color:B.muted,border:"1px solid rgba(154,133,112,0.25)",borderRadius:"10px",padding:"12px 18px",fontSize:"13px",fontWeight:"600",fontFamily:B.body,cursor:"pointer",display:"flex",alignItems:"center",gap:"7px"}}>
              🖨️ Print
            </button>
          </div>
        </div>

        {/* Another Check In */}
        <div style={{textAlign:"center",paddingTop:"8px"}}>
          <button onClick={onRestart} style={{background:"transparent",border:"none",color:B.muted,fontFamily:B.body,fontSize:"13px",cursor:"pointer",textDecoration:"underline"}}>Run another Check In ($4.99)</button>
        </div>
      </div>
    </div>
  );
}


function CheckInPage({onUpgrade,onStartCheckInCheckout,accessToken,hasCheckInAccess,onCheckInSuccess}){
  const [step,setStep]=useState(hasCheckInAccess?"upload":"payment"); // payment → upload → analyzing → report
  const [report,setReport]=useState(null);
  const [userName,setUserName]=useState("");
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState(null);

  useEffect(()=>{
    if(hasCheckInAccess&&step==="payment"){
      setStep("upload");
    }
  },[hasCheckInAccess,step]);

  const runAnalysis=async(transactionData,name)=>{
    setUserName(name||"");
    setStep("analyzing");
    setProgress(0);
    setError(null);

    // Animate progress while waiting for API
    const progressInterval=setInterval(()=>{
      setProgress(p=>{
        if(p>=90)return p;
        return p + (Math.random()*8);
      });
    },600);

    try{
      const data=await runCheckInAnalysis({
        rawData:transactionData,
        name,
      },accessToken);

      const text=data.report||"";

      if(!text){
        throw new Error("No response received");
      }

      clearInterval(progressInterval);
      setProgress(100);
      onCheckInSuccess?.(data);

      setTimeout(()=>{
        setReport(text);
        setStep("report");
      },600);

    }catch(err){
      clearInterval(progressInterval);
      setError(err.message||"Connection dropped. Try again.");
      setStep(err.status===402?"payment":"upload");
    }
  };

  const handleUpload=(data,name)=>runAnalysis(data,name);
  const handleDemo=(name)=>runAnalysis(DEMO_TRANSACTIONS,name);
  const handleRestart=()=>{setStep(hasCheckInAccess?"upload":"payment");setReport(null);setProgress(0);};

  return(
    <div style={{background:B.obsidian,minHeight:"100vh",fontFamily:B.body,color:B.cream}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:#0A0806;}
        ::-webkit-scrollbar-thumb{background:#8B5E3C;border-radius:2px;}
      `}</style>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",borderBottom:"1px solid rgba(232,168,56,0.12)",background:"rgba(10,8,6,0.97)",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{width:"36px",height:"36px",borderRadius:"50%",background:B.goldGrad,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:B.display,fontSize:"13px",color:"#fff",letterSpacing:"1px"}}>BH</div>
          <div>
            <div style={{fontFamily:B.display,fontSize:"18px",letterSpacing:"3px",color:B.cream}}>BIG HOMIE</div>
            <div style={{fontSize:"10px",color:B.gold,letterSpacing:"2px",textTransform:"uppercase",fontWeight:"800"}}>Check In</div>
          </div>
        </div>

        {/* Progress indicator in header */}
        {(step==="upload"||step==="analyzing"||step==="report")&&(
          <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
            {["upload","analyzing","report"].map((s,i)=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <div style={{width:"28px",height:"28px",borderRadius:"50%",background:step===s||["analyzing","report"].includes(step)&&i===0||step==="report"&&i<2?B.goldGrad:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",color:step===s||step==="report"&&i<2||step==="analyzing"&&i===0?"#fff":B.muted,fontWeight:"800",transition:"all 0.3s"}}>{i+1}</div>
                {i<2&&<div style={{width:"20px",height:"2px",background:"rgba(255,255,255,0.08)",borderRadius:"1px"}}/>}
              </div>
            ))}
          </div>
        )}

        <div style={{fontSize:"18px"}}>👑</div>
      </div>

      {/* Error banner */}
      {error&&(
        <div style={{background:"rgba(224,82,82,0.1)",border:"1px solid rgba(224,82,82,0.3)",padding:"12px 24px",display:"flex",gap:"10px",alignItems:"center"}}>
          <span style={{fontSize:"16px"}}>⚠️</span>
          <span style={{fontSize:"13px",color:B.danger}}>{error}</span>
        </div>
      )}

      {/* Step content */}
      {step==="payment" && <StepPayment onPay={onStartCheckInCheckout}/>}
      {step==="upload"  && <StepUpload onUpload={handleUpload} onDemo={handleDemo}/>}
      {step==="analyzing"&&<StepAnalyzing progress={progress}/>}
      {step==="report"  && <StepReport report={report} name={userName} onRestart={handleRestart} onUpgrade={onUpgrade}/>}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────
export default function BigHomieApp({authUser,profile,accessToken,onProfileRefresh,onSignOut}){
  const [onboarded,setOnboarded]=useState(Boolean(profile?.onboarding_completed_at));
  const [user,setUser]=useState(null);
  const [page,setPage]=useState("dashboard");
  const [isPro,setIsPro]=useState(false);
  const [checkinCredits,setCheckinCredits]=useState(Number(profile?.checkin_credits||0));
  const [showPricing,setShowPricing]=useState(false);
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [darkMode,setDarkMode]=useState(true);
  const [showWaitlist,setShowWaitlist]=useState(false);

  const applyProfile=(nextProfile)=>{
    if(!nextProfile) return;

    setUser({
      name:nextProfile.full_name||authUser?.email?.split("@")[0]||"",
      goal:nextProfile.goal||"",
      isVet:Boolean(nextProfile.is_vet),
      income:Number(nextProfile.income||0),
      referralCode:nextProfile.referral_code||"",
      stripeConnectAccountId:nextProfile.stripe_connect_account_id||"",
    });
    setOnboarded(Boolean(nextProfile.onboarding_completed_at));
    setIsPro(nextProfile.pro_status==="active"&&["pro_monthly","pro_annual"].includes(nextProfile.subscription_tier));
    setCheckinCredits(Number(nextProfile.checkin_credits||0));
  };

  useEffect(()=>{
    applyProfile(profile);
  },[profile]);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const checkoutStatus=params.get("checkout");
    const plan=params.get("plan");
    const connectStatus=params.get("connect");

    if(checkoutStatus==="success"){
      if(plan==="checkin") setPage("checkin");
      onProfileRefresh?.();
    }

    if(connectStatus==="success"){
      onProfileRefresh?.();
    }

    if(checkoutStatus||connectStatus){
      params.delete("checkout");
      params.delete("plan");
      params.delete("session_id");
      params.delete("connect");
      const query=params.toString();
      const nextUrl=`${window.location.pathname}${query?`?${query}`:""}`;
      window.history.replaceState({},"",nextUrl);
    }
  },[onProfileRefresh]);

  // Derived portfolio/cashflow from user data
  const portfolioValue=42847;
  const cashFlow=user?.income?Number(user.income)*0.22:0;

  const nav=[
    {id:"dashboard",icon:"🏠",label:"Home"},
    {id:"budget",icon:"💰",label:"Budget"},
    {id:"literacy",icon:"📖",label:"The Manual"},
    {id:"checkin",icon:"👑",label:"Check In"},
    {id:"connect",icon:"🔗",label:"Accounts"},
  ];

  const startCheckout=async(plan)=>{
    try{
      const data=await createCheckoutSession(plan,accessToken);
      if(data?.url){
        window.location.href=data.url;
      }
    }catch(err){
      alert(err.message||"Unable to start checkout.");
    }
  };

  const handleUpgrade=()=>{setDrawerOpen(false);setShowPricing(true);};
  const handleSelect=(plan)=>{
    if(plan==="free"){
      setShowPricing(false);
      return;
    }
    setShowPricing(false);
    startCheckout(plan);
  };
  const handleOnboardComplete=async(data)=>{
    try{
      const response=await saveOnboarding(data,accessToken);
      applyProfile(response.profile);
      onProfileRefresh?.();
    }catch(err){
      alert(err.message||"Could not save onboarding.");
    }
  };
  const handleStartCheckIn=()=>setPage("checkin");
  const handleCheckInSuccess=(data)=>{
    if(!isPro&&typeof data?.remainingCredits==="number"){
      setCheckinCredits(data.remainingCredits);
    }
    onProfileRefresh?.();
  };

  const hasCheckInAccess=isPro||checkinCredits>0;

  if(!onboarded)return <Onboarding onComplete={handleOnboardComplete}/>;

  return(
    <div style={{background:darkMode?B.obsidian:"#F0EAD6",minHeight:"100vh",fontFamily:B.body,color:darkMode?B.cream:B.espresso,maxWidth:"1200px",margin:"0 auto",transition:"background 0.3s,color 0.3s"}}>
      <style>{`
        ${!darkMode?`
          .bh-card{background:linear-gradient(145deg,#FDF6E3,#F5ECD7) !important;border-color:rgba(44,31,20,0.12) !important;}
          .bh-muted{color:#6A5840 !important;}
        `:""}
      `}</style>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=DM+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:#0A0806;}
        ::-webkit-scrollbar-thumb{background:#8B5E3C;border-radius:2px;}
        @keyframes bhring{0%,100%{box-shadow:0 4px 24px rgba(232,168,56,0.4),0 0 0 0 rgba(232,168,56,0.35);}60%{box-shadow:0 4px 24px rgba(232,168,56,0.4),0 0 0 14px rgba(232,168,56,0);}}
      `}</style>

      {showPricing&&<PricingModal onClose={()=>setShowPricing(false)} onSelect={handleSelect}/>}
      {showWaitlist&&<WaitlistModal onClose={()=>setShowWaitlist(false)}/>}
      <BHDrawer isPro={isPro} onUpgrade={handleUpgrade} open={drawerOpen} onClose={()=>setDrawerOpen(false)} accessToken={accessToken}/>



      {/* Top nav */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 24px",borderBottom:"1px solid rgba(232,168,56,0.1)",background:"rgba(10,8,6,0.97)",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:100}}>
        <CollegiateLogo width={170} height={48}/>
        <div style={{display:"flex",background:B.charcoal,border:"1px solid rgba(232,168,56,0.1)",borderRadius:"12px",padding:"4px",gap:"2px"}}>
          {nav.map(n=>(
            <button key={n.id} onClick={()=>setPage(n.id)} style={{padding:"7px 12px",borderRadius:"8px",border:"none",background:page===n.id?B.goldGrad:"transparent",color:page===n.id?B.obsidian:B.muted,fontSize:"12px",fontWeight:page===n.id?"800":"500",fontFamily:B.body,cursor:"pointer",display:"flex",gap:"4px",alignItems:"center"}}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          {/* Waitlist button */}
          <button onClick={()=>setShowWaitlist(true)} style={{background:"rgba(232,168,56,0.08)",border:"1px solid rgba(232,168,56,0.2)",borderRadius:"8px",padding:"6px 12px",fontSize:"11px",color:B.gold,fontWeight:"700",fontFamily:B.body,cursor:"pointer",whiteSpace:"nowrap"}}>📧 Waitlist</button>
          {/* Dark / Light toggle */}
          <button onClick={()=>setDarkMode(d=>!d)} title={darkMode?"Switch to Light Mode":"Switch to Dark Mode"} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(232,168,56,0.15)",borderRadius:"8px",padding:"6px 10px",fontSize:"14px",cursor:"pointer",color:B.muted,lineHeight:"1"}}>
            {darkMode?"☀️":"🌙"}
          </button>
          {isPro?(<div style={{background:"rgba(76,175,125,0.1)",border:"1px solid rgba(76,175,125,0.3)",borderRadius:"8px",padding:"5px 12px",fontSize:"11px",color:B.success,fontWeight:"700"}}>✓ PRO</div>):(<GBtn onClick={handleUpgrade} style={{padding:"7px 14px",fontSize:"11px"}}>Upgrade Pro</GBtn>)}
          <button onClick={onSignOut} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",padding:"6px 10px",fontSize:"11px",color:B.muted,fontFamily:B.body,cursor:"pointer"}}>Sign Out</button>
          <div style={{fontSize:"10px",color:B.muted}}><div style={{color:B.success}}>● LIVE</div></div>
        </div>
      </div>

      {page==="dashboard"&&<Dashboard onNav={setPage} isPro={isPro} onUpgrade={handleUpgrade} onCheckIn={handleStartCheckIn} user={user} portfolioValue={portfolioValue} cashFlow={cashFlow} isVet={user?.isVet} accessToken={accessToken}/>}
      {page==="budget"&&<Budget isPro={isPro} onUpgrade={handleUpgrade} userIncome={user?.income}/>}
      {page==="literacy"&&<FinancialLiteracy/>}
      {page==="checkin"&&<CheckInPage onUpgrade={handleUpgrade} accessToken={accessToken} hasCheckInAccess={hasCheckInAccess} onStartCheckInCheckout={()=>startCheckout("checkin")} onCheckInSuccess={handleCheckInSuccess}/>}
      {page==="connect"&&<ConnectAccounts isPro={isPro} onUpgrade={handleUpgrade}/>}
    </div>
  );
}
