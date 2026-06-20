// 전역 상태 변수
let currentImgIndex = 0;
let allImages = [];
let isZooming = false;
let startDistance = 0;
let currentScale = 1;
let lastScale = 1;
let animationFrameId = null;
let touchStartX = 0;
let touchEndX = 0;

// 💡 [최적화 1] DOM 요소 캐싱 (미리 찾아두고 계속 재사용하여 연산 최소화)
let cachedModalImg = null;
let cachedMainThumbnails = null;
let cachedModalThumbs = null;
let cachedImg1 = null;
let cachedImg2 = null;

document.addEventListener("DOMContentLoaded", function() {

    // 1. 이미지 프리로딩 실행
    const preloadImages = () => {
        const thumbnails = document.querySelectorAll('.gallery-thumbnail');
        thumbnails.forEach(thumb => {
            const img = new Image();
            img.src = thumb.src;
        });
    };
    preloadImages();

    // 2. 갤러리 메인 데이터 매핑 및 모달 하단 썸네일 노드 동적 생성
    cachedMainThumbnails = document.querySelectorAll('.gallery-thumbnail');
    allImages = Array.from(cachedMainThumbnails).map(thumb => thumb.src);
    cachedImg1 = document.getElementById('mainImage1');
    cachedImg2 = document.getElementById('mainImage2');
    
    const modalThumbContainer = document.getElementById('modalThumbContainer');
    if (modalThumbContainer) {
        // DocumentFragment를 사용하여 DOM 삽입을 한 번에 처리 (렌더링 부하 감소)
        const fragment = document.createDocumentFragment();
        allImages.forEach((src, idx) => {
            const img = document.createElement('img');
            img.src = src;
            img.className = idx === 0 ? 'modal-thumb active' : 'modal-thumb';
            
            img.addEventListener('click', function() {
                jumpToModalImage(idx);
            });
            fragment.appendChild(img);
        });
        modalThumbContainer.appendChild(fragment);
        // 생성 후 모달 썸네일 노드 리스트 캐싱
        cachedModalThumbs = document.querySelectorAll('.modal-thumb');
    }

    // 3. D-Day 계산 로직
    const weddingDate = new Date('2026-09-19');
    const today = new Date();
    const diffTime = weddingDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const dDayElement = document.getElementById('dDay');
    if (dDayElement) {
        if (diffDays > 0) dDayElement.innerText = `D - ${diffDays}`;
        else if (diffDays === 0) dDayElement.innerText = `D-Day`;
        else dDayElement.innerText = `D + ${Math.abs(diffDays)}`;
    }

    // 4. 계좌번호 기능 인터랙션
    document.querySelectorAll('.btn-view').forEach(button => {
        button.addEventListener('click', function() {
            const accountItem = this.closest('.account-item');
            const numberDiv = accountItem.querySelector('.account-number');
            numberDiv.classList.toggle('show');
            this.innerText = numberDiv.classList.contains('show') ? '숨기기' : '계좌번호 보기';
        });
    });

    document.querySelectorAll('.btn-copy').forEach(button => {
        button.addEventListener('click', function() {
            const accountItem = this.closest('.account-item');
            const textToCopy = accountItem.querySelector('.account-number').textContent;
            const accountNumberMatch = textToCopy.match(/[\d-]+/);
            if (accountNumberMatch) {
                const cleanAccountNumber = accountNumberMatch[0].replace(/-/g, '');
                navigator.clipboard.writeText(cleanAccountNumber).then(() => {
                    const originalText = this.innerText;
                    this.innerText = '복사 완료 ✓';
                    setTimeout(() => { this.innerText = originalText; }, 2000);
                });
            }
        });
    });

    // 5. 메인 갤러리 썸네일 교차 페이드 인터랙션
    let isImg1Active = true;
    cachedMainThumbnails.forEach(thumb => {
        thumb.addEventListener('click', function() {
            const targetImg = isImg1Active ? cachedImg2 : cachedImg1;
            const currentImg = isImg1Active ? cachedImg1 : cachedImg2;

            targetImg.src = this.src;
            currentImg.classList.remove('active');
            targetImg.classList.add('active');

            isImg1Active = !isImg1Active;

            cachedMainThumbnails.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // 💡 [최적화 2] Intersection Observer 메모리 누수 방지
    const observer = new IntersectionObserver((entries, observerInstance) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // 요소가 화면에 나타나면 즉시 관찰 해제 (불필요한 스크롤 연산 억제)
                observerInstance.unobserve(entry.target); 
            }
        });
    });
    document.querySelectorAll('.fade-in-up').forEach((el) => observer.observe(el));

    // 💡 [최적화 3] 스크롤 이벤트 스로틀링 (Scroll Throttling)
    const endWrap = document.querySelector('.end-wrap');
    if (endWrap) {
        let isTicking = false;
        window.addEventListener('scroll', () => {
            if (!isTicking) {
                window.requestAnimationFrame(() => {
                    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50) {
                        endWrap.classList.add('active');
                    }
                    isTicking = false;
                });
                isTicking = true;
            }
        }, { passive: true });
    }

    // 8. 모바일 터치 스와이프 제스처 이벤트 리스너 정의
    const modalContentWrap = document.querySelector('.modal-content-wrap');
    if (modalContentWrap) {
        modalContentWrap.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        modalContentWrap.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
    }

    // 9. 고성능 핀치 줌 최적화 이벤트 리스너 정의
    cachedModalImg = document.getElementById('modalImage');
    if (modalContentWrap && cachedModalImg) {
        modalContentWrap.addEventListener('touchstart', function(e) {
            if (e.touches.length === 2) {
                isZooming = true;
                startDistance = getTouchDistance(e.touches[0], e.touches[1]);
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
            }
        }, { passive: true });

        modalContentWrap.addEventListener('touchmove', function(e) {
            if (!isZooming || e.touches.length !== 2) return;
            
            if (!animationFrameId) {
                animationFrameId = requestAnimationFrame(() => {
                    const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
                    const scaleFactor = currentDistance / startDistance;
                    
                    currentScale = Math.min(Math.max(lastScale * scaleFactor, 1), 3);
                    cachedModalImg.style.transform = `scale(${currentScale}) translateZ(0)`;
                    animationFrameId = null;
                });
            }
            if (currentScale > 1) e.preventDefault();
        }, { passive: false });

        modalContentWrap.addEventListener('touchend', function(e) {
            if (isZooming) {
                lastScale = currentScale;
                if (e.touches.length < 2) {
                    isZooming = false;
                    if (animationFrameId) {
                        cancelAnimationFrame(animationFrameId);
                        animationFrameId = null;
                    }
                    if (currentScale < 1.1) resetZoom();
                }
            }
        }, { passive: true });
    }
});

