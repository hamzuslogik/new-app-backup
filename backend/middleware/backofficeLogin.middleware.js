/**
 * Accès réservé à l'utilisateur dont le login est exactement "backoffice".
 */
const requireBackofficeLogin = (req, res, next) => {
  const login = String(req.user?.login || '').trim().toLowerCase();
  if (login !== 'backoffice') {
    return res.status(403).json({
      success: false,
      message: 'Accès réservé au compte backoffice'
    });
  }
  next();
};

module.exports = { requireBackofficeLogin };
