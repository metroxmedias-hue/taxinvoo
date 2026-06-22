import { HttpError } from '../utils/httpError.js';
import { resolveBusinessForUser } from '../services/businessService.js';

export async function requireTenant(req, _res, next) {
  const businessId = String(req.header('x-business-id') || '').trim();
  const userId = String(req.header('x-user-id') || '').trim();

  if (!userId) {
    return next(new HttpError(401, 'Missing x-user-id header.'));
  }

  try {
    const resolved = await resolveBusinessForUser(userId, businessId);
    req.tenant = {
      businessId: resolved.businessId,
      userId,
      business: resolved.business,
      member: resolved.member
    };
    return next();
  } catch (err) {
    if (!businessId && err?.statusCode === 404) {
      return next(new HttpError(400, 'Missing x-business-id header and no active business was found.'));
    }
    return next(err);
  }
}
