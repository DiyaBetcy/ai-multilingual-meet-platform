# Deployment Instructions

## Frontend Deployment to Vercel

### Option 1: Using Vercel Web Interface (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Click "Add New..." → "Project"

2. **Import from GitHub**
   - Click "Import Git Repository"
   - Select your ai-multilingual-meet-platform repository
   - Click "Import"

3. **Configure Root Directory**
   - Root Directory: `frontend/vite-project`
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Environment Variables**
   - Click "Environment Variables"
   - Add: `VITE_SERVER_URL` (value will be backend URL after backend deployment)

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Get your Vercel URL: `https://your-app-name.vercel.app`

### Option 2: Using CLI (if CLI works)

```bash
cd frontend/vite-project
npx vercel --prod
```

## Backend Deployment to Railway

1. **Go to Railway Dashboard**
   - Visit: https://railway.app/dashboard
   - Click "New Project" → "Deploy from GitHub repo"

2. **Select Repository**
   - Choose your ai-multilingual-meet-platform repository
   - Set Root Directory: `backend`

3. **Configure Service**
   - Build Command: `npm install`
   - Start Command: `npm start`

4. **Add Environment Variables**
   - `NODE_ENV=production`
   - `SARVAM_API_KEY=sk_xbi0i64z_BihO9CdiDsUV4O19SnvXf9mO`

5. **Deploy**
   - Click "Deploy Now"
   - Get your Railway URL: `https://your-app-name.railway.app`

## Final Steps

1. **Update Frontend Environment Variables**
   - In Vercel dashboard, add:
   ```
   VITE_SERVER_URL=your-backend-name.railway.app
   VITE_WEBRTC_PORT=3001
   VITE_TRANSLATION_PORT=5000
   VITE_ANCHORING_PORT=3002
   ```

2. **Redeploy Frontend**
   - Vercel will automatically redeploy with new environment variables

3. **Test**
   - Frontend: `https://your-app-name.vercel.app`
   - Backend: `https://your-app-name.railway.app`
