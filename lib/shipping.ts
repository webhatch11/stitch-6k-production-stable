export type ShippingMode = 
  'free_always' | 
  'paid_always' | 
  'free_above' |
  'flat_rate';

export interface ShippingRules {
  mode: ShippingMode;
  flatRate: number;
  freeAboveAmount: number;
  displayMessage: string;
}

export function calculateShipping(
  cartTotal: number,
  rules: ShippingRules
): number {
  switch (rules.mode) {
    case 'free_always':
      return 0;
      
    case 'paid_always':
      return rules.flatRate;
      
    case 'free_above':
      return cartTotal >= rules.freeAboveAmount
        ? 0
        : rules.flatRate;
        
    case 'flat_rate':
      return rules.flatRate;
      
    default:
      return 0;
  }
}

export function getShippingMessage(
  cartTotal: number,
  rules: ShippingRules
): string {
  switch (rules.mode) {
    case 'free_always':
      return 'FREE';
      
    case 'paid_always':
      return `₹${rules.flatRate}`;
      
    case 'free_above':
      if (cartTotal >= rules.freeAboveAmount) {
        return 'FREE';
      }
      const remaining = rules.freeAboveAmount - cartTotal;
      return `₹${rules.flatRate} (Add ₹${remaining} more for free shipping)`;
        
    case 'flat_rate':
      return `₹${rules.flatRate}`;
      
    default:
      return 'FREE';
  }
}
