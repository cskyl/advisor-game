function clip(x,a,b){return x<a?a:(x>b?b:x);}
function ri(n){return Math.floor(Math.random()*n);}
// ---- tunables (mirror events.yaml) ----
const P={
  startFund:70, startMorale:75, startRep:18, startStudents:2,
  stipend:2, baseSupport:3,                       // upkeep: students*stipend + compute - baseSupport
  prodBase:3.0, moraleDen:60, computeMult:0.18,   // production
  moraleLo:0.4, moraleHi:1.4, talentLo:0.7, talentHi:1.5,
  acceptBase:0.42, acceptRepDiv:200, repPerAccept:4, repPerAcceptSpan:3,
  grantWin:0.6, grantMin:30, grantSpan:25, grantRepDiv:4,  // grant scales with reputation
  deadlineDrain:3, papersForTenure:10, dreamRep:55,
};
function sim(policy){
  let s={morale:P.startMorale,funding:P.startFund,rep:P.startRep,students:P.startStudents,compute:0,talent:1.0,papers:0,prog:0};
  for(let m=1;m<=72;m++){
    let year=Math.floor((m-1)/12)+1, month=((m-1)%12)+1;
    let deadline=(month===1||month===5||month===9);
    // sensible growth: only recruit while keeping a funding buffer
    if(month===1 && year>=2 && year<=6 && policy==="grow"){
      if(s.rep>=32&&s.funding>=40){s.students++;s.talent=clip(s.talent+0.12,0.6,1.8);s.prog+=12;s.funding-=8;s.morale+=3;}
      else if(s.funding>=55){s.students++;s.talent=clip(s.talent+0.18,0.6,1.8);s.prog+=28;s.funding-=22;}
      else if(s.funding>=40){s.students++;s.talent=clip(s.talent-0.04,0.6,1.8);s.funding-=5;s.morale-=2;}
    }
    let drain=1+(deadline?P.deadlineDrain:0)+(year>=4?1:0)+(year<=1?-1:0);
    s.funding-=s.students*P.stipend+s.compute-P.baseSupport; s.morale-=drain;
    if(s.morale<=0||s.funding<=0||s.students<=0){s.lost=true;break;}
    // balanced action policy
    if(s.funding<30){ if(Math.random()<P.grantWin){s.funding+=ri(P.grantSpan)+P.grantMin+Math.floor(s.rep/P.grantRepDiv);s.rep+=1;}else s.morale-=2; }
    else if(s.morale<50) s.morale+=ri(8)+9;
    else if(s.compute<3 && s.funding>=(18+s.compute*9)+30){s.funding-=(18+s.compute*9);s.compute++;s.morale+=3;}
    else {s.prog+=ri(14)+12+(deadline?16:0);s.morale-=ri(5)+5;}
    s.morale=clip(s.morale,0,100);s.funding=clip(s.funding,0,9999);s.rep=clip(s.rep,0,100);
    if(s.students>=1) s.prog+=Math.floor(s.students*P.prodBase*(1+s.compute*P.computeMult)*clip(s.morale/P.moraleDen,P.moraleLo,P.moraleHi)*clip(s.talent,P.talentLo,P.talentHi));
    if(s.prog>=100){
      let p=clip(P.acceptBase+s.rep/P.acceptRepDiv+s.compute*0.03,0.1,0.92);
      if(Math.random()<p){s.papers++;s.rep=clip(s.rep+ri(P.repPerAcceptSpan)+P.repPerAccept,0,100);s.morale=clip(s.morale+ri(5)+6,0,100);s.prog-=100;}
      else{s.morale=clip(s.morale-(ri(4)+4),0,100);s.prog-=55;}
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
  let pass=res.filter(s=>!s.lost&&s.papers>=6).length; let denied=res.filter(s=>!s.lost&&s.papers<6).length;
  console.log(pol.padEnd(7),"avgPapers",avgP,"| survived%",(survived/n*100).toFixed(0),
    "| dream%",(dream/n*100).toFixed(0),"| pass(>=6)%",(pass/n*100).toFixed(0),"| denied%",(denied/n*100).toFixed(0));
}
