/** Password checks shared by invitation signup and self-service rotation. */
export function isStrongAppPassword(password: string, email: string): boolean {
  if (password.length < 12 || password.length > 128) return false
  const lower = password.toLowerCase()
  const normalizedEmail = email.toLowerCase().trim()
  const localPart = normalizedEmail.split('@')[0]
  return !lower.includes(normalizedEmail) &&
    !(localPart.length >= 4 && lower.includes(localPart)) &&
    !/^(.)\1+$/.test(lower) &&
    !['password', 'qwerty', '123456', 'adminadmin'].some((weak) => lower.includes(weak))
}
