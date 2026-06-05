const socket = io();

// UI Elements
const deviceCountEl = document.getElementById('device-count');
const campaignForm = document.getElementById('campaignForm');
const startBtn = document.getElementById('startBtn');
const resultMessage = document.getElementById('resultMessage');
const imageUpload = document.getElementById('imageUpload');
const imageName = document.getElementById('imageName');
const excelUpload = document.getElementById('excelUpload');
const excelName = document.getElementById('excelName');

// File input UI update
imageUpload.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    imageName.textContent = e.target.files[0].name;
    imageName.style.color = 'var(--text-primary)';
  } else {
    imageName.textContent = 'Drag & drop an image or click to browse';
    imageName.style.color = 'var(--text-secondary)';
  }
});

excelUpload.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    excelName.textContent = e.target.files[0].name;
    excelName.style.color = 'var(--text-primary)';
  } else {
    excelName.textContent = 'Upload target numbers sheet *';
    excelName.style.color = 'var(--accent-color)';
  }
});

// Listen for device count updates
socket.on('device_count_update', (count) => {
  deviceCountEl.textContent = count;
});

// Handle form submission
campaignForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  startBtn.disabled = true;
  startBtn.textContent = 'Dispatching Campaign...';
  resultMessage.innerHTML = '';

  const formData = new FormData(campaignForm);

  try {
    const response = await fetch('/api/campaign', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (response.ok) {
      resultMessage.innerHTML = `<div class="alert alert-success" style="animation: fadeIn 0.5s ease-out;">
        <strong style="display:block; margin-bottom: 5px;">🚀 Campaign successfully launched!</strong>
        Total Contacts Processed: ${result.data.totalContacts}<br>
        Fleet Devices Activated: ${result.data.devicesUsed}
      </div>`;
      campaignForm.reset();
      imageName.textContent = 'Drag & drop an image or click to browse';
      imageName.style.color = 'var(--text-secondary)';
      excelName.textContent = 'Upload target numbers sheet *';
      excelName.style.color = 'var(--accent-color)';
    } else {
      resultMessage.innerHTML = `<div class="alert alert-danger" style="animation: fadeIn 0.5s ease-out;">
        <strong>Error:</strong> ${result.error || 'Failed to dispatch campaign.'}
      </div>`;
    }
  } catch (err) {
    resultMessage.innerHTML = `<div class="alert alert-danger" style="animation: fadeIn 0.5s ease-out;">
        <strong>Error:</strong> Unable to connect to the fleet server.
      </div>`;
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = 'Dispatch Campaign Now';
  }
});
