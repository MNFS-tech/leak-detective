"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { Search, FlaskConical, Gauge, Droplets, Bug, Lightbulb, Target, ShieldAlert, ListChecks, PartyPopper, Info, RefreshCw, BookOpen } from "lucide-react";

// ---------- Types ----------
interface CaseTruth{leakToilet:boolean;leakBackground:boolean;leakIrrigation:boolean;leakTank:boolean;noLeak:boolean;}
interface DataPoint{t:number;label:string;flow:number;}
interface TestResult{name:string;result:string;cost:number;}
interface ScoreDetail{correct:number;wrong:number;spend:number;}
interface FlagDelta{key:keyof CaseTruth; label:string; expected:boolean; chosen:boolean; delta:number;}
interface ScoreParts{pointsCorrect:number; pointsWrong:number; perfectBonus:number; testPenalty:number; total:number; exact:boolean; flags:FlagDelta[]}

type Difficulty='Easy'|'Medium'|'Hard';

// ---------- Utils ----------
function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v));}
function mulberry32(seed:number){let t=seed>>>0;return function(){t+=0x6D2B79F5;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return((r^(r>>>14))>>>0)/4294967296;};}
function normalizeTo100(raw:number){return Math.round(Math.max(0, Math.min(100, (raw/70)*100)));}

// ---------- Generator ----------
function genCase(opts:{seed?:number,difficulty:Difficulty}){
  const rng=opts.seed!==undefined?mulberry32(opts.seed):Math.random;
  const days=7,stepsPerDay=48;const data:DataPoint[]=[];
  let truth:CaseTruth={leakToilet:false,leakBackground:false,leakIrrigation:false,leakTank:false,noLeak:false};
  const roll=rng();
  if(roll<0.2) truth.leakToilet=true; else if(roll<0.4) truth.leakBackground=true; else if(roll<0.6) truth.leakIrrigation=true; else if(roll<0.8) truth.leakTank=true; else truth.noLeak=true;
  function baseProfile(minOfDay:number){const h=minOfDay/60;let flow=0.2;if(h>=6&&h<=9)flow+=2.0*Math.exp(-Math.pow(h-7.5,2)/1.2);if(h>=18&&h<=22)flow+=1.6*Math.exp(-Math.pow(h-19.5,2)/1.5);flow+=0.2*(Math.random()-0.5);return clamp(flow,0,6);} 
  function toiletSpike(t:number){return (t%2===0)?(0.8+Math.random()*0.6):0;}
  function irrigationLeak(minOfDay:number){if(minOfDay>=120&&minOfDay<=300) return 0.6;return 0;}
  function tankOverflow(minOfDay:number){if(minOfDay>=660&&minOfDay<=840) return 2.5;return 0;}
  function tankOverflowNoise(x:number){ if(x===0) return 0; return x + (Math.random()*0.2-0.1); }
  for(let d=0;d<days;d++){
    for(let s=0;s<stepsPerDay;s++){
      const idx=d*stepsPerDay+s;const mins=s*30;let flow=baseProfile(mins);
      if(truth.leakBackground)flow+=0.5;
      if(truth.leakIrrigation)flow+=irrigationLeak(mins);
      if(truth.leakTank)flow+=tankOverflowNoise(tankOverflow(mins));
      if(truth.leakToilet)flow+=toiletSpike(idx);
      flow=clamp(flow+(Math.random()*0.1),0,8);
      data.push({t:idx,label:`D${d+1} ${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`,flow:+flow.toFixed(2)});
    }
  }
  return{truth,data};
}

// ---------- Feature Extraction ----------
function nightMinFlow(data:DataPoint[]){const perDay:number[]=[];for(let d=0;d<7;d++){const slice=data.slice(d*48+2*2,d*48+8);perDay.push(Math.min(...slice.map(p=>p.flow)));}return+((perDay.reduce((a,b)=>a+b,0))/perDay.length).toFixed(2);} 
function countNightSpikes(data:DataPoint[]){let spikes=0;for(let d=0;d<7;d++){for(let i=d*48+2;i<d*48+10;i++){const p=data[i];if(p&&p.flow>1.2&&data[i-1]&&data[i+1]&&p.flow>data[i-1].flow+0.6&&p.flow>data[i+1].flow+0.6)spikes++;}}return spikes;}
function longestPlateau(data:DataPoint[]){let maxLen=0,cur=0;for(const p of data){if(p.flow>=2.2&&p.flow<=2.8){cur++;maxLen=Math.max(maxLen,cur);}else cur=0;}return maxLen;}

