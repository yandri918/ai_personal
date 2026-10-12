import os
import re
import imaplib
import email
from email.header import decode_header
from pathlib import Path
from typing import Optional, Callable, List
from datetime import datetime

from .base import BaseAgent
from models import EmailResult, EmailItem
from config import settings

# Google OAuth2 & Gmail API imports
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
BACKEND_DIR = Path(__file__).resolve().parent.parent
TOKEN_FILE = BACKEND_DIR / "token.json"
CREDENTIALS_FILE = BACKEND_DIR / "gcp-oauth.keys.json"
GMAIL_MCP_DIR = Path.home() / ".gmail-mcp"
GMAIL_MCP_TOKEN = GMAIL_MCP_DIR / "credentials.json"

class EmailAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="Email Agent", role="Pengecekan Kotak Masuk, Email Urgent & Tindak Lanjut")

    def is_connected(self) -> bool:
        """Check whether personal email is connected via Gmail API, Google MCP, or IMAP."""
        if TOKEN_FILE.exists() or GMAIL_MCP_TOKEN.exists():
            return True
        if settings.EMAIL_USER and settings.EMAIL_PASSWORD:
            return True
        return False

    def get_connection_info(self) -> dict:
        if GMAIL_MCP_TOKEN.exists():
            return {"type": "gmail_mcp", "connected": True, "label": "Google Workspace MCP (Gmail Terhubung)"}
        elif TOKEN_FILE.exists():
            return {"type": "gmail_oauth", "connected": True, "label": "Google OAuth (Gmail API)"}
        elif settings.EMAIL_USER and settings.EMAIL_PASSWORD:
            return {"type": "imap", "connected": True, "label": f"IMAP ({settings.EMAIL_USER})"}
        else:
            return {"type": "none", "connected": False, "label": "Belum Terhubung"}

    def _get_gmail_service(self):
        """Build authorized Gmail API service from TOKEN_FILE or GMAIL_MCP_TOKEN."""
        target_token_path = TOKEN_FILE if TOKEN_FILE.exists() else (GMAIL_MCP_TOKEN if GMAIL_MCP_TOKEN.exists() else None)
        if not target_token_path:
            return None

        creds = None
        try:
            creds = Credentials.from_authorized_user_file(str(target_token_path), SCOPES)
        except Exception:
            try:
                import json
                raw = json.loads(target_token_path.read_text(encoding="utf-8"))
                creds = Credentials(
                    token=raw.get("access_token"),
                    refresh_token=raw.get("refresh_token"),
                    token_uri="https://oauth2.googleapis.com/token",
                    client_id=raw.get("client_id"),
                    client_secret=raw.get("client_secret")
                )
            except Exception:
                creds = None

        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                with open(target_token_path, 'w', encoding="utf-8") as f:
                    f.write(creds.to_json())
            except Exception:
                creds = None

        if creds and creds.valid:
            return build('gmail', 'v1', credentials=creds)
        return None

    def _save_to_env(self, key: str, value: str):
        env_file = BACKEND_DIR / ".env"
        if not env_file.exists():
            return
        content = env_file.read_text(encoding="utf-8")
        lines = content.splitlines()
        found = False
        new_lines = []
        for line in lines:
            if line.startswith(f"{key}="):
                new_lines.append(f"{key}={value}")
                found = True
            else:
                new_lines.append(line)
        if not found:
            new_lines.append(f"{key}={value}")
        env_file.write_text("\n".join(new_lines), encoding="utf-8")

    def test_and_save_imap(self, user: str, password: str, server: str = "imap.gmail.com", port: int = 993) -> tuple[bool, str]:
        """Test IMAP connection and save if valid."""
        clean_user = user.strip()
        clean_pass = password.strip().replace(" ", "")
        clean_server = server.strip() or "imap.gmail.com"
        try:
            clean_port = int(port) if str(port).isdigit() else 993
        except Exception:
            clean_port = 993

        try:
            mail = imaplib.IMAP4_SSL(clean_server, clean_port, timeout=12)
            mail.login(clean_user, clean_pass)
            mail.select("INBOX")
            mail.logout()

            settings.EMAIL_USER = clean_user
            settings.EMAIL_PASSWORD = clean_pass
            settings.IMAP_SERVER = clean_server
            settings.IMAP_PORT = clean_port
            self._save_to_env("EMAIL_USER", clean_user)
            self._save_to_env("EMAIL_PASSWORD", clean_pass)
            self._save_to_env("IMAP_SERVER", clean_server)
            self._save_to_env("IMAP_PORT", str(clean_port))
            return True, f"Berhasil terhubung ke akun {clean_user} via IMAP!"
        except Exception as e:
            err_str = str(e)
            if "AUTHENTICATIONFAILED" in err_str or "Invalid credentials" in err_str:
                return False, "Autentikasi gagal. Jika menggunakan akun Gmail, pastikan 2-Step Verification aktif dan gunakan Google App Password 16 karakter (myaccount.google.com/apppasswords), bukan password login biasa."
            return False, f"Gagal menghubungkan email ({clean_server}:{clean_port}): {err_str}"

    def disconnect_all(self):
        """Disconnect both OAuth and IMAP."""
        if TOKEN_FILE.exists():
            TOKEN_FILE.unlink()
        settings.EMAIL_USER = ""
        settings.EMAIL_PASSWORD = ""
        self._save_to_env("EMAIL_USER", "")
        self._save_to_env("EMAIL_PASSWORD", "")
        return True

    def start_oauth_flow(self) -> bool:
        """Start local browser OAuth authorization flow for Gmail."""
        if not CREDENTIALS_FILE.exists():
            raise FileNotFoundError(f"File kredensial OAuth {CREDENTIALS_FILE.name} tidak ditemukan.")

        flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
        creds = flow.run_local_server(port=0, open_browser=True, timeout_seconds=120)
        
        with open(TOKEN_FILE, 'w') as f:
            f.write(creds.to_json())
        return True

    def _fetch_gmail_api(self) -> List[EmailItem]:
        """Fetch real emails using Gmail API."""
        service = self._get_gmail_service()
        if not service:
            raise RuntimeError("Kredensial Gmail OAuth tidak valid atau telah kedaluwarsa.")

        items: List[EmailItem] = []
        # Query: 10 latest messages from Inbox
        results = service.users().messages().list(userId='me', maxResults=10, q='in:inbox').execute()
        messages = results.get('messages', [])

        for msg_meta in messages:
            msg_id = msg_meta['id']
            msg = service.users().messages().get(userId='me', id=msg_id, format='metadata', metadataHeaders=['Subject', 'From', 'Date']).execute()
            
            headers = {h['name'].lower(): h['value'] for h in msg.get('payload', {}).get('headers', [])}
            subject = headers.get('subject', '(Tanpa Subjek)')
            sender = headers.get('from', 'Unknown')
            date_str = headers.get('date', '')
            snippet = msg.get('snippet', '')

            is_urgent = any(kw in subject.lower() or kw in snippet.lower() for kw in [
                "urgent", "penting", "asap", "segera", "deadline", "tagihan", "action required", "perhatian", "alert"
            ])

            category = "Pekerjaan"
            if any(k in subject.lower() for k in ["invoice", "tagihan", "bank", "transfer", "pembayaran"]):
                category = "Keuangan"
            elif is_urgent:
                category = "Urgent"
            elif any(k in subject.lower() for k in ["newsletter", "promo", "diskon"]):
                category = "Promo"

            action = "Periksa dan tanggapi segera hari ini" if is_urgent else "Tinjau atau arsipkan bila perlu"

            items.append(EmailItem(
                id=msg_id,
                sender=sender[:45],
                subject=subject,
                date=date_str[:25] if date_str else datetime.now().strftime("%d %b %H:%M"),
                snippet=snippet[:180],
                is_urgent=is_urgent,
                category=category,
                suggested_action=action
            ))

        return items

    def _decode_mime_words(self, s: str) -> str:
        if not s:
            return ""
        decoded_fragments = decode_header(s)
        text_pieces = []
        for fragment, encoding in decoded_fragments:
            if isinstance(fragment, bytes):
                try:
                    text_pieces.append(fragment.decode(encoding or "utf-8", errors="ignore"))
                except Exception:
                    text_pieces.append(fragment.decode("latin1", errors="ignore"))
            else:
                text_pieces.append(str(fragment))
        return "".join(text_pieces)

    def _extract_body_snippet(self, msg) -> str:
        body = ""
        try:
            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    content_disp = str(part.get("Content-Disposition"))
                    if content_type == "text/plain" and "attachment" not in content_disp:
                        payload = part.get_payload(decode=True)
                        if payload:
                            charset = part.get_content_charset() or "utf-8"
                            body = payload.decode(charset, errors="ignore")
                            break
            else:
                payload = msg.get_payload(decode=True)
                if payload:
                    charset = msg.get_content_charset() or "utf-8"
                    body = payload.decode(charset, errors="ignore")
        except Exception:
            pass
        if body:
            clean = re.sub(r'\s+', ' ', body).strip()
            return clean[:200]
        return ""

    def _fetch_real_imap(self) -> List[EmailItem]:
        items: List[EmailItem] = []
        mail = imaplib.IMAP4_SSL(settings.IMAP_SERVER, settings.IMAP_PORT, timeout=15)
        mail.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
        mail.select("INBOX")
        
        status, response = mail.search(None, "UNSEEN")
        if status != "OK" or not response[0] or len(response[0].split()) == 0:
            status, response = mail.search(None, "ALL")
            
        email_ids = response[0].split()
        latest_ids = email_ids[-8:]
        latest_ids.reverse()
        
        for e_id in latest_ids:
            try:
                res, data = mail.fetch(e_id, "(RFC822)")
                if res != "OK" or not data or not data[0]:
                    continue
                raw_email = data[0][1]
                msg = email.message_from_bytes(raw_email)
                
                subject = self._decode_mime_words(msg.get("Subject", "(Tanpa Subjek)"))
                sender = self._decode_mime_words(msg.get("From", "Unknown"))
                date_str = msg.get("Date", "")
                snippet = self._extract_body_snippet(msg)
                if not snippet:
                    snippet = f"Pesan dari {sender} mengenai {subject}"
                
                is_urgent = any(kw in subject.lower() or kw in snippet.lower() for kw in [
                    "urgent", "penting", "asap", "segera", "deadline", "tagihan", "alert", "action required"
                ])
                
                category = "Pekerjaan"
                if "invoice" in subject.lower() or "tagihan" in subject.lower() or "bank" in sender.lower():
                    category = "Keuangan"
                elif is_urgent:
                    category = "Urgent"
                elif "newsletter" in subject.lower() or "promo" in subject.lower():
                    category = "Promo"
                
                action = "Periksa dan tanggapi segera hari ini" if is_urgent else "Arsipkan atau baca saat senggang"
                
                items.append(EmailItem(
                    id=e_id.decode() if isinstance(e_id, bytes) else str(e_id),
                    sender=sender[:45],
                    subject=subject,
                    date=date_str[:25] if date_str else datetime.now().strftime("%d %b %H:%M"),
                    snippet=snippet,
                    is_urgent=is_urgent,
                    category=category,
                    suggested_action=action
                ))
            except Exception:
                continue
                
        mail.logout()
        return items

    def _get_simulated_inbox(self) -> List[EmailItem]:
        today_str = datetime.now().strftime("%d %b %H:%M")
        return [
            EmailItem(
                id="em-101",
                sender="Budi Santoso <client.partner@agritech.id>",
                subject="[URGENT] Revisi Proposal Kemitraan Strategis & Jadwal Meeting Hari Ini",
                date=today_str,
                snippet="Halo pak, mohon konfirmasi finalisasi poin 3 terkait skema bagi hasil sebelum jam 15:00 WIB agar bisa ditandatangani.",
                is_urgent=True,
                category="Urgent",
                suggested_action="Review klausul bagi hasil poin 3 dan balas konfirmasi sebelum jam 15:00."
            ),
            EmailItem(
                id="em-102",
                sender="Finance Billing <billing@cloudservice.com>",
                subject="Invoice #INV-2026-8812 Telah Terbit - Jatuh Tempo 3 Hari",
                date="Kemarin, 19:40",
                snippet="Tagihan layanan cloud server periode berjalan telah diterbitkan sebesar IDR 1.450.000. Mohon lakukan pembayaran.",
                is_urgent=False,
                category="Keuangan",
                suggested_action="Jadwalkan pelunasan invoice server via auto-debet atau finance sebelum jatuh tempo."
            ),
            EmailItem(
                id="em-103",
                sender="Siti Rahma <pm@agrisensa.io>",
                subject="Undangan Sprint Review & Demo Fitur Multi-Agent Assistant",
                date="Kemarin, 16:15",
                snippet="Rekan-rekan tim, sprint review akan diadakan besok pukul 10:00 WIB di Google Meet. Link meeting terlampir.",
                is_urgent=False,
                category="Pekerjaan",
                suggested_action="Siapkan demo frontend dan progress report modul agent."
            ),
            EmailItem(
                id="em-104",
                sender="Security Alert <no-reply@security.google.com>",
                subject="Pemberitahuan Keamanan Akun: Sesi Login Baru Terdeteksi",
                date="Kemarin, 09:22",
                snippet="Perangkat Windows baru terdeteksi login ke akun Anda dari wilayah Indonesia. Jika ini Anda, abaikan pesan ini.",
                is_urgent=False,
                category="Pemberitahuan",
                suggested_action="Verifikasi perangkat jika merasa tidak melakukan login baru."
            ),
        ]

    async def execute(self, log_cb: Optional[Callable] = None) -> EmailResult:
        # 1. Try Gmail API OAuth first
        if TOKEN_FILE.exists():
            await self.log("Menghubungkan ke Gmail API menggunakan otorisasi Akun Google pribadi Anda...", "running", log_cb)
            try:
                emails = self._fetch_gmail_api()
                source = "real_gmail_oauth"
                await self.log(f"Berhasil mengunduh {len(emails)} email nyata dari inbox Gmail pribadi Anda!", "success", log_cb)
            except Exception as e:
                await self.log(f"Gmail API gagal ({str(e)}). Mengalihkan ke metode alternatif...", "warning", log_cb)
                emails = None
        else:
            emails = None

        # 2. Try IMAP if Gmail API wasn't used or failed
        if emails is None and settings.EMAIL_USER and settings.EMAIL_PASSWORD:
            await self.log(f"Menghubungkan ke server email IMAP ({settings.IMAP_SERVER}) akun {settings.EMAIL_USER}...", "running", log_cb)
            try:
                emails = self._fetch_real_imap()
                source = "real_imap"
                await self.log(f"Berhasil mengunduh {len(emails)} email terkini via IMAP.", "success", log_cb)
            except Exception as e:
                await self.log(f"Koneksi IMAP gagal ({str(e)}).", "warning", log_cb)
                emails = None

        # 3. Fallback to smart simulation
        if emails is None:
            await self.log("Email pribadi belum terhubung. Menampilkan data kotak masuk contoh cerdas.", "info", log_cb)
            emails = self._get_simulated_inbox()
            source = "simulated"

        urgent_count = sum(1 for e in emails if e.is_urgent)
        summary = (
            f"Ditemukan {len(emails)} email terkini, dengan {urgent_count} pesan berstatus URGENT "
            f"yang membutuhkan tindakan cepat sebelum sore ini."
        )

        return EmailResult(
            source=source,
            total_emails=len(emails),
            urgent_count=urgent_count,
            emails=emails,
            summary=summary
        )
