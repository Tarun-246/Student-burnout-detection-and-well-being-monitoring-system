const ACCENT="#14b8a6";
const MOODS=[
 {key:"great",emoji:"😄",label:"Great",value:5},
 {key:"good",emoji:"🙂",label:"Good",value:4},
 {key:"neutral",emoji:"😐",label:"Neutral",value:3},
 {key:"low",emoji:"😔",label:"Low",value:2},
 {key:"terrible",emoji:"😞",label:"Very Low",value:1}
];
const MOOD_COLORS={great:"#10b981",good:"#84cc16",neutral:"#94a3b8",low:"#f59e0b",terrible:"#f43f5e"};
const tabs=[["dashboard","⌂","Dashboard"],["checkin","＋","Check-In"],["analytics","▥","Analytics"],["history","◷","History"],["achievements","★","Achievements"]];

let profile=load("profile",null),checkins=load("checkins",[]),meta=load("appMeta",{});
let theme=meta.theme||"dark",hasExported=!!meta.hasExported,activeTab="dashboard",settingsOpen=false;
let charts=[];

function load(k,fallback){try{const v=localStorage.getItem(k);return v===null?fallback:JSON.parse(v)}catch{return fallback}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function clamp(n,min,max){return Math.min(max,Math.max(min,n))}
function formatDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function parseDateStr(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function todayStr(){return formatDate(new Date())}
function pretty(s){return parseDateStr(s).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}
function shortDate(s){return parseDateStr(s).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
function computeScore({mood,stress,studyHours,sleepHours,motivation}){
 const mi=MOODS.find(m=>m.key===mood)||MOODS[2];
 const raw=clamp(stress/10,0,1)*30+clamp((7-sleepHours)/7,0,1)*20+clamp((studyHours-6)/6,0,1)*15+clamp((10-motivation)/10,0,1)*20+clamp((5-mi.value)/5,0,1)*15;
 return Math.round(clamp(raw,0,100));
}
function category(score){return score<=33?"Healthy":score<=66?"Moderate Risk":"High Risk"}
function catClass(c){return c==="Healthy"?"healthy":c==="Moderate Risk"?"moderate":"high"}
function status(c){return c==="Healthy"?"steady":c==="Moderate Risk"?"under strain":"spiking"}
function mood(key){return MOODS.find(m=>m.key===key)||MOODS[2]}
function streaks(){
 if(!checkins.length)return{current:0,longest:0};
 const set=new Set(checkins.map(c=>c.date)),dates=[...set].sort();let longest=1,run=1;
 for(let i=1;i<dates.length;i++){const diff=Math.round((parseDateStr(dates[i])-parseDateStr(dates[i-1]))/86400000);run=diff===1?run+1:1;longest=Math.max(longest,run)}
 let cur=0,d=new Date();d.setHours(0,0,0,0);if(!set.has(formatDate(d)))d.setDate(d.getDate()-1);
 while(set.has(formatDate(d))){cur++;d.setDate(d.getDate()-1)}
 return{current:cur,longest};
}
function recommendations(e){
 const mi=mood(e.mood),f=[
  {b:clamp((7-e.sleepHours)/7,0,1),t:e.sleepHours<6?`You logged ${e.sleepHours}h of sleep. Aim for 7-9h — short sleep is one of the strongest predictors of burnout.`:"Sleep looks reasonable — protect that window."},
  {b:clamp(e.stress/10,0,1),t:e.stress>=7?`Stress is running high (${e.stress}/10). A short walk, a breathing exercise, or talking it through can stop it compounding.`:"Stress is at a manageable level."},
  {b:clamp((e.studyHours-6)/6,0,1),t:e.studyHours>9?`${e.studyHours}h of study today is a lot. Long unbroken sessions hurt retention — try 50-minute blocks with real breaks.`:"Study hours look sustainable."},
  {b:clamp((10-e.motivation)/10,0,1),t:e.motivation<=4?`Motivation is low (${e.motivation}/10). Pick one small, finishable task to rebuild momentum.`:"Motivation looks solid."},
  {b:clamp((5-mi.value)/5,0,1),t:mi.value<=2?"Mood has been low. Worth checking in with a friend, mentor, or counselor if this continues.":"Mood looks stable."}
 ];
 f.sort((a,b)=>b.b-a.b);const top=f.filter(x=>x.b>.3).slice(0,3);return top.length?top.map(x=>x.t):["You're in a healthy range across the board — keep doing what you're doing."];
}
function consistency(){
 if(!checkins.length)return 0;const dates=[...new Set(checkins.map(c=>c.date))].sort(),first=parseDateStr(dates[0]),d=new Date();d.setHours(0,0,0,0);
 return Math.round(dates.length/(Math.round((d-first)/86400000)+1)*100);
}
function healthyWeek(){
 const a=[...checkins].sort((x,y)=>x.date.localeCompare(y.date));let run=0,prev=null;
 for(const c of a){if(c.category!=="Healthy"){run=0;prev=null;continue}if(prev){const diff=Math.round((parseDateStr(c.date)-parseDateStr(prev))/86400000);run=diff===1?run+1:1}else run=1;prev=c.date;if(run>=7)return true}return false
}
function exportFile(name,text,type){const a=document.createElement("a"),url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
function csv(){
 const h=["date","mood","stress","studyHours","sleepHours","motivation","score","category","notes"];
 return [h.join(","),...checkins.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(c=>h.map(k=>`"${String(c[k]??"").replace(/"/g,'""')}"`).join(","))].join("\n")
}
function pulseSVG(score){
 const w=360,h=110,mid=h/2,amp=h*.12+(score/100)*h*.32,freq=2+(score/100)*5,jag=score/100;let d="";
 for(let i=0;i<=48;i++){const x=i/48*w,t=i/48*Math.PI*2*freq,s=Math.sin(t),sh=Math.sign(s)*Math.pow(Math.abs(s),.4),y=mid-(s*(1-jag)+sh*jag)*amp;d+=(i?"L":"M")+x.toFixed(1)+","+y.toFixed(1)+" "}
 return `<svg class="pulse" viewBox="0 0 ${w} ${h}"><line x1="0" y1="${mid}" x2="${w}" y2="${mid}" stroke="${theme==="dark"?"#1e293b":"#e2e8f0"}" stroke-dasharray="4 4"/><path d="${d}" fill="none" stroke="${category(score)==="Healthy"?"#10b981":category(score)==="Moderate Risk"?"#f59e0b":"#f43f5e"}" stroke-width="3" stroke-linecap="round"/></svg>`
}
function logo(){return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M2 12h4l2-7 4 14 3-9 2 5h5" stroke="${ACCENT}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
function stat(label,value,icon){return `<div class="stat"><div class="stat-label">${icon||""} ${label}</div><div class="stat-value mono">${value}</div></div>`}
function empty(title,msg,action){return `<div class="card empty"><div style="font-size:28px">⚡</div><h3 class="font-display" style="margin-top:10px">${title}</h3><p class="sub">${msg}</p>${action?`<button class="primary" onclick="goCheckin()">${action}</button>`:""}</div>`}

function onboarding(){
 return `<div class="onboard"><div class="card onboard-card"><div class="center">${logo()}<h1 class="font-display" style="margin-top:10px">Welcome to Vital</h1><p class="sub">A few details, then you're tracking.</p></div>
 <div class="field" style="margin-top:24px"><label class="sub">Name</label><input id="obName" class="text-input" placeholder="Your name"></div>
 <div class="field"><label class="sub">Course</label><input id="obCourse" class="text-input" placeholder="e.g. B.E. Computer Science"></div>
 <div class="field"><label class="sub">Academic year</label><select id="obYear"><option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option><option>Postgraduate</option></select></div>
 <button class="primary" onclick="saveOnboarding()">Start tracking</button></div></div>`
}
function saveOnboarding(){const name=document.getElementById("obName").value.trim();if(!name)return alert("Please enter your name.");profile={name,course:document.getElementById("obCourse").value.trim(),year:document.getElementById("obYear").value};save("profile",profile);render()}

function topbar(){
 const s=streaks();return `<header class="topbar"><div class="container topbar-inner"><div class="logo">${logo()}<span>Vital</span></div><div class="top-actions"><div class="streak">🔥 ${s.current}</div><button class="icon-btn" onclick="toggleTheme()">${theme==="dark"?"☀":"☾"}</button><button class="icon-btn" onclick="openSettings()">⚙</button></div></div></header>`
}
function nav(){return `<div class="tabs"><div class="container tab-row">${tabs.map(t=>`<button class="tab ${activeTab===t[0]?"active":""}" onclick="setTab('${t[0]}')">${t[1]} ${t[2]}</button>`).join("")}</div></div>`}

function dashboard(){
 if(!checkins.length)return empty("No check-in yet","Log today's mood, sleep, and stress to see your first reading.","Log today's check-in");
 const latest=checkins.slice().sort((a,b)=>b.date.localeCompare(a.date))[0],prev=checkins.slice().sort((a,b)=>b.date.localeCompare(a.date))[1]||null;
 const c=category(latest.score),mi=mood(latest.mood),s=streaks(),recs=recommendations(latest);
 return `<div class="space"><div><h2 class="font-display">${escape(profile.name.split(" ")[0]||"there")}</h2><p class="sub">${pretty(latest.date)} · Reading: ${status(c)}</p></div>
 ${latest.date!==todayStr()?`<div class="notice" onclick="goCheckin()" style="cursor:pointer">You haven't checked in today — this reading is from ${pretty(latest.date)}. <b>Log now →</b></div>`:""}
 ${(c==="High Risk"||(prev&&latest.score-prev.score>=15))?`<div class="alert">⚠ Today's reading jumped. Worth slowing down — check the notes below and take a real break if you can.</div>`:""}
 <div class="grid dashboard-grid"><div class="card pulse-card">${pulseSVG(latest.score)}<div class="score mono">${latest.score}<span class="sub"> / 100</span></div><span class="badge ${catClass(c)}">${c}</span></div>
 <div class="grid stats">${stat("Mood",mi.emoji+" "+mi.label)}${stat("Stress",latest.stress+"/10","⚠")}${stat("Sleep",latest.sleepHours+"h","☾")}${stat("Study",latest.studyHours+"h","▣")}${stat("Motivation",latest.motivation+"/10","⚡")}${stat("Streak",s.current+"d","🔥")}</div></div>
 <div class="card recs"><h3 class="font-display">ⓘ What might help today</h3><ul>${recs.map(r=>`<li>${escape(r)}</li>`).join("")}</ul></div>
 <div class="card"><h3 class="font-display">Last 7 check-ins</h3><div class="chart-wrap small"><canvas id="dashChart"></canvas></div></div></div>`
}

function checkin(){
 const e=checkins.find(c=>c.date===todayStr()),d=e||{mood:"neutral",stress:5,studyHours:4,sleepHours:7,motivation:6,notes:""};
 return `<div class="space form"><div><h2 class="font-display">${e?"Update today's check-in":"Today's check-in"}</h2><p class="sub">${pretty(todayStr())}</p></div>
 <form class="card" onsubmit="submitCheckin(event)"><div class="field"><label>Mood</label><div class="moods">${MOODS.map(m=>`<button type="button" class="mood ${d.mood===m.key?"selected":""}" data-mood="${m.key}" onclick="selectMood(this)"><span class="emoji">${m.emoji}</span><span class="mood-name">${m.label}</span></button>`).join("")}</div></div>
 ${rangeField("stress","Stress level",d.stress,1,10,1,"/10","Calm","Overwhelmed")}
 ${rangeField("motivation","Motivation",d.motivation,1,10,1,"/10","Drained","Energized")}
 ${rangeField("sleepHours","Sleep duration",d.sleepHours,0,12,.5,"h","0h","12h")}
 ${rangeField("studyHours","Study hours",d.studyHours,0,14,.5,"h","0h","14h")}
 <div class="field"><label>Notes <span class="sub">(optional)</span></label><textarea id="notes" rows="3" maxlength="500" placeholder="Anything on your mind today?">${escape(d.notes||"")}</textarea></div>
 <div id="preview" class="notice"></div><button class="primary">${e?"Update today's check-in":"Log today's check-in"}</button></form></div>`
}
function rangeField(id,label,val,min,max,step,unit,minL,maxL){return `<div class="field"><div class="field-head"><label>${label}</label><span class="mono" id="${id}Val">${val}${unit}</span></div><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}" oninput="updatePreview()"><div class="range-labels"><span>${minL}</span><span>${maxL}</span></div></div>`}
function selectMood(btn){document.querySelectorAll(".mood").forEach(x=>x.classList.remove("selected"));btn.classList.add("selected");updatePreview()}
function selectedMood(){return document.querySelector(".mood.selected")?.dataset.mood||"neutral"}
function updatePreview(){const data={mood:selectedMood(),stress:+document.getElementById("stress").value,studyHours:+document.getElementById("studyHours").value,sleepHours:+document.getElementById("sleepHours").value,motivation:+document.getElementById("motivation").value};const s=computeScore(data),c=category(s);const p=document.getElementById("preview");if(p)p.innerHTML=`Today's reading <b>${s} · ${c}</b>`}
function submitCheckin(ev){ev.preventDefault();const data={mood:selectedMood(),stress:+stress.value,studyHours:+studyHours.value,sleepHours:+sleepHours.value,motivation:+motivation.value,notes:notes.value.trim()};const date=todayStr(),score=computeScore(data),cat=category(score),idx=checkins.findIndex(c=>c.date===date);if(idx>=0)checkins[idx]={...checkins[idx],...data,score,category:cat};else checkins.push({id:date+"_"+Date.now(),date,createdAt:new Date().toISOString(),...data,score,category:cat});save("checkins",checkins);activeTab="dashboard";render()}

function analytics(){
 if(!checkins.length)return empty("Nothing to chart yet","Your trends will appear here after a few check-ins.","Log today's check-in");
 const range=window.analyticsRange||"month",days=range==="week"?7:30,cut=new Date();cut.setHours(0,0,0,0);cut.setDate(cut.getDate()-(days-1));
 const data=(range==="all"?checkins:checkins.filter(c=>parseDateStr(c.date)>=cut)).slice().sort((a,b)=>a.date.localeCompare(b.date));
 if(!data.length)return `<div class="space"><div class="range-buttons">${rangeBtns(range)}</div><p class="sub">No check-ins in this period.</p></div>`;
 const avg=k=>Math.round(data.reduce((s,c)=>s+c[k],0)/data.length*10)/10;
 const half=Math.floor(data.length/2),trend=k=>data.length<4?0:Math.round((data.slice(half).reduce((s,c)=>s+c[k],0)/(data.length-half)-data.slice(0,half).reduce((s,c)=>s+c[k],0)/half)*10)/10;
 const counts=Object.fromEntries(MOODS.map(m=>[m.key,0]));data.forEach(c=>counts[c.mood]=(counts[c.mood]||0)+1);
 return `<div class="space"><div class="range-buttons">${rangeBtns(range)}</div><div class="grid summary">${summary("Avg burnout score",avg("score"),trend("score"),true)}${summary("Avg sleep",avg("sleepHours")+"h",trend("sleepHours"))}${summary("Avg study",avg("studyHours")+"h",trend("studyHours"))}${summary("Check-ins",data.length)}</div>
 <div class="card"><h3>Burnout score trend</h3><div class="chart-wrap"><canvas id="scoreChart"></canvas></div></div>
 <div class="card"><h3>Stress & motivation (1-10)</h3><div class="chart-wrap"><canvas id="stressChart"></canvas></div></div>
 <div class="card"><h3>Sleep & study hours</h3><div class="chart-wrap"><canvas id="hoursChart"></canvas></div></div>
 <div class="card"><h3>Mood distribution</h3><div class="chart-wrap small"><canvas id="moodChart"></canvas></div><div>${MOODS.map(m=>`<div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin:4px 0"><span>${m.emoji} ${m.label}</span><b>${counts[m.key]}</b></div>`).join("")}</div></div></div>`
}
function rangeBtns(active){return [["week","Week"],["month","Month"],["all","All time"]].map(x=>`<button class="range-btn ${active===x[0]?"active":""}" onclick="window.analyticsRange='${x[0]}';render()">${x[1]}</button>`).join("")}
function summary(label,value,t=0,inverse=false){return `<div class="stat"><div class="stat-label">${label}</div><div><span class="stat-value mono">${value}</span>${t?` <small style="color:${inverse?(t>0?"#f43f5e":"#10b981"):"#64748b"}">${t>0?"↑":"↓"}${Math.abs(t)}</small>`:""}</div></div>`}

function history(){
 if(!checkins.length)return empty("No entries yet","Check in once and it'll show up here.","Log today's check-in");
 const q=window.historyQ||"",filter=window.historyFilter||"all";
 let list=checkins.slice();if(filter!=="all")list=list.filter(c=>c.category===filter);if(q)list=list.filter(c=>(c.notes||"").toLowerCase().includes(q.toLowerCase())||c.date.includes(q));list.sort((a,b)=>b.date.localeCompare(a.date));
 return `<div class="space"><div class="filters"><input class="text-input" value="${escape(q)}" oninput="window.historyQ=this.value;render()" placeholder="Search notes or date..."><select class="text-input" style="width:auto" onchange="window.historyFilter=this.value;render()"><option value="all">All categories</option><option>Healthy</option><option>Moderate Risk</option><option>High Risk</option></select></div><div class="space">${list.length?list.map(historyRow).join(""):`<p class="sub">No entries match your search.</p>`}</div></div>`
}
function historyRow(e){const mi=mood(e.mood),cc=catClass(e.category);return `<div class="history-row"><div class="history-top"><div class="history-info"><span class="history-emoji">${mi.emoji}</span><div><b>${pretty(e.date)}</b><div class="history-meta">Stress ${e.stress}/10 · Sleep ${e.sleepHours}h · Study ${e.studyHours}h · Motivation ${e.motivation}/10</div></div></div><div><span class="badge ${cc}" style="margin:0">${e.score} · ${e.category}</span> <button class="delete" onclick="deleteEntry('${e.id}')">🗑</button></div></div>${e.notes?`<p class="history-meta" style="margin-top:12px;font-size:14px">${escape(e.notes)}</p>`:""}</div>`}
function deleteEntry(id){if(confirm("Delete this entry? This can't be undone.")){checkins=checkins.filter(c=>c.id!==id);save("checkins",checkins);render()}}

function achievements(){
 const s=streaks(),items=[
 ["★","First Step","Log your first check-in",checkins.length>=1],
 ["🔥","Getting Consistent","Reach a 3-day logging streak",s.longest>=3],
 ["🔥","Week Warrior","Reach a 7-day streak",s.longest>=7],
 ["🔥","Consistency Champion","Reach a 30-day streak",s.longest>=30],
 ["✓","Building the Habit","Log 10 check-ins",checkins.length>=10],
 ["✓","Fifty Strong","Log 50 check-ins",checkins.length>=50],
 ["✦","Healthy Week","Log 7 straight healthy days",healthyWeek()],
 ["⇩","Data Explorer","Export your check-in history",hasExported]
 ];
 const unlocked=items.filter(x=>x[3]).length;
 return `<div class="space"><div class="card"><h3 class="font-display">Your progress</h3><p class="sub">${unlocked} of ${items.length} badges unlocked</p><div class="grid summary" style="margin-top:16px">${summary("Current streak",s.current+"d")}${summary("Longest streak",s.longest+"d")}${summary("Consistency",consistency()+"%")}${summary("Total check-ins",checkins.length)}</div></div><div class="grid ach-grid">${items.map(x=>`<div class="achievement ${x[3]?"":"locked"}"><div class="ach-icon">${x[3]?x[0]:"🔒"}</div><div><b>${x[1]}</b><p class="sub">${x[2]}</p></div></div>`).join("")}</div></div>`
}
function settings(){
 return `<div class="settings"><div class="overlay" onclick="closeSettings()"></div><aside class="drawer"><div style="display:flex;justify-content:space-between;align-items:center"><h3 class="font-display">Settings</h3><button class="icon-btn" onclick="closeSettings()">✕</button></div>
 <div class="drawer-section"><h4>Profile</h4><input id="setName" class="text-input" value="${escape(profile.name)}" placeholder="Name"><input id="setCourse" class="text-input" value="${escape(profile.course||"")}" placeholder="Course"><select id="setYear" class="text-input">${["1st Year","2nd Year","3rd Year","4th Year","Postgraduate"].map(y=>`<option ${profile.year===y?"selected":""}>${y}</option>`).join("")}</select><button class="primary" style="margin-top:8px" onclick="saveSettings()">Save profile</button></div>
 <div class="drawer-section"><h4>Appearance</h4><button class="secondary" onclick="toggleTheme()">${theme==="dark"?"☀ Switch to light mode":"☾ Switch to dark mode"}</button></div>
 <div class="drawer-section"><h4>Export data</h4><div class="drawer-actions"><button class="secondary" onclick="doExport('json')">⇩ JSON</button><button class="secondary" onclick="doExport('csv')">⇩ CSV</button></div></div></aside></div>`
}
function saveSettings(){profile={...profile,name:document.getElementById("setName").value.trim()||profile.name,course:document.getElementById("setCourse").value.trim(),year:document.getElementById("setYear").value};save("profile",profile);settingsOpen=false;render()}
function doExport(f){if(f==="json")exportFile("vital-checkins.json",JSON.stringify(checkins,null,2),"application/json");else exportFile("vital-checkins.csv",csv(),"text/csv");hasExported=true;meta={...meta,theme,hasExported:true};save("appMeta",meta);render()}
function toggleTheme(){theme=theme==="dark"?"light":"dark";meta={...meta,theme,hasExported};save("appMeta",meta);render()}
function openSettings(){settingsOpen=true;render()}function closeSettings(){settingsOpen=false;render()}function setTab(t){activeTab=t;render()}function goCheckin(){activeTab="checkin";render()}

function render(){
 document.body.className=theme;
 const root=document.getElementById("app");
 if(!profile){root.innerHTML=onboarding();return}
 let view=activeTab==="dashboard"?dashboard():activeTab==="checkin"?checkin():activeTab==="analytics"?analytics():activeTab==="history"?history():achievements();
 root.innerHTML=`<div class="vt-root">${topbar()}${nav()}<main class="container">${view}<p class="footer">Vital is a self-check-in tool, not a diagnosis. If things feel heavier than usual, talk to a counselor, mentor, or someone you trust.</p></main>${settingsOpen?settings():""}</div>`;
 requestAnimationFrame(drawCharts);
}
function chartBase(){return{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:theme==="dark"?"#cbd5e1":"#475569"}}},scales:{x:{ticks:{color:theme==="dark"?"#94a3b8":"#64748b"},grid:{color:theme==="dark"?"#1e293b":"#e2e8f0"}},y:{ticks:{color:theme==="dark"?"#94a3b8":"#64748b"},grid:{color:theme==="dark"?"#1e293b":"#e2e8f0"}}}}}
function makeChart(id,type,data,datasets,options={}){const el=document.getElementById(id);if(!el)return;charts.push(new Chart(el,{type,data:{labels:data.map(c=>shortDate(c.date)),datasets},options:{...chartBase(),...options}}))}
function drawCharts(){
 charts.forEach(c=>c.destroy());charts=[];
 if(activeTab==="dashboard"&&checkins.length>1){const d=checkins.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-7);makeChart("dashChart","line",d,[{label:"Score",data:d.map(c=>c.score),borderColor:ACCENT,backgroundColor:"#14b8a622",fill:true,tension:.35}],{plugins:{legend:{display:false}},scales:{y:{min:0,max:100,display:false},x:{display:true}}})}
 if(activeTab==="analytics"&&checkins.length){
  const range=window.analyticsRange||"month",days=range==="week"?7:30,cut=new Date();cut.setHours(0,0,0,0);cut.setDate(cut.getDate()-(days-1));const d=(range==="all"?checkins:checkins.filter(c=>parseDateStr(c.date)>=cut)).slice().sort((a,b)=>a.date.localeCompare(b.date));
  makeChart("scoreChart","line",d,[{label:"Score",data:d.map(c=>c.score),borderColor:ACCENT,backgroundColor:"transparent",tension:.35}]);
  makeChart("stressChart","line",d,[{label:"Stress",data:d.map(c=>c.stress),borderColor:"#f43f5e",tension:.35},{label:"Motivation",data:d.map(c=>c.motivation),borderColor:"#10b981",tension:.35}],{scales:{y:{min:0,max:10}}});
  makeChart("hoursChart","bar",d,[{label:"Sleep (h)",data:d.map(c=>c.sleepHours),backgroundColor:"#38bdf8"},{label:"Study (h)",data:d.map(c=>c.studyHours),backgroundColor:"#a78bfa"}]);
  const counts=Object.fromEntries(MOODS.map(m=>[m.label,0]));d.forEach(c=>counts[mood(c.mood).label]++);
  makeChart("moodChart","doughnut",Object.keys(counts).map((label,i)=>({date:label})),[{data:Object.values(counts),backgroundColor:MOODS.map(m=>MOOD_COLORS[m.key]),borderWidth:0}],{plugins:{legend:{position:"bottom"}}});
 }
}
function escape(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
render();
