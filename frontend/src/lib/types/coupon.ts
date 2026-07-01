/**
 * TypeScript types for Coupon Management System
 */

export interface CouponCampaign {
  id: string;
  name_en: string;
  name_ar: string;
  campaign_code: string;
  description?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  terms_conditions_en?: string;
  terms_conditions_ar?: string;
  max_claims_per_customer?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface CouponProduct {
  id: string;
  campaign_id: string;
  product_name_en: string;
  product_name_ar: string;
  product_image_url?: string;
  original_price: number;
  offer_price: number;
  special_barcode: string;
  stock_limit: number;
  stock_remaining: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface CouponEligibleCustomer {
  id: string;
  campaign_id: string;
  mobile_number: string;
  customer_name?: string;
  import_batch_id?: string;
  imported_at: string;
  imported_by?: string;
  created_at: string;
}

export interface CouponClaim {
  id: string;
  campaign_id: string;
  customer_mobile: string;
  product_id?: string;
  branch_id?: number;
  claimed_by_user?: string;
  claimed_at: string;
  print_count: number;
  barcode_scanned: boolean;
  validity_date: string;
  status: 'claimed' | 'redeemed' | 'expired';
  created_at: string;
}

export interface CampaignStatistics {
  total_eligible_customers: number;
  total_claims: number;
  remaining_claims: number;
  total_stock_limit: number;
  total_stock_remaining: number;
  claim_percentage?: number;
  products: ProductStatistics[];
}

export interface ProductStatistics {
  product_id: string;
  product_name_en: string;
  product_name_ar: string;
  stock_limit: number;
  stock_remaining: number;
  claims_count: number;
}
