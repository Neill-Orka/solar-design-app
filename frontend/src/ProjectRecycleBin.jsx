import React, { useEffect, useState } from "react";
import { Table, Button, Alert, Spinner, Badge, Modal } from "react-bootstrap";
import { API_URL } from "./apiConfig";
import { useAuth } from "./AuthContext";

const ProjectRecycleBin = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmPermanent, setConfirmPermanent] = useState(false);
  const [selected, setSelected] = useState(null);

  const loadDeleted = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/projects/recyclebin`, {
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadDeleted();
  }, [isAdmin]);

  const restore = async (id) => {
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || ""}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Restore failed");
      }
      await loadDeleted();
    } catch (e) {
      alert(e.message);
    }
  };

  const permanentDelete = async () => {
    if (!selected) return;
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(
        `${API_URL}/api/projects/${selected.id}/permanent`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token || ""}` },
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Delete failed");
      setConfirmPermanent(false);
      setSelected(null);
      await loadDeleted();
    } catch (e) {
      alert(e.message);
    }
  };

  if (!isAdmin) {
    return (
      <Alert variant="danger" className="m-4">
        Access denied.
      </Alert>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>
          <i className="bi bi-trash"></i> Project Recycle Bin
        </h2>
        <div>
          <Button
            variant="outline-secondary"
            onClick={() => window.history.back()}
          >
            <i className="bi bi-arrow-left"></i> Back
          </Button>
        </div>
      </div>

      {loading && <Spinner animation="border" />}
      {error && <Alert variant="danger">{error}</Alert>}

      {!loading && !error && rows.length === 0 && (
        <Alert variant="info">No deleted projects.</Alert>
      )}

      {!loading && rows.length > 0 && (
        <Table hover responsive>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Client</th>
              <th>System</th>
              <th>Design</th>
              <th>Location</th>
              <th>Deleted At</th>
              <th>Deleted By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>{p.client_name}</td>
                <td>
                  <Badge bg="info">{p.system_type || "—"}</Badge>
                </td>
                <td>
                  <Badge bg="secondary">{p.design_type || "—"}</Badge>
                </td>
                <td>{p.location || "—"}</td>
                <td>
                  {p.deleted_at ? new Date(p.deleted_at).toLocaleString() : "—"}
                </td>
                <td>{p.deleted_by_name || "—"}</td>
                <td>
                  <Button
                    variant="success"
                    size="sm"
                    className="me-2"
                    onClick={() => restore(p.id)}
                  >
                    <i className="bi bi-arrow-counterclockwise"></i> Restore
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setSelected(p);
                      setConfirmPermanent(true);
                    }}
                  >
                    <i className="bi bi-trash"></i> Permanent
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={confirmPermanent} onHide={() => setConfirmPermanent(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Permanent Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selected && (
            <p>
              Permanently delete project <strong>{selected.name}</strong>?<br />
              This cannot be undone.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setConfirmPermanent(false)}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={permanentDelete}>
            Delete Forever
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProjectRecycleBin;
