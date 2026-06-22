import { getTokenFromReq, verifySessionToken } from './auth';

// Wrap any API route handler to require a valid admin session cookie.
export function withAdminAuth(handler) {
  return async (req, res) => {
    const token = getTokenFromReq(req);
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      res.status(401).json({ error: 'ไม่ได้เข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่' });
      return;
    }
    req.admin = session;
    return handler(req, res);
  };
}
