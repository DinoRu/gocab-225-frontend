// Types miroir des schémas Pydantic du backend Parts Orders API.

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// --- Marques ---
export interface VehicleBrand {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// --- Modèles ---
export interface VehicleModel {
  id: string;
  brand_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleModelWithBrand extends VehicleModel {
  brand: VehicleBrand;
}

// --- Pièces ---
// Une pièce est liée à 0, 1 ou N modèles (many-to-many).
// 0 modèle = pièce universelle (huile moteur, etc.).
export interface ModelRef {
  id: string;
  name: string;
  brand_id: string;
  brand_name: string;
}

export interface Part {
  id: string;
  reference: string;
  designation: string;
  category: string | null;
  vehicle_models: ModelRef[];
  is_universal: boolean;
  created_at: string;
  updated_at: string;
}

// Le backend renvoie la même forme pour Part et PartDetail désormais.
export type PartDetail = Part;

export interface PartCreateInput {
  reference: string;
  designation: string;
  vehicle_model_ids: string[];
  category?: string | null;
}

// --- Fournisseurs ---
export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

// --- Commandes ---
export interface PurchaseOrderItem {
  id: string;
  part_id: string;
  reference: string;
  designation: string;
  quantity: number;
  unit_price: string | null;
  line_total: string | null;
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
  order_date: string;
  supplier_id: string;
  supplier_name: string;
  notes: string | null;
  items: PurchaseOrderItem[];
  total_amount: string | null;
  created_at: string;
}

export interface PurchaseOrderItemInput {
  part_id: string;
  quantity: number;
  unit_price?: string | null;
}

export interface PurchaseOrderCreateInput {
  supplier_id: string;
  order_date: string;
  notes?: string | null;
  items: PurchaseOrderItemInput[];
}

// --- Statistiques ---
export interface PartStatRow {
  part_id: string;
  reference: string;
  designation: string;
  models_label: string; // "Bestune B70, Bestune T55" ou "Universel"
  is_universal: boolean;
  total_quantity_ordered: number;
}

export interface PartOrderHistoryRow {
  order_date: string;
  order_number: string;
  supplier_name: string;
  quantity: number;
  unit_price: string | null;
  line_total: string | null;
}

// --- Dashboard ---
export interface DashboardPeriod {
  start_date: string | null;
  end_date: string | null;
}

export interface TopPartRow {
  part_id: string;
  reference: string;
  designation: string;
  models_label: string;
  total_quantity: number;
}

export interface TopSupplierRow {
  supplier_id: string;
  name: string;
  order_count: number;
  total_quantity: number;
}

export interface MonthlyQuantity {
  month: string;
  total_quantity: number;
}

export interface BrandQuantity {
  brand_id: string | null; // null = bucket "Universel"
  name: string;
  total_quantity: number;
}

export interface ModelQuantity {
  model_id: string | null; // null = bucket "Universel"
  name: string;
  brand: string;
  total_quantity: number;
}

export interface DashboardResponse {
  period: DashboardPeriod;
  total_orders: number;
  total_quantity: number;
  total_amount: string | null;
  distinct_references: number;
  top_parts: TopPartRow[];
  top_suppliers: TopSupplierRow[];
  quantity_by_month: MonthlyQuantity[];
  quantity_by_brand: BrandQuantity[];
  quantity_by_model: ModelQuantity[];
}

export type DashboardPeriodParam = "3m" | "6m" | "12m";

// --- Bulk (moteur générique du backend) ---
export interface BulkError {
  type: "not_found" | "conflict" | "business_rule" | "error";
  message: string;
}

export interface BulkFailure<TIn> {
  index: number;
  input: TIn;
  error: BulkError;
}

export interface BulkSummary {
  total: number;
  succeeded: number;
  failed: number;
  atomic: boolean;
  committed: boolean;
}

export interface BulkResult<TOut, TIn> {
  summary: BulkSummary;
  succeeded: TOut[];
  failed: BulkFailure<TIn>[];
}

// PartCreateInput est défini plus haut (section Pièces).

export interface PartBulkRead {
  id: string;
  reference: string;
  designation: string;
  category: string | null;
  is_universal: boolean;
}

// --- Demandes de paiement fournisseur ---
export type PaymentPriority = "low" | "normal" | "high" | "urgent";
export type PaymentStatus = "to_pay" | "paid";

export interface PaymentSupplierRef {
  id: string;
  name: string;
}

export interface PaymentRequest {
  id: string;
  request_number: string;
  title: string;
  amount: string;
  request_date: string;
  link: string | null;
  odoo_reference: string | null;
  priority: PaymentPriority;
  status: PaymentStatus;
  supplier: PaymentSupplierRef;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface PaymentRequestCreateInput {
  title: string;
  amount: string;
  request_date: string;
  supplier_id: string;
  link?: string | null;
  odoo_reference?: string | null;
  priority?: PaymentPriority;
  notes?: string | null;
}

export interface PaymentRequestUpdateInput {
  title?: string;
  amount?: string;
  request_date?: string;
  link?: string | null;
  odoo_reference?: string | null;
  priority?: PaymentPriority;
  notes?: string | null;
}



// --- Inventaire (comptage tournant) ---
// sorties = stock_précédent + entrées(commandes) − stock_compté
export interface InventoryCountItemRead {
  id: string;
  part_id: string;
  reference: string;
  designation: string;
  counted_quantity: number;
  previous_quantity: number | null;   // null = premier comptage de la pièce
  previous_count_date: string | null;
  entries_between: number;
  outflow: number | null;             // null si premier comptage
  anomaly: boolean;                   // true si outflow < 0
}

export interface InventoryCount {
  id: string;
  count_number: string;
  count_date: string;
  notes: string | null;
  items: InventoryCountItemRead[];
  created_at: string;
}

export interface InventoryCountItemInput {
  part_id: string;
  counted_quantity: number;
}

export interface InventoryCountCreateInput {
  count_date: string;
  notes?: string | null;
  items: InventoryCountItemInput[];
}

export interface PartInventoryHistoryRow {
  count_number: string;
  count_date: string;
  counted_quantity: number;
  previous_quantity: number | null;
  entries_between: number;
  outflow: number | null;
  anomaly: boolean;
}


// --- Bons de commande (approvisionnement fournisseur) ---
export type BcStatus = "draft" | "sent" | "received";

export interface BcSupplierRef {
  id: string;
  name: string;
}

export interface PurchaseRequestItemRead {
  id: string;
  part_id: string;
  reference: string;
  designation: string;
  quantity: number;
  unit_price: string | null;
  line_total: string | null;
}

export interface PurchaseRequest {
  id: string;
  bc_number: string;
  supplier: BcSupplierRef;
  request_date: string;
  expected_date: string | null;
  status: BcStatus;
  purchase_order_id: string | null;
  supply_request_id?: string | null; 
  order_number: string | null;
  notes: string | null;
  items: PurchaseRequestItemRead[];
  total_amount: string | null; // null si aucun prix renseigné
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
}

export interface PurchaseRequestItemInput {
  part_id: string;
  quantity: number;
  unit_price?: string | null;
}

export interface PurchaseRequestCreateInput {
  supplier_id: string;
  request_date: string;
  expected_date?: string | null;
  notes?: string | null;
  items: PurchaseRequestItemInput[];
}


// --- Authentification ---
export type UserRole = "admin" | "magazinier" | "centre";

export interface CurrentUser {
  id: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// Pour la gestion des utilisateurs (admin)
export interface ManagedUser extends CurrentUser {
  updated_at: string;
}

export interface UserCreateInput {
  username: string;
  password: string;
  full_name?: string | null;
  role: UserRole;
}

export interface UserUpdateInput {
  full_name?: string | null;
  role?: UserRole;
}

export interface PasswordResetInput {
  new_password: string;
}

// --- Besoins d'approvisionnement ---
export type SupplyStatus = "open" | "in_progress" | "fulfilled";

export interface SupplyRequestItemRead {
  id: string;
  part_id: string;
  reference: string;
  designation: string;
  quantity: number;
}

export interface LinkedBc {
  id: string;
  bc_number: string;
  supplier_name: string | null;
  status: string;
}

export interface SupplyRequest {
  id: string;
  sr_number: string;
  request_date: string;
  status: SupplyStatus;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  items: SupplyRequestItem[];
  linked_bcs: LinkedBc[];
  created_at: string;
}

export interface SupplyRequestItemInput {
  part_id: string;
  quantity: number;
}

export interface SupplyRequestCreateInput {
  request_date: string;
  notes?: string | null;
  items: SupplyRequestItemInput[];
}

// Création d'un bon depuis un besoin (admin)
// Ligne de besoin enrichie du suivi de consommation
export interface SupplyRequestItem {
  id: string;
  part_id: string;
  reference: string;
  designation: string;
  quantity: number;              // demandé
  ordered_quantity: number;      // déjà parti en bon
  remaining_quantity: number;    // reste à commander
}

// Entrée d'une ligne lors de la création d'un bon depuis un besoin
export interface BcFromSupplyItemInput {
  supply_request_item_id: string;
  quantity: number;
  unit_price?: string | null;
}

export interface BcFromSupplyInput {
  supply_request_id: string;
  supplier_id: string;
  request_date: string;
  expected_date?: string | null;
  notes?: string | null;
  items: BcFromSupplyItemInput[];
}


// --- Trace d'audit (commandes & comptages, même forme) ---
export interface AuditEntry {
  id: string;
  username: string | null;
  changes: string[];
  created_at: string;
}

// --- Impact d'édition d'un comptage ---
export interface PosteriorCount {
  id: string;
  count_number: string;
  count_date: string;
}

export interface InventoryEditImpact {
  is_leaf: boolean;
  editable_by_magazinier: boolean;
  posterior: PosteriorCount[];
}

// --- Édition de commande ---
export interface OrderLineInput {
  part_id: string;
  quantity: number;
  unit_price?: string | null;
}

export interface OrderInventoryImpact {
  used_by_inventory: boolean;
}

// ===================== MODULE VENTES =====================

// --- Clients ---
export interface SalesClient {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}
export interface SalesClientInput {
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

// --- Produits (catalogue) ---
export interface SalesProduct {
  id: string;
  reference: string | null;
  designation: string;
  default_purchase_price: string | null;
  default_sale_price: string | null;
  default_unit: string | null;   
  notes: string | null;
  created_at: string;
}
export interface SalesProductInput {
  reference?: string | null;
  designation: string;
  default_purchase_price?: string | null;
  default_sale_price?: string | null;
  default_unit?: string | null;
  notes?: string | null;
}

// --- Ventes ---
export type SalePaymentStatus = "impayee" | "partiellement_payee" | "payee";

export interface SalesOrderItem {
  id: string;
  product_id: string | null;
  designation: string;
  quantity: number;
  unit: string;        
  purchase_price: string;
  sale_price: string;
  line_total: string;
  line_margin: string;
}

export interface SalesOrderItemInput {
  product_id?: string | null;
  designation: string;
  quantity: number;
  unit: string;
  purchase_price: string;
  sale_price: string;
}

export interface SalesOrder {
  id: string;
  sale_number: string;
  client_id: string;
  client_name: string;
  sale_date: string;
  notes: string | null;
  items: SalesOrderItem[];
  total_sale: string;
  total_purchase: string;
  total_margin: string;
  vat_rate: string;        // "0.18"
  vat_amount: string;      // TVA
  total_ttc: string;       // TTC
  delivery_status: DeliveryStatus
  payment_status: SalePaymentStatus;    // ← ajoute
  amount_paid: string;              // ← ajoute
  amount_due: string;  
  created_at: string;
}

export interface SalesOrderInput {
  client_id: string;
  sale_date: string;
  notes?: string | null;
  items: SalesOrderItemInput[];
}

// --- Paiements ---
export interface PaymentAllocation {
  sales_order_id: string;
  sale_number: string;
  amount: string;
}

export interface SalesPayment {
  id: string;
  payment_number: string;
  client_id: string;
  client_name: string;
  payment_date: string;
  amount: string;
  method: string | null;
  notes: string | null;
  allocations: PaymentAllocation[];
  created_at: string;
}

export interface SalesPaymentInput {
  client_id: string;
  payment_date: string;
  amount: string;
  method?: string | null;
  notes?: string | null;
}

// --- Grand livre ---
export interface LedgerSaleRow {
  id: string;
  sale_number: string;
  sale_date: string;
  total_sale: string;
  paid: string;
  remaining: string;
}

export interface LedgerEntry {
  date: string;
  kind: "sale" | "payment";
  ref: string;
  debit: string | null;
  credit: string | null;
  running_balance: string;
}

export interface ClientLedger {
  client_id: string;
  client_name: string;
  total_sold: string;
  total_paid: string;
  balance: string;
  unpaid_sales: LedgerSaleRow[];
  entries: LedgerEntry[];
}

export interface SalesMonthly { month: string; ca: string; benefice: string; }
export interface SalesTopClient { client_id: string; name: string; ca: string; }
export interface SalesDashboard {
  period: { start_date: string; end_date: string };
  ca: string;
  tva_collectee: string;   // ← nouveau
  depenses: string;
  benefice: string;
  creances: string;
  by_month: SalesMonthly[];
  top_clients: SalesTopClient[];
}

// --- Proformas ---
export type ProformaStatus = "en_cours" | "convertie";

export interface ProformaItem {
  id: string;
  product_id: string | null;
  designation: string;
  quantity: number;
  unit: string;    
  sale_price: string;
  line_total: string;
}

export interface ProformaItemInput {
  product_id?: string | null;
  designation: string;
  quantity: number;
  unit: string;  
  sale_price: string;
  add_to_catalog?: boolean; 
}

export interface SalesProforma {
  id: string;
  proforma_number: string;
  client_id: string;
  client_name: string;
  proforma_date: string;
  status: ProformaStatus;
  notes: string | null;
  converted_sale_id: string | null;
  converted_sale_number: string | null;
  items: ProformaItem[];
  total: string;
  created_at: string;
}
export interface SalesProformaInput {
  client_id: string;
  proforma_date: string;
  notes?: string | null;
  items: ProformaItemInput[];
}
export interface ProformaConvertItemInput {
  proforma_item_id: string;
  purchase_price: string;
}
export interface ProformaConvertInput {
  sale_date: string;
  items: ProformaConvertItemInput[];
}

// ===================== MODULE DEMANDES INTER-CENTRES =====================
export type CenterStatus = "nouvelle" | "preparee" | "envoyee";

export interface CenterItem {
  id: string;
  part_id: string | null;
  designation: string;
  quantity: number;
  note: string | null;
  prepared: boolean;
  from_catalog: boolean;
}
export interface CenterItemInput {
  part_id?: string | null;
  designation: string;
  quantity: number;
  note?: string | null;
}
export interface CenterRequest {
  id: string;
  request_number: string;
  vehicle_brand: string;
  vehicle_model: string;
  plate_number: string | null;
  request_date: string;
  status: CenterStatus;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  items: CenterItem[];
  prepared_count: number;
  total_items: number;
  created_at: string;
}
export interface CenterRequestInput {
  vehicle_brand: string;
  vehicle_model: string;
  plate_number?: string | null;
  request_date: string;
  notes?: string | null;
  items: CenterItemInput[];
}

export interface PrepSource {
  request_number: string;
  vehicle: string;
  plate_number: string | null;
  quantity: number;
  note: string | null;
}


export interface PrepItem {
  designation: string;
  from_catalog: boolean;
  total_quantity: number;
  sources: PrepSource[];
}

export interface PreparationList {
  generated_at: string;
  request_count: number;
  distinct_parts: number;
  items: PrepItem[];
}

// --- Bons de livraison ---
export type DeliveryStatus = "non_livree" | "partiellement_livree" | "livree";


export interface DeliveryItem {
  id: string;
  sales_order_item_id: string | null;
  designation: string;
  quantity: number;
  unit: string;
  sale_price: string;
  line_total: string;
}


export interface DeliveryItemInput {
  sales_order_item_id?: string | null;
  designation: string;
  quantity: number;
  unit: string;
  sale_price: string;
}


export interface DeliveryNote {
  id: string;
  delivery_number: string;
  sales_order_id: string;
  sale_number: string;
  client_id: string;
  client_name: string;
  delivery_date: string;
  notes: string | null;
  items: DeliveryItem[];
  total: string;
  created_at: string;
}


export interface DeliveryNoteInput {
  sales_order_id: string;
  delivery_date: string;
  notes?: string | null;
  items: DeliveryItemInput[];
}


export interface DeliverableLine {
  sales_order_item_id: string;
  designation: string;
  unit: string;
  sale_price: string;
  quantity_ordered: number;
  quantity_delivered: number;
  quantity_remaining: number;
}


export interface DeliverableSale {
  sales_order_id: string;
  sale_number: string;
  client_id: string;
  client_name: string;
  lines: DeliverableLine[];
}