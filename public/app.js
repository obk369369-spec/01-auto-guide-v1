const customerFileInput = document.getElementById("customer-file");
const loadCustomersBtn = document.getElementById("load-customers");
const analysisOutput = document.getElementById("analysis-output");

const generateGuideBtn = document.getElementById("generate-guide");
const reportOutput = document.getElementById("report-output");

const reactionSelect = document.getElementById("reaction-select");
const followupNotes = document.getElementById("followup-notes");
const saveFollowupBtn = document.getElementById("save-followup");

const logOutput = document.getElementById("log-output");

function appendLog(text) {
  if (!logOutput) return;
  const now = new Date().toISOString().slice(11, 19);
  logOutput.textContent += `\n[${now}] ${text}`;
}

// 1단계: 고객 데이터 불러오기 (파일 선택 + 준비 상태 기록)
loadCustomersBtn?.addEventListener("click", () => {
  const file = customerFileInput?.files?.[0];
  if (!file) {
    appendLog("고객 엑셀 파일이 선택되지 않았습니다.");
    return;
  }

  appendLog(`고객 데이터 파일 준비됨: ${file.name}`);
  appendLog("※ 실제 엑셀 분석 로직은 이후 단계에서 연결 예정.");

  if (analysisOutput && !analysisOutput.value.trim()) {
    analysisOutput.value =
      "예시 기준:\n" +
      "- 연구비 있는 고객만 필터\n" +
      "- 최근 문의/구매 고객 우선\n" +
      "- 특정 연구분야(접착제, 글래스 기판 등) 우선 정리\n";
  }
});

// 3단계: 안내서 초안 자동 생성
generateGuideBtn?.addEventListener("click", () => {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const analysisText = analysisOutput?.value.trim() || "(분석 메모 없음)";

  const guideText = [
    "◆ WIC 자동화 안내서 (1번 도구) – 고객 안내서 초안",
    "",
    `- 생성 시각: ${now}`,
    "- 기준 로직: 고객데이터 → 분석 → 맞춤 보고서 → 안내서 생성",
    "",
    "[1] 고객 데이터 분석 요약",
    analysisText,
    "",
    "[2] 제공 예정 자료",
    "- 해외 영문 시장보고서: 고객 연구분야·연구비 기준으로 자동 선택",
    "- 필요 시 국내 보고서 / 영문 공학 도서 / 일본어 공학 도서 / 일본어 세미나 자료로 분기",
    "",
    "[3] 다음 단계",
    "- 고객 반응(열람, 회신, 무응답 등)을 기록",
    "- 반응에 따라 전화 / 추가자료 메일 / 견적·입찰 연결 등 후속조치 진행",
  ].join("\n");

  if (reportOutput) {
    reportOutput.value = guideText;
  }

  appendLog("안내서 초안이 자동 생성되었습니다.");
});

// 4단계: 고객 반응 · 후속조치 기록
saveFollowupBtn?.addEventListener("click", () => {
  const reaction = reactionSelect?.value;
  const notes = followupNotes?.value.trim();

  if (!reaction) {
    appendLog("고객 반응이 선택되지 않았습니다.");
    return;
  }

  let reactionLabel = "";
  switch (reaction) {
    case "opened":
      reactionLabel = "안내서 열람";
      break;
    case "replied":
      reactionLabel = "메일/전화 회신";
      break;
    case "no-response":
      reactionLabel = "무응답";
      break;
    case "request-quote":
      reactionLabel = "견적/입찰 요청";
      break;
    default:
      reactionLabel = reaction;
  }

  appendLog(
    `고객 반응 기록: ${reactionLabel}${
      notes ? ` / 메모: ${notes}` : ""
    }`
  );

  // 나중에 여기에: 서버로 로그 전송 / 엑셀로 내보내기 등의 로직 추가 가능
});
