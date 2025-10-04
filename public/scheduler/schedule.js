document.addEventListener('DOMContentLoaded', async () => {
  const scheduleForm = document.getElementById('schedule-form');
  const jobsTableBody = document.getElementById('jobs-table-body');

  let userRole = '';
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

  // Function to convert UTC to IST
  function toIST(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  }

  // Fetch and display scheduled jobs
  async function loadJobs() {
    try {
      const res = await fetch('/api/schedules', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const jobs = await res.json();
      console.log('Jobs data:', jobs);
      
      if (!Array.isArray(jobs) || jobs.length === 0) {
        jobsTableBody.innerHTML = `<tr>
          <td colspan="${userRole === 'Admin' ? '7' : '6'}" style="text-align:center; padding:16px; color:#666;">
            No scheduled jobs yet.
          </td>
        </tr>`;
        return;
      }
      
      jobsTableBody.innerHTML = jobs.map(job => `
        <tr>
          <td>${job.id}</td>
          <td class="admin-only">${job.username}</td>
          <td>${job.file_name}</td>
          <td><span class="status status-${job.status}">${job.status}</span></td>
          <td>${toIST(job.scheduled_at)}</td>
          <td>${toIST(job.created_at)}</td>
          <td><button class="btn-danger delete-job-button" data-job-id="${job.id}">🗑</button></td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Error loading jobs:', error);
      jobsTableBody.innerHTML = `<tr><td colspan="${userRole === 'Admin' ? '7' : '6'}">Error loading jobs.</td></tr>`;
    }
  }

  // Handle form submission
  scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('file-input');
    const datetimeInput = document.getElementById('datetime-input');
    const file = fileInput.files[0];
    const scheduledAt = datetimeInput.value;

    if (!file || !scheduledAt) {
      alert('Please select a file and a schedule time.');
      return;
    }

    const formData = new FormData();
    formData.append('scheduleFile', file);
    formData.append('scheduledAt', new Date(scheduledAt).toISOString());

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        cache: 'no-store',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to schedule job');
      }

      alert('Job scheduled successfully!');
      location.href = '/scheduler/schedule.html'; // Use PRG pattern to prevent re-submission on refresh
    } catch (error) {
      console.error('Error scheduling job:', error);
      alert(`Error: ${error.message}`);
    }
  });

  // Event delegation for delete buttons
  jobsTableBody.addEventListener('click', (event) => {
    if (event.target.classList.contains('delete-job-button')) {
      const jobId = event.target.dataset.jobId;
      deleteJob(jobId);
    }
  });

  async function deleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch(`/api/schedules/${jobId}`, {
        method: 'DELETE',
        cache: 'no-store'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete job');
      }
      alert('Job deleted successfully!');
      loadJobs(); // Reload the table
    } catch (error) {
      console.error('Error deleting job:', error);
      alert(`Error: ${error.message}`);
    }
  }

  // Initial load
  loadJobs();
});