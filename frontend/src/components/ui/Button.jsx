export default function Button({ children, loading = false, className = '', ...props }) {
  return (
    <button className={`btn ${className}`.trim()} disabled={loading || props.disabled} {...props}>
      {loading ? 'Please wait...' : children}
    </button>
  );
}
