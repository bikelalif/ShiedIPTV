/* ==========================================================================
   SHIELDIPTV LANDING PAGE JAVASCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Sticky Navigation Scroll Effect
    const header = document.querySelector('header.site-header');
    
    const handleScroll = () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Run once at load
    
    // 2. Interactive Mock Player Animation Simulation
    const mockCards = document.querySelectorAll('.mock-card');
    let activeIndex = 0;
    
    const cycleMockFocus = () => {
        // Remove focus from all
        mockCards.forEach(card => card.classList.remove('focused'));
        
        // Apply focus to current
        mockCards[activeIndex].classList.add('focused');
        
        // Update index for next iteration
        activeIndex = (activeIndex + 1) % mockCards.length;
    };
    
    // Run cycle every 3.5 seconds
    let cycleInterval = setInterval(cycleMockFocus, 3500);
    
    // Allow manual hover to pause and target specific card
    mockCards.forEach((card, index) => {
        card.addEventListener('mouseenter', () => {
            clearInterval(cycleInterval);
            mockCards.forEach(c => c.classList.remove('focused'));
            card.classList.add('focused');
            activeIndex = index;
        });
        
        card.addEventListener('mouseleave', () => {
            // Restart cycle on leave
            cycleInterval = setInterval(cycleMockFocus, 3500);
        });
    });
    
    // Initialize first focus
    if (mockCards.length > 0) {
        mockCards[0].classList.add('focused');
    }

    // 3. Smooth Anchor Scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 4. Fade-in scroll animations using Intersection Observer
    const animatedElements = document.querySelectorAll('.feature-card, .download-card, .web-cta-card, .preview-text, .preview-mockup-wrapper');
    
    if ('IntersectionObserver' in window) {
        // Set initial invisible styles
        animatedElements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        });
        
        const observerOptions = {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                    observer.unobserve(el);
                }
            });
        }, observerOptions);
        
        animatedElements.forEach(el => {
            observer.observe(el);
        });
    }
});
