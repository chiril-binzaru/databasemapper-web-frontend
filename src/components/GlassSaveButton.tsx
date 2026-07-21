import './GlassSaveButton.css';

interface GlassSaveButtonProps {
  onClick: () => void;
  disabled?: boolean;
  saving?: boolean;
}

export default function GlassSaveButton({ onClick, disabled = false, saving = false }: GlassSaveButtonProps) {
  return (
    <button
      type="button"
      className="glass-save-btn"
      onClick={onClick}
      disabled={disabled || saving}
      aria-label={saving ? 'Saving changes' : 'Save changes'}
    >
      <span className="glass-save-btn__glow" aria-hidden="true" />
      <span className="glass-save-btn__interior">
        <span className="glass-save-btn__icon">
          <span className="glass-save-btn__icon-inner">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
              <path d="M17 21v-8H7v8" />
              <path d="M7 3v5h8" />
            </svg>
          </span>
        </span>
        <span className="glass-save-btn__label">{saving ? 'Saving…' : 'Save changes'}</span>
      </span>
    </button>
  );
}
