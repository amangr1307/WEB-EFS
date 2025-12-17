/* script.js
   Main UI controller for EFS Explorer
   - Uses window.CryptoHelper and window.DB
   - Manages unlock session, drag/drop, file list rendering, download & delete
*/

(() => {
  // --- DOM elements ---
  const passwordInput = document.getElementById('password-input');
  const unlockBtn = document.getElementById('unlock-btn');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const fileListEl = document.getElementById('file-list');
  const addFileBtn = document.getElementById('add-file-btn');
  const downloadBtn = document.getElementById('download-btn');
  const deleteBtn = document.getElementById('delete-btn');

  // --- In-memory session ---
  let sessionPassword = null; // stored only while page is open and unlocked
  let unlocked = false;       // whether explorer is unlocked for this session
  let storedFiles = [];       // cached list of file records from DB

  // --- Helpers ---
  function showMessage(msg, type = 'info') {
    // For now just console + alert for errors; replace later with toast UI
    console.log(`[EFS] ${msg}`);
    if (type === 'error') {
      alert(msg);
    }
  }

  function createFileListItem(record) {
    // record: { name, createdAt, size, ciphertext, ... }
    const li = document.createElement('li');
    li.dataset.name = record.name;

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '0.6rem';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'file-checkbox';

    const icon = document.createElement('span');
    icon.textContent = unlocked ? '📄' : '🔒';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = record.name;
    nameSpan.title = record.name;

    left.appendChild(checkbox);
    left.appendChild(icon);
    left.appendChild(nameSpan);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '0.6rem';

    const meta = document.createElement('small');
    const date = new Date(record.createdAt);
    meta.textContent = `${(record.size/1024).toFixed(1)} KB • ${date.toLocaleString()}`;
    right.appendChild(meta);

    // Download / status button
    const actionBtn = document.createElement('button');
    actionBtn.textContent = unlocked ? 'Download' : 'Locked';
    actionBtn.disabled = !unlocked;
    actionBtn.className = 'file-action-btn';
    actionBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!unlocked) {
        showMessage('Unlock explorer first to download files.', 'error');
        return;
      }
      try {
        await downloadFile(record.name);
      } catch (err) {
        showMessage(`Download failed: ${err.message}`, 'error');
      }
    });

    right.appendChild(actionBtn);

    li.appendChild(left);
    li.appendChild(right);

    // clicking row toggles checkbox
    li.addEventListener('click', (e) => {
      if (e.target.tagName.toLowerCase() === 'input') return;
      checkbox.checked = !checkbox.checked;
    });

    return li;
  }

  async function refreshFileList() {
    try {
      storedFiles = await DB.getAllFiles();
      // sort by createdAt desc
      storedFiles.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      renderFileList();
    } catch (err) {
      showMessage('Failed to load files from DB: ' + err.message, 'error');
    }
  }

  function renderFileList() {
    fileListEl.innerHTML = '';
    if (!storedFiles || storedFiles.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No files stored yet.';
      fileListEl.appendChild(li);
      return;
    }

    for (const rec of storedFiles) {
      const item = createFileListItem(rec);
      fileListEl.appendChild(item);
    }
  }

  function setUnlockedState(state) {
    unlocked = state;
    if (!unlocked) sessionPassword = null;
    // Update UI states (file icons and action buttons)
    const items = fileListEl.querySelectorAll('li');
    items.forEach(li => {
      const icon = li.querySelector('span');
      const actionBtn = li.querySelector('.file-action-btn');
      if (unlocked) {
        if (icon) icon.textContent = '📄';
        if (actionBtn) {
          actionBtn.textContent = 'Download';
          actionBtn.disabled = false;
        }
      } else {
        if (icon) icon.textContent = '🔒';
        if (actionBtn) {
          actionBtn.textContent = 'Locked';
          actionBtn.disabled = true;
        }
      }
    });

    // Footer buttons
    addFileBtn.disabled = !unlocked;
    downloadBtn.disabled = !unlocked;
    deleteBtn.disabled = !unlocked;
  }

  // --- Core operations ---
  async function tryUnlock(password) {
    // Validate password by attempting to decrypt one file (if exists)
    const files = await DB.getAllFiles();
    if (!files || files.length === 0) {
      // no files to validate against; accept password
      sessionPassword = password;
      setUnlockedState(true);
      showMessage('Explorer unlocked (no files to validate).');
      await refreshFileList();
      return true;
    }

    // pick first file and attempt decrypt
    const sample = files[0];
    try {
      await CryptoHelper.decryptBuffer({
        ciphertext: sample.ciphertext,
        iv: sample.iv,
        salt: sample.salt,
        iterations: sample.iterations,
        hash: sample.hash
      }, password);
      // success
      sessionPassword = password;
      setUnlockedState(true);
      showMessage('Explorer unlocked.');
      await refreshFileList();
      return true;
    } catch (err) {
      // wrong password
      setUnlockedState(false);
      showMessage('Wrong password. Unlock failed.', 'error');
      return false;
    }
  }

  async function handleFilesAdded(fileList) {
    if (!unlocked || !sessionPassword) {
      showMessage('Unlock explorer first before adding files.', 'error');
      return;
    }

    for (const file of fileList) {
      try {
        // check existing
        const existing = await DB.getFile(file.name);
        if (existing) {
          const override = confirm(`A file named "${file.name}" already exists. Overwrite?`);
          if (!override) continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        const rec = await CryptoHelper.createEncryptedFileRecord(file.name, arrayBuffer, sessionPassword);
        // store mimeType optionally in metadata (not currently saved by crypto helper)
        rec.mimeType = file.type || '';
        await DB.saveFile(rec);
        showMessage(`Saved: ${file.name}`);
      } catch (err) {
        showMessage(`Failed to add ${file.name}: ${err.message}`, 'error');
      }
    }

    await refreshFileList();
  }

  async function downloadFile(name) {
    const rec = await DB.getFile(name);
    if (!rec) throw new Error('File not found in DB');

    // decrypt
    const result = await CryptoHelper.decryptBuffer({
      ciphertext: rec.ciphertext,
      iv: rec.iv,
      salt: rec.salt,
      iterations: rec.iterations,
      hash: rec.hash
    }, sessionPassword);

    if (!result || !result.arrayBuffer) throw new Error('Decryption returned no data');

    // verify integrity flag
    if (!result.ok) {
      const proceed = confirm('Integrity check failed (file may be tampered). Download anyway?');
      if (!proceed) return;
    }

    // create blob and trigger download
    const blob = CryptoHelper.arrayBufferToBlob(result.arrayBuffer, rec.mimeType || '');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = rec.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showMessage(`Downloaded: ${rec.name}`);
  }

  async function downloadSelected() {
    const checked = Array.from(document.querySelectorAll('.file-checkbox'))
      .filter(cb => cb.checked)
      .map(cb => cb.closest('li').dataset.name);

    if (!checked.length) {
      showMessage('No files selected to download.', 'error');
      return;
    }

    for (const name of checked) {
      try {
        await downloadFile(name);
      } catch (err) {
        showMessage(`Failed to download ${name}: ${err.message}`, 'error');
      }
    }
  }

  async function deleteSelected() {
    const checked = Array.from(document.querySelectorAll('.file-checkbox'))
      .filter(cb => cb.checked)
      .map(cb => cb.closest('li').dataset.name);

    if (!checked.length) {
      showMessage('No files selected to delete.', 'error');
      return;
    }

    const ok = confirm(`Delete ${checked.length} file(s)? This cannot be undone.`);
    if (!ok) return;

    for (const name of checked) {
      try {
        await DB.deleteFile(name);
        showMessage(`Deleted: ${name}`);
      } catch (err) {
        showMessage(`Failed to delete ${name}: ${err.message}`, 'error');
      }
    }

    await refreshFileList();
  }

 // --- Drag & drop / file input wiring ---
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('highlight'); // use highlight class
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropZone.classList.remove('highlight'); // remove highlight
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('highlight'); // reset highlight
  const dt = e.dataTransfer;
  if (!dt) return;
  const files = Array.from(dt.files || []);
  if (files.length) await handleFilesAdded(files);
});

fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (files.length) await handleFilesAdded(files);
  fileInput.value = ''; // reset
});
const resetBtn = document.getElementById("reset-btn");
const resetConfirmation = document.getElementById("reset-confirmation");
const resetMessage = document.getElementById("reset-message");
const resetYes = document.getElementById("reset-yes");
const resetNo = document.getElementById("reset-no");

resetBtn.addEventListener("click", () => {
  // Show confirmation UI
  resetConfirmation.style.display = "block";
  resetBtn.disabled = true;

  let countdown = 5;
  resetMessage.textContent = `⚠️ This will erase all files. Confirm in ${countdown} seconds...`;
  resetYes.disabled = true;

  const timer = setInterval(() => {
    countdown--;
    resetMessage.textContent = `⚠️ This will erase all files. Confirm in ${countdown} seconds...`;
    if (countdown <= 0) {
      clearInterval(timer);
      resetYes.disabled = false;
      resetMessage.textContent = "⚠️ This will erase all files. Click Yes to confirm.";
    }
  }, 1000);
});

// Cancel reset
resetNo.addEventListener("click", () => {
  resetConfirmation.style.display = "none";
  resetBtn.disabled = false;
});

// Execute reset
resetYes.addEventListener("click", async () => {
  // 1. Clear IndexedDB
  const allFiles = await DB.getAllFiles();
  for (const file of allFiles) {
    await DB.deleteFile(file.name);
  }

  // 2. Clear session password
  sessionPassword = null;

  // 3. Reset UI
  fileListEl.innerHTML = "";
  passwordInput.value = "";
  setUnlockedState(false);

  // Hide confirmation UI
  resetConfirmation.style.display = "none";
  resetBtn.disabled = false;

  showMessage("Environment has been reset. All files erased.");
});


  // footer buttons
  addFileBtn.addEventListener('click', () => fileInput.click());
  downloadBtn.addEventListener('click', async () => {
    if (!unlocked) { showMessage('Unlock explorer first.', 'error'); return; }
    await downloadSelected();
  });
  deleteBtn.addEventListener('click', async () => {
    if (!unlocked) { showMessage('Unlock explorer first.', 'error'); return; }
    await deleteSelected();
  });

  // unlock button
  unlockBtn.addEventListener('click', async () => {
    const pwd = passwordInput.value || '';
    if (!pwd) { showMessage('Enter a password to unlock.', 'error'); return; }
    await tryUnlock(pwd);
  });
  
  const lockButton = document.getElementById("lock-button");

  lockButton.addEventListener("click", () => {
    location.reload(); // Refresh the page
  });
  

  // allow Enter in password input to trigger unlock
  passwordInput.addEventListener('keyup', async (e) => {
    if (e.key === 'Enter') {
      const pwd = passwordInput.value || '';
      if (!pwd) { showMessage('Enter a password to unlock.', 'error'); return; }
      await tryUnlock(pwd);
    }
  });

  // on load: refresh file list (they'll appear locked)
  (async function init() {
    setUnlockedState(false);
    await refreshFileList();
  })();

})();
