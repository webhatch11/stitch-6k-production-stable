export interface CategorySales {
  category: string;
  revenue: number;
  orderCount: number;
  unitsSold: number;
  percentage: number;
}

export interface RepeatPurchaseStats {
  totalCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
}

export interface AdSpend {
  id?: string;
  channel: string;
  month: string;
  spendAmount: number;
  campaignName?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export interface ROASReport {
  channel: string;
  month: string;
  spend: number;
  revenue: number;
  roas: number;
  roasFormatted: string;
}
