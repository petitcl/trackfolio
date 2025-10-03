import { SupportedCurrency } from "../services/currency.service"

export const getPnLColor = (pnl: number | undefined) => {
    if (!pnl) return 'text-gray-600 dark:text-gray-400'
    if (pnl > 0) return 'text-green-600 dark:text-green-400'
    else return 'text-red-600 dark:text-red-400'
}

export const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`
}

export const makeFormatCurrency = (currency: SupportedCurrency): ((amount: number) => string) => {
    return (amount: number): string =>
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
            currencyDisplay: "symbol",
        }).format(amount);
};

export const getAssetTypeIcon = (assetType: string) => {
    const icons: Record<string, string> = {
        stock: '📈',
        crypto: '₿',
        cash: '💵',
        currency: '💱',
        real_estate: '🏠',
        other: '💎'
    }
    return icons[assetType] || '❓'
}

export const getAssetTypeLabel = (assetType: string) => {
    const labels: Record<string, string> = {
        stock: 'Stocks',
        crypto: 'Crypto',
        cash: 'Cash',
        currency: 'Currency',
        real_estate: 'Real Estate',
        other: 'Other Assets'
    }
    return labels[assetType] || 'Unknown'
}
