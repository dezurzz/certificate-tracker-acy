document.addEventListener('DOMContentLoaded', async () => {
  // Exclude index.html (login page) and empty paths from checks
  const page = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1);
  if (page !== 'index.html' && page !== '') {
    await checkUserSession();
  }

  injectSidebar();
  injectHeader();
  setupInteractions();
  await updateHeaderProfile();
  await updateNotifications();
});

function injectSidebar() {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (!sidebarContainer) return;

  const currentPath = window.location.pathname;
  const page = currentPath.substring(currentPath.lastIndexOf('/') + 1);

  const menuItems = [
    { name: 'Dashboard', icon: 'dashboard', href: 'dashboard.html', active: page === 'dashboard.html' },
    { name: 'Training List', icon: 'school', href: 'trainings.html', active: page === 'trainings.html' || page === 'training-detail.html' },
    { name: 'Certificate Monitoring', icon: 'verified', href: 'certificates.html', active: page === 'certificates.html' },
    { name: 'History Logs', icon: 'history', href: 'history-logs.html', active: page === 'history-logs.html' },
    { name: 'Reports', icon: 'assessment', href: 'reports.html', active: page === 'reports.html' }
  ];

  const isSettingsActive = ['settings-profile.html', 'settings-notifications.html', 'settings-security.html', 'settings-system.html'].includes(page);

  const sidebarHtml = `
    <nav class="bg-[#131B2E] text-slate-300 w-60 h-screen fixed left-0 top-0 border-r border-slate-800 flex flex-col justify-between p-4 z-50">
      <div class="flex flex-col gap-6">
        <!-- Brand Header -->
        <a class="flex items-center gap-3 px-2 py-1 cursor-pointer group" href="dashboard.html">
          <div class="w-10 h-10 rounded bg-blue-600 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform">
            <span class="material-symbols-outlined text-white text-2xl fill">school</span>
          </div>
          <div>
            <h1 class="font-bold text-white text-md tracking-tight leading-tight">BKI Academy</h1>
            <p class="text-xs text-slate-400">Management System</p>
          </div>
        </a>

        <!-- Navigation Links -->
        <ul class="flex flex-col gap-1 w-full">
          ${menuItems.map(item => `
            <li>
              <a class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 active:scale-95 ${item.active
      ? 'bg-blue-600 text-white font-semibold shadow-md'
      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }" href="${item.href}">
                <span class="material-symbols-outlined text-lg ${item.active ? 'fill' : ''}">${item.icon}</span>
                <span class="text-sm">${item.name}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>

      <!-- Bottom Profile & Settings Section -->
      <div class="flex flex-col gap-3">
        <div class="pt-4 border-t border-slate-800">
          <a class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${isSettingsActive
      ? 'bg-blue-600 text-white font-semibold shadow-md'
      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }" href="settings-profile.html">
            <span class="material-symbols-outlined text-lg ${isSettingsActive ? 'fill' : ''}">settings</span>
            <span class="text-sm">Settings</span>
          </a>
        </div>
        
        <!-- Administrator Card -->
        <div class="p-3 bg-slate-800/50 rounded-lg border border-slate-800 flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-slate-500 shrink-0">
            <span class="material-symbols-outlined text-base">person</span>
          </div>
          <div class="overflow-hidden">
            <p id="sidebar-user-name" class="text-xs font-semibold text-white truncate">Admin</p>
            <p class="text-[9px] font-semibold text-slate-500 uppercase tracking-wider truncate">System Admin</p>
          </div>
        </div>
      </div>
    </nav>
  `;

  sidebarContainer.outerHTML = sidebarHtml;
}

function injectHeader() {
  const headerContainer = document.getElementById('header-container');
  if (!headerContainer) return;

  const headerHtml = `
    <header class="bg-white border-b border-slate-200 flex justify-end items-center h-16 px-6 sticky top-0 z-40 animate-in fade-in slide-in-from-top-1 duration-150">
      <!-- Actions -->
      <div class="flex items-center gap-4">
        <!-- Notification button -->
        <div class="relative" id="notifications-container">
          <button id="notifications-btn" class="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors relative">
            <span class="material-symbols-outlined text-[20px]">notifications</span>
            <!-- Red dot indicator -->
            <span id="notif-dot" class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
          </button>
          
          <!-- Dropdown content -->
          <div id="notifications-menu" class="hidden absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 text-left">
            <div class="px-4 py-2 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <span class="font-bold text-xs text-slate-700">Notifications</span>
              <button onclick="clearNotifDot()" class="text-[10px] font-semibold text-blue-600 hover:underline">Mark all read</button>
            </div>
            <div id="notifications-list" class="divide-y divide-slate-100 max-h-60 overflow-y-auto table-scroll">
              <!-- Dynamically populated -->
            </div>
          </div>
        </div>

        <!-- Help button -->
        <button id="help-btn" onclick="openHelpModal()" class="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors">
          <span class="material-symbols-outlined text-[20px]">help_outline</span>
        </button>

        <div class="w-px h-6 bg-slate-200"></div>

        <!-- Profile Dropdown Button -->
        <div class="relative" id="profile-dropdown-container">
          <button id="profile-dropdown-btn" class="flex items-center gap-2 hover:bg-slate-50 p-1 rounded-full transition-colors">
            <div class="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-400 shrink-0">
              <span class="material-symbols-outlined text-base">person</span>
            </div>
            <span id="header-user-name" class="text-xs font-semibold text-slate-700 hidden sm:inline">Admin</span>
            <span class="material-symbols-outlined text-slate-400 text-sm">expand_more</span>
          </button>
          
          <!-- Dropdown content -->
          <div id="profile-dropdown-menu" class="hidden absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 text-left">
            <a href="settings-profile.html" class="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <span class="material-symbols-outlined text-sm">person</span> Profile Settings
            </a>
            <a href="settings-system.html" class="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <span class="material-symbols-outlined text-sm">settings</span> System Config
            </a>
            <hr class="border-slate-100 my-1">
            <a href="#" onclick="handleSignOut(event)" class="flex items-center gap-2 px-4 py-2 text-sm text-red-655 hover:bg-red-50 text-red-600 font-semibold">
              <span class="material-symbols-outlined text-sm">logout</span> Sign Out
            </a>
          </div>
        </div>
      </div>
    </header>
  `;

  headerContainer.outerHTML = headerHtml;
}

function setupInteractions() {
  const dropdownBtn = document.getElementById('profile-dropdown-btn');
  const dropdownMenu = document.getElementById('profile-dropdown-menu');

  if (dropdownBtn && dropdownMenu) {
    dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('hidden');
      document.getElementById('notifications-menu')?.classList.add('hidden');
    });

    document.addEventListener('click', () => {
      dropdownMenu.classList.add('hidden');
    });
  }

  const notifBtn = document.getElementById('notifications-btn');
  const notifMenu = document.getElementById('notifications-menu');
  if (notifBtn && notifMenu) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifMenu.classList.toggle('hidden');
      document.getElementById('profile-dropdown-menu')?.classList.add('hidden');
    });

    document.addEventListener('click', () => {
      notifMenu.classList.add('hidden');
    });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.row-actions-btn');
    const activeMenu = document.querySelector('.row-actions-menu:not(.hidden)');

    if (activeMenu && (!btn || activeMenu !== btn.nextElementSibling)) {
      activeMenu.classList.add('hidden');
    }

    if (btn) {
      e.stopPropagation();
      const menu = btn.nextElementSibling;
      if (menu) {
        menu.classList.toggle('hidden');
      }
    }
  }, { capture: true });
}

function openHelpModal() {
  let modal = document.getElementById('global-help-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'global-help-modal';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <h3 class="text-base font-bold text-slate-800">BKI Academy Support Center</h3>
          <button class="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors" onclick="document.getElementById('global-help-modal').remove()">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="p-6 flex flex-col gap-4">
          <div>
            <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Frequently Asked Questions</h4>
            <ul class="text-xs text-slate-600 flex flex-col gap-2 list-disc pl-4">
              <li><strong>How do I change certificate status?</strong> Go to Training Detail &rarr; Certificates Tab and click on a card to open workflow status details.</li>
              <li><strong>How do I import participants?</strong> Go to Training Detail &rarr; Participants Tab and click "Upload Participant List".</li>
              <li><strong>Where do I set SLA limits?</strong> Go to Settings &rarr; System Configuration.</li>
            </ul>
          </div>
          <hr class="border-slate-100">
          <div class="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span class="material-symbols-outlined text-blue-600 text-2xl">mail</span>
            <div>
              <p class="text-xs font-semibold text-slate-800">Need IT Support?</p>
              <a href="mailto:support@bkiacademy.com" class="text-[11px] text-blue-600 hover:underline">support@bkiacademy.com</a>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }
}

function clearNotifDot() {
  const dot = document.getElementById('notif-dot');
  if (dot) dot.remove();
  localStorage.setItem('bki_notif_read_timestamp', Date.now().toString());
}

function formatRelativeTime(dateInput) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMs < 0) return 'Just now';
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  const options = { day: 'numeric', month: 'short' };
  return date.toLocaleDateString('en-US', options);
}

async function updateNotifications() {
  const notifList = document.getElementById('notifications-list');
  if (!notifList) return;
  if (typeof DB === 'undefined') return;

  try {
    const [trainings, certificates] = await Promise.all([
      DB.getTrainings(),
      DB.getCertificates()
    ]);

    const notifications = [];

    // 1. SLA Overdue Notifications
    certificates.forEach(c => {
      if (c.status !== 'Completed' && c.sla_age_days > 4) {
        const name = c.participants ? c.participants.name : 'Unknown';
        const progName = c.trainings ? c.trainings.program_name : 'Training';
        const time = c.updated_at ? new Date(c.updated_at) : new Date(c.created_at || (Date.now() - 86400000));
        notifications.push({
          type: 'overdue',
          icon: 'warning',
          iconColor: 'text-red-500',
          message: `SLA Overdue: <span class="font-semibold text-slate-900">${name}</span> (${progName}) delayed by ${c.sla_age_days} days.`,
          time: time
        });
      }
    });

    // 2. Completed / Sent Notifications
    certificates.forEach(c => {
      if (c.status === 'Completed' && c.sent_at) {
        const name = c.participants ? c.participants.name : 'Unknown';
        const progName = c.trainings ? c.trainings.program_name : 'Training';
        const time = new Date(c.sent_at);
        notifications.push({
          type: 'completed',
          icon: 'check_circle',
          iconColor: 'text-green-500',
          message: `Certificate Shipped: <span class="font-semibold text-slate-900">${name}</span> (${progName}) is completed & delivered.`,
          time: time
        });
      }
    });

    // 3. New Training Batch Notifications
    trainings.forEach(t => {
      const time = t.created_at ? new Date(t.created_at) : new Date(t.start_date);
      notifications.push({
        type: 'new_batch',
        icon: 'info',
        iconColor: 'text-blue-500',
        message: `New batch created: <span class="font-semibold text-slate-900">${t.program_name}</span> (${t.batch_code}).`,
        time: time
      });
    });

    // Sort by time descending
    notifications.sort((a, b) => b.time - a.time);

    // Limit to 5
    const displayList = notifications.slice(0, 5);

    if (displayList.length === 0) {
      notifList.innerHTML = `
        <div class="px-4 py-6 text-center text-xs text-slate-400">
          <span class="material-symbols-outlined text-xl block mb-1">notifications_off</span>
          No notifications at this time
        </div>
      `;
      const dot = document.getElementById('notif-dot');
      if (dot) dot.remove();
      return;
    }

    notifList.innerHTML = displayList.map(n => `
      <div class="px-4 py-3 hover:bg-slate-50 flex gap-2">
        <span class="material-symbols-outlined ${n.iconColor} text-sm mt-0.5">${n.icon}</span>
        <div>
          <p class="text-xs text-slate-700">${n.message}</p>
          <span class="text-[9px] text-slate-400 block mt-1 font-semibold uppercase">${formatRelativeTime(n.time)}</span>
        </div>
      </div>
    `).join('');

    // Manage Notif Dot Badge
    const latestNotifTime = displayList[0].time.getTime();
    const lastReadTime = parseInt(localStorage.getItem('bki_notif_read_timestamp') || '0');

    const dot = document.getElementById('notif-dot');
    if (latestNotifTime <= lastReadTime) {
      if (dot) dot.remove();
    } else {
      if (!dot) {
        const btn = document.getElementById('notifications-btn');
        if (btn) {
          const newDot = document.createElement('span');
          newDot.id = 'notif-dot';
          newDot.className = 'absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full';
          btn.appendChild(newDot);
        }
      }
    }

  } catch (err) {
    console.error('Error loading notifications:', err);
  }
}

// Global CSV download utility
function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Downloads the exact Agenda template
function downloadCSVTemplate() {
  const headers = "No Urut Proyek,Jenis Layanan,Metode Belajar Menghajar,Tanggal Sesuai Jadwal,Pemohon,Obyek/Nama Pelatihan,No Registrasi Peserta,Nama,Perusahaan,No Sertifikat Kehadiran,Hasil Evaluasi,No Sertifikat Kualifikasi\n";
  const row1 = "1,PUBLIC TRAINING,OFFLINE,02-04 FEBRUARI,PRIBADI,INTERNAL AUDITOR ISM CODE 113,0001,ASFUL FIQI FEBRIANTO,PRIBADI,0001-01-S1-ACY/001/A01-L12/PB/2026,Lulus,0001-01-S2-ACY/001/A01-L12/PB/2026\n";
  const row2 = ",,,,,INTERNAL AUDITOR ISM CODE 113,0002,HARDI KADIRAN,PT. PRIMA BUANA GEMA BAHARI,0002-01-S1-ACY/001/A01-L12/PB/2026,Lulus,0002-01-S2-ACY/001/A01-L12/PB/2026\n";
  const row3 = "2,PUBLIC TRAINING,OFFLINE,02-06 FEBRUARI,PRIBADI,MARINE SURVEYOR 92,0008,DAVID REXY PANIRUAN SIMATUPANG,PRIBADI,0008-01-S1-ACY/002/A13-L12/PB/2026,Lulus,0008-01-S2-ACY/002/A13-L12/PB/2026\n";

  downloadCSV("bki-import-template.csv", headers + row1 + row2 + row3);
}

// Custom CSV forward-fill parser engine
function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  return rows;
}

function resolveDatesFromText(text) {
  const monthMap = {
    'januari': '01', 'februari': '02', 'maret': '03', 'april': '04',
    'mei': '05', 'juni': '06', 'juli': '07', 'agustus': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'desember': '12'
  };
  const clean = text.toLowerCase().trim();
  const match = clean.match(/(\d+)\s*-\s*(\d+)\s+([a-z]+)/);
  if (match) {
    const startDay = match[1].padStart(2, '0');
    const endDay = match[2].padStart(2, '0');
    const monthName = match[3];
    const monthCode = monthMap[monthName] || '02';
    return {
      start: `2026-${monthCode}-${startDay}`,
      end: `2026-${monthCode}-${endDay}`
    };
  }
  return { start: '2026-02-02', end: '2026-02-04' };
}

function normalizeAgendaCSV(text) {
  const rawRows = parseCSV(text);
  const batches = [];

  rawRows.forEach(row => {
    const projectNo = row['No Urut Proyek'];
    const programName = row['Obyek/Nama Pelatihan'];
    const scheduleDate = row['Tanggal Sesuai Jadwal'];

    if (!programName) return;

    let matchedBatch = null;
    if (projectNo) {
      matchedBatch = batches.find(b => b.projectNo === projectNo);
    } else {
      matchedBatch = batches.slice().reverse().find(b => b.program_name === programName);
    }

    if (!matchedBatch) {
      let startDate = '2026-02-02';
      let endDate = '2026-02-04';
      if (scheduleDate) {
        const parsedDates = resolveDatesFromText(scheduleDate);
        startDate = parsedDates.start;
        endDate = parsedDates.end;
      }

      matchedBatch = {
        projectNo: projectNo || '',
        program_name: programName,
        batch_code: 'Batch ' + (projectNo || Date.now().toString().slice(-3)),
        service_type: row['Jenis Layanan'] || 'PUBLIC TRAINING',
        learning_method: row['Metode Belajar Menghajar'] || 'OFFLINE',
        start_date: startDate,
        end_date: endDate,
        location: 'Jakarta Training Center',
        participants: []
      };
      batches.push(matchedBatch);
    }

    const participantName = row['Nama'];
    if (participantName) {
      const dup = matchedBatch.participants.find(p => p.name === participantName);
      if (!dup) {
        matchedBatch.participants.push({
          name: participantName,
          company: row['Perusahaan'] || 'PRIBADI',
          registration_number: row['No Registrasi Peserta'] || '',
          cert_kehadiran: row['No Sertifikat Kehadiran'] || '',
          cert_kualifikasi: row['No Sertifikat Kualifikasi'] || '',
          evaluasi: row['Hasil Evaluasi'] || 'Lulus'
        });
      }
    }
  });

  return batches;
}

// Normalization Dialog Renderer
function showNormalizationPreview(batches) {
  let modal = document.getElementById('normalization-preview-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'normalization-preview-modal';
  modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4';

  let cardsHtml = '';
  batches.forEach((batch, batchIndex) => {
    cardsHtml += `
      <div class="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col gap-4">
        <h4 class="font-bold text-slate-850 text-slate-800 text-sm flex items-center gap-2">
          <span class="material-symbols-outlined text-blue-600 text-lg">school</span>
          Training Program Batch Details (#${batchIndex + 1})
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Program Name</label>
            <input class="cms-input py-1.5 text-xs font-semibold" id="prev-name-${batchIndex}" value="${batch.program_name}" type="text">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</label>
              <input class="cms-input py-1.5 text-xs font-semibold" id="prev-start-${batchIndex}" value="${batch.start_date}" type="date">
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</label>
              <input class="cms-input py-1.5 text-xs font-semibold" id="prev-end-${batchIndex}" value="${batch.end_date}" type="date">
            </div>
          </div>
        </div>
        
        <div>
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Attendee List & Certificates</label>
          <div class="overflow-x-auto max-h-48 border border-slate-200 rounded-lg table-scroll">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-100 border-b border-slate-200">
                  <th class="p-2 font-bold text-slate-600">Name</th>
                  <th class="p-2 font-bold text-slate-600">Company</th>
                  <th class="p-2 font-bold text-slate-600">Cert. Kehadiran</th>
                  <th class="p-2 font-bold text-slate-600">Cert. Kualifikasi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                ${batch.participants.map((p, pIndex) => `
                  <tr>
                    <td class="p-2 font-semibold text-slate-900">${p.name}</td>
                    <td class="p-2 text-slate-500">${p.company}</td>
                    <td class="p-2 font-mono text-[10px] text-slate-500">${p.cert_kehadiran || '-'}</td>
                    <td class="p-2 font-mono text-[10px] text-slate-500">${p.cert_kualifikasi || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  });

  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 animate-in fade-in zoom-in-95 duration-150" onclick="event.stopPropagation()">
      <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
        <div>
          <h3 class="text-base font-bold text-slate-800">Review & Normalization Mapping</h3>
          <p class="text-xs text-slate-500 mt-0.5">Please review the parsed training program details and date mappings before syncing to the database.</p>
        </div>
        <button class="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors" onclick="document.getElementById('normalization-preview-modal').remove()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="p-6 flex-grow flex flex-col gap-6 overflow-y-auto">
        ${cardsHtml}
      </div>
      <div class="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
        <span class="text-xs text-slate-500 font-semibold uppercase tracking-wider">Detected ${batches.length} Batch(es)</span>
        <div class="flex gap-3">
          <button class="cms-btn-secondary" onclick="document.getElementById('normalization-preview-modal').remove()">Cancel</button>
          <button id="confirm-sync-btn" class="cms-btn-primary">Confirm & Sync to Supabase</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Hook up confirm button
  document.getElementById('confirm-sync-btn').addEventListener('click', async () => {
    const btn = document.getElementById('confirm-sync-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full align-middle mr-2"></span> Syncing...';

    // Read input edits back into batches
    batches.forEach((batch, batchIndex) => {
      batch.program_name = document.getElementById(`prev-name-${batchIndex}`).value;
      batch.start_date = document.getElementById(`prev-start-${batchIndex}`).value;
      batch.end_date = document.getElementById(`prev-end-${batchIndex}`).value;
    });

    // Save to DB layer
    if (typeof DB !== 'undefined') {
      try {
        const existingTrainings = await DB.getTrainings();
        for (let batch of batches) {
          let training = existingTrainings.find(t =>
            t.program_name.toLowerCase().trim() === batch.program_name.toLowerCase().trim() &&
            t.batch_code === batch.batch_code
          );

          if (!training) {
            training = await DB.insertTraining({
              program_name: batch.program_name,
              batch_code: batch.batch_code,
              service_type: batch.service_type,
              learning_method: batch.learning_method,
              start_date: batch.start_date,
              end_date: batch.end_date,
              location: batch.location,
              status: 'Completed'
            });
          }

          for (let p of batch.participants) {
            const participant = await DB.upsertParticipant({
              name: p.name,
              company: p.company,
              registration_number: p.registration_number
            });

            if (p.cert_kehadiran) {
              await DB.insertCertificate({
                training_id: training.id,
                participant_id: participant.id,
                certificate_type: 'Attendance',
                certificate_number: p.cert_kehadiran,
                status: 'Completed',
                evaluation_result: p.evaluasi,
                sla_age_days: 0
              });
            }

            if (p.cert_kualifikasi) {
              await DB.insertCertificate({
                training_id: training.id,
                participant_id: participant.id,
                certificate_type: 'Qualification',
                certificate_number: p.cert_kualifikasi,
                status: 'Completed',
                evaluation_result: p.evaluasi,
                sla_age_days: 0
              });
            }
          }
        }
        alert('All batches normalized and synced to Supabase database successfully!');
      } catch (err) {
        console.error(err);
        alert('Sync failed: ' + err.message);
      }
    } else {
      alert('Database connector not found.');
    }

    modal.remove();
    window.location.reload();
  });
}

// Downloads performance report
function downloadDashboardReport() {
  const csv = "Metric,Value\nTraining Completed,42\nCertificate Pending,18\nOverdue,5\nCompletion Rate,92%\n";
  downloadCSV("bki-dashboard-report.csv", csv);
}

function downloadCertificatesReport() {
  const csv = "Participant,Training,Type,Status,Age,PIC\nAhmad Rizky,ISM Batch 116,Qualification,Printing,5 days,Andi\nBudi Santoso,CSO Batch 53,Attendance,Processing,2 days,Sinta\nSinta Maharani,ISM Batch 116,Attendance,Completed,0 days,Andi\n";
  downloadCSV("bki-certificates-report.csv", csv);
}

function downloadRosterReport() {
  const csv = "Name,Company,Email,Position,Qualification status,Attendance status\nAhmad Rizky,Pertamina Shipping,ahmad.rizky@pertamina.com,Marine Inspector,Printing,Present\nSinta Maharani,Pelindo II,sinta.m@pelindo.co.id,Safety Officer,Completed,Present\nBudi Santoso,Bumi Resources,budi.s@bumiresources.com,HSE Superintendent,Pending,Present\nDewi Lestari,Meratus Line,dewi.l@meratus.com,QA Auditor,Completed,Present\n";
  downloadCSV("bki-roster-report.csv", csv);
}

function downloadBatchReport() {
  const csv = "Batch ID,Training Name,Dates,PIC,Participants count,Completion Rate\nBatch 116,Internal Auditor ISM,03-05 Aug 2026,Andi,25,80%\n";
  downloadCSV("bki-batch-report.csv", csv);
}

// Global Authentication Guards and Sign Out helpers
async function checkUserSession() {
  if (typeof DB !== 'undefined') {
    const isConfigured = await DB.isSupabaseConfigured();
    if (isConfigured) {
      const client = await DB.getSupabaseClient();
      if (client) {
        const { data: { session } } = await client.auth.getSession();
        if (!session) {
          window.location.href = 'index.html';
        }
        return;
      }
    }
  }

  // Local fallback mock session check
  if (!localStorage.getItem('bki_mock_session')) {
    window.location.href = 'index.html';
  }
}

async function handleSignOut(e) {
  if (e) e.preventDefault();
  if (typeof DB !== 'undefined') {
    const client = await DB.getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
  }
  localStorage.removeItem('bki_mock_session');
  window.location.href = 'index.html';
}

async function updateHeaderProfile() {
  const el = document.getElementById('header-user-name');
  const sidebarEl = document.getElementById('sidebar-user-name');

  let name = "Admin";
  let email = "admin@bkiacademy.edu";

  if (typeof DB !== 'undefined') {
    const isConfigured = await DB.isSupabaseConfigured();
    if (isConfigured) {
      const client = await DB.getSupabaseClient();
      if (client) {
        const { data: { user } } = await client.auth.getUser();
        if (user) {
          name = user.user_metadata?.full_name || user.email.split('@')[0];
          email = user.email;
        }
      }
    }
  }

  if (el) el.textContent = name;
  if (sidebarEl) sidebarEl.textContent = name;

  const inputName = document.getElementById('prof-name');
  const inputEmail = document.getElementById('prof-email');
  if (inputName) inputName.value = name;
  if (inputEmail) inputEmail.value = email;
}
