(() => {
  const root = document.querySelector('#downstream-results');
  if (!root) return;
  const names = {t07:'T = 0.7', t10:'T = 1.0', 't10-p095':'T = 1.0 · p = .95', 't10-k20':'T = 1.0 · k = 20', t13:'T = 1.3'};
  const sizes = {'160m':'160M', '410m':'410M', '1b':'1B', '6.9b':'6.9B'};
  // Site viz tokens, so the series follow the light/dark theme.
  const colors = ['var(--viz-duo)', 'var(--viz-accent2)', 'var(--viz-accent)', 'var(--viz-good)'];
  const format = value => Number(value).toFixed(3);
  const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
  const status = document.querySelector('#downstream-status');

  function marker(index, horizontal, vertical, radius = 5) {
    if (index === 1) return `<rect x="${horizontal-radius}" y="${vertical-radius}" width="${radius*2}" height="${radius*2}"/>`;
    if (index === 2) return `<path d="M${horizontal} ${vertical-radius*1.3}l${radius*1.2} ${radius*2.3}h${-radius*2.4}Z"/>`;
    if (index === 3) return `<path d="M${horizontal} ${vertical-radius*1.3}l${radius*1.3} ${radius*1.3}l${-radius*1.3} ${radius*1.3}l${-radius*1.3} ${-radius*1.3}Z"/>`;
    return `<circle cx="${horizontal}" cy="${vertical}" r="${radius}"/>`;
  }

  function chart(data, rows, mode, metric) {
    const metadata = data.metrics[metric];
    const scatter = mode === 'scatter';
    const accuracy = mode !== 'distance';
    const width = scatter ? 780 : 390;
    const height = scatter ? 350 : 300;
    const left = 58, right = 24, top = 32, bottom = 48;
    const distanceMaximum = Math.ceil(Math.max(...data.points.map(row => row.scores[metric]))*10)/10;
    const distanceMinimum = Math.min(0, Math.floor(Math.min(...data.points.map(row => row.scores[metric]))*10)/10);
    const accuracyMinimum = Math.floor(Math.min(...data.points.map(row => row.accuracy))*10)/10;
    const accuracyMaximum = Math.ceil(Math.max(...data.points.map(row => row.accuracy))*10)/10;
    const horizontalMaximum = scatter ? distanceMaximum : 143000;
    const horizontalMinimum = scatter ? distanceMinimum : 0;
    const verticalMinimum = accuracy ? accuracyMinimum : distanceMinimum;
    const verticalMaximum = accuracy ? accuracyMaximum : distanceMaximum;
    const horizontal = value => left + (value-horizontalMinimum) / (horizontalMaximum-horizontalMinimum) * (width-left-right);
    const vertical = value => height-bottom - (value-verticalMinimum)/(verticalMaximum-verticalMinimum)*(height-top-bottom);
    const heading = scatter ? 'Across sizes and checkpoints' : accuracy ? 'Downstream accuracy ↑' : `${metadata.name} ↓`;
    let output = `<h4>${heading}</h4><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${heading}: ${escape(names[rows[0].setting])}"><title>${heading}</title>`;
    for (let tick=0; tick<=4; tick++) {
      const value = verticalMinimum + tick/4*(verticalMaximum-verticalMinimum);
      const position = vertical(value);
      output += `<line class="chart-grid" x1="${left}" x2="${width-right}" y1="${position}" y2="${position}"/><text class="chart-label" x="${left-10}" y="${position+4}" text-anchor="end">${accuracy ? (value*100).toFixed(0)+'%' : value.toFixed(2)}</text>`;
    }
    const ticks = scatter ? [0, .25, .5, .75, 1].map(value=>horizontalMinimum+value*(horizontalMaximum-horizontalMinimum)) : [3000,33000,63000,103000,143000];
    for (const value of ticks) output += `<text class="chart-label" x="${horizontal(value)}" y="${height-bottom+22}" text-anchor="middle">${scatter ? value.toFixed(2) : value/1000+'K'}</text>`;
    output += `<text class="chart-label" x="${left}" y="16">${accuracy ? 'Seven-task five-shot mean accuracy' : escape(metadata.units)}</text><text class="chart-label" x="${(left+width-right)/2}" y="${height-6}" text-anchor="middle">${scatter ? escape(metadata.name+' · '+metadata.units+' ↓') : 'Training update'}</text>`;
    for (const [index, size] of data.sizes.entries()) {
      const series = rows.filter(row=>row.size===size).sort((first,second)=>first.step-second.step);
      const position = row => [horizontal(scatter ? row.distance : row.step),vertical(accuracy ? row.accuracy : row.distance)];
      if (!scatter) output += `<polyline points="${series.map(row=>position(row).join(',')).join(' ')}" fill="none" style="stroke:${colors[index]}" stroke-width="1.8"/>`;
      for (const row of series) {
        const [horizontalPosition, verticalPosition] = position(row);
        const label = `${sizes[size]} · ${row.step/1000}K updates · score ${format(row.distance)} · accuracy ${(row.accuracy*100).toFixed(2)}%`;
        output += `<g tabindex="0" role="img" aria-label="${escape(label)}" style="fill:${colors[index]};stroke:var(--bg)" stroke-width="1.2"><title>${escape(label)}</title>${marker(index,horizontalPosition,verticalPosition,scatter?5.5:4)}</g>`;
      }
    }
    return output+'</svg>';
  }

  function table(headers, rows) {
    return `<table><thead><tr>${headers.map(header=>`<th scope="col">${escape(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  fetch('/data/compression-as-evaluation/downstream.json').then(response => {
    if (!response.ok) throw new Error('Data unavailable');
    return response.json();
  }).then(data => {
    document.querySelector('#downstream-legend').innerHTML = data.sizes.map((size,index)=>`<span><svg viewBox="0 0 20 20" aria-hidden="true" style="fill:${colors[index]}">${marker(index,10,10)}</svg>${sizes[size]}</span>`).join('');
    const selector = document.querySelector('#downstream-setting');
    const metricSelector = document.querySelector('#downstream-metric');
    function render() {
      const metric = metricSelector.value;
      const rows = data.points.filter(row=>row.setting===selector.value).map(row=>({...row, distance:row.scores[metric]}));
      const metadata = data.metrics[metric];
      status.textContent = `${metadata.name} · ${names[selector.value]} · 24 checkpoints · ${metadata.sequences} sequences per score · Spearman ρ(−score, accuracy) = ${format(data.correlations_by_metric[metric][selector.value].pooled)}`;
      for (const mode of ['scatter','distance','accuracy']) document.querySelector(`#downstream-${mode}`).innerHTML = chart(data,rows,mode,metric);
      document.querySelector('#downstream-points').innerHTML = table(['Size','Update',metadata.units+' ↓','Accuracy ↑'],rows.map(row=>[sizes[row.size],row.step.toLocaleString('en-US'),row.distance.toFixed(6),(row.accuracy*100).toFixed(3)+'%']));
      document.querySelector('#downstream-correlations').innerHTML = '<h4>Selected metric · Spearman ρ(−score, accuracy)</h4>'+table(['Decoding','Pooled · n=24',...data.sizes.map(size=>sizes[size]+' · n=6'),'Leave-one-size-out range · n=18'],data.settings.map(setting=>{
      const row=data.correlations_by_metric[metric][setting];
      const sensitivity=Object.values(row.leave_one_size_out);
      return [names[setting],format(row.pooled),...data.sizes.map(size=>format(row.within_size[size])),`${format(Math.min(...sensitivity))} to ${format(Math.max(...sensitivity))}`];
      }));
    }
    document.querySelector('#downstream-comparison').innerHTML = '<h4>All metrics · pooled Spearman ρ · 24 checkpoints per cell</h4>'+table(['Metric',...data.settings.map(setting=>names[setting])],Object.entries(data.metrics).map(([metric,metadata])=>[metadata.name,...data.settings.map(setting=>format(data.correlations_by_metric[metric][setting].pooled))]));
    selector.addEventListener('change',render);
    metricSelector.addEventListener('change',render);
    render();
  }).catch(() => { status.textContent = 'Unable to load plots. Download the source data below or reload to retry.'; });
})();
