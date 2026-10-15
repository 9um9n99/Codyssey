// main.js
// 모든 페이지에서 공통으로 쓰는 데이터와 함수를 정의합니다.
//
// [데이터 모델] 진행 중인 계획과 완성된 계획을 더 이상 따로 저장하지 않습니다.
// localStorage('jogak-plans')에 계획을 전부 한 곳에 모아두고, "완성 여부"는
// 그 계획의 조각(pieces)이 전부 체크됐는지로 그때그때 판단합니다.

// ---------- 요리 레시피북 데이터 ----------
// 목표의 기간/난이도와 상관없이 25종 중에서 완전 랜덤으로 요리가 정해집니다.
const ALL_DISHES = [
  '오이무침', '오이냉채', '오이피클', '오이초절임',
  '오이소박이', '오이볶음', '오이잡채', '오이월과채',
  '오이냉국', '오이소면', '오이김치', '오이비빔국수',
  '오이지', '오이라페', '오이나물', '오이카나페',
  '오이샌드위치', '오이비빔밥', '오이김밥', '오이냉모밀',
  '오이화채', '오이후무스', '오이파스타', '오이라따뚜이',
  '오이명란두부비빔밥',
];

function getAllDishes() {
  return ALL_DISHES;
}

// 레어 레시피 — 완성하면 도감/축하 팝업에서 금테 장식으로 특별하게 표시됨
// (나머지는 대부분 익숙한 한식 반찬류라, 이국적이거나 독특한 조합의 요리 3개를 레어로 선정)
const RARE_DISHES = [
  '오이후무스', '오이라따뚜이', '오이파스타',
];

function isRareDish(dishName) {
  return RARE_DISHES.includes(dishName);
}

