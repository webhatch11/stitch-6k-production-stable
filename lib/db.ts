import { Product, ProductVariant, Order, Coupon, WalletTransaction, LoyaltyTransaction, UserAddress, OrderStatusHistory, Shipment, ShipmentEvent, TrackingLog, OrderNote, OrderEvent } from "./types";
import { ShippingRules } from "./shipping";
import { CartItem } from "@/stores/cartStore";
import { CategorySales, RepeatPurchaseStats, AdSpend, ROASReport } from "./db/types";

import { settingsDb } from "./db/settings";
import { couponsDb } from "./db/coupons";
import { loyaltyDb } from "./db/loyalty";
import { usersDb } from "./db/users";
import { productsDb } from "./db/products";
import { inventoryDb } from "./db/inventory";
import { shipmentsDb } from "./db/shipments";
import { ordersDb } from "./db/orders";
import { paymentsDb } from "./db/payments";
import { analyticsDb } from "./db/analytics";

export type { CategorySales, RepeatPurchaseStats, AdSpend, ROASReport };

export const db = {
  // --- Settings ---
  getSetting: settingsDb.getSetting,
  getLoyaltyConfig: settingsDb.getLoyaltyConfig,
  getShippingRules: settingsDb.getShippingRules,
  saveSetting: settingsDb.saveSetting,

  // --- Coupons ---
  getCoupons: couponsDb.getCoupons,
  saveCoupon: couponsDb.saveCoupon,
  deleteCoupon: couponsDb.deleteCoupon,
  validateCoupon: couponsDb.validateCoupon,
  incrementCouponUsage: couponsDb.incrementCouponUsage,
  decrementCouponUsage: couponsDb.decrementCouponUsage,

  // --- Loyalty ---
  getLoyaltyPoints: loyaltyDb.getLoyaltyPoints,
  getLoyaltyTransactions: loyaltyDb.getLoyaltyTransactions,
  getLoyaltyData: loyaltyDb.getLoyaltyData,
  applyLoyaltyDebit: loyaltyDb.applyLoyaltyDebit,
  awardLoyaltyPoints: loyaltyDb.awardLoyaltyPoints,
  applyLoyaltyCredit: loyaltyDb.applyLoyaltyCredit,

  // --- Users / Wallet ---
  getWalletBalance: usersDb.getWalletBalance,
  getWalletTransactions: usersDb.getWalletTransactions,
  getWalletData: usersDb.getWalletData,
  applyWalletDebit: usersDb.applyWalletDebit,
  applyWalletCredit: usersDb.applyWalletCredit,
  getUserAddresses: usersDb.getUserAddresses,
  getAddressById: usersDb.getAddressById,
  saveUserAddress: usersDb.saveUserAddress,
  deleteUserAddress: usersDb.deleteUserAddress,
  setDefaultUserAddress: usersDb.setDefaultUserAddress,
  getUserCart: usersDb.getUserCart,
  syncCartToDB: usersDb.syncCartToDB,
  addToUserCart: usersDb.addToUserCart,
  removeFromUserCart: usersDb.removeFromUserCart,
  clearUserCart: usersDb.clearUserCart,
  getCustomers: usersDb.getCustomers,
  getCustomerProfile: usersDb.getCustomerProfile,
  adjustCustomerBalance: usersDb.adjustCustomerBalance,

  // --- Products ---
  getProducts: productsDb.getProducts,
  getProductsByIds: productsDb.getProductsByIds,
  saveProduct: productsDb.saveProduct,
  getProductBySlug: productsDb.getProductBySlug,
  getProductById: productsDb.getProductById,
  relatedProducts: productsDb.relatedProducts,
  logProductAudit: productsDb.logProductAudit,
  deleteProduct: productsDb.deleteProduct,
  softDeleteProduct: productsDb.softDeleteProduct,
  restoreProduct: productsDb.restoreProduct,
  permanentlyDeleteProduct: productsDb.permanentlyDeleteProduct,
  getActiveProductIds: productsDb.getActiveProductIds,
  submitReview: productsDb.submitReview,
  getReviews: productsDb.getReviews,
  updateReviewStatus: productsDb.updateReviewStatus,
  deleteReview: productsDb.deleteReview,
  updateReview: productsDb.updateReview,
  getProductAuditLogs: productsDb.getProductAuditLogs,
  getAllProductAuditLogs: productsDb.getAllProductAuditLogs,
  updateProductReorderPoint: productsDb.updateProductReorderPoint,

  // --- Inventory ---
  verifyStock: inventoryDb.verifyStock,
  logDeductionFailure: inventoryDb.logDeductionFailure,
  deductStock: inventoryDb.deductStock,
  restoreStock: inventoryDb.restoreStock,
  restockProductVariants: inventoryDb.restockProductVariants,
  adjustVariantStockBySize: inventoryDb.adjustVariantStockBySize,
  syncProductTotalStock: inventoryDb.syncProductTotalStock,
  releaseReservation: inventoryDb.releaseReservation,

  // --- Shipments ---
  getShipmentByOrderId: shipmentsDb.getShipmentByOrderId,
  getShipmentEvents: shipmentsDb.getShipmentEvents,
  saveShipment: shipmentsDb.saveShipment,
  saveShipmentEvent: shipmentsDb.saveShipmentEvent,
  saveTrackingLog: shipmentsDb.saveTrackingLog,
  getTrackingLogs: shipmentsDb.getTrackingLogs,
  generateOrderId: ordersDb.generateOrderId,
  getNextOrderNumber: ordersDb.getNextOrderNumber,
  dispatchFulfillment: shipmentsDb.dispatchFulfillment,

  // --- Orders ---
  getOrders: ordersDb.getOrders,
  getUserOrders: ordersDb.getUserOrders,
  getOrder: ordersDb.getOrder,
  getOrderById: ordersDb.getOrderById,
  getOrderByIdempotencyKey: ordersDb.getOrderByIdempotencyKey,
  getOrderByAwb: ordersDb.getOrderByAwb,
  saveOrder: ordersDb.saveOrder,
  transitionOrderStatus: ordersDb.transitionOrderStatus,
  requestManualReturn: ordersDb.requestManualReturn,
  approveReturnPickup: ordersDb.approveReturnPickup,
  rejectReturn: ordersDb.rejectReturn,
  getOrderStatusHistory: ordersDb.getOrderStatusHistory,
  addOrderStatusHistory: ordersDb.addOrderStatusHistory,
  addOrderEvent: ordersDb.addOrderEvent,
  createOrderEvent: ordersDb.createOrderEvent,
  getOrderEvents: ordersDb.getOrderEvents,
  getOrderNotes: ordersDb.getOrderNotes,
  addOrderNote: ordersDb.addOrderNote,
  deleteOrderNote: ordersDb.deleteOrderNote,
  getReturnByOrderId: ordersDb.getReturnByOrderId,

  // --- Payments ---
  createPaymentAuditLog: paymentsDb.createPaymentAuditLog,
  getPaymentAuditLogs: paymentsDb.getPaymentAuditLogs,
  issueRefund: paymentsDb.issueRefund,
  verifyRazorpayPayment: paymentsDb.verifyRazorpayPayment,
  verifyRazorpayRefund: paymentsDb.verifyRazorpayRefund,
  approvePendingOrder: paymentsDb.approvePendingOrder,
  cancelOrderAndRefund: paymentsDb.cancelOrderAndRefund,
  processReturnRefund: paymentsDb.processReturnRefund,
  runPostPaymentSideEffects: paymentsDb.runPostPaymentSideEffects,
  confirmOrderAndProcessPaymentsAtomic: paymentsDb.confirmOrderAndProcessPaymentsAtomic,

  // --- Analytics ---
  getTodaySalesKPI: analyticsDb.getTodaySalesKPI,
  getDashboardKPIMetrics: analyticsDb.getDashboardKPIMetrics,
  getDashboardMetrics: analyticsDb.getDashboardMetrics,
  getRevenueTrend: analyticsDb.getRevenueTrend,
  getTopProducts: analyticsDb.getTopProducts,
  getCouponPerformance: analyticsDb.getCouponPerformance,
  recordPageView: analyticsDb.recordPageView,
  getOnlineVisitorsCount: analyticsDb.getOnlineVisitorsCount,
  getActiveCartsCount: analyticsDb.getActiveCartsCount,
  getActiveProductViewers: analyticsDb.getActiveProductViewers,
  getMonthlyFinanceSummary: analyticsDb.getMonthlyFinanceSummary,
  getGSTReport: analyticsDb.getGSTReport,
  getCityOrders: analyticsDb.getCityOrders,
  getSalesByCategory: analyticsDb.getSalesByCategory,
  getRepeatPurchaseRate: analyticsDb.getRepeatPurchaseRate,
  getAdSpend: analyticsDb.getAdSpend,
  saveAdSpend: analyticsDb.saveAdSpend,
  getROASReport: analyticsDb.getROASReport,
  getLiabilityReport: analyticsDb.getLiabilityReport,
  getNetRevenueReport: analyticsDb.getNetRevenueReport,
  getRevenueByCategory: analyticsDb.getRevenueByCategory,
};
