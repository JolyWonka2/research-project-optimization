const RI = {1:0,2:0,3:0.58,4:0.90,5:1.12,6:1.24,7:1.32,8:1.41,9:1.45};

export function ahpWeights(matrix) {
  const n = matrix.length;
  if (!n || matrix.some(r => r.length !== n)) throw new Error('Матриця має бути квадратною.');
  const gm = matrix.map(row => Math.pow(row.reduce((p,v)=>p*Number(v),1),1/n));
  const sum = gm.reduce((a,b)=>a+b,0);
  const weights = gm.map(v=>v/sum);
  const aw = matrix.map(row=>row.reduce((s,v,j)=>s+Number(v)*weights[j],0));
  const lambda = aw.reduce((s,v,i)=>s+v/weights[i],0)/n;
  const ci = n > 2 ? (lambda-n)/(n-1) : 0;
  const cr = n > 2 ? ci/(RI[n] || 1.45) : 0;
  return {weights, lambdaMax:lambda, consistencyIndex:ci, consistencyRatio:Math.max(0,cr)};
}

export function calculatePortfolio({projects, matrix, reliability=0.9, uncertainty=0.1, strategicWeights, limits}) {
  const classic = ahpWeights(matrix);
  const strategic = strategicWeights?.length === classic.weights.length ? strategicWeights : classic.weights;
  const strategicSum = strategic.reduce((a,b)=>a+Number(b),0) || 1;
  const normalizedStrategic = strategic.map(v=>Number(v)/strategicSum);
  const confidence = Math.max(0,Math.min(1,Number(reliability)))*(1-Math.max(0,Math.min(1,Number(uncertainty))));
  const modified = classic.weights.map((w,i)=>confidence*w+(1-confidence)*normalizedStrategic[i]);
  const modSum = modified.reduce((a,b)=>a+b,0);
  const modifiedWeights = modified.map(v=>v/modSum);
  const maxScore = 9;
  const ranked = projects.map(p=>{
    const raw = p.scores.reduce((s,v,i)=>s+Number(v)*modifiedWeights[i],0);
    const classicScore = p.scores.reduce((s,v,i)=>s+Number(v)*classic.weights[i],0);
    return {...p, priority:raw/maxScore, classicPriority:classicScore/maxScore, utility:raw};
  });

  // Exact enumeration of binary project-selection decisions. This is suitable for
  // the small/medium project registers used in coursework demonstrations.
  if (projects.length > 22) throw new Error('Для точного перебору додайте не більше 22 проєктів.');
  const budget=Number(limits.budget), staff=Number(limits.staff), equipment=Number(limits.equipment);
  let best=null;
  const total=1<<ranked.length;
  for(let mask=0;mask<total;mask++){
    let cost=0,people=0,gear=0,utility=0,selected=[]; let valid=true;
    for(let i=0;i<ranked.length;i++) if(mask&(1<<i)){
      const p=ranked[i]; cost+=Number(p.budget); people+=Number(p.staff); gear+=Number(p.equipment); utility+=p.priority; selected.push(p.id);
      if(cost>budget || people>staff || gear>equipment){valid=false;break;}
    }
    if(!valid) continue;
    for(const pair of (limits.conflicts||[])) if(selected.includes(pair[0])&&selected.includes(pair[1])) {valid=false;break;}
    if(valid && (!best || utility>best.utility)) best={selected,cost,people,equipment:gear,utility};
  }
  if(!best) best={selected:[],cost:0,people:0,equipment:0,utility:0};
  const resultProjects=ranked.map(p=>({...p,selected:best.selected.includes(p.id),recommendedFunding:best.selected.includes(p.id)?Number(p.budget):0}));
  const directions={};
  for(const p of resultProjects) directions[p.direction]=(directions[p.direction]||0)+p.recommendedFunding;
  return {classicWeights:classic.weights,modifiedWeights,consistencyRatio:classic.consistencyRatio,lambdaMax:classic.lambdaMax,
    reliability:Number(reliability),uncertainty:Number(uncertainty),confidence,projects:resultProjects,
    portfolio:{...best,utilization:budget?best.cost/budget:0},fundingByDirection:Object.entries(directions).map(([name,value])=>({name,value})),
    comparison:{classic:ranked.map(p=>({id:p.id,name:p.name,priority:p.classicPriority})),modified:ranked.map(p=>({id:p.id,name:p.name,priority:p.priority}))}};
}

export function buildMarkdown(payload, result) {
  const {projects,criteria,limits}=payload;
  const lines=['# Звіт з оптимізації портфеля наукових проєктів','',`Дата формування: ${new Date().toLocaleDateString('uk-UA')}`,'','## 1. Критерії оцінювання','',
    '| Критерій | Вага класичного МАІ | Вага модифікованого МАІ |','|---|---:|---:|'];
  criteria.forEach((c,i)=>lines.push(`| ${c} | ${result.classicWeights[i].toFixed(4)} | ${result.modifiedWeights[i].toFixed(4)} |`));
  lines.push('',`Коефіцієнт узгодженості CR: ${result.consistencyRatio.toFixed(4)}.`,
    `Надійність експертного оцінювання: ${result.reliability}. Невизначеність: ${result.uncertainty}.`,'','## 2. Реєстр наукових проєктів','',
    '| Проєкт | Напрям | Бюджет | Тривалість | Дослідники | Обладнання | Пріоритет |','|---|---|---:|---:|---:|---:|---:|');
  projects.forEach(p=>lines.push(`| ${p.name} | ${p.direction} | ${p.budget} | ${p.duration} | ${p.staff} | ${p.equipment} | ${(result.projects.find(x=>x.id===p.id)?.priority||0).toFixed(4)} |`));
  lines.push('','## 3. Обмеження оптимізаційної моделі','',`- Бюджет: ${limits.budget}`,
    `- Доступні дослідники: ${limits.staff}`,`- Доступне обладнання: ${limits.equipment}`,
    `- Конфліктні пари проєктів: ${(limits.conflicts||[]).length}`,'','## 4. Рекомендований портфель','',
    '| Проєкт | Рішення | Рекомендоване фінансування |','|---|---|---:|');
  result.projects.forEach(p=>lines.push(`| ${p.name} | ${p.selected?'Відібрано':'Не відібрано'} | ${p.recommendedFunding} |`));
  lines.push('',`Сумарне фінансування: ${result.portfolio.cost}.`,
    `Використано дослідників: ${result.portfolio.people}.`,
    `Використано обладнання: ${result.portfolio.equipment}.`,
    `Сумарна корисність портфеля: ${result.portfolio.utility.toFixed(4)}.`,
    `Використання бюджету: ${(result.portfolio.utilization*100).toFixed(1)}%.`,'','## 5. Обґрунтування','',
    'До портфеля включено проєкти, що забезпечують найбільшу сумарну зважену корисність за умови дотримання бюджетних, кадрових та обладнаннєвих обмежень. Конфліктні проєкти не можуть фінансуватися одночасно.');
  return lines.join('\n');
}
