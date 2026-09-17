/**
 * Coleta leve de Entropia do Dispositivo (Device Fingerprinting)
 * Gera um identificador único de hardware para prevenção de abusos e trava anti-Sybil
 */

export async function getDeviceFingerprint() {
  try {
    const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const platform = navigator.platform || 'web';
    const hardware = navigator.hardwareConcurrency || 4;

    // Renderização de matriz invisível de Canvas
    let canvasSignature = '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 140;
      canvas.height = 35;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Cinzel', serif";
        ctx.fillStyle = '#d4a34b';
        ctx.fillRect(5, 5, 80, 20);
        ctx.fillStyle = '#10101d';
        ctx.fillText('ArcanaVTT-2026', 10, 10);
        canvasSignature = canvas.toDataURL();
      }
    } catch (e) {
      canvasSignature = 'canvas-disabled';
    }

    const rawEntropy = `${screenInfo}::${timezone}::${platform}::${hardware}::${canvasSignature}`;
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest('SHA-256', enc.encode(rawEntropy));
    const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    const fingerprint = `dev_${hex.substring(0, 24)}`;

    try {
      localStorage.setItem('arcana_device_fingerprint', fingerprint);
    } catch (e) {}

    return fingerprint;
  } catch (err) {
    let fallback = null;
    try {
      fallback = localStorage.getItem('arcana_device_fingerprint');
    } catch (e) {}

    if (!fallback) {
      fallback = `dev_${Math.random().toString(36).substring(2, 12)}${Date.now().toString(36)}`;
      try {
        localStorage.setItem('arcana_device_fingerprint', fallback);
      } catch (e) {}
    }
    return fallback;
  }
}
