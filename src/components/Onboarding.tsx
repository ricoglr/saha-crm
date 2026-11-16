import { useEffect, useState, type ReactNode } from 'react';
import {
  Sparkles, Plus, CloudOff, BadgePercent, ShieldCheck, Smartphone, Share, SquarePlus, MoreVertical, Download, X, ArrowLeft, ArrowRight,
  type LucideIcon
} from 'lucide-react';
import { finishTour, isInstalled, platform, promptInstall, useInstallPrompt } from '../guide';

type Step = { icon: LucideIcon; title: string; body: ReactNode };

function InstallBody() {
  const prompt = useInstallPrompt();
  const p = platform();
  if (prompt) {
    return (
      <>
        <p>Uygulamayı cihazınıza kurun; ana ekrandan tek dokunuşla, tam ekran açılsın.</p>
        <button className="btn primary" onClick={() => promptInstall()}><Download size={16} /> Uygulamayı yükle</button>
      </>
    );
  }
  if (p === 'ios') {
    return (
      <ol className="steps">
        <li>Safari’de alttaki <Share size={15} /> <b>Paylaş</b> butonuna dokunun.</li>
        <li><SquarePlus size={15} /> <b>Ana Ekrana Ekle</b>’yi seçin.</li>
        <li>Sağ üstte <b>Ekle</b>’ye dokunun.</li>
      </ol>
    );
  }
  if (p === 'android') {
    return (
      <ol className="steps">
        <li>Chrome’da sağ üstteki <MoreVertical size={15} /> menüye dokunun.</li>
        <li><b>Uygulamayı yükle</b> (veya <b>Ana ekrana ekle</b>) seçin.</li>
      </ol>
    );
  }
  return (
    <>
      <p>Sahada kullanmak için telefonunuzda şu adresi açıp giriş yapın:</p>
      <p className="addr">{location.host}</p>
      <p className="muted small">iPhone’da Paylaş → Ana Ekrana Ekle, Android’de ⋮ → Uygulamayı yükle ile kurabilirsiniz.</p>
    </>
  );
}

export function Onboarding({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const phone = window.matchMedia('(max-width: 860px)').matches;
  const steps: Step[] = [
    {
      icon: Sparkles, title: `Hoş geldiniz, ${name.split(' ')[0]}`,
      body: <p>Müşterilerinizi, saha ziyaretlerinizi, fiyat tekliflerinizi ve projelerinizi tek yerden takip edin. Birkaç adımda temel özellikleri gösterelim.</p>
    },
    {
      icon: Plus, title: 'Hızlı kayıt',
      body: (
        <>
          <p>{phone
            ? <>Alttaki <b>+</b> butonuna dokunarak görüşme, teklif, müşteri veya proje ekleyin.</>
            : <>Sağ üstteki <b>Görüşme ekle</b> butonuyla veya müşteri kartındaki butonlarla kayıt ekleyin.</>}</p>
          <p>Görüşme yazarken müşteri adını yazmanız yeterli: listede yoksa <b>yeni müşteri kartı otomatik açılır</b>.</p>
        </>
      )
    },
    {
      icon: CloudOff, title: 'İnternet olmadan da çalışır',
      body: <p>Çekmeyen yerlerde kayıt girmeye devam edin. Kayıtlar cihazınızda saklanır, internet gelince <b>otomatik gönderilir</b>. Durumu ekrandaki eşitleme göstergesinden görebilirsiniz.</p>
    },
    {
      icon: BadgePercent, title: 'Teklifleri sonuçlandırın',
      body: <p>Verdiğiniz her fiyatı kaydedin, sonra <b>Tuttu</b> veya <b>Tutmadı</b> olarak işaretleyin. Tutmayanların nedenini seçmek; fiyat, vade ve rakip analizini mümkün kılar.</p>
    },
    ...(isAdmin ? [{
      icon: ShieldCheck, title: 'Yönetim paneli',
      body: <p>Menüdeki <b>Yönetim</b> sayfasından ekibin performansını görür, tüm kayıtlara bakar ve yeni satışçı eklersiniz. Satışçılar yalnızca kendi kayıtlarını görür.</p>
    }] : []),
    ...(isInstalled() ? [] : [{ icon: Smartphone, title: 'Telefonunuza kurun', body: <InstallBody /> }])
  ];
  const [i, setI] = useState(0);
  const last = i === steps.length - 1;
  const step = steps[i];
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(x - 1, 0));
      if (e.key === 'Escape') finishTour();
    };
    window.addEventListener('keydown', k);
    document.body.classList.add('noscroll');
    return () => { window.removeEventListener('keydown', k); document.body.classList.remove('noscroll'); };
  }, [steps.length]);

  return (
    <div className="tour-bg">
      <div className="tour" role="dialog" aria-label="Tanıtım">
        <button className="icon-btn tour-skip" onClick={finishTour} aria-label="Tanıtımı kapat"><X size={18} /></button>
        <div className="tour-ic"><step.icon size={30} strokeWidth={1.7} /></div>
        <h2>{step.title}</h2>
        <div className="tour-body" key={i}>{step.body}</div>
        <div className="tour-dots">
          {steps.map((_, n) => <button key={n} className={n === i ? 'on' : ''} onClick={() => setI(n)} aria-label={`Adım ${n + 1}`} />)}
        </div>
        <div className="tour-foot">
          {i > 0 ? <button className="btn ghost" onClick={() => setI(i - 1)}><ArrowLeft size={16} /> Geri</button>
            : <button className="btn ghost" onClick={finishTour}>Atla</button>}
          <span className="grow" />
          {last ? <button className="btn primary" onClick={finishTour}>Başlayalım</button>
            : <button className="btn primary" onClick={() => setI(i + 1)}>İleri <ArrowRight size={16} /></button>}
        </div>
      </div>
    </div>
  );
}
