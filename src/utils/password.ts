import bcrypt from "bcrypt";

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export function comparePassword(plain: string, hashed: string) {
  return bcrypt.compare(plain, hashed);
}
