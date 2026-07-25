import React from 'react'
import Products from '../pages/Products'
import TableManagement from '../pages/TableManagement'
import BusinessSummary from '../pages/BusinessSummary'
import SalesRevenueAnalysis from '../pages/SalesRevenueAnalysis'
import ProductPerformanceAnalysis from '../pages/ProductPerformanceAnalysis'
import StockRiskCenter from '../pages/StockRiskCenter'
import CurrentFinanceCenter from '../pages/CurrentFinanceCenter'
import PersonnelPerformanceCenter from '../pages/PersonnelPerformanceCenter'
import ManagerAlertCenter from '../pages/ManagerAlertCenter'
import DailySummary from '../pages/DailySummary'
import BillHistory from '../pages/BillHistory'
import ActionHistory from '../pages/ActionHistory'
import StaffTracking from '../pages/StaffTracking'
import EmployeeCards from '../pages/EmployeeCards'
import ShiftManagement from '../pages/ShiftManagement'
import AttendanceTracking from '../pages/AttendanceTracking'
import EmployeePerformanceTracking from '../pages/EmployeePerformanceTracking'
import EmployeeBonusSystem from '../pages/EmployeeBonusSystem'
import EmployeeAuditRecords from '../pages/EmployeeAuditRecords'
import EmployeeReports from '../pages/EmployeeReports'
import CurrentReport from '../pages/CurrentReport'
import RiskyCurrentAccounts from '../pages/RiskyCurrentAccounts'
import Kitchen from '../pages/Kitchen'
import QROrders from '../pages/QROrders'
import QRCodes from '../pages/QRCodes'
import StockCards from '../pages/StockCards'
import StockMovements from '../pages/StockMovements'
import InventoryLots from '../pages/InventoryLots'
import ChemicalProducts from '../pages/ChemicalProducts'
import ShipmentWorkOrders from '../pages/ShipmentWorkOrders'
import ShipmentPallets from '../pages/ShipmentPallets'
import ShipmentVehicles from '../pages/ShipmentVehicles'
import ShipmentPlans from '../pages/ShipmentPlans'
import ShipmentReturns from '../pages/ShipmentReturns'
import ShipmentWaybills from '../pages/ShipmentWaybills'
import Shipments from '../pages/Shipments'
import ShipmentExecutions from '../pages/ShipmentExecutions'
import TransferReceipts from '../pages/TransferReceipts'
import ProductionWorkOrders from '../pages/ProductionWorkOrders'
import ProductionLines from '../pages/ProductionLines'
import IntermediateProducts from '../pages/IntermediateProducts'
import FinalProducts from '../pages/FinalProducts'
import BlastChillerProcesses from '../pages/BlastChillerProcesses'
import PackagingProcesses from '../pages/PackagingProcesses'
import LabelingProcesses from '../pages/LabelingProcesses'
import DispatchProcesses from '../pages/DispatchProcesses'
import Recipes from '../pages/Recipes'
import PurchaseRequests from '../pages/PurchaseRequests'
import RequestForQuotations from '../pages/RequestForQuotations'
import PurchaseApprovals from '../pages/PurchaseApprovals'
import PurchaseOrders from '../pages/PurchaseOrders'
import GoodsReceipts from '../pages/GoodsReceipts'
import SupplierPerformances from '../pages/SupplierPerformances'
import ProcurementAnalytics from '../pages/ProcurementAnalytics'
import LotSystem from '../pages/LotSystem'
import SampleTracking from '../pages/SampleTracking'
import WitnessSamples from '../pages/WitnessSamples'
import ProductRecalls from '../pages/ProductRecalls'
import QualityControls from '../pages/QualityControls'
import QualityControlForms from '../pages/QualityControlForms'
import ReturnProcesses from '../pages/ReturnProcesses'
import SupplierReturns from '../pages/SupplierReturns'
import SupplierManagement from '../pages/SupplierManagement'
import Users from '../pages/Users'
import Settings from '../pages/Settings'
import BranchManagement from '../pages/BranchManagement'
import BranchPermissions from '../pages/BranchPermissions'
import BranchReporting from '../pages/BranchReporting'
import BranchStockTransfers from '../pages/BranchStockTransfers'
import HeadOfficeManagement from '../pages/HeadOfficeManagement'
import CurrentAccounts from '../pages/CurrentAccounts'
import CreditTransactions from '../pages/CreditTransactions'
import CollectionTransactions from '../pages/CollectionTransactions'
import CurrentAccountMovements from '../pages/CurrentAccountMovements'
import SupplierDebts from '../pages/SupplierDebts'
import SupplierPayments from '../pages/SupplierPayments'
import CashTransactions from '../pages/CashTransactions'
import IncomeExpenseManagement from '../pages/IncomeExpenseManagement'
import CashClosingPage from '../pages/CashClosing'
import FinancialReports from '../pages/FinancialReports'
import CashTransfers from '../pages/CashTransfers'
import ModuleMarketplace from '../pages/ModuleMarketplace'
import WorkspaceWelcome from '../pages/WorkspaceWelcome'
import IntegrationCenter from '../pages/IntegrationCenter'
import type {
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'
import type { Branch, User } from '../types'
import type { WorkspaceModuleLifecycleResult } from '../workspace/workspace-module-lifecycle.service'

type Props = {
  route: BusinessWorkspaceRoute
  activeNavKey: BusinessWorkspaceNavKey
  currentUser: User
  onBranchesChange: (nextBranches?: Branch[]) => void
  onSettingsChange: () => void
  onOpenMarketplace: () => void
  onOpenIntegrationCenter: () => void
  onOpenWorkspaceSettings: () => void
  onModuleLifecycleChanged: (result: WorkspaceModuleLifecycleResult) => void
}

export default function BusinessWorkspaceRouteHost({
  route,
  activeNavKey,
  currentUser,
  onBranchesChange,
  onSettingsChange,
  onOpenMarketplace,
  onOpenIntegrationCenter,
  onOpenWorkspaceSettings,
  onModuleLifecycleChanged
}: Props){
  const isAdmin = currentUser.role === 'Admin'

  if(route === 'workspace-welcome'){
    return (
      <WorkspaceWelcome
        currentUser={currentUser}
        onOpenWorkspaceSettings={onOpenWorkspaceSettings}
      />
    )
  }

  if(route === 'tables'){
    return (
      <TableManagement
        currentUser={currentUser}
        focus={activeNavKey === 'tables-management' ? 'tables' : 'billing'}
      />
    )
  }

  if(route === 'products') return <Products currentUser={currentUser} />
  if(route === 'summary'){
    return (
      <DailySummary
        currentUser={currentUser}
        onOpenMarketplace={onOpenMarketplace}
        onOpenWorkspaceSettings={onOpenWorkspaceSettings}
      />
    )
  }
  if(route === 'history') return <BillHistory />
  if(route === 'kitchen') return <Kitchen currentUser={currentUser} />

  if(route === 'qr-orders'){
    return (
      <QROrders
        currentUser={currentUser}
        focus={activeNavKey === 'waiter-calls' ? 'calls' : 'orders'}
      />
    )
  }

  if(!isAdmin) return null

  if(route === 'marketplace'){
    return (
      <ModuleMarketplace
        currentUser={currentUser}
        onModuleLifecycleChanged={onModuleLifecycleChanged}
      />
    )
  }
  if(route === 'integration-center') return <IntegrationCenter />
  if(route === 'stock-cards'){
    return (
      <StockCards
        currentUser={currentUser}
        focus={activeNavKey === 'critical-stock' ? 'critical' : activeNavKey === 'expiry-lots' ? 'expiry' : 'cards'}
      />
    )
  }

  if(route === 'stock-movements'){
    return (
      <StockMovements
        currentUser={currentUser}
        focus={activeNavKey === 'waste' ? 'waste' : 'movements'}
      />
    )
  }

  if(route === 'inventory-lots') return <InventoryLots />
  if(route === 'chemical-products') return <ChemicalProducts />
  if(route === 'shipment-work-orders') return <ShipmentWorkOrders currentUser={currentUser} />
  if(route === 'shipment-pallets') return <ShipmentPallets currentUser={currentUser} />
  if(route === 'shipment-vehicles') return <ShipmentVehicles currentUser={currentUser} />
  if(route === 'shipment-plans') return <ShipmentPlans currentUser={currentUser} />
  if(route === 'shipment-returns') return <ShipmentReturns currentUser={currentUser} />
  if(route === 'shipment-waybills') return <ShipmentWaybills currentUser={currentUser} />
  if(route === 'shipments') return <Shipments currentUser={currentUser} />
  if(route === 'shipment-executions') return <ShipmentExecutions currentUser={currentUser} />
  if(route === 'transfer-receipts') return <TransferReceipts currentUser={currentUser} />
  if(route === 'production-work-orders') return <ProductionWorkOrders currentUser={currentUser} />
  if(route === 'production-lines') return <ProductionLines currentUser={currentUser} />
  if(route === 'intermediate-products') return <IntermediateProducts />
  if(route === 'final-products') return <FinalProducts />
  if(route === 'blast-chiller-processes') return <BlastChillerProcesses />
  if(route === 'packaging-processes') return <PackagingProcesses />
  if(route === 'labeling-processes') return <LabelingProcesses />
  if(route === 'dispatch-processes') return <DispatchProcesses />
  if(route === 'recipes') return <Recipes />
  if(route === 'purchase-requests') return <PurchaseRequests currentUser={currentUser} />
  if(route === 'request-for-quotations') return <RequestForQuotations currentUser={currentUser} />
  if(route === 'purchase-approvals') return <PurchaseApprovals currentUser={currentUser} />
  if(route === 'purchase-orders') return <PurchaseOrders currentUser={currentUser} />
  if(route === 'goods-receipts') return <GoodsReceipts currentUser={currentUser} />
  if(route === 'supplier-performances') return <SupplierPerformances />
  if(route === 'procurement-analytics') return <ProcurementAnalytics />
  if(route === 'lot-system') return <LotSystem currentUser={currentUser} />
  if(route === 'sample-tracking') return <SampleTracking currentUser={currentUser} />
  if(route === 'witness-samples') return <WitnessSamples currentUser={currentUser} />
  if(route === 'product-recalls') return <ProductRecalls currentUser={currentUser} />
  if(route === 'quality-controls') return <QualityControls currentUser={currentUser} />
  if(route === 'quality-control-forms') return <QualityControlForms />
  if(route === 'return-processes') return <ReturnProcesses currentUser={currentUser} />
  if(route === 'supplier-returns') return <SupplierReturns currentUser={currentUser} />
  if(route === 'suppliers') return <SupplierManagement />
  if(route === 'supplier-debts') return <SupplierDebts currentUser={currentUser} />
  if(route === 'supplier-payments') return <SupplierPayments currentUser={currentUser} />
  if(route === 'cash-transactions') return <CashTransactions currentUser={currentUser} />
  if(route === 'income-expense') return <IncomeExpenseManagement currentUser={currentUser} />
  if(route === 'cash-closing') return <CashClosingPage currentUser={currentUser} />
  if(route === 'financial-reports') return <FinancialReports />
  if(route === 'cash-transfers') return <CashTransfers currentUser={currentUser} />
  if(route === 'business-summary') return <BusinessSummary />
  if(route === 'sales-revenue-analysis') return <SalesRevenueAnalysis />
  if(route === 'product-performance-analysis') return <ProductPerformanceAnalysis />
  if(route === 'stock-risk-center') return <StockRiskCenter />
  if(route === 'current-finance-center') return <CurrentFinanceCenter />
  if(route === 'personnel-performance-center') return <PersonnelPerformanceCenter />
  if(route === 'manager-alert-center') return <ManagerAlertCenter />
  if(route === 'qr-codes') return <QRCodes />
  if(route === 'actions') return <ActionHistory />
  if(route === 'employee-cards') return <EmployeeCards currentUser={currentUser} />
  if(route === 'shift-management') return <ShiftManagement currentUser={currentUser} />
  if(route === 'attendance-tracking') return <AttendanceTracking currentUser={currentUser} />
  if(route === 'employee-performance') return <EmployeePerformanceTracking currentUser={currentUser} />
  if(route === 'employee-bonus') return <EmployeeBonusSystem currentUser={currentUser} />
  if(route === 'employee-audit') return <EmployeeAuditRecords currentUser={currentUser} />
  if(route === 'employee-reports') return <EmployeeReports />
  if(route === 'staff') return <StaffTracking />
  if(route === 'current-report') return <CurrentReport />
  if(route === 'risky-current') return <RiskyCurrentAccounts />
  if(route === 'branches') return <BranchManagement currentUser={currentUser} onBranchesChange={onBranchesChange} />
  if(route === 'branch-permissions') return <BranchPermissions currentUser={currentUser} />
  if(route === 'branch-reporting') return <BranchReporting />
  if(route === 'branch-stock-transfers') return <BranchStockTransfers currentUser={currentUser} />
  if(route === 'head-office-management') return <HeadOfficeManagement />
  if(route === 'users') return <Users currentUser={currentUser} />
  if(route === 'current-accounts') return <CurrentAccounts currentUser={currentUser} />
  if(route === 'credit-transactions') return <CreditTransactions currentUser={currentUser} />
  if(route === 'collection-transactions') return <CollectionTransactions currentUser={currentUser} />
  if(route === 'current-account-movements') return <CurrentAccountMovements />
  if(route === 'settings') return <Settings currentUser={currentUser} onSettingsChange={onSettingsChange} />

  return null
}
