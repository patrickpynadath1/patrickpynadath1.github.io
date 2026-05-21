import React, { useEffect, useId, useRef } from 'react';

export function TabGroup({ children }) {
  return <>{children}</>;
}

export function TabPanel({ title, children }) {
  return (
    <div className="tabbed-text-panel" data-title={title}>
      {children}
    </div>
  );
}

export default function TabbedText({ children, label = 'Tabbed text', title }) {
  const rootRef = useRef(null);
  const baseId = useId();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const tabsEl = root.querySelector('.tabbed-text-tabs');
    const panels = Array.from(root.querySelectorAll('.tabbed-text-panel'));

    if (!tabsEl || panels.length === 0) {
      return;
    }

    tabsEl.replaceChildren();

    const selectPanel = (index, focus = false) => {
      panels.forEach((panel, panelIndex) => {
        const isActive = panelIndex === index;
        panel.hidden = !isActive;
        panel.classList.toggle('is-active', isActive);
      });

      Array.from(tabsEl.querySelectorAll('button')).forEach((tab, tabIndex) => {
        const isActive = tabIndex === index;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.tabIndex = isActive ? 0 : -1;

        if (isActive && focus) {
          tab.focus();
        }
      });
    };

    panels.forEach((panel, index) => {
      const panelTitle = panel.dataset.title || `Panel ${index + 1}`;
      const tab = document.createElement('button');

      tab.type = 'button';
      tab.id = `${baseId}-tab-${index}`;
      tab.className = 'tabbed-text-tab';
      tab.role = 'tab';
      tab.textContent = panelTitle;
      tab.setAttribute('aria-controls', `${baseId}-panel-${index}`);
      tab.addEventListener('click', () => selectPanel(index));
      tab.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
          return;
        }

        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        selectPanel((index + direction + panels.length) % panels.length, true);
      });

      panel.id = `${baseId}-panel-${index}`;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      tabsEl.append(tab);
    });

    selectPanel(0);
  }, [baseId, children]);

  return (
    <div className="tabbed-text" ref={rootRef}>
      <style>{`
        .tabbed-text {
          margin: 2rem 0;
          overflow: hidden;
          border: 1px solid rgba(31, 45, 74, 0.9);
          border-radius: 16px;
          background: linear-gradient(145deg, rgba(15, 24, 43, 0.72), rgba(31, 45, 74, 0.38));
          box-shadow: 0 8px 32px rgba(3, 8, 21, 0.36);
          backdrop-filter: blur(12px);
        }

        .tabbed-text-title {
          margin: 0;
          padding: 1.1rem 1.5rem 0.2rem;
          color: #8feaff;
          font-family: var(--font-heading);
          font-size: 1.2rem;
          font-weight: 700;
          line-height: 1.3;
          text-align: center;
          text-shadow: 0 0 10px rgba(143, 234, 255, 0.24);
        }

        .tabbed-text-tabs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 0.5rem;
          padding: 0.75rem;
          border-bottom: 1px solid rgba(31, 45, 74, 0.72);
          background: rgba(15, 24, 43, 0.34);
        }

        .tabbed-text-tabs:empty {
          display: none;
        }

        .tabbed-text-title + .tabbed-text-tabs {
          padding-top: 0.9rem;
        }

        .tabbed-text-tab {
          min-height: 44px;
          padding: 0.75rem 0.9rem;
          border: 1px solid rgba(143, 234, 255, 0.15);
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(143, 234, 255, 0.05), rgba(143, 234, 255, 0.02));
          color: #d6e7ff;
          font: inherit;
          font-weight: 600;
          line-height: 1.25;
          text-align: center;
          cursor: pointer;
          transition: background 180ms ease, border-color 180ms ease, color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
        }

        .tabbed-text-tab:hover,
        .tabbed-text-tab:focus-visible {
          border-color: rgba(143, 234, 255, 0.35);
          color: #8feaff;
          outline: none;
          transform: translateY(-1px);
          box-shadow: 0 2px 10px rgba(3, 8, 21, 0.24);
        }

        .tabbed-text-tab.is-active {
          border-color: rgba(143, 234, 255, 0.55);
          background: linear-gradient(135deg, rgba(143, 234, 255, 0.2), rgba(143, 234, 255, 0.08));
          color: #8feaff;
          box-shadow: inset 0 0 0 1px rgba(143, 234, 255, 0.08), 0 0 16px rgba(143, 234, 255, 0.12);
        }

        .tabbed-text-panels {
          background: rgba(15, 24, 43, 0.18);
        }

        .tabbed-text-panel {
          position: relative;
          padding: 1.5rem;
          color: #d6e7ff;
          line-height: 1.75;
          animation: tabbedTextFade 220ms ease-out;
        }

        .tabbed-text-panel[hidden] {
          display: none;
        }

        .tabbed-text-panel::before {
          content: '';
          position: absolute;
          top: 0;
          right: 1.5rem;
          left: 1.5rem;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(143, 234, 255, 0.35), transparent);
        }

        .tabbed-text-panel > :first-child {
          margin-top: 0;
        }

        .tabbed-text-panel > :last-child {
          margin-bottom: 0;
        }

        .tabbed-text-panel ul,
        .tabbed-text-panel ol {
          margin: 0.75rem 0 0;
          padding-left: 1.5rem;
          list-style-position: outside;
        }

        .tabbed-text-panel ul {
          list-style-type: disc;
        }

        .tabbed-text-panel ol {
          list-style-type: decimal;
        }

        .tabbed-text-panel li {
          display: list-item;
          margin: 0.35rem 0;
          padding-left: 0.15rem;
        }

        .tabbed-text-panel li::marker {
          color: #8feaff;
        }

        @keyframes tabbedTextFade {
          from {
            opacity: 0;
            transform: translateY(6px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 640px) {
          .tabbed-text-tabs {
            grid-template-columns: 1fr;
            padding: 0.6rem;
          }

          .tabbed-text-panel {
            padding: 1.25rem;
          }
        }
      `}</style>

      {title && <h4 className="tabbed-text-title">{title}</h4>}
      <div className="tabbed-text-tabs" role="tablist" aria-label={label}></div>
      <div className="tabbed-text-panels">{children}</div>
    </div>
  );
}
