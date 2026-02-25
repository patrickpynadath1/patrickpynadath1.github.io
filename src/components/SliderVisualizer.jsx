import React, { useState } from "react";

export default function SliderVisualizer() {
  const [value, setValue] = useState(50);

  return (
    <div
      style={{
        maxWidth: 900,
        width: "100%",
        margin: "2rem auto",
        padding: "1.5rem",
        textAlign: "center",
      }}
    >
      <h3>Move the slider!</h3>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: "100%" }}
      />
      <div style={{ margin: "1rem 0" }}>
        <svg width="100%" height="80">
          <rect x="0" y="20" width="100%" height="20" fill="#eee" />
          <circle
            cx={`${value}%`}
            cy="30"
            r="15"
            fill="#0077ff"
            stroke="#333"
            strokeWidth="2"
          />
        </svg>
        <div>Value: {value}</div>
      </div>
    </div>
  );
}
