// index.js
// 메인 페이지 전용 스크립트.
// ① 드롭다운 카드들(어떻게 쓰나요 / 소개) 열고 닫기
// ② 스크롤하면서 섹션들이 부드럽게 나타나는 효과

// ---------- ① 드롭다운 열고 닫기 (여러 개 지원) ----------
document.querySelectorAll('.accordion-toggle').forEach((toggle) => {
  const scroll = document.getElementById(toggle.dataset.target);
  if (!scroll) return;

  toggle.addEventListener('click', () => {
    const isOpen = scroll.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.classList.toggle('is-open', isOpen);

    if (isOpen) {
      // 펼쳐질 때: 실제 콘텐츠 높이만큼 max-height를 줘서 애니메이션이 자연스럽게 끝까지 이어지게 함
      scroll.style.maxHeight = `${scroll.scrollHeight}px`;
    } else {
      scroll.style.maxHeight = '0px';
    }
  });
});

// ---------- ② 스크롤 등장 효과 ----------
const revealTargets = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

revealTargets.forEach((el) => revealObserver.observe(el));

// ---------- ③ 사용법 팝업 (히어로의 "사용법 보기" 버튼) ----------
const howModal = document.getElementById('how-modal');
const howOpenBtn = document.getElementById('how-open');
const howCloseBtn = document.getElementById('how-close');
const howStartBtn = document.getElementById('how-start');

function openHowModal() {
  howModal.hidden = false;
  document.body.style.overflow = 'hidden'; // 팝업 뒤 화면이 같이 스크롤되지 않게
  howCloseBtn.focus();
}

function closeHowModal() {
  howModal.hidden = true;
  document.body.style.overflow = '';
  howOpenBtn.focus();
}

if (howModal && howOpenBtn) {
  howOpenBtn.addEventListener('click', openHowModal);
  howCloseBtn.addEventListener('click', closeHowModal);

  // 팝업 바깥(어두운 배경)을 누르면 닫기
  howModal.addEventListener('click', (event) => {
    if (event.target === howModal) closeHowModal();
  });

  // Esc 키로 닫기
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !howModal.hidden) closeHowModal();
  });

  // "첫 목표 적으러 가기": 팝업을 닫고 목표 입력창으로
  howStartBtn.addEventListener('click', () => {
    howModal.hidden = true;
    document.body.style.overflow = '';
    const goalInput = document.getElementById('goal-input');
    if (goalInput) goalInput.focus();
  });
}
