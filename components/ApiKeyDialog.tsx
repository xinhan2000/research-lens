"use client";

import { useState } from "react";

import { API_KEY_DISCLOSURE } from "@/lib/api-key";

/**
 * Minimal BYOK dialog.
 *
 * The key is write-only from the UI's perspective: it is never read back into
 * the field and never displayed after saving.
 */
export default function ApiKeyDialog({
  configured,
  onSave,
  onClear,
  onClose,
}: {
  configured: boolean;
  onSave: (key: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (value.trim().length === 0) return;
    onSave(value.trim());
    setValue("");
  }

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Anthropic API key"
      onClick={onClose}
    >
      <div className="dialog" onClick={(event) => event.stopPropagation()}>
        <h2 className="dialog-title">
          {configured ? "Replace Anthropic API Key" : "Set Anthropic API Key"}
        </h2>

        <form onSubmit={handleSubmit}>
          <label className="dialog-label" htmlFor="anthropic-api-key">
            API key
          </label>
          <input
            id="anthropic-api-key"
            type="password"
            className="dialog-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />

          <p className="dialog-note">{API_KEY_DISCLOSURE}</p>

          <div className="dialog-actions">
            {configured ? (
              <button type="button" onClick={onClear}>
                Clear Key
              </button>
            ) : null}
            <span className="dialog-spacer" />
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary"
              disabled={value.trim().length === 0}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