// 도감에서 요리를 선택했을 때 보여줄, 감성적이고 응원하는 요리 설명
const DISH_DESCRIPTIONS = {
  '오이무침': '새콤달콤하게 조물조물 무쳐낸 오이무침이 완성됐어요. 짧고 굵게 해치운 이번 목표, 그 산뜻한 뒷맛처럼 홀가분한 마음으로 다음 발걸음을 내디뎌보세요. 작은 목표라고 해서 그 성취가 작은 건 아니에요. 오늘의 이 상큼함, 온전히 당신의 몫이에요.',
  '오이냉채': '얼음처럼 시원한 오이냉채 한 그릇이 눈앞에 놓였어요. 미루지 않고 바로 시작해서 끝까지 밀어붙인 당신, 그 실행력이야말로 이 요리의 진짜 재료였어요. 시원하게 한입 드시고, 다음 목표도 이 속도 그대로 가봐요.',
  '오이피클': '새콤한 국물에 폭 절여진 오이피클처럼, 짧은 시간 안에 야무지게 마무리한 목표예요. 별거 아니라고 넘기지 마세요. 시작하고 끝맺는 것, 그게 사실 제일 어려운 일이니까요. 오늘의 이 작은 완주에 아삭한 박수를 보내요.',
  '오이초절임': '새초롬하게 잘 절여진 오이초절임이 완성됐어요. 깔끔하게, 미련 없이 끝맺은 당신의 실행력에 박수를 보내요. 이런 산뜻한 마무리가 하나둘 쌓이면, 어느새 커다란 그림이 되어 있을 거예요. 오늘도 정말 수고했어요.',
  '오이소박이': '칼집을 넣고 속을 채워 완성한 오이소박이, 손이 많이 가는 만큼 마음도 많이 쓰였을 목표였을 거예요. 중간에 지칠 법도 했는데 끝까지 채워 넣으셨네요. 알차게 채운 그 속처럼, 당신의 하루하루도 그렇게 알차게 채워지고 있어요.',
  '오이볶음': '팬 위에서 지글지글, 딱 적당한 정성으로 볶아낸 한 접시예요. 너무 무리하지도, 그렇다고 대충 넘기지도 않은 균형 잡힌 노력이었어요. 사실 그 적당함이야말로 가장 지키기 어려운 균형이라는 걸, 스스로 꼭 알아주세요.',
  '오이잡채': '여러 재료가 자연스럽게 어우러지듯, 여러 단계를 하나씩 엮어 완성한 오이잡채예요. 복잡해 보였던 과정을 결국 다 풀어내셨네요. 그 엮어내는 솜씨는, 다음 목표에서도 분명 다시 빛을 발할 거예요.',
  '오이월과채': '달콤짭짤 색색깔이 어우러진 월과채처럼, 다채로운 노력들이 모여 하나의 완성작이 됐어요. 이것저것 신경 쓸 게 많았을 텐데 끝까지 균형 있게 잘 버무려내셨어요. 오늘의 이 다채로움에 진심 어린 박수를 보내요.',
  '오이냉국': '얼음을 동동 띄운 정성 가득한 오이냉국이 완성됐어요. 여름 한복판처럼 뜨겁게 몰두했던 시간들, 이 시원한 한 그릇으로 잠시 식혀가세요. 정성을 들인 만큼 결과도 그만큼 깊어졌을 거예요. 정말 잘 해냈어요.',
  '오이소면': '삶고 헹구고 고명까지 올려야 하는, 손이 많이 가는 오이소면이 완성됐어요. 하나씩 차근차근 단계를 밟아온 그 꾸준함이 오늘의 이 한 그릇을 만들었어요. 정성 들인 만큼 맛있을 거예요. 이 완성을 온전히 즐기세요.',
  '오이김치': '숙성의 시간을 견뎌야 제맛이 나는 오이김치처럼, 꾸준히 기다리고 다져온 노력이 깊은 맛으로 돌아왔어요. 조급해하지 않고 묵묵히 이어온 당신의 페이스, 그게 가장 큰 힘이었어요. 오늘의 이 깊은 맛을 마음껏 누리세요.',
  '오이비빔국수': '매콤새콤하게 야무지게 비벼낸 오이비빔국수 한 그릇이에요. 여러 조각의 노력들이 잘 비벼져서 이렇게 완성됐네요. 이 얼큰한 성취감, 오래 기억해두세요. 다음 목표도 이렇게 시원하게 비벼봐요.',
  '오이지': '긴 시간 꾹꾹 눌러 담가야 완성되는 오이지처럼, 오래도록 참고 이어온 노력이 결실을 맺었어요. 긴 호흡의 목표는 중간에 포기하고 싶은 순간이 참 많았을 텐데, 끝까지 눌러 담아내셨네요. 그 깊게 우러난 맛, 온전히 당신의 것이에요.',
  '오이라페': '새콤하게 절인 오이라페처럼, 트렌디하면서도 야무지게 완성한 목표예요. 익숙한 재료도 새롭게 풀어내는 감각, 그게 바로 당신의 강점이었어요. 산뜻하고 개운한 이 완성을, 마음껏 즐기세요.',
  '오이나물': '슴슴하지만 자꾸 손이 가는 오이나물무침처럼, 꾸밈없이 담백하게 해낸 목표였어요. 화려하진 않아도 든든한 완성, 그게 바로 당신만의 스타일이에요. 담백한 성취도 충분히, 자랑스러워할 자격이 있어요.',
  '오이카나페': '한입 크기로 예쁘게 담아낸 오이카나페처럼, 작지만 완벽하게 마무리한 목표예요. 작은 디테일 하나하나까지 신경 쓴 정성이 돋보여요. 작다고 가볍게 보지 마세요. 완성도는 크기와 상관없으니까요.',
  '오이샌드위치': '아삭한 오이가 켜켜이 박힌 샌드위치처럼, 여러 조각을 알차게 채워 완성한 목표예요. 차곡차곡 쌓아 올린 노력들이 결국 든든한 한 끼가 됐어요. 이 든든함을 가지고, 다음 목표로도 씩씩하게 나아가세요.',
  '오이비빔밥': '고슬고슬한 밥 위에 오이가 올라간 오이비빔밥처럼, 여러 요소를 골고루 잘 섞어 완성한 목표예요. 이것저것 챙기느라 바빴을 텐데, 한 그릇으로 야무지게 비벼내셨네요.',
  '오이김밥': '돌돌 말아 완성한 오이김밥처럼, 흩어져 있던 계획들을 하나로 야무지게 말아낸 결과물이에요. 한입에 쏙 들어가는 완성도, 오늘 제대로 해내셨어요.',
  '오이냉모밀': '시원한 육수에 오이 고명을 올린 냉모밀처럼, 더운 날씨 같던 부담을 시원하게 넘긴 목표였어요. 후루룩 넘긴 만큼 후련한 완성감을 느껴보세요.',
  '오이화채': '달콤하게 우려낸 오이화채처럼, 여름날의 더위 같던 부담을 상큼하게 풀어낸 목표예요. 이 청량한 완성감, 오래 기억해두셔도 좋아요.',
  '오이후무스': '곱게 갈아 부드럽게 완성한 오이후무스처럼, 복잡했던 과정을 매끄럽게 풀어낸 목표예요. 꾸준히 저어가며 완성한 그 정성이 고스란히 느껴져요.',
  '오이파스타': '오이가 감기듯 어우러진 오이파스타처럼, 여러 가닥의 계획들을 하나로 잘 엮어낸 목표예요. 술술 풀려나간 그 과정이 이 완성에 다 담겨있어요.',
  '오이라따뚜이': '여러 채소와 오이가 어우러진 라따뚜이처럼, 다양한 요소를 조화롭게 담아낸 목표예요. 뭉근하게 끓여낸 그 시간처럼, 천천히 그러나 확실하게 완성됐어요.',
  '오이명란두부비빔밥': '명란과 두부, 오이가 뜻밖에 잘 어우러진 오이명란두부비빔밥처럼, 서로 다른 요소들을 근사하게 엮어낸 목표예요. 익숙한 것들을 낯설게 조합하는 감각이야말로 당신만의 강점이었어요. 예사롭지 않은 이 조합처럼, 오늘의 완성도 특별해요.',
};

