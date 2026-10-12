"use client";

import { useState } from "react";

export function TagInput({
  tags,
  onChange,
  placeholder = "Taper puis Entrée…",
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");

  function add(raw: string) {
    const name = raw.trim();
    if (!name) return;
    if (tags.some((t) => t.toLowerCase() === name.toLowerCase())) {
      setValue("");
      return;
    }
    onChange([...tags, name]);
    setValue("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(value);
    } else if (e.key === "Backspace" && !value && tags.length > 0) {
      onChange(tags.slice(0, -1)); // efface le dernier tag
    }
  }

  return (
    <div className="tag-input">
      {tags.map((t, i) => (
        <span key={i} className="tag-chip">
          {t}
          <button
            className="tag-remove"
            onClick={() => onChange(tags.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="tag-field"
        value={value}
        placeholder={tags.length === 0 ? placeholder : ""}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(value)} // valide aussi ce qui reste en quittant le champ
      />
    </div>
  );
}
