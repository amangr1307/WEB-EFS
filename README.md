# 🔐 EFS Explorer

**EFS Explorer** (Encrypted File System Explorer) is a browser-based secure file manager that allows you to **encrypt, store, and manage files directly in your browser**.  
All files are protected using **AES-GCM encryption** with a password-derived key. Nothing leaves your device — everything is handled locally using the Web Crypto API and IndexedDB.

---

## ✨ Features

- **Password-based security**
  - Files are encrypted with AES-GCM.
  - Keys are derived using PBKDF2 with random salt + high iteration count.
  - Password is never stored — you must re-enter it to unlock files.

- **Secure file storage**
  - Files are stored in browser’s IndexedDB.
  - Only ciphertext, salt, IV, and metadata are stored.
  - Even if someone steals the DB, contents remain encrypted.

- **Drag & drop upload**
  - Intuitive drag-and-drop zone with pulsing glow animation.
  - File input button as fallback.

- **File explorer**
  - Lists all stored encrypted files after unlocking.
  - Allows downloading (decrypted) or deleting files.

- **Integrity checking**
  - SHA-256 hash ensures decrypted file matches the original.

- **Reset environment**
  - Reset button wipes all stored files and clears session.
  - 5-second delayed confirmation (Yes/No) to prevent accidents.

- **UI/UX**
  - Clean and lightweight design (HTML + CSS).
  - Smooth animations for drag-over states.
  - Styled confirmation dialogs and buttons.

---

## 🛠️ Technologies Used

- **HTML5 / CSS3 / JavaScript (Vanilla)**
- **Web Crypto API** – AES-GCM, PBKDF2, SHA-256
- **IndexedDB** – Persistent encrypted file storage
- **Blob API** – Secure file download handling

---

## 📂 Project Structure

```
efs-explorer/
│
├── index.html          # Main UI layout
├── style.css           # Lightweight styles, drag-drop animation
│
├── script.js           # App logic (UI, file operations, reset flow)
├── crypto-helper.js    # Encryption/decryption utilities
├── db.js               # IndexedDB wrapper (save/get/delete files)
│
└── README.md           # Project documentation
```

---

## 🚀 How to Run

1. Clone or download this repository.
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge).
3. Set a password to unlock the environment.
4. Drag and drop files to encrypt and store them.
5. To retrieve files:
   - Enter the same password.
   - Select files to download (decrypted).
6. Use **Reset** to wipe everything (irreversible).

---

## ⚠️ Security Notes

- Files are encrypted locally with **AES-GCM**.  
- Passwords are never stored. If forgotten, files **cannot** be recovered.  
- Reset permanently deletes all encrypted data.  
- Browser extensions or keyloggers may compromise security.  
- For maximum security, use strong passwords.

---

## 📸 # Screenshots with Descriptions

> 
> ## <img src="https://readme-typing-svg.herokuapp.com?size=22&color=2F81F7&lines=Password+Setup+Page" alt="Password Setup Page" />
> 
> <img width="937" height="968" alt="Password Setup Page" src="https://github.com/user-attachments/assets/839b9c0a-ec98-475f-bdd9-3accb1beaad8" />
> 
> *Starting page for password setup when no files are present in the environment.*


>
---
> ## <img src="https://readme-typing-svg.herokuapp.com?size=22&color=2F81F7&lines=Unlocked+State" alt="Unlocked State" />
> 
> <img width="932" height="967" alt="Unlocked State" src="https://github.com/user-attachments/assets/940b29cc-7df4-427b-bec5-f541ce7b7af4" />
> 
> *Encrypted file system (EFS) in an unlocked state after entering the correct password.*


>
---
> ## <img src="https://readme-typing-svg.herokuapp.com?size=22&color=2F81F7&lines=Locked+State" alt="Locked State" />
> 
> <img width="937" height="971" alt="Locked State" src="https://github.com/user-attachments/assets/6fd8ee60-21ac-403a-af33-4c01eefaeae1" />
> 
> *System view in a locked state, either when the lock icon is pressed or the page is refreshed.*


> 
---
> ## <img src="https://readme-typing-svg.herokuapp.com?size=22&color=2F81F7&lines=Reset+Warning" alt="Reset Warning" />
> 
> <img width="933" height="956" alt="Reset Warning" src="https://github.com/user-attachments/assets/7ec04b6b-d08e-41d3-8cd6-7f245b5d3a29" />
> 
> *Interface displayed when the Reset button is pressed, showing a 5-second timeout warning to the user.*


>
---
>##  <img src="https://readme-typing-svg.herokuapp.com?size=22&color=2F81F7&lines=Light+Dark+Theme+support" alt="Light and Dark Theme " />
> <img width="935" height="967" alt="image" src="https://github.com/user-attachments/assets/738ed7a6-246f-4622-9425-6ee094315747" />
>
> *Light and Dark theme Toogle Button Support.*


## 📌 Future Improvements

- Folder support (virtual directories in IndexedDB).  
- Session auto-lock after inactivity.  
- File preview without full download.  

---

## 📜 License

This project is for **educational purposes** ( Security / Browser Security coursework).  
You may use, modify, and extend it freely.
