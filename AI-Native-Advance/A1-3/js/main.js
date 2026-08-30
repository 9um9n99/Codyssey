// main.js
// 모든 페이지에서 공통으로 쓰는 데이터와 함수를 정의합니다.

// ---------- 요리 도감 데이터 ----------
// 난이도(조각 수)별로 요리 4종씩, 총 16종
const DISH_TIERS = [
  {
    min: 2, max: 3,
    label: '가볍고 빠른 목표',
    dishes: ['오이무침', '오이냉채', '오이피클', '오이초절임'],
  },
  {
    min: 4, max: 6,
    label: '손이 조금 가는 목표',
    dishes: ['오이소박이', '오이볶음', '오이잡채', '오이월과채'],
  },
  {
    min: 7, max: 9,
    label: '정성이 필요한 목표',
    dishes: ['오이냉국', '오이소면', '오이김치', '오이비빔국수'],
  },
  {
    min: 10, max: Infinity,
    label: '긴 호흡의 목표',
    dishes: ['오이지', '오이장아찌', '오이고추장무침', '오이된장박이'],
  },
];

function getTierForCount(count) {
  return DISH_TIERS.find((t) => count >= t.min && count <= t.max) || DISH_TIERS[DISH_TIERS.length - 1];
}

// 목표 텍스트를 숫자로 변환 (같은 목표는 항상 같은 숫자가 나옴)
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// 도감에서 이미 모은 요리 이름들을 가져옴
function getUnlockedDishSet() {
  const records = JSON.parse(localStorage.getItem('jogak-records') || '[]');
  return new Set(records.map((r) => r.dish));
}

// 조각 수 -> 완성될 요리 하나를 랜덤으로 결정
// 규칙: 같은 난이도(tier) 안에서, 아직 도감에 없는 요리를 우선으로 랜덤 선택.
//       그 난이도 요리를 이미 다 모았다면 그 난이도 안에서 랜덤.
//       도감 16종을 전부 모았다면 완전 랜덤.
function pickDish(pieceCount) {
  const tier = getTierForCount(pieceCount);
  const unlocked = getUnlockedDishSet();
  const totalDishes = getAllDishes().length;

  let pool = tier.dishes;

  if (unlocked.size < totalDishes) {
    const undiscovered = tier.dishes.filter((d) => !unlocked.has(d));
    if (undiscovered.length > 0) {
      pool = undiscovered;
    }
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

// 전체 요리 16종을 순서대로 반환 (도감 페이지용)
function getAllDishes() {
  return DISH_TIERS.flatMap((tier) => tier.dishes);
}

// ---------- (임시) 요리 이미지 placeholder ----------
// TODO: 6단계 백엔드 연동 시, 이 함수를 실제 fetch('/api/generate-image', { dish })
//       호출로 교체하고, 결과(base64 이미지)를 localStorage('jogak-dish-images')에 캐싱할 것.
//       지금은 이모지로 자리만 채워둠.
function getDishPlaceholderEmoji() {
  return '🥒';
}

console.log('조각조각 서비스에 오신 걸 환영해요 🥒');
