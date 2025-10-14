import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Form,
  InputGroup,
  ListGroup,
  Badge,
  Spinner,
  Alert,
  Table,
  Row,
  Col,
} from "react-bootstrap";
import { FaSearch } from "react-icons/fa";
import axios from "axios";
import { API_URL } from "./apiConfig";

export default function TariffSelector({
  currentTariffId,
  currentCustomRate,
  onChange,
}) {
  const [allTariffs, setAllTariffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectionMode, setSelectionMode] = useState("catalogue"); // 'catalogue' or 'custom'
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTariff, setSelectedTariff] = useState(null);
  const [customRate, setCustomRate] = useState("");

  const [filters, setFilters] = useState({
    power_user_type: "all",
    tariff_category: "all",
    structure: "all",
    supply_voltage: "all",
    transmission_zone: "all",
  });

  // Fetch all tariffs once on component mount
  useEffect(() => {
    const fetchTariffs = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/tariffs`);
        setAllTariffs(response.data);
      } catch (err) {
        setError("Could not load tariff catalogue.");
      } finally {
        setLoading(false);
      }
    };
    fetchTariffs();
  }, []);

  // When the component loads, set the initial state based on project data
  useEffect(() => {
    if (currentTariffId) {
      setSelectionMode("catalogue");
      const current = allTariffs.find((t) => t.id === currentTariffId);
      setSelectedTariff(current);
    } else if (currentCustomRate) {
      setSelectionMode("custom");
      setCustomRate(currentCustomRate);
    }
  }, [currentTariffId, currentCustomRate, allTariffs]);

  const availableOptions = useMemo(() => {
    let filtered = allTariffs;
    if (filters.power_user_type !== "all") {
      filtered = filtered.filter(
        (t) => t.power_user_type === filters.power_user_type
      );
    }
    const powerUserTypes = [
      ...new Set(allTariffs.map((t) => t.power_user_type)),
    ];
    const categories = [...new Set(filtered.map((t) => t.tariff_category))];
    const structures = [...new Set(filtered.map((t) => t.structure))];
    const voltages = [
      ...new Set(
        filtered.filter((t) => t.supply_voltage).map((t) => t.supply_voltage)
      ),
    ];
    const zones = [
      ...new Set(
        filtered
          .filter((t) => t.transmission_zone)
          .map((t) => t.transmission_zone)
      ),
    ];

    return { powerUserTypes, categories, structures, voltages, zones };
  }, [allTariffs, filters.power_user_type]);

  const filteredTariffs = useMemo(() => {
    const lowercasedSearchTerm = searchTerm.toLowerCase().trim();
    return allTariffs
      .filter(
        (t) =>
          filters.power_user_type === "all" ||
          t.power_user_type === filters.power_user_type
      )
      .filter(
        (t) =>
          filters.tariff_category === "all" ||
          t.tariff_category === filters.tariff_category
      )
      .filter(
        (t) => filters.structure === "all" || t.structure === filters.structure
      )
      .filter(
        (t) =>
          filters.supply_voltage === "all" ||
          t.supply_voltage === filters.supply_voltage
      )
      .filter(
        (t) =>
          filters.transmission_zone === "all" ||
          t.transmission_zone === filters.transmission_zone
      )
      .filter(
        (t) =>
          !lowercasedSearchTerm ||
          t.name.toLowerCase().includes(lowercasedSearchTerm)
      );
  }, [searchTerm, allTariffs, filters]);

  const handleModeChange = (mode) => {
    setSelectionMode(mode);
    if (mode === "custom") {
      setSelectedTariff(null);
      onChange({ tariff_id: null, custom_flat_rate: customRate });
    } else {
      setCustomRate("");
      onChange({
        tariff_id: selectedTariff?.id || null,
        custom_flat_rate: null,
      });
    }
  };

  const handleSelectTariff = (tariff) => {
    setSelectedTariff(tariff);
    onChange({ tariff_id: tariff.id, custom_flat_rate: null });
  };

  const handleCustomRateChange = (e) => {
    const newRate = e.target.value;
    setCustomRate(newRate);
    onChange({ tariff_id: null, custom_flat_rate: newRate });
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      const newFilters = { ...prev, [name]: value };
      // Reset dependent filters if a parent filter changes
      if (name === "power_user_type" && value !== "LPU") {
        newFilters.supply_voltage = "all";
        newFilters.transmission_zone = "all";
      }
      if (name === "power_user_type") {
        newFilters.tariff_category = "all";
        newFilters.structure = "all";
      }
      return newFilters;
    });
  };

  return (
    <Card>
      <Card.Header as="h5">Tariff Configuration</Card.Header>
      <Card.Body>
        <Form.Group className="mb-3">
          <Form.Check
            type="radio"
            name="tariffMode"
            label="Select from Tariff Catalogue"
            value="catalogue"
            checked={selectionMode === "catalogue"}
            onChange={(e) => handleModeChange(e.target.value)}
          />
          <Form.Check
            type="radio"
            name="tariffMode"
            label="Enter Custom Flat Rate (R/kWh)"
            value="custom"
            checked={selectionMode === "custom"}
            onChange={(e) => handleModeChange(e.target.value)}
          />
        </Form.Group>
        <hr />

        {selectionMode === "catalogue" ? (
          <>
            <h5>Tariff Catalogue</h5>
            <Row className="mb-3 g-2">
              <Col md={4}>
                <Form.Select
                  size="sm"
                  name="power_user_type"
                  value={filters.power_user_type}
                  onChange={handleFilterChange}
                >
                  <option value="all">All Power User Types</option>
                  {availableOptions.powerUserTypes.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Select
                  size="sm"
                  name="tariff_category"
                  value={filters.tariff_category}
                  onChange={handleFilterChange}
                >
                  <option value="all">All Categories</option>
                  {availableOptions.categories.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Select
                  size="sm"
                  name="structure"
                  value={filters.structure}
                  onChange={handleFilterChange}
                >
                  <option value="all">All Structures</option>
                  {availableOptions.structures.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              {/* Conditionally render LPU filters */}
              {filters.power_user_type === "LPU" && (
                <>
                  <Col md={6} className="mt-2">
                    <Form.Select
                      size="sm"
                      name="supply_voltage"
                      value={filters.supply_voltage}
                      onChange={handleFilterChange}
                    >
                      <option value="all">All Supply Voltages</option>
                      {availableOptions.voltages.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={6} className="mt-2">
                    <Form.Select
                      size="sm"
                      name="transmission_zone"
                      value={filters.transmission_zone}
                      onChange={handleFilterChange}
                    >
                      <option value="all">All Transmission Zones</option>
                      {availableOptions.zones.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                </>
              )}
            </Row>

            <InputGroup className="mb-3">
              <InputGroup.Text>
                <FaSearch />
              </InputGroup.Text>
              <Form.Control
                placeholder="Search tariffs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>

            {loading && <Spinner animation="border" size="sm" />}
            {error && <Alert variant="danger">{error}</Alert>}

            <ListGroup style={{ maxHeight: "200px", overflowY: "auto" }}>
              {filteredTariffs.map((t) => (
                <ListGroup.Item
                  key={t.id}
                  action
                  active={selectedTariff?.id === t.id}
                  onClick={() => handleSelectTariff(t)}
                  type="button"
                >
                  {t.name}{" "}
                  <Badge pill bg="secondary">
                    {t.power_user_type}
                  </Badge>
                </ListGroup.Item>
              ))}
            </ListGroup>

            {selectedTariff && (
              <div className="mt-3 p-3 border rounded bg-light">
                <h6>
                  Tariff Summary:{" "}
                  <span className="text-primary">{selectedTariff.name}</span>
                </h6>
                <Table bordered size="sm" className="mb-0">
                  <tbody>
                    {selectedTariff.rates.slice(0, 3).map(
                      (
                        r // Show first 3 rates as a preview
                      ) => (
                        <tr key={r.id}>
                          <td>{r.charge_name}</td>
                          <td>
                            <strong>{r.rate_value}</strong> {r.rate_unit}
                          </td>
                        </tr>
                      )
                    )}
                    {selectedTariff.rates.length > 3 && (
                      <tr>
                        <td colSpan="2" className="text-center text-muted">
                          ...and {selectedTariff.rates.length - 3} more rates.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            )}
          </>
        ) : (
          <>
            <h5>Custom Flat Rate</h5>
            <InputGroup>
              <Form.Control
                type="number"
                placeholder="e.g., 250.5"
                value={customRate}
                onChange={handleCustomRateChange}
              />
              <InputGroup.Text>R/kWh</InputGroup.Text>
            </InputGroup>
          </>
        )}
      </Card.Body>
    </Card>
  );
}
