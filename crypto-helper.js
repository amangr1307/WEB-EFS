/* crypto-helper.js
   Web Crypto based helper for:
     - password -> AES-GCM key derivation (PBKDF2)
     - encrypt / decrypt ArrayBuffers using AES-GCM
     - SHA-256 hashing for integrity checks
   Exposes: CryptoHelper.encryptBuffer, CryptoHelper.decryptBuffer, CryptoHelper.hashBuffer
   All data returned/accepted by encrypt/decrypt are base64 strings for easy storage.
*/

(() => {
  const subtle = window.crypto.subtle;

  // Configuration
  const PBKDF2_ITERATIONS = 200000; // fine for modern machines; adjust if slow
  const PBKDF2_HASH = 'SHA-256';
  const AES_ALGO = 'AES-GCM';
  const AES_KEY_LENGTH = 256; // bits
  const IV_LENGTH = 12; // bytes for AES-GCM
  const SALT_LENGTH = 16; // bytes

  /* Utility: encode string to ArrayBuffer (UTF-8) */
  function str2ab(str) {
    return new TextEncoder().encode(str);
  }

  /* Utility: convert ArrayBuffer/TypedArray -> base64 string */
  function ab2base64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000; // avoid stack overflow for large buffers
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  /* Utility: base64 string -> ArrayBuffer */
  function base642ab(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /* Generate random bytes (Uint8Array) */
  function randomBytes(length) {
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return arr;
  }

  /* Derive an AES-GCM CryptoKey from a password and salt */
  async function deriveKeyFromPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
    if (typeof password !== 'string') throw new Error('Password must be a string');
    const passKey = await subtle.importKey(
      'raw',
      str2ab(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const key = await subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: PBKDF2_HASH
      },
      passKey,
      { name: AES_ALGO, length: AES_KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );

    return key; // CryptoKey
  }

  /* Compute SHA-256 hash of an ArrayBuffer, return base64 */
  async function hashBufferToBase64(arrayBuffer) {
    const digest = await subtle.digest('SHA-256', arrayBuffer);
    return ab2base64(digest);
  }

  /* Encrypt an ArrayBuffer (file content). Returns an object with base64 fields:
     {
       ciphertext: <base64>,
       iv: <base64>,
       salt: <base64>,
       iterations: <number>,
       hash: <base64> // SHA-256 of plaintext (integrity; optional but recommended)
     }
     Note: pass password as string.
  */
  async function encryptBuffer(arrayBuffer, password) {
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error('arrayBuffer must be an ArrayBuffer');
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('password must be a non-empty string');
    }

    // generate salt and iv
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // derive key
    const key = await deriveKeyFromPassword(password, salt, PBKDF2_ITERATIONS);

    // compute plaintext hash for integrity verification
    const plainHashBase64 = await hashBufferToBase64(arrayBuffer);

    // encrypt
    const cipherBuffer = await subtle.encrypt(
      { name: AES_ALGO, iv: iv },
      key,
      arrayBuffer
    );

    return {
      ciphertext: ab2base64(cipherBuffer),
      iv: ab2base64(iv.buffer),
      salt: ab2base64(salt.buffer),
      iterations: PBKDF2_ITERATIONS,
      hash: plainHashBase64
    };
  }

  /* Decrypt given encryptedPackage produced by encryptBuffer.
     encryptedPackage should be:
     {
       ciphertext: <base64>,
       iv: <base64>,
       salt: <base64>,
       iterations: <number>, // optional
       hash: <base64> // optional, expected plaintext hash
     }
     Returns:
      {
        arrayBuffer: ArrayBuffer,   // plaintext data
        ok: boolean,                // whether hash matched (if provided)
        expectedHash: <base64|null>,
        computedHash: <base64>
      }
  */
  async function decryptBuffer(encryptedPackage, password) {
    if (!encryptedPackage || typeof encryptedPackage.ciphertext !== 'string') {
      throw new Error('Invalid encrypted package');
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('password must be a non-empty string');
    }

    const ciphertextBuf = base642ab(encryptedPackage.ciphertext);
    const ivBuf = base642ab(encryptedPackage.iv);
    const saltBuf = base642ab(encryptedPackage.salt);
    const iterations = encryptedPackage.iterations || PBKDF2_ITERATIONS;

    // derive key
    const key = await deriveKeyFromPassword(password, new Uint8Array(saltBuf), iterations);

    // decrypt
    let plainBuf;
    try {
      plainBuf = await subtle.decrypt(
        { name: AES_ALGO, iv: new Uint8Array(ivBuf) },
        key,
        ciphertextBuf
      );
    } catch (err) {
      // decryption failed (likely wrong password or tampered ciphertext)
      throw new Error('Decryption failed. Wrong password or corrupted data.');
    }

    // compute hash and compare if expected exists
    const computedHash = await hashBufferToBase64(plainBuf);
    const expectedHash = encryptedPackage.hash || null;
    const ok = expectedHash ? (computedHash === expectedHash) : true;

    return {
      arrayBuffer: plainBuf,
      ok,
      expectedHash,
      computedHash
    };
  }

  /* Helper: create a serializable package for storing files in IndexedDB.
     Accepts: fileName (string), arrayBuffer (file contents), password (string)
     Returns object:
     {
       name: <filename>,
       createdAt: <ISO string>,
       size: <number>,
       ciphertext: <base64 string>,
       iv: <base64>,
       salt: <base64>,
       iterations: <number>,
       hash: <base64>
     }
  */
  async function createEncryptedFileRecord(fileName, arrayBuffer, password) {
    const enc = await encryptBuffer(arrayBuffer, password);
    return {
      name: fileName,
      createdAt: new Date().toISOString(),
      size: arrayBuffer.byteLength,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      salt: enc.salt,
      iterations: enc.iterations,
      hash: enc.hash
    };
  }

  /* Helper: convert ArrayBuffer to Blob with original filename MIME hint (optional) */
  function arrayBufferToBlob(arrayBuffer, mimeType = '') {
    return new Blob([arrayBuffer], { type: mimeType });
  }

  // Expose API on window.CryptoHelper
  window.CryptoHelper = {
    encryptBuffer,             // (ArrayBuffer, password) => encryptedPackage (object with base64 fields)
    decryptBuffer,             // (encryptedPackage, password) => {arrayBuffer, ok, expectedHash, computedHash}
    hashBufferToBase64,        // (ArrayBuffer) => base64 hash
    createEncryptedFileRecord, // (fileName, ArrayBuffer, password) => record ready to store
    arrayBufferToBlob,         // (ArrayBuffer, mimeType) => Blob
    // utilities (exposed for convenience)
    _ab2base64: ab2base64,
    _base642ab: base642ab
  };
})();
