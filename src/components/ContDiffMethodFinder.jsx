import React, { useMemo, useState } from "react";
import methods from "../data/cont_diff_methods.json";

const STEPS = [
  {
    key: "encoding",
    label: "Encoding",
  },
  {
    key: "trajectory",
    label: "Trajectory",
  },
  {
    key: "time",
    label: "Noise Schedule",
  },
  {
    key: "conditioning",
    label: "Conditional Structure",
  },
  {
    key: "decoding",
    label: "Decoding",
  },
  {
    key: "objective",
    label: "Training Framework",
  },
];

const initialSelections = Object.fromEntries(
  STEPS.map((step) => [step.key, "Any"])
);

const COLLAPSED_RESULT_COUNT = 6;

function ResultCard({ method }) {
  return (
    <article className="cd-method-card">
      <div className="cd-method-card__header">
        <div>
          <h4>
            <a href={method.link}>{method.name}</a>
          </h4>
          <p>
            {method.authors} {method.year}
          </p>
        </div>
      </div>
      <div className="cd-method-card__tags">
        {STEPS.map((step) => (
          <span key={step.key}>
            {step.label}: {method.fields[step.key]}
          </span>
        ))}
      </div>
    </article>
  );
}

export default function ContDiffMethodFinder() {
  const [selections, setSelections] = useState(initialSelections);
  const [isExpanded, setIsExpanded] = useState(false);

  const fieldOptions = useMemo(() => {
    return Object.fromEntries(
      STEPS.map((step) => {
        const values = methods
          .map((method) => method.fields?.[step.key])
          .filter((value) => typeof value === "string" && value.trim() !== "");

        return [step.key, Array.from(new Set(values)).sort()];
      })
    );
  }, []);

  const filteredMethods = useMemo(() => {
    return methods.filter((method) =>
      STEPS.every((step) => {
        const selected = selections[step.key];
        return selected === "Any" || method.fields[step.key] === selected;
      })
    );
  }, [selections]);

  const activeCount = Object.values(selections).filter(
    (selection) => selection !== "Any"
  ).length;

  const hasHiddenResults = filteredMethods.length > COLLAPSED_RESULT_COUNT;
  const visibleMethods = isExpanded
    ? filteredMethods
    : filteredMethods.slice(0, COLLAPSED_RESULT_COUNT);

  const updateSelection = (key, value) => {
    setSelections((current) => ({
      ...current,
      [key]: value,
    }));
    setIsExpanded(false);
  };

  const resetSelections = () => {
    setSelections(initialSelections);
    setIsExpanded(false);
  };

  return (
    <section className="cd-method-finder" aria-labelledby="cd-method-finder-title">
      <style>{`
        .cd-method-finder {
          margin: 2rem 0;
          border: 1px solid rgba(143, 234, 255, 0.22);
          border-radius: 16px;
          background:
            linear-gradient(145deg, rgba(143, 234, 255, 0.08), rgba(255, 183, 77, 0.05)),
            rgba(15, 24, 43, 0.78);
          box-shadow: 0 12px 34px rgba(3, 8, 21, 0.42);
          color: #d6e7ff;
          overflow: hidden;
        }

        .cd-method-finder__header {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1.25rem 1.35rem 1rem;
          border-bottom: 1px solid rgba(143, 234, 255, 0.14);
        }

        .cd-method-finder h3,
        .cd-method-card h4,
        .cd-empty h4 {
          margin: 0;
          font-family: var(--font-heading);
          letter-spacing: 0;
        }

        .cd-method-finder h3 {
          color: #8feaff;
          font-size: 1.25rem;
          line-height: 1.25;
        }

        .cd-method-finder__header p {
          max-width: 650px;
          margin: 0.45rem 0 0;
          color: #abc3df;
          line-height: 1.55;
        }

        .cd-method-finder__reset {
          flex: 0 0 auto;
          min-height: 38px;
          padding: 0.55rem 0.8rem;
          border: 1px solid rgba(143, 234, 255, 0.28);
          border-radius: 8px;
          background: rgba(6, 16, 32, 0.36);
          color: #8feaff;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
        }

        .cd-method-finder__reset:hover,
        .cd-method-finder__reset:focus-visible {
          border-color: rgba(143, 234, 255, 0.62);
          background: rgba(143, 234, 255, 0.12);
          outline: none;
          transform: translateY(-1px);
        }

        .cd-method-finder__controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.85rem;
          padding: 1.25rem 1.35rem;
        }

        .cd-control {
          display: grid;
          gap: 0.4rem;
        }

        .cd-control label {
          color: #8feaff;
          font-size: 0.9rem;
          font-weight: 800;
          line-height: 1.25;
        }

        .cd-control select {
          width: 100%;
          min-height: 44px;
          padding: 0.65rem 0.75rem;
          border: 1px solid rgba(143, 234, 255, 0.18);
          border-radius: 8px;
          background: #101b31;
          color: #eaf5ff;
          font: inherit;
          line-height: 1.3;
          cursor: pointer;
        }

        .cd-control select:focus-visible {
          border-color: rgba(143, 234, 255, 0.62);
          box-shadow: 0 0 0 3px rgba(143, 234, 255, 0.12);
          outline: none;
        }

        .cd-method-finder__results {
          padding: 0 1.35rem 1.35rem;
        }

        .cd-method-finder__count {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
          justify-content: space-between;
          margin: 0 0 0.75rem;
          color: #abc3df;
          font-size: 0.95rem;
        }

        .cd-method-finder__count strong {
          color: #ffe08a;
        }

        .cd-method-list {
          display: grid;
          gap: 0.85rem;
        }

        .cd-method-finder__expand {
          display: flex;
          justify-content: center;
          margin-top: 1rem;
        }

        .cd-method-finder__expand button {
          min-height: 40px;
          padding: 0.55rem 0.9rem;
          border: 1px solid rgba(255, 224, 138, 0.34);
          border-radius: 8px;
          background: rgba(255, 224, 138, 0.08);
          color: #ffe08a;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
          transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
        }

        .cd-method-finder__expand button:hover,
        .cd-method-finder__expand button:focus-visible {
          border-color: rgba(255, 224, 138, 0.72);
          background: rgba(255, 224, 138, 0.14);
          outline: none;
          transform: translateY(-1px);
        }

        .cd-method-card {
          border: 1px solid rgba(143, 234, 255, 0.16);
          border-radius: 8px;
          background: rgba(6, 16, 32, 0.46);
          padding: 1rem;
        }

        .cd-method-card__header {
          display: flex;
          gap: 0.8rem;
          align-items: flex-start;
          justify-content: space-between;
        }

        .cd-method-card h4 {
          color: #f3fbff;
          font-size: 1.05rem;
          line-height: 1.25;
        }

        .cd-method-card h4 a {
          color: inherit;
          text-decoration: none;
        }

        .cd-method-card h4 a:hover,
        .cd-method-card h4 a:focus-visible {
          color: #8feaff;
          outline: none;
          text-decoration: underline;
          text-underline-offset: 0.18em;
        }

        .cd-method-card__header p {
          margin: 0.3rem 0 0;
          color: #abc3df;
          line-height: 1.5;
        }

        .cd-method-card__tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-top: 0.8rem;
        }

        .cd-method-card__tags span {
          border: 1px solid rgba(143, 234, 255, 0.18);
          border-radius: 999px;
          background: rgba(143, 234, 255, 0.08);
          color: #d6e7ff;
          padding: 0.24rem 0.55rem;
          font-size: 0.78rem;
          line-height: 1.25;
        }

        .cd-empty {
          position: relative;
          display: grid;
          min-height: 190px;
          place-items: center;
          overflow: hidden;
          border: 1px solid rgba(255, 112, 177, 0.28);
          border-radius: 8px;
          background:
            radial-gradient(circle at 18% 24%, rgba(255, 112, 177, 0.18), transparent 30%),
            radial-gradient(circle at 82% 34%, rgba(255, 224, 138, 0.16), transparent 28%),
            linear-gradient(135deg, rgba(143, 234, 255, 0.08), rgba(255, 112, 177, 0.08));
          text-align: center;
        }

        .cd-empty h4 {
          color: #ffe08a;
          font-size: clamp(3rem, 12vw, 6.5rem);
          line-height: 0.9;
          text-shadow:
            0 0 18px rgba(255, 224, 138, 0.34),
            0 0 30px rgba(255, 112, 177, 0.24);
        }

        .cd-empty p {
          margin: 0.75rem auto 0;
          max-width: 440px;
          color: #f6d8ef;
          line-height: 1.5;
        }

        @media (max-width: 720px) {
          .cd-method-finder__header {
            display: grid;
          }

          .cd-method-finder__reset {
            width: 100%;
          }

          .cd-method-finder__controls {
            grid-template-columns: 1fr;
          }

          .cd-method-card__header {
            display: grid;
          }

          .cd-method-card__header span {
            justify-self: start;
          }
        }
      `}</style>

      <div className="cd-method-finder__header">
        <div>
          <h3 id="cd-method-finder-title">Recipe Matcher</h3>
          <p>
            Pick one ingredient per step to see which placeholder methods fit
            that recipe.
          </p>
        </div>
        <button
          className="cd-method-finder__reset"
          type="button"
          onClick={resetSelections}
        >
          Reset
        </button>
      </div>

      <div className="cd-method-finder__controls">
        {STEPS.map((step) => (
          <div className="cd-control" key={step.key}>
            <label htmlFor={`cd-method-${step.key}`}>{step.label}</label>
            <select
              id={`cd-method-${step.key}`}
              value={selections[step.key]}
              onChange={(event) => updateSelection(step.key, event.target.value)}
            >
              <option value="Any">Any</option>
              {(fieldOptions[step.key] ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="cd-method-finder__results" aria-live="polite">
        <p className="cd-method-finder__count">
          <span>
            Showing <strong>{filteredMethods.length}</strong>
            {filteredMethods.length === 1 ? " match" : " matches"}
          </span>
          <span>{activeCount} selected axes</span>
        </p>

        {filteredMethods.length > 0 ? (
          <>
            <div className="cd-method-list">
              {visibleMethods.map((method) => (
                <ResultCard
                  key={`${method.name}-${method.year}-${method.authors}`}
                  method={method}
                />
              ))}
            </div>

            {hasHiddenResults && (
              <div className="cd-method-finder__expand">
                <button
                  type="button"
                  onClick={() => setIsExpanded((current) => !current)}
                  aria-expanded={isExpanded}
                >
                  {isExpanded
                    ? "Show fewer"
                    : `Show ${filteredMethods.length - COLLAPSED_RESULT_COUNT} more`}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="cd-empty" role="status">
            <div>
              <h4>???</h4>
              <p>
                No placeholder method currently claims this exact combination.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
