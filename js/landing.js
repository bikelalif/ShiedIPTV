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

    // 5. TV Remote Control Spatial Navigation
    const isTvWrapper = window.cordova || 
                        window.location.protocol === 'file:' || 
                        /SmartTV|GoogleTV|AppleTV|AndroidTV|webOS|webOSTV|Tizen/i.test(navigator.userAgent) ||
                        (window.innerWidth === 1920 && window.innerHeight === 1080);
                        
    if (isTvWrapper) {
        document.body.classList.add("tv-mode");
        
        // Auto-focus first focusable element
        setTimeout(() => {
            focusFirst();
        }, 1200);
        
        setupSpatialNavigation();
    }
    
    function setupSpatialNavigation() {
        window.addEventListener("keydown", (e) => {
            const key = e.key;
            
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
                const active = document.activeElement;
                if (!active || active === document.body || !active.classList.contains("focusable")) {
                    e.preventDefault();
                    focusFirst();
                    return;
                }
            }
            
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                e.preventDefault();
                const direction = key.replace('Arrow', '').toLowerCase();
                moveFocus(direction);
            } else if (key === 'Enter') {
                const active = document.activeElement;
                if (active && active.classList.contains("focusable")) {
                    e.preventDefault();
                    active.click();
                }
            }
        });
    }

    function focusFirst() {
        const first = document.querySelector('.focusable');
        if (first) {
            first.focus();
            first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function moveFocus(direction) {
        const active = document.activeElement;
        if (!active || !active.classList.contains('focusable')) {
            focusFirst();
            return;
        }
        
        const candidates = Array.from(document.querySelectorAll('.focusable'));
        const activeRect = active.getBoundingClientRect();
        let bestCandidate = null;
        let minDistance = Infinity;
        
        candidates.forEach(candidate => {
            if (candidate === active) return;
            
            const rect = candidate.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            
            const centerActive = {
                x: activeRect.left + activeRect.width / 2,
                y: activeRect.top + activeRect.height / 2
            };
            
            const centerCandidate = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            
            const deltaX = centerCandidate.x - centerActive.x;
            const deltaY = centerCandidate.y - centerActive.y;
            
            const overlapX = (rect.left < activeRect.right && rect.right > activeRect.left);
            const overlapY = (rect.top < activeRect.bottom && rect.bottom > activeRect.top);
            
            const effDeltaX = overlapX ? deltaX * 0.1 : deltaX;
            const effDeltaY = overlapY ? deltaY * 0.1 : deltaY;
            
            let isDirectional = false;
            let distance = 0;
            const margin = 2;
            
            if (direction === 'left') {
                isDirectional = (centerCandidate.x < centerActive.x - margin);
                distance = Math.abs(deltaX) + Math.abs(effDeltaY) * 2.5; 
            } else if (direction === 'right') {
                isDirectional = (centerCandidate.x > centerActive.x + margin);
                distance = Math.abs(deltaX) + Math.abs(effDeltaY) * 2.5;
            } else if (direction === 'up') {
                isDirectional = (centerCandidate.y < centerActive.y - margin);
                distance = Math.abs(deltaY) + Math.abs(effDeltaX) * 2.5;
            } else if (direction === 'down') {
                isDirectional = (centerCandidate.y > centerActive.y + margin);
                distance = Math.abs(deltaY) + Math.abs(effDeltaX) * 2.5;
            }
            
            if (isDirectional && distance < minDistance) {
                minDistance = distance;
                bestCandidate = candidate;
            }
        });
        
        if (bestCandidate) {
            bestCandidate.focus();
            bestCandidate.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }
    }
});

