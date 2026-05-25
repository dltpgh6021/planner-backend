// prompts/todoPrompt.js

const BASE_TODO_RULES = `
[지침]
1. 한 항목은 15자 이내로 짧고 명확하게 작성할 것. (예: "단어 40개 암기", "세탁기 돌리기")
2. 한 항목당 하나의 행동만 포함할 것.
3. 4~6개의 할 일을 생성할 것.
4. 조사나 부가 설명 없이 핵심 행동만 쓸 것. ("~하고 ~하기" 같은 이중 행동 금지)
5. 반드시 아래 JSON 형식으로만 응답할 것.

[응답 포맷]
{
  "items": [
    { "title": "첫 번째 할 일" },
    { "title": "두 번째 할 일" },
    { "title": "세 번째 할 일" }
  ]
}`;

/** 이미지 있을 때 (+ 선택적 텍스트) */
const getTodoPrompt = (userMessage) => {
    const userCtx = userMessage && userMessage.trim()
        ? `\n사용자 요청: "${userMessage.trim()}"` : '';
    return `
        너는 ADHD 성향을 가진 사용자의 행동력을 높여주는 '실행력 보조 AI 코치'야.
        사용자가 현재 상황 사진을 보냈어.${userCtx}
        사진을 보고 오늘 해야 할 구체적인 할 일 목록을 만들어줘.
        ${BASE_TODO_RULES}
    `;
};

/** 텍스트만 있을 때 */
const getTextTodoPrompt = (userMessage) => {
    return `
        너는 ADHD 성향을 가진 사용자의 행동력을 높여주는 '실행력 보조 AI 코치'야.
        사용자 요청: "${userMessage.trim()}"
        위 요청을 바탕으로 오늘 해야 할 구체적인 할 일 목록을 만들어줘.
        ${BASE_TODO_RULES}
    `;
};

/** 아무것도 없을 때 */
const getDefaultTodoPrompt = () => {
    return `
        너는 ADHD 성향을 가진 사용자의 행동력을 높여주는 '실행력 보조 AI 코치'야.
        사용자가 오늘 무엇을 해야 할지 막막한 상태야.
        ADHD 사용자에게 도움이 될 오늘의 기본 할 일 목록을 만들어줘.
        ${BASE_TODO_RULES}
    `;
};

module.exports = { getTodoPrompt, getTextTodoPrompt, getDefaultTodoPrompt };