// 조리 중인 요리(계획)마다 부여할 고유 ID 생성
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- 계획(plan) 완성 여부 판단 ----------
// 완성 = 조각이 하나 이상 있고, 전부 체크됨. 이 함수 하나로 "완성/진행중"을 항상 그때그때 판단합니다.
function isPlanComplete(plan) {
  return plan.pieces.length > 0 && plan.pieces.every((p) => p.done);
}

// ---------- 통합 계획 저장소 ----------
function savePlans(plans) {
  try {
    localStorage.setItem('jogak-plans', JSON.stringify(plans));
    return true;
  } catch (err) {
    console.error('[계획 저장 실패]', err);
    return false;
  }
}

// 예전 버전들(단일 계획 / 배열 계획 / 완성 기록 로그)이 남아있다면 하나로 합쳐줌
function migrateOldPlanData() {
  if (localStorage.getItem('jogak-plans')) return;

  const migrated = [];

  const veryOld = localStorage.getItem('jogak-active-plan');
  if (veryOld) {
    const p = JSON.parse(veryOld);
    migrated.push({
      id: generateId(),
      goal: p.goal,
      totalDays: p.totalDays,
      dish: p.dish,
      createdAt: p.createdAt,
      completedAt: null,
      pieces: p.pieces,
    });
  }

  const oldActiveArr = JSON.parse(localStorage.getItem('jogak-active-plans') || '[]');
  oldActiveArr.forEach((p) => {
    migrated.push({
      id: p.id || generateId(),
      goal: p.goal,
      totalDays: p.totalDays,
      dish: p.dish,
      createdAt: p.createdAt,
      completedAt: null,
      pieces: p.pieces,
    });
  });

  const oldRecords = JSON.parse(localStorage.getItem('jogak-records') || '[]');
  oldRecords.forEach((r) => {
    let dayCursor = 0;
    const pieces = (r.pieces || []).map((pc) => {
      const entry = { title: pc.title, done: true, day: dayCursor };
      dayCursor += pc.days || 1;
      return entry;
    });
    migrated.push({
      id: generateId(),
      goal: r.goal,
      totalDays: r.days,
      dish: r.dish,
      createdAt: r.completedAt,
      completedAt: r.completedAt,
      pieces,
    });
  });

  localStorage.removeItem('jogak-active-plan');
  localStorage.removeItem('jogak-active-plans');
  localStorage.removeItem('jogak-records');
  localStorage.setItem('jogak-plans', JSON.stringify(migrated));
}

function loadPlans() {
  // 저장 데이터가 깨졌거나(직접 수정·다른 버전) 형식이 달라도 화면 전체가 멈추지 않게 걸러서 읽음
  let plans = [];
  try {
    migrateOldPlanData();
    const parsed = JSON.parse(localStorage.getItem('jogak-plans') || '[]');
    if (Array.isArray(parsed)) plans = parsed;
  } catch (err) {
    console.error('[계획 불러오기 실패]', err);
  }
  return plans
    .filter((p) => p && typeof p === 'object' && Array.isArray(p.pieces))
    .map(normalizePlanPieces);
}

function normalizePlanPieces(plan) {
  const needsMigration = plan.pieces.some((p) => p.day === undefined);
  if (!needsMigration) return plan;

  plan.pieces = plan.pieces.map((p, i) => ({
    title: p.title,
    done: p.done,
    day: p.day !== undefined ? p.day : (p.startDay !== undefined ? p.startDay : i),
  }));
  return plan;
}

// ---------- 도감에서 이미 모은(현재 완성 상태인) 요리 이름들 ----------
function getUnlockedDishSet() {
  return new Set(loadPlans().filter(isPlanComplete).map((p) => p.dish));
}

