import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Container,
  Dropdown,
  Form,
  InputGroup,
  Modal,
  Offcanvas,
  Pagination,
  Row,
  Table,
  Tab,
  Tabs,
} from 'react-bootstrap';
import {
  BsPlusLg,
  BsGrid,
  BsListUl,
  BsFilter,
  BsThreeDots,
  BsTrash,
  BsPencil,
  BsEye,
  BsSearch,
  BsPaperclip,
} from 'react-icons/bs';

// ─────────────────────────────────────────────────────────────────────────────
// Types (UI-only; aligns roughly to your backend shape)
// ─────────────────────────────────────────────────────────────────────────────
type JobCardStatus = 'open' | 'completed' | 'invoiced' | 'cancelled';

type JobCard = {
  id: number;
  title: string;
  client_name: string;
  owner_name: string;
  category?: string | null;
  status: JobCardStatus;
  start_at?: string | null;
  complete_at?: string | null;
  updated_at: string;
  did_travel?: boolean;
  materials_used?: boolean;
};

type Filters = {
  q: string;
  status: 'all' | JobCardStatus;
  owner: 'all' | string;
  category: 'all' | string;
  page: number;
  pageSize: number;
  sort: 'updated_desc' | 'updated_asc' | 'start_desc' | 'start_asc';
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock data (replace with real API later)
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_CATEGORIES = ['Maintenance', 'Commissioning', 'Fault Finding', 'COC', 'Install'];
const MOCK_OWNERS = ['M. Ndlovu', 'A. Smith', 'T. Zondi', 'P. Williams'];
const nowISO = () => new Date().toISOString();

const MOCK_ITEMS: JobCard[] = [
  {
    id: 1001,
    title: 'Replace DC isolator @ Rooftop A',
    client_name: 'GreenMart Midrand',
    owner_name: 'M. Ndlovu',
    category: 'Maintenance',
    status: 'open',
    start_at: '2025-09-12T08:00:00Z',
    updated_at: nowISO(),
    did_travel: true,
    materials_used: true,
  },
  {
    id: 1002,
    title: 'Commission 50 kW hybrid system',
    client_name: 'Apex Logistics',
    owner_name: 'A. Smith',
    category: 'Commissioning',
    status: 'open',
    start_at: '2025-09-14T09:30:00Z',
    updated_at: nowISO(),
    did_travel: false,
    materials_used: true,
  },
  {
    id: 1003,
    title: 'Fault: Inverter error 28',
    client_name: 'Sunny Cafe',
    owner_name: 'T. Zondi',
    category: 'Fault Finding',
    status: 'completed',
    start_at: '2025-09-09T13:30:00Z',
    complete_at: '2025-09-09T16:10:00Z',
    updated_at: nowISO(),
  },
  {
    id: 1004,
    title: 'COC – DB & inverter room',
    client_name: 'Westview Offices',
    owner_name: 'P. Williams',
    category: 'COC',
    status: 'invoiced',
    start_at: '2025-09-10T08:15:00Z',
    complete_at: '2025-09-10T12:00:00Z',
    updated_at: nowISO(),
  },
  {
    id: 1005,
    title: 'Panel install – Block C',
    client_name: 'Ridge Apartments',
    owner_name: 'A. Smith',
    category: 'Install',
    status: 'open',
    start_at: '2025-09-15T07:45:00Z',
    updated_at: nowISO(),
    did_travel: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<JobCardStatus, string> = {
  open: 'info',
  completed: 'success',
  invoiced: 'primary',
  cancelled: 'secondary',
};

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB') : '—';

const formatDateShort = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB') : '—';

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
const JobCardsPage: React.FC = () => {
  // Local UI state
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [filters, setFilters] = useState<Filters>({
    q: '',
    status: 'all',
    owner: 'all',
    category: 'all',
    page: 1,
    pageSize: 10,
    sort: 'updated_desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [items, setItems] = useState<JobCard[]>(MOCK_ITEMS);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Create/Edit modal state (UI-only)
  const [showEdit, setShowEdit] = useState(false);
  const [editModel, setEditModel] = useState<Partial<JobCard> | null>(null);

  // Delete confirm modal
  const [showDelete, setShowDelete] = useState(false);

  // Derived values
  const filtered = useMemo(() => {
    let list = [...items];

    // search
    if (filters.q.trim()) {
      const q = filters.q.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.client_name.toLowerCase().includes(q) ||
          i.owner_name.toLowerCase().includes(q) ||
          (i.category || '').toLowerCase().includes(q)
      );
    }
    // status
    if (filters.status !== 'all') {
      list = list.filter((i) => i.status === filters.status);
    }
    // owner
    if (filters.owner !== 'all') {
      list = list.filter((i) => i.owner_name === filters.owner);
    }
    // category
    if (filters.category !== 'all') {
      list = list.filter((i) => (i.category || '') === filters.category);
    }
    // sort
    list.sort((a, b) => {
      const by = filters.sort;
      const av = by.includes('updated') ? a.updated_at : (a.start_at || '');
      const bv = by.includes('updated') ? b.updated_at : (b.start_at || '');
      if (by.endsWith('desc')) return (bv > av ? 1 : -1);
      return (av > bv ? 1 : -1);
    });

    return list;
  }, [items, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / filters.pageSize));
  const paged = useMemo(() => {
    const start = (filters.page - 1) * filters.pageSize;
    return filtered.slice(start, start + filters.pageSize);
  }, [filtered, filters.page, filters.pageSize]);

  const counts = useMemo(() => {
    const c = { all: items.length, open: 0, completed: 0, invoiced: 0, cancelled: 0 };
    items.forEach((i) => ((c as any)[i.status] += 1));
    return c as { all: number } & Record<JobCardStatus, number>;
  }, [items]);

  // ── UI intents (stubbed; no backend yet) ───────────────────────────────────
  const openCreate = () => {
    setEditModel({
      title: '',
      client_name: '',
      owner_name: MOCK_OWNERS[0],
      category: MOCK_CATEGORIES[0],
      status: 'open',
      start_at: '',
    });
    setShowEdit(true);
  };

  const openEdit = (id: number) => {
    const current = items.find((i) => i.id === id);
    if (!current) return;
    setEditModel({ ...current });
    setShowEdit(true);
  };

  const saveEdit = () => {
    if (!editModel) return;
    // UI-only: add/update locally
    if (editModel.id) {
      setItems((prev) => prev.map((i) => (i.id === editModel.id ? { ...(i as JobCard), ...(editModel as JobCard), updated_at: nowISO() } : i)));
      setSelectedId(editModel.id);
    } else {
      const nextId = Math.max(...items.map((i) => i.id)) + 1;
      setItems((prev) => [
        {
          id: nextId,
          title: editModel.title || 'Untitled job',
          client_name: editModel.client_name || 'Client',
          owner_name: editModel.owner_name || MOCK_OWNERS[0],
          category: editModel.category || null,
          status: (editModel.status as JobCardStatus) || 'open',
          start_at: editModel.start_at || null,
          updated_at: nowISO(),
        },
        ...prev,
      ]);
      setSelectedId(nextId);
    }
    setShowEdit(false);
  };

  const confirmDelete = (id: number) => {
    setSelectedId(id);
    setShowDelete(true);
  };

  const doDelete = () => {
    if (selectedId == null) return;
    setItems((prev) => prev.filter((i) => i.id !== selectedId));
    setSelectedId(null);
    setShowDelete(false);
  };

  const selected = items.find((i) => i.id === selectedId) || null;

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <Container fluid className="py-3">
      {/* Page header */}
      <Row className="g-3 align-items-center mb-2">
        <Col xs="auto">
          <div className="d-flex align-items-center gap-2">
            <div className="rounded-circle bg-info p-2 text-white">
              <BsClipboardIcon />
            </div>
            <div>
              <h4 className="mb-0">Job Cards</h4>
              <small className="text-muted">Track field work, materials and completion</small>
            </div>
          </div>
        </Col>
        <Col className="d-flex justify-content-end align-items-center gap-2">
          <Button variant="outline-secondary" onClick={() => setShowFilters(true)}>
            <BsFilter className="me-1" /> Filters
          </Button>
          <div className="btn-group" role="group" aria-label="View toggle">
            <Button
              variant={view === 'cards' ? 'primary' : 'outline-primary'}
              onClick={() => setView('cards')}
              title="Card view"
            >
              <BsGrid />
            </Button>
            <Button
              variant={view === 'table' ? 'primary' : 'outline-primary'}
              onClick={() => setView('table')}
              title="Table view"
            >
              <BsListUl />
            </Button>
          </div>
          <Button onClick={openCreate}>
            <BsPlusLg className="me-1" />
            New Job Card
          </Button>
        </Col>
      </Row>

      {/* Toolbar */}
      <Row className="g-2 align-items-center mb-3">
        <Col md={6}>
          <InputGroup>
            <InputGroup.Text><BsSearch /></InputGroup.Text>
            <Form.Control
              placeholder="Search title, client, owner or category…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
            />
          </InputGroup>
        </Col>
        <Col md={6} className="d-flex justify-content-md-end gap-2">
          <Form.Select
            value={filters.sort}
            onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as Filters['sort'] }))}
            style={{ maxWidth: 240 }}
          >
            <option value="updated_desc">Sort: Updated (newest)</option>
            <option value="updated_asc">Sort: Updated (oldest)</option>
            <option value="start_desc">Sort: Start date (newest)</option>
            <option value="start_asc">Sort: Start date (oldest)</option>
          </Form.Select>
          <Form.Select
            value={filters.pageSize}
            onChange={(e) => setFilters((f) => ({ ...f, pageSize: Number(e.target.value), page: 1 }))}
            style={{ maxWidth: 140 }}
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </Form.Select>
        </Col>
      </Row>

      {/* Status chips */}
      <Row className="g-2 mb-3">
        <Col>
          <div className="d-flex flex-wrap gap-2">
            <StatusChip
              label={`All (${counts.all})`}
              active={filters.status === 'all'}
              onClick={() => setFilters((f) => ({ ...f, status: 'all', page: 1 }))}
            />
            <StatusChip
              label={`Open (${counts.open})`}
              variant="info"
              active={filters.status === 'open'}
              onClick={() => setFilters((f) => ({ ...f, status: 'open', page: 1 }))}
            />
            <StatusChip
              label={`Completed (${counts.completed})`}
              variant="success"
              active={filters.status === 'completed'}
              onClick={() => setFilters((f) => ({ ...f, status: 'completed', page: 1 }))}
            />
            <StatusChip
              label={`Invoiced (${counts.invoiced})`}
              variant="primary"
              active={filters.status === 'invoiced'}
              onClick={() => setFilters((f) => ({ ...f, status: 'invoiced', page: 1 }))}
            />
            <StatusChip
              label={`Cancelled (${counts.cancelled})`}
              variant="secondary"
              active={filters.status === 'cancelled'}
              onClick={() => setFilters((f) => ({ ...f, status: 'cancelled', page: 1 }))}
            />
          </div>
        </Col>
      </Row>

      {/* Content */}
      {view === 'cards' ? (
        <Row className="g-3">
          {paged.map((jc) => (
            <Col key={jc.id} xs={12} md={6} lg={4} xxl={3}>
              <Card className={`h-100 shadow-sm border-0 jc-card jc-${jc.status}`}>
                <Card.Body className="d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <div className="me-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className="jc-dot" />
                        <Card.Title as="h6" className="mb-0 text-truncate" title={jc.title}>
                          {jc.title}
                        </Card.Title>
                      </div>
                      <div className="small text-muted text-truncate">{jc.client_name}</div>
                    </div>
                    <Dropdown align="end">
                      <Dropdown.Toggle variant="light" size="sm" className="border">
                        <BsThreeDots />
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item onClick={() => setSelectedId(jc.id)}>
                          <BsEye className="me-2" /> View
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => openEdit(jc.id)}>
                          <BsPencil className="me-2" /> Edit
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item className="text-danger" onClick={() => confirmDelete(jc.id)}>
                          <BsTrash className="me-2" /> Delete
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mb-2">
                    <Badge bg={STATUS_BADGE[jc.status]}>{jc.status}</Badge>
                    {jc.category && <Badge bg="light" text="dark">{jc.category}</Badge>}
                    {jc.did_travel && <Badge bg="light" text="dark">Travel</Badge>}
                    {jc.materials_used && (
                      <Badge bg="light" text="dark"><BsPaperclip className="me-1" />Materials</Badge>
                    )}
                  </div>

                  <div className="small text-muted flex-grow-1">
                    <div><strong>Owner:</strong> {jc.owner_name}</div>
                    <div><strong>Start:</strong> {formatDateShort(jc.start_at)}</div>
                    <div><strong>Updated:</strong> {formatDate(jc.updated_at)}</div>
                  </div>

                  <div className="d-flex gap-2 mt-3">
                    <Button size="sm" variant="outline-primary" onClick={() => setSelectedId(jc.id)}>
                      <BsEye className="me-1" /> View
                    </Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => openEdit(jc.id)}>
                      <BsPencil className="me-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => confirmDelete(jc.id)}>
                      <BsTrash className="me-1" /> Delete
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
          {paged.length === 0 && (
            <Col xs={12}>
              <Card className="border-0 shadow-sm">
                <Card.Body className="text-center py-5 text-muted">
                  No job cards match your filters.
                </Card.Body>
              </Card>
            </Col>
          )}
        </Row>
      ) : (
        <div className="table-responsive">
          <Table hover className="align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: 36 }} />
                <th>Title</th>
                <th>Client</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Category</th>
                <th>Start</th>
                <th>Updated</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {paged.map((jc) => (
                <tr key={jc.id} className={selectedId === jc.id ? 'table-primary' : ''}>
                  <td><span className={`jc-table-dot jc-${jc.status}`} /></td>
                  <td className="fw-semibold text-truncate">{jc.title}</td>
                  <td className="text-truncate">{jc.client_name}</td>
                  <td>{jc.owner_name}</td>
                  <td><Badge bg={STATUS_BADGE[jc.status]}>{jc.status}</Badge></td>
                  <td>{jc.category || '—'}</td>
                  <td>{formatDateShort(jc.start_at)}</td>
                  <td className="text-nowrap">{formatDate(jc.updated_at)}</td>
                  <td className="text-end">
                    <div className="btn-group btn-group-sm">
                      <Button variant="outline-primary" onClick={() => setSelectedId(jc.id)} title="View"><BsEye /></Button>
                      <Button variant="outline-secondary" onClick={() => openEdit(jc.id)} title="Edit"><BsPencil /></Button>
                      <Button variant="outline-danger" onClick={() => confirmDelete(jc.id)} title="Delete"><BsTrash /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={9} className="text-center text-muted py-4">No job cards</td></tr>
              )}
            </tbody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="d-flex justify-content-center mt-3">
        <Pagination className="mb-0">
          <Pagination.Prev
            disabled={filters.page <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
          />
          <Pagination.Item active>{filters.page} / {totalPages}</Pagination.Item>
          <Pagination.Next
            disabled={filters.page >= totalPages}
            onClick={() => setFilters((f) => ({ ...f, page: Math.min(totalPages, f.page + 1) }))}
          />
        </Pagination>
      </div>

      {/* Filters offcanvas (mobile-first) */}
      <Offcanvas show={showFilters} onHide={() => setShowFilters(false)} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Filters</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <div className="mb-3">
            <Form.Label>Status</Form.Label>
            <Form.Select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as Filters['status'], page: 1 }))}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="completed">Completed</option>
              <option value="invoiced">Invoiced</option>
              <option value="cancelled">Cancelled</option>
            </Form.Select>
          </div>
          <div className="mb-3">
            <Form.Label>Owner</Form.Label>
            <Form.Select
              value={filters.owner}
              onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value as Filters['owner'], page: 1 }))}
            >
              <option value="all">All owners</option>
              {MOCK_OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
            </Form.Select>
          </div>
          <div className="mb-3">
            <Form.Label>Category</Form.Label>
            <Form.Select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value as Filters['category'], page: 1 }))}
            >
              <option value="all">All categories</option>
              {MOCK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Form.Select>
          </div>
          <div className="d-grid">
            <Button onClick={() => setShowFilters(false)}>Apply</Button>
          </div>
        </Offcanvas.Body>
      </Offcanvas>

      {/* Create/Edit modal (UI-only) */}
      <Modal show={showEdit} onHide={() => setShowEdit(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{editModel?.id ? 'Edit Job Card' : 'New Job Card'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Tabs defaultActiveKey="general" justify>
            <Tab eventKey="general" title="General">
              <Row className="g-3 pt-3">
                <Col md={8}>
                  <Form.Group className="mb-2">
                    <Form.Label>Title</Form.Label>
                    <Form.Control
                      value={editModel?.title || ''}
                      onChange={(e) => setEditModel((m) => ({ ...(m || {}), title: e.target.value }))}
                      placeholder="e.g. Commission 50 kW hybrid system"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-2">
                    <Form.Label>Status</Form.Label>
                    <Form.Select
                      value={(editModel?.status as JobCardStatus) || 'open'}
                      onChange={(e) => setEditModel((m) => ({ ...(m || {}), status: e.target.value as JobCardStatus }))}
                    >
                      <option value="open">Open</option>
                      <option value="completed">Completed</option>
                      <option value="invoiced">Invoiced</option>
                      <option value="cancelled">Cancelled</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Client</Form.Label>
                    <Form.Control
                      value={editModel?.client_name || ''}
                      onChange={(e) => setEditModel((m) => ({ ...(m || {}), client_name: e.target.value }))}
                      placeholder="Start typing client name…"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Owner / Technician</Form.Label>
                    <Form.Select
                      value={editModel?.owner_name || MOCK_OWNERS[0]}
                      onChange={(e) => setEditModel((m) => ({ ...(m || {}), owner_name: e.target.value }))}
                    >
                      {MOCK_OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Category</Form.Label>
                    <Form.Select
                      value={editModel?.category || MOCK_CATEGORIES[0]}
                      onChange={(e) => setEditModel((m) => ({ ...(m || {}), category: e.target.value }))}
                    >
                      {MOCK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Start date</Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={editModel?.start_at ? toLocalInput(editModel.start_at) : ''}
                      onChange={(e) => setEditModel((m) => ({ ...(m || {}), start_at: fromLocalInput(e.target.value) }))}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Tab>
            <Tab eventKey="labour" title="Labour & Travel">
              <div className="pt-3 text-muted small">
                Placeholder for labourers, hours, travel toggle, vehicle and km. (UI only)
              </div>
              <Row className="g-3 pt-2">
                <Col md={6}>
                  <Form.Check
                    type="switch"
                    id="did-travel"
                    label="Includes travel"
                    checked={!!editModel?.did_travel}
                    onChange={(e) => setEditModel((m) => ({ ...(m || {}), did_travel: e.target.checked }))}
                  />
                </Col>
                <Col md={6}>
                  <Form.Check
                    type="switch"
                    id="materials-used"
                    label="Materials used"
                    checked={!!editModel?.materials_used}
                    onChange={(e) => setEditModel((m) => ({ ...(m || {}), materials_used: e.target.checked }))}
                  />
                </Col>
              </Row>
            </Tab>
            <Tab eventKey="materials" title="Materials">
              <div className="pt-3 text-muted small">
                Placeholder for adding/removing line items from catalogue snapshot. (UI only)
              </div>
              <div className="border rounded p-3 mt-2 bg-light">No materials added.</div>
            </Tab>
            <Tab eventKey="attachments" title="Attachments">
              <div className="pt-3 text-muted small">
                Placeholder for photo uploads / files. (UI only)
              </div>
              <div className="border rounded p-3 mt-2 bg-light">No attachments yet.</div>
            </Tab>
          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowEdit(false)}>Cancel</Button>
          <Button onClick={saveEdit}>Save</Button>
        </Modal.Footer>
      </Modal>

      {/* Delete confirm */}
      <Modal show={showDelete} onHide={() => setShowDelete(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete job card</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          This will remove the job card <strong>“{selected?.title}”</strong>. This is a UI-only demo —
          no backend call will be made.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={doDelete}><BsTrash className="me-1" /> Delete</Button>
        </Modal.Footer>
      </Modal>

      {/* Details drawer */}
      <Offcanvas show={!!selected} onHide={() => setSelectedId(null)} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>{selected?.title || 'Job Card'}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {selected && (
            <>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <Badge bg={STATUS_BADGE[selected.status]} className="text-uppercase">
                  {selected.status}
                </Badge>
                {selected.category && <Badge bg="light" text="dark">{selected.category}</Badge>}
              </div>

              <Row className="small text-muted g-2 mb-3">
                <Col xs={6}><strong>Client:</strong> {selected.client_name}</Col>
                <Col xs={6}><strong>Owner:</strong> {selected.owner_name}</Col>
                <Col xs={6}><strong>Start:</strong> {formatDate(selected.start_at)}</Col>
                <Col xs={6}><strong>Updated:</strong> {formatDate(selected.updated_at)}</Col>
              </Row>

              <div className="mb-3">
                <h6 className="mb-2">Scope & Notes</h6>
                <div className="border rounded p-3 bg-light">
                  This is a placeholder for the technician’s notes / job scope. Replace with real data.
                </div>
              </div>

              <div className="mb-3">
                <h6 className="mb-2">Materials</h6>
                <div className="border rounded p-3 bg-light">No materials added.</div>
              </div>

              <div className="d-grid gap-2">
                <Button variant="outline-secondary" onClick={() => openEdit(selected.id)}><BsPencil className="me-1" /> Edit</Button>
                <Button variant="outline-danger" onClick={() => confirmDelete(selected.id)}><BsTrash className="me-1" /> Delete</Button>
              </div>
            </>
          )}
        </Offcanvas.Body>
      </Offcanvas>

      {/* Lightweight styles to elevate the UI (scoped by class names) */}
      <style>{`
        .jc-card { position: relative; border-radius: 1rem; }
        .jc-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 1rem;
          pointer-events: none;
          background: linear-gradient(135deg, rgba(0,0,0,0.02), rgba(0,0,0,0.06));
        }
        .jc-card .jc-dot {
          width: 10px; height: 10px; border-radius: 50%;
          display: inline-block; background: #adb5bd;
        }
        .jc-open .jc-dot { background: #0dcaf0; }       /* info */
        .jc-completed .jc-dot { background: #198754; }  /* success */
        .jc-invoiced .jc-dot { background: #0d6efd; }   /* primary */
        .jc-cancelled .jc-dot { background: #6c757d; }  /* secondary */

        .jc-table-dot {
          display: inline-block; width: 10px; height: 10px; border-radius: 50%;
          background: #adb5bd;
        }
        .jc-open.jc-table-dot { background: #0dcaf0 !important; }
        .jc-completed.jc-table-dot { background: #198754 !important; }
        .jc-invoiced.jc-table-dot { background: #0d6efd !important; }
        .jc-cancelled.jc-table-dot { background: #6c757d !important; }
      `}</style>
    </Container>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Small subcomponents
// ─────────────────────────────────────────────────────────────────────────────
const StatusChip: React.FC<{
  label: string;
  variant?: 'info' | 'success' | 'primary' | 'secondary';
  active?: boolean;
  onClick?: () => void;
}> = ({ label, variant = 'secondary', active, onClick }) => (
  <Button
    size="sm"
    variant={active ? variant : 'outline-' + variant}
    onClick={onClick}
  >
    {label}
  </Button>
);

// A simple icon “component” to keep bundle small (no extra import)
const BsClipboardIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" role="img" aria-label="clipboard">
    <path d="M10 1.5v1h1a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2h1v-1A.5.5 0 0 1 6.5 1h3a.5.5 0 0 1 .5.5z"/>
    <path d="M9.5 2h-3a.5.5 0 0 0-.5.5V3h4v-.5a.5.5 0 0 0-.5-.5z"/>
  </svg>
);

// Helpers for datetime-local input
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function fromLocalInput(val: string) {
  if (!val) return '';
  // store as UTC-ish ISO for placeholder purposes
  const d = new Date(val);
  return d.toISOString();
}

export default JobCardsPage;
