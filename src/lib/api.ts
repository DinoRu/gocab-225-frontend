// Client API centralisé. L'URL de base vient de NEXT_PUBLIC_API_URL (.env.local).
// Le préfixe /api/v1 est ajouté ici, une seule fois.

import type {
  BulkResult,
  DashboardPeriodParam,
  DashboardResponse,
  Page,
  Part,
  PartBulkRead,
  PartCreateInput,
  PartDetail,
  PartOrderHistoryRow,
  PartStatRow,
  PaymentPriority,
  PaymentRequest,
  PaymentRequestCreateInput,
  PaymentRequestUpdateInput,
  PaymentStatus,
  PurchaseOrder,
  PurchaseOrderCreateInput,
  Supplier,
  VehicleBrand,
  VehicleModel,
  VehicleModelWithBrand,
  InventoryCount,
  InventoryCountCreateInput,
  PartInventoryHistoryRow,
  PurchaseRequest,
  PurchaseRequestCreateInput,
  BcStatus,
  CurrentUser,
  ManagedUser,
  UserCreateInput,
  UserUpdateInput,
  UserRole,
  SupplyRequest,
  SupplyRequestCreateInput,
  SupplyStatus,
  BcFromSupplyInput,
  InventoryEditImpact,
  AuditEntry,
  OrderLineInput,
  OrderInventoryImpact,
  SalesClient,
  SalesClientInput,
  SalesProduct,
  SalesProductInput,
  SalesOrder,
  SalesOrderInput,
  SalesPayment,
  SalesPaymentInput,
  ClientLedger,
  SalesDashboard,
  ProformaStatus,
  SalesProforma,
  SalesProformaInput,
  ProformaConvertInput,
  CenterStatus,
  CenterRequest,
  CenterRequestInput,
  PreparationList,
  DeliveryNote,
  DeliverableSale,
  DeliveryNoteInput,
  TariffPriceInput,
  TariffPrice,
  ArticlePricesView,
  TariffArticle,
  TariffArticleInput,
  SupplierPricesView,
  TariffSupplier,
  TariffSupplierInput,
  SaleLinesUpdateInput,
} from "./types";

const BASE_URL =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "") +
  "/api/v1";


const ACCESS_KEY = "gocab_token";
const REFRESH_KEY = "gocab_refresh";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}
export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}
export function setAccessToken(access: string): void {
  localStorage.setItem(ACCESS_KEY, access);
}
export function clearToken(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// Callback appelé quand le backend renvoie 401 (token absent/expiré/invalide).
// L'AuthProvider s'y branche pour déconnecter et rediriger vers /login.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

type QueryValue = string | number | boolean | null | undefined;
type Query = Record<string, QueryValue>;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(BASE_URL + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

// Un seul refresh à la fois : les requêtes qui tombent en 401 pendant
// un refresh en cours attendent le même résultat au lieu d'en lancer chacune un.
let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token); // rotation : on stocke le nouveau couple
    return data.access_token as string;
  } catch {
    return null;
  }
}

// Garantit qu'un seul refresh réseau tourne à la fois.
function refreshAccess(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}