// 완성될 요리 하나를 랜덤으로 결정 (계획 생성 시 한 번만 정해짐)
// 목표의 기간이나 조각 수와는 전혀 상관없이, 25종 전체 중에서 완전 랜덤으로 뽑되
// 아직 도감에 없는(안 만들어본) 요리를 우선으로 합니다.
// 25종을 전부 모았다면 그때부터는 완전 랜덤으로 전환됩니다.
// 레어 레시피는 일반 요리보다 뽑힐 확률이 낮게 가중치를 줍니다.
const RARE_DISH_WEIGHT = 0.3; // 일반 요리 대비 30% 확률 (약 3분의 1)

function pickDish() {
  const unlocked = getUnlockedDishSet();
  const undiscovered = ALL_DISHES.filter((d) => !unlocked.has(d));
  const pool = undiscovered.length > 0 ? undiscovered : ALL_DISHES;

  const weights = pool.map((d) => (isRareDish(d) ? RARE_DISH_WEIGHT : 1));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let roll = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1]; // 부동소수점 오차 대비 안전장치
}

// ---------- 완성 축하 팝업 (어느 페이지에서 완성하든 동일하게 뜸) ----------
function showCompletionCelebration(dish) {
  let overlay = document.getElementById('celebration-overlay');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'celebration-overlay';
    overlay.className = 'modal-backdrop';
    overlay.innerHTML = `
      <div class="modal-card celebration-card">
        <button type="button" class="modal-close" id="celebration-close" aria-label="닫기">×</button>
        <div class="celebration-photo-frame" id="celebration-photo-frame">
          <img src="images/job_chef_woman.png" alt="" id="celebration-image">
        </div>
        <p class="celebration-eyebrow">오늘의 요리 완성!</p>
        <h2 class="celebration-dish" id="celebration-dish-name"></h2>
        <p class="celebration-desc" id="celebration-desc"></p>
        <a href="record.html" class="btn-primary">나의 요리판에서 보기 →</a>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#celebration-close').addEventListener('click', () => {
      overlay.hidden = true;
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.hidden = true;
    });
  }

  document.getElementById('celebration-dish-name').textContent = `${dish} 🎉`;
  document.getElementById('celebration-desc').textContent = DISH_DESCRIPTIONS[dish] || '';

  const cardEl = overlay.querySelector('.celebration-card');
  const eyebrowEl = overlay.querySelector('.celebration-eyebrow');
  const photoFrameEl = overlay.querySelector('.celebration-photo-frame');
  const rare = isRareDish(dish);
  cardEl.classList.toggle('celebration-card--rare', rare);
  photoFrameEl.classList.toggle('celebration-photo-frame--rare', rare);
  eyebrowEl.textContent = rare ? '✨ 레어 레시피 발견!' : '오늘의 요리 완성!';

  const img = document.getElementById('celebration-image');
  img.src = getDishImagePath(dish);
  overlay.hidden = false;
}

// ---------- 요리별 미리 준비된 이미지 (25종 고정이라, 매번 생성하지 않고 정적 파일로 관리) ----------
// images/dishes/ 폴더에 아래 파일명 그대로 이미지를 넣어두면 자동으로 연결됨
const DISH_IMAGE_SLUGS = {
  '오이무침': 'oi-muchim',
  '오이냉채': 'oi-naengchae',
  '오이피클': 'oi-pickle',
  '오이초절임': 'oi-chojeolim',
  '오이소박이': 'oi-sobagi',
  '오이볶음': 'oi-bokkeum',
  '오이잡채': 'oi-japchae',
  '오이월과채': 'oi-wolgwachae',
  '오이냉국': 'oi-naengguk',
  '오이소면': 'oi-somyeon',
  '오이김치': 'oi-kimchi',
  '오이비빔국수': 'oi-bibim-guksu',
  '오이지': 'oi-ji',
  '오이라페': 'oi-rape',
  '오이나물': 'oi-namul',
  '오이카나페': 'oi-canape',
  '오이샌드위치': 'oi-sandwich',
  '오이비빔밥': 'oi-bibimbap',
  '오이김밥': 'oi-gimbap',
  '오이냉모밀': 'oi-naengmomil',
  '오이화채': 'oi-hwachae',
  '오이후무스': 'oi-hummus',
  '오이파스타': 'oi-pasta',
  '오이라따뚜이': 'oi-ratatouille',
  '오이명란두부비빔밥': 'oi-myeongran-tofu-bibimbap',
};

function getDishImagePath(dishName) {
  const slug = DISH_IMAGE_SLUGS[dishName];
  return slug ? `images/dishes/${slug}.png` : 'images/food_tsukemono_kyuuri.png';
}

console.log('조각조각 서비스에 오신 걸 환영해요 🥒');
