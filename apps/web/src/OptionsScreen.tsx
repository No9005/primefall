import { useState } from "react";
import "./options.css";
import { currentVisualStyle, saveVisualStyle, VISUAL_STYLE_CHOICES, type VisualStyle } from "./visual-style";

// The Options screen: the visual style. Static: it never creates a match host and never reads or writes the saved match.

/** `onClose` returns to the start screen. */
export function OptionsScreen({ onClose }: { onClose: () => void }) {
  const [style, setStyle] = useState<VisualStyle>(() => currentVisualStyle());
  function choose(next: VisualStyle) {
    setStyle(next);
    saveVisualStyle(next);
  }
  return (
    <section className="options" aria-label="Options" data-testid="options">
      <header className="options-header">
        <button type="button" data-testid="options-back" onClick={onClose}>
          Back
        </button>
        <h2>Options</h2>
      </header>
      <div className="options-body" role="radiogroup" aria-label="Visual style">
        <h3>Visual style</h3>
        <div className="options-choices">
          {VISUAL_STYLE_CHOICES.map((choice) => (
            <button
              key={choice.style}
              type="button"
              role="radio"
              aria-checked={style === choice.style}
              className={`options-choice${style === choice.style ? " selected" : ""}`}
              data-testid={`style-${choice.style}`}
              onClick={() => choose(choice.style)}
            >
              <b>{choice.label}</b>
              <span>{choice.text}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
