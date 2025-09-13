import { historicalPriceService } from './historical-price.service'
import type { AuthUser } from '@/lib/auth/client.auth.service'
import type { Symbol } from '@/lib/supabase/types'

export type SupportedCurrency = 'USD' | 'EUR' | 'GBP'

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ['USD', 'EUR', 'GBP']

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: '$',
  EUR: '€', 
  GBP: '£'
}

export const CURRENCY_NAMES: Record<SupportedCurrency, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound'
}

/**
 * Simplified currency service that uses existing currency pair symbols
 * for exchange rate conversion between USD, EUR, and GBP
 */
export class CurrencyService {
  private static readonly CURRENCY_PAIR_SYMBOLS = {
    EURUSD: 'EURUSD', // EUR to USD rate
    GBPUSD: 'GBPUSD'  // GBP to USD rate
  }

  private static readonly STORAGE_KEY = 'preferred_currency'
  private static readonly DEFAULT_CURRENCY: SupportedCurrency = 'USD'

  /**
   * Get user's preferred currency from localStorage
   */
  getPreferredCurrency(): SupportedCurrency {
    if (typeof window === 'undefined') return CurrencyService.DEFAULT_CURRENCY
    
    const stored = localStorage.getItem(CurrencyService.STORAGE_KEY)
    if (stored && SUPPORTED_CURRENCIES.includes(stored as SupportedCurrency)) {
      return stored as SupportedCurrency
    }
    return CurrencyService.DEFAULT_CURRENCY
  }

  /**
   * Set user's preferred currency in localStorage
   */
  setPreferredCurrency(currency: SupportedCurrency): void {
    if (typeof window === 'undefined') return
    
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      throw new Error(`Unsupported currency: ${currency}`)
    }
    localStorage.setItem(CurrencyService.STORAGE_KEY, currency)
  }

  /**
   * Get current exchange rate from one currency to another
   */
  async getExchangeRate(
    from: SupportedCurrency,
    to: SupportedCurrency,
    user: AuthUser,
    symbols: Symbol[],
    date?: string
  ): Promise<number> {
    // Same currency = 1:1 rate
    if (from === to) return 1.0

    // Get the latest rates from currency pair symbols
    const rates = await this.getCurrentRates(user, symbols, date)
    
    return this.calculateCrossRate(from, to, rates)
  }

  /**
   * Convert an amount from one currency to another
   */
  async convertAmount(
    amount: number,
    from: SupportedCurrency, 
    to: SupportedCurrency,
    user: AuthUser,
    symbols: Symbol[],
    date?: string
  ): Promise<number> {
    const rate = await this.getExchangeRate(from, to, user, symbols, date)
    return amount * rate
  }

  /**
   * Format currency amount according to user preference
   */
  formatCurrency(amount: number, currency?: SupportedCurrency): string {
    const targetCurrency = currency || this.getPreferredCurrency()
    const symbol = CURRENCY_SYMBOLS[targetCurrency]
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: targetCurrency,
      minimumFractionDigits: 2,
      currencyDisplay: 'symbol'
    }).format(amount)
  }

  /**
   * Get all supported currencies
   */
  getSupportedCurrencies(): SupportedCurrency[] {
    return [...SUPPORTED_CURRENCIES]
  }

  /**
   * Get current exchange rates from currency pair symbols
   */
  private async getCurrentRates(
    user: AuthUser,
    symbols: Symbol[],
    date?: string
  ): Promise<{ EURUSD: number; GBPUSD: number }> {
    try {
      const eurusdSymbol = symbols.find(s => s.symbol === CurrencyService.CURRENCY_PAIR_SYMBOLS.EURUSD)
      const gbpusdSymbol = symbols.find(s => s.symbol === CurrencyService.CURRENCY_PAIR_SYMBOLS.GBPUSD)

      let eurusdRate: number
      let gbpusdRate: number

      if (date) {
        // Get historical rates for specific date
        eurusdRate = await historicalPriceService.getHistoricalPriceForDate(
          CurrencyService.CURRENCY_PAIR_SYMBOLS.EURUSD,
          date,
          user,
          eurusdSymbol || null
        ) || 1.0856 // fallback
        
        gbpusdRate = await historicalPriceService.getHistoricalPriceForDate(
          CurrencyService.CURRENCY_PAIR_SYMBOLS.GBPUSD,
          date,
          user,
          gbpusdSymbol || null
        ) || 1.2845 // fallback
      } else {
        // Use current prices from symbols
        eurusdRate = eurusdSymbol?.last_price || 1.0856 // fallback
        gbpusdRate = gbpusdSymbol?.last_price || 1.2845 // fallback
      }

      return {
        EURUSD: eurusdRate,
        GBPUSD: gbpusdRate
      }
    } catch (error) {
      console.warn('Failed to fetch current exchange rates, using fallback:', error)
      // Fallback to hardcoded rates from mockData
      return {
        EURUSD: 1.0856,
        GBPUSD: 1.2845
      }
    }
  }

  /**
   * Calculate cross-currency exchange rate using USD as base
   */
  private calculateCrossRate(
    from: SupportedCurrency,
    to: SupportedCurrency,
    rates: { EURUSD: number; GBPUSD: number }
  ): number {
    // USD is our base currency - all rates are relative to USD
    const fromToUsdRate = this.getCurrencyToUsdRate(from, rates)
    const toToUsdRate = this.getCurrencyToUsdRate(to, rates)
    
    // Convert: from -> USD -> to
    // Rate = (1 / fromToUsdRate) * (1 / toToUsdRate) = 1 / (fromToUsdRate * toToUsdRate)
    // But we want from -> to, so it's: fromToUsdRate / toToUsdRate
    return fromToUsdRate / toToUsdRate
  }

  /**
   * Get exchange rate from any supported currency to USD
   */
  private getCurrencyToUsdRate(
    currency: SupportedCurrency,
    rates: { EURUSD: number; GBPUSD: number }
  ): number {
    switch (currency) {
      case 'USD':
        return 1.0 // USD to USD = 1
      case 'EUR':
        return rates.EURUSD // EUR to USD rate
      case 'GBP':
        return rates.GBPUSD // GBP to USD rate
      default:
        throw new Error(`Unsupported currency: ${currency}`)
    }
  }
}

// Singleton instance
export const currencyService = new CurrencyService()