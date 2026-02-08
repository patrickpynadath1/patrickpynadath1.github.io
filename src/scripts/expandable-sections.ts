export function initExpandableSections() {
  const expandableSections = Array.from(
    document.querySelectorAll<HTMLElement>('[data-expandable]')
  );

  expandableSections.forEach((section) => {
    section.addEventListener('click', (event) => {
      const target = event.target as Element | null;
      if (target && target.closest('.conference-badge, .website-badge, .arxiv-badge, .github-badge')) {
        return;
      }

      section.classList.toggle('expanded');
    });
  });

  const badges = Array.from(
    document.querySelectorAll<HTMLElement>('.conference-badge, .website-badge, .arxiv-badge, .github-badge')
  );
  badges.forEach((badge) => {
    badge.addEventListener('click', (event) => event.stopPropagation());
  });
}
