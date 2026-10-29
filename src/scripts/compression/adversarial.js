(() => {
  const root = document.querySelector('#adversarial-results');
  if (!root) return;
  const families = {mirror:'Mirror', periodic:'Periodic', phrase_bank:'Phrase bank', topk_iid:'Top-k IID'};
  const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
  const format = value => Number(value).toFixed(4);
  const signed = value => `${value > 0 ? '+' : ''}${format(value)}`;
  const tick = value => Number(value.toPrecision(3)).toString();
  const table = (headers, rows) => `<table><thead><tr>${headers.map(value=>`<th scope="col">${escape(value)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const status = document.querySelector('#adversarial-status');
  const detail = document.querySelector('#adversarial-detail');

  function pointLabel(row, metric, metadata) {
    return `${metadata.name} · ${families[row.parameters.kind]} · size ${row.parameters.size} · seed ${row.parameters.seed} · score ${format(row.scores[metric])} · real control ${format(metadata.control)} · margin ${signed(row.margins[metric])} ${metadata.units}`;
  }

  function panel(data, metric, metadata) {
    const margins = data.points.map(row=>row.margins[metric]);
    const low = Math.min(0,...margins), high = Math.max(0,...margins);
    const padding = Math.max(high-low, .001)*.08;
    const minimum = low-padding, maximum = high+padding;
    const horizontal = value => 94+(value-minimum)/(maximum-minimum)*292;
    const above = margins.filter(value=>value>0).length;
    let svg = `<svg viewBox="0 0 410 266" role="img" aria-label="${escape(metadata.name)}: ${above} of 73 configurations above the real control"><title>${escape(metadata.name)} margins by sampler family</title>`;
    for (let index=0;index<4;index++) {
      const vertical = 51+index*46;
      svg += `<line class="chart-grid" x1="94" x2="386" y1="${vertical}" y2="${vertical}"/><text class="chart-label" x="84" y="${vertical+4}" text-anchor="end">${families[data.families[index]]}</text>`;
    }
    svg += `<line class="adversarial-zero" x1="${horizontal(0)}" x2="${horizontal(0)}" y1="27" y2="215"/><text class="chart-label" x="${horizontal(0)}" y="18" text-anchor="middle">0</text>`;
    for (let index=0; index<=3; index++) {
      const value=minimum+(maximum-minimum)*index/3;
      svg += `<text class="chart-label" x="${horizontal(value)}" y="238" text-anchor="middle">${tick(value)}</text>`;
    }
    svg += '<text class="chart-label" x="240" y="261" text-anchor="middle">Score − real control</text>';
    for (const [familyIndex, family] of data.families.entries()) {
      const rows=data.points.filter(row=>row.parameters.kind===family);
      const vertical=51+familyIndex*46;
      for (const [index,row] of rows.entries()) {
        const jitter=((index*3)%7-3)*3;
        const label=pointLabel(row,metric,metadata);
        svg += `<circle class="adversarial-point ${row.margins[metric]<0?'negative':'positive'}" cx="${horizontal(row.margins[metric])}" cy="${vertical+jitter}" r="4" tabindex="0" role="img" aria-label="${escape(label)}"><title>${escape(label)}</title></circle>`;
      }
      const position=horizontal(metadata.families[family].median);
      svg += `<line class="adversarial-median" x1="${position}" x2="${position}" y1="${vertical-16}" y2="${vertical+16}"><title>Median margin: ${signed(metadata.families[family].median)}</title></line>`;
    }
    return `<section class="adversarial-panel" data-metric="${metric}"><h4>${escape(metadata.name)} <span>${above}/73 above</span></h4><div class="adversarial-meta">${escape(metadata.units)} · real control ${format(metadata.control)}<br>${escape(metadata.samples)}</div><div class="adversarial-plot">${svg}</svg></div></section>`;
  }

  fetch('/data/compression-as-evaluation/adversarial.json').then(response=>{
    if (!response.ok) throw new Error('Data unavailable');
    return response.json();
  }).then(data=>{
    status.textContent = '73 configurations · 6 metrics · separate scales · observed margins, not significance tests';
    document.querySelector('#adversarial-panels').innerHTML=Object.entries(data.metrics).map(([metric,metadata])=>panel(data,metric,metadata)).join('');
    for (const point of root.querySelectorAll('.adversarial-point')) {
      for (const event of ['mouseenter','focus','click']) point.addEventListener(event,()=>{ detail.textContent=point.getAttribute('aria-label'); });
    }
    const selector=document.querySelector('#adversarial-metric');
    function updateTables() {
      const metric=selector.value, metadata=data.metrics[metric];
      document.querySelector('#adversarial-summary').innerHTML=table(['Sampler','Above control','Minimum Δ','Median Δ','Maximum Δ'],data.families.map(family=>{
        const summary=metadata.families[family];
        return [families[family],`${summary.above}/${summary.count}`,signed(summary.minimum),signed(summary.median),signed(summary.maximum)];
      }));
      document.querySelector('#adversarial-points').innerHTML=table(['Sampler','Bank/vocab size','Seed','Score','Real control','Margin Δ'],data.points.map(row=>[families[row.parameters.kind],row.parameters.size,row.parameters.seed,format(row.scores[metric]),format(metadata.control),signed(row.margins[metric])]));
    }
    selector.addEventListener('change',updateTables);
    updateTables();
  }).catch(()=>{ status.textContent='Unable to load plots. Download the saved scores below or reload to retry.'; });
})();
