(() => {
  const roots = document.querySelectorAll('.stress-suite');
  if (!roots.length) return;
  const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
  const format = value => Number(value).toPrecision(5);
  const label = parameters => Object.entries(parameters).filter(([name]) => name !== 'phase').sort(([first], [second]) => (first === 'kind' ? -1 : second === 'kind' ? 1 : first.localeCompare(second))).map(([name, value]) => name === 'kind' || name === 'condition' ? String(value).replaceAll('_', ' ') : `${name}=${value}`).join(' · ');
  const table = (headers, rows) => `<table><thead><tr>${headers.map(value => `<th scope="col">${escape(value)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  fetch('/data/compression-as-evaluation/stress-tests.json').then(response => {
    if (!response.ok) throw new Error('Data unavailable');
    return response.json();
  }).then(data => {
    for (const root of roots) {
      const suite = data.suites[root.dataset.suite];
      root.innerHTML = `<div class="experiment-toolbar"><label>Metric <select class="stress-metric">${Object.entries(suite.metrics).map(([key, metric]) => `<option value="${key}">${escape(metric.name)}</option>`).join('')}</select></label><label>Phase <select class="stress-phase">${suite.phases.map(phase => `<option>${phase}</option>`).join('')}</select></label></div><p class="stress-status" role="status"></p><div class="stress-chart adversarial-plot"></div><output class="adversarial-detail">Hover, focus or tap a point for scores.</output><div class="experiment-table stress-table"></div>`;
      const selector = root.querySelector('.stress-metric');
      const phase = root.querySelector('.stress-phase');
      const familyOf = row => row.parameters.kind || row.parameters.condition?.split('-')[0] || 'seeds';
      const families = [...new Set(Object.values(suite.metrics)[0].rows.map(familyOf))];
      const familyLabel = document.createElement('label');
      familyLabel.innerHTML = `Family <select class="stress-family"><option value="all">All families</option>${families.map(family => `<option value="${escape(family)}">${escape(family.replaceAll('_', ' '))}</option>`).join('')}</select>`;
      root.querySelector('.experiment-toolbar').append(familyLabel);
      familyLabel.hidden = families.length < 2;
      const familySelector = familyLabel.querySelector('select');
      const rawTable = root.querySelector('.stress-table');
      const chart = root.querySelector('.stress-chart');
      chart.tabIndex = 0;
      chart.setAttribute('role', 'region');
      chart.setAttribute('aria-label', 'Scrollable setting margins');
      const chartHint = document.createElement('p');
      chartHint.className = 'stress-chart-hint';
      chartHint.textContent = 'Choose a family to focus the results. Scroll the chart for more settings; expand raw scores below for exact values.';
      chart.before(chartHint);
      const disclosure = document.createElement('details');
      disclosure.className = 'experiment-data stress-raw';
      disclosure.innerHTML = '<summary>Inspect raw scores</summary>';
      rawTable.before(disclosure);
      disclosure.append(rawTable);
      const overview = document.createElement('div');
      overview.className = 'experiment-table';
      root.querySelector('.experiment-toolbar').after(overview);
      function render() {
        const metric = suite.metrics[selector.value];
        const matches = row => row.phase === phase.value && (familySelector.value === 'all' || familyOf(row) === familySelector.value);
        const rows = metric.rows.filter(matches).sort((first, second) => {
          const familyOrder = familyOf(first).localeCompare(familyOf(second));
          if (familyOrder) return familyOrder;
          for (const key of ['region', 'theme', 'bank_size', 'span', 'severity', 'fraction', 'noise_fraction', 'seed']) {
            const left = first.parameters[key] ?? '', right = second.parameters[key] ?? '';
            const difference = typeof left === 'number' && typeof right === 'number' ? left-right : String(left).localeCompare(String(right));
            if (difference) return difference;
          }
          return label(first.parameters).localeCompare(label(second.parameters));
        });
        const margins = rows.map(row => row.margin);
        const minimum = Math.min(0, ...margins), maximum = Math.max(0, ...margins);
        const padding = Math.max(maximum-minimum, .00001)*.08;
        const horizontal = value => 310+(value-minimum+padding)/(maximum-minimum+2*padding)*390;
        const height = 50+rows.length*30;
        const paired = root.dataset.suite === 'paired';
        const baseline = paired ? 'original score' : 'real control';
        overview.innerHTML = table(['Metric', 'Positive margins', 'Phase'], Object.values(suite.metrics).map(candidate => {
          const selected = candidate.rows.filter(matches);
          return [candidate.name, `${selected.filter(row => row.margin > 0).length}/${selected.length}`, phase.value];
        }));
        root.querySelector('.stress-status').textContent = `${rows.filter(row => row.margin > 0).length}/${rows.length} positive margins · ${metric.units} · ${phase.value} · score − ${baseline}`;
        disclosure.querySelector('summary').textContent = `Inspect ${rows.length} raw scores and baseline margins`;
        let svg = `<svg viewBox="0 0 740 ${height}" role="img" aria-label="${escape(metric.name)} signed margins"><title>${escape(metric.name)}: score minus ${baseline}</title><line class="adversarial-zero" x1="${horizontal(0)}" x2="${horizontal(0)}" y1="5" y2="${height-30}"/>`;
        rows.forEach((row, index) => {
          const vertical = 20+index*30;
          const description = `${label(row.parameters)}: score ${format(row.score)}, ${baseline} ${format(row.control)}, margin ${format(row.margin)} ${metric.units}`;
          svg += `<text class="chart-label" x="298" y="${vertical+4}" text-anchor="end">${escape(label(row.parameters))}</text><line class="chart-grid" x1="310" x2="700" y1="${vertical}" y2="${vertical}"/><circle class="adversarial-point ${row.margin < 0 ? 'negative' : 'positive'}" cx="${horizontal(row.margin)}" cy="${vertical}" r="4.5" tabindex="0" aria-label="${escape(description)}"><title>${escape(description)}</title></circle>`;
        });
        for (const value of [minimum, maximum]) svg += `<text class="chart-label" x="${horizontal(value)}" y="${height-8}" text-anchor="middle">${format(value)}</text>`;
        svg += `<text class="chart-label" x="${horizontal(0)}" y="${height-23}" text-anchor="middle">0</text></svg>`;
        root.querySelector('.stress-chart').innerHTML = svg;
        root.querySelector('output').textContent = `Positive = higher score; negative = lower score. ${metric.units}.`;
        for (const point of root.querySelectorAll('circle')) for (const event of ['mouseenter', 'focus', 'click']) point.addEventListener(event, () => { root.querySelector('output').textContent = point.getAttribute('aria-label'); });
        root.querySelector('.stress-table').innerHTML = table(['Setting', 'Score', paired ? 'Before' : 'Control mean', 'Margin Δ', paired ? 'Before (same bank)' : 'Control range'], rows.map(row => [label(row.parameters), format(row.score), format(row.control), format(row.margin), `${format(row.control_min)} … ${format(row.control_max)}`]));
      }
      selector.addEventListener('change', render);
      phase.addEventListener('change', render);
      familySelector.addEventListener('change', render);
      render();
      if (suite.selection) root.insertAdjacentHTML('beforeend', `<h4>Selection versus held-out evaluation</h4><div class="experiment-table">${table(['Seed', 'Candidates', 'Selected', 'Tuning standalone W₁', 'Held-out standalone W₁', 'Held-out conditional W₁'], suite.selection.map(row => [row.seed, row.candidate_count, row.selected_count, format(row.tuning_standalone_w1), format(row.heldout_standalone_w1), format(row.heldout_conditional_w1)]))}</div>`);
    }
  }).catch(() => { for (const root of roots) root.textContent = 'Unable to load results. Reload or download the source data linked below.'; });
})();
