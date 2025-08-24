"use client";
{selfTests.map((t,i)=> <li key={i} className={t.pass? 'text-emerald-700':'text-rose-600'}>{t.pass? 'PASS':'FAIL'} — {t.name}{t.detail? ` • ${t.detail}`:''}</li>)}
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
<div>A sustained plateau ~<b>2.5 L/min</b> in the day can indicate roof‑tank overflow (float valve issue).</div>
<div className="mt-1"><b>Heuristic:</b> Detect plateau bins with 2.2 ≤ flow ≤ 2.8; <i>Longest Plateau</i> counts consecutive 30‑min bins in that band.</div>
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
<li>Study the 7‑day meter chart and KPI indicators.</li>
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
