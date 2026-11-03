import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Package,
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import OrderDetailModal from "./OrderDetailModal";

interface OrderItem {
  id: string;
  orderCode: string;
  customerPhone: string;
  totalAmount: number;
  discountAmount?: number;
  couponCode?: string | null;
  status: string;
  paymentMethod: string;
  itemCount: number;
  isPreorder: boolean;
  releaseDate?: string;
  createdAt: string;
}

interface OrderListResponse {
  items: OrderItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const formatPrice = (n: number) => n.toLocaleString() + "₫";

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    Pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    Verifying: "bg-steam-blue/10 text-steam-blue border-steam-blue/20",
    Installing: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    Completed: "bg-steam-green/10 text-steam-green border-steam-green/20",
    Cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const s = styles[status] || "bg-steam-surface-3 text-steam-muted border-steam-border";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${s}`}>
      {status}
    </span>
  );
};

export default function OrderList() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());

      const res = await apiFetch(apiUrl(`/api/admin/orders?${params}`));
      const data: OrderListResponse = await res.json();
      setOrders(data.items);
      setTotalCount(data.totalCount);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, fromDate, toDate, page, pageSize]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const hasFilters = search || statusFilter || fromDate || toDate;

  const stats = [
    { label: "Total", value: totalCount, icon: Package, color: "text-steam-blue bg-steam-blue/10" },
    { label: "Pending", value: orders.filter((o) => o.status === "Pending").length, icon: Clock, color: "text-yellow-400 bg-yellow-500/10" },
    { label: "Verifying", value: orders.filter((o) => o.status === "Verifying").length, icon: Eye, color: "text-steam-blue bg-steam-blue/10" },
    { label: "Done", value: orders.filter((o) => o.status === "Completed").length, icon: CheckCircle2, color: "text-steam-green bg-steam-green/10" },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-white font-mono tracking-tight">Orders</h1>
          <p className="text-xs text-steam-muted mt-0.5">{totalCount} orders total</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-steam-surface border border-steam-border rounded-sm p-2.5 md:p-3.5 card-hover cursor-pointer">
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`w-7 h-7 md:w-8 md:h-8 rounded flex items-center justify-center flex-shrink-0 ${s.color}`}>
                <s.icon size={13} />
              </div>
              <div className="min-w-0">
                <p className="text-sm md:text-base font-bold text-white font-mono tracking-tight">{s.value}</p>
                <p className="text-[10px] md:text-[11px] text-steam-muted truncate">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter toolbar */}
      <div className="bg-steam-surface border border-steam-border rounded-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-3 md:px-4 py-3 border-b border-steam-border">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-steam-muted" />
            <input
              type="text"
              placeholder="Search order/phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-steam-surface-3 border border-steam-border rounded pl-8 pr-3 py-1.5 text-sm text-steam-text placeholder-steam-muted/50 focus:outline-none focus:border-steam-blue/50 transition-colors"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-steam-surface-3 border border-steam-border rounded px-3 py-1.5 text-sm text-steam-text focus:outline-none focus:border-steam-blue/50 min-w-0"
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="AwaitingConfirmation">Awaiting Conf.</option>
              <option value="Verifying">Verifying</option>
              <option value="Installing">Installing</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="bg-steam-surface-3 border border-steam-border rounded px-2 md:px-3 py-1.5 text-sm text-steam-text focus:outline-none focus:border-steam-blue/50 w-full sm:w-auto"
              placeholder="From"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="bg-steam-surface-3 border border-steam-border rounded px-2 md:px-3 py-1.5 text-sm text-steam-text focus:outline-none focus:border-steam-blue/50 w-full sm:w-auto"
              placeholder="To"
            />
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-steam-muted hover:text-steam-text hover:bg-steam-surface-3 transition-colors flex-shrink-0">
                <X size={12} />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="py-12 md:py-16 text-center">
            <Loader2 size={28} className="mx-auto mb-3 text-steam-muted animate-spin" />
            <p className="text-sm text-steam-muted">Loading orders...</p>
          </div>
        )}

        {/* Desktop table */}
        {!loading && (
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-steam-border bg-steam-bg/30">
                  {["Order Code", "Customer", "Items", "Total", "Status", "Payment", "Date", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-medium text-steam-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-steam-border">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedOrderId(o.id)}
                    className="hover:bg-steam-surface-2/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-steam-text">{o.orderCode}</span>
                        {o.isPreorder && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-steam-blue/10 text-steam-blue border border-steam-blue/20">
                            <Clock size={8} />
                            Preorder
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-steam-muted text-xs">{o.customerPhone}</td>
                    <td className="px-4 py-3 text-steam-muted text-xs">{o.itemCount}</td>
                    <td className="px-4 py-3">
                      <span className="text-steam-gold font-semibold font-mono text-sm">{formatPrice(o.totalAmount)}</span>
                      {(o.discountAmount ?? 0) > 0 && (
                        <p className="text-[10px] text-steam-green font-mono whitespace-nowrap">
                          −{formatPrice(o.discountAmount ?? 0)}{o.couponCode ? ` · ${o.couponCode}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">{statusBadge(o.status)}</td>
                    <td className="px-4 py-3 text-steam-muted text-xs">{o.paymentMethod}</td>
                    <td className="px-4 py-3 text-steam-muted text-xs">{new Date(o.createdAt).toLocaleDateString("vi-VN")}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelectedOrderId(o.id)} className="p-1.5 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors">
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-steam-muted">
                      <Package size={28} className="mx-auto mb-2 text-steam-border" />
                      <p className="text-sm">No orders found</p>
                      {hasFilters && <p className="text-xs text-steam-muted/60 mt-1">Try adjusting your filters</p>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile card list */}
        {!loading && (
          <div className="block md:hidden divide-y divide-steam-border">
            {orders.length > 0 ? orders.map((o) => (
              <div
                key={o.id}
                onClick={() => setSelectedOrderId(o.id)}
                className="px-3 py-3 space-y-2 cursor-pointer hover:bg-steam-surface-2/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-medium text-steam-text truncate">{o.orderCode}</span>
                    {o.isPreorder && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-steam-blue/10 text-steam-blue border border-steam-blue/20 flex-shrink-0">
                        <Clock size={8} /> Pre
                      </span>
                    )}
                  </div>
                  {statusBadge(o.status)}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-steam-muted">{o.customerPhone}</span>
                  <span className="text-steam-gold font-semibold font-mono text-sm">{formatPrice(o.totalAmount)}</span>
                </div>
                {(o.discountAmount ?? 0) > 0 && (
                  <p className="text-right text-[10px] text-steam-green font-mono">
                    −{formatPrice(o.discountAmount ?? 0)}{o.couponCode ? ` · ${o.couponCode}` : ""}
                  </p>
                )}
                <div className="flex items-center justify-between text-[11px] text-steam-muted">
                  <span>{o.paymentMethod} · {o.itemCount} item{(o.itemCount ?? 0) > 1 ? "s" : ""}</span>
                  <span>{new Date(o.createdAt).toLocaleDateString("vi-VN")}</span>
                </div>
              </div>
            )) : (
              <div className="py-12 text-center">
                <Package size={24} className="mx-auto mb-2 text-steam-border" />
                <p className="text-sm text-steam-muted">No orders found</p>
                {hasFilters && <p className="text-xs text-steam-muted/60 mt-1">Try adjusting your filters</p>}
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 md:px-4 py-3 border-t border-steam-border">
            <p className="text-xs text-steam-muted order-2 sm:order-1">Page {page} of {totalPages} ({totalCount} total)</p>
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded text-steam-muted hover:text-steam-text hover:bg-steam-surface-3 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-steam-muted px-2 sm:hidden">{page}/{totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded text-steam-muted hover:text-steam-text hover:bg-steam-surface-3 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onStatusChange={() => { fetchOrders(); setSelectedOrderId(null); }}
        />
      )}
    </div>
  );
}
