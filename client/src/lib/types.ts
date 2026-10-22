export type Role = 'FARMER' | 'BUYER' | 'INSTITUTION' | 'BAZAAR_COMMITTEE' | 'ADMIN';
export type Unit = 'KG' | 'MAUND' | 'TON';

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  role: Role;
  organization_name: string | null;
  region: string;
  is_verified: boolean | number;
}

export interface Corridor {
  isValid: boolean;
  complianceStatus: 'BAZAAR_VERIFIED' | 'BELOW_FLOOR' | 'ABOVE_CEILING' | 'UNBENCHMARKED';
  fairPriceBadge: string;
  varianceFromModalPct: number | null;
  message: string;
}

export interface BenchmarkLite {
  min_price: number;
  modal_price: number;
  max_price: number;
}

export interface Benchmark extends BenchmarkLite {
  id: number;
  crop_category: string;
  bazaar_region: string;
  unit: Unit;
  effective_date: string;
  market_notes: string | null;
  verifier_name?: string;
  committee_name?: string | null;
}

export interface BenchFields {
  bazaar_min_price: number | null;
  bazaar_modal_price: number | null;
  bazaar_max_price: number | null;
}

export interface Crop extends BenchFields {
  id: number;
  farmer_id: number;
  title: string;
  crop_category: string;
  variety: string | null;
  bazaar_region: string;
  quantity_available: number;
  min_order_quantity: number;
  unit: Unit;
  base_price_per_unit: number;
  bulk_threshold_qty: number | null;
  bulk_discount_pct: number;
  harvest_date: string;
  quality_grade: string;
  image_url: string | null;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD_OUT' | 'ARCHIVED';
  farmer_name: string;
  farmer_phone: string;
  fair_price_indicator: Corridor;
}

export type NegotiationStatus = 'OPEN' | 'COUNTERED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface Negotiation extends BenchFields {
  id: number;
  crop_id: number;
  buyer_id: number;
  farmer_id: number;
  requested_quantity: number;
  current_offer_price: number;
  last_offered_by: 'BUYER' | 'FARMER';
  status: NegotiationStatus;
  updated_at: string;
  crop_title: string;
  crop_category: string;
  unit: Unit;
  bazaar_region: string;
  base_price_per_unit: number;
  quantity_available: number;
  bulk_threshold_qty: number | null;
  bulk_discount_pct: number;
  buyer_name: string;
  buyer_role: Role;
  buyer_organization: string | null;
  farmer_name: string;
}

export interface Message {
  id: number;
  negotiation_id: number;
  sender_id: number;
  message_type: 'TEXT' | 'BID_OFFER' | 'COUNTER_OFFER' | 'SYSTEM_ALERT';
  content: string;
  offered_unit_price: number | null;
  offered_quantity: number | null;
  created_at: string;
  sender_name: string;
  sender_role: Role;
}

export interface Order {
  id: number;
  receipt_number: string;
  crop_id: number;
  negotiation_id: number | null;
  buyer_id: number;
  farmer_id: number;
  quantity_ordered: number;
  unit: Unit;
  unit_price_agreed: number;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  pricing_strategy_used: string;
  receipt_type: string;
  payment_status: string;
  order_status: string;
  delivery_address: string;
  created_at: string;
  crop_title: string;
  crop_category: string;
  bazaar_region: string;
  buyer_name: string;
  buyer_organization: string | null;
  farmer_name: string;
}

export interface Receipt {
  receiptNumber: string;
  receiptType: string;
  documentTitle: string;
  issuedAt: string;
  paymentStatus: string;
  orderStatus: string;
  deliveryAddress: string;
  seller: { name: string; phone: string; region: string };
  buyer: { name: string; phone: string; organization: string; role: string };
  lineItem: {
    cropTitle: string;
    cropCategory: string;
    qualityGrade: string;
    quantity: number;
    unit: string;
    unitPriceAgreed: number;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    pricingStrategy: string;
  };
  gatePassCode?: string;
  escrowInstructions?: string;
  procurementVoucherId?: string;
  taxNotice?: string;
  vatRatePct?: number;
  certificationBadge?: string;
  bazaarCorridorSnapshot?: {
    region: string;
    minPrice: number;
    modalPrice: number;
    maxPrice: number;
    effectiveDate: string;
  } | null;
}

export interface PricePreview {
  strategyUsed: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  corridor: Corridor;
}
