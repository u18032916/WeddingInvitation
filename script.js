let currentImgIndex = 0;
let allImages = [];

// 💡 줌 & 드래그 상태 관리 변수
let isZooming = false;
let isDragging = false;
let startDistance = 0;
let currentScale = 1;
let lastScale = 1;
let translateX = 0, translateY = 0;
let lastTranslateX = 0, lastTranslateY = 0;
let dragStartX = 0, dragStartY = 0;

let animationFrameId = null;
let touchStartX = 0;
let touchEndX = 0;

// DOM 캐싱
let cachedModalImg = null;
let cachedMainThumbnails = null;
let cachedModalThumbs = null;
let cachedImg1 = null;
let cachedImg2 = null;

document.addEventListener("DOMContentLoaded", function() {

    // 2. 이미지 프리로딩
    const thumbnails = document.querySelectorAll('.gallery-thumbnail');
    thumbnails.forEach(thumb => {
        const img = new Image(); img.src = thumb.src;
    });

    // 3. 갤러리 썸네일 매핑 및 동적 생성
    cachedMainThumbnails = document.querySelectorAll('.gallery-thumbnail');
    allImages = Array.from(cachedMainThumbnails).map(thumb => thumb.src);
    cachedImg1 = document.getElementById('mainImage1');
    cachedImg2 = document.getElementById('mainImage2');
    
    const modalThumbContainer = document.getElementById('modalThumbContainer');
    if (modalThumbContainer) {
        const fragment = document.createDocumentFragment();
        allImages.forEach((src, idx) => {
            const img = document.createElement('img');
            img.src = src;
            img.className = idx === 0 ? 'modal-thumb active' : 'modal-thumb';
            img.addEventListener('click', () => jumpToModalImage(idx));
            fragment.appendChild(img);
        });
        modalThumbContainer.appendChild(fragment);
        cachedModalThumbs = document.querySelectorAll('.modal-thumb');
    }

    // 4. D-Day 및 기타 인터랙션 (계좌, 스크롤 애니메이션 등)
    const weddingDate = new Date('2026-09-19');
    const diffDays = Math.ceil((weddingDate - new Date()) / (1000 * 60 * 60 * 24));
    const dDayElement = document.getElementById('dDay');
    if (dDayElement) {
        dDayElement.innerText = diffDays > 0 ? `D - ${diffDays}` : (diffDays === 0 ? `D-Day` : `D + ${Math.abs(diffDays)}`);
    }

    document.querySelectorAll('.btn-view').forEach(button => {
        button.addEventListener('click', function() {
            const numberDiv = this.closest('.account-item').querySelector('.account-number');
            numberDiv.classList.toggle('show');
            this.innerText = numberDiv.classList.contains('show') ? '숨기기' : '계좌번호 보기';
        });
    });

    document.querySelectorAll('.btn-copy').forEach(button => {
        button.addEventListener('click', function() {
            const text = this.closest('.account-item').querySelector('.account-number').textContent;
            const match = text.match(/[\d-]+/);
            if (match) {
                navigator.clipboard.writeText(match[0].replace(/-/g, '')).then(() => {
                    const orig = this.innerText;
                    this.innerText = '복사 완료 ✓';
                    setTimeout(() => { this.innerText = orig; }, 2000);
                });
            }
        });
    });

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

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                obs.unobserve(entry.target);
            }
        });
    });
    document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));

    // 💡 5. 모바일 터치 제스처 (확대/축소 끊김 현상 완벽 해결 최적화 버전)
    const modalContentWrap = document.querySelector('.modal-content-wrap');
    cachedModalImg = document.getElementById('modalImage');

    if (modalContentWrap && cachedModalImg) {
        modalContentWrap.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) {
                if (currentScale > 1) {
                    isDragging = true;
                    dragStartX = e.touches[0].clientX - translateX;
                    dragStartY = e.touches[0].clientY - translateY;
                } else if (!isZooming) {
                    touchStartX = e.touches[0].screenX;
                }
            } else if (e.touches.length === 2) {
                // 핀치 줌 진입 시 변형 애니메이션을 즉시 제거하여 손가락 움직임과 1:1로 실시간 동기화
                cachedModalImg.style.transition = 'none';
                isZooming = true;
                isDragging = false;
                startDistance = getTouchDistance(e.touches[0], e.touches[1]);
                lastScale = currentScale; // 현재 배율을 정확히 유지
            }
        }, { passive: true });

        modalContentWrap.addEventListener('touchmove', function(e) {
            if (iscurrentScale > 1) e.preventDefault(); // 기본 스크롤 방지
            
            if (!animationFrameId) {
                animationFrameId = requestAnimationFrame(() => {
                    if (isDragging && e.touches.length === 1 && currentScale > 1) {
                        translateX = e.touches[0].clientX - dragStartX;
                        translateY = e.touches[0].clientY - dragStartY;
                        
                        const maxBoundX = (window.innerWidth * currentScale) / 2.5;
                        const maxBoundY = (window.innerHeight * currentScale) / 2.5;
                        translateX = Math.max(Math.min(translateX, maxBoundX), -maxBoundX);
                        translateY = Math.max(Math.min(translateY, maxBoundY), -maxBoundY);

                        updateTransform();
                    } 
                    else if (isZooming && e.touches.length === 2) {
                        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
                        if (startDistance > 0) {
                            const scaleFactor = currentDistance / startDistance;
                            // 최소 1배에서 최대 3배까지 튀는 현상 없이 정밀 제어
                            currentScale = Math.min(Math.max(lastScale * scaleFactor, 1), 3);
                            updateTransform();
                        }
                    }
                    animationFrameId = null;
                });
            }
        }, { passive: false });

        modalContentWrap.addEventListener('touchend', function(e) {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            if (isDragging && e.touches.length === 0) {
                isDragging = false;
                lastTranslateX = translateX;
                lastTranslateY = translateY;
            }
            
            if (isZooming && e.touches.length < 2) {
                isZooming = false;
                lastScale = currentScale; // 손을 떼는 순간의 배율을 오차 없이 그대로 고정
                
                // 1배율에 아주 가까워졌을 때만 부드럽게 원래 크기로 리셋
                if (currentScale < 1.05) {
                    resetZoom();
                }
            }

            // 스와이프 판정 (정확히 1배율 상태에서만 작동하도록 제한)
            if (currentScale === 1 && e.changedTouches.length === 1 && !isZooming && !isDragging) {
                touchEndX = e.changedTouches[0].screenX;
                handleSwipe();
            }
        }, { passive: true });
    }

    // 💡 6. 히스토리 API 백버튼 감지 (뒤로가기 누르면 모달만 닫기)
    window.addEventListener('popstate', function() {
        const modal = document.getElementById('photoModal');
        if (modal && modal.classList.contains('open') && location.hash !== '#gallery') {
            closeModalUI(); // 브라우저 주소창 #gallery가 없어지면 모달 닫기
        }
    });
});