function scrollGallery(direction) {
    const container = document.getElementById('thumbContainer');
    if (container) {
        container.scrollBy({ left: direction * 200, behavior: 'smooth' });
    }
}

function openModal() {
    const activeThumb = document.querySelector('.gallery-thumbnail.active');
    currentImgIndex = Array.from(cachedMainThumbnails).indexOf(activeThumb);
    if (currentImgIndex === -1) currentImgIndex = 0;

    updateModalUI();
    
    const modal = document.getElementById('photoModal');
    if (modal) {
        document.body.classList.add('modal-open');
        modal.style.display = 'flex';
        setTimeout(() => { modal.classList.add('open'); }, 10); 
    }
}

function closeModal() {
    const modal = document.getElementById('photoModal');
    if (modal) {
        modal.classList.remove('open');
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }, 400); 
    }
}

function moveModalImage(direction) {
    if (!cachedModalImg) return;
    
    const outClass = direction === 1 ? 'fade-out-next' : 'fade-out-prev';
    cachedModalImg.classList.add(outClass);

    setTimeout(() => {
        currentImgIndex += direction;
        if (currentImgIndex >= allImages.length) currentImgIndex = 0;
        if (currentImgIndex < 0) currentImgIndex = allImages.length - 1;

        updateModalUI();
        cachedModalImg.className = 'fade-in-active';
        setTimeout(() => { cachedModalImg.className = ''; }, 50);
    }, 200);
}

function jumpToModalImage(index) {
    if (currentImgIndex === index || !cachedModalImg) return;
    cachedModalImg.style.opacity = '0';
    setTimeout(() => {
        currentImgIndex = index;
        updateModalUI();
        cachedModalImg.style.opacity = '1';
    }, 150);
}

// 💡 [최적화 4] UI 업데이트 함수 성능 향상 (DOM 탐색 제거)
function updateModalUI() {
    resetZoom();
    if (cachedModalImg) cachedModalImg.src = allImages[currentImgIndex];

    if (cachedModalThumbs) {
        cachedModalThumbs.forEach((t, idx) => {
            if (idx === currentImgIndex) {
                t.classList.add('active');
                t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                t.classList.remove('active');
            }
        });
    }

    if (cachedMainThumbnails && cachedMainThumbnails[currentImgIndex]) {
        const activeImg = cachedImg1.classList.contains('active') ? cachedImg1 : cachedImg2;
        if (activeImg) activeImg.src = allImages[currentImgIndex];
        
        cachedMainThumbnails.forEach(t => t.classList.remove('active'));
        cachedMainThumbnails[currentImgIndex].classList.add('active');
    }
}

function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    const minSwipeDistance = 50;
    if (swipeDistance < -minSwipeDistance) {
        moveModalImage(1);
    } else if (swipeDistance > minSwipeDistance) {
        moveModalImage(-1);
    }
}

function getTouchDistance(touch1, touch2) {
    const dx = touch1.screenX - touch2.screenX;
    const dy = touch1.screenY - touch2.screenY;
    return Math.sqrt(dx * dx + dy * dy);
}

function resetZoom() {
    if (cachedModalImg) {
        cachedModalImg.style.transition = 'transform 0.25s ease-out, opacity 0.2s ease';
        cachedModalImg.style.transform = 'scale(1) translateZ(0)';
        currentScale = 1;
        lastScale = 1;
    }
}