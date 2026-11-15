export const PROVINCES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin',
  'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa',
  'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum',
  'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir',
  'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis', 'Kırıkkale', 'Kırklareli',
  'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir',
  'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa', 'Şırnak',
  'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
];

export const HOME_CITY = 'Konya';

export const KONYA_DISTRICTS = [
  'Ahırlı', 'Akören', 'Akşehir', 'Altınekin', 'Beyşehir', 'Bozkır', 'Cihanbeyli', 'Çeltik', 'Çumra', 'Derbent',
  'Derebucak', 'Doğanhisar', 'Emirgazi', 'Ereğli', 'Güneysınır', 'Hadim', 'Halkapınar', 'Hüyük', 'Ilgın',
  'Kadınhanı', 'Karapınar', 'Karatay', 'Kulu', 'Meram', 'Sarayönü', 'Selçuklu', 'Seydişehir', 'Taşkent',
  'Tuzlukçu', 'Yalıhüyük', 'Yunak'
];

export const CUSTOMER_GROUPS = [
  'Müteahhit / İnşaat Firması', 'Bayi / Nalbur', 'Sanayi / İmalatçı', 'Demir-Çelik Tüccarı',
  'Kooperatif', 'Kamu / Belediye', 'Bireysel', 'Diğer'
];

export const CUSTOMER_STATUS: Record<string, string> = {
  potansiyel: 'Potansiyel',
  aktif: 'Aktif (alım yapıyor)',
  pasif: 'Pasif'
};

export const VISIT_KINDS: Record<string, string> = {
  saha: 'Saha ziyareti',
  telefon: 'Telefon görüşmesi',
  gelen: 'Beni ziyarete geldi'
};

export const PRODUCTS = [
  'İnşaat Demiri (Nervürlü)', 'Hasır Çelik', 'Sac Levha - Siyah (HRP)', 'Sac Levha - DKP', 'Galvaniz Sac',
  'Rulo - Sıcak Haddelenmiş', 'Rulo - Soğuk Haddelenmiş', 'Rulo - Galvaniz', 'Kutu Profil / Profil', 'Boru',
  'NPU / NPI / HEA', 'Lama / Köşebent', 'Filmaşin', 'Diğer'
];

export const UNITS = ['ton', 'kg', 'adet', 'm²'];
export const CURRENCIES = ['TL', 'USD', 'EUR'];

export const QUOTE_STATUS: Record<string, string> = {
  beklemede: 'Beklemede',
  tuttu: 'Tuttu',
  tutmadi: 'Tutmadı'
};

export const LOST_REASONS = [
  'Fiyat yüksek bulundu', 'Rakip daha ucuz verdi', 'Vade / ödeme şartı uymadı', 'Teslim süresi uzun',
  'Stok / ürün yok', 'Nakliye maliyeti', 'Proje ertelendi / iptal', 'Müşteri dönüş yapmadı', 'Diğer'
];

export const PROJECT_STAGES: Record<string, string> = {
  duyum: 'Duyum / bilgi',
  gorusme: 'Görüşme yapıldı',
  teklif: 'Teklif verildi',
  pazarlik: 'Pazarlıkta',
  kazanildi: 'Kazanıldı',
  kaybedildi: 'Kaybedildi',
  beklemede: 'Beklemede / ertelendi'
};

export const BARTER_TYPES = [
  'Daire / Konut', 'Arsa', 'İşyeri / Dükkan', 'Araç / İş makinası', 'Mal / Ürün', 'Diğer'
];

export const BARTER_STATUS: Record<string, string> = {
  degerlendiriliyor: 'Değerlendiriliyor',
  kabul: 'Kabul edildi',
  red: 'Reddedildi'
};

export const REGION_STATUS: Record<string, string> = {
  planlandi: 'Ziyaret planlandı',
  ziyaret: 'Ziyaret edildi',
  potansiyel: 'Potansiyel var',
  zayif: 'Potansiyel zayıf'
};
