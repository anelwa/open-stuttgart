import { useEffect, useState } from 'react';
import { Icon } from './Icon';

/**
 * Druckbares DIN-A6-Schild mit QR-Deep-Link. Der QR-Code entsteht lokal im Browser
 * (qrcode), das Schild lässt sich über die Druckfunktion des Browsers ausgeben.
 */
export function PrintSign({ title, subtitle, url, onClose }: { title: string; subtitle?: string; url: string; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    import('qrcode').then((QR) => QR.toDataURL(url, { margin: 1, width: 420, errorCorrectionLevel: 'M' }))
      .then((d) => { if (alive) setSrc(d); })
      .catch(() => { if (alive) setErr('Der QR-Code konnte nicht erzeugt werden.'); });
    return () => { alive = false; };
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="print-sign-backdrop" role="dialog" aria-modal="true" aria-label="Schild drucken">
      <div className="print-sign">
        <div className="print-sign-card">
          <div className="print-sign-brand"><span className="print-sign-dot" /> Open Stuttgart</div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
          <div className="print-sign-qr">
            {src ? <img src={src} alt={`QR-Code zu ${url}`} /> : <span className="skeleton" style={{ width: 180, height: 180, borderRadius: 8 }} />}
          </div>
          <p className="print-sign-hint">Scannen und in Open Stuttgart öffnen.</p>
          <p className="print-sign-url">{url.replace(/^https?:\/\//, '')}</p>
          {err && <p className="print-sign-err">{err}</p>}
        </div>
        <div className="print-sign-actions">
          <button type="button" className="link-btn" onClick={() => window.print()}><Icon name="image" size={16} /> Drucken</button>
          <button type="button" className="link-btn secondary" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}
