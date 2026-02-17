// ============================================
// PROJECT FILTER - Projects Page
// ============================================

document.addEventListener('projectsRendered', function() {

    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card');

    if (filterButtons.length === 0 || projectCards.length === 0) {
        return; // Exit if not on projects page
    }

    // ============================================
    // FILTER FUNCTIONALITY
    // ============================================
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');

            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            // Filter projects
            filterProjects(filter);
        });
    });

    function filterProjects(category) {
        projectCards.forEach(card => {
            const cardCategory = card.getAttribute('data-category');

            if (category === 'all' || cardCategory === category) {
                // Show card
                card.style.display = 'block';
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'scale(1)';
                }, 10);
            } else {
                // Hide card
                card.style.opacity = '0';
                card.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    card.style.display = 'none';
                }, 300);
            }
        });
    }

    // ============================================
    // PROJECT CARD ANIMATIONS
    // ============================================
    projectCards.forEach((card, index) => {
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

        // Stagger initial animation
        card.style.animationDelay = `${index * 0.1}s`;
    });

    // ============================================
    // SEARCH FUNCTIONALITY (Optional Enhancement)
    // ============================================
    const searchInput = document.getElementById('projectSearch');

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();

            projectCards.forEach(card => {
                const title = card.querySelector('.project-title').textContent.toLowerCase();
                const description = card.querySelector('.project-description').textContent.toLowerCase();
                const tags = Array.from(card.querySelectorAll('.tag')).map(tag => tag.textContent.toLowerCase());

                const matches = title.includes(searchTerm) ||
                               description.includes(searchTerm) ||
                               tags.some(tag => tag.includes(searchTerm));

                if (matches) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    // ============================================
    // PROJECT CARD CLICK (Optional - Modal or Page Navigation)
    // ============================================
    projectCards.forEach(card => {
        card.style.cursor = 'pointer';

        card.addEventListener('click', function() {
            const projectTitle = this.querySelector('.project-title').textContent;

            // Option 1: Navigate to project detail page
            // window.location.href = `project-detail.html?project=${encodeURIComponent(projectTitle)}`;

            // Option 2: Open modal (implement modal later)
            // openProjectModal(projectTitle);

            // For now, just log
            console.log('Clicked project:', projectTitle);

            // You can add this functionality later once you have project detail pages or modals
        });
    });

});
