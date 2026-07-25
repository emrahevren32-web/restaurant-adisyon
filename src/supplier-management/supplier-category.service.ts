import { SUPPLIER_CATEGORIES } from './supplier-management.mock'
import type { Supplier, SupplierCategory, SupplierType } from './supplier-management.types'

export const SupplierCategoryService = {
  listCategories: (): SupplierCategory[] => (
    [...SUPPLIER_CATEGORIES].sort((first, second) => first.sortOrder - second.sortOrder)
  ),

  getCategoryById: (categoryId: string): SupplierCategory | undefined => (
    SUPPLIER_CATEGORIES.find(category => category.id === categoryId)
  ),

  getCategoryByType: (type: SupplierType): SupplierCategory | undefined => (
    SUPPLIER_CATEGORIES.find(category => category.type === type)
  ),

  getPrimaryCategory: (supplier: Supplier): SupplierCategory | undefined => (
    SUPPLIER_CATEGORIES.find(category => supplier.categoryIds.includes(category.id))
      || SUPPLIER_CATEGORIES.find(category => category.type === supplier.type)
  ),

  getCategoryNames: (supplier: Supplier): string[] => (
    supplier.categoryIds
      .map(categoryId => SUPPLIER_CATEGORIES.find(category => category.id === categoryId)?.name)
      .filter((name): name is string => Boolean(name))
  )
}
