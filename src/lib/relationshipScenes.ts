// Shared, fixed catalog: never accept arbitrary user prompts.
export const relationshipScenes = [
  {
    "id": "a01",
    "min": 2,
    "max": 2,
    "title": "눈만 봐도 웃겨",
    "description": "서로 마주보고 웃기",
    "action": "Both turn toward each other, make eye contact, then laugh together."
  },
  {
    "id": "a02",
    "min": 2,
    "max": 2,
    "title": "네가 울면 나도 울어",
    "description": "한 사람이 울먹이면 상대도 공감하기",
    "action": "One person becomes gently tearful; the other notices and becomes similarly misty-eyed, sharing a sympathetic look. No distress or injury."
  },
  {
    "id": "a03",
    "min": 2,
    "max": 2,
    "title": "내가 안아줄게",
    "description": "서로 안아주고 등 두드리기",
    "action": "Both willingly lean toward each other for a brief friendly side hug and gently pat each other's upper back if space allows."
  },
  {
    "id": "a04",
    "min": 2,
    "max": 2,
    "title": "너도 따라 해!",
    "description": "친구의 포즈 따라 하기",
    "action": "One person makes a simple V-sign, gently taps the other's shoulder, and the other copies the pose; they laugh."
  },
  {
    "id": "a05",
    "min": 2,
    "max": 2,
    "title": "삐졌어?",
    "description": "삐진 친구 달래기",
    "action": "One playfully folds arms and turns slightly away; the other leans toward them with a friendly reassuring gesture, and both smile."
  },
  {
    "id": "b01",
    "min": 3,
    "max": 3,
    "title": "우리 셋이라서 좋아",
    "description": "세 사람이 번갈아 바라보고 웃기",
    "action": "Three people exchange glances in turn, one starts laughing and all join in."
  },
  {
    "id": "b02",
    "min": 3,
    "max": 3,
    "title": "나도 끼워줘!",
    "description": "두 친구가 나머지 친구도 끌어안기",
    "action": "Two designated people briefly clasp hands and smile; the third playfully pouts. The pair reach toward the third and all lean into a friendly group hug, without crossing arms unnaturally."
  },
  {
    "id": "b03",
    "min": 3,
    "max": 3,
    "title": "우리만의 비밀",
    "description": "귓속말하는 시늉과 웃음",
    "action": "One leans slightly toward a neighbor as if sharing a secret, the third curiously leans in, then all giggle."
  },
  {
    "id": "b04",
    "min": 3,
    "max": 3,
    "title": "삼총사 포즈",
    "description": "세 사람이 차례로 포즈 따라 하기",
    "action": "One makes a simple V-sign, the other two copy it in turn, then exchange smiles."
  },
  {
    "id": "c01",
    "min": 2,
    "max": 2,
    "title": "눈이 마주친 순간",
    "description": "눈을 마주치고 함께 미소 짓기",
    "action": "Both turn toward each other, hold a warm friendly look briefly, then smile and laugh."
  },
  {
    "id": "c02",
    "min": 2,
    "max": 2,
    "title": "장난스러운 설렘",
    "description": "머리를 가볍게 헝클어뜨리기",
    "action": "One person gently and playfully ruffles the other's hair near the crown with an open hand; the other smiles and lightly tidies their hair. No force, no romantic or sexual implications."
  },
  {
    "id": "c03",
    "min": 2,
    "max": 2,
    "title": "아무 일도 없었어",
    "description": "마주보다 헛기침하고 정색하기",
    "action": "Both exchange amused glances, mime a small awkward throat-clear silently, then face forward with comically serious expressions."
  },
  {
    "id": "c04",
    "min": 2,
    "max": 2,
    "title": "한 번만 봐줘",
    "description": "미안한 듯 손을 모아 달래기",
    "action": "One turns away with a playful pout; the other clasps their own hands in an exaggerated apologetic gesture; both smile."
  },
  {
    "id": "d01",
    "min": 4,
    "max": 20,
    "title": "웃음이 멈추질 않아",
    "description": "서로 이야기하는 듯하다 함께 크게 웃기",
    "action": "Neighbors turn toward one another as if chatting silently; laughter spreads naturally through the group."
  },
  {
    "id": "d02",
    "min": 4,
    "max": 20,
    "title": "우리를 위하여!",
    "description": "우유잔을 들어 함께 건배하기",
    "action": "If there is sufficient visible hand and torso space, each person naturally raises a small simple glass of white milk from below the frame, exchanging smiles in a cheerful toast. Otherwise use an imaginary toast gesture without adding objects."
  },
  {
    "id": "d03",
    "min": 4,
    "max": 20,
    "title": "우리 모두 파이팅!",
    "description": "서로 격려하고 함께 파이팅",
    "action": "Neighbors gently pat shoulders when reachable, then raise their own lightly clenched fist near their chest in a cheerful encouragement gesture. No punching."
  },
  {
    "id": "d04",
    "min": 4,
    "max": 20,
    "title": "따라 해 봐!",
    "description": "한 사람의 포즈를 다 같이 따라 하기",
    "action": "One person makes a simple V-sign; the others copy in turn and laugh at one another."
  }
] as const;
export type RelationshipScene = typeof relationshipScenes[number];
export function relationshipScene(id: unknown) { return relationshipScenes.find(s => s.id === id); }
export function scenesForCount(count: number) { return relationshipScenes.filter(s => count >= s.min && count <= s.max); }
