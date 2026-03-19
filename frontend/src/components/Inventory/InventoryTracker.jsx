import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, Search, Filter, Download } from 'lucide-react';

const InventoryTracker = () => {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Mock initial data
  useEffect(() => {
    const mockData = [
      {
        id: 1,
        name: 'Office Laptop - Dell XPS 13',
        category: 'Electronics',
        quantity: 5,
        minStock: 2,
        unitPrice: 1299.99,
        totalValue: 6499.95,
        location: 'Office Storage',
        supplier: 'Dell Technologies',
        lastUpdated: '2024-01-15',
        status: 'In Stock'
      },
      {
        id: 2,
        name: 'Office Chairs - Ergonomic',
        category: 'Furniture',
        quantity: 1,
        minStock: 3,
        unitPrice: 299.99,
        totalValue: 299.99,
        location: 'Main Office',
        supplier: 'OfficeMax',
        lastUpdated: '2024-01-14',
        status: 'Low Stock'
      },
      {
        id: 3,
        name: 'Printer Paper - A4',
        category: 'Office Supplies',
        quantity: 50,
        minStock: 10,
        unitPrice: 8.99,
        totalValue: 449.50,
        location: 'Supply Closet',
        supplier: 'Staples',
        lastUpdated: '2024-01-16',
        status: 'In Stock'
      }
    ];
    setInventoryItems(mockData);
  }, []);

  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    quantity: 0,
    minStock: 0,
    unitPrice: 0,
    location: '',
    supplier: '',
    status: 'In Stock'
  });

  const categories = ['Electronics', 'Furniture', 'Office Supplies', 'Equipment', 'Other'];
  const statuses = ['In Stock', 'Low Stock', 'Out of Stock', 'On Order'];

  const handleAddItem = (e) => {
    e.preventDefault();
    const totalValue = newItem.quantity * newItem.unitPrice;
    const status = newItem.quantity <= newItem.minStock ? 'Low Stock' : 'In Stock';
    
    const item = {
      id: Date.now(),
      ...newItem,
      totalValue,
      status,
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    setInventoryItems([...inventoryItems, item]);
    setNewItem({
      name: '',
      category: '',
      quantity: 0,
      minStock: 0,
      unitPrice: 0,
      location: '',
      supplier: '',
      status: 'In Stock'
    });
    setShowAddForm(false);
  };

  const handleEditItem = (item) => {
    setEditingItem({ ...item });
    setShowEditForm(true);
  };

  const handleUpdateItem = (e) => {
    e.preventDefault();
    const totalValue = editingItem.quantity * editingItem.unitPrice;
    const status = editingItem.quantity <= editingItem.minStock ? 'Low Stock' : 
                  editingItem.quantity === 0 ? 'Out of Stock' : 'In Stock';

    const updatedItem = {
      ...editingItem,
      totalValue,
      status,
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    setInventoryItems(inventoryItems.map(item => 
      item.id === editingItem.id ? updatedItem : item
    ));
    setShowEditForm(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      setInventoryItems(inventoryItems.filter(item => item.id !== id));
    }
  };

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalValue = inventoryItems.reduce((sum, item) => sum + item.totalValue, 0);
  const lowStockItems = inventoryItems.filter(item => item.status === 'Low Stock').length;
  const outOfStockItems = inventoryItems.filter(item => item.status === 'Out of Stock').length;

  const exportToCSV = () => {
    const headers = ['Name', 'Category', 'Quantity', 'Min Stock', 'Unit Price', 'Total Value', 'Location', 'Supplier', 'Status', 'Last Updated'];
    const csvData = inventoryItems.map(item => [
      item.name,
      item.category,
      item.quantity,
      item.minStock,
      item.unitPrice,
      item.totalValue,
      item.location,
      item.supplier,
      item.status,
      item.lastUpdated
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_report.csv';
    a.click();
  };

  const ItemForm = ({ item, onSubmit, onCancel, isEdit = false }) => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {isEdit ? 'Edit Inventory Item' : 'Add New Inventory Item'}
          </h3>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={isEdit ? editingItem?.name || '' : newItem.name}
                  onChange={(e) => isEdit 
                    ? setEditingItem({...editingItem, name: e.target.value})
                    : setNewItem({...newItem, name: e.target.value})
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={isEdit ? editingItem?.category || '' : newItem.category}
                  onChange={(e) => isEdit 
                    ? setEditingItem({...editingItem, category: e.target.value})
                    : setNewItem({...newItem, category: e.target.value})
                  }
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={isEdit ? editingItem?.quantity || 0 : newItem.quantity}
                  onChange={(e) => isEdit 
                    ? setEditingItem({...editingItem, quantity: parseInt(e.target.value) || 0})
                    : setNewItem({...newItem, quantity: parseInt(e.target.value) || 0})
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Stock Level
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={isEdit ? editingItem?.minStock || 0 : newItem.minStock}
                  onChange={(e) => isEdit 
                    ? setEditingItem({...editingItem, minStock: parseInt(e.target.value) || 0})
                    : setNewItem({...newItem, minStock: parseInt(e.target.value) || 0})
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={isEdit ? editingItem?.unitPrice || 0 : newItem.unitPrice}
                  onChange={(e) => isEdit 
                    ? setEditingItem({...editingItem, unitPrice: parseFloat(e.target.value) || 0})
                    : setNewItem({...newItem, unitPrice: parseFloat(e.target.value) || 0})
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={isEdit ? editingItem?.location || '' : newItem.location}
                  onChange={(e) => isEdit 
                    ? setEditingItem({...editingItem, location: e.target.value})
                    : setNewItem({...newItem, location: e.target.value})
                  }
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={isEdit ? editingItem?.supplier || '' : newItem.supplier}
                  onChange={(e) => isEdit 
                    ? setEditingItem({...editingItem, supplier: e.target.value})
                    : setNewItem({...newItem, supplier: e.target.value})
                  }
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {isEdit ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Inventory Tracker</h1>
        <p className="text-gray-600">Manage your company assets and inventory</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{inventoryItems.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 font-bold">$</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">${totalValue.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 font-bold">!</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900">{lowStockItems}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 font-bold">×</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Out of Stock</p>
              <p className="text-2xl font-bold text-gray-900">{outOfStockItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search items..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex space-x-2">
              <select
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={exportToCSV}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Min Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.location}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.minStock}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.unitPrice.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${item.totalValue.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      item.status === 'In Stock' ? 'bg-green-100 text-green-800' :
                      item.status === 'Low Stock' ? 'bg-yellow-100 text-yellow-800' :
                      item.status === 'Out of Stock' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditItem(item)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredItems.length === 0 && (
          <div className="text-center py-8">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || filterCategory !== 'all' || filterStatus !== 'all' 
                ? 'Try adjusting your search or filters.' 
                : 'Get started by adding your first inventory item.'}
            </p>
          </div>
        )}
      </div>

      {/* Add Item Form Modal */}
      {showAddForm && (
        <ItemForm
          item={newItem}
          onSubmit={handleAddItem}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Edit Item Form Modal */}
      {showEditForm && (
        <ItemForm
          item={editingItem}
          onSubmit={handleUpdateItem}
          onCancel={() => {
            setShowEditForm(false);
            setEditingItem(null);
          }}
          isEdit={true}
        />
      )}
    </div>
  );
};

export default InventoryTracker;