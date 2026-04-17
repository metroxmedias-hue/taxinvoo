export function errorHandler(err, _req, res, _next) {
  const status = Number(err?.status) || 500;
  const message = err?.message || 'Internal server error.';

  const payload = { success: false, message };
  if (err?.details) payload.details = err.details;

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json(payload);
}
