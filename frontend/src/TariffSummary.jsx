import React from 'react';
import { Card, Badge, Table } from 'react-bootstrap';

// This component receives the tariff details and displays them.
export default function TariffSummary({ tariff, customRate }) {
    return (
        <div className="mb-4">
            <label className="fw-semibold form-label">Current Tariff</label>
            <Card bg='light' text='dark' className="p-3 border">
                {tariff ? (
                    // Display structured tariff details
                    <div>
                        <h5 className="mb-1">{tariff.name} <span className="text-muted">({tariff.matrix_code})</span></h5>
                        <div className="mb-2">
                            <Badge pill bg="primary" className="me-1">{tariff.power_user_type}</Badge>
                            <Badge pill bg="info" text="dark">{tariff.structure}</Badge>
                        </div>
                        <Table striped bordered size="sm" className="mb-0">
                            <thead>
                                <tr>
                                    <th>Charge Name</th>
                                    <th>Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tariff.rates.slice(0, 3).map((rate, index) => (
                                    <tr key={index}>
                                        <td>{rate.charge_name}</td>
                                        <td><strong>{rate.rate_value}</strong> {rate.rate_unit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                        {tariff.rates.length > 3 && (
                            <small className="text-muted d-block mt-1">...and {tariff.rates.length - 3} more rates.</small>
                        )}
                    </div>
                ) : customRate ? (
                    // Display custom flat rate
                    <div>
                        <h5 className="mb-1">Custom Flat Rate</h5>
                        <Badge pill bg="success">{customRate} R/kWh</Badge>
                    </div>
                ) : (
                    // Display if no tariff is set
                    <p className="mb-0 text-muted">No tariff selected for this project.</p> 
                )}
            </Card>
        </div>
    );
}