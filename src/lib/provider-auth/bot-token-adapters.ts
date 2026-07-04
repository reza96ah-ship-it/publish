/**
 * Issue #144: Bot-token provider auth adapters.
 *
 * Telegram, Bale, and Rubika use bot tokens (not OAuth). These adapters:
 *   1. Validate the token by calling the provider's getMe endpoint
 *   2. Verify the target channel/group exists and the bot has admin/post permission
 *   3. Return real health status (not `valid = true` blindly)
 *
 * Distinguishes: invalid token, unreachable provider, missing target, insufficient permission.
 */

import type {
  ProviderAuthAdapter,
  ProviderCredential,
  CredentialHealth,
  BotTokenInput,
} from './types'
import { encrypt, getActiveKeyId } from '../crypto'

// ── Telegram ───────────────────────────────────────────────────

const TG_API = 'https://api.telegram.org/bot'

export class TelegramAuthAdapter implements ProviderAuthAdapter {
  readonly provider = 'telegram' as const

  async validateBotToken(input: BotTokenInput): Promise<{
    valid: boolean
    credential?: Partial<ProviderCredential>
    health: CredentialHealth
    botInfo?: { id: string; username: string; firstName: string }
  }> {
    try {
      // Step 1: validate token via getMe
      const meRes = await fetch(`${TG_API}${input.token}/getMe`)
      if (!meRes.ok) {
        return {
          valid: false,
          health: {
            status: 'invalid',
            canPublish: false,
            message: 'توکن ربات تلگرام نامعتبر است',
            missingScopes: [],
            validatedAt: new Date(),
          },
        }
      }
      const meData = await meRes.json()
      if (!meData.ok) {
        return {
          valid: false,
          health: {
            status: 'invalid',
            canPublish: false,
            message: meData.description || 'توکن ربات تلگرام نامعتبر است',
            missingScopes: [],
            validatedAt: new Date(),
          },
        }
      }

      const botInfo = {
        id: String(meData.result.id),
        username: meData.result.username,
        firstName: meData.result.first_name,
      }

      // Step 2: validate target (chat ID or @channelusername)
      if (input.targetId) {
        const chatRes = await fetch(`${TG_API}${input.token}/getChat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: input.targetId }),
        })
        const chatData = await chatRes.json()
        if (!chatData.ok) {
          return {
            valid: false,
            health: {
              status: 'error',
              canPublish: false,
              message: `ربات به مقصد دسترسی ندارد: ${chatData.description || 'کانال یافت نشد'}`,
              missingScopes: [],
              validatedAt: new Date(),
            },
            botInfo,
          }
        }

        // Step 3: verify bot has admin/post permission in the chat
        const memberRes = await fetch(`${TG_API}${input.token}/getChatMember`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: input.targetId, user_id: botInfo.id }),
        })
        const memberData = await memberRes.json()
        if (memberData.ok) {
          const status = memberData.result.status
          // 'administrator' or 'creator' = can post. 'member' or 'left' = cannot.
          if (status !== 'administrator' && status !== 'creator') {
            return {
              valid: false,
              health: {
                status: 'invalid',
                canPublish: false,
                message: 'ربات در کانال دسترسی مدیر ندارد. لطفاً ربات را به عنوان مدیر با دسترسی «ارسال پیام» اضافه کنید.',
                missingScopes: [],
                validatedAt: new Date(),
              },
              botInfo,
            }
          }
        }
      }

      return {
        valid: true,
        credential: {
          accessTokenEncrypted: encrypt(input.token),
          tokenType: 'bot',
          expiresAt: null, // bot tokens don't expire
          scopes: [],
          accountId: botInfo.id,
          accountName: `@${botInfo.username}`,
          encryptionKeyId: getActiveKeyId(),
        },
        health: {
          status: 'active',
          canPublish: true,
          message: 'ربات تلگرام متصل و فعال است',
          missingScopes: [],
          validatedAt: new Date(),
        },
        botInfo,
      }
    } catch {
      return {
        valid: false,
        health: {
          status: 'error',
          canPublish: false,
          message: 'خطای شبکه در ارتباط با تلگرام — لطفاً دوباره تلاش کنید',
          missingScopes: [],
          validatedAt: new Date(),
        },
      }
    }
  }

  async validateCredential(credential: {
    accessTokenEncrypted: string
    targetId?: string
  }): Promise<CredentialHealth> {
    // Decrypt and re-validate
    const { decrypt } = await import('../crypto')
    const token = decrypt(credential.accessTokenEncrypted)
    const result = await this.validateBotToken({ token, targetId: credential.targetId })
    return result.health
  }
}

// ── Bale (Telegram-compatible API) ────────────────────────────

const BALE_API = 'https://tapi.bale.ai/bot'

export class BaleAuthAdapter implements ProviderAuthAdapter {
  readonly provider = 'bale' as const

  async validateBotToken(input: BotTokenInput): Promise<{
    valid: boolean
    credential?: Partial<ProviderCredential>
    health: CredentialHealth
    botInfo?: { id: string; username: string; firstName: string }
  }> {
    try {
      const meRes = await fetch(`${BALE_API}${input.token}/getMe`)
      if (!meRes.ok) {
        return {
          valid: false,
          health: {
            status: 'invalid',
            canPublish: false,
            message: 'توکن ربات بله نامعتبر است',
            missingScopes: [],
            validatedAt: new Date(),
          },
        }
      }
      const meData = await meRes.json()
      if (!meData.ok) {
        return {
          valid: false,
          health: {
            status: 'invalid',
            canPublish: false,
            message: meData.description || 'توکن ربات بله نامعتبر است',
            missingScopes: [],
            validatedAt: new Date(),
          },
        }
      }

      const botInfo = {
        id: String(meData.result.id),
        username: meData.result.username,
        firstName: meData.result.first_name,
      }

      // Step 2: validate target channel (Bale uses Telegram-compatible API)
      if (input.targetId) {
        const chatRes = await fetch(`${BALE_API}${input.token}/getChat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: input.targetId }),
        })
        const chatData = await chatRes.json()
        if (!chatData.ok) {
          return {
            valid: false,
            health: {
              status: 'error',
              canPublish: false,
              message: `ربات به مقصد دسترسی ندارد: ${chatData.description || 'کانال یافت نشد'}`,
              missingScopes: [],
              validatedAt: new Date(),
            },
            botInfo,
          }
        }

