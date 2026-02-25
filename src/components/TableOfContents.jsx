import React from 'react';

const TableOfContents = ({ sections }) => {
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      });
    }
  };

  const slugify = (text) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  };

  return (
    <div className="table-of-contents">
      <h3 className="toc-title">Contents</h3>
      <div className="toc-grid">
        {sections.map((section, index) => {
          const sectionId = slugify(section);
          return (
            <button
              key={index}
              className="toc-button"
              onClick={() => scrollToSection(sectionId)}
              aria-label={`Jump to ${section}`}
            >
              <span className="toc-number">{index + 1}</span>
              <span className="toc-text">{section}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TableOfContents;