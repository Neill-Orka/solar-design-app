import React, { useState, useEffect } from 'react';
import { Table, Button, Alert, Spinner, Badge, Modal } from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API_URL } from './apiConfig';
import { useNotification } from './NotificationContext';

const RecycleBin = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { showNotification } = useNotification();
  const { user } = useAuth();
  
  // For permanent delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      window.location.href = '/';
    }
  }, [user]);

  const loadDeletedProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/products/recyclebin`);
      setProducts(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load deleted products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeletedProducts();
  }, []);

  const handleRestore = async (id) => {
    try {
      await axios.post(`${API_URL}/api/products/${id}/restore`);
      showNotification('Product restored successfully', 'success');
      loadDeletedProducts(); // Refresh list
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to restore product', 'danger');
    }
  };

  const openDeleteModal = (product) => {
    setSelectedProduct(product);
    setShowDeleteModal(true);
  };

  const handlePermanentDelete = async () => {
    if (!selectedProduct) return;
    
    try {
      await axios.delete(`${API_URL}/api/products/${selectedProduct.id}/permanent`);
      showNotification('Product permanently deleted', 'success');
      setShowDeleteModal(false);
      loadDeletedProducts(); // Refresh list
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to permanently delete product', 'danger');
    }
  };

  if (loading) return <Spinner animation="border" />;

  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>
          <i className="bi bi-trash"></i> Product Recycle Bin
        </h2>
        <Button variant="outline-secondary" onClick={() => window.history.back()}>
          <i className="bi bi-arrow-left"></i> Back
        </Button>
      </div>

      {products.length === 0 ? (
        <Alert variant="info">No deleted products found.</Alert>
      ) : (
        <Table responsive hover>
          <thead>
            <tr>
              <th>ID</th>
              <th>Category</th>
              <th>Brand</th>
              <th>Model</th>
              <th>Price</th>
              <th>Deleted By</th>
              <th>Deleted At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id}>
                <td>{product.id}</td>
                <td>
                  <Badge bg="secondary">{product.category || 'N/A'}</Badge>
                </td>
                <td>{product.brand}</td>
                <td>{product.model}</td>
                <td>
                  {product.price ? (
                    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(product.price)
                  ) : (
                    'N/A'
                  )}
                </td>
                <td>{product.deleted_by_name || 'Unknown'}</td>
                <td>{product.deleted_at_formatted || 'Unknown'}</td>
                <td>
                  <Button 
                    variant="success" 
                    size="sm" 
                    onClick={() => handleRestore(product.id)}
                    className="me-2"
                  >
                    <i className="bi bi-arrow-counterclockwise"></i> Restore
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm" 
                    onClick={() => openDeleteModal(product)}
                  >
                    <i className="bi bi-trash"></i> Delete Permanently
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Confirmation Modal for Permanent Delete */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Permanent Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedProduct && (
            <p>
              Are you sure you want to <strong>permanently delete</strong> this product?
              <br /><br />
              <strong>Brand:</strong> {selectedProduct.brand}<br />
              <strong>Model:</strong> {selectedProduct.model}
              <br /><br />
              This action cannot be undone.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handlePermanentDelete}>
            Delete Permanently
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default RecycleBin;