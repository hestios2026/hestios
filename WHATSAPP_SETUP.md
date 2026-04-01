# HestiOS — WhatsApp Business API Setup Checklist

Ultima actualizare: 2026-03-22

---

## 1. Conturi și înregistrări Meta

- [ ] Creat cont **Meta Business Manager** (business.facebook.com)
- [ ] Creat **WhatsApp Business Account (WABA)** din Business Manager
- [ ] Creat **aplicație** în Meta for Developers (developers.facebook.com) cu produsul "WhatsApp" activat
- [ ] Ales / cumpărat **număr de telefon dedicat** pentru WhatsApp Business
  - Numărul NU trebuie să fie înregistrat pe WhatsApp personal sau WhatsApp Business app
  - Opțiuni: SIM Telekom/1&1, sau număr VoIP (ex: sipgate.de)
- [ ] **Adăugat numărul** în WABA și verificat prin SMS/apel

---

## 2. Credențiale (necesare în Setări HestiOS)

- [ ] Salvat **Phone Number ID** (din Meta → WhatsApp Manager → Phone Numbers)
- [ ] Salvat **WABA ID** (WhatsApp Business Account ID)
- [ ] Generat **System User Token permanent** (Business Manager → Settings → System Users → Add System User → Generate Token)
  - Permisiuni necesare: `whatsapp_business_messaging`, `whatsapp_business_management`
- [ ] Introdus credențialele în HestiOS → Setări → WhatsApp

---

## 3. Template-uri de mesaje

Template-urile trebuie create în Meta Business Manager → WhatsApp Manager → Message Templates.
Aprobare: 1-3 zile lucrătoare.

### Template 1 — `programari_zilnice`
Folosit de: **Notificări zilnice 20:00**

- [ ] Creat template în Meta
- [ ] Aprobat de Meta
- [ ] Testat trimitere

Conținut propus:
```
Programări pentru mâine, {{1}}:

{{2}}

— HestiOS
```
({{1}} = data, {{2}} = lista programărilor formatată)

---

### Template 2 — `comanda_aprobare`
Folosit de: **Agent Achiziții — cerere de aprobare**

- [ ] Creat template în Meta
- [ ] Aprobat de Meta
- [ ] Testat trimitere

Conținut propus:
```
Comandă nouă de aprobat:

{{1}}

Total estimat: {{2}} EUR

Răspunde DA pentru a trimite comenzile sau NU pentru a anula.
```
({{1}} = breakdown per furnizor cu produse și prețuri, {{2}} = total)

---

### Template 3 — `comanda_confirmata`
Folosit de: **Agent Achiziții — confirmare după aprobare**

- [ ] Creat template în Meta
- [ ] Aprobat de Meta
- [ ] Testat trimitere

Conținut propus:
```
Comanda #{{1}} a fost confirmată. Emailurile au fost trimise către:
{{2}}

— HestiOS
```
({{1}} = ID comandă, {{2}} = lista furnizorilor contactați)

---

## 4. Deploy server (prereq pentru webhook)

Webhookul Meta trebuie să fie la o adresă HTTPS publică. Deploy-ul pe Hetzner trebuie finalizat înainte de înregistrarea webhookului.

- [ ] VPS Hetzner CPX31 creat și configurat
- [ ] Docker Compose pornit pe server (PostgreSQL + MinIO + Redis + Backend + Frontend)
- [ ] Nginx configurat cu reverse proxy
- [ ] SSL activ (Let's Encrypt / Certbot)
- [ ] Domeniu configurat (ex: `app.hesti-rossmann.de`)
- [ ] Backend accesibil la `https://app.hesti-rossmann.de/api/`

---

## 5. Înregistrare Webhook Meta

- [ ] URL webhook înregistrat în Meta for Developers → WhatsApp → Configuration
  - URL: `https://app.hesti-rossmann.de/api/webhooks/whatsapp/`
  - Verify Token: generat și salvat în `.env` backend
- [ ] Meta a verificat cu succes URL-ul (GET hub.challenge)
- [ ] Subscribed la event: `messages`
- [ ] Testat cu mesaj real: mesajul ajunge în backend

---

## 6. Implementare backend HestiOS

### Notificări zilnice 20:00
- [ ] APScheduler instalat și configurat în backend
- [ ] Task scheduler: rulează zilnic la ora din Setări
- [ ] Logică: fetch programări pentru ziua următoare, grupate per șantier/responsabil
- [ ] Trimite template `programari_zilnice` către fiecare responsabil
- [ ] Testat end-to-end

### Agent Achiziții WhatsApp
- [ ] Endpoint webhook handler (`POST /api/webhooks/whatsapp/`)
- [ ] Verificare semnătură Meta (X-Hub-Signature-256)
- [ ] Integrare Claude API pentru parsare cerere materiale
- [ ] Logică comparare prețuri + optimizare per furnizor (există deja în DB)
- [ ] Trimitere mesaj de aprobare cu breakdown complet
- [ ] Handler răspuns DA/NU
- [ ] La DA: trimitere emailuri automate către furnizori + creare comandă în DB
- [ ] La NU: anulare + notificare
- [ ] Testat flux complet

---

## 7. Costuri estimate lunare

| Serviciu | Cost estimat |
|---|---|
| Hetzner CPX31 | ~€17/lună |
| WhatsApp Cloud API (sub 1.000 conversații) | Gratuit |
| WhatsApp Cloud API (peste 1.000 conv.) | ~€0.06/conversație |
| Claude API (haiku, ~100 cereri/lună) | ~$0.30/lună |
| SIM / număr VoIP dedicat | €5-15/lună |
| **Total estimat** | **~€25-35/lună** |

---

## Note

- Mesajele trimise din inițiativă proprie (outbound) **trebuie** să folosească template-uri aprobate
- Răspunsurile în fereastra de 24h de la ultimul mesaj al utilizatorului pot fi free-form
- System User Token-ul nu expiră dacă e generat corect — nu folosi token-ul personal de dezvoltator
- Pentru testare locală înainte de deploy: `ngrok http 8002` pentru a expune backend-ul local
