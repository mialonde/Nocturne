import { useId, type ReactNode } from 'react'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
  hint?: string
  disabled?: boolean
  className?: string
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
  disabled,
  className,
}: SliderProps) {
  const id = useId()
  return (
    <div className={`slider-control ${className ?? ''}`.trim()}>
      <div className="slider-control__head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{format ? format(value) : value}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint ? <p className="control-hint">{hint}</p> : null}
    </div>
  )
}

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  description?: string
  disabled?: boolean
}

export function Toggle({ label, checked, onChange, description, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      className={`toggle-row ${disabled ? 'is-disabled' : ''}`.trim()}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-row__copy">
        <span className="toggle-row__label">{label}</span>
        {description ? <span className="toggle-row__description">{description}</span> : null}
      </span>
      <span className={`toggle-track ${checked ? 'is-on' : ''}`.trim()} aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
    </button>
  )
}

interface SegmentedOption<T extends string | number> {
  value: T
  label: string
  title?: string
}

interface SegmentedProps<T extends string | number> {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  compact?: boolean
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  compact,
}: SegmentedProps<T>) {
  return (
    <div className={`segmented-control ${compact ? 'is-compact' : ''}`.trim()}>
      <span className="field-label">{label}</span>
      <div className="segmented-control__options" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            type="button"
            key={String(option.value)}
            className={option.value === value ? 'is-active' : ''}
            aria-pressed={option.value === value}
            title={option.title}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  suffix?: string
  disabled?: boolean
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
  disabled,
}: NumberFieldProps) {
  const id = useId()
  return (
    <div className="number-field">
      <label htmlFor={id}>{label}</label>
      <div className="number-field__input">
        <input
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : min}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (!Number.isFinite(next)) return
            onChange(Math.min(max, Math.max(min, next)))
          }}
        />
        {suffix ? <span>{suffix}</span> : null}
      </div>
    </div>
  )
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="select-field">
      <label htmlFor={id}>{label}</label>
      <div className="select-field__wrap">
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function FieldShell({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string
  hint?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="field-shell">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <p className="control-hint">{hint}</p> : null}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  multiline,
  rows,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  multiline?: boolean
  rows?: number
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="text-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          rows={rows ?? 3}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  )
}