// ---------- Hints & Scoring ----------
function deriveHints(
  avgNightMin: number,
  nightSpikes: number,
  plateauBins: number,
  difficulty: Difficulty
) {
  // Hard: no hints
  if (difficulty === "Hard") return [];

  const hints: string[] = [];
  const isEasy = difficulty === "Easy";
  const isMedium = difficulty === "Medium";

  // General hint (applies to Easy & Medium)
  if (avgNightMin > 0.6) {
    hints.push("Nightline MNF suggests background leak (> 0.6 L/min).");
  }

  // Extra hints only on Easy
  if (isEasy && nightSpikes > 10) {
    hints.push("Frequent night spikes → suspect toilet flapper.");
  }
  if (isEasy && plateauBins > 6) {
    hints.push("Long midday plateau ~2.5 L/min → suspect roof-tank overflow.");
  }
  if (isEasy && avgNightMin > 0.5 && nightSpikes < 3) {
    hints.push("High MNF without spikes → continuous background (pipe) leak.");
  }

  if (hints.length === 0) hints.push("No strong signals — consider options.");
  return hints;
}

function scoreCategory(score:number){
  if(score>=90) return {tier:'Master Detective', color:'bg-emerald-600', sub:'Stellar diagnostics.', emoji:'🎉'};
  if(score>=75) return {tier:'Great Inspector', color:'bg-emerald-500', sub:'Strong call.', emoji:'🥳'};
  if(score>=50) return {tier:'Capable Sleuth', color:'bg-amber-500', sub:'Solid analysis.', emoji:'👍'};
  if(score>=25) return {tier:'Apprentice', color:'bg-orange-500', sub:'Keep refining.', emoji:'🧭'};
  return {tier:'Keep Investigating', color:'bg-rose-600', sub:'Review signals & guide.', emoji:'🔍'};
}

function KPI({title, value, subtitle}:{title:string, value:string, subtitle?:string}){
  return (
    <div className="p-3 rounded-xl bg-slate-50 border">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="text-xl font-bold">{value}</div>
      {subtitle && <div className="text-[11px]">{subtitle}</div>}
    </div>
  );
}
function ScoreBanner({score, detail}:{score:number, detail:ScoreDetail|null}){
  const c = scoreCategory(score);
  return (
    <div className={`rounded-xl text-white p-4 flex flex-col gap-1 ${c.color}`}>
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold flex items-center gap-2"><PartyPopper className="w-5 h-5"/> {c.tier}</div>
        <div className="text-xl font-bold">Score: {score}/100</div>
      </div>
      <div className="text-sm opacity-90">{c.sub} {c.emoji}</div>
      {detail && (
        <div className="text-xs mt-1 flex flex-wrap gap-3 opacity-90">
          <div className="flex items-center gap-1"><Info className="w-3 h-3"/> Correct: <b>{detail.correct}</b></div>
          <div className="flex items-center gap-1"><Info className="w-3 h-3"/> Wrong: <b>{detail.wrong}</b></div>
          <div className="flex items-center gap-1"><Info className="w-3 h-3"/> Tests spent: <b>{detail.spend}</b></div>
        </div>
      )}
    </div>
  );
}
function ScorePlaceholder(){
  return (
    <div className="rounded-xl border p-4 bg-white flex items-center justify-between">
      <div className="text-sm">
        <div className="font-semibold">No score yet</div>
        <div className="text-slate-600">Run a test and submit your hypothesis to see your score.</div>
      </div>
      <div className="text-xs text-slate-500">Tip: Fewer tests = higher score.</div>
    </div>
  );
}