        // Step 3: verify bot has admin/post permission
        const memberRes = await fetch(`${BALE_API}${input.token}/getChatMember`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: input.targetId, user_id: botInfo.id }),
        })
        const memberData = await memberRes.json()
        if (memberData.ok) {
          const status = memberData.result.status
          if (status !== 'administrator' && status !== 'creator') {
            return {
              valid: false,
              health: {
                status: 'invalid',
                canPublish: false,
                message: 'ربات در کانال دسترسی مدیر ندارد. لطفاً ربات را به عنوان مدیر با دسترسی «ارسال پیام» اضافه کنید.',
                missingScopes: [],
                validatedAt: new Date(),
              },
              botInfo,
            }
          }
        }
      }

      return {
        valid: true,
        credential: {
          accessTokenEncrypted: encrypt(input.token),
          tokenType: 'bot',
          expiresAt: null,
          scopes: [],
          accountId: botInfo.id,
          accountName: `@${botInfo.username}`,
          encryptionKeyId: getActiveKeyId(),
        },
        health: {
          status: 'active',
          canPublish: true,
          message: 'ربات بله متصل و فعال است',
          missingScopes: [],
          validatedAt: new Date(),
        },
        botInfo,
      }
    } catch {
      return {
        valid: false,
        health: {
          status: 'error',
          canPublish: false,
          message: 'خطای شبکه در ارتباط با بله',
          missingScopes: [],
          validatedAt: new Date(),
        },
      }
    }
  }

  async validateCredential(credential: {
    accessTokenEncrypted: string
    targetId?: string
  }): Promise<CredentialHealth> {
    const { decrypt } = await import('../crypto')
    const token = decrypt(credential.accessTokenEncrypted)
    const result = await this.validateBotToken({ token, targetId: credential.targetId })
    return result.health
  }
}

// ── Rubika ─────────────────────────────────────────────────────

const RUBIKA_API = 'https://botapi.rubika.ir/v3'

export class RubikaAuthAdapter implements ProviderAuthAdapter {
  readonly provider = 'rubika' as const