// 유틸 & 전역 함수들
function scrollGallery(direction) {
    const container = document.getElementById('thumbContainer');
    if (container) container.scrollBy({ left: direction * 200, behavior: 'smooth' });
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
        
        // 💡 브라우저 주소창에 가짜 히스토리(#gallery) 추가하여 뒤로가기 방어 구축
        history.pushState({ modal: true }, '', '#gallery');
        
        setTimeout(() => { modal.classList.add('open'); }, 10); 
    }
}

// X 버튼을 누를 때
function closeModal() {
    // 직접 닫는 대신 브라우저 뒤로가기를 강제 실행하여 popstate 이벤트를 유도 (깔끔한 히스토리 관리)
    if (location.hash === '#gallery') {
        history.back(); 
    } else {
        closeModalUI();
    }
}

// 실제 모달을 화면에서 숨기는 함수
function closeModalUI() {
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
    if (!cachedModalImg || currentScale > 1) return; // 확대된 상태에선 버튼 이동 차단
    
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
    if (swipeDistance < -50) moveModalImage(1);
    else if (swipeDistance > 50) moveModalImage(-1);
}

function getTouchDistance(touch1, touch2) {
    return Math.sqrt(Math.pow(touch1.screenX - touch2.screenX, 2) + Math.pow(touch1.screenY - touch2.screenY, 2));
}

// 💡 렌더링 성능을 위해 Translate3D와 Scale을 동시 적용하는 함수
function updateTransform() {
    if (cachedModalImg) {
        cachedModalImg.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${currentScale})`;
    }
}

// 줌 & 이동 상태를 모두 1배율 중앙으로 원상복구
function resetZoom() {
    if (cachedModalImg) {
        cachedModalImg.style.transition = 'transform 0.25s ease-out, opacity 0.2s ease';
        currentScale = 1; lastScale = 1;
        translateX = 0; translateY = 0;
        lastTranslateX = 0; lastTranslateY = 0;
        
        updateTransform();
        
        setTimeout(() => { cachedModalImg.style.transition = 'opacity 0.2s ease'; }, 250);
    }
}