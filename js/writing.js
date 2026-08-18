(() => {
  const entries = [...document.querySelectorAll('[data-writing-entry]')];
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const search = document.querySelector('[data-writing-search]');
  const empty = document.querySelector('[data-no-results]');
  if (!entries.length) return;

  let type = 'all';
  const update = () => {
    const query = (search?.value || '').trim().toLowerCase();
    let visible = 0;
    entries.forEach((entry) => {
      const matchesType = type === 'all' || entry.dataset.type === type;
      const matchesSearch = !query || entry.dataset.search.includes(query) || entry.dataset.tags.includes(query);
      entry.hidden = !(matchesType && matchesSearch);
      if (!entry.hidden) visible += 1;
    });
    if (empty) empty.hidden = visible !== 0;
  };

  buttons.forEach((button) => button.addEventListener('click', () => {
    type = button.dataset.filter;
    buttons.forEach((candidate) => candidate.classList.toggle('is-active', candidate === button));
    update();
  }));
  search?.addEventListener('input', update);
})();
