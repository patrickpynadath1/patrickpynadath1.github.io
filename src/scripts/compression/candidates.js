(() => {
  const root = document.querySelector('#candidate-views');
  const selector = document.querySelector('#candidate-select');
  if (!root || !selector) return;
  const views = [...root.querySelectorAll('.candidate-view')];
  for (const view of views) {
    const option = document.createElement('option');
    option.value = view.id;
    option.textContent = view.dataset.candidateTitle;
    selector.append(option);
  }
  function update() {
    for (const view of views) view.hidden = view.id !== selector.value;
    document.querySelector('#candidate-selection-status').textContent = `Showing ${selector.selectedOptions[0].textContent}`;
  }
  selector.addEventListener('change', update);
  update();
  document.querySelector('.candidate-picker').hidden = false;
})();
