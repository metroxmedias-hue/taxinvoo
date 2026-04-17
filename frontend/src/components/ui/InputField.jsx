export default function InputField({
  label,
  error,
  required = false,
  as = 'input',
  className = '',
  ...props
}) {
  const Element = as;

  return (
    <label className={`field ${className}`.trim()}>
      <span className="field-label">
        {label}
        {required ? ' *' : ''}
      </span>
      <Element className={`field-control ${error ? 'field-control-error' : ''}`} {...props} />
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}
