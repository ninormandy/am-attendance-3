import { getTokenFromReq, verifySessionToken } from '../../../lib/auth';

export default async function handler(req, res) {
  const token = getTokenFromReq(req);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return res.status(401).json({ authenticated: false });
  }
  return res.status(200).json({ authenticated: true, username: session.username });
}
