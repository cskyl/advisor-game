// Monte-Carlo balance check for the advisor-game monthly loop.
// Models the conference calendar + batch submission. Run: node tools/balance_sim.js
function clip(x,a,b){return x<a?a:(x>b?b:x);}
function ri(n){return Math.floor(Math.random()*n);}

// Conference calendar: month -> tier. top = harder, more prestige.
const CONF={2:"top",5:"top",8:"mid",11:"top"}; // ICML(2) NeurIPS(5) AAAI(8) CVPR(11) — ~3-month gaps so drafts bank
const TIER={top:{acc:-0.04,prestige:1.3}, mid:{acc:+0.08,prestige:0.9}};

const P={
  startFund:100, startMorale:78, startRep:20, startStudents:2,
  stipend:2, baseSupport:2,
  prodBase:5, moraleDen:65, computeMult:0.20,
  moraleLo:0.4, moraleHi:1.5, talentLo:0.7, talentHi:1.6,
  acceptBase:0.45, acceptRepDiv:200,
  // 3-tier grants: most attempts fail; rare jackpot; reputation tilts the odds.
  // Big: 4-18% chance, 70-119 + rep/3 funding. Small: 12-45%, 15-34 + rep/5. Fail: rest, -2 morale.
  deadlineDrain:2, papersForTenure:10, dreamRep:50, borderline:4,
  // Windfall random event: rarer but bigger when it hits.
  windfallProb:0.025, windfallMin:25, windfallSpan:40,
};

function sim(policy){
  let s={morale:P.startMorale,funding:P.startFund,rep:P.startRep,students:P.startStudents,compute:0,talent:1.0,papers:0,prog:0};
  for(let m=1;m<=72;m++){
    let year=Math.floor((m-1)/12)+1, month=((m-1)%12)+1;
    let deadline=CONF[month];
    // sensible growth: recruit while a healthy buffer remains (now multiple/year if rich)
    if(month===1 && year>=2 && year<=6 && policy==="grow"){
      while(s.funding >= 80 && s.students < 12){   // sensible buffer given grant variance
        if(s.rep>=32){s.students++;s.talent=clip(s.talent+0.12,0.6,1.8);s.prog+=12;s.funding-=8;s.morale+=3;}
        else{s.students++;s.talent=clip(s.talent-0.04,0.6,1.8);s.funding-=5;s.morale-=2;}
      }
    }
    let drain=1+(deadline?P.deadlineDrain:0)+(year>=4?1:0)+(year<=1?-1:0);
    s.funding-=s.students*P.stipend+s.compute-P.baseSupport; s.morale-=drain;
    if(s.morale<=0||s.funding<=0||s.students<=0){s.lost=true;break;}
    // balanced action policy
    if(s.funding<30){
      let wBig=clip(0.08 + s.rep/500, 0.05, 0.22);
      let wSmall=clip(0.32 + s.rep/400, 0.22, 0.55);
      let wFail=clip(0.60 - s.rep/300, 0.25, 0.73);
      let r=Math.random()*(wBig+wSmall+wFail);
      if(r<wBig){ s.funding += ri(50)+70 + Math.floor(s.rep/3); s.rep += 2; s.bigGrants=(s.bigGrants||0)+1; }
      else if(r<wBig+wSmall){ s.funding += ri(20)+15 + Math.floor(s.rep/5); s.rep += 1; }
      else s.morale -= 2;
    }
    else if(s.morale<50) s.morale+=ri(8)+9;
    else if(s.compute<3 && s.funding>=(18+s.compute*9)+30){s.funding-=(18+s.compute*9);s.compute++;s.morale+=3;}
    else {s.prog+=ri(14)+12+(deadline?16:0);s.morale-=ri(5)+5;}
    s.morale=clip(s.morale,0,100);s.funding=clip(s.funding,0,9999);s.rep=clip(s.rep,0,100);
    // production
    if(s.students>=1) s.prog+=Math.floor(s.students*P.prodBase*(1+s.compute*P.computeMult)*clip(s.morale/P.moraleDen,P.moraleLo,P.moraleHi)*clip(s.talent,P.talentLo,P.talentHi));
    // windfall (random gift / supplemental award)
    if(Math.random()<P.windfallProb){ s.funding += ri(P.windfallSpan)+P.windfallMin; s.windfalls=(s.windfalls||0)+1; }
    // conference deadline: submit ALL ready drafts to this venue (batch)
    if(deadline){
      let drafts=Math.floor(s.prog/100); s.prog-=drafts*100;
      s.deadlines=(s.deadlines||0)+1; s.subs=(s.subs||0)+drafts; s.maxDrafts=Math.max(s.maxDrafts||0,drafts); if(drafts>=2)s.multi=(s.multi||0)+1;
      let t=TIER[deadline];
      for(let d=0; d<drafts; d++){
        let p=clip(P.acceptBase+s.rep/P.acceptRepDiv+s.compute*0.03+t.acc,0.1,0.95);
        if(Math.random()<p){s.papers++;s.rep=clip(s.rep+Math.round((ri(3)+4)*t.prestige),0,100);s.morale=clip(s.morale+ri(4)+5,0,100);}
        else{s.morale=clip(s.morale-(ri(3)+4),0,100);s.prog+=45;} // rejected -> resubmit later
      }
    }
  }
  return s;
}
for(const pol of ["grow","steady"]){
  let res=[];for(let i=0;i<400;i++)res.push(sim(pol));
  let n=res.length;
  let avgP=(res.reduce((a,s)=>a+s.papers,0)/n).toFixed(1);
  let survived=res.filter(s=>!s.lost).length;
  let dream=res.filter(s=>!s.lost&&s.papers>=P.papersForTenure&&s.rep>=P.dreamRep).length;
  let pass=res.filter(s=>!s.lost&&s.papers>=P.borderline).length;
  let denied=res.filter(s=>!s.lost&&s.papers<P.borderline).length;
  let maxD=Math.max(...res.map(s=>s.maxDrafts||0));
  let multiPct=(res.reduce((a,s)=>a+(s.multi||0),0)/res.reduce((a,s)=>a+(s.deadlines||0),0)*100).toFixed(0);
  let avgBig=(res.reduce((a,s)=>a+(s.bigGrants||0),0)/n).toFixed(2);
  console.log(pol.padEnd(7),"avgPapers",avgP,"| survived%",(survived/n*100).toFixed(0),
    "| dream%",(dream/n*100).toFixed(0),"| pass%",(pass/n*100).toFixed(0),
    "| multi%",multiPct,"| avg bigGrants/run",avgBig);
}
