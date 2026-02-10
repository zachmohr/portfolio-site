# Zach Mohr Portfolio Website

A portfolio website showcasing mechanical engineering, product development, and design work. Built with a unique aesthetic combining Swiss design principles, retro-futurism, and dithering effects.

## Design Philosophy

**"Swiss Precision Meets Retro Future"**
- Clean, grid-based layouts (Swiss design)
- Dithering effects for texture and nostalgia
- Geometric shapes and bold typography (retro-futurism)
- Minimalist with intentional moments of visual surprise

## Color Palette

### Primary Colors
- `#0A0A0A` - Rich Black (background)
- `#F5F5F0` - Warm White (text, backgrounds)
- `#E63946` - Electric Red (primary accent)
- `#FF4757` - Light Red (hover states)

### Subtle Accents (used sparingly)
- `#FF006E` - Hot Pink
- `#FFB703` - Atomic Orange

**Design Focus:** Clean black, white, and red color scheme with Swiss precision

## Typography

- **Headings**: Space Grotesk (Swiss modernism)
- **Body**: IBM Plex Mono (technical precision)
- **Display**: Orbitron (retro-futurism)

All fonts are loaded from Google Fonts.

## Project Structure

```
portfolio-site/
├── index.html              # Homepage
├── projects.html           # Projects showcase
├── contact.html            # Contact page
├── css/
│   ├── main.css           # Core styles & layout
│   ├── typography.css     # Font styles & hierarchy
│   └── dithering.css      # Visual effects
├── js/
│   ├── main.js            # Main functionality
│   └── project-filter.js  # Project filtering
├── assets/
│   ├── images/            # Your project images
│   ├── fonts/             # Custom fonts (if any)
│   └── icons/             # Icons and graphics
└── projects/              # Project data and assets
```

## Setup & Development

### Option 1: Simple HTML (No Build Tools)

1. Clone or download this repository
2. Open `index.html` in your browser
3. Edit HTML/CSS/JS files directly
4. No build process needed!

### Option 2: With Live Server (Recommended)

1. Install [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code
2. Right-click `index.html` and select "Open with Live Server"
3. Changes will auto-reload in the browser

### Adding Your Content

#### 1. Update Personal Information
- Edit contact info in all HTML files (email, phone)
- Replace placeholder text in About section
- Add your photo to `assets/images/` and update the path in `index.html`

#### 2. Add Project Images
- Create folders in `assets/images/projects/` for each project
- Replace `.project-image-placeholder` divs with actual images:
  ```html
  <img src="assets/images/projects/your-project/hero.jpg" alt="Project Name">
  ```

#### 3. Customize Projects
- Edit project details in `projects.html`
- Add/remove project cards as needed
- Update tags and categories

#### 4. Setup Contact Form
The contact form uses [Formspree](https://formspree.io/) (free):
1. Sign up at formspree.io
2. Create a new form
3. Copy your form endpoint
4. Update the `action` attribute in `contact.html`:
   ```html
   <form action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
   ```

## Deployment to Cloudflare Pages

### Prerequisites
- GitHub account
- Cloudflare account (you already have one with your domain)

### Steps

1. **Initialize Git Repository**
   ```bash
   cd ~/Documents/portfolio-site
   git init
   git add .
   git commit -m "Initial commit - portfolio site"
   ```

2. **Create GitHub Repository**
   - Go to github.com and create a new repository
   - Name it `portfolio` or similar
   - Don't initialize with README (we already have one)

3. **Push to GitHub**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/portfolio.git
   git branch -M main
   git push -u origin main
   ```

4. **Connect to Cloudflare Pages**
   - Log into Cloudflare Dashboard
   - Go to Workers & Pages
   - Click "Create application" → "Pages" → "Connect to Git"
   - Select your GitHub repository
   - Configure build settings:
     - Build command: (leave blank)
     - Build output directory: `/`
   - Click "Save and Deploy"

5. **Set Custom Domain**
   - In Cloudflare Pages project settings
   - Go to "Custom domains"
   - Add `zachmohr.work`
   - Cloudflare will auto-configure DNS

### Setting Up Cloudflare R2 for Assets

For large images and videos:

1. **Create R2 Bucket**
   - Cloudflare Dashboard → R2 Object Storage
   - Create bucket: `portfolio-assets`

2. **Configure Public Access**
   - Enable custom domain
   - Set subdomain: `assets.zachmohr.work`

3. **Upload Assets**
   - Use Cloudflare Dashboard (drag & drop)
   - Or use Wrangler CLI:
     ```bash
     npm install -g wrangler
     wrangler r2 object put portfolio-assets/path/to/file.jpg --file ./file.jpg
     ```

4. **Reference in HTML**
   ```html
   <img src="https://assets.zachmohr.work/projects/project-name/image.jpg" alt="Project">
   ```

## Customization Tips

### Changing Colors
Edit CSS variables in `css/main.css`:
```css
:root {
    --color-black: #0A0A0A;
    --color-white: #F5F5F0;
    --color-red: #E63946;
    /* etc. */
}
```

### Adjusting Dithering Effects
Modify intensity in `css/dithering.css`:
- Change `rgba()` opacity values
- Adjust animation speeds
- Enable/disable effects by removing classes

### Adding New Pages
1. Copy an existing HTML file
2. Update navigation links
3. Add corresponding CSS if needed
4. Link in navigation menu

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Loads in < 2 seconds
- Lighthouse score target: 90+
- Mobile-first responsive design
- Optimized for Cloudflare's edge network

## Credits

- Design & Development: Zach Mohr
- Fonts: [Google Fonts](https://fonts.google.com/)
- Icons: Custom SVG (inline)

## License

© 2026 Zach Mohr. All rights reserved.

---

**Questions?** Contact me at zmohr026@gmail.com
