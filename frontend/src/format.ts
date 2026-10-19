import type { Role } from './api'

const moneyFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "9630" → "9,630.00 THB" */
export function thb(amount: string | number): string {
  return `${moneyFormat.format(Number(amount))} THB`
}

export function amount(value: string | number): string {
  return moneyFormat.format(Number(value))
}

export function qty(value: number): string {
  return value.toLocaleString('en-US')
}

/** "2026-10-22" or an ISO timestamp → "22 Oct 2026" */
export function day(value: string): string {
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function dateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function terms(days: number): string {
  return days === 0 ? 'Cash' : `${days} days`
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  sales: 'Sales',
  warehouse: 'Warehouse',
  accountant: 'Accountant',
}

export const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  promptpay: 'PromptPay',
  cash: 'Cash',
  cheque: 'Cheque',
}