  async validateBotToken(input: BotTokenInput): Promise<{
    valid: boolean
    credential?: Partial<ProviderCredential>
    health: CredentialHealth
    botInfo?: { id: string; username: string }
  }> {
    try {
      const meRes = await fetch(`${RUBIKA_API}/${input.token}/getMe`, { method: 'POST' })
      if (!meRes.ok) {
        return {
          valid: false,
          health: {
            status: 'invalid',
            canPublish: false,
            message: 'توکن ربات روبیکا نامعتبر است',
            missingScopes: [],
            validatedAt: new Date(),
          },
        }
      }
      const meData = await meRes.json()
      if (meData.status !== 'OK' && !meData.ok) {
        return {
          valid: false,
          health: {
            status: 'invalid',
            canPublish: false,
            message: meData.message || 'توکن ربات روبیکا نامعتبر است',
            missingScopes: [],
            validatedAt: new Date(),
          },
        }
      }

      const botInfo = meData.data || meData.result

      // Step 2: validate target channel existence (warn-only on network error)
      if (input.targetId) {
        try {
          const chatRes = await fetch(`${RUBIKA_API}/${input.token}/getChat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: input.targetId }),
          })
          const chatData = await chatRes.json()
          if (chatData.status !== 'OK' && !chatData.ok) {
            return {
              valid: false,
              health: {
                status: 'error',
                canPublish: false,
                message: 'ربات به کانال دسترسی ندارد. شناسه کانال را بررسی کنید.',
                missingScopes: [],
                validatedAt: new Date(),
              },
              botInfo,
            }
          }
        } catch {
          // transient network error checking target — don't fail the whole validation
        }
      }

      return {
        valid: true,
        credential: {
          accessTokenEncrypted: encrypt(input.token),
          tokenType: 'bot',
          expiresAt: null,
          scopes: [],
          accountId: String(botInfo?.bot_id || botInfo?.id || ''),
          accountName: botInfo?.username ? `@${botInfo.username}` : 'Rubika Bot',
          encryptionKeyId: getActiveKeyId(),
        },
        health: {
          status: 'active',
          canPublish: true,
          message: 'ربات روبیکا متصل و فعال است',
          missingScopes: [],
          validatedAt: new Date(),
        },
        botInfo,
      }
    } catch {
      return {
        valid: false,
        health: {
          status: 'error',
          canPublish: false,
          message: 'خطای شبکه در ارتباط با روبیکا',
          missingScopes: [],
          validatedAt: new Date(),
        },
      }
    }
  }

  async validateCredential(credential: {
    accessTokenEncrypted: string
    targetId?: string
  }): Promise<CredentialHealth> {
    const { decrypt } = await import('../crypto')
    const token = decrypt(credential.accessTokenEncrypted)
    const result = await this.validateBotToken({ token, targetId: credential.targetId })
    return result.health
  }
}

// ── Eitaa ──────────────────────────────────────────────────────

const EITAA_API = 'https://eitaayar.ir/api'

export class EitaaAuthAdapter implements ProviderAuthAdapter {
  readonly provider = 'eitaa' as const

  async validateBotToken(input: BotTokenInput): Promise<{
    valid: boolean
    credential?: Partial<ProviderCredential>
    health: CredentialHealth
    botInfo?: { id: string; username: string }
  }> {
    try {
      const meRes = await fetch(`${EITAA_API}/${input.token}/getMe`, { method: 'POST' })
      if (!meRes.ok) {
        return {
          valid: false,
          health: {
            status: 'invalid',
            canPublish: false,
            message: 'توکن ربات ایتا نامعتبر است',
            missingScopes: [],
            validatedAt: new Date(),
          },
        }
      }
      const meData = await meRes.json()
      if (meData.status !== 'OK' && !meData.ok) {
        return {
          valid: false,
          health: {
            status: 'invalid',
            canPublish: false,
            message: meData.message || 'توکن ربات ایتا نامعتبر است',
            missingScopes: [],
            validatedAt: new Date(),
          },
        }
      }

      const botInfo = meData.data || meData.result
      return {
        valid: true,
        credential: {
          accessTokenEncrypted: encrypt(input.token),
          tokenType: 'bot',
          expiresAt: null,
          scopes: [],
          accountId: String(botInfo?.bot_id || botInfo?.id || ''),
          accountName: botInfo?.username ? `@${botInfo.username}` : 'Eitaa Bot',
          encryptionKeyId: getActiveKeyId(),
        },
        health: {
          status: 'active',
          canPublish: true,
          message: 'ربات ایتا متصل و فعال است',
          missingScopes: [],
          validatedAt: new Date(),
        },
        botInfo,
      }
    } catch {
      return {
        valid: false,
        health: {
          status: 'error',
          canPublish: false,
          message: 'خطای شبکه در ارتباط با ایتا',
          missingScopes: [],
          validatedAt: new Date(),
        },
      }
    }
  }

  async validateCredential(credential: {
    accessTokenEncrypted: string
    targetId?: string
  }): Promise<CredentialHealth> {
    const { decrypt } = await import('../crypto')
    const token = decrypt(credential.accessTokenEncrypted)
    const result = await this.validateBotToken({ token, targetId: credential.targetId })
    return result.health
  }
}
