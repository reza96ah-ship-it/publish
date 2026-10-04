import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../setup'
import { CustomerInviteIssuer } from '@/app/(dashboard)/settings/customer-invites/customer-invite-issuer'

describe('CustomerInviteIssuer', () => {
  it('shows password rotation before MFA setup or customer invitations', () => {
    renderWithProviders(<CustomerInviteIssuer initialMfaEnabled={false} passwordRotated={false} />)

    expect(screen.getByRole('link', { name: 'تغییر رمز حساب' })).toHaveAttribute('href', '/settings/security')
    expect(screen.queryByRole('button', { name: 'دریافت کد QR' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ساخت دعوت‌نامه' })).not.toBeInTheDocument()
  })

  it('keeps invitations hidden until MFA is enabled after rotation', () => {
    renderWithProviders(<CustomerInviteIssuer initialMfaEnabled={false} passwordRotated />)

    expect(screen.getByRole('button', { name: 'دریافت کد QR' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ساخت دعوت‌نامه' })).not.toBeInTheDocument()
  })
})
