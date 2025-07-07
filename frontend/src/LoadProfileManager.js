import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Container, Row, Col, Card, Button, Form, Spinner, Alert, ListGroup, InputGroup, Modal, Badge } from 'react-bootstrap';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, Filler } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { API_URL } from './apiConfig'; // Adjust the import based on your project structure

// Register Chart.js components (important!)
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale, Filler);

// A helper component to render the mini-chart for a profile
const ProfileMiniChart = ({ profileData }) => {
    const chartData = useMemo(() => {
        if (!profileData || profileData.length === 0) return { labels: [], datasets: [] };
        
        // Take a sample of the data (e.g., first week) for performance
        const sampleData = profileData.slice(0, 336);
        const labels = sampleData.map(d => new Date(d.timestamp || d.Timestamp));
        const data = sampleData.map(d => d.demand_kw || d.Demand_kW || 0);

        return {
            labels,
            datasets: [{
                data,
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.4,
                fill: true,
            }]
        };
    }, [profileData]);

    const options = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } }
    };

    return <div style={{ height: '80px' }}><Line data={chartData} options={options} /></div>;
};


function LoadProfileManager() {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // State for the creation/editing form
    const [editingProfile, setEditingProfile] = useState(null); // null for new, or profile object for editing
    const [profileName, setProfileName] = useState('');
    const [profileDesc, setProfileDesc] = useState('');
    const [profileType, setProfileType] = useState('Residential');
    const [profileFile, setProfileFile] = useState(null);

    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = () => {
        setLoading(true);
        axios.get(`${API_URL}/api/load_profiles`)
            .then(res => setProfiles(res.data))
            .catch(err => setError("Failed to load existing profiles."))
            .finally(() => setLoading(false));
    };

    const handleFileChange = (e) => {
        setProfileFile(e.target.files[0]);
    };

    const handleClearForm = () => {
        setEditingProfile(null);
        setProfileName('');
        setProfileDesc('');
        setProfileType('Residential');
        setProfileFile(null);
        setFormError('');
        setFormSuccess('');
    };

    const handleEditClick = (profile) => {
        setEditingProfile(profile);
        setProfileName(profile.name);
        setProfileDesc(profile.description);
        setProfileType(profile.profile_type);
        setProfileFile(null); // Clear file input on edit
        setFormError('');
        setFormSuccess('');
        window.scrollTo(0, 0); // Scroll to top to see the form
    };
    
    const handleDelete = (profileId) => {
        if (window.confirm("Are you sure you want to delete this load profile? This action cannot be undone.")) {
            axios.delete(`${API_URL}/api/load_profiles/${profileId}`)
                .then(() => {
                    alert('Profile deleted successfully!');
                    fetchProfiles(); // Refresh the list
                })
                .catch(err => alert("Error deleting profile: " + (err.response?.data?.error || err.message)));
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!profileName.trim()) {
            setFormError("Profile Name is required.");
            return;
        }
        // File is only required when creating a new profile
        if (!editingProfile && !profileFile) {
            setFormError("A CSV or XLSX file is required to create a new profile.");
            return;
        }

        setIsSaving(true);
        setFormError('');
        setFormSuccess('');

        if (editingProfile) {
            // This is an UPDATE action (only name and description)
            const payload = { name: profileName, description: profileDesc };
            axios.put(`${API_URL}/api/load_profiles/${editingProfile.id}`, payload)
                .then(() => {
                    setFormSuccess("Profile updated successfully!");
                    handleClearForm();
                    fetchProfiles();
                })
                .catch(err => setFormError(err.response?.data?.error || "Failed to update profile."))
                .finally(() => setIsSaving(false));
        } else {
            // This is a CREATE action (sends form data)
            const formData = new FormData();
            formData.append('profile_file', profileFile);
            formData.append('name', profileName);
            formData.append('description', profileDesc);
            formData.append('profile_type', profileType);

            axios.post(`${API_URL}/api/load_profiles`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            .then(() => {
                setFormSuccess("Profile created successfully!");
                handleClearForm();
                fetchProfiles();
            })
            .catch(err => setFormError(err.response?.data?.error || "Failed to create profile."))
            .finally(() => setIsSaving(false));
        }
    };

    if (loading) return <div className="text-center p-5"><Spinner animation="border" /></div>;

    return (
        <div className="min-vh-100" style={{ backgroundColor: '#f8f9fa' }}>
            <Container className="py-4 py-md-5">
                <Row>
                    {/* Left Column: Form for Creating/Editing */}
                    <Col lg={5} className="mb-4 mb-lg-0">
                        <div className="sticky-top" style={{ top: '88px' }}>
                            <Card className="shadow-lg border-0 rounded-xl">
                                <Card.Header className="bg-dark text-white rounded-top-xl py-3">
                                    <h3 className="text-xl font-semibold mb-0">
                                        <i className="bi bi-plus-circle-fill me-2"></i>
                                        {editingProfile ? 'Edit Load Profile' : 'Create New Load Profile'}
                                    </h3>
                                </Card.Header>
                                <Card.Body className="p-4">
                                    <Form onSubmit={handleSubmit}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Profile Name</Form.Label>
                                            <Form.Control type="text" placeholder="e.g., Business Hours 9-5" value={profileName} onChange={e => setProfileName(e.target.value)} required />
                                        </Form.Group>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Description</Form.Label>
                                            <Form.Control as="textarea" rows={2} placeholder="Briefly describe the usage pattern" value={profileDesc} onChange={e => setProfileDesc(e.target.value)} />
                                        </Form.Group>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Profile Type</Form.Label>
                                            <Form.Select value={profileType} onChange={e => setProfileType(e.target.value)} disabled={!!editingProfile}>
                                                <option value="Residential">Residential</option>
                                                <option value="Commercial">Commercial</option>
                                            </Form.Select>
                                        </Form.Group>
                                        <Form.Group className="mb-4">
                                            <Form.Label>{editingProfile ? 'Replace Profile Data (Optional)' : 'Profile Data File'}</Form.Label>
                                            <Form.Control type="file" accept=".csv, .xlsx, .xls" onChange={handleFileChange} disabled={!!editingProfile}/>
                                            <Form.Text muted>
                                                {editingProfile ? 'File upload is disabled during edit.' : 'CSV/XLSX with "Timestamp" and "Demand_kW" columns.'}
                                            </Form.Text>
                                        </Form.Group>

                                        {formError && <Alert variant="danger">{formError}</Alert>}
                                        {formSuccess && <Alert variant="success">{formSuccess}</Alert>}

                                        <div className="d-grid gap-2">
                                            <Button variant="primary" type="submit" disabled={isSaving}>
                                                {isSaving ? <><Spinner size="sm" /> Saving...</> : editingProfile ? 'Update Profile' : 'Create Profile'}
                                            </Button>
                                            <Button variant="outline-secondary" onClick={handleClearForm}>Clear</Button>
                                        </div>
                                    </Form>
                                </Card.Body>
                            </Card>
                        </div>
                    </Col>

                    {/* Right Column: List of Existing Profiles */}
                    <Col lg={7}>
                        <Card className="shadow-lg border-0 rounded-xl p-4 p-md-5">
                            <h2 className="text-3xl font-bold text-gray-800 mb-4">Available Load Profiles</h2>
                            {error && <Alert variant="danger">{error}</Alert>}
                            <ListGroup variant="flush">
                                {profiles.map(profile => (
                                    <ListGroup.Item key={profile.id} className="px-0 py-3">
                                        <Row>
                                            <Col xs={12} md={8}>
                                                <p className="fw-bold mb-1">{profile.name}</p>
                                                <p className="text-muted text-sm mb-2">{profile.description}</p>
                                                <Badge pill bg={profile.profile_type === 'Residential' ? 'success' : 'info'}>{profile.profile_type}</Badge>
                                                {profile.annual_kwh > 0 && (
                                                    <Badge pill bg="secondary" className='ms-2'>
                                                        {Math.round(profile.annual_kwh/12).toLocaleString()} kWh/month
                                                    </Badge>
                                                )}
                                            </Col>
                                            <Col xs={12} md={4} className="d-flex flex-column justify-content-center align-items-md-end">
                                                <ProfileMiniChart profileData={profile.profile_data} />
                                                <div className="mt-2">
                                                    <Button variant="outline-primary" size="sm" className="me-2" onClick={() => handleEditClick(profile)}><i className="bi bi-pencil-fill"></i></Button>
                                                    <Button variant="outline-danger" size="sm" onClick={() => handleDelete(profile.id)}><i className="bi bi-trash-fill"></i></Button>
                                                </div>
                                            </Col>
                                        </Row>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </div>
    );
}

export default LoadProfileManager;
