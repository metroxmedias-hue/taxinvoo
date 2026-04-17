export default function CheckboxField({ label, checked, onChange, disabled = false }) {
  return (
    <label className="checkbox-row">
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}
