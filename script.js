// 전역 상태 변수
let currentImgIndex = 0;
let allImages = [];

// 💡 줌 & 드래그 상태 관리 변수
let isZooming = false;
let isDragging = false;
let startDistance = 0;
let currentScale = 1;
let lastScale = 1;
let translateX = 0, translateY = 0;
let dragStartX = 0, dragStartY = 0;

let animationFrameId = null;
let touchStartX = 0, touchEndX = 0;

// DOM 요소 캐싱
let cachedModalImg = null;
let cachedMainThumbnails = null;
let cachedModalThumbs = null;
let cachedImg1 = null;
let cachedImg2 = null;

document.addEventListener("DOMContentLoaded", function() {

    const intro = document.getElementById('introCinematic');
    const hasEntered = sessionStorage.getItem('wedding-intro-passed');

    if (hasEntered === 'true') {
        // 이미 입장한 하객이라면 인트로 레이어를 흔적도 없이 즉시 제거
        if (intro) intro.remove();
    } else {
        // 처음 방문한 경우라면 뒤로가기 누를 때 모달처럼 꼬이지 않게 가짜 해시 히스토리 하나 생성
        history.pushState({ intro: true }, '', '#welcome');
    }

    // 뒤로가기를 눌렀을 때 인트로가 다시 살아나는 현상을 방어하는 핵심 팝스테이트
    window.addEventListener('popstate', function(e) {
        if (location.hash !== '#welcome' && intro && !intro.classList.contains('fade-out')) {
            // 인트로 상태에서 폰 뒤로가기를 누르면 사이트가 꺼지는 게 아니라 강제로 입장 처리 유도
            enterInvitation();
        }
    });

    // 1. 이미지 프리로딩
    document.querySelectorAll('.gallery-thumbnail').forEach(thumb => {
        const img = new Image(); img.src = thumb.src;
    });

    // 2. 갤러리 썸네일 매핑 및 모달 하단 썸네일 노드 동적 생성
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

    // 3. D-Day 계산 로직
    const weddingDate = new Date('2026-09-19');
    const diffDays = Math.ceil((weddingDate - new Date()) / (1000 * 60 * 60 * 24));
    const dDayElement = document.getElementById('dDay');
    if (dDayElement) {
        dDayElement.innerText = diffDays > 0 ? `D - ${diffDays}` : (diffDays === 0 ? `D-Day` : `D + ${Math.abs(diffDays)}`);
    }

    // 4. 계좌번호 기능 인터랙션 (토글 및 복사)

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

    // 5. 갤러리 메인 이미지 클릭 교체 페이드 애니메이션
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

    // 6. 스크롤 등장 애니메이션 메모리 최적화
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                obs.unobserve(entry.target);
            }
        });
    });
    document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));

    // 💡 7. 모바일 터치 제스처 (오타 수정 및 끊김 없는 줌 메커니즘 반영)
    const modalContentWrap = document.querySelector('.modal-content-wrap');
    cachedModalImg = document.getElementById('modalImage');

    if (modalContentWrap && cachedModalImg) {
        modalContentWrap.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) {
                if (currentScale > 1) {
                    // 확대 상태: 드래그(이동) 시작 좌표 기록
                    isDragging = true;
                    dragStartX = e.touches[0].clientX - translateX;
                    dragStartY = e.touches[0].clientY - translateY;
                } else if (!isZooming) {
                    // 1배율 상태: 스와이프 준비
                    touchStartX = e.touches[0].screenX;
                }
            } else if (e.touches.length === 2) {
                // 두 손가락 닿는 순간 CSS 트랜지션을 즉시 꺼서 손가락 움직임과 1:1로 반응하게 함
                cachedModalImg.style.transition = 'none'; 
                isZooming = true;
                isDragging = false;
                startDistance = getTouchDistance(e.touches[0], e.touches[1]);
                lastScale = currentScale;
            }
        }, { passive: true });

        modalContentWrap.addEventListener('touchmove', function(e) {
            // 💡 [수정 완료] 존재하지 않는 변수 오타를 올바른 변수(currentScale)로 정상 교체했습니다.
            if (currentScale > 1 || isZooming) e.preventDefault(); 
            
            if (!animationFrameId) {
                animationFrameId = requestAnimationFrame(() => {
                    if (isDragging && e.touches.length === 1 && currentScale > 1) {
                        // 확대 후 사진 이동 거리 계산
                        translateX = e.touches[0].clientX - dragStartX;
                        translateY = e.touches[0].clientY - dragStartY;
                        
                        // 화면 바깥으로 너무 나가지 않도록 바운더리 제한
                        const maxBoundX = (window.innerWidth * currentScale) / 3;
                        const maxBoundY = (window.innerHeight * currentScale) / 3;
                        translateX = Math.max(Math.min(translateX, maxBoundX), -maxBoundX);
                        translateY = Math.max(Math.min(translateY, maxBoundY), -maxBoundY);

                        updateTransform();
                    } 
                    else if (isZooming && e.touches.length === 2) {
                        // 핀치 줌 계산
                        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
                        if (startDistance > 0) {
                            const scaleFactor = currentDistance / startDistance;
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
            }
            
            if (isZooming && e.touches.length < 2) {
                isZooming = false;
                lastScale = currentScale; // 손가락을 떼는 순간의 배율 그대로 완벽 박제
                
                // 손가락을 놓았을 때 1배율에 수렴하면 자연스럽게 원상복구
                if (currentScale <= 1.05) {
                    resetZoom();
                }
            }

            // 스와이프 제스처 판정
            if (currentScale === 1 && e.changedTouches.length === 1 && !isZooming && !isDragging) {
                touchEndX = e.changedTouches[0].screenX;
                handleSwipe();
            }
        }, { passive: true });
    }

    // 💡 8. 히스토리 API 백버튼 감지 (뒤로가기로 모달만 닫기)
    window.addEventListener('popstate', function() {
        const modal = document.getElementById('photoModal');
        if (modal && modal.classList.contains('open') && location.hash !== '#gallery') {
            closeModalUI();
        }
    });
});

// ==================
// 공통 및 UI 업데이트 함수들
// ==================

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
        
        history.pushState({ modal: true }, '', '#gallery');
        
        setTimeout(() => { modal.classList.add('open'); }, 10); 
    }
}

