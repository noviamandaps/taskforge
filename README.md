# Taskforge

Task manager (workspace, project, board, sprint, komentar, notifikasi) — Next.js 15 + Supabase.

**Arsitektur:** frontend Next.js memanggil Supabase (Auth, Postgres, Storage, Realtime) langsung dari browser. Tidak ada backend server terpisah — cukup 1 deploy di Vercel.

## Prasyarat

- Akun GitHub, Vercel (gratis), Supabase (gratis)
- Node.js 20+ (untuk dev lokal)

## Setup Supabase (backend)

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, jalankan file dari folder `supabase/` **berurutan** (copy-paste → Run):
   1. `schema.sql` — tabel utama + RLS
   2. `profiles.sql` — profiles + trigger auto-create
   3. `phase6.sql` — nomor task, sprint, notifikasi, realtime
   4. `storage.sql` — bucket lampiran gambar
3. **Authentication → Providers → Email**: pastikan aktif (default). Untuk development, matikan "Confirm email" agar langsung login tanpa verifikasi.

## Deploy ke Vercel

1. Push repo ini ke GitHub:

   ```bash
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/<kamu>/taskforge.git
   git push -u origin main
   ```

   (`.env` tidak perlu ikut — sudah ada di `.gitignore`.)

2. Di [vercel.com](https://vercel.com) → **Add New → Project** → import repo tersebut.
3. Framework **Next.js** terdeteksi otomatis — biarkan default. Tambahkan **Environment Variables** (ambil dari Supabase → Project Settings → API):

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/public key kamu |

   `MONGO_URL`, `DB_NAME`, `NEXT_PUBLIC_BASE_URL`, `CORS_ORIGINS` adalah sisa template — **tidak perlu** di-set.
4. **Deploy.** Selesai — frontend + API route dalam 1 deployment.

## Setup terakhir: auth redirect

Supabase harus mengenali domain Vercel kamu, kalau tidak link verifikasi signup akan salah tujuan:

1. Copy domain dari Vercel (mis. `https://taskforge.vercel.app`).
2. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: `https://taskforge.vercel.app`
   - **Redirect URLs**: tambahkan `https://taskforge.vercel.app/**`

Setiap ganti domain / preview URL baru, tambahkan juga ke Redirect URLs.

## Development lokal

```bash
yarn install
```

Isi `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx
```

```bash
yarn dev
```

Buka http://localhost:3000, lalu tambahkan `http://localhost:3000` ke Supabase **Redirect URLs**.

## Catatan

- Dependency `mongodb` di `package.json` tidak dipakai (sisa template) — aman dihapus.
- `output: 'standalone'` di `next.config.js` hanya berguna untuk self-host Docker; Vercel mengabaikannya.
