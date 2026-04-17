import { HttpError } from '../utils/httpError.js';

export function requireTenant(req, _res, next) {
  const businessId = String(req.header('x-business-id') || '').trim();
  const userId = String(req.header('x-user-id') || '').trim();

  if (!businessId) {
    return next(new HttpError(400, 'Missing x-business-id header.'));
  }
  if (!userId) {
    return next(new HttpError(401, 'Missing x-user-id header.'));
  }

  req.tenant = { businessId, userId };
  return next();
}