export default function LeakDetective(){
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [seed, setSeed] = useState<number>(Math.floor(Math.random()*1_000_000));
  const [game, setGame] = useState(()=> genCase({seed, difficulty}));
  const {truth, data} = game;

  const [tests, setTests] = useState<TestResult[]>([]);
  const [budget, setBudget] = useState(100);

  const [hToilet, setHToilet] = useState(false);
  const [hBackground, setHBackground] = useState(false);
  const [hIrrigation, setHIrrigation] = useState(false);
  const [hTank, setHTank] = useState(false);
  const [hNoLeak, setHNoLeak] = useState(false);

  const [showTutorial, setShowTutorial] = useState(false);

  const avgNightMin = useMemo(()=> nightMinFlow(data), [data]);
  const nightSpikes = useMemo(()=> countNightSpikes(data), [data]);
  const plateauBins = useMemo(()=> longestPlateau(data), [data]);
  const hints = useMemo(()=> deriveHints(avgNightMin, nightSpikes, plateauBins, difficulty), [avgNightMin, nightSpikes, plateauBins, difficulty]);

  function newCase(nextDifficulty: Difficulty | null = null){
    const d = nextDifficulty ?? difficulty;
    const newSeed = Math.floor(Math.random()*1_000_000);
    setSeed(newSeed);
    setGame(genCase({seed:newSeed, difficulty:d}));
    setTests([]); setBudget(100);
    setHToilet(false); setHBackground(false); setHIrrigation(false); setHTank(false); setHNoLeak(false);
    setVerdict(null); setScore(null); setDetail(null); setParts(null);
  }

  useEffect(()=>{ newCase(difficulty); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [difficulty]);

  function runNightline(){
    const cost=10; if(budget<cost) return; setBudget(b=>b-cost);
    const res = avgNightMin>0.5? 'MNF > 0.5 L/min (possible leak)' : 'MNF ≤ 0.5 L/min (likely no background leak)';
    setTests(t=>[...t, {name:'Nightline MNF', result:res, cost}]);
  }
  function runDye(){
    const cost=15; if(budget<cost) return; setBudget(b=>b-cost);
    const positive = truth.leakToilet ? Math.random()<0.85 : Math.random()<0.1;
    setTests(t=>[...t, {name:'Dye Test (toilet)', result: positive? 'Blue water in bowl → toilet suspect' : 'No dye migration', cost}]);
  }
  function runZoneSubmeter(){
    const cost=18; if(budget<cost) return; setBudget(b=>b-cost);
    const bathroomShare = truth.leakToilet? 0.7 + Math.random()*0.2 : 0.2 + Math.random()*0.2;
    const outdoorShare = truth.leakIrrigation? 0.6 + Math.random()*0.2 : 0.1 + Math.random()*0.2;
    const text = `Night distribution — Bathroom ${(bathroomShare*100).toFixed(0)}% • Outdoor ${(outdoorShare*100).toFixed(0)}%`;
    setTests(t=>[...t, {name:'Zone Submeter', result:text, cost}]);
  }

  const [verdict, setVerdict] = useState<string|null>(null);
  const [score, setScore] = useState<number|null>(null);
  const [detail, setDetail] = useState<ScoreDetail|null>(null);
  const [parts, setParts] = useState<ScoreParts|null>(null);

  function submitVerdict(){
    const guess:CaseTruth = { leakToilet:hToilet, leakBackground:hBackground, leakIrrigation:hIrrigation, leakTank:hTank, noLeak:hNoLeak };
    let raw = 0; let correct=0; let wrong=0; const flags:FlagDelta[]=[];
    const fields:(keyof CaseTruth)[] = ['leakToilet','leakBackground','leakIrrigation','leakTank','noLeak'];
    let exact=true;
    const labels:Record<keyof CaseTruth,string> = {leakToilet:'Toilet flapper leak', leakBackground:'Background leak', leakIrrigation:'Irrigation leak', leakTank:'Roof tank overflow', noLeak:'No leak'};
    for (const f of fields){
      const expected = truth[f]; const chosen = (guess as any)[f] as boolean;
      const delta = expected===chosen ? 10 : -10; raw += delta; if(delta>0) correct++; else { wrong++; exact=false; }
      flags.push({key:f,label:labels[f],expected,chosen,delta});
    }
    const perfectBonus = exact ? 20 : 0; raw += perfectBonus;
    const spend = 100 - budget; const testPenalty = spend * 0.5; raw -= testPenalty;
    const total = normalizeTo100(raw);

    setScore(total); setDetail({correct, wrong, spend});
    setParts({pointsCorrect: correct*10, pointsWrong: -wrong*10, perfectBonus, testPenalty, total, exact, flags});
    setVerdict(`Score ${total}/100`);
  }

const selfTests = useMemo(()=>{
  const out: {name:string, pass:boolean, detail?:string}[] = [];
  const c = genCase({difficulty:'Easy', seed:42});
  out.push({name:'timeseries length 7×48', pass:c.data.length===7*48, detail:String(c.data.length)});
  out.push({name:'clamp bounds', pass: clamp(10,0,5)===5 && clamp(-2,0,5)===0});
  out.push({name:'nightMinFlow number', pass: typeof nightMinFlow(c.data)==='number'});
  out.push({name:'countNightSpikes number', pass: typeof countNightSpikes(c.data)==='number'});
  out.push({name:'longestPlateau number', pass: typeof longestPlateau(c.data)==='number'});

  const d2 = genCase({difficulty:'Medium', seed:7});
  const flags = ['leakToilet','leakBackground','leakIrrigation','leakTank','noLeak'] as const;
  const ones = flags.reduce<number>((sum, f) => sum + ((d2.truth as any)[f] ? 1 : 0), 0);
  out.push({name:'truth one-hot', pass: ones===1, detail:`sum=${ones}`});

  const flows = c.data.map(p=>p.flow);
  out.push({name:'flow ≥ 0', pass: Math.min(...flows) >= 0});
  out.push({name:'flow ≤ 8', pass: Math.max(...flows) <= 8});
  out.push({name:'normalize 70 → 100', pass: normalizeTo100(70)===100});
  out.push({name:'normalize 0 → 0', pass: normalizeTo100(0)===0});
  out.push({name:'normalize −10 → 0', pass: normalizeTo100(-10)===0});
  out.push({name:'normalize 35 → 50', pass: normalizeTo100(35)===50});
  return out;
},[]);


  return (
    <div className="p-6 grid gap-6 xl:grid-cols-3">
      {/* Header */}
      <div className="xl:col-span-3 flex items-center justify-between bg-white/60 border rounded-2xl p-3">
        <div className="flex items-center gap-2 font-semibold text-slate-800"><Bug className="w-5 h-5"/> Leak Detective</div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500 hidden md:block">Difficulty-driven hints • Score out of 100 • Water only</div>
          <Button variant="outline" size="sm" onClick={()=>setShowTutorial(true)}><BookOpen className="w-4 h-4 mr-1"/>Tutorial</Button>
          <Button variant="outline" size="sm" onClick={()=>newCase()}><RefreshCw className="w-4 h-4 mr-1"/>New Case</Button>
        </div>
      </div>

      {/* Chart + KPIs */}
      <Card className="rounded-2xl shadow-lg xl:col-span-2 order-1 xl:order-none">
        <CardContent className="p-4 space-y-4">
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <div className="font-semibold mb-2 flex items-center gap-2"><Droplets className="w-4 h-4"/>Meter Trace (7 days)</div>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" interval={48} />
                  <YAxis label={{ value:'L/min', angle:-90, position:'insideLeft' }}/>
                  <Tooltip/>
                  <ReferenceLine y={0.5} stroke="#22c55e" strokeDasharray="4 4" label={{ value:'MNF 0.5', position:'left' }}/>
                  <ReferenceLine y={2.5} stroke="#f97316" strokeDasharray="4 4" label={{ value:'Tank ~2.5', position:'left' }}/>
                  <Area type="monotone" dataKey="flow" stroke="#3b82f6" fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-3 text-center">
            <KPI title="Avg Night Min" value={`${avgNightMin.toFixed(2)} L/min`} subtitle="1–4 AM avg min"/>
            <KPI title="Night Spikes" value={`${nightSpikes}`} subtitle="High spikes at night (toilet?)"/>
            <KPI title="Longest Plateau" value={`${plateauBins} bins`} subtitle="~30 min per bin (tank?)"/>
          </div>

          {hints.length>0 && (
            <Card className="rounded-xl">
              <CardContent className="p-4 text-xs">
                <div className="font-semibold mb-2 flex items-center gap-2"><Lightbulb className="w-4 h-4"/> Analyst Hints</div>
                <ul className="list-disc pl-5 space-y-1">{hints.map((h,i)=>(<li key={i}>{h}</li>))}</ul>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Left column: case, tests, hypothesis, score, self-tests */}
      <Card className="rounded-2xl shadow-lg xl:col-span-1 order-2 xl:order-none">
        <CardContent className="p-4 space-y-4">
          <div className="p-3 rounded-xl border bg-gradient-to-br from-slate-50 to-white">
            <div className="flex items-center gap-2 font-semibold"><Search className="w-4 h-4"/> Case File</div>
            <div className="mt-2">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v:any)=>setDifficulty(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Hidden leak is randomized for every case. Use tests wisely — you have <b>{budget}</b> points.</div>
            <div className="mt-2">
              <div className="h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-emerald-500" style={{width: `${budget}%`}}/>
              </div>
              <div className="text-[11px] mt-1">Budget remaining: {budget} / 100</div>
            </div>
          </div>

          <div className="p-3 rounded-xl border bg-slate-50">
            <div className="flex items-center gap-2 font-semibold mb-2"><Gauge className="w-4 h-4"/> Investigative Tests</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Button onClick={runNightline} disabled={budget<10}><Droplets className="w-3 h-3 mr-1"/>Nightline (10)</Button>
              <Button onClick={runDye} disabled={budget<15}><FlaskConical className="w-3 h-3 mr-1"/>Dye (15)</Button>
              <Button onClick={runZoneSubmeter} disabled={budget<18}><ShieldAlert className="w-3 h-3 mr-1"/>Zone Submeter (18)</Button>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              <ul className="list-disc pl-5 space-y-1">
                <li><b>Nightline MNF:</b> Measures minimum night flow (01:00–04:00) to detect background leaks.</li>
                <li><b>Dye Test:</b> Add dye to cistern, check if it appears in toilet bowl (toilet flapper leak).</li>
                <li><b>Zone Submeter:</b> Splits household flow (bathroom/outdoor) to isolate irrigation or toilet leaks.</li>
              </ul>
            </div>
            <div className="mt-2 text-xs">
              {tests.length===0? <div className="text-muted-foreground">No tests yet.</div> : (
                <ul className="list-disc pl-5 space-y-1">{tests.map((t,i)=>(<li key={i}><b>{t.name}:</b> {t.result} <span className="text-slate-400">(−{t.cost})</span></li>))}</ul>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl border">
            <div className="flex items-center gap-2 font-semibold"><ListChecks className="w-4 h-4"/> Hypothesis</div>
            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
              <Button variant={hToilet? 'default':'outline'} onClick={()=>{setHToilet(v=>!v); setHNoLeak(false);}}>Toilet flapper leak</Button>
              <Button variant={hBackground? 'default':'outline'} onClick={()=>{setHBackground(v=>!v); setHNoLeak(false);}}>Background leak</Button>
              <Button variant={hIrrigation? 'default':'outline'} onClick={()=>{setHIrrigation(v=>!v); setHNoLeak(false);}}>Irrigation leak</Button>
              <Button variant={hTank? 'default':'outline'} onClick={()=>{setHTank(v=>!v); setHNoLeak(false);}}>Roof tank overflow</Button>
              <Button variant={hNoLeak? 'default':'outline'} onClick={()=>{setHNoLeak(v=>!v); if(!hNoLeak){ setHToilet(false); setHBackground(false); setHIrrigation(false); setHTank(false);} }}>No leak</Button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={submitVerdict}><Target className="w-4 h-4 mr-1"/>Submit Verdict</Button>
            </div>
            {verdict && <div className="text-xs mt-2">{verdict}</div>}
          </div>

          <div className="space-y-3">
            {score===null ? <ScorePlaceholder/> : <ScoreBanner score={score} detail={detail} />}
            {parts && (
              <Card className="rounded-xl border-emerald-200">
                <CardContent className="p-4 text-sm">
                  <div className="font-semibold mb-2">How your score was calculated</div>
                  <div className="text-xs text-slate-600 mb-3">
                    Raw = (+10 × correct) + (−10 × wrong) + (perfect? +20 : 0) − (0.5 × test spend). Displayed = clamp((Raw/70)×100,0,100).
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div>Correct flags: <b>{detail?.correct}</b> → <b>+{parts.pointsCorrect}</b> raw</div>
                      <div>Wrong flags: <b>{detail?.wrong}</b> → <b>{parts.pointsWrong}</b> raw</div>
                      <div>Perfect bonus: <b>{parts.exact? '+20' : '+0'}</b> raw</div>
                      <div>Test penalty: <b>−{parts.testPenalty.toFixed(1)}</b> raw (spend {detail?.spend})</div>
                      <div className="mt-1">Displayed Total: <b>{parts.total}</b> / 100</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium mb-1">Per-flag breakdown</div>
                      <ul className="text-xs space-y-1 list-disc pl-5">
                        {parts.flags.map((f,i)=> (
                          <li key={i} className={f.delta>0? 'text-emerald-700':'text-rose-600'}>
                            {f.label}: expected <b>{String(f.expected)}</b>, you chose <b>{String(f.chosen)}</b> → {f.delta>0? '+10':'−10'} raw
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="rounded-xl">
            <CardContent className="p-4">
              <div className="font-semibold mb-1">Self-tests</div>
              <div className="text-xs text-slate-600 mb-2">
                Quick built-in checks that run in the browser to catch obvious mistakes (length, non-negative flows, feature types, scoring normalization). They do not affect your score — they help verify the simulator is behaving correctly.
              </div>
              <ul className="text-xs list-disc pl-5 space-y-1">
                {selfTests.map((t,i)=> (
                  <li key={i} className={t.pass ? 'text-emerald-700' : 'text-rose-600'}>
                    {t.pass ? 'PASS' : 'FAIL'} — {t.name}{t.detail ? ` • ${t.detail}` : ''}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-lg xl:col-span-3">
        <CardContent className="p-4">
          <div className="font-semibold mb-2">Guide</div>
          <div className="grid md:grid-cols-2 gap-4 text-xs text-slate-700">
            <div>
              <div className="font-medium">Minimum Night Flow (MNF)</div>
              <div>The lowest flow observed between <b>01:00–04:00</b> each day. High MNF (&gt; 0.5 L/min) often indicates hidden leaks.</div>
            </div>
            <div>
              <div className="font-medium">Roof Tank Overflow</div>
              <div>A sustained plateau ~<b>2.5 L/min</b> in the day can indicate roof-tank overflow (float valve issue).</div>
              <div className="mt-1"><b>Heuristic:</b> Detect plateau bins with 2.2 ≤ flow ≤ 2.8; <i>Longest Plateau</i> counts consecutive 30-min bins in that band.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {showTutorial && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="max-w-lg w-full">
            <CardContent className="p-6 space-y-3 text-sm">
              <div className="font-semibold text-lg mb-2">How to Play</div>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Study the 7-day meter chart and KPI indicators.</li>
                <li>Optionally run investigative tests (cost reduces score).</li>
                <li>Form a hypothesis by toggling one or more leak types.</li>
                <li>Submit verdict. Score rewards correct flags, penalizes mistakes and test spend.</li>
                <li>Aim for 100 by getting all flags correct with minimal tests.</li>
              </ol>
              <div className="flex justify-end gap-2 mt-4">
                <Button onClick={()=>setShowTutorial(false)}>Close</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
