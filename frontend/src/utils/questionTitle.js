// 對應 homework_questions.title VARCHAR(512)
export const QUESTION_TITLE_MAX = 512;

// 依字元計算（emoji 算 1 字），與 MySQL 的 VARCHAR 字數一致；String.length 會把 emoji 算成 2
export function titleLength(title) {
  return [...(title || "")].length;
}

// 回傳第一個標題超過上限的題號（從 1 起算），都沒超過則回傳 0
export function firstOverlongQuestion(questions) {
  const index = questions.findIndex((q) => titleLength(q.title) > QUESTION_TITLE_MAX);
  return index + 1;
}
