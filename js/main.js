// ============================================
// MAIN JAVASCRIPT - Zach Mohr Portfolio
// ============================================

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {

    // ============================================
    // ROTATING HERO WORD
    // ============================================
    const rotatingWords = [
        'Engineer',
        'Designer',
        'Maker',
        'Welder',
        'Woodworker',
        'Builder',
        'Inventor',
        'Fabricator',
        'Entrepreneur',
        'Roboticist'
    ];

    const FADE_DURATION_MS = 400;  // matches CSS transition: opacity 0.4s
    const ROTATION_INTERVAL_MS = 2500;

    const rotatingWordEl = document.getElementById('rotating-word');

    function fitWordToContainer(el) {
        el.style.fontSize = ''; // reset inline override, fall back to CSS clamp()
        void el.offsetWidth; // force reflow at default size

        // el.parentElement.clientWidth can expand with content (CSS Grid min-content blowout),
        // so constrain against the true viewport width minus the hero section's padding.
        const heroSection = el.closest('.hero');
        const paddingInline = heroSection
            ? parseFloat(getComputedStyle(heroSection).paddingLeft) + parseFloat(getComputedStyle(heroSection).paddingRight)
            : 0;
        const available = document.documentElement.clientWidth - paddingInline;

        if (el.scrollWidth > available) {
            const currentSize = parseFloat(getComputedStyle(el).fontSize);
            el.style.fontSize = Math.floor(currentSize * (available / el.scrollWidth) * 0.97) + 'px';
        }
    }

    if (rotatingWordEl) {
        let wordIndex = 0;

        fitWordToContainer(rotatingWordEl);

        window.addEventListener('resize', function() {
            fitWordToContainer(rotatingWordEl);
        });

        setInterval(function() {
            wordIndex = (wordIndex + 1) % rotatingWords.length;
            rotatingWordEl.classList.add('fade-out');

            setTimeout(function() {
                rotatingWordEl.textContent = rotatingWords[wordIndex];
                fitWordToContainer(rotatingWordEl);
                rotatingWordEl.classList.remove('fade-out');
            }, FADE_DURATION_MS);
        }, ROTATION_INTERVAL_MS);
    }

    // ============================================
    // SMOOTH SCROLLING
    // ============================================
    const navLinks = document.querySelectorAll('a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            // Only handle internal links
            if (href !== '#' && href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);

                if (target) {
                    const navHeight = document.querySelector('.nav').offsetHeight;
                    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // ============================================
    // FADE IN ON SCROLL
    // ============================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    // Add fade-in class to elements you want to animate
    const fadeElements = document.querySelectorAll('.capability-card, .project-card, .about-description');
    fadeElements.forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });

    // Re-observe dynamically rendered project cards
    document.addEventListener('projectsRendered', function() {
        const newCards = document.querySelectorAll('.project-card:not(.fade-in)');
        newCards.forEach(el => {
            el.classList.add('fade-in');
            observer.observe(el);
        });
    });

    // ============================================
    // ACTIVE NAV LINK ON SCROLL
    // ============================================
    const sections = document.querySelectorAll('section[id]');

    function highlightNavOnScroll() {
        const scrollY = window.pageYOffset;

        sections.forEach(section => {
            const sectionHeight = section.offsetHeight;
            const sectionTop = section.offsetTop - 100;
            const sectionId = section.getAttribute('id');
            const navLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);

            if (navLink && scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                navLink.classList.add('active');
            }
        });
    }

    window.addEventListener('scroll', highlightNavOnScroll);

    // ============================================
    // HIDE SCROLL INDICATOR ON SCROLL
    // ============================================
    const scrollIndicator = document.querySelector('.scroll-indicator');

    if (scrollIndicator) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 100) {
                scrollIndicator.style.opacity = '0';
            } else {
                scrollIndicator.style.opacity = '0.7';
            }
        });
    }

    // ============================================
    // FORM SUBMISSION (Contact Page)
    // ============================================
    const contactForm = document.getElementById('contactForm');

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            // If using Formspree or similar service, let the form submit naturally
            // Otherwise, handle with custom logic here

            // Example: Show success message
            // e.preventDefault();
            // alert('Message sent! I\'ll get back to you soon.');
            // contactForm.reset();
        });
    }

    // ============================================
    // MOBILE MENU TOGGLE (if you want to add one later)
    // ============================================
    const mobileMenuButton = document.querySelector('.mobile-menu-button');
    const navMenu = document.querySelector('.nav-menu');

    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            this.classList.toggle('active');
        });
    }

    // ============================================
    // CURSOR TRAIL EFFECT (Optional - Retro Futurism)
    // ============================================
    let cursorTrail = [];
    const trailLength = 20;

    document.addEventListener('mousemove', function(e) {
        cursorTrail.push({ x: e.clientX, y: e.clientY });

        if (cursorTrail.length > trailLength) {
            cursorTrail.shift();
        }
    });

    // ============================================
    // PARALLAX SCROLL (Disabled - using Three.js scene)
    // ============================================
    // Three.js scene handles its own animations

    // ============================================
    // CONSOLE MESSAGE (Easter Egg)
    // ============================================
    console.log('%cHey there! 👋', 'font-size: 20px; font-weight: bold; color: #E63946;');
    console.log('%cLike what you see? Let\'s build something together.', 'font-size: 14px; color: #F5F5F0;');
    console.log('%cEmail: zmohr026@gmail.com', 'font-size: 12px; color: #E63946;');

});

// ============================================
// PRELOADER (Optional)
// ============================================
window.addEventListener('load', function() {
    document.body.classList.add('loaded');
});
