import React, { useState } from 'react';

export default function ExpandableSection({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="expandable-section">
      <button 
        className="expandable-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="expandable-title">{title}</span>
        <span className="expandable-icon">{isOpen ? '−' : '+'}</span>
      </button>
      
      {isOpen && (
        <div className="expandable-content">
          {children}
        </div>
      )}
    </div>
  );
}