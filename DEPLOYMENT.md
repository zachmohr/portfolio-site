# Deployment Guide - zachmohr.work

Step-by-step guide to deploy your portfolio to Cloudflare Pages with your custom domain.

## Prerequisites Checklist

- [ ] GitHub account
- [ ] Cloudflare account (you have this!)
- [ ] Domain: zachmohr.work (registered in Cloudflare)
- [ ] Portfolio site files ready
- [ ] Git installed on your computer

## Step 1: Initialize Git Repository

Open Terminal and run:

```bash
cd ~/Documents/portfolio-site
git init
git add .
git commit -m "Initial commit - Zach Mohr portfolio site"
```

## Step 2: Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `portfolio` (or any name you prefer)
3. Description: "Personal portfolio website"
4. **Don't** check "Initialize with README" (we already have one)
5. Click "Create repository"

## Step 3: Push to GitHub

GitHub will show you commands. Use these (replace YOUR_USERNAME):

```bash
git remote add origin https://github.com/YOUR_USERNAME/portfolio.git
git branch -M main
git push -u origin main
```

If prompted, log in with your GitHub credentials.

## Step 4: Connect Cloudflare Pages

1. **Log into Cloudflare**
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com)
   - Sign in

2. **Navigate to Workers & Pages**
   - From the left sidebar, click "Workers & Pages"
   - Or go directly to your domain and find Workers & Pages

3. **Create Application**
   - Click "Create application"
   - Choose "Pages" tab
   - Click "Connect to Git"

4. **Connect GitHub**
   - Click "Connect GitHub"
   - Authorize Cloudflare to access your repositories
   - Select your portfolio repository

5. **Configure Build Settings**
   ```
   Project name: zach-mohr-portfolio (or any name)
   Production branch: main
   Build command: (leave blank - no build needed!)
   Build output directory: / (root directory)
   ```

6. **Environment Variables**
   - None needed for now
   - Click "Save and Deploy"

7. **Wait for Deployment**
   - First deployment takes 1-2 minutes
   - You'll see a temporary URL: `zach-mohr-portfolio.pages.dev`
   - Test this URL first!

## Step 5: Set Custom Domain

1. **In Cloudflare Pages Project**
   - Go to your project settings
   - Click "Custom domains" tab

2. **Add zachmohr.work**
   - Click "Set up a custom domain"
   - Enter: `zachmohr.work`
   - Click "Continue"

3. **Auto DNS Configuration**
   - Cloudflare automatically configures DNS
   - Your domain is already in Cloudflare, so this is instant!
   - It will add a CNAME record pointing to your Pages site

4. **Add www Subdomain (Optional)**
   - Add `www.zachmohr.work` as another custom domain
   - Set up redirect from www to root domain

5. **Wait for SSL Certificate**
   - Cloudflare automatically provisions SSL/HTTPS
   - Takes 1-5 minutes
   - Your site will be live at `https://zachmohr.work`

## Step 6: Verify Deployment

1. **Visit Your Site**
   - Go to `https://zachmohr.work`
   - Check all pages load correctly
   - Test navigation and forms

2. **Check Mobile**
   - Open on your phone
   - Verify responsive design works

3. **Test Performance**
   - Use [PageSpeed Insights](https://pagespeed.web.dev/)
   - Should score 90+ on all metrics

## Step 7: Set Up R2 for Large Assets

Only needed when you have large images/videos to host:

1. **Create R2 Bucket**
   - Cloudflare Dashboard → R2 Object Storage
   - Click "Create bucket"
   - Name: `portfolio-assets`
   - Click "Create bucket"

2. **Configure Public Domain**
   - In bucket settings
   - Click "Settings" → "Public access"
   - Enable "Allow access"
   - Add custom domain: `assets.zachmohr.work`

3. **Update DNS**
   - Cloudflare auto-creates DNS record
   - Verify `assets.zachmohr.work` resolves

4. **Upload Files**

   **Option A - Dashboard (Easy):**
   - Click "Upload" in R2 dashboard
   - Drag and drop files
   - Organize in folders

   **Option B - Wrangler CLI (Advanced):**
   ```bash
   npm install -g wrangler
   wrangler login
   wrangler r2 object put portfolio-assets/projects/toilet-holder/hero.jpg --file ./hero.jpg
   ```

5. **Update HTML**
   - Change image src to R2 URLs:
   ```html
   <img src="https://assets.zachmohr.work/projects/toilet-holder/hero.jpg">
   ```

## Updating Your Site

### Making Changes

1. **Edit files locally**
   - Make changes to HTML/CSS/JS
   - Test in your browser

2. **Commit and push**
   ```bash
   git add .
   git commit -m "Description of changes"
   git push
   ```

3. **Automatic Deployment**
   - Cloudflare Pages automatically detects the push
   - Rebuilds and deploys in 1-2 minutes
   - Your site at zachmohr.work updates automatically!

### Rolling Back

If something breaks:

1. Go to Cloudflare Pages dashboard
2. Click "Deployments"
3. Find the previous working deployment
4. Click "..." → "Rollback to this deployment"

## Cost Breakdown

**Cloudflare Pages:**
- Hosting: FREE
- Bandwidth: FREE (unlimited!)
- SSL Certificate: FREE
- Automatic deployments: FREE

**Cloudflare R2:**
- Storage: $0.015/GB/month (first 10GB free)
- Class A Operations: $4.50/million (first 1M free/month)
- Class B Operations: $0.36/million (first 10M free/month)
- No egress fees!

**Expected monthly cost: $0 - $5**

## Troubleshooting

### Site not loading
- Check DNS propagation: [whatsmydns.net](https://www.whatsmydns.net/)
- Wait 5-10 minutes for DNS to update
- Clear browser cache

### Images not showing
- Check file paths are correct
- Verify images are in `assets/images/` folder
- Check R2 bucket permissions if using R2

### Form not working
- Update Formspree ID in contact.html
- Check Formspree dashboard for submissions

### Deployment failed
- Check GitHub repository is accessible
- Verify no syntax errors in HTML/CSS/JS
- Check Cloudflare Pages deployment logs

## Next Steps

After deployment:

1. **Add to Resume/LinkedIn**
   - Update your resume with zachmohr.work
   - Add link to LinkedIn profile

2. **Get Feedback**
   - Share with friends/colleagues
   - Ask for honest feedback on design and content

3. **Analytics** (Optional)
   - Cloudflare Web Analytics (free, privacy-friendly)
   - Go to Cloudflare dashboard → Web Analytics

4. **SEO** (Optional)
   - Add `sitemap.xml`
   - Submit to Google Search Console
   - Add Open Graph meta tags

5. **Monitor Performance**
   - Check Cloudflare Analytics
   - Monitor form submissions
   - Track which projects get the most attention

## Support

If you run into issues:
- Cloudflare Docs: [developers.cloudflare.com/pages](https://developers.cloudflare.com/pages/)
- Cloudflare Community: [community.cloudflare.com](https://community.cloudflare.com/)
- Or reach out to me for help!

---

**You're all set!** 🚀

Your portfolio will be live at **https://zachmohr.work**