function closeModal() {
    if (location.hash === '#gallery') {
        history.back(); 
    } else {
        closeModalUI();
    }
}

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
    if (!cachedModalImg) return;
    
    // 1. 만약 확대된 상태(currentScale > 1)라면 즉시 배율과 드래그 위치를 1배율 중앙으로 초기화
    if (currentScale > 1) {
        resetZoom();
    }
    
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

function updateTransform() {
    if (cachedModalImg) {
        cachedModalImg.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${currentScale})`;
    }
}

function resetZoom() {
    if (cachedModalImg) {
        cachedModalImg.style.transition = 'transform 0.25s ease-out, opacity 0.2s ease';
        currentScale = 1; lastScale = 1;
        translateX = 0; translateY = 0;
        updateTransform();
        setTimeout(() => { cachedModalImg.style.transition = 'opacity 0.2s ease'; }, 250);
    }
}

// 💡 [추가] 인트로 창을 닫고 음악을 틀며 본문으로 진입하는 함수
function enterInvitation() {
    const intro = document.getElementById('introCinematic');
    const audio = document.getElementById('weddingBgm');
    
    if (intro) {
        intro.classList.add('fade-out'); // 인트로 레이어 페이드아웃
        setTimeout(() => intro.remove(), 800); // 0.8초 후 DOM에서 완전히 삭제
    }

    // 브라우저 락이 풀렸으므로 무한반복 BGM 재생 시작!
    if (audio && audio.paused) {
        audio.play().catch(err => console.log("BGM 자동재생 실패 방어:", err));
    }

    // 세션에 입장 기록을 각인하여 뒤로가기/새로고침 시 인트로 재출현 차단
    sessionStorage.setItem('wedding-intro-passed', 'true');
    
    // 주소창의 #welcome 가짜 해시 지우기
    if (location.hash === '#welcome') {
        history.replaceState(null, '', location.pathname + location.search);
    }
}