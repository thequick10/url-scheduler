let results = [];
let userRole = '';
let fp; // flatpickr instance

// Function to convert UTC to IST
function toIST(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

async function loadResults() {
  try {
    const res = await fetch('/api/scheduled-results', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch results');
    results = await res.json();
    renderTable();
  } catch (error) {
    console.error('Error loading results:', error);
    document.getElementById('tableBody').innerHTML = `<tr><td colspan="${userRole === 'Admin' ? '9' : '8'}">Error loading results.</td></tr>`;
  }
}

function renderTable() {
  const tableBody = document.getElementById('tableBody');
  const filteredResults = filterAndSortResults();

  tableBody.innerHTML = filteredResults.map(result => `
    <tr data-result-id="${result.id}">
      <td class="admin-only">${result.username}</td>
      <td>${toIST(result.resolved_at)}</td>
      <td>${result.original_url}</td>
      <td>${result.final_url === 'Loading...' ? '<span class="status-badge status-loading"><span class="loading-spinner"></span>Loading...</span>' : (result.final_url || 'N/A')}</td>
      <td>
        <select class="country-input" data-result-id="${result.id}">
          <option value="US" ${result.country === 'US' ? 'selected' : ''}>🇺🇸 US</option>
          <option value="CA" ${result.country === 'CA' ? 'selected' : ''}>🇨🇦 CA</option>
          <option value="GB" ${result.country === 'GB' ? 'selected' : ''}>🇬🇧 GB</option>
          <option value="IN" ${result.country === 'IN' ? 'selected' : ''}>🇮🇳 IN</option>
          <option value="AU" ${result.country === 'AU' ? 'selected' : ''}>🇦🇺 AU</option>
          <option value="DE" ${result.country === 'DE' ? 'selected' : ''}>🇩🇪 DE</option>
          <option value="FR" ${result.country === 'FR' ? 'selected' : ''}>🇫🇷 FR</option>
          <option value="JP" ${result.country === 'JP' ? 'selected' : ''}>🇯🇵 JP</option>
          <option value="SG" ${result.country === 'SG' ? 'selected' : ''}>🇸🇬 SG</option>
          <option value="BR" ${result.country === 'BR' ? 'selected' : ''}>🇧🇷 BR</option>
          <option value="TW" ${result.country === 'TW' ? 'selected' : ''}>🇹🇼 TW</option>
          <option value="CZ" ${result.country === 'CZ' ? 'selected' : ''}>🇨🇿 CZ</option>
          <option value="UA" ${result.country === 'UA' ? 'selected' : ''}>🇺🇦 UA</option>
          <option value="AE" ${result.country === 'AE' ? 'selected' : ''}>🇦🇪 AE</option>
          <option value="PL" ${result.country === 'PL' ? 'selected' : ''}>🇵🇱 PL</option>
          <option value="ES" ${result.country === 'ES' ? 'selected' : ''}>🇪🇸 ES</option>
          <option value="ID" ${result.country === 'ID' ? 'selected' : ''}>🇮🇩 ID</option>
          <option value="ZA" ${result.country === 'ZA' ? 'selected' : ''}>🇿🇦 ZA</option>
          <option value="MX" ${result.country === 'MX' ? 'selected' : ''}>🇲🇽 MX</option>
          <option value="MY" ${result.country === 'MY' ? 'selected' : ''}>🇲🇾 MY</option>
          <option value="IT" ${result.country === 'IT' ? 'selected' : ''}>🇮🇹 IT</option>
          <option value="TH" ${result.country === 'TH' ? 'selected' : ''}>🇹🇭 TH</option>
          <option value="NL" ${result.country === 'NL' ? 'selected' : ''}>🇳🇱 NL</option>
          <option value="AR" ${result.country === 'AR' ? 'selected' : ''}>🇦🇷 AR</option>
          <option value="BY" ${result.country === 'BY' ? 'selected' : ''}>🇧🇾 BY</option>
          <option value="RU" ${result.country === 'RU' ? 'selected' : ''}>🇷🇺 RU</option>
          <option value="IE" ${result.country === 'IE' ? 'selected' : ''}>🇮🇪 IE</option>
          <option value="HK" ${result.country === 'HK' ? 'selected' : ''}>🇭🇰 HK</option>
          <option value="KZ" ${result.country === 'KZ' ? 'selected' : ''}>🇰🇿 KZ</option>
          <option value="NZ" ${result.country === 'NZ' ? 'selected' : ''}>🇳🇿 NZ</option>
          <option value="TR" ${result.country === 'TR' ? 'selected' : ''}>🇹🇷 TR</option>
          <option value="DK" ${result.country === 'DK' ? 'selected' : ''}>🇩🇰 DK</option>
          <option value="GR" ${result.country === 'GR' ? 'selected' : ''}>🇬🇷 GR</option>
          <option value="NO" ${result.country === 'NO' ? 'selected' : ''}>🇳🇴 NO</option>
          <option value="AT" ${result.country === 'AT' ? 'selected' : ''}>🇦🇹 AT</option>
          <option value="IS" ${result.country === 'IS' ? 'selected' : ''}>🇮🇸 IS</option>
          <option value="SE" ${result.country === 'SE' ? 'selected' : ''}>🇸🇪 SE</option>
          <option value="PT" ${result.country === 'PT' ? 'selected' : ''}>🇵🇹 PT</option>
          <option value="CH" ${result.country === 'CH' ? 'selected' : ''}>🇨🇭 CH</option>
          <option value="BE" ${result.country === 'BE' ? 'selected' : ''}>🇧🇪 BE</option>
          <option value="PH" ${result.country === 'PH' ? 'selected' : ''}>🇵🇭 PH</option>
          <option value="IL" ${result.country === 'IL' ? 'selected' : ''}>🇮🇱 IL</option>
          <option value="MD" ${result.country === 'MD' ? 'selected' : ''}>🇲🇩 MD</option>
          <option value="RO" ${result.country === 'RO' ? 'selected' : ''}>🇷🇴 RO</option>
          <option value="CL" ${result.country === 'CL' ? 'selected' : ''}>🇨🇱 CL</option>
          <option value="SA" ${result.country === 'SA' ? 'selected' : ''}>🇸🇦 SA</option>
          <option value="LI" ${result.country === 'LI' ? 'selected' : ''}>🇱🇮 LI</option>
          <option value="FI" ${result.country === 'FI' ? 'selected' : ''}>🇫🇮 FI</option>
          <!-- Add all other countries as needed -->
        </select>
      </td>
      <td>${result.notes || ''}</td>
      <td>${result.uaType || 'N/A'}</td>
      <td><span class="status status-${result.status}">${result.status}</span></td>
      <td>
        <button class="btn-secondary refresh-button" data-result-id="${result.id}">Refresh</button>
      </td>
    </tr>
  `).join('');
}

function filterAndSortResults() {
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortDate');

  let filtered = [...results];
  const selectedDates = fp.selectedDates;

  // Date range filter
  if (selectedDates.length === 2) {
    const [start, end] = selectedDates;
    end.setHours(23, 59, 59, 999); // Make sure the end date is inclusive
    filtered = filtered.filter(r => {
      const resolvedDate = new Date(r.resolved_at);
      return resolvedDate >= start && resolvedDate <= end;
    });
  }

  // Search filter
  const searchTerm = searchInput.value.toLowerCase();
  if (searchTerm) {
    filtered = filtered.filter(r => 
      Object.values(r).some(val => 
        String(val).toLowerCase().includes(searchTerm)
      )
    );
  }

  // Sort
  const sortOrder = sortSelect.value;
  filtered.sort((a, b) => {
    const dateA = new Date(a.resolved_at);
    const dateB = new Date(b.resolved_at);
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  return filtered;
}

async function refreshResult(resultId) {
  const result = results.find(r => r.id === Number(resultId));
  if (!result) return;

  const originalFinalUrl = result.final_url;
  result.final_url = 'Loading...';
  renderTable();

  try {
    const finalUrl = await resolveFinalUrl(result.original_url, result.country, result.uaType);
    if (finalUrl && finalUrl !== 'Error resolving') {
      result.final_url = finalUrl;
      result.resolved_at = new Date().toISOString();
      result.status = 'resolved';

      // Update result in the database
      await fetch(`/api/scheduled-results/${resultId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ finalUrl: result.final_url, status: result.status })
      });

    } else {
      throw new Error('Resolution failed');
    }
  } catch (error) {
    console.error('Refresh failed:', error);
    result.final_url = originalFinalUrl; // Restore original
    result.status = 'failed';
  }

  renderTable();
}

async function resolveFinalUrl(inputUrl, region = "US", uaType = "random") {
    const fallback = "Error resolving";
    try {
      const params = new URLSearchParams({
        url: inputUrl,
        region: region || 'US',
        uaType: uaType || 'random'
      });
      const requestUrl = `/resolve?${params.toString()}`;
      const response = await fetch(requestUrl, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const data = await response.json();
      return data.finalUrl || fallback;
      
    } catch (err) {
      console.error("Error resolving URL:", err.message);
      return fallback;
    }
}

function exportCSV() {
  const filteredResults = filterAndSortResults(); // Use filtered and sorted data

  const headers = ["Resolved At (IST)", "Original URL", "Final URL", "Country", "Notes", "UA Type", "Status"];
  if (userRole === 'Admin') {
    headers.unshift("Scheduled Job by");
  }

  let csv = headers.join(',') + '\n';

  filteredResults.forEach((r) => {
    const row = [
      toIST(r.resolved_at),
      r.original_url,
      r.final_url || '',
      r.country || '',
      r.notes || '',
      r.uaType || '',
      r.status
    ];
    if (userRole === 'Admin') {
      row.unshift(r.username);
    }
    csv += row.map(val => `"${val}"`).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `scheduled-results-${timestamp}.csv`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportXLSX() {
  const filteredResults = filterAndSortResults(); // Use filtered and sorted data

  const dataForSheet = filteredResults.map(r => {
    const row = {};
    if (userRole === 'Admin') {
      row["Scheduled Job by"] = r.username;
    }
    row["Resolved At (IST)"] = toIST(r.resolved_at);
    row["Original URL"] = r.original_url;
    row["Final URL"] = r.final_url || '';
    row["Country"] = r.country || '';
    row["Notes"] = r.notes || '';
    row["UA Type"] = r.uaType || '';
    row["Status"] = r.status;
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Scheduled Results");

  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });

  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `scheduled-results-${timestamp}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', async () => {
  const searchInput = document.getElementById('searchInput');
  const dateRangePicker = document.getElementById('dateRange');
  const sortSelect = document.getElementById('sortDate');
  const exportButton = document.getElementById('exportButton');
  const clearDateFilterButton = document.querySelector('.clear-date-btn');
  const tableBody = document.getElementById('tableBody');

  try {
    const res = await fetch('/api/auth/me');
    const { user } = await res.json();
    userRole = user.role;
    if (userRole === 'Admin') {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'table-cell');
    }
  } catch (e) {
    console.error('Could not fetch user role', e);
  }

  // Delete Eventlistner
  const deleteAllButton = document.getElementById('deleteAllButton');
  deleteAllButton.addEventListener('click', deleteAllResults);

  // Event Listeners
  searchInput.addEventListener('keyup', renderTable);
  sortSelect.addEventListener('change', renderTable);
  exportButton.addEventListener('click', handleExport);
  clearDateFilterButton.addEventListener('click', clearDateFilter);

  // Flatpickr for date range
  fp = flatpickr(dateRangePicker, {
    mode: "range",
    dateFormat: "Y-m-d",
    onChange: function(selectedDates) {
      renderTable();
    }
  });

  // Event delegation for dynamically added elements
  tableBody.addEventListener('click', (event) => {
    if (event.target.classList.contains('refresh-button')) {
      const resultId = event.target.dataset.resultId;
      refreshResult(resultId);
    }
  });

  tableBody.addEventListener('change', (event) => {
    if (event.target.classList.contains('country-input')) {
      const resultId = event.target.dataset.resultId;
      const newCountry = event.target.value;
      updateCountry(resultId, newCountry);
    }
  });

  async function deleteAllResults() {
    const confirmed = confirm("Are you sure you want to delete ALL scheduled results? This action cannot be undone.");
    if (!confirmed) return;
  
    try {
      const response = await fetch('/api/scheduled-results/all', {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });
  
      if (!response.ok) {
        throw new Error('Failed to delete all scheduled results');
      }
  
      const result = await response.json();
      alert(result.message || 'All results deleted.');
  
      results = [];
      renderTable();
    } catch (error) {
      console.error('Error deleting all results:', error);
      alert('Error deleting all results.');
    }
  }  

  // Initial load
  loadResults();
});

function updateCountry(resultId, newCountry) {
  const result = results.find(r => r.id === resultId);
  if (result) {
    result.country = newCountry;
    refreshResult(resultId);
  }
}

function handleExport() {
  const exportFormat = document.getElementById('exportFormat').value;
  if (exportFormat === 'csv') {
    exportCSV();
  } else if (exportFormat === 'xlsx') {
    exportXLSX();
  }
}

function clearDateFilter() {
  fp.clear();
  renderTable();
}