import { accountHoldingService, AccountHoldingService } from '../account-holding.service'
import type { Symbol } from '@/lib/supabase/types'
import type { AuthUser } from '@/lib/auth/client.auth.service'

describe('AccountHoldingService', () => {
  const mockUser: AuthUser = {
    id: 'test-user',
    email: 'test@example.com',
    created_at: '2021-01-01T00:00:00Z',
    aud: 'authenticated',
    user_metadata: {},
    app_metadata: {}
  }

  describe('isAccountHolding', () => {
    it('should return true for account holdings', () => {
      const accountSymbol: Symbol = {
        symbol: 'BINANCE_TRADING',
        name: 'Binance Trading Account',
        asset_type: 'other',
        currency: 'USD',
        is_custom: true,
        created_by_user_id: mockUser.id,
        holding_type: 'account',
        metadata: {
          account_type: 'crypto_exchange',
          provider: 'Binance'
        },
        created_at: '2024-01-01T00:00:00Z',
        last_price: null,
        last_updated: null
      }

      expect(accountHoldingService.isAccountHolding(accountSymbol)).toBe(true)
    })

    it('should return false for standard holdings', () => {
      const standardSymbol: Symbol = {
        symbol: 'AAPL',
        name: 'Apple Inc',
        asset_type: 'stock',
        currency: 'USD',
        is_custom: false,
        created_by_user_id: null,
        holding_type: 'standard',
        metadata: {},
        created_at: '2023-01-01T00:00:00Z',
        last_price: 155.00,
        last_updated: '2023-01-01T00:00:00Z'
      }

      expect(accountHoldingService.isAccountHolding(standardSymbol)).toBe(false)
    })
  })

  describe('calculateDepositUnits', () => {
    it('should correctly calculate units for a deposit', () => {
      const depositAmount = 5000
      const currentPricePerUnit = 1.20

      const units = accountHoldingService.calculateDepositUnits(depositAmount, currentPricePerUnit)

      expect(units).toBeCloseTo(4166.67, 2)
    })

    it('should handle deposit with price per unit of 1', () => {
      const depositAmount = 10000
      const currentPricePerUnit = 1

      const units = accountHoldingService.calculateDepositUnits(depositAmount, currentPricePerUnit)

      expect(units).toBe(10000)
    })

    it('should throw error when price per unit is zero', () => {
      expect(() => {
        accountHoldingService.calculateDepositUnits(5000, 0)
      }).toThrow('Cannot calculate deposit units: price per unit is zero')
    })
  })

  describe('calculateNewPricePerUnit', () => {
    it('should correctly calculate new price per unit', () => {
      const newBalance = 17500
      const currentQuantity = 14166.67

      const newPrice = accountHoldingService.calculateNewPricePerUnit(newBalance, currentQuantity)

      expect(newPrice).toBeCloseTo(1.235, 3)
    })

    it('should handle balance update with same quantity', () => {
      const newBalance = 12000
      const currentQuantity = 10000

      const newPrice = accountHoldingService.calculateNewPricePerUnit(newBalance, currentQuantity)

      expect(newPrice).toBe(1.2)
    })

    it('should throw error when current quantity is zero', () => {
      expect(() => {
        accountHoldingService.calculateNewPricePerUnit(10000, 0)
      }).toThrow('Cannot calculate new price per unit: current quantity is zero')
    })
  })

  describe('Account Holding Creation Flow', () => {
    it('should calculate correct initial values', () => {
      const initialValue = 10000
      const initialPricePerUnit = 1

      // Initial transaction: buy initialValue units @ $1
      const initialQuantity = initialValue / initialPricePerUnit
      expect(initialQuantity).toBe(10000)

      // Initial value
      const initialBalance = initialQuantity * initialPricePerUnit
      expect(initialBalance).toBe(10000)
    })
  })

  describe('Deposit/Withdrawal Flow', () => {
    it('should calculate correct deposit values', () => {
      const currentQuantity = 10000
      const currentPricePerUnit = 1.20
      const depositAmount = 5000

      // Calculate units to add
      const unitsToAdd = accountHoldingService.calculateDepositUnits(depositAmount, currentPricePerUnit)
      expect(unitsToAdd).toBeCloseTo(4166.67, 2)

      // New quantity
      const newQuantity = currentQuantity + unitsToAdd
      expect(newQuantity).toBeCloseTo(14166.67, 2)

      // Value should be correct
      const newValue = newQuantity * currentPricePerUnit
      expect(newValue).toBeCloseTo(17000, 0)
    })

    it('should calculate correct withdrawal values', () => {
      const currentQuantity = 14166.67
      const currentPricePerUnit = 1.20
      const withdrawalAmount = 3000

      // Calculate units to remove (same calculation as deposit)
      const unitsToRemove = accountHoldingService.calculateDepositUnits(withdrawalAmount, currentPricePerUnit)
      expect(unitsToRemove).toBeCloseTo(2500, 2)

      // New quantity
      const newQuantity = currentQuantity - unitsToRemove
      expect(newQuantity).toBeCloseTo(11666.67, 2)

      // Value should be correct
      const newValue = newQuantity * currentPricePerUnit
      expect(newValue).toBeCloseTo(14000, 0)
    })
  })

  describe('Balance Update Flow', () => {
    it('should calculate new price per unit correctly', () => {
      // User has 14,166.67 units @ $1.20 = $17,000
      const currentQuantity = 14166.67
      const currentPricePerUnit = 1.20
      const currentValue = currentQuantity * currentPricePerUnit
      expect(currentValue).toBeCloseTo(17000, 0)

      // User checks account, now worth $17,500
      const newBalance = 17500

      // Calculate new price per unit
      const newPricePerUnit = accountHoldingService.calculateNewPricePerUnit(newBalance, currentQuantity)
      expect(newPricePerUnit).toBeCloseTo(1.235, 3)

      // Verify new value
      const verifyValue = currentQuantity * newPricePerUnit
      expect(verifyValue).toBeCloseTo(17500, 0)
    })
  })

  describe('Complete Account Lifecycle', () => {
    it('should track account correctly through multiple operations', () => {
      // 1. Initial: $10,000 @ $1 = 10,000 units
      let quantity = 10000
      let pricePerUnit = 1
      let value = quantity * pricePerUnit
      expect(value).toBe(10000)

      // 2. Deposit $5,000 at price $1.20
      pricePerUnit = 1.20
      const depositUnits = accountHoldingService.calculateDepositUnits(5000, pricePerUnit)
      quantity += depositUnits
      value = quantity * pricePerUnit
      expect(quantity).toBeCloseTo(14166.67, 2)
      expect(value).toBeCloseTo(17000, 0)

      // 3. Balance update: account now worth $17,500
      pricePerUnit = accountHoldingService.calculateNewPricePerUnit(17500, quantity)
      value = quantity * pricePerUnit
      expect(pricePerUnit).toBeCloseTo(1.235, 3)
      expect(value).toBeCloseTo(17500, 0)

      // 4. Withdraw $3,000
      const withdrawalUnits = accountHoldingService.calculateDepositUnits(3000, pricePerUnit)
      quantity -= withdrawalUnits
      value = quantity * pricePerUnit
      expect(quantity).toBeCloseTo(11738.10, 1)
      expect(value).toBeCloseTo(14500, 0)

      // 5. Final balance update: account now worth $15,000
      pricePerUnit = accountHoldingService.calculateNewPricePerUnit(15000, quantity)
      value = quantity * pricePerUnit
      expect(pricePerUnit).toBeCloseTo(1.278, 3)
      expect(value).toBeCloseTo(15000, 0)
    })
  })

  describe('Performance Metrics Validation', () => {
    it('should calculate correct cost basis for account holdings', () => {
      // Initial: $10,000 @ $1 = 10,000 units
      const initialCost = 10000

      // Deposit: $5,000 @ $1.20 = 4,166.67 units
      const depositCost = 5000

      // Total cost basis
      const totalCostBasis = initialCost + depositCost
      expect(totalCostBasis).toBe(15000)

      // Total units
      const totalUnits = 10000 + 4166.67
      expect(totalUnits).toBeCloseTo(14166.67, 2)

      // Current value after balance update: $17,500
      const currentValue = 17500

      // Unrealized P&L
      const unrealizedPL = currentValue - totalCostBasis
      expect(unrealizedPL).toBe(2500)

      // Unrealized P&L %
      const unrealizedPLPercent = (unrealizedPL / totalCostBasis) * 100
      expect(unrealizedPLPercent).toBeCloseTo(16.67, 2)
    })
  })
})
