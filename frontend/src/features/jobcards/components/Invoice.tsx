import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button, Badge, Spinner, Alert, Form } from 'react-bootstrap';
import logo from './assets/orka_logo_text.png';
import './PrintableBOM.css';
import { useAuth } from '../../../AuthContext';
import { useNotification } from '../../../NotificationContext';
import { API_URL } from '../../../apiConfig';

/**
 * PrintableBOM (paginated, WYSIWYG, print-stable)
 */
function PrintableBOM({ projectId: propProjectId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projectId: urlProjectId, docId } = useParams();
  const [searchParams] = useSearchParams();
  
  // Use projectId from props if available (when used in ProjectDashboard), otherwise from URL
  const projectId = propProjectId || urlProjectId;

  // Check if we should auto-download
  const shouldAutoDownload = searchParams.get('action') === 'download';

  // Determine data source: if docId exists, load quote data; otherwise load BOM data
  const isQuoteMode = !!docId;
  
  // Quote state
  const [quoteData, setQuoteData] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { showNotification } = useNotification();
  
  // Project state
  const [projectData, setProjectData] = useState(null);
  const [projectLoading, setProjectLoading] = useState(false);
  
  // Retrieve data from localStorage (project-specific key or quote-specific key)
  const dataKey = isQuoteMode ? `quoteData_${docId}` : `printBomData_${projectId}`;
  const [bomData, setBomData] = useState({});

  // Puts 2 decimals in the number only if its not a whole number
  const formatNumber = (value) => {
    const num = Number(value);
    return Number.isInteger(num) ? num.toString() : num.toFixed(2);
  };
  
  // Load data from localStorage initially
  useEffect(() => {
    const storedData = localStorage.getItem(dataKey);
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        
        // If we're not in quote mode and don't have brand/model info, extract it from categories
        if (!isQuoteMode && parsedData.categories && (!parsedData.project?.inverter_brand_model || !parsedData.project?.battery_brand_model)) {
          let inverterBrandSize = parsedData.project?.inverter_brand_model || '';
          let batteryBrandSize = parsedData.project?.battery_brand_model || '';
          
          parsedData.categories.forEach(cat => {
            const categoryName = cat.name?.toLowerCase() || '';
            if (categoryName === 'inverter' && cat.items && cat.items.length > 0 && !inverterBrandSize) {
              const item = cat.items[0];
              if (item.product?.brand) {
                const brand = item.product.brand;
                const size = item.product?.rating_kva ? `${Number(item.product.rating_kva).toFixed(0)}kVA` : 
                            item.product?.power_w ? `${Number(item.product.power_w/1000).toFixed(0)}kW` : '';
                inverterBrandSize = size ? `${brand} ${size}` : brand;
              }
            } else if (categoryName === 'battery' && cat.items && cat.items.length > 0 && !batteryBrandSize) {
              const item = cat.items[0];
              if (item.product?.brand) {
                const brand = item.product.brand;
                const nominalSize = item.product?.capacity_kwh ? `${(Number(item.product.capacity_kwh) / 0.8).toFixed(0)}kWh` : '';
                batteryBrandSize = nominalSize ? `${brand} ${nominalSize}` : brand;
              }
            }
          });
          
          // Update the parsed data with extracted brand/size info
          if (parsedData.project) {
            parsedData.project.inverter_brand_model = inverterBrandSize;
            parsedData.project.battery_brand_model = batteryBrandSize;
          }
          
          // Save back to localStorage
          localStorage.setItem(dataKey, JSON.stringify(parsedData));
        }
        
        setBomData(parsedData);
      } catch (error) {
        console.error('Failed to parse stored data:', error);
        setBomData({});
      }
    }
  }, [dataKey, isQuoteMode]);
  const currentDate = new Date().toLocaleDateString('en-ZA');

  // Auto-download effect
  useEffect(() => {
    if (shouldAutoDownload) {
      // Wait a bit for the page to render completely, then trigger print
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [shouldAutoDownload]);

  // Load project data
  useEffect(() => {
    const loadProjectData = async () => {
      if (!projectId) return;
      setProjectLoading(true);
      try {
        const response = await axios.get(`${API_URL}/api/projects/${projectId}`);
        const data = response.data;
        console.log('Fetched project data:', data);

        // Extract inverter ID
        const inverterIds = data.inverter_ids || [];

        // if we have inverter ID, fetch details
        if (inverterIds.length > 0) {
          const inverterId = inverterIds[0]; // Only using first inverter
          const inverterResponse = await axios.get(`${API_URL}/api/products/${inverterId}`);
          const inverterData = inverterResponse.data;
          console.log('Fetched inverter data:', inverterData);

          if (inverterData) {
            const brand_name = inverterData.brand || '';
            const inverter_quantity = data.inverter_kva.quantity || 1;
            const power_rating_kva = inverterData.rating_kva ? `${formatNumber(Number(inverterData.rating_kva) * inverter_quantity)}kVA` : '';
            console.log('Inverter brand and capacity:', brand_name, power_rating_kva);

            // Store in project data for title display
            data.inverter_brand_model = power_rating_kva ? `${brand_name} ${power_rating_kva}` : brand_name;
          }
        }        

        // Extract battery ID
        const batteryIds = data.battery_ids || [];

        // if we have battery ID, fetch details
        if (batteryIds.length > 0) {
          const batteryId = batteryIds[0]; // Only using first battery
          const batteryResponse = await axios.get(`${API_URL}/api/products/${batteryId}`);
          const batteryData = batteryResponse.data;
          console.log('Fetched battery data:', batteryData);

          if (batteryData) {
            const brand_name = batteryData.brand || '';
            const battery_quantity = data.battery_kwh.quantity || 1;
            const nominal_capacity_kwh = batteryData.nominal_rating_kwh ? `${formatNumber(Number(batteryData.nominal_rating_kwh) * battery_quantity)}kWh` : '';
            console.log('Battery brand and capacity:', brand_name, nominal_capacity_kwh);

            console.log('Battery quantity from project data:', battery_quantity);

            // Store in project data for title display
            data.battery_brand_model = nominal_capacity_kwh ? `${brand_name} ${nominal_capacity_kwh}` : brand_name;
          }

        }

        setProjectData(data);

      } catch (error) {
        console.error('Failed to load project data:', error);
        showNotification('Failed to load project data', 'danger');
      } finally {
        setProjectLoading(false);
      }
    };
    
    loadProjectData();
  }, [projectId, showNotification]);

  // Load quote data from API when in quote mode
  useEffect(() => {
    if (isQuoteMode && docId) {
      const loadQuoteData = async () => {
        setQuoteLoading(true);
        try {
          // Load quote envelope and latest version
          const quoteResponse = await axios.get(`${API_URL}/api/quotes/${docId}`);
          const quote = quoteResponse.data;
          
          // Get the latest version ID
          const latestVersion = quote.versions[quote.versions.length - 1];
          
          // Load version details with line items
          const versionResponse = await axios.get(`${API_URL}/api/quote-versions/${latestVersion.id}`);
          const versionDetail = versionResponse.data;
          
          setQuoteData({ quote, version: versionDetail });
          
          // Also create the print data format and store in localStorage
          const categoryMap = {};
          versionDetail.lines.forEach(item => {
            const category = item.category || item.product_snapshot?.category || 'Other';
            if (!categoryMap[category]) {
              categoryMap[category] = { name: category, items: [] };
            }
            categoryMap[category].items.push({
              product: {
                brand: item.brand || '',
                model: item.model || ''
              },
              quantity: item.qty || 0,
              cost: item.unit_cost_locked || 0,
              price: item.unit_price_locked || 0,
              lineTotal: item.line_total_locked || 0
            });
          });
          
          // Extract inverter and battery information for title
          let inverterBrandSize = '';
          let batteryBrandSize = '';
          
          versionDetail.lines.forEach(item => {
            const category = (item.category || item.product_snapshot?.category || '').toLowerCase();
            const brand = item.brand || item.product_snapshot?.brand || '';
            const power_w = item.product_snapshot?.power_w;
            const rating_kva = item.product_snapshot?.rating_kva;
            const capacity_kwh = item.product_snapshot?.capacity_kwh;
            
            if (category === 'inverter' && brand) {
              const size = rating_kva ? `${Number(rating_kva).toFixed(0)}kVA` : 
                          power_w ? `${Number(power_w/1000).toFixed(0)}kW` : '';
              inverterBrandSize = size ? `${brand} ${size}` : brand;
            } else if (category === 'battery' && brand) {
              const nominalSize = capacity_kwh ? `${(Number(capacity_kwh) / 0.8).toFixed(0)}kWh` : '';
              batteryBrandSize = nominalSize ? `${brand} ${nominalSize}` : brand;
            }
          });

          const printData = {
            project: {
              id: parseInt(projectId),
              project_name: projectData?.name || `Quote ${quote.number}`,
              name: projectData?.name || `Quote ${quote.number}`,
              client_name: projectData?.client_name || quote.client_snapshot_json?.name || 'Client Name',
              client_email: projectData?.client_email || quote.client_snapshot_json?.email || '',
              client_phone: projectData?.client_phone || quote.client_snapshot_json?.phone || '',
              location: projectData?.location || quote.client_snapshot_json?.location || '',
              created_at: versionDetail.created_at,
              quote_number: quote.number,
              quote_status: quote.status || 'draft',
              inverter_brand_model: inverterBrandSize,
              battery_brand_model: batteryBrandSize
            },
            systemSpecs: versionDetail.payload || {},
            totals: {
              subtotal_excl_vat: versionDetail.totals?.subtotal_items_excl_vat || 0,
              extras_excl_vat: versionDetail.totals?.extras_excl_vat || 0,
              total_excl_vat: versionDetail.totals?.total_excl_vat || 0,
              vat_perc: versionDetail.totals?.vat_perc || 15,
              vat_price: versionDetail.totals?.vat_price || 0,
              total_incl_vat: versionDetail.totals?.total_incl_vat || 0
            },
            categories: Object.values(categoryMap)
          };
          
          localStorage.setItem(dataKey, JSON.stringify(printData));
          setBomData(printData); // Update the state immediately
          
        } catch (error) {
          console.error('Failed to load quote data:', error);
          showNotification('Failed to load quote data', 'danger');
        } finally {
          setQuoteLoading(false);
        }
      };
      
      loadQuoteData();
    }
  }, [isQuoteMode, docId, projectId, dataKey, showNotification]);

  // Quote action handlers
  const handleSendQuote = async () => {
    if (!window.confirm('Send this quote to the client?')) return;
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/quotes/${docId}/send`);
      showNotification('Quote sent successfully!', 'success');
      
      // Reload quote data to get updated status
      const quoteResponse = await axios.get(`${API_URL}/api/quotes/${docId}`);
      const quote = quoteResponse.data;
      console.log('Updated quote status:', quote.status); // Debug log
      const latestVersion = quote.versions[quote.versions.length - 1];
      const versionResponse = await axios.get(`${API_URL}/api/quote-versions/${latestVersion.id}`);
      const versionDetail = versionResponse.data;
      setQuoteData({ quote, version: versionDetail });
      
      // Trigger print after sending
      setTimeout(() => window.print(), 500);
    } catch (error) {
      console.error(error);
      showNotification(error.response?.data?.error || 'Failed to send quote', 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptQuote = async () => {
    if (!window.confirm('Mark this quote as accepted?')) return;
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/quotes/${docId}/accept`);
      showNotification('Quote accepted!', 'success');
      
      // Reload quote data to get updated status
      const quoteResponse = await axios.get(`${API_URL}/api/quotes/${docId}`);
      const quote = quoteResponse.data;
      const latestVersion = quote.versions[quote.versions.length - 1];
      const versionResponse = await axios.get(`${API_URL}/api/quote-versions/${latestVersion.id}`);
      const versionDetail = versionResponse.data;
      setQuoteData({ quote, version: versionDetail });
    } catch (error) {
      console.error(error);
      showNotification(error.response?.data?.error || 'Failed to accept quote', 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineQuote = async () => {
    if (!window.confirm('Mark this quote as declined?')) return;
    setActionLoading(true);
    try {
      await axios.post(`${API_URL}/api/quotes/${docId}/decline`);
      showNotification('Quote declined', 'info');
      
      // Reload quote data to get updated status
      const quoteResponse = await axios.get(`${API_URL}/api/quotes/${docId}`);
      const quote = quoteResponse.data;
      const latestVersion = quote.versions[quote.versions.length - 1];
      const versionResponse = await axios.get(`${API_URL}/api/quote-versions/${latestVersion.id}`);
      const versionDetail = versionResponse.data;
      setQuoteData({ quote, version: versionDetail });
    } catch (error) {
      console.error(error);
      showNotification(error.response?.data?.error || 'Failed to decline quote', 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  // Back button handler - navigate to appropriate tab
  const handleBack = () => {
    // If we have propProjectId, we're embedded in ProjectDashboard - don't navigate
    if (propProjectId) {
      // We're embedded in ProjectDashboard, don't show back button or do anything
      return;
    }
    
    // Get the 'from' parameter to determine which tab to return to
    const fromTab = searchParams.get('from');
    
    if (fromTab === 'quotes') {
      navigate(`/projects/${projectId}?tab=quotes`);
    } else if (fromTab === 'bom') {
      navigate(`/projects/${projectId}?tab=bom`);
    } else {
      // Default behavior - if coming from quote mode, go to quotes tab, otherwise BOM tab
      const defaultTab = isQuoteMode ? 'quotes' : 'bom';
      navigate(`/projects/${projectId}?tab=${defaultTab}`);
    }
  };

  const handleEditInBOM = async () => {
    if (!quoteData) return;
    try {
      const latestVersionId = quoteData.version.id;
      const response = await axios.post(`${API_URL}/api/quote-versions/${latestVersionId}/load-to-bom`);
      showNotification('Quote loaded to BOM for editing', 'success');
      
      // Check if we have core components data to synchronize SystemDesign
      if (response.data.core_components) {
        // Store core components for SystemDesign synchronization
        sessionStorage.setItem(`quoteLoadCoreComponents_${projectId}`, JSON.stringify(response.data.core_components));
      }
      
      navigate(`/projects/${projectId}?tab=bom`);
    } catch (error) {
      console.error(error);
      showNotification('Failed to load quote to BOM', 'danger');
    }
  };

  const [priceMode, setPriceMode] = useState(() => localStorage.getItem('bomPriceMode') || 'all');
  useEffect(() => localStorage.setItem('bomPriceMode', priceMode), [priceMode]);

  // category totals for the “category only” mode
  const categoryTotals = useMemo(() => {
    const map = {};
    (bomData.categories || []).forEach(cat => {
      map[cat.name] = (cat.items || []).reduce((s, it) => s + (it.price || 0) * (it.quantity || 0), 0);
    });
    return map;
  }, [bomData]);  

const [termsPerc, setTermsPerc] = useState(() => {
  const saved = localStorage.getItem(`bomTermsPerc_${projectId}`);
  return saved ? JSON.parse(saved) : [65, 25, 10];
});
useEffect(() => {
  localStorage.setItem(`bomTermsPerc_${projectId}`, JSON.stringify(termsPerc));
}, [termsPerc, projectId]);

const handleTermsChange = (i, val) => {
  const v = Math.max(0, Math.min(100, parseFloat(val) || 0));
  setTermsPerc(prev => prev.map((p, idx) => (idx === i ? v : p)));
};
const termsSum = useMemo(() => termsPerc.reduce((a,b)=>a+(+b||0),0), [termsPerc]);


  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
      .format(value || 0)
      .replace('R', 'R ')
      .replace(/,/g, ' '); // Replace commas with spaces for thousands

  // ----- Pagination constants (keep in sync with CSS) -----
  const CM_TO_PX = 37.79527559;
  const PAGE_HEIGHT_CM = 29.7;
  const HEADER_HEIGHT_CM = 7.3;     // .bom-header height
  const FOOTER_HEIGHT_CM = 0.7;     // .bom-footer height
  const CONTENT_TOP_PADDING_CM = 0;
  const COLUMN_HEADER_HEIGHT_CM = 1.25; // .bom-thead-row height
  const ROW_HEIGHT_CM = 0.75;         // .bom-row height
  const CAT_ROW_HEIGHT_CM = 0.75;     // .bom-category-row height

  // Safety margin to avoid print rounding causing overflow
  const SAFETY_CM = 0.02;
  const HEADROOM_CM = 0.40;

  const CONTENT_HEIGHT_PX = (PAGE_HEIGHT_CM - HEADER_HEIGHT_CM - FOOTER_HEIGHT_CM - CONTENT_TOP_PADDING_CM) * CM_TO_PX;
  const ROW_HEIGHT_PX = (ROW_HEIGHT_CM + SAFETY_CM) * CM_TO_PX;
  const CAT_ROW_HEIGHT_PX = (CAT_ROW_HEIGHT_CM + SAFETY_CM) * CM_TO_PX;
  const COL_HEADER_HEIGHT_PX = (COLUMN_HEADER_HEIGHT_CM + SAFETY_CM) * CM_TO_PX;
  const TOTALS_MIN_HEIGHT_CM = 8.0;
  const TOTALS_MIN_HEIGHT_PX = (TOTALS_MIN_HEIGHT_CM + SAFETY_CM) * CM_TO_PX;
  const HEADROOM_PX = HEADROOM_CM * CM_TO_PX;

  const H_TOT_CM = 3.0;
  const H_TERM_CM = 6.4;
  const H_BANK_CM = 4.2;
  const BLOCK_GAP_CM = 0.3;

  const H_TOT_PX = (H_TOT_CM + SAFETY_CM) * CM_TO_PX;
  const H_TERM_PX = (H_TERM_CM + SAFETY_CM) * CM_TO_PX;
  const H_BANK_PX = (H_BANK_CM + SAFETY_CM) * CM_TO_PX;
  const BLOCK_GAP_PX = (BLOCK_GAP_CM) * CM_TO_PX;

  // Flatten BOM data into renderable rows with known heights
  const rows = useMemo(() => {
    const out = [];
    if (Array.isArray(bomData.categories)) {
      // Sort categories: panel, inverter, battery first, then alphabetical
      const priorityOrder = ['panel', 'inverter', 'battery'];
      const sortedCategories = [...bomData.categories].sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        
        const aPriority = priorityOrder.indexOf(aName);
        const bPriority = priorityOrder.indexOf(bName);
        
        // If both are priority categories, sort by priority order
        if (aPriority !== -1 && bPriority !== -1) {
          return aPriority - bPriority;
        }
        // If only one is priority, priority comes first
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;
        
        // Both are non-priority, sort alphabetically
        return aName.localeCompare(bName);
      });
      
      sortedCategories.forEach((category) => {
        out.push({ type: 'category', name: category.name });
        (category.items || []).forEach((item) => {
          out.push({ type: 'item', item });
        });
      });
    }
    return out;
  }, [bomData]);

  // Split rows into pages by accumulating heights
  const pages = useMemo(() => {
    const result = [];
    let current = [];
    let remaining = CONTENT_HEIGHT_PX - COL_HEADER_HEIGHT_PX;

    const pushPage = () => {
      if (current.length) {
        result.push(current);
        current = [];
        remaining = CONTENT_HEIGHT_PX - COL_HEADER_HEIGHT_PX;
      }
    };

    rows.forEach((r) => {
      const h = r.type === 'category' ? CAT_ROW_HEIGHT_PX : ROW_HEIGHT_PX;
      if (h > remaining) pushPage();
      current.push(r);
      remaining -= h;
    });
    if (current.length) result.push(current);

    return result;
  }, [rows, CONTENT_HEIGHT_PX, COL_HEADER_HEIGHT_PX, ROW_HEIGHT_PX, CAT_ROW_HEIGHT_PX]);


  const lastPageRemainingPx = useMemo(() => {
    if (!pages.length) return 0;
    const last = pages[pages.length - 1];
    const usedRowsPx = last.reduce((acc, r) => acc + (r.type === 'category' ? CAT_ROW_HEIGHT_PX : ROW_HEIGHT_PX), 0);
    return CONTENT_HEIGHT_PX - (COL_HEADER_HEIGHT_PX + usedRowsPx);
  }, [pages, CONTENT_HEIGHT_PX, COL_HEADER_HEIGHT_PX, ROW_HEIGHT_PX, CAT_ROW_HEIGHT_PX]);  

  const totalsPlacement = useMemo(() => {
    const blocks = [
        { key: 'totals', h: H_TOT_PX },
        { key: 'termsDeposit', h: H_TERM_PX },
        { key: 'bankingAccept', h: H_BANK_PX },
    ];
    const inlineKeys = [];
    const carryKeys = [];
    let rem = lastPageRemainingPx;

    for (const b of blocks) {
        const need = b.h + (inlineKeys.length ? BLOCK_GAP_PX : 0);
        if (need + HEADROOM_PX <= rem) { inlineKeys.push(b.key); rem -= need; }
        else { carryKeys.push(b.key); }
    }
    return { inlineKeys, carryKeys };
  }, [lastPageRemainingPx, H_TOT_PX, H_TERM_PX, H_BANK_PX, BLOCK_GAP_PX, HEADROOM_PX]);

  const carryPages = useMemo(() => {
    if (!totalsPlacement.carryKeys.length) return [];
    const h = { totals: H_TOT_PX, termsDeposit: H_TERM_PX, bankingAccept: H_BANK_PX };
    const pagesArr = [];
    let page = [];
    let rem = CONTENT_HEIGHT_PX;

    for (const key of totalsPlacement.carryKeys) {
        const need = h[key] + (page.length ? BLOCK_GAP_PX : 0);
        if (need > rem) { pagesArr.push(page); page = []; rem = CONTENT_HEIGHT_PX; }
        page.push(key);
        rem -= need;
    }
    if (page.length) pagesArr.push(page);
    return pagesArr;
  }, [totalsPlacement, CONTENT_HEIGHT_PX, H_TOT_PX, H_TERM_PX, H_BANK_PX, BLOCK_GAP_PX]);

  // Estimate whether totals fit on the last page
  const totalsBlockEstimatedRows = 9; // approx
  const ROWS_PER_PAGE_ESTIMATE = Math.floor((CONTENT_HEIGHT_PX - COL_HEADER_HEIGHT_PX) / ROW_HEIGHT_PX);
  
  const needsTotalsOnNewPage = useMemo(() => {
    if (!pages.length) return true;
    const last = pages[pages.length - 1];

    // sum actual height of last page rows
    const usedRowsPx = last.reduce((acc, r) => 
        acc + (r.type === 'category' ? CAT_ROW_HEIGHT_PX : ROW_HEIGHT_PX), 0);

    // header (col head) + rows already on the page
    const usedPx = COL_HEADER_HEIGHT_PX + usedRowsPx;

    // remaining space on the page
    const remainingPx = CONTENT_HEIGHT_PX - usedPx;

    // if our totals+banking+acceptance block won't fit fully, push to a new page
    return remainingPx < TOTALS_MIN_HEIGHT_PX;
  }, [pages, CONTENT_HEIGHT_PX, COL_HEADER_HEIGHT_PX, ROW_HEIGHT_PX, CAT_ROW_HEIGHT_PX, TOTALS_MIN_HEIGHT_PX]);

  // Build pages: either append a dedicated totals page, or render totals inline on the last page
  // const pagesWithKinds = useMemo(() => {
  //   const base = pages.map(p => ({ kind: 'rows', rows: p }));
  //   if (carryPages.length) {
  //       carryPages.forEach(blocks => base.push({ kind: 'totals', blocks }));
  //   }
  //   return base;
  // }, [pages, carryPages]);
 const pagesWithKinds = useMemo(() => {
   const base = pages.map(p => ({ kind: 'rows', rows: p }));
   // Always include all blocks (totals, terms, banking) regardless of price mode
   const filteredCarry = carryPages
     .map(blocks => blocks.filter(k => k === 'bankingAccept' || k === 'totals' || k === 'termsDeposit'))
     .filter(b => b.length);
   filteredCarry.forEach(blocks => base.push({ kind: 'totals', blocks }));
   return base;
 }, [pages, carryPages]);

  const totalPages = pagesWithKinds.length;

const renderHeader = () => (
    <header className="bom-header">
      <div className="bom-header-top">
        <img className="bom-logo" src={logo} alt="Orka Solar Logo" />
        <div className="bom-company-meta">
          <div>Orka Solar (Pty) Ltd</div>
          <div>Reg No: 2017/141572/07</div>
          <div>VAT No: 463 028 1337</div>
          <div>T: 082 660 0851&nbsp; E: info@orkasolar.co.za&nbsp; W: www.orkasolar.co.za</div>
        </div>
      </div>
      <div className="bom-title">{isQuoteMode ? 'Quotation' : 'Bill of Materials'}</div>
      <div className="bom-info-grid">
        <div>
          <span className="label">For attention:</span> {projectData?.client_name || bomData.project?.client_name || 'Client Name'}
        </div>
        <div>
          <span className="label">Date:</span> {currentDate}
        </div>
        <div>
          <span className="label">Company:</span> {projectData?.company || projectData?.client_name || 'Company Name'}
        </div>
        <div>
          <span className="label">Quote number:</span> {isQuoteMode ? (bomData.project?.quote_number || 'QTE000000') : `QTE${(projectData?.id || bomData.project?.id || '').toString().padStart(8, '0')}`}
        </div>
        <div>
          <span className="label">Address:</span> {projectData?.location || bomData.project?.location || 'Address'}
        </div>
        <div>
          <span className="label">Contact Person:</span> {user?.first_name || 'Lourens'} {user?.last_name || 'de Jongh'}
        </div>
        <div>
          <span className="label">Email:</span> {projectData?.client_email || bomData.project?.client_email || '-'}
        </div>
        <div>
          <span className='label'>Email:</span> {user?.email || 'lourens@orkasolar.co.za'}
        </div>
        <div>
          <span className="label">Tel:</span> {projectData?.client_phone || bomData.project?.client_phone || '-'}
        </div>
        <div>
          <span className="label">Tel:</span> {user?.phone || '082 660 0851'}
        </div>
        <div />
      </div>
      <div className="bom-project-strip">
        {(() => {
          const name =
            projectData?.name ||
            bomData.project?.name ||
            bomData.project?.project_name ||
            'Project Name';
        
          const inverter = projectData?.inverter_brand_model;
          const battery = projectData?.battery_brand_model;
        
          let details = '';
          if (inverter && battery) {
            details = ` - ${inverter} & ${battery}`;
          } else if (inverter) {
            details = ` - ${inverter}`;
          } else if (battery) {
            details = ` - ${battery}`;
          }
        
          return `${name}${details}`;
        })()}
      </div>
    </header>
  );

  const renderFooter = (pageIndex) => (
    <footer className="bom-footer">
      <div className="bom-page-number">Page {pageIndex + 1} of {totalPages}</div>
    </footer>
  );

  const renderTableHead = () => (
    <thead>
      <tr className="bom-thead-row">
        <th className="bom-thead-cell bom-col-desc">Item Description</th>
        <th className="bom-thead-cell bom-col-units">Units</th>
        {priceMode === 'all' && (
          <th className="bom-thead-cell bom-col-unitprice">Price per Unit</th>
        )}
        {priceMode !== 'qty' && (
          <th className="bom-thead-cell bom-col-total">Total</th>
        )}
      </tr>
    </thead>

    // <thead>
    //   <tr className="bom-thead-row">
    //     <th className="bom-thead-cell bom-col-desc">Item Description</th>
    //     <th className="bom-thead-cell bom-col-units">Units</th>
    //     <th className="bom-thead-cell bom-col-unitprice">Price per Unit</th>
    //     <th className="bom-thead-cell bom-col-total">Total</th>
    //   </tr>
    // </thead>
  );

const renderRow = (r, idx) => {
  if (r.type === 'category') {
    const catTotal = categoryTotals[r.name] || 0;

    if (priceMode === 'qty') {
      return (
        <tr className="bom-category-row" key={`cat-${idx}`}>
          <td className="bom-category-cell" colSpan={2}>{r.name}</td>
        </tr>
      );
    }
    // 'all' → [Desc, Units, UnitPrice, Total]  (show total in Total col)
    // 'category' → [Desc, Units, Total]
    const preCols = priceMode === 'all' ? 3 : 2;
    return (
      <tr className="bom-category-row" key={`cat-${idx}`}>
        <td className="bom-category-cell" colSpan={preCols}>{r.name}</td>
        <td className="bom-cell bom-col-total" style={{ textAlign: 'right', fontWeight: 700 }}>
          {formatCurrency(catTotal)}
        </td>
      </tr>
    );
  }

  const { item } = r;
  if (!item || !item.product) {
    return null; // Skip invalid items
  }
  
  const desc = (
    <div className="bom-item-model">
      {item.product.brand || ''} {item.product.model || ''}
    </div>
  );

  if (priceMode === 'qty') {
    return (
      <tr className="bom-row" key={`row-${idx}`}>
        <td className="bom-cell bom-col-desc">{desc}</td>
        <td className="bom-cell bom-col-units" style={{ textAlign: 'center' }}>{item.quantity}</td>
      </tr>
    );
  }

  if (priceMode === 'category') {
    return (
      <tr className="bom-row" key={`row-${idx}`}>
        <td className="bom-cell bom-col-desc">{desc}</td>
        <td className="bom-cell bom-col-units" style={{ textAlign: 'center' }}>{item.quantity}</td>
        <td className="bom-cell bom-col-total"></td>
      </tr>
    );
  }

  // 'all'
  return (
    <tr className="bom-row" key={`row-${idx}`}>
      <td className="bom-cell bom-col-desc">{desc}</td>
      <td className="bom-cell bom-col-units" style={{ textAlign: 'center' }}>{item.quantity}</td>
      <td className="bom-cell bom-col-unitprice">{formatCurrency(item.price)}</td>
      <td className="bom-cell bom-col-total">{formatCurrency(item.price * item.quantity)}</td>
    </tr>
  );
};


  // const renderRow = (r, idx) => {
  //   if (r.type === 'category') {
  //     return (
  //       <tr className="bom-category-row" key={`cat-${idx}`}>
  //         <td className="bom-category-cell" colSpan={4}>{r.name}</td>
  //       </tr>
  //     );
  //   }
  //   const { item } = r;
  //   const spec = (
  //     (item.product.category === 'panel' && item.product.power_w && `${item.product.power_w}W`) ||
  //     (item.product.category === 'inverter' && item.product.rating_kva && `${item.product.rating_kva}kVA`) ||
  //     (item.product.category === 'battery' && item.product.capacity_kwh && `${item.product.capacity_kwh}kWh`) ||
  //     ''
  //   );

  //   return (
  //     <tr className="bom-row" key={`row-${idx}`}>
  //       <td className="bom-cell bom-col-desc">
  //         <div className="bom-item-model">{item.product.brand} {item.product.model}</div>
  //         {/* {spec && <div className="bom-item-spec">{spec}</div>} */}
  //       </td>
  //       <td className="bom-cell bom-col-units" style={{ textAlign: 'center' }}>{item.quantity}</td>
  //       <td className="bom-cell bom-col-unitprice">{formatCurrency(item.price)}</td>
  //       <td className="bom-cell bom-col-total">{formatCurrency(item.price * item.quantity)}</td>
  //     </tr>
  //   );
  // };

    const TotalsBlock = () => {
      const vatPerc = Number(bomData.totals?.vat_perc ?? 0);
    
      return (
        <section className="bom-block bom-block-totals">
          <div className="bom-totals">
            <div className="rule" />
            <div className="row">
              <div className="label">Total (excl. VAT)</div>
              <div className="value">{formatCurrency(bomData.totals?.total_excl_vat || 0)}</div>
            </div>
            <div className="row">
              <div className="label">{vatPerc}% VAT</div>
              <div className="value">{formatCurrency(bomData.totals?.vat_price || 0)}</div>
            </div>
            <div className="rule" />
            <div className="row grand">
              <div className="label">Total (incl. VAT)</div>
              <div className="value">{formatCurrency(bomData.totals?.total_incl_vat || 0)}</div>
            </div>
            <div className="rule double" />
          </div>
        </section>
      );
    };

    // const TermsDepositBlock = () => (
    //   <section className="bom-block bom-block-termsdeposit">
    //     <div className="bom-terms">
    //       <p style={{ margin: '5px 0', fontWeight: 700 }}>
    //         Please note that a 65% deposit will be required before Orka Solar will commence with any work.
    //       </p>
    //     </div>
    //     <table className="bom-table" style={{ marginTop: '6px' }}>
    //       <tbody>
    //         <tr className="bom-row-terms"><td className="bom-cell-terms">Deposit</td><td className="bom-cell-terms bom-col-units">65%</td><td className="bom-cell-terms bom-col-unitprice" colSpan={2} style={{ textAlign: 'right' }}>{formatCurrency((bomData.totals?.total_incl_vat || 0) * 0.65)} </td><td> <span style={{ fontWeight: 400 }}>Incl. VAT</span></td></tr>
    //         <tr className="bom-row-terms"><td className="bom-cell-terms">On delivery of inverters and panels to site</td><td className="bom-cell-terms bom-col-units">25%</td><td className="bom-cell-terms bom-col-unitprice" colSpan={2} style={{ textAlign: 'right' }}>{formatCurrency((bomData.totals?.total_incl_vat || 0) * 0.25)} </td><td>  <span style={{ fontWeight: 400 }}>Incl. VAT</span></td></tr>
    //         <tr className="bom-row-terms"><td className="bom-cell-terms">On project completion</td><td className="bom-cell-terms bom-col-units">10%</td><td className="bom-cell-terms bom-col-unitprice" colSpan={2} style={{ textAlign: 'right' }}>{formatCurrency((bomData.totals?.total_incl_vat || 0) * 0.10)} </td><td> <span style={{ fontWeight: 400 }}>Incl. VAT</span></td></tr>
    //         {/* <tr className="bom-row"><td className="bom-cell" colSpan={4} style={{ borderBottom: '1px solid #000' }}></td></tr> */}
    //         <tr className="bom-row-terms"><td className="bom-cell-terms" colSpan={2}></td><td className="bom-cell-terms" colSpan={2} style={{ textAlign: 'right', fontWeight: 700, borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>{formatCurrency((bomData.totals?.total_incl_vat || 0))}</td></tr>
    //       </tbody>
    //     </table>
    //   </section>
    // );

const TermsDepositBlock = () => {
  const totalIncl = (bomData.totals?.total_incl_vat || 0);
  const [p0, p1, p2] = termsPerc.map(n => +n || 0);
  const amt = (p) => formatCurrency(totalIncl * (p / 100));

  return (
    <section className="bom-block bom-block-termsdeposit">
      <div className="bom-terms">
        <p style={{ margin: '5px 0', fontWeight: 700 }}>
          Please note that a {p0}% deposit will be required before Orka Solar will commence with any work.
        </p>
      </div>

      <table className="bom-table bom-terms-table" style={{ marginTop: '6px' }}>
        <colgroup>
          <col className="col-desc" />
          <col className="col-perc" />
          <col className="col-flex" />
          <col className="col-amount" />
          <col className="col-incl" />
        </colgroup>
        <tbody>
          <tr className="bom-row-terms">
            <td className="bom-cell-terms">Deposit</td>
            <td className="bom-cell-terms">{p0}%</td>
            <td className="bom-cell-terms"></td>
            <td className="bom-cell-terms amount">{amt(p0)}</td>
            <td className="bom-cell-terms incl"><span>Incl. VAT</span></td>
          </tr>

          <tr className="bom-row-terms">
            <td className="bom-cell-terms">On delivery of inverters and panels to site</td>
            <td className="bom-cell-terms">{p1}%</td>
            <td className="bom-cell-terms"></td>
            <td className="bom-cell-terms amount">{amt(p1)}</td>
            <td className="bom-cell-terms incl"><span>Incl. VAT</span></td>
          </tr>

          <tr className="bom-row-terms">
            <td className="bom-cell-terms">On project completion</td>
            <td className="bom-cell-terms">{p2}%</td>
            <td className="bom-cell-terms"></td>
            <td className="bom-cell-terms amount">{amt(p2)}</td>
            <td className="bom-cell-terms incl"><span>Incl. VAT</span></td>
          </tr>

          <tr className="bom-row-terms grand">
            <td className="bom-cell-terms" colSpan={3}></td>
            <td className="bom-cell-terms amount total-amount">
              {formatCurrency(totalIncl)}
            </td>
            <td className="bom-cell-terms incl"><span>Incl. VAT</span></td>
          </tr>
        </tbody>
      </table>
    </section>
  );
};


    const BankingAcceptanceBlock = () => (
      <section className="bom-block bom-block-bankingaccept">
        <div className="bom-two-col">
          <div className="bom-box" style={{ fontSize: '12px' }}>
            <div style={{ fontWeight: 700, borderBottom: '1px solid #000', paddingBottom: 4, marginBottom: 4 }}>Banking details:</div>
            <div>Company: Orka Solar (Pty) Ltd.</div>
            <div>Branch: ABSA Mooirivier Mall</div>
            <div>Account name: Orka Solar (PTY) Ltd</div>
            <div>Account type: Cheque</div>
            <div>Account number: 409 240 5135</div>
          </div>
          <div className="bom-box" style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
            {/* <div className="bom-signature">Client acceptance: signature & date</div> */}
            <div style={{ fontWeight: 700, borderBottom: '1px solid #000', paddingBottom: 4, marginBottom: 4}}>Client acceptance: </div>
            <div style={{
              marginTop: 'auto',
              textAlign: 'center',
              paddingBottom: '0px',
              fontStyle: 'italic',
            }}>
              signature and date
            </div>
          </div>
        </div>
      </section>
    );

  // Show loading state for quotes
  if (isQuoteMode && quoteLoading) {
    return (
      <div className="container mt-5 text-center">
        <Spinner animation="border" />
        <p>Loading quote data...</p>
      </div>
    );
  }

  // If no BOM data exists for this project, show a message
  if (!bomData || !bomData.project || !bomData.categories || bomData.categories.length === 0) {
    if (isQuoteMode && !quoteLoading) {
      return (
        <div className="container mt-5 text-center">
          <Alert variant="warning">
            <h4>Quote Data Not Available</h4>
            <p>Unable to load quote data. Please try refreshing the page or contact support.</p>
          </Alert>
        </div>
      );
    }
    
    if (!isQuoteMode) {
      return (
        <div className="container mt-5 text-center">
          <div className="alert alert-info">
            <h4>No Print Data Available</h4>
            <p>Please go to the <strong>Bill of Materials</strong> tab and click <strong>"Generate Quote"</strong> to create a printable quote for this project.</p>
          </div>
        </div>
      );
    }
    
    // Still loading in quote mode
    return (
      <div className="container mt-5 text-center">
        <Spinner animation="border" />
        <p>Loading quote data...</p>
      </div>
    );
  }

  return (
    <div className="bom-report" style={{ position: 'relative' }}>
      {/* Left Side Controls */}
      <div className="no-print" style={{
        position: 'fixed',
        left: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Navigation and Print */}
        {!propProjectId && (
          <Button 
            variant="outline-secondary" 
            size="sm" 
            onClick={handleBack}
            style={{ 
              color: '#495057', 
              borderColor: '#6c757d',
              backgroundColor: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              border: '1px solid #dee2e6'
            }}
            title="Back to Project Dashboard"
          >
            <i className="bi bi-arrow-left"></i>
          </Button>
        )}
        <Button 
          variant="primary" 
          size="sm" 
          onClick={() => window.print()}
          style={{ 
            backgroundColor: '#0d6efd', 
            borderColor: '#0d6efd',
            color: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
          title="Print Document"
        >
          <i className="bi bi-printer"></i>
        </Button>
        
        {/* Price Mode Selector */}
        <div style={{ 
          backgroundColor: 'white',
          padding: '8px',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          border: '1px solid #dee2e6'
        }}>
          <Form.Select
            size="sm"
            style={{ width: '180px', fontSize: '0.75rem' }}
            value={priceMode}
            onChange={(e) => setPriceMode(e.target.value)}
            aria-label="Price visibility"
          >
            <option value="all">Show all prices</option>
            <option value="category">Category prices</option>
            <option value="qty">Qty only</option>
          </Form.Select>
        </div>
      </div>

      {/* Right Side Controls */}
      <div className="no-print" style={{
        position: 'fixed',
        right: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Quote Actions */}
        {isQuoteMode && quoteData && (
          <>
            {/* Status Badge */}
            <div style={{ 
              backgroundColor: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              border: '1px solid #dee2e6',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#6c757d', marginBottom: '4px' }}>Status</div>
              <Badge bg={quoteData.quote.status === 'sent' ? 'success' : quoteData.quote.status === 'accepted' ? 'primary' : quoteData.quote.status === 'declined' ? 'danger' : 'secondary'}>
                {quoteData.quote.status || 'draft'}
              </Badge>
            </div>
            
            {/* Action Buttons */}
            {(quoteData.quote.status !== 'sent' && quoteData.quote.status !== 'accepted' && quoteData.quote.status !== 'declined') && (
              <Button 
                variant="success" 
                size="sm" 
                onClick={handleSendQuote}
                disabled={actionLoading}
                style={{ 
                  backgroundColor: actionLoading ? '#6c757d' : '#198754', 
                  borderColor: actionLoading ? '#6c757d' : '#198754',
                  color: 'white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  opacity: actionLoading ? 0.8 : 1
                }}
                title={actionLoading ? "Sending quote..." : "Send Quote to Client"}
              >
                {actionLoading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-1" />
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send me-1"></i>Send
                  </>
                )}
              </Button>
            )}
            
            {quoteData.quote.status === 'sent' && (
              <>
                <Button 
                  variant="success" 
                  size="sm" 
                  disabled
                  style={{ 
                    backgroundColor: '#6c757d', 
                    borderColor: '#6c757d',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    opacity: 0.8
                  }}
                  title="Quote has been sent"
                >
                  <i className="bi bi-check2 me-1"></i>Sent
                </Button>
                
                <Button 
                  variant="success" 
                  size="sm" 
                  onClick={handleAcceptQuote}
                  disabled={actionLoading}
                  style={{ 
                    backgroundColor: '#198754', 
                    borderColor: '#198754',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
                  title="Accept Quote"
                >
                  <i className="bi bi-check-circle me-1"></i>Accept
                </Button>
                <Button 
                  variant="outline-danger" 
                  size="sm" 
                  onClick={handleDeclineQuote}
                  disabled={actionLoading}
                  style={{ 
                    color: '#dc3545', 
                    borderColor: '#dc3545',
                    backgroundColor: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
                  title="Decline Quote"
                >
                  <i className="bi bi-x-circle me-1"></i>Decline
                </Button>
              </>
            )}
            
            <Button 
              variant="outline-secondary" 
              size="sm" 
              onClick={handleEditInBOM}
              disabled={actionLoading}
              style={{ 
                color: '#495057', 
                borderColor: '#6c757d',
                backgroundColor: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
              title="Edit in BOM"
            >
              <i className="bi bi-pencil me-1"></i>Edit
            </Button>
          </>
        )}
        
        {/* Payment Terms Controls */}
        <div style={{ 
          backgroundColor: 'white',
          padding: '12px',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          border: '1px solid #dee2e6',
          maxWidth: '200px'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#6c757d', fontWeight: '600', marginBottom: '8px', textAlign: 'center' }}>
            Payment Terms
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.7rem', color: '#6c757d', margin: 0, minWidth: '50px' }}>Deposit</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <Form.Control
                  type="number"
                  size="sm"
                  min="0"
                  max="100"
                  step="1"
                  style={{ width: '50px', fontSize: '0.7rem' }}
                  value={termsPerc[0]}
                  onChange={e => handleTermsChange(0, e.target.value)}
                />
                <span style={{ fontSize: '0.7rem', color: '#6c757d' }}>%</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.7rem', color: '#6c757d', margin: 0, minWidth: '50px' }}>Delivery</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <Form.Control
                  type="number"
                  size="sm"
                  min="0"
                  max="100"
                  step="1"
                  style={{ width: '50px', fontSize: '0.7rem' }}
                  value={termsPerc[1]}
                  onChange={e => handleTermsChange(1, e.target.value)}
                />
                <span style={{ fontSize: '0.7rem', color: '#6c757d' }}>%</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.7rem', color: '#6c757d', margin: 0, minWidth: '50px' }}>Complete</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <Form.Control
                  type="number"
                  size="sm"
                  min="0"
                  max="100"
                  step="1"
                  style={{ width: '50px', fontSize: '0.7rem' }}
                  value={termsPerc[2]}
                  onChange={e => handleTermsChange(2, e.target.value)}
                />
                <span style={{ fontSize: '0.7rem', color: '#6c757d' }}>%</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
              <Badge bg={termsSum === 100 ? 'success' : 'warning'} style={{ fontSize: '0.65rem' }}>
                Sum: {termsSum}%
              </Badge>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setTermsPerc([65, 25, 10])}
                title="Reset to default: 65% / 25% / 10%"
                style={{ 
                  fontSize: '0.65rem', 
                  padding: '2px 6px',
                  color: '#495057', 
                  borderColor: '#6c757d',
                  backgroundColor: 'transparent'
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="bom-printarea">
        {pagesWithKinds.map((pg, pageIndex) => (
          <section className="bom-page" key={pageIndex}>
            {renderHeader()}
            <div className="bom-content">
              {pg.kind === 'rows' && (
                <table className="bom-table">
                  {renderTableHead()}
                  <tbody>
                    {pg.rows.map((r, i) => renderRow(r, i))}
                  </tbody>
                </table>
              )}
              {/* Inline blocks on the last rows page */}
              {pg.kind === 'rows' && pageIndex === (pages.length - 1) && (
                <>
                  {totalsPlacement.inlineKeys.includes('totals') && <TotalsBlock />}
                  {totalsPlacement.inlineKeys.includes('termsDeposit') && <TermsDepositBlock />}
                  {totalsPlacement.inlineKeys.includes('bankingAccept') && <BankingAcceptanceBlock />}
                </>
              )}

              {/* Dedicated totals page for any carried blocks */}
              {pg.kind === 'totals' && (
                <>
                  {pg.blocks.includes('totals') && <TotalsBlock />}
                  {pg.blocks.includes('termsDeposit') && <TermsDepositBlock />}
                  {pg.blocks.includes('bankingAccept') && <BankingAcceptanceBlock />}
                </>
              )}
            </div>
            {/* {renderFooter(pageIndex)} */}
          </section>
        ))}
      </main>
    </div>
  );
}

export default PrintableBOM;
