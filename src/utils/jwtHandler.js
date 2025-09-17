import jwt from "jsonwebtoken";

const getJwtConfig = () => {
  return {
    secret: process.env.JWT_SECRET,
    expires: process.env.JWT_EXPIRES,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpires: process.env.JWT_REFRESH_EXPIRES,
  };
};

export function generateAccessToken(user) {
  const { secret, expires } = getJwtConfig();
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    secret,
    { expiresIn: expires }
  );
}

export function generateRefreshToken(user) {
  const { refreshSecret, refreshExpires } = getJwtConfig();
  return jwt.sign({ id: user._id, email: user.email }, refreshSecret, {
    expiresIn: refreshExpires,
  });
}

export function verifyAccessToken(token) {
  const { secret } = getJwtConfig();
  return jwt.verify(token, secret);
}

export function verifyRefreshToken(token) {
  const { refreshSecret } = getJwtConfig();
  return jwt.verify(token, refreshSecret);
}