async function request<T>(
  method: string,
  path: string,
  opts: { query?: Query; body?: unknown } = {},
  _retry = false
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const init: RequestInit = { method, headers, cache: "no-store" };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), init);
  } catch {
    throw new ApiError(0, "Impossible de joindre l'API. Vérifiez qu'elle est démarrée.");
  }

  // 401 → on tente UN refresh puis on rejoue la requête une seule fois.
  if (res.status === 401 && !_retry) {
    const newAccess = await refreshAccess();
    if (newAccess) {
      return request<T>(method, path, opts, true); // rejoue avec le nouveau token
    }
    // Refresh échoué → vraie déconnexion.
    clearToken();
    if (onUnauthorized) onUnauthorized();
    throw new ApiError(401, "Session expirée. Veuillez vous reconnecter.");
  }
  if (res.status === 401 && _retry) {
    // Même après refresh, toujours 401 → on abandonne.
    clearToken();
    if (onUnauthorized) onUnauthorized();
    throw new ApiError(401, "Session expirée. Veuillez vous reconnecter.");
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail =
      (data && typeof data === "object" && "detail" in data && String(data.detail)) ||
      `Erreur ${res.status}`;
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

// Le moteur bulk renvoie 200/201 (tout OK), 207 (succès partiel) ou 422
// (atomique échoué). Dans les trois cas le corps est une BulkResult exploitable :
// on la retourne telle quelle. Seuls un 422 SANS enveloppe (erreur de validation
// Pydantic classique, ex. batch vide) ou une panne réseau lèvent une ApiError.
async function bulkRequest<T>(
  method: string,
  path: string,
  body: unknown,
  _retry = false
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      method,
      headers,
      cache: "no-store",
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Impossible de joindre l'API. Vérifiez qu'elle est démarrée.");
  }

  // 401 → on tente UN refresh puis on rejoue, comme dans request.
  if (res.status === 401 && !_retry) {
    const newAccess = await refreshAccess();
    if (newAccess) {
      return bulkRequest<T>(method, path, body, true);
    }
    clearToken();
    if (onUnauthorized) onUnauthorized();
    throw new ApiError(401, "Session expirée. Veuillez vous reconnecter.");
  }
  if (res.status === 401 && _retry) {
    clearToken();
    if (onUnauthorized) onUnauthorized();
    throw new ApiError(401, "Session expirée. Veuillez vous reconnecter.");
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  const isEnvelope =
    data && typeof data === "object" && "summary" in data && "failed" in data;
  if (isEnvelope) {
    return data as T;
  }

  const detail =
    (data && typeof data === "object" && "detail" in data && String(data.detail)) ||
    `Erreur ${res.status}`;
  throw new ApiError(res.status, detail);
}


export const api = {
  // ---- Dashboard ----
  dashboard(query: {
    period?: DashboardPeriodParam;
    start_date?: string;
    end_date?: string;
    brand_id?: string;
    vehicle_model_id?: string;
  }): Promise<DashboardResponse> {
    return request<DashboardResponse>("GET", "/dashboard", { query });
  },

  // ---- Marques ----
  listBrands(query: { search?: string; page?: number; limit?: number } = {}): Promise<Page<VehicleBrand>> {
    return request<Page<VehicleBrand>>("GET", "/vehicle-brands", { query: { limit: 100, ...query } });
  },
  createBrand(body: { name: string }): Promise<VehicleBrand> {
    return request<VehicleBrand>("POST", "/vehicle-brands", { body });
  },
  updateBrand(id: string, body: { name: string }): Promise<VehicleBrand> {
    return request<VehicleBrand>("PATCH", `/vehicle-brands/${id}`, { body });
  },
  deleteBrand(id: string): Promise<void> {
    return request<void>("DELETE", `/vehicle-brands/${id}`);
  },
  brandModels(brandId: string): Promise<VehicleModel[]> {
    return request<VehicleModel[]>("GET", `/vehicle-brands/${brandId}/models`);
  },

  // ---- Modèles ----
  listModels(query: { brand_id?: string; search?: string; page?: number; limit?: number } = {}): Promise<Page<VehicleModel>> {
    return request<Page<VehicleModel>>("GET", "/vehicle-models", { query: { limit: 100, ...query } });
  },
  getModel(id: string): Promise<VehicleModelWithBrand> {
    return request<VehicleModelWithBrand>("GET", `/vehicle-models/${id}`);
  },
  createModel(body: { brand_id: string; name: string }): Promise<VehicleModel> {
    return request<VehicleModel>("POST", "/vehicle-models", { body });
  },
  updateModel(id: string, body: { name: string }): Promise<VehicleModel> {
    return request<VehicleModel>("PATCH", `/vehicle-models/${id}`, { body });
  },
  deleteModel(id: string): Promise<void> {
    return request<void>("DELETE", `/vehicle-models/${id}`);
  },

  // ---- Pièces ----
  listParts(query: { search?: string; brand_id?: string; vehicle_model_id?: string; universal?: boolean; page?: number; limit?: number } = {}): Promise<Page<PartDetail>> {
    return request<Page<PartDetail>>("GET", "/parts", { query: { limit: 20, ...query } });
  },
  getPart(id: string): Promise<PartDetail> {
    return request<PartDetail>("GET", `/parts/${id}`);
  },
  partOrderHistory(
    id: string,
    query: { start_date?: string; end_date?: string; supplier_id?: string } = {}
  ): Promise<PartOrderHistoryRow[]> {
    return request<PartOrderHistoryRow[]>("GET", `/parts/${id}/order-history`, { query });
  },
  createPart(body: { reference: string; designation: string; vehicle_model_ids: string[]; category?: string | null }): Promise<PartDetail> {
    return request<PartDetail>("POST", "/parts", { body });
  },
  updatePart(id: string, body: Partial<{ reference: string; designation: string; vehicle_model_ids: string[]; category: string | null }>): Promise<PartDetail> {
    return request<PartDetail>("PATCH", `/parts/${id}`, { body });
  },
  deletePart(id: string): Promise<void> {
    return request<void>("DELETE", `/parts/${id}`);
  },

  // ---- Pièces : bulk ----
  bulkCreateParts(
    atomic: boolean,
    items: PartCreateInput[]
  ): Promise<BulkResult<PartBulkRead, PartCreateInput>> {
    return bulkRequest<BulkResult<PartBulkRead, PartCreateInput>>(
      "POST",
      "/parts/bulk",
      { atomic, items }
    );
  },
  bulkDeleteParts(atomic: boolean, ids: string[]): Promise<BulkResult<string, string>> {
    return bulkRequest<BulkResult<string, string>>("POST", "/parts/bulk/delete", {
      atomic,
      items: ids,
    });
  },

  // ---- Fournisseurs ----
  listSuppliers(query: { search?: string; page?: number; limit?: number } = {}): Promise<Page<Supplier>> {
    return request<Page<Supplier>>("GET", "/suppliers", { query: { limit: 100, ...query } });
  },
  createSupplier(body: { name: string; phone?: string | null; email?: string | null }): Promise<Supplier> {
    return request<Supplier>("POST", "/suppliers", { body });
  },
  updateSupplier(id: string, body: Partial<{ name: string; phone: string | null; email: string | null }>): Promise<Supplier> {
    return request<Supplier>("PATCH", `/suppliers/${id}`, { body });
  },
  deleteSupplier(id: string): Promise<void> {
    return request<void>("DELETE", `/suppliers/${id}`);
  },

  // ---- Commandes ----
  listOrders(query: {
    search?: string;
    start_date?: string;
    end_date?: string;
    supplier_id?: string;
    part_id?: string;
    brand_id?: string;
    vehicle_model_id?: string;
    sort?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<Page<PurchaseOrder>> {
    return request<Page<PurchaseOrder>>("GET", "/purchase-orders", { query: { limit: 20, ...query } });
  },
  getOrder(id: string): Promise<PurchaseOrder> {
    return request<PurchaseOrder>("GET", `/purchase-orders/${id}`);
  },
  createOrder(body: PurchaseOrderCreateInput): Promise<PurchaseOrder> {
    return request<PurchaseOrder>("POST", "/purchase-orders", { body });
  },
  deleteOrder(id: string): Promise<void> {
    return request<void>("DELETE", `/purchase-orders/${id}`);
  },

  // ---- Statistiques ----
  partsStats(query: {
    start_date?: string;
    end_date?: string;
    part_id?: string;
    supplier_id?: string;
    brand_id?: string;
    vehicle_model_id?: string;
  } = {}): Promise<PartStatRow[]> {
    return request<PartStatRow[]>("GET", "/statistics/parts", { query });
  },

  // ---- Export ----
  exportUrl(query: {
    start_date?: string;
    end_date?: string;
    part_id?: string;
    supplier_id?: string;
    brand_id?: string;
    vehicle_model_id?: string;
  } = {}): string {
    return buildUrl("/exports/parts-orders", query);
  },

  // ---- Demandes de paiement ----
  listPaymentRequests(query: {
    search?: string;
    status?: PaymentStatus;
    priority?: PaymentPriority;
    supplier_id?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<Page<PaymentRequest>> {
    return request<Page<PaymentRequest>>("GET", "/payment-requests", { query: { limit: 20, ...query } });
  },
  getPaymentRequest(id: string): Promise<PaymentRequest> {
    return request<PaymentRequest>("GET", `/payment-requests/${id}`);
  },
  createPaymentRequest(body: PaymentRequestCreateInput): Promise<PaymentRequest> {
    return request<PaymentRequest>("POST", "/payment-requests", { body });
  },
  updatePaymentRequest(id: string, body: PaymentRequestUpdateInput): Promise<PaymentRequest> {
    return request<PaymentRequest>("PATCH", `/payment-requests/${id}`, { body });
  },
  markPaymentPaid(id: string): Promise<PaymentRequest> {
    return request<PaymentRequest>("POST", `/payment-requests/${id}/mark-paid`);
  },
  markPaymentUnpaid(id: string): Promise<PaymentRequest> {
    return request<PaymentRequest>("POST", `/payment-requests/${id}/mark-unpaid`);
  },
  deletePaymentRequest(id: string): Promise<void> {
    return request<void>("DELETE", `/payment-requests/${id}`);
  },
  paymentExportUrl(query: {
    search?: string;
    status?: PaymentStatus;
    priority?: PaymentPriority;
    supplier_id?: string;
    start_date?: string;
    end_date?: string;
  } = {}): string {
    return buildUrl("/payment-requests/export", query);
  },


  // ---- Inventaire ----
  listInventoryCounts(query: {
    search?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<Page<InventoryCount>> {
    return request<Page<InventoryCount>>("GET", "/inventory/counts", { query: { limit: 20, ...query } });
  },
  getInventoryCount(id: string): Promise<InventoryCount> {
    return request<InventoryCount>("GET", `/inventory/counts/${id}`);
  },
  createInventoryCount(body: InventoryCountCreateInput): Promise<InventoryCount> {
    return request<InventoryCount>("POST", "/inventory/counts", { body });
  },
  updateInventoryCount(
    id: string,
    body: Partial<InventoryCountCreateInput>
  ): Promise<InventoryCount> {
    return request<InventoryCount>("PATCH", `/inventory/counts/${id}`, { body });
  },
  deleteInventoryCount(id: string): Promise<void> {
    return request<void>("DELETE", `/inventory/counts/${id}`);
  },
  partInventoryHistory(partId: string): Promise<PartInventoryHistoryRow[]> {
    return request<PartInventoryHistoryRow[]>("GET", `/inventory/parts/${partId}/history`);
  },
  inventoryExportUrl(countId: string): string {
    return buildUrl(`/inventory/counts/${countId}/export`);
  },


  // ---- Bons de commande ----
  listPurchaseRequests(query: {
    search?: string;
    status?: BcStatus;
    supplier_id?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<Page<PurchaseRequest>> {
    return request<Page<PurchaseRequest>>("GET", "/purchase-requests", { query: { limit: 20, ...query } });
  },
  getPurchaseRequest(id: string): Promise<PurchaseRequest> {
    return request<PurchaseRequest>("GET", `/purchase-requests/${id}`);
  },
  createPurchaseRequest(body: PurchaseRequestCreateInput): Promise<PurchaseRequest> {
    return request<PurchaseRequest>("POST", "/purchase-requests", { body });
  },
  updatePurchaseRequest(id: string, body: Partial<PurchaseRequestCreateInput>): Promise<PurchaseRequest> {
    return request<PurchaseRequest>("PATCH", `/purchase-requests/${id}`, { body });
  },
  sendPurchaseRequest(id: string): Promise<PurchaseRequest> {
    return request<PurchaseRequest>("POST", `/purchase-requests/${id}/send`);
  },
  receivePurchaseRequest(id: string, purchaseOrderId?: string | null): Promise<PurchaseRequest> {
    return request<PurchaseRequest>("POST", `/purchase-requests/${id}/receive`, {
      body: { purchase_order_id: purchaseOrderId ?? null },
    });
  },
  reopenPurchaseRequest(id: string): Promise<PurchaseRequest> {
    return request<PurchaseRequest>("POST", `/purchase-requests/${id}/reopen`);
  },
  deletePurchaseRequest(id: string): Promise<void> {
    return request<void>("DELETE", `/purchase-requests/${id}`);
  },
  bcPdfUrl(id: string): string {
    return buildUrl(`/purchase-requests/${id}/pdf`);
  },
  bcExcelUrl(id: string): string {
    return buildUrl(`/purchase-requests/${id}/excel`);
  },


  // ---- Authentification ----
  async login(username: string, password: string): Promise<{ access_token: string; refresh_token: string }> {
    const body = new URLSearchParams();
    body.set("username", username);
    body.set("password", password);
    let res: Response;
    try {
      res = await fetch(buildUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
    } catch {
      throw new ApiError(0, "Impossible de joindre l'API.");
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(res.status, data?.detail || "Identifiant ou mot de passe incorrect.");
    }
    return data;
  },


  me(): Promise<CurrentUser> {
    return request<CurrentUser>("GET", "/auth/me");
  },

  async logout(): Promise<void> {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await fetch(buildUrl("/auth/logout"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
        });
      } catch {
        /* on ignore : on nettoie côté client de toute façon */
      }
    }
  },


  // ---- Utilisateurs (admin) ----
  listUsers(query: {
    search?: string;
    role?: UserRole;
    is_active?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<Page<ManagedUser>> {
    return request<Page<ManagedUser>>("GET", "/users", { query: { limit: 20, ...query } });
  },
  createUser(body: UserCreateInput): Promise<ManagedUser> {
    return request<ManagedUser>("POST", "/users", { body });
  },
  updateUser(id: string, body: UserUpdateInput): Promise<ManagedUser> {
    return request<ManagedUser>("PATCH", `/users/${id}`, { body });
  },
  resetUserPassword(id: string, newPassword: string): Promise<void> {
    return request<void>("POST", `/users/${id}/reset-password`, {
      body: { new_password: newPassword },
    });
  },
  activateUser(id: string): Promise<ManagedUser> {
    return request<ManagedUser>("POST", `/users/${id}/activate`);
  },
  deactivateUser(id: string): Promise<ManagedUser> {
    return request<ManagedUser>("POST", `/users/${id}/deactivate`);
  },
  deleteUser(id: string): Promise<void> {
    return request<void>("DELETE", `/users/${id}`);
  },

  // ---- Besoins d'approvisionnement ----
  listSupplyRequests(query: {
    search?: string;
    status?: SupplyStatus;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<Page<SupplyRequest>> {
    return request<Page<SupplyRequest>>("GET", "/supply-requests", { query: { limit: 20, ...query } });
  },
  getSupplyRequest(id: string): Promise<SupplyRequest> {
    return request<SupplyRequest>("GET", `/supply-requests/${id}`);
  },
  createSupplyRequest(body: SupplyRequestCreateInput): Promise<SupplyRequest> {
    return request<SupplyRequest>("POST", "/supply-requests", { body });
  },
  updateSupplyRequest(id: string, body: Partial<SupplyRequestCreateInput>): Promise<SupplyRequest> {
    return request<SupplyRequest>("PATCH", `/supply-requests/${id}`, { body });
  },
  markSupplyFulfilled(id: string): Promise<SupplyRequest> {
    return request<SupplyRequest>("POST", `/supply-requests/${id}/mark-fulfilled`);
  },
  reopenSupplyRequest(id: string): Promise<SupplyRequest> {
    return request<SupplyRequest>("POST", `/supply-requests/${id}/reopen`);
  },
  deleteSupplyRequest(id: string): Promise<void> {
    return request<void>("DELETE", `/supply-requests/${id}`);
  },
  supplyExportUrl(query: { status?: SupplyStatus } = {}): string {
    return buildUrl("/supply-requests/export", query);
  },
  
  // Créer un bon de commande depuis un besoin (admin, permet l'éclatement)
  createBcFromSupply(body: BcFromSupplyInput): Promise<PurchaseRequest> {
    return request<PurchaseRequest>("POST", "/purchase-requests/from-supply", { body });
  },

  // ---- Édition inventaire ----
  inventoryEditImpact(id: string): Promise<InventoryEditImpact> {
    return request<InventoryEditImpact>("GET", `/inventory/counts/${id}/edit-impact`);
  },
  inventoryCountAudit(id: string): Promise<AuditEntry[]> {
    return request<AuditEntry[]>("GET", `/inventory/counts/${id}/audit`);
  },

  // ---- Édition commande ----
  editOrderLines(id: string, items: OrderLineInput[]): Promise<PurchaseOrder> {
    return request<PurchaseOrder>("PATCH", `/purchase-orders/${id}/lines`, {
      body: { items },
    });
  },
  orderAudit(id: string): Promise<AuditEntry[]> {
    return request<AuditEntry[]>("GET", `/purchase-orders/${id}/audit`);
  },
  orderInventoryImpact(id: string): Promise<OrderInventoryImpact> {
    return request<OrderInventoryImpact>("GET", `/purchase-orders/${id}/inventory-impact`);
  },

  // ============ VENTES : Clients ============
  listSalesClients(query: { search?: string; page?: number; limit?: number } = {}): Promise<Page<SalesClient>> {
    return request<Page<SalesClient>>("GET", "/sales/clients", { query: { limit: 50, ...query } });
  },
  createSalesClient(body: SalesClientInput): Promise<SalesClient> {
    return request<SalesClient>("POST", "/sales/clients", { body });
  },
  updateSalesClient(id: string, body: Partial<SalesClientInput>): Promise<SalesClient> {
    return request<SalesClient>("PATCH", `/sales/clients/${id}`, { body });
  },
  deleteSalesClient(id: string): Promise<void> {
    return request<void>("DELETE", `/sales/clients/${id}`);
  },

  // ============ VENTES : Produits ============
  listSalesProducts(query: { search?: string; page?: number; limit?: number } = {}): Promise<Page<SalesProduct>> {
    return request<Page<SalesProduct>>("GET", "/sales/products", { query: { limit: 50, ...query } });
  },
  createSalesProduct(body: SalesProductInput): Promise<SalesProduct> {
    return request<SalesProduct>("POST", "/sales/products", { body });
  },
  updateSalesProduct(id: string, body: Partial<SalesProductInput>): Promise<SalesProduct> {
    return request<SalesProduct>("PATCH", `/sales/products/${id}`, { body });
  },
  deleteSalesProduct(id: string): Promise<void> {
    return request<void>("DELETE", `/sales/products/${id}`);
  },

  // ============ VENTES : Ventes ============
  listSalesOrders(query: { search?: string; client_id?: string; start_date?: string; end_date?: string; page?: number; limit?: number } = {}): Promise<Page<SalesOrder>> {
    return request<Page<SalesOrder>>("GET", "/sales/orders", { query: { limit: 20, ...query } });
  },
  getSalesOrder(id: string): Promise<SalesOrder> {
    return request<SalesOrder>("GET", `/sales/orders/${id}`);
  },
  createSalesOrder(body: SalesOrderInput): Promise<SalesOrder> {
    return request<SalesOrder>("POST", "/sales/orders", { body });
  },
  updateSalesOrder(id: string, body: Partial<SalesOrderInput>): Promise<SalesOrder> {
    return request<SalesOrder>("PATCH", `/sales/orders/${id}`, { body });
  },
  deleteSalesOrder(id: string): Promise<void> {
    return request<void>("DELETE", `/sales/orders/${id}`);
  },

  // ============ VENTES : Paiements ============
  listSalesPayments(query: { client_id?: string; start_date?: string; end_date?: string; page?: number; limit?: number } = {}): Promise<Page<SalesPayment>> {
    return request<Page<SalesPayment>>("GET", "/sales/payments", { query: { limit: 20, ...query } });
  },

  createSalesPayment(body: SalesPaymentInput): Promise<SalesPayment> {
    return request<SalesPayment>("POST", "/sales/payments", { body });
  },

  deleteSalesPayment(id: string): Promise<void> {
    return request<void>("DELETE", `/sales/payments/${id}`);
  },

  // ============ VENTES : Grand livre ============
  clientLedger(clientId: string): Promise<ClientLedger> {
    return request<ClientLedger>("GET", `/sales/clients/${clientId}/ledger`);
  },

  salesDashboard(months = 12): Promise<SalesDashboard> {
    return request<SalesDashboard>("GET", "/sales/dashboard", { query: { months } });
  },

  // ============ VENTES : Proformas ============
  listSalesProformas(query: { client_id?: string; status?: ProformaStatus; page?: number; limit?: number } = {}): Promise<Page<SalesProforma>> {
    return request<Page<SalesProforma>>("GET", "/sales/proformas", { query: { limit: 20, ...query } });
  },
  getSalesProforma(id: string): Promise<SalesProforma> {
    return request<SalesProforma>("GET", `/sales/proformas/${id}`);
  },
  createSalesProforma(body: SalesProformaInput): Promise<SalesProforma> {
    return request<SalesProforma>("POST", "/sales/proformas", { body });
  },
  updateSalesProforma(id: string, body: Partial<SalesProformaInput>): Promise<SalesProforma> {
    return request<SalesProforma>("PATCH", `/sales/proformas/${id}`, { body });
  },
  deleteSalesProforma(id: string): Promise<void> {
    return request<void>("DELETE", `/sales/proformas/${id}`);
  },
  convertSalesProforma(id: string, body: ProformaConvertInput): Promise<SalesProforma> {
    return request<SalesProforma>("POST", `/sales/proformas/${id}/convert`, { body });
  },
  proformaPdfUrl(id: string): string {
    return buildUrl(`/sales/proformas/${id}/pdf`);
  },

  // ============ DEMANDES INTER-CENTRES ============
  listCenterRequests(query: { status?: CenterStatus; page?: number; limit?: number } = {}): Promise<Page<CenterRequest>> {
    return request<Page<CenterRequest>>("GET", "/center-requests", { query: { limit: 20, ...query } });
  },
  getCenterRequest(id: string): Promise<CenterRequest> {
    return request<CenterRequest>("GET", `/center-requests/${id}`);
  },
  createCenterRequest(body: CenterRequestInput): Promise<CenterRequest> {
    return request<CenterRequest>("POST", "/center-requests", { body });
  },
  updateCenterRequest(id: string, body: Partial<CenterRequestInput>): Promise<CenterRequest> {
    return request<CenterRequest>("PATCH", `/center-requests/${id}`, { body });
  },
  deleteCenterRequest(id: string): Promise<void> {
    return request<void>("DELETE", `/center-requests/${id}`);
  },
  toggleCenterItem(requestId: string, itemId: string, prepared: boolean): Promise<CenterRequest> {
    return request<CenterRequest>("POST", `/center-requests/${requestId}/items/${itemId}/toggle`, { body: { prepared } });
  },
  setCenterStatus(requestId: string, status: CenterStatus): Promise<CenterRequest> {
    return request<CenterRequest>("POST", `/center-requests/${requestId}/status`, { body: { status } });
  },

  centerPreparationList(): Promise<PreparationList> {
    return request<PreparationList>("GET", "/center-requests/preparation/list");
  },

    // ============ VENTES : Bons de livraison ============
  listDeliveries(query: { client_id?: string; sales_order_id?: string; page?: number; limit?: number } = {}): Promise<Page<DeliveryNote>> {
    return request<Page<DeliveryNote>>("GET", "/sales/deliveries", { query: { limit: 20, ...query } });
  },
  getDelivery(id: string): Promise<DeliveryNote> {
    return request<DeliveryNote>("GET", `/sales/deliveries/${id}`);
  },
  deliverableSale(salesOrderId: string): Promise<DeliverableSale> {
    return request<DeliverableSale>("GET", `/sales/deliveries/deliverable/${salesOrderId}`);
  },
  createDelivery(body: DeliveryNoteInput): Promise<DeliveryNote> {
    return request<DeliveryNote>("POST", "/sales/deliveries", { body });
  },
  deleteDelivery(id: string): Promise<void> {
    return request<void>("DELETE", `/sales/deliveries/${id}`);
  },
  deliveryPdfUrl(id: string): string {
    return buildUrl(`/sales/deliveries/${id}/pdf`);
  },
  settleSale(orderId: string): Promise<SalesPayment> {
    return request<SalesPayment>("POST", `/sales/orders/${orderId}/settle`, {});
  },

  priceHint(query: { client_id: string; designation?: string; product_id?: string }): Promise<{ purchase_price: string | null; sale_price: string; last_sale_date: string; source: string } | null> {
    return request("GET", "/sales/price-hint", { query });
  },

    // ============ TARIFS : Fournisseurs ============
  listTariffSuppliers(query: { search?: string; page?: number; limit?: number } = {}): Promise<Page<TariffSupplier>> {
    return request<Page<TariffSupplier>>("GET", "/tariffs/suppliers", { query: { limit: 100, ...query } });
  },
  createTariffSupplier(body: TariffSupplierInput): Promise<TariffSupplier> {
    return request<TariffSupplier>("POST", "/tariffs/suppliers", { body });
  },
  updateTariffSupplier(id: string, body: Partial<TariffSupplierInput>): Promise<TariffSupplier> {
    return request<TariffSupplier>("PATCH", `/tariffs/suppliers/${id}`, { body });
  },
  deleteTariffSupplier(id: string): Promise<void> {
    return request<void>("DELETE", `/tariffs/suppliers/${id}`);
  },
  supplierPrices(id: string): Promise<SupplierPricesView> {
    return request<SupplierPricesView>("GET", `/tariffs/suppliers/${id}/prices`);
  },

  // ============ TARIFS : Articles ============
  listTariffArticles(query: { search?: string; page?: number; limit?: number } = {}): Promise<Page<TariffArticle>> {
    return request<Page<TariffArticle>>("GET", "/tariffs/articles", { query: { limit: 50, ...query } });
  },
  createTariffArticle(body: TariffArticleInput): Promise<TariffArticle> {
    return request<TariffArticle>("POST", "/tariffs/articles", { body });
  },
  updateTariffArticle(id: string, body: Partial<TariffArticleInput>): Promise<TariffArticle> {
    return request<TariffArticle>("PATCH", `/tariffs/articles/${id}`, { body });
  },
  deleteTariffArticle(id: string): Promise<void> {
    return request<void>("DELETE", `/tariffs/articles/${id}`);
  },
  articlePrices(id: string): Promise<ArticlePricesView> {
    return request<ArticlePricesView>("GET", `/tariffs/articles/${id}/prices`);
  },

  // ============ TARIFS : Prix ============
  createTariffPrice(body: TariffPriceInput): Promise<TariffPrice> {
    return request<TariffPrice>("POST", "/tariffs/prices", { body });
  },
  deleteTariffPrice(id: string): Promise<void> {
    return request<void>("DELETE", `/tariffs/prices/${id}`);
  },

  clientLedgerPdfUrl(clientId: string): string {
    return buildUrl(`/sales/clients/${clientId}/ledger/pdf`);
  },

  closeSaleToDelivered(orderId: string): Promise<SalesOrder> {
    return request<SalesOrder>("POST", `/sales/orders/${orderId}/close-to-delivered`, {});
  },

  updateSaleLines(orderId: string, body: SaleLinesUpdateInput): Promise<SalesOrder> {
    return request<SalesOrder>("PATCH", `/sales/orders/${orderId}/lines`, { body });
  },
};


// Télécharge un fichier protégé en envoyant le token, puis déclenche le download.
// Remplace les <a href> directs qui ne passent pas l'Authorization header.
// Télécharge un fichier protégé en envoyant le token, puis déclenche le download.
// Remplace les <a href> directs qui ne passent pas l'Authorization header.
export async function downloadWithAuth(url: string, filename: string, _retry = false): Promise<void> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, "Téléchargement impossible.");
  }

  // 401 → on tente UN refresh puis on rejoue une fois.
  if (res.status === 401 && !_retry) {
    const newAccess = await refreshAccess();
    if (newAccess) {
      return downloadWithAuth(url, filename, true);
    }
    clearToken();
    if (onUnauthorized) onUnauthorized();
    throw new ApiError(401, "Téléchargement impossible.");
  }
  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      if (onUnauthorized) onUnauthorized();
    }
    throw new ApiError(res.status, "Téléchargement impossible.");
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

