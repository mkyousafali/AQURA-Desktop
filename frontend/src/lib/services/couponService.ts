/**
 * Coupon Management Service
 * Handles all coupon system operations
 */

import { supabase } from '$lib/utils/supabase';
import type { 
  CouponCampaign, 
  CouponProduct, 
  CouponEligibleCustomer,
  CouponClaim 
} from '$lib/types/coupon';

// ==================== CAMPAIGNS ====================

export async function createCampaign(campaignData: Partial<CouponCampaign>) {
  const { data, error } = await supabase
    .from('coupon_campaigns')
    .insert(campaignData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateCampaign(id: string, updates: Partial<CouponCampaign>) {
  const { data, error } = await supabase
    .from('coupon_campaigns')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getAllCampaigns() {
  const { data, error } = await supabase
    .from('coupon_campaigns')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getCampaignById(id: string) {
  const { data, error } = await supabase
    .from('coupon_campaigns')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  
  if (error) throw error;
  return data;
}

export async function toggleCampaignStatus(id: string, isActive: boolean) {
  const { data, error } = await supabase
    .from('coupon_campaigns')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function softDeleteCampaign(id: string) {
  const { data, error } = await supabase
    .from('coupon_campaigns')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Alias for consistency with component usage
export const deleteCampaign = softDeleteCampaign;

export async function generateCampaignCode() {
  const { data, error } = await supabase
    .rpc('generate_campaign_code');
  
  if (error) throw error;
  return data;
}

export async function getCampaignStatistics(campaignId: string) {
  const { data, error } = await supabase
    .rpc('get_campaign_statistics', { p_campaign_id: campaignId });
  
  if (error) throw error;
  return data;
}

// ==================== PRODUCTS ====================

export async function createProduct(productData: Partial<CouponProduct>) {
  const { data, error } = await supabase
    .from('coupon_products')
    .insert(productData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, updates: Partial<CouponProduct>) {
  const { data, error } = await supabase
    .from('coupon_products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getProductsByCampaign(campaignId: string) {
  const { data, error } = await supabase
    .from('coupon_products')
    .select('*')
    .eq('campaign_id', campaignId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function toggleProductStatus(id: string, isActive: boolean) {
  const { data, error } = await supabase
    .from('coupon_products')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateProductStock(id: string, stockRemaining: number) {
  const { data, error } = await supabase
    .from('coupon_products')
    .update({ stock_remaining: stockRemaining })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function softDeleteProduct(id: string) {
  const { data, error } = await supabase
    .from('coupon_products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ==================== ELIGIBLE CUSTOMERS ====================

export async function importCustomers(
  campaignId: string,
  mobileNumbers: string[],
  importBatchId: string,
  userId: string
) {
  const records = mobileNumbers.map(mobile => ({
    campaign_id: campaignId,
    mobile_number: mobile,
    import_batch_id: importBatchId,
    imported_by: userId
  }));

  const { data, error } = await supabase
    .from('coupon_eligible_customers')
    .insert(records)
    .select();
  
  if (error) throw error;
  return data;
}

export async function getEligibleCustomers(campaignId: string) {
  const { data, error } = await supabase
    .from('coupon_eligible_customers')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('imported_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getEligibleCustomersCount(campaignId: string) {
  const { count, error } = await supabase
    .from('coupon_eligible_customers')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);
  
  if (error) throw error;
  return count || 0;
}

export async function deleteEligibleCustomer(customerId: string) {
  const { data, error } = await supabase
    .from('coupon_eligible_customers')
    .delete()
    .eq('id', customerId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ==================== CLAIMS ====================

export async function getClaimsByCampaign(campaignId: string) {
  const { data, error } = await supabase
    .from('coupon_claims')
    .select(`
      *,
      product:coupon_products(*),
      branch:branches(*),
      user:users(*)
    `)
    .eq('campaign_id', campaignId)
    .order('claimed_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getClaimsCount(campaignId: string) {
  const { count, error } = await supabase
    .from('coupon_claims')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);
  
  if (error) throw error;
  return count || 0;
}

// ==================== IMAGE UPLOAD ====================

export async function uploadProductImage(file: File, productId: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${productId}-${Date.now()}.${fileExt}`;
  const filePath = `products/${fileName}`;

  const { data, error } = await supabase.storage
    .from('coupon-product-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from('coupon-product-images')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

export async function deleteProductImage(imageUrl: string) {
  // Extract file path from URL
  const urlParts = imageUrl.split('/');
  const fileName = urlParts[urlParts.length - 1];
  const filePath = `products/${fileName}`;

  const { error } = await supabase.storage
    .from('coupon-product-images')
    .remove([filePath]);

  if (error) throw error;
}
